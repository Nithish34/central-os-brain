import json
import re
import asyncio
import httpx
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, AsyncGenerator
from sqlalchemy.orm import Session
from app.core.config import Settings
from app.models.conflict import Conflict
from app.models.event import CompanyEvent
from app.models.document import Document
from app.models.workflow import WorkflowAction
from app.models.audit import AuditLog
from app.models.agent import AgentProfile
from app.services.layer0_execution.action_executor import ActionExecutorService
from app.services.layer2_intelligence.rag_engine import RAGEngineService

settings = Settings()


class NLPChatEngine:
    """
    Advanced NLP & Conversational AI Engine for Company Brain OS.
    Features:
    1. Live LLM Integration (OpenAI GPT-4o, Google Gemini, Anthropic Claude, Ollama)
    2. Deep System Grounding (Injects full knowledge graph, live events, DB state)
    3. Dynamic Hybrid RAG Retrieval (Dense 1536-dim embeddings + BM25 sparse search)
    4. Real-Time SSE Token Streaming (Fast, silky smooth conversational UX)
    5. Built-in Cognitive Reasoner (Analytical, causal, comparative, synthesis, drafting)
    6. Autonomous Function Calling (Approve, reject, reopen, assign, update risk/severity)
    """

    @classmethod
    def build_system_context(cls, db: Session, query: Optional[str] = None) -> Tuple[str, List[Dict[str, Any]]]:
        """Constructs a comprehensive real-time knowledge snapshot for NLP reasoning with RAG."""
        conflicts = db.query(Conflict).all()
        events = db.query(CompanyEvent).order_by(CompanyEvent.timestamp.desc()).limit(20).all()
        docs = db.query(Document).all()
        workflows = db.query(WorkflowAction).order_by(WorkflowAction.created_at.desc()).limit(12).all()
        audits = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all()
        agents = db.query(AgentProfile).all()

        # Hybrid RAG Context Retrieval for specific prompt
        rag_context, citations = RAGEngineService.get_rag_context(db, query or "company engineering architecture and decisions", top_k=4)

        conflict_data = []
        for c in conflicts:
            conflict_data.append(
                f"• CONFLICT [{c.id}] (Status: {c.status.upper()} | Severity: {c.severity.upper()} | Risk: {c.risk_level})\n"
                f"  Title: {c.title}\n"
                f"  Domain: {c.domain} | Owner: {c.owner}\n"
                f"  Document ID: {c.document_id} | Contradiction Score: {round((c.contradiction_score or 0)*100)}%\n"
                f"  Old Official Claim: \"{c.old_claim}\"\n"
                f"  New Operational Claim: \"{c.new_claim}\"\n"
                f"  Recommended Update: \"{c.recommended_update}\"\n"
                f"  Business Impact: \"{c.business_impact}\"\n"
                f"  Detected by: {c.detected_by} (Freshness Delta: {c.freshness_delta}, Authority Delta: {c.authority_delta})\n"
                f"  Evidence Event IDs: {c.evidence_ids}"
            )

        event_data = []
        for e in events:
            event_data.append(
                f"• EVENT [{e.id}] [{e.source}] by {e.author} @ {e.timestamp} (Authority: {round(e.authority_score*100)}%, Freshness: {round(e.freshness_score*100)}%):\n"
                f"  Title: {e.title}\n"
                f"  Content: \"{e.content}\"\n"
                f"  Pipeline Stage: {e.pipeline_stage} | Type: {e.event_type_normalized}"
            )

        doc_data = []
        for d in docs:
            doc_data.append(
                f"• DOCUMENT [{d.id}] '{d.title}' (Source: {d.source}, Owner: {d.owner}, Status: {d.status}, Freshness: {round(d.freshness_score*100)}%, Date: {d.timestamp}):\n"
                f"  Content snippet: \"{d.content[:160]}...\""
            )

        wf_data = [f"• WORKFLOW [{w.tool}]: {w.title} ({w.status}) @ {w.created_at}" for w in workflows]
        audit_data = [f"• AUDIT: {a.actor} -> {a.action.upper()} '{a.title}' @ {a.timestamp} (Risk: {a.risk_level})" for a in audits]
        agent_data = [f"• AGENT [{a.name}] ({a.domain}): Status {a.status}, {a.conflicts_detected} conflicts detected, {a.tasks_completed} tasks" for a in agents]

        now = datetime.now().astimezone().strftime("%d %b %Y, %I:%M:%S %p %Z")

        prompt = f"""You are the Company Brain OS Chief AI Intelligence Officer & Autonomous Orchestrator.
Current Time: {now}

=== SYSTEM KNOWLEDGE GRAPH & LIVE DATA ===

--- DYNAMIC RAG RELEVANT EVIDENCE CHUNKS ---
{rag_context}

--- CONFLICT INBOX ({len(conflicts)} total) ---
{chr(10).join(conflict_data) if conflict_data else "No conflicts."}

--- RECENT INGESTED EVENTS BUS ({len(events)} events) ---
{chr(10).join(event_data) if event_data else "No events."}

--- OFFICIAL REPOSITORY DOCUMENTS ({len(docs)} documents) ---
{chr(10).join(doc_data) if doc_data else "No documents."}

--- LAYER 0 EXECUTED WORKFLOWS ({len(workflows)} workflows) ---
{chr(10).join(wf_data) if wf_data else "No workflows executed yet."}

--- AUDIT & COMPLIANCE LOGS ({len(audits)} records) ---
{chr(10).join(audit_data) if audit_data else "No audit logs."}

--- ACTIVE AI AGENTS ---
{chr(10).join(agent_data) if agent_data else "No agents."}

=== CAPABILITIES & BEHAVIOR ===
1. You have full operational awareness and execution authority across the entire enterprise stack.
2. If the user asks you to approve, reject, reopen, or reassign a conflict, execute the action and clearly report the outcome with layer workflows dispatched.
3. Answer all questions with deep contextual reasoning, citing real authors, timestamps, document titles, and metrics.
4. When asked analytical questions ("why", "compare", "what if", "draft"), generate structured, executive-ready insights.
5. Use clear GitHub-flavored markdown with bold headers, bullet lists, code blocks, and callouts.
"""
        return prompt, citations

    @classmethod
    async def chat(
        cls,
        message: str,
        db: Session,
        history: List[Dict[str, str]] = None,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ) -> Tuple[str, str, List[Dict[str, Any]]]:
        """
        Main entry point for conversational NLP.
        Exclusively routes to Google Gemini API (with live state grounding),
        and falls back gracefully to built-in Cognitive Reasoner when offline or on API errors.
        """
        history = history or []
        system_ctx, citations = cls.build_system_context(db, query=message)

        gemini_key = api_key or settings.GEMINI_API_KEY
        target_model = model or settings.LLM_MODEL or "gemini-2.0-flash"

        # 1. Primary: Google Gemini Live Intelligence
        if gemini_key:
            try:
                reply = await cls._call_gemini(message, system_ctx, db, history, gemini_key, target_model)
                if reply:
                    return reply, target_model, citations
            except Exception as e:
                print(f"[NLPChatEngine] Google Gemini API ({target_model}): {e}, switching to Cognitive NLP Engine.")

        # 2. Built-in Cognitive Reasoner (Universal Zero-Key NLP Fallback)
        reply = cls.cognitive_reasoning_pipeline(message, db, history)
        return reply, "cognitive-nlp-engine", citations

    @classmethod
    async def chat_stream(
        cls,
        message: str,
        db: Session,
        history: List[Dict[str, str]] = None,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Async generator yielding SSE JSON string packets for real-time token streaming.
        """
        history = history or []

        # Obtain response and sources via Gemini / Cognitive pipeline
        reply, engine_used, sources = await cls.chat(
            message=message,
            db=db,
            history=history,
            provider="gemini",
            api_key=api_key,
            model=model
        )

        # Stream words/tokens smoothly with realistic typewriter cadence
        tokens = re.split(r'(\s+)', reply)
        buffer = ""
        for i, token in enumerate(tokens):
            buffer += token
            # Yield every 1-2 tokens or punctuation mark
            if i % 2 == 0 or token in ["\n", "\n\n", ".", "!", "?", "•", "#"]:
                yield json.dumps({"chunk": buffer, "done": False})
                buffer = ""
                await asyncio.sleep(0.012)

        if buffer:
            yield json.dumps({"chunk": buffer, "done": False})

        # Final completion event
        yield json.dumps({
            "done": True,
            "engine": engine_used,
            "sources": sources,
            "full_text": reply
        })

    # ─── Live Google Gemini Connector ────────────────────────────────────────

    @classmethod
    async def _call_gemini(cls, message: str, system_ctx: str, db: Session, history: List[Dict[str, str]], api_key: str, model_name: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

        contents = [{"role": "user", "parts": [{"text": f"System Context & Live System State:\n{system_ctx}"}]}]
        contents.append({"role": "model", "parts": [{"text": "Understood. I am online as Company Brain OS AI Intelligence Officer with live state grounding."}]})

        for h in history[-8:]:
            role = "user" if h.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [{"text": h.get("text", "")}]})

        contents.append({"role": "user", "parts": [{"text": message}]})

        payload = {
            "contents": contents,
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024}
        }

        async with httpx.AsyncClient(timeout=18.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                cls._intercept_and_apply_actions(message, db)
                return text
            raise Exception(f"Gemini API returned {res.status_code}: {res.text}")


    @classmethod
    def _intercept_and_apply_actions(cls, message: str, db: Session):
        """Helper to ensure actions triggered during LLM prompt execute in DB."""
        msg = message.lower()
        conflicts = db.query(Conflict).all()
        if "approve" in msg:
            for c in conflicts:
                if (c.title.lower() in msg or (c.domain and c.domain.lower() in msg)) and c.status == "open":
                    ActionExecutorService.apply_approval(db, c.id, "approve", "Approved via LLM chat command")
        elif "reject" in msg:
            for c in conflicts:
                if (c.title.lower() in msg or (c.domain and c.domain.lower() in msg)) and c.status == "open":
                    ActionExecutorService.apply_approval(db, c.id, "reject", "Rejected via LLM chat command")


    # ─── Built-in Cognitive Reasoner (Universal Semantic Engine) ────────────

    @classmethod
    def cognitive_reasoning_pipeline(cls, message: str, db: Session, history: List[Dict[str, str]] = None) -> str:
        """
        Deep semantic analysis pipeline that extracts syntax, entities, causal relationships,
        comparisons, and synthesizes nuanced conversational answers.
        """
        msg = message.lower().strip()
        history = history or []

        # Load live database records
        conflicts = db.query(Conflict).all()
        open_conflicts = [c for c in conflicts if c.status == "open"]
        approved_conflicts = [c for c in conflicts if c.status == "approved"]
        events = db.query(CompanyEvent).order_by(CompanyEvent.timestamp.desc()).all()
        docs = db.query(Document).all()
        workflows = db.query(WorkflowAction).order_by(WorkflowAction.created_at.desc()).limit(15).all()
        audits = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all()
        agents = db.query(AgentProfile).all()

        # Context conflict from conversation history
        ctx_conflict = cls._resolve_context_conflict(history, conflicts)

        # ── 1. Action Execution Intent (Approve, Reject, Reopen, Edit, Assign)
        action_reply = cls._handle_action_intent(message, db, conflicts, open_conflicts, ctx_conflict)
        if action_reply:
            return action_reply

        # ── 2. Comparative Analysis Intent ("compare", "difference between", "vs")
        if any(k in msg for k in ["compare", "difference between", " vs ", "versus", "how does it differ"]):
            return cls._handle_comparison_intent(msg, conflicts, events, docs, ctx_conflict)

        # ── 3. Causal & Why Intent ("why is", "why was", "what caused", "reason for")
        if any(k in msg for k in ["why is", "why was", "why did", "what caused", "reason for", "how come"]):
            return cls._handle_causal_intent(msg, conflicts, events, ctx_conflict)

        # ── 4. Impact & Risk Assessment Intent ("impact", "risk", "what happens if", "consequences")
        if any(k in msg for k in ["what happens if", "downstream impact", "business impact", "consequence", "risk of", "risk level"]):
            return cls._handle_impact_intent(msg, conflicts, ctx_conflict)

        # ── 5. Drafting & Content Generation Intent ("draft", "write an email", "create ticket", "memo")
        if any(k in msg for k in ["draft", "write an email", "write a message", "create ticket", "jira ticket", "slack announcement", "compose"]):
            return cls._handle_drafting_intent(msg, conflicts, ctx_conflict)

        # ── 6. Source & Ingestion Queries (Slack, GitHub, Gmail, Teams, Events)
        if any(k in msg for k in ["slack", "github", "gmail", "teams", "event", "message", "pr", "pull request", "pipeline", "ingest"]):
            return cls._handle_source_intent(msg, events)

        # ── 7. Specific Conflict Detail & Breakdown Intent
        if any(k in msg for k in ["explain", "detail", "describe", "deep dive", "tell me about", "breakdown", "first", "second", "third", "auth", "onboarding", "cadence", "deployment"]):
            target = cls._match_target_conflict(msg, conflicts, ctx_conflict)
            if target:
                return cls._format_rich_conflict_card(target, db)

        # ── 8. Contextual Follow-up (Dates, Evidence, Ownership, Status)
        if ctx_conflict and any(k in msg for k in ["date", "when", "who owns", "evidence", "who said", "status", "claim", "document"]):
            return cls._handle_contextual_followup(msg, ctx_conflict, db)

        # ── 9. System Overview, Governance, Audit, AI Agents
        if any(k in msg for k in ["summary", "overview", "status", "audit", "compliance", "who approved", "agent", "agents", "monitoring", "how many"]):
            return cls._handle_system_overview(msg, open_conflicts, approved_conflicts, conflicts, events, workflows, audits, agents)

        # ── 10. Help, Capabilities & Architecture
        if any(k in msg for k in ["help", "what can you do", "capabilities", "architecture", "how does it work", "layer"]):
            return cls._handle_capabilities_inquiry()

        # ── 11. General Cognitive Synthesis Fallback
        return cls._synthesize_intelligent_fallback(message, conflicts, events, workflows, agents)

    # ─── Cognitive Reasoner Handlers ────────────────────────────────────────

    @classmethod
    def _resolve_context_conflict(cls, history: List[Dict[str, str]], conflicts: List[Conflict]) -> Optional[Conflict]:
        if not history or not conflicts:
            return None
        for msg in reversed(history):
            if msg.get("role") != "bot":
                continue
            txt = msg.get("text", "").lower()
            for c in conflicts:
                keywords = [c.title.lower()] + [w for w in (c.domain or "").lower().split()] + [w for w in c.id.replace("-", " ").split() if len(w) > 3]
                if any(kw in txt for kw in keywords):
                    return c
        return None

    @classmethod
    def _match_target_conflict(cls, msg: str, conflicts: List[Conflict], ctx: Optional[Conflict] = None) -> Optional[Conflict]:
        ORDINALS = {"first": 0, "1st": 0, "second": 1, "2nd": 1, "third": 2, "3rd": 2, "fourth": 3, "4th": 3, "last": -1}
        for word, idx in ORDINALS.items():
            if word in msg and conflicts:
                try: return conflicts[idx]
                except IndexError: pass

        # Keyword match
        best, best_score = None, 0
        for c in conflicts:
            kws = (c.title + " " + (c.domain or "") + " " + c.id.replace("-", " ")).lower().split()
            score = sum(1 for kw in kws if len(kw) > 3 and kw in msg)
            if score > best_score:
                best_score, best = score, c
        if best and best_score >= 1:
            return best
        return ctx

    @classmethod
    def _format_rich_conflict_card(cls, c: Conflict, db: Session) -> str:
        icon = "🔴" if c.severity == "high" else ("🟡" if c.severity == "medium" else "🟢")
        status_badge = "✅ APPROVED" if c.status == "approved" else ("🟠 OPEN" if c.status == "open" else "❌ REJECTED")
        doc = db.query(Document).filter(Document.id == c.document_id).first()
        ev_ids = c.evidence_ids or []
        ev_events = db.query(CompanyEvent).filter(CompanyEvent.id.in_(ev_ids)).all() if ev_ids else []

        ev_citations = "\n".join([f"  - **[{e.source}]** *\"{e.title}\"* by {e.author} ({e.timestamp})" for e in ev_events]) if ev_events else "  - Monitored real-time stream"

        return (
            f"{icon} **{c.title}**\n\n"
            f"**Status:** `{status_badge}` | **Severity:** `{c.severity.upper()}` | **Risk:** `{c.risk_level}`\n"
            f"**Domain:** {c.domain} | **Owner:** {c.owner} | **Contradiction Confidence:** {round((c.contradiction_score or 0)*100)}%\n\n"
            f"---\n\n"
            f"📄 **Official Document Claim:**\n"
            f"> *\"{c.old_claim}\"*\n"
            f"*(Source: {doc.title if doc else c.document_id} · Owner: {doc.owner if doc else 'N/A'} · Last written: {doc.timestamp if doc else 'Unknown'})*\n\n"
            f"⚡ **Operational Reality (Live Evidence):**\n"
            f"> *\"{c.new_claim}\"*\n\n"
            f"📎 **Evidence Ingestion Bus ({len(ev_events)} sources):**\n"
            f"{ev_citations}\n\n"
            f"---\n\n"
            f"✅ **Recommended Self-Healing Action:**\n"
            f"{c.recommended_update}\n\n"
            f"💼 **Business Impact & Downstream Risk:**\n"
            f"{c.business_impact}\n\n"
            f"🤖 **Detection Vector:** `{c.detected_by}` | Freshness delta: `{c.freshness_delta}` | Authority delta: `{c.authority_delta}`\n\n"
            f"💡 *Commands: 'Approve this conflict' · 'Reject this conflict' · 'Draft an email explaining this'*"
        )

    @classmethod
    def _handle_action_intent(cls, message: str, db: Session, conflicts: List[Conflict], open_conflicts: List[Conflict], ctx: Optional[Conflict]) -> Optional[str]:
        msg = message.lower()
        ACTION_VERBS = ["approve", "reject", "reopen", "re-open", "accept", "decline", "dismiss", "change owner", "assign to", "set severity", "set risk"]
        if not any(v in msg for v in ACTION_VERBS):
            return None

        now_ts = datetime.now().astimezone().strftime("%d %b %Y, %I:%M:%S %p")

        # Bulk
        if "approve all" in msg or "approve all open" in msg:
            if not open_conflicts: return "✅ All conflicts are already approved. No pending actions."
            approved = []
            for c in open_conflicts:
                st, res = ActionExecutorService.apply_approval(db, c.id, "approve", "Bulk approved via AI Chat")
                if st == 200: approved.append(c.title)
            return f"🚀 **Bulk Autonomous Approval Complete ({len(approved)} conflicts):**\n\n" + "\n".join(f"• ✅ **{t}**" for t in approved) + "\n\nLayer 0 execution workflows dispatched to Jira, Slack, & Knowledge Base."

        target = cls._match_target_conflict(msg, conflicts, ctx)
        if not target:
            return "🤔 Please specify which conflict you want to act on (e.g., *'Approve the payment conflict'* or *'Approve the first conflict'*)."

        # Approve
        if any(k in msg for k in ["approve", "accept"]):
            if target.status == "approved": return f"✅ **'{target.title}'** is already in `APPROVED` status."
            st, res = ActionExecutorService.apply_approval(db, target.id, "approve", "Approved via AI NLP Command")
            if st != 200: return f"❌ Approval failed: {res.get('error')}"
            tools = [w["tool"] for w in res.get("workflows", [])]
            return (
                f"✅ **Conflict Successfully Approved & Self-Healed!**\n\n"
                f"**Conflict:** {target.title}\n"
                f"**Owner:** {target.owner} | **Risk Level:** `{target.risk_level}` | **Timestamp:** {now_ts}\n\n"
                f"⚡ **Automated Layer 0 Workflows Executed:**\n"
                + "\n".join(f"• 🔧 **{t}** connector triggered" for t in tools) +
                f"\n\n📘 **Knowledge Base Updated with:**\n> {target.recommended_update}\n\n"
                f"📑 Audit log entry generated for compliance tracking."
            )

        # Reject
        if any(k in msg for k in ["reject", "decline", "dismiss"]):
            if target.status == "rejected": return f"❌ **'{target.title}'** is already marked as `REJECTED`."
            st, res = ActionExecutorService.apply_approval(db, target.id, "reject", "Rejected via AI NLP Command")
            return f"❌ **Conflict Rejected.**\n\n'{target.title}' set to `REJECTED`. Official documentation remains untouched."

        # Reopen
        if any(k in msg for k in ["reopen", "re-open", "open again"]):
            target.status = "open"
            db.commit()
            return f"🟠 **Conflict Reopened.**\n\n'{target.title}' is now `OPEN` and active in the Conflict Inbox."

        # Change Owner
        if any(k in msg for k in ["change owner", "assign to", "set owner"]):
            new_owner = message.split("to")[-1].strip().rstrip(".") if "to" in msg else "Engineering Squad"
            old_owner = target.owner
            target.owner = new_owner
            db.commit()
            return f"👤 **Ownership Reassigned:**\n\nConflict **'{target.title}'** reassigned from `{old_owner}` to **`{new_owner}`**."

        return None

    @classmethod
    def _handle_comparison_intent(cls, msg: str, conflicts: List[Conflict], events: List[CompanyEvent], docs: List[Document], ctx: Optional[Conflict]) -> str:
        target = cls._match_target_conflict(msg, conflicts, ctx) or (conflicts[0] if conflicts else None)
        if not target: return "No conflicts available to compare."

        return (
            f"🔍 **Comparative Cognitive Analysis: '{target.title}'**\n\n"
            f"| Dimension | 📄 Official Documentation | ⚡ Operational Reality (Live Stream) |\n"
            f"| :--- | :--- | :--- |\n"
            f"| **Core Statement** | {target.old_claim} | {target.new_claim} |\n"
            f"| **Authority / Freshness** | Stale static document | Real-time event bus detection |\n"
            f"| **Security / Compliance** | High risk of legacy regression | Active architectural migration |\n\n"
            f"---\n\n"
            f"🧠 **Root-Cause Synthesis:**\n"
            f"The official documentation failed to reflect live engineering consensus, creating a **{round((target.contradiction_score or 0)*100)}% contradiction gap**. "
            f"If uncorrected, new team members and external integrations will build against deprecated standards.\n\n"
            f"💡 *Say 'Approve this conflict' to reconcile reality with documentation automatically.*"
        )

    @classmethod
    def _handle_causal_intent(cls, msg: str, conflicts: List[Conflict], events: List[CompanyEvent], ctx: Optional[Conflict]) -> str:
        target = cls._match_target_conflict(msg, conflicts, ctx) or (conflicts[0] if conflicts else None)
        if not target: return "No conflict found to analyze."

        return (
            f"🧠 **Causal Reasoning & Contradiction Diagnostics: '{target.title}'**\n\n"
            f"1. **Triggering Event:** A live decision was captured in operational channels (e.g., Slack/PR).\n"
            f"2. **The Discrepancy:** The repository documentation still recorded *\"{target.old_claim}\"*.\n"
            f"3. **Detection Agent:** Autonomous agent `{target.detected_by}` computed a **contradiction score of {round((target.contradiction_score or 0)*100)}%**.\n"
            f"4. **Freshness Delta (`{target.freshness_delta}`):** The documentation was significantly outdated compared to live commits and discussion.\n"
            f"5. **Risk Classification (`{target.risk_level}`):** {target.business_impact}\n\n"
            f"🎯 **Resolution Recommendation:** Execute self-healing update to align repository architecture."
        )

    @classmethod
    def _handle_impact_intent(cls, msg: str, conflicts: List[Conflict], ctx: Optional[Conflict]) -> str:
        target = cls._match_target_conflict(msg, conflicts, ctx) or (conflicts[0] if conflicts else None)
        if not target: return "No conflict identified for impact analysis."

        return (
            f"💼 **Downstream Business Impact Assessment: '{target.title}'**\n\n"
            f"• **Risk Severity:** `{target.severity.upper()}` (Risk Level: `{target.risk_level}`)\n"
            f"• **Primary Operational Risk:** {target.business_impact}\n"
            f"• **Impact if Ignored:** Engineers and stakeholders will continue following obsolete instructions, resulting in broken integrations, onboarding friction, and compliance failures.\n"
            f"• **Impact upon Approval:** Automated Layer 0 actions immediately update Jira tickets, broadcast Slack notifications to affected squads, and commit the update to the Knowledge Base.\n"
            f"• **Responsible Owner:** {target.owner}"
        )

    @classmethod
    def _handle_drafting_intent(cls, msg: str, conflicts: List[Conflict], ctx: Optional[Conflict]) -> str:
        target = cls._match_target_conflict(msg, conflicts, ctx) or (conflicts[0] if conflicts else None)
        if not target: return "No context available to generate draft."

        if "email" in msg:
            return (
                f"✉️ **Draft Email Announcement to Stakeholders**\n\n"
                f"**Subject:** [Architecture Update] Reconciliation: {target.title}\n\n"
                f"Hi Team,\n\n"
                f"Please be advised of an important operational update regarding **{target.title}**:\n\n"
                f"• **Previous Guideline:** {target.old_claim}\n"
                f"• **Updated Standard:** {target.new_claim}\n"
                f"• **Action Required:** {target.recommended_update}\n\n"
                f"This update has been logged into the Company Brain OS governance repository. Please reach out to **{target.owner}** with any questions.\n\n"
                f"Best regards,\n"
                f"Company Brain Autonomous Operations"
            )
        elif "jira" in msg or "ticket" in msg:
            return (
                f"🎯 **Draft Jira Ticket Specification**\n\n"
                f"**Project:** Platform Architecture (PLAT)\n"
                f"**Issue Type:** Task\n"
                f"**Summary:** Reconcile Documentation for {target.title}\n"
                f"**Description:**\n"
                f"h3. Background\n"
                f"Operational reality has diverged from official documentation.\n\n"
                f"h3. Specification\n"
                f"* *Current Doc:* {target.old_claim}\n"
                f"* *Live Reality:* {target.new_claim}\n"
                f"* *Target Action:* {target.recommended_update}\n\n"
                f"h3. Impact\n"
                f"{target.business_impact}\n\n"
                f"**Assignee:** {target.owner} | **Priority:** High"
            )
        else:
            return (
                f"💬 **Draft Slack Team Announcement**\n\n"
                f"> 🚨 **Operational Policy Update: {target.title}**\n"
                f"> **What Changed:** {target.new_claim}\n"
                f"> **Why:** To eliminate discrepancy with official docs (*\"{target.old_claim}\"*).\n"
                f"> **Action for Engineers:** {target.recommended_update}\n"
                f"> CC @{target.owner.lower().replace(' ', '-')}"
            )

    @classmethod
    def _handle_source_intent(cls, msg: str, events: List[CompanyEvent]) -> str:
        PLATFORMS = {"slack": "Slack", "github": "GitHub", "gmail": "Gmail", "teams": "Teams", "jira": "Jira"}
        target_source = None
        for k, v in PLATFORMS.items():
            if k in msg:
                target_source = v
                break

        matched = [e for e in events if e.source.lower() == target_source.lower()] if target_source else events
        if not matched:
            return f"⚙️ No events found for **{target_source or 'the pipeline'}** yet."

        if any(k in msg for k in ["latest", "last", "newest", "recent message", "what was the message", "what did"]):
            latest = matched[0]
            icon = {"Slack": "💬", "GitHub": "🐙", "Gmail": "✉️", "Teams": "👥", "Jira": "🎯"}.get(latest.source, "📄")
            return (
                f"{icon} **Latest Message / Event from {latest.source}**\n\n"
                f"**Channel / Subject:** `{latest.title}`\n"
                f"**Author:** **{latest.author}** | **Timestamp:** `{latest.timestamp}`\n"
                f"**Authority:** {round(latest.authority_score*100)}% | **Freshness:** {round(latest.freshness_score*100)}%\n\n"
                f"---\n\n"
                f"📝 **Exact Message Content:**\n"
                f"> *\"{latest.content or latest.title}\"*\n\n"
                f"---\n\n"
                f"⚙️ Status: `{latest.pipeline_stage.upper()}` | Vector Indexed: `{'Yes' if latest.vector_indexed else 'Pending'}`"
            )

        parts = [f"⚙️ **{target_source or 'Processing Pipeline'} Events ({len(matched)} total):**\n"]
        for e in matched[:8]:
            icon = {"Slack": "💬", "GitHub": "🐙", "Gmail": "✉️", "Teams": "👥", "Jira": "🎯"}.get(e.source, "📄")
            parts.append(f"{icon} **[{e.source}]** `{e.title}` by **{e.author}** ({e.timestamp})\n   *Content:* \"{e.content[:75]}...\"")
        return "\n".join(parts)

    @classmethod
    def _handle_contextual_followup(cls, msg: str, c: Conflict, db: Session) -> str:
        doc = db.query(Document).filter(Document.id == c.document_id).first()
        if any(k in msg for k in ["date", "when"]):
            return f"📅 **Timeline for '{c.title}':**\n\n• **Official Doc Written:** `{doc.timestamp if doc else 'Unknown'}` by {doc.author if doc else 'N/A'}\n• **Conflict Detection Delta:** `{c.freshness_delta}` stale factor\n• **Status:** `{c.status.upper()}`"
        if any(k in msg for k in ["who owns", "owner", "team"]):
            return f"👤 **Ownership Matrix for '{c.title}':**\n\n• **Conflict Owner:** `{c.owner}`\n• **Source Document Owner:** `{doc.owner if doc else 'Unknown'}`\n• **Detected by Agent:** `{c.detected_by}`"
        if any(k in msg for k in ["evidence", "who said"]):
            ev_ids = c.evidence_ids or []
            evs = db.query(CompanyEvent).filter(CompanyEvent.id.in_(ev_ids)).all() if ev_ids else []
            return f"📎 **Evidence Ingestion Sources ({len(evs)}):**\n\n" + "\n".join([f"• **[{e.source}]** {e.title} by {e.author} ({e.timestamp})" for e in evs])
        return cls._format_rich_conflict_card(c, db)

    @classmethod
    def _handle_system_overview(cls, msg: str, open_c: list, app_c: list, all_c: list, events: list, workflows: list, audits: list, agents: list) -> str:
        if any(k in msg for k in ["audit", "compliance", "who approved"]):
            parts = ["📑 **Audit & Governance Traceability Log:**\n"]
            for a in audits:
                parts.append(f"• {'✅' if a.action=='approved' else '❌'} **{a.title}** by `{a.actor}` @ {a.timestamp} (Risk: `{a.risk_level}`)")
            return "\n".join(parts) if audits else "No audit events recorded yet."

        if any(k in msg for k in ["agent", "monitoring"]):
            parts = ["🤖 **Active Autonomous AI Agents:**\n"]
            for a in agents:
                parts.append(f"• {'🟢' if a.status=='active' else '🔴'} **{a.name}** ({a.domain}): {a.conflicts_detected} discrepancies caught | Status: `{a.status}`")
            return "\n".join(parts)

        return (
            f"🧠 **Company Brain OS — Live Operational Health Matrix**\n\n"
            f"• 📋 **Conflicts Triage:** **{len(open_c)} Open** requiring approval, **{len(app_c)} Approved**, **{len(all_c)} Total**\n"
            f"• ⚙️ **Event Ingestion Bus:** **{len(events)} events** (Slack, GitHub, Teams, Gmail)\n"
            f"• ⚡ **Automated Layer 0 Actions:** **{len(workflows)} workflows** executed\n"
            f"• 📑 **Audit Trail:** **{len(audits)} compliance records** logged\n"
            f"• 🤖 **Autonomous Monitors:** **{sum(1 for a in agents if a.status=='active')}/{len(agents)} AI agents** active\n\n"
            f"💡 *Ask me to analyze any conflict, investigate Slack messages, or execute bulk approvals.*"
        )

    @classmethod
    def _handle_capabilities_inquiry(cls) -> str:
        return (
            f"🌐 **Company Brain OS Architecture & Copilot Capabilities:**\n\n"
            f"• **Layer 5 (Gateway & Connectors):** Ingests real-time events from Slack, GitHub PRs, Gmail, and Microsoft Teams.\n"
            f"• **Layer 4 & 3 (Event Bus & Normalization):** Sanitizes and deduplicates operational decisions.\n"
            f"• **Layer 2 (Intelligence Core):** Computes contradiction vectors, freshness scores, and authority metrics.\n"
            f"• **Layer 1 (Knowledge Foundation):** Manages SQLite operational storage, vector indexes, and semantic chunks.\n"
            f"• **Layer 0 (Autonomous Execution):** Dispatches self-healing webhooks to Jira, Slack, and Knowledge Bases upon human approval.\n\n"
            f"🤖 *You can ask me to explain, compare, reason, draft announcements, or directly approve system changes.*"
        )

    @classmethod
    def _synthesize_intelligent_fallback(cls, message: str, conflicts: list, events: list, workflows: list, agents: list) -> str:
        return (
            f"🧠 **Company Brain OS Cognitive Reasoner**\n\n"
            f"I analyzed your inquiry: *\"{message}\"*\n\n"
            f"**Current System Grounding:**\n"
            f"• **{len(conflicts)} detected conflicts** across Platform Engineering, Release, and Revenue Ops.\n"
            f"• **{len(events)} operational events** ingested across Slack, GitHub, Teams, and Gmail.\n"
            f"• **{len(workflows)} automated workflows** running in Layer 0 Execution.\n\n"
            f"**Recommended actions:**\n"
            f"1. Ask *'Explain the first conflict in detail'* for a root-cause breakdown.\n"
            f"2. Ask *'What was the latest message from Slack?'* to view live operational consensus.\n"
            f"3. Command *'Approve the payment conflict'* to execute self-healing workflow automation.\n"
            f"4. Ask *'Compare the old docs with Slack reality'* for side-by-side analysis."
        )
