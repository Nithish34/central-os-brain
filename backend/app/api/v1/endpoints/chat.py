from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from collections import OrderedDict
import uuid
from app.core.database import get_db
from app.models.conflict import Conflict
from app.models.event import CompanyEvent
from app.models.document import Document
from app.models.workflow import WorkflowAction
from app.models.audit import AuditLog
from app.models.agent import AgentProfile
from app.services.layer0_execution.action_executor import ActionExecutorService

router = APIRouter()


# ─── Server-side Session Store ───────────────────────────────────────────────
# In-memory dict keyed by session_id → {history: [...], created_at, last_active}
# Max 200 sessions, 6-hour idle expiry, 500 messages per session.

MAX_SESSIONS     = 200
SESSION_TTL_HRS  = 6
MAX_MSG_PER_SESS = 500

_sessions: OrderedDict = OrderedDict()   # session_id → session dict


def _purge_expired():
    """Remove sessions idle for more than SESSION_TTL_HRS."""
    cutoff = datetime.utcnow() - timedelta(hours=SESSION_TTL_HRS)
    expired = [k for k, v in _sessions.items() if v["last_active"] < cutoff]
    for k in expired:
        del _sessions[k]


def _get_or_create_session(session_id: Optional[str], title: Optional[str] = None) -> tuple[str, dict]:
    """Return (session_id, session_dict). Creates a new session if id is unknown."""
    _purge_expired()
    if session_id and session_id in _sessions:
        sess = _sessions[session_id]
        sess["last_active"] = datetime.utcnow()
        if title:
            sess["title"] = title
        _sessions.move_to_end(session_id)  # LRU update
        return session_id, sess
    # Create new
    if len(_sessions) >= MAX_SESSIONS:
        _sessions.popitem(last=False)  # evict oldest
    new_id = str(uuid.uuid4())
    sess = {
        "title": title or "New Conversation",
        "history": [],           # list of {"role": "user"|"bot", "text": str, "timestamp": str}
        "created_at": datetime.utcnow(),
        "last_active": datetime.utcnow(),
    }
    _sessions[new_id] = sess
    return new_id, sess


class CreateSessionRequest(BaseModel):
    title: Optional[str] = "New Conversation"


class RenameSessionRequest(BaseModel):
    title: str


class ChatMessage(BaseModel):
    role: str   # 'user' | 'bot'
    text: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None   # client sends its stored session ID
    provider: Optional[str] = "auto"   # 'auto' | 'gemini' | 'openai' | 'anthropic' | 'cognitive'
    model: Optional[str] = None        # e.g. 'gemini-1.5-flash', 'gpt-4o-mini'
    api_key: Optional[str] = None      # optional user-supplied API key
    # Legacy: still accept history array from old clients, ignored when session_id is used
    history: Optional[List[ChatMessage]] = []


from app.services.layer2_intelligence.nlp_chat_engine import NLPChatEngine


def build_system_context(db: Session) -> str:
    """Builds a rich live context snapshot from the database for the AI to reason over."""
    # Conflicts
    conflicts = db.query(Conflict).all()
    conflict_lines = []
    for c in conflicts:
        conflict_lines.append(
            f"- [{c.severity.upper()} | {c.status.upper()}] '{c.title}' (domain: {c.domain}, "
            f"risk: {c.risk_level}, score: {c.contradiction_score}, owner: {c.owner})\n"
            f"  OLD CLAIM: {c.old_claim}\n"
            f"  NEW CLAIM: {c.new_claim}\n"
            f"  RECOMMENDED: {c.recommended_update}"
        )

    # Events
    events = db.query(CompanyEvent).order_by(CompanyEvent.timestamp.desc()).limit(20).all()
    event_lines = []
    for e in events:
        event_lines.append(
            f"- [{e.source}] '{e.title}' by {e.author} @ {e.timestamp} "
            f"[authority: {e.authority_score}, freshness: {e.freshness_score}]"
        )

    # Workflows
    workflows = db.query(WorkflowAction).order_by(WorkflowAction.created_at.desc()).limit(20).all()
    wf_lines = []
    for w in workflows:
        wf_lines.append(f"- [{w.status}] {w.tool}: '{w.title}' @ {w.created_at} (conflict: {w.conflict_id})")

    # Audit Logs
    audits = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(15).all()
    audit_lines = []
    for a in audits:
        audit_lines.append(
            f"- [{a.action.upper()}] '{a.title}' by {a.actor} @ {a.timestamp} "
            f"(risk: {a.risk_level}, evidence sources: {a.evidence_count})"
        )

    # Agents
    agents = db.query(AgentProfile).all()
    agent_lines = [
        f"- {a.name} ({a.domain}) — {a.conflicts_detected} conflicts detected, status: {a.status}"
        for a in agents
    ]

    now = datetime.now().astimezone().strftime("%d %b %Y, %I:%M:%S %p %Z")

    return f"""You are the Company Brain OS Intelligence Assistant — a context-aware AI embedded inside an enterprise knowledge management and self-healing workflow platform.

Current Time: {now}

Your role is to answer questions about the live state of the system, including:
- Conflicts detected in the Conflict Inbox
- Events arriving from integrations (Slack, GitHub, Gmail, Teams)
- The Processing Pipeline (ingested events)
- Executed workflows (Layer 0 Execution)
- Audit logs and compliance history
- AI Agents (their status, domains, detections)

Always be specific and reference real data from below. If asked about a conflict, quote the actual old vs new claims. Suggest actionable next steps when relevant.

━━━ LIVE CONFLICT INBOX ━━━
{chr(10).join(conflict_lines) if conflict_lines else "No conflicts found."}

━━━ RECENT PIPELINE EVENTS (last 20) ━━━
{chr(10).join(event_lines) if event_lines else "No events ingested yet."}

━━━ EXECUTION TIMELINE (last 20 workflows) ━━━
{chr(10).join(wf_lines) if wf_lines else "No workflows executed yet."}

━━━ AUDIT LOG (last 15) ━━━
{chr(10).join(audit_lines) if audit_lines else "No audit records yet."}

━━━ ACTIVE AI AGENTS ━━━
{chr(10).join(agent_lines) if agent_lines else "No agents found."}

Answer the user's question below using this live data. Be concise, insightful, and action-oriented."""


def format_conflict_detail(c: Conflict) -> str:
    """Return a rich, detailed breakdown of a single conflict."""
    icon = "🔴" if c.severity == "high" else ("🟡" if c.severity == "medium" else "🟢")
    status_icon = "✅" if c.status == "approved" else ("🟠" if c.status == "open" else "🔄")
    evidence_count = len(c.evidence_ids) if c.evidence_ids else 0
    return (
        f"{icon} **{c.title}**\n\n"
        f"**Status:** {status_icon} `{c.status.upper()}` | **Risk:** `{c.risk_level}` | **Severity:** `{c.severity.upper()}`\n"
        f"**Domain:** {c.domain} | **Owner:** {c.owner}\n"
        f"**AI Confidence:** {round((c.contradiction_score or 0) * 100)}% contradiction score | "
        f"**Evidence Sources:** {evidence_count}\n\n"
        f"---\n\n"
        f"📄 **What the docs say (Old Claim):**\n{c.old_claim}\n\n"
        f"⚡ **What reality says (New Claim from live evidence):**\n{c.new_claim}\n\n"
        f"---\n\n"
        f"✅ **Recommended Action:**\n{c.recommended_update}\n\n"
        f"💼 **Business Impact:**\n{c.business_impact or 'Not specified.'}\n\n"
        f"🔗 **Detected by:** `{c.detected_by or 'Contradiction Engine'}` | "
        f"Freshness delta: `{c.freshness_delta}` | Authority delta: `{c.authority_delta}`"
    )


def resolve_context_conflict(history: list, conflicts: list) -> Optional[Conflict]:
    """
    Scan conversation history for the most recently discussed conflict
    by matching conflict title/id keywords in past bot messages.
    """
    if not history or not conflicts:
        return None
    # Walk history in reverse (most recent first)
    for msg in reversed(history):
        if msg.role != 'bot':
            continue
        text_lower = msg.text.lower()
        for c in conflicts:
            keywords = [c.title.lower()] + [w for w in c.id.replace('-', ' ').split() if len(w) > 3]
            if any(kw in text_lower for kw in keywords):
                return c
    return None


def rule_based_chat(message: str, db: Session, history: list = None) -> str:
    """
    Local rule-based intelligence engine — answers common questions from live DB data
    without needing an external LLM API key.
    Supports conversation history for contextual follow-up questions.
    """
    msg = message.lower().strip()
    if history is None:
        history = []

    # Load live data
    conflicts = db.query(Conflict).all()
    open_conflicts = [c for c in conflicts if c.status == "open"]
    approved_conflicts = [c for c in conflicts if c.status == "approved"]
    events = db.query(CompanyEvent).order_by(CompanyEvent.timestamp.desc()).limit(20).all()
    workflows = db.query(WorkflowAction).order_by(WorkflowAction.created_at.desc()).limit(10).all()
    audits = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all()
    agents = db.query(AgentProfile).all()

    # ── PRIORITY -1: Action Commands (approve / reject / reopen / edit) ────
    # These are the highest priority — chatbot acts as a command center.

    ACTION_VERBS = ["approve", "reject", "reopen", "re-open", "accept",
                    "decline", "dismiss", "change owner", "set owner", "assign",
                    "change risk", "set risk", "change severity", "set severity",
                    "update risk", "update severity", "update owner",
                    "approve all", "reject all", "fix all", "resolve all"]

    is_action = any(v in msg for v in ACTION_VERBS)

    ORDINALS = {
        "first": 0, "1st": 0,
        "second": 1, "2nd": 1,
        "third": 2, "3rd": 2,
        "fourth": 3, "4th": 3,
        "last": -1, "latest": -1,
    }

    if is_action:
        # 1. Resolve target conflict(s)
        # a. Bulk — all open
        if any(k in msg for k in ["approve all", "reject all", "all conflicts", "all open"]):
            if "approve" in msg or "accept" in msg:
                results = []
                for c in open_conflicts:
                    status_code, result = ActionExecutorService.apply_approval(db, c.id, "approve", "Bulk approved via chatbot")
                    if status_code == 200:
                        results.append(c.title)
                if not results:
                    return "✅ No open conflicts to approve right now."
                bullet = "\n".join(f"  ✅ {t}" for t in results)
                return (
                    f"🚀 **Bulk Approval Complete!** {len(results)} conflict(s) approved:\n\n"
                    f"{bullet}\n\n"
                    f"Layer 0 execution workflows dispatched for all. Check the **Execution Timeline** and **Audit Logs** for full records."
                )
            if "reject" in msg or "decline" in msg or "dismiss" in msg:
                results = []
                for c in open_conflicts:
                    status_code, result = ActionExecutorService.apply_approval(db, c.id, "reject", "Bulk rejected via chatbot")
                    if status_code == 200:
                        results.append(c.title)
                if not results:
                    return "No open conflicts to reject."
                bullet = "\n".join(f"  ❌ {t}" for t in results)
                return (
                    f"❌ **Bulk Rejection Complete.** {len(results)} conflict(s) rejected:\n\n"
                    f"{bullet}\n\n"
                    f"Audit records created for each. You can re-open any of them by saying 'reopen the [name] conflict'."
                )

        # b. Resolve single target by position / name / context
        target = None
        for word, idx in ORDINALS.items():
            if word in msg and conflicts:
                try:
                    target = conflicts[idx]
                    break
                except IndexError:
                    pass

        if target is None:
            # Named keyword match
            conflict_kw = {
                c: [w for w in (c.title + " " + (c.domain or "") + " " + c.id.replace("-", " ")).lower().split() if len(w) > 3]
                for c in conflicts
            }
            best, best_score = None, 0
            for c, kws in conflict_kw.items():
                score = sum(1 for k in kws if k in msg)
                if score > best_score:
                    best_score, best = score, c
            if best and best_score >= 1:
                target = best

        if target is None:
            # Fall back to conversation context
            target = resolve_context_conflict(history, conflicts)

        if target is None and is_action:
            return (
                "🤔 I'm not sure which conflict you want to act on.\n\n"
                "Try being specific, e.g.:\n"
                "• *'Approve the first conflict'*\n"
                "• *'Reject the payment conflict'*\n"
                "• *'Approve all open conflicts'*\n"
                "• *'Reopen the onboarding conflict'*"
            )

        # 2. Execute the action
        now_ts = datetime.now().astimezone().strftime("%d %b %Y, %I:%M:%S %p")

        # ── Approve ───────────────────────────────────────────────────────
        if any(k in msg for k in ["approve", "accept"]):
            if target.status == "approved":
                return (
                    f"✅ **'{target.title}'** is already approved.\n\n"
                    f"Approved at some point by Hackathon Demo Admin. No action needed."
                )
            status_code, result = ActionExecutorService.apply_approval(
                db, target.id, "approve", "Approved via Company Brain OS chatbot"
            )
            if status_code != 200:
                return f"❌ Could not approve '{target.title}'. Error: {result.get('error', 'Unknown')}"

            wf_tools = [w['tool'] for w in result.get('workflows', [])]
            return (
                f"✅ **Conflict Approved!**\n\n"
                f"**{target.title}**\n"
                f"Owner: {target.owner} | Risk: `{target.risk_level}` | {now_ts}\n\n"
                f"**Layer 0 Execution — {len(wf_tools)} workflows dispatched:**\n"
                + "\n".join(f"  🔧 {t}" for t in wf_tools) +
                f"\n\n**Recommended action applied:**\n{target.recommended_update}\n\n"
                f"📑 Audit record created. View the **Execution Timeline** and **Audit Logs** for full records."
            )

        # ── Reject ────────────────────────────────────────────────────────
        if any(k in msg for k in ["reject", "decline", "dismiss"]):
            if target.status == "rejected":
                return f"❌ **'{target.title}'** is already rejected."
            status_code, result = ActionExecutorService.apply_approval(
                db, target.id, "reject", "Rejected via Company Brain OS chatbot"
            )
            if status_code != 200:
                return f"❌ Could not reject '{target.title}'. Error: {result.get('error', 'Unknown')}"
            return (
                f"❌ **Conflict Rejected.**\n\n"
                f"**{target.title}** has been marked as `REJECTED` and logged in the Audit trail.\n"
                f"Owner: {target.owner} | {now_ts}\n\n"
                f"The official document will remain unchanged. Say *'reopen the {target.domain or 'this'} conflict'* to reverse this."
            )

        # ── Reopen ────────────────────────────────────────────────────────
        if any(k in msg for k in ["reopen", "re-open", "open again", "reset"]):
            target.status = "open"
            db.commit()
            return (
                f"🟠 **Conflict Reopened.**\n\n"
                f"**'{target.title}'** is now back to `OPEN` status.\n"
                f"Owner: {target.owner} | Risk: `{target.risk_level}` | {now_ts}\n\n"
                f"It will appear in the **Conflict Inbox** for review. Say *'approve the {target.domain or 'this'} conflict'* when ready."
            )

        # ── Change Owner ──────────────────────────────────────────────────
        if any(k in msg for k in ["change owner", "set owner", "assign to", "assign owner", "update owner"]):
            # Extract new owner — text after "to "
            new_owner = None
            for part in ["to ", "assign ", "owner "]:
                if part in msg:
                    candidate = message[msg.find(part) + len(part):].strip().rstrip(".").strip()
                    if candidate and len(candidate) < 80:
                        new_owner = candidate
                        break
            if not new_owner:
                return f"Please specify the new owner. E.g.: *'Change owner of the payment conflict to DevOps Team'*"
            old_owner = target.owner
            target.owner = new_owner
            db.commit()
            return (
                f"👤 **Owner Updated.**\n\n"
                f"**'{target.title}'**\n"
                f"Old owner: {old_owner}\n"
                f"New owner: **{new_owner}**\n"
                f"Updated at {now_ts}"
            )

        # ── Change Severity ───────────────────────────────────────────────
        if any(k in msg for k in ["change severity", "set severity", "update severity"]):
            for sev in ["critical", "high", "medium", "low"]:
                if sev in msg:
                    old_sev = target.severity
                    target.severity = sev
                    db.commit()
                    return (
                        f"⚡ **Severity Updated.**\n\n"
                        f"**'{target.title}'**\n"
                        f"Old severity: `{old_sev.upper()}`\n"
                        f"New severity: `{sev.upper()}`\n"
                        f"Updated at {now_ts}"
                    )
            return "Please specify severity: critical, high, medium, or low."

        # ── Change Risk ────────────────────────────────────────────────────
        if any(k in msg for k in ["change risk", "set risk", "update risk"]):
            for risk in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
                if risk.lower() in msg:
                    old_risk = target.risk_level
                    target.risk_level = risk
                    db.commit()
                    return (
                        f"🛡️ **Risk Level Updated.**\n\n"
                        f"**'{target.title}'**\n"
                        f"Old risk: `{old_risk}`\n"
                        f"New risk: `{risk}`\n"
                        f"Updated at {now_ts}"
                    )
            return "Please specify risk level: CRITICAL, HIGH, MEDIUM, or LOW."

        # If action verb matched but no sub-action resolved, show full detail
        return format_conflict_detail(target) + (
            f"\n\n---\n\n"
            f"💡 **I can act on this conflict. Try:**\n"
            f"• *'Approve this conflict'*\n"
            f"• *'Reject this conflict'*\n"
            f"• *'Change owner to [team name]'*\n"
            f"• *'Set severity to HIGH'*"
        )

    # ── PRIORITY 0: Follow-up questions resolved using conversation history ──
    FOLLOWUP_TRIGGERS = [
        "this conflict", "that conflict", "the conflict", "this issue", "that issue",
        "old claim", "new claim", "date of", "when was", "who owns", "who detected",
        "what was the", "what is the", "tell me more", "more details", "and the",
        "what document", "which document", "the document", "business impact",
        "what action", "recommended", "severity", "evidence", "confidence",
        "why is", "how was", "what does", "explain this", "describe this",
        "authority delta", "freshness", "detected by", "agent",
    ]
    is_followup = any(trigger in msg for trigger in FOLLOWUP_TRIGGERS)
    ctx_conflict = resolve_context_conflict(history, conflicts)

    if is_followup and ctx_conflict:
        c = ctx_conflict
        doc = db.query(Document).filter(Document.id == c.document_id).first()

        # Date-specific follow-ups
        if any(k in msg for k in ["date", "when", "time", "timestamp"]):
            if "old" in msg or "document" in msg or "original" in msg or "claim" in msg:
                doc_date = doc.timestamp if doc else "Unknown"
                return (
                    f"📅 **Date of the Old Claim (Source Document)**\
\n\n"
                    f"The official document *'{doc.title if doc else c.document_id}'* was last written/updated on:\
\n"
                    f"**{doc_date}**\
\n\n"
                    f"📄 **Old Claim recorded:** *\"{c.old_claim}\"*\
\n"
                    f"✍️ **Author:** {doc.author if doc else 'Unknown'} | **Source:** {doc.source if doc else 'N/A'}"
                )
            if "new" in msg or "evidence" in msg or "live" in msg or "event" in msg:
                ev_ids = c.evidence_ids or []
                newest = db.query(CompanyEvent).filter(CompanyEvent.id.in_(ev_ids)).order_by(CompanyEvent.timestamp.desc()).first() if ev_ids else None
                ev_date = newest.timestamp if newest else "Unknown"
                ev_source = newest.source if newest else "Unknown"
                return (
                    f"📅 **Date of the New Claim (Live Evidence)**\
\n\n"
                    f"The most recent live event that contradicted the official document was received on:\
\n"
                    f"**{ev_date}** from **{ev_source}**\
\n\n"
                    f"⚡ **Content:** *\"{newest.title if newest else c.new_claim}\"*\
\n"
                    f"By **{newest.author if newest else 'Unknown'}** | Freshness: {round((newest.freshness_score if newest else 0)*100)}%"
                )
            # Generic date — show both
            doc_date = doc.timestamp if doc else "Unknown"
            ev_ids = c.evidence_ids or []
            newest = db.query(CompanyEvent).filter(CompanyEvent.id.in_(ev_ids)).order_by(CompanyEvent.timestamp.desc()).first() if ev_ids else None
            return (
                f"📅 **Timeline for '{c.title}'**\
\n\n"
                f"📄 **Official doc written:** {doc_date} (by {doc.author if doc else 'Unknown'})\
\n"
                f"⚡ **Live evidence received:** {newest.timestamp if newest else 'Unknown'} (from {newest.source if newest else 'N/A'})\
\n"
                f"⏱️ **Freshness delta:** `{c.freshness_delta}` — how stale the old claim was vs live evidence"
            )

        # Owner / who owns follow-ups
        if any(k in msg for k in ["who owns", "owner", "team", "responsible"]):
            return (
                f"👤 **Ownership for '{c.title}'**\
\n\n"
                f"**Conflict Owner:** {c.owner}\
\n"
                f"**Document Owner:** {doc.owner if doc else 'Unknown'}\
\n"
                f"**Detected by Agent:** `{c.detected_by}`\
\n"
                f"**Approval Matrix:** {c.approval_matrix or 'Default policy'}"
            )

        # Evidence follow-ups
        if any(k in msg for k in ["evidence", "sources", "who said", "where did"]):
            ev_ids = c.evidence_ids or []
            evs = db.query(CompanyEvent).filter(CompanyEvent.id.in_(ev_ids)).all()
            if not evs:
                return f"No evidence events found for '{c.title}'."
            parts = [f"📎 **Evidence Sources for '{c.title}'** ({len(evs)} sources):\
\n"]
            for e in evs:
                parts.append(f"• **[{e.source}]** {e.title} by {e.author} @ {e.timestamp} (authority: {round(e.authority_score*100)}%)")
            return "\
".join(parts)

        # Business impact follow-ups
        if any(k in msg for k in ["business impact", "impact", "risk to", "consequence"]):
            return (
                f"💼 **Business Impact for '{c.title}'**\
\n\n"
                f"{c.business_impact or 'No business impact recorded.'}\
\n\n"
                f"**Risk Level:** `{c.risk_level}` | **Severity:** `{(c.severity or 'unknown').upper()}`\
\n"
                f"**Owner responsible for resolution:** {c.owner}"
            )

        # Default: show full detail again with context note
        return format_conflict_detail(c) + f"\
\n---\
\n💡 *Continuing context from previous message. Ask me about dates, evidence, ownership, or business impact.*"

    # ── PRIORITY 1: Specific Integration & Pipeline Event Lookups ──────────
    # Handles queries like "what was the latest message from slack", "github events", etc.
    PLATFORMS = ["slack", "github", "gmail", "teams", "jira"]
    is_platform_query = any(p in msg for p in PLATFORMS)
    is_event_query    = any(k in msg for k in ["pipeline", "event", "message", "ingestion", "pr", "pull request", "email", "chat message"])

    if is_platform_query or (is_event_query and not any(c_kw in msg for c_kw in ["conflict", "contradiction", "inbox", "approve", "reject", "reopen"])):
        # Check if targeting a specific platform
        target_platform = None
        for p in PLATFORMS:
            if p in msg:
                target_platform = p.capitalize() if p != "github" else "GitHub"
                if p == "gmail": target_platform = "Gmail"
                if p == "teams": target_platform = "Teams"
                break

        matched_events = [e for e in events if e.source.lower() == target_platform.lower()] if target_platform else events

        if not matched_events:
            plat_name = target_platform or "the pipeline"
            return f"⚙️ No events found for **{plat_name}** yet. As new messages arrive via webhook or poller, they will appear here in real-time."

        # If asking for "latest", "last", "newest", or a singular "message/event"
        if any(k in msg for k in ["latest", "last", "newest", "recent message", "what was the message", "what is the message", "what was the last"]):
            latest_ev = matched_events[0]
            icon = {"Slack": "💬", "GitHub": "🐙", "Gmail": "✉️", "Teams": "👥", "Jira": "🎯"}.get(latest_ev.source, "📄")
            return (
                f"{icon} **Latest Message from {latest_ev.source}**\n\n"
                f"**Channel / Title:** {latest_ev.title}\n"
                f"**Author:** {latest_ev.author} | **Timestamp:** {latest_ev.timestamp}\n"
                f"**Authority Score:** {round(latest_ev.authority_score * 100)}% | **Freshness:** {round(latest_ev.freshness_score * 100)}%\n\n"
                f"---\n\n"
                f"📝 **Message Content:**\n"
                f"> {latest_ev.content or latest_ev.title}\n\n"
                f"---\n\n"
                f"⚙️ **Pipeline Status:** `{latest_ev.pipeline_stage.upper()}` | **Normalized Type:** `{latest_ev.event_type_normalized}`\n"
                f"🔍 **Vector Indexed:** `{'Yes' if latest_ev.vector_indexed else 'Pending'}` | **ID:** `{latest_ev.id}`"
            )

        # List all events for this source / pipeline
        plat_label = target_platform or "Processing Pipeline"
        parts = [f"⚙️ **{plat_label}** — {len(matched_events)} event(s) recorded:\n"]
        for e in matched_events[:10]:
            icon = {"Slack": "💬", "GitHub": "🐙", "Gmail": "✉️", "Teams": "👥", "Jira": "🎯"}.get(e.source, "📄")
            parts.append(
                f"{icon} **[{e.source}]** {e.title}\n"
                f"   By **{e.author}** @ {e.timestamp}\n"
                f"   *Content:* \"{e.content[:85] + ('…' if len(e.content or '') > 85 else '')}\"\n"
                f"   Authority: {round(e.authority_score*100)}% | Freshness: {round(e.freshness_score*100)}%\n"
            )
        return "\n".join(parts)

    # ── PRIORITY 2: Positional conflict lookup (first, second, third) ────────
    ORDINALS = {
        "first": 0, "1st": 0,
        "second": 1, "2nd": 1,
        "third": 2, "3rd": 2,
        "fourth": 3, "4th": 3,
    }
    detail_intent = any(k in msg for k in [
        "explain", "detail", "describe", "tell me about", "elaborate",
        "what is", "what's", "more about", "deep dive", "breakdown"
    ])
    for word, idx in ORDINALS.items():
        if word in msg and conflicts:
            try:
                target = conflicts[idx]
                return format_conflict_detail(target)
            except IndexError:
                pass

    # ── PRIORITY 3: Named conflict keyword lookup ───────────────────────────
    # Check for keywords from conflict titles/domains in the message
    conflict_keywords = {
        c: [
            w for w in (c.title + " " + (c.domain or "") + " " + c.id.replace("-", " ")).lower().split()
            if len(w) > 3
        ]
        for c in conflicts
    }
    # Score each conflict by keyword overlap with the message
    best_match = None
    best_score = 0
    for c, keywords in conflict_keywords.items():
        score = sum(1 for kw in keywords if kw in msg)
        if score > best_score:
            best_score = score
            best_match = c

    # If detail intent + a conflict keyword match, show full detail
    if detail_intent and best_match and best_score >= 1:
        return format_conflict_detail(best_match)

    # ── PRIORITY 4: Only-open or only-approved filter ──────────────────────
    if "open" in msg and "conflict" in msg and not detail_intent:
        if not open_conflicts:
            return "✅ No open conflicts right now! All detected conflicts have been approved."
        parts = [f"📋 **Open Conflicts** — {len(open_conflicts)} requiring attention:\n"]
        for c in open_conflicts:
            parts.append(
                f"🟡 **{c.title}**\n"
                f"   Risk: `{c.risk_level}` | Owner: {c.owner}\n"
                f"   **Was:** {c.old_claim}\n"
                f"   **Now:** {c.new_claim}\n"
                f"   **Action:** {c.recommended_update}\n"
            )
        return "\n".join(parts)

    if "approved" in msg and "conflict" in msg and not detail_intent:
        if not approved_conflicts:
            return "No conflicts have been approved yet."
        parts = [f"📋 **Approved Conflicts** — {len(approved_conflicts)} resolved:\n"]
        for c in approved_conflicts:
            parts.append(
                f"✅ **{c.title}** (Owner: {c.owner} | Risk: `{c.risk_level}`)\n"
                f"   Resolved action: {c.recommended_update}\n"
            )
        return "\n".join(parts)

    # ── PRIORITY 5: Broad conflict list ────────────────────────────────────
    if any(k in msg for k in ["conflict", "inbox", "pending", "all conflicts", "current conflicts", "what are"]):
        if not conflicts:
            return "✅ No conflicts detected yet. The system is monitoring all integrations."
        parts = [f"📋 **Conflict Inbox** — {len(open_conflicts)} open, {len(approved_conflicts)} approved:\n"]
        for c in conflicts:
            icon = "🔴" if c.severity == "high" else ("🟡" if c.severity == "medium" else "🟢")
            parts.append(
                f"{icon} **{c.title}**\n"
                f"   Status: `{c.status.upper()}` | Risk: `{c.risk_level}` | Owner: {c.owner}\n"
                f"   **Was:** {c.old_claim}\n"
                f"   **Now:** {c.new_claim}\n"
                f"   **Action:** {c.recommended_update}\n"
            )
        parts.append("\n💡 *Tip: Ask me to 'explain the first conflict' or 'detail the payment conflict' for a full breakdown.*")
        return "\n".join(parts)

    # ── PRIORITY 6: Detail intent with best match fallback ─────────────────
    if detail_intent and best_match:
        return format_conflict_detail(best_match)

    # ── Workflows / execution ──────────────────────────────────────────────
    if any(k in msg for k in ["workflow", "execution", "timeline", "executed", "jira", "knowled", "knowledge base"]):
        if not workflows:
            return "⚡ No workflows executed yet. Approve a conflict from the Conflict Inbox to trigger automated execution."
        parts = [f"⚡ **Execution Timeline** — {len(workflows)} recent actions:\n"]
        for w in workflows:
            icon = {"Risk & Policy Engine": "🛡️", "Knowledge Base": "📘", "Jira": "🎯", "Slack": "💬", "GitHub": "🐙"}.get(w.tool, "🔧")
            parts.append(f"{icon} **{w.tool}**: {w.title} — `{w.status}` @ {w.created_at}")
        return "\n".join(parts)

    # ── Audit logs ─────────────────────────────────────────────────────────
    if any(k in msg for k in ["audit", "log", "compliance", "history", "who approved", "who rejected"]):
        if not audits:
            return "📑 No audit records yet. Audit entries are created automatically when conflicts are approved or rejected."
        parts = ["📑 **Audit & Compliance Log:**\n"]
        for a in audits:
            action_icon = "✅" if a.action == "approved" else ("❌" if a.action == "rejected" else "🔄")
            parts.append(
                f"{action_icon} **{a.title}**\n"
                f"   Actor: {a.actor} | Action: `{a.action}` | Risk: `{a.risk_level}` | {a.timestamp}\n"
            )
        return "\n".join(parts)

    # ── Agents ─────────────────────────────────────────────────────────────
    if any(k in msg for k in ["agent", "detector", "who is monitoring", "monitoring"]):
        if not agents:
            return "🤖 No agents configured yet."
        parts = ["🤖 **Active AI Agents:**\n"]
        for a in agents:
            parts.append(
                f"{'🟢' if a.status == 'active' else '🔴'} **{a.name}** ({a.domain})\n"
                f"   {a.description}\n"
                f"   Conflicts detected: {a.conflicts_detected} | Tasks: {a.tasks_completed}\n"
            )
        return "\n".join(parts)

    # ── Summary / status ───────────────────────────────────────────────────
    if any(k in msg for k in ["summary", "status", "overview", "health", "how many", "total", "hello", "hi", "hey", "what can"]):
        slack_events = sum(1 for e in events if e.source == "Slack")
        github_events = sum(1 for e in events if e.source == "GitHub")
        gmail_events = sum(1 for e in events if e.source == "Gmail")
        return (
            f"👋 **Company Brain OS — Live System Summary**\n\n"
            f"📋 **Conflicts:** {len(open_conflicts)} open, {len(approved_conflicts)} approved out of {len(conflicts)} total\n"
            f"⚙️ **Pipeline Events:** {len(events)} ingested ({slack_events} Slack, {github_events} GitHub, {gmail_events} Gmail)\n"
            f"⚡ **Workflows Executed:** {len(workflows)}\n"
            f"📑 **Audit Records:** {len(audits)}\n"
            f"🤖 **Active Agents:** {sum(1 for a in agents if a.status == 'active')}/{len(agents)}\n\n"
            f"💡 Ask me about: **conflicts**, **pipeline events**, **execution workflows**, **audit logs**, or **AI agents**.\n"
            f"🔍 Or try: *'Explain the first conflict'*, *'Detail the payment conflict'*, *'Who approved last?'*"
        )

    # ── Help ───────────────────────────────────────────────────────────────
    if any(k in msg for k in ["help", "what can you", "capabilities", "commands"]):
        return (
            "💡 **I can answer questions about:**\n\n"
            "📋 **Conflict Inbox** — 'Show all conflicts', 'Explain the first conflict', 'Detail the payment conflict'\n"
            "⚙️ **Pipeline** — 'What events came from Slack?', 'Show recent GitHub events'\n"
            "⚡ **Execution** — 'What workflows were executed?', 'Show execution timeline'\n"
            "📑 **Audit** — 'Who approved the last conflict?', 'Show compliance log'\n"
            "🤖 **AI Agents** — 'Which agents are active?', 'What is the Engineering Agent doing?'\n"
            "📊 **Summary** — 'Give me a system overview', 'What is the current status?'\n"
        )

    # ── Fallback ───────────────────────────────────────────────────────────
    return (
        f"🧠 I can help you explore the live state of Company Brain OS.\n\n"
        f"Currently tracking **{len(conflicts)} conflicts**, **{len(events)} pipeline events**, "
        f"and **{len(workflows)} executed workflows**.\n\n"
        f"Try asking:\n"
        f"• *'Explain the first conflict'*\n"
        f"• *'What events came from Slack?'*\n"
        f"• *'Who approved the last conflict?'*\n"
        f"• *'Give me a system summary'*\n"
        f"• *'Which AI agents are active?'*"
    )


@router.post("", summary="Chat with the Company Brain OS Intelligence Assistant")
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    """
    Stateful AI chat with deep NLP & LLM reasoning.
    Supports Google Gemini, OpenAI GPT-4o, Anthropic Claude, and built-in Cognitive Reasoner.
    """
    session_id, sess = _get_or_create_session(req.session_id)
    history = sess["history"]

    # Auto-generate meaningful session title from first user query if default
    if sess.get("title") in (None, "New Conversation", "") and req.message:
        clean_msg = req.message.strip().replace("\n", " ")
        if len(clean_msg) > 42:
            sess["title"] = clean_msg[:40] + "…"
        else:
            sess["title"] = clean_msg

    now_iso = datetime.now().astimezone().isoformat(timespec="seconds")

    # Record the incoming user message
    history.append({"role": "user", "text": req.message, "timestamp": now_iso})

    # Call the advanced NLPChatEngine (Live LLM or Cognitive Reasoner)
    reply, engine_used = await NLPChatEngine.chat(
        message=req.message,
        db=db,
        history=history,
        provider=req.provider,
        api_key=req.api_key,
        model=req.model
    )

    # Persist the bot reply
    history.append({"role": "bot", "text": reply, "timestamp": now_iso, "engine": engine_used})

    # Trim to max messages
    if len(history) > MAX_MSG_PER_SESS:
        sess["history"] = history[-MAX_MSG_PER_SESS:]

    return {
        "reply": reply,
        "engine": engine_used,
        "session_id": session_id,
        "title": sess.get("title", "Conversation"),
        "message_count": len(sess["history"]),
        "timestamp": now_iso,
        "sources": ["conflicts", "events", "workflows", "audit_logs", "agents"]
    }


@router.get("/models", summary="List supported NLP & LLM intelligence engines")
def get_supported_models():
    """Returns available LLM providers and currently active configuration status."""
    return {
        "active_default": "gemini-1.5-flash" if settings.GEMINI_API_KEY else ("gpt-4o-mini" if settings.OPENAI_API_KEY else "cognitive-nlp-engine"),
        "has_gemini_key": bool(settings.GEMINI_API_KEY),
        "has_openai_key": bool(settings.OPENAI_API_KEY),
        "has_anthropic_key": bool(settings.ANTHROPIC_API_KEY),
        "models": [
            {
                "id": "cognitive",
                "name": "Cognitive NLP Reasoner (Built-in / Zero-Key)",
                "provider": "builtin",
                "status": "ready",
                "description": "Full semantic parsing, causal analysis, comparisons, and action orchestration without external APIs."
            },
            {
                "id": "gemini-1.5-flash",
                "name": "Google Gemini 1.5 Flash",
                "provider": "gemini",
                "status": "ready" if settings.GEMINI_API_KEY else "needs_key",
                "description": "Ultra-fast multimodal reasoning with live system state grounding."
            },
            {
                "id": "gpt-4o-mini",
                "name": "OpenAI GPT-4o Mini",
                "provider": "openai",
                "status": "ready" if settings.OPENAI_API_KEY else "needs_key",
                "description": "High-intelligence conversational reasoner with autonomous tool calling."
            },
            {
                "id": "claude-3-5-sonnet",
                "name": "Anthropic Claude 3.5 Sonnet",
                "provider": "anthropic",
                "status": "ready" if settings.ANTHROPIC_API_KEY else "needs_key",
                "description": "Advanced nuanced synthesis and deep codebase & policy reasoning."
            }
        ]
    }


@router.post("/sessions/new", summary="Create a new conversation session")
def create_new_session(req: Optional[CreateSessionRequest] = None):
    """Starts a clean, new conversation session and returns its ID and metadata."""
    title = req.title if req and req.title else "New Conversation"
    session_id, sess = _get_or_create_session(None, title=title)
    return {
        "session_id": session_id,
        "title": sess["title"],
        "message_count": len(sess["history"]),
        "created_at": sess["created_at"].isoformat(),
        "last_active": sess["last_active"].isoformat(),
        "history": sess["history"]
    }


@router.get("/sessions", summary="List all saved conversation sessions")
def list_sessions():
    """Returns all active/saved conversations with previews and timestamps."""
    _purge_expired()
    sessions_list = []
    for sid, s in reversed(_sessions.items()):
        last_text = ""
        if s["history"]:
            last_msg = s["history"][-1]
            last_text = last_msg.get("text", "")[:75]
        sessions_list.append({
            "session_id": sid,
            "title": s.get("title", "Conversation"),
            "message_count": len(s["history"]),
            "preview": last_text,
            "created_at": s["created_at"].isoformat(),
            "last_active": s["last_active"].isoformat(),
        })
    return {
        "total": len(sessions_list),
        "sessions": sessions_list
    }


@router.get("/session/{session_id}", summary="Get full conversation history for a session")
def get_session(session_id: str):
    """Returns the full message history for a chat session."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    sess = _sessions[session_id]
    return {
        "session_id": session_id,
        "title": sess.get("title", "Conversation"),
        "message_count": len(sess["history"]),
        "created_at": sess["created_at"].isoformat(),
        "last_active": sess["last_active"].isoformat(),
        "history": sess["history"]
    }


@router.patch("/session/{session_id}", summary="Rename a chat session")
def rename_session(session_id: str, req: RenameSessionRequest):
    """Renames an existing chat session."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    _sessions[session_id]["title"] = req.title.strip()
    return {"ok": True, "session_id": session_id, "title": _sessions[session_id]["title"]}


@router.delete("/session/{session_id}", summary="Delete a chat session entirely")
def delete_session(session_id: str):
    """Deletes a conversation session completely from server memory."""
    if session_id in _sessions:
        del _sessions[session_id]
        return {"ok": True, "session_id": session_id, "deleted": True}
    return {"ok": False, "session_id": session_id, "deleted": False}
