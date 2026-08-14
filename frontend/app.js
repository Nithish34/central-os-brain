/* ─── API Routes ───────────────────────────────────────────────────────── */
const api = {
  health:       "/api/health",
  knowledge:    "/api/knowledge/health",
  conflicts:    "/api/conflicts",
  agents:       "/api/agents",
  intelligence: "/api/intelligence/health",
  pipeline:     "/api/pipeline/status",
  memory:       "/api/memory",
  dataFdn:      "/api/data-foundation",
  workflows:    "/api/workflows",
  audit:        "/api/audit-logs",
  reset:        "/api/demo/reset",
  riskCheck:    (id) => `/api/risk-check/${id}`,
};

/* ─── State ────────────────────────────────────────────────────────────── */
let selectedConflictId = "conflict-auth-method";
let conflicts = [];

/* ─── Helpers ──────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

async function request(path, options = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function badge(value) {
  const cls = String(value).toLowerCase().replace(/\s+/g, "-");
  return `<span class="badge ${cls}">${value}</span>`;
}

function layerChip(label, cls) {
  return `<span class="layer-chip ${cls}">${label}</span>`;
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelative(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 1)  return "just now";
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SOURCE_ICONS = { Slack:"💬", GitHub:"🐙", Notion:"📖", Jira:"🎯", Confluence:"📚", "Meeting Notes":"📝", default:"📄" };
function sourceIcon(src) { return SOURCE_ICONS[src] || SOURCE_ICONS.default; }

const TOOL_ICONS = { "Risk & Policy Engine":"🛡️", "Knowledge Base":"📘", "Jira":"🎯", "Slack":"💬", "GitHub":"🐙" };
const TOOL_CLS   = { "Risk & Policy Engine":"risk", "Knowledge Base":"kb", "Jira":"jira", "Slack":"slack", "GitHub":"github" };

/* ─── Nav Active ───────────────────────────────────────────────────────── */
function updateNav() {
  const hash = location.hash || "#command";
  document.querySelectorAll(".nav a").forEach((a) => {
    const active = a.getAttribute("href") === hash;
    a.classList.toggle("active", active);
    a.setAttribute("aria-current", active ? "page" : "false");
  });
}
window.addEventListener("hashchange", updateNav);

/* ─── Command Center ───────────────────────────────────────────────────── */
async function loadHealth(agents) {
  const h = await request(api.knowledge);
  $("knowledgeHealth").textContent = `${h.knowledge_health}%`;
  $("openConflicts").textContent   = h.open_conflicts;
  $("workflowCount").textContent   = h.automated_workflows;
  $("lastScan").textContent        = `Last scan ${formatTime(h.last_scan)}`;

  const active = (agents || []).filter((a) => a.status === "active").length;
  $("activeAgents").textContent = active;

  const cb = $("conflictBadge");
  if (cb) cb.textContent = h.open_conflicts || "";
}

/* ─── Layer 2: Intelligence Core ──────────────────────────────────────── */
async function loadIntelligenceCore() {
  const [intelData, agentData] = await Promise.all([
    request(api.intelligence),
    request(api.agents),
  ]);

  const agents = agentData.agents;
  const rag    = intelData.rag_engine;
  const kg     = intelData.knowledge_graph;
  const cd     = intelData.conflict_detection;
  const mem    = intelData.memory_store;

  /* Sub-system stat cards */
  $("intelStats").innerHTML = `
    <div class="intel-stat">
      <div class="ist-head"><span class="ist-icon">🔎</span><span class="ist-name">RAG Engine</span></div>
      <div class="ist-value">${rag.total_chunks}</div>
      <div class="ist-sub">${rag.documents_indexed} docs · ${rag.events_indexed} events indexed</div>
      <div style="margin-top:8px;">${badge(rag.status)}</div>
    </div>
    <div class="intel-stat">
      <div class="ist-head"><span class="ist-icon">🕸️</span><span class="ist-name">Knowledge Graph</span></div>
      <div class="ist-value">${kg.nodes}</div>
      <div class="ist-sub">${kg.edges} edges · ${kg.backend}</div>
      <div style="margin-top:8px;">${badge(kg.status)}</div>
    </div>
    <div class="intel-stat">
      <div class="ist-head"><span class="ist-icon">🎯</span><span class="ist-name">Conflict Detection</span></div>
      <div class="ist-value">${cd.conflicts_found}</div>
      <div class="ist-sub">open · avg contradiction ${Math.round(cd.avg_contradiction * 100)}%</div>
      <div style="margin-top:8px;">${badge(cd.status)}</div>
    </div>
    <div class="intel-stat">
      <div class="ist-head"><span class="ist-icon">🧠</span><span class="ist-name">Memory Store</span></div>
      <div class="ist-value">${mem.short_term_count + mem.long_term_count}</div>
      <div class="ist-sub">${mem.short_term_count} short-term · ${mem.long_term_count} long-term</div>
      <div style="margin-top:8px;">${badge(mem.status)}</div>
    </div>
  `;

  /* Agent cards */
  $("agentGrid").innerHTML = agents.map((agent) => `
    <div class="agent-card ${agent.status}">
      <div class="agent-icon">${agent.icon}</div>
      <div class="agent-name">${agent.name}</div>
      <div class="agent-domain">${agent.domain}</div>
      <div class="agent-stats">
        ${badge(agent.status)}
        <span class="badge">${agent.memory_entries} memories</span>
        <span class="badge">${agent.tasks_completed} tasks</span>
      </div>
      <div style="font-size:12px;color:var(--muted);">
        <strong style="color:${agent.conflicts_detected > 0 ? "var(--red)" : "var(--muted)"};">
          ${agent.conflicts_detected} conflict${agent.conflicts_detected !== 1 ? "s" : ""}
        </strong> detected
        ${agent.last_detection ? `· ${formatRelative(agent.last_detection)}` : "· none yet"}
      </div>
    </div>
  `).join("");

  return agents;
}

/* ─── Layer 3: Processing Pipeline ────────────────────────────────────── */
async function loadPipeline() {
  const data = await request(api.pipeline);
  const { event_bus: eb, background_workers: bw, event_router: er, pipeline_orchestrator: po, event_stages } = data;

  $("pipelineComponents").innerHTML = `
    <div class="pipeline-component">
      <div class="pc-head"><span class="pc-icon">🚌</span><span class="pc-name">Event Bus</span></div>
      <div class="pc-backend">${eb.backend}</div>
      <div class="pc-value">${eb.messages_processed.toLocaleString()}</div>
      <div class="pc-sub">msgs processed · ${eb.throughput_per_min}/min · ${badge(eb.status)}</div>
    </div>
    <div class="pipeline-component">
      <div class="pc-head"><span class="pc-icon">⚙️</span><span class="pc-name">Workers</span></div>
      <div class="pc-backend">${bw.backend}</div>
      <div class="pc-value">${bw.tasks_completed}</div>
      <div class="pc-sub">${bw.workers_online} workers online · ${bw.tasks_pending} pending · ${badge(bw.status)}</div>
    </div>
    <div class="pipeline-component">
      <div class="pc-head"><span class="pc-icon">🔀</span><span class="pc-name">Event Router</span></div>
      <div class="pc-backend">Custom Rules Engine</div>
      <div class="pc-value">${er.events_routed}</div>
      <div class="pc-sub">${er.pipelines_active} pipelines · ${er.routing_rules} rules · ${badge(er.status)}</div>
    </div>
    <div class="pipeline-component">
      <div class="pc-head"><span class="pc-icon">🤖</span><span class="pc-name">Orchestrator</span></div>
      <div class="pc-backend">${po.backend}</div>
      <div class="pc-value">${po.runs_total}</div>
      <div class="pc-sub">${po.steps_per_run} steps/run · ${badge(po.status)}</div>
    </div>
  `;

  $("eventStages").innerHTML = (event_stages || []).map((evt) => `
    <div class="event-stage-item">
      <span class="esi-icon">${sourceIcon(evt.source)}</span>
      <div>
        <div class="esi-title">${evt.title}</div>
        <div class="esi-source">${evt.source} · ${formatTime(evt.ts)}</div>
      </div>
      <span class="esi-type">${evt.type}</span>
      ${badge(evt.stage)}
    </div>
  `).join("") || `<div class="empty-state">No events in pipeline.</div>`;
}

/* ─── Conflicts ────────────────────────────────────────────────────────── */
async function loadConflicts() {
  const result = await request(api.conflicts);
  conflicts = result.conflicts;
  renderConflictList();
  renderConflictDetail();
}

function agentTag(agentObj) {
  if (!agentObj) return "";
  return `<span class="agent-tag">${agentObj.icon || "🤖"} ${agentObj.name}</span>`;
}

function renderConflictList() {
  $("conflictList").innerHTML = conflicts.map((c) => `
    <button
      class="conflict-card severity-${c.severity} ${c.id === selectedConflictId ? "selected" : ""}"
      data-conflict-id="${c.id}"
      role="listitem"
      aria-pressed="${c.id === selectedConflictId}"
    >
      <div class="conflict-card-head">
        <h3>${c.title}</h3>
        ${badge(c.severity)}
      </div>
      <p class="impact-text">${c.business_impact}</p>
      <div class="conflict-meta">
        ${badge(c.status)}
        <span class="badge">${c.confidence}% conf.</span>
        ${agentTag(c.detected_by_agent)}
      </div>
    </button>
  `).join("");

  document.querySelectorAll(".conflict-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedConflictId = card.dataset.conflictId;
      renderConflictList();
      renderConflictDetail();
    });
  });
}

function scoreFill(id, pct, cls) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.style.width = `${pct}%`;
    });
  });
}

function renderSourceCard(title, item, claim, type) {
  if (!item) return "";
  return `
    <div class="source-card ${type}">
      <div class="source-card-head">
        <h3>${title}</h3>
        <span class="badge">${item.source}</span>
      </div>
      <p class="claim-text">"${claim}"</p>
      <p style="color:var(--text-sec);font-size:13px;line-height:1.5;">${item.content}</p>
      <div class="source-meta">
        <span class="badge">${item.owner}</span>
        <span class="badge">${formatTime(item.timestamp)}</span>
        <span class="badge">${Math.round(item.authority_score * 100)}% authority</span>
        <span class="badge">${Math.round(item.freshness_score * 100)}% fresh</span>
      </div>
    </div>
  `;
}

async function renderConflictDetail() {
  const conflict = conflicts.find((c) => c.id === selectedConflictId) || conflicts[0];
  if (!conflict) { $("conflictDetail").innerHTML = `<div class="empty-state">No conflicts found.</div>`; return; }

  selectedConflictId = conflict.id;
  const primary   = conflict.evidence[0];
  const secondary = conflict.evidence.slice(1);
  const isResolved = ["approved", "resolved"].includes(conflict.status);
  const isRejected = conflict.status === "rejected";

  // Fetch risk check
  let riskHtml = "";
  try {
    const riskData = await request(api.riskCheck(conflict.id));
    const allPass  = riskData.approved_to_proceed;
    riskHtml = `
      <div class="risk-panel ${allPass ? "passed" : ""}">
        <h4>
          🛡️ Layer 0 — Risk &amp; Policy Check
          <span class="layer-chip l0" style="margin-left:auto;">L0</span>
        </h4>
        ${riskData.rules.map((r) => `
          <div class="risk-rule ${r.passed ? "ok" : "fail"}">
            <span class="rule-icon">${r.passed ? "✓" : "✗"}</span>
            <span>${r.rule}</span>
          </div>
        `).join("")}
        <div style="margin-top:10px;font-size:12px;color:var(--text-sec);">
          Required approver: <strong>${riskData.required_approver}</strong>
          · Risk level: <strong>${riskData.risk_level}</strong>
          ${riskData.escalation_path ? `· Escalation: ${riskData.escalation_path}` : ""}
        </div>
      </div>
    `;
  } catch {}

  const contrPct  = Math.round((conflict.contradiction_score || 0) * 100);
  const freshPct  = Math.round((conflict.freshness_delta     || 0) * 100);
  const authPct   = Math.round((conflict.authority_delta     || 0) * 100);

  $("conflictDetail").innerHTML = `
    ${isResolved ? `<div class="approved-banner">✅ Approved — all execution layer workflows triggered.</div>` : ""}
    ${isRejected ? `<div class="approved-banner" style="background:var(--red-light);border-color:#fca5a5;color:var(--red);">❌ Rejected — no changes applied.</div>` : ""}

    <div class="detail-head">
      <div>
        <p class="eyebrow">Layer 2 — Conflict Detection Engine</p>
        <h2>${conflict.title}</h2>
      </div>
      ${badge(conflict.status)}
    </div>

    <!-- L2 Intelligence Scores -->
    <div class="score-section">
      <div class="score-section-head">
        <span class="score-section-label">🧠 Intelligence Core Scores ${layerChip("L2","l2")}</span>
        <span class="score-section-value">${conflict.confidence}% overall</span>
      </div>
      <div style="margin-bottom:8px;">
        <div class="score-row">
          <div class="score-row-head"><span class="score-row-name">Contradiction Score</span><span class="score-row-val">${contrPct}%</span></div>
          <div class="score-track"><div class="score-fill contradiction" id="sf-contr-${conflict.id}"></div></div>
        </div>
        <div class="score-row">
          <div class="score-row-head"><span class="score-row-name">Freshness Delta</span><span class="score-row-val">${freshPct}%</span></div>
          <div class="score-track"><div class="score-fill freshness" id="sf-fresh-${conflict.id}"></div></div>
        </div>
        <div class="score-row">
          <div class="score-row-head"><span class="score-row-name">Authority Delta</span><span class="score-row-val">${authPct}%</span></div>
          <div class="score-track"><div class="score-fill authority" id="sf-auth-${conflict.id}"></div></div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-sec);">
        Detected by ${agentTag(conflict.detected_by_agent)}
        · ${conflict.graph_hops || 1} graph hop${(conflict.graph_hops || 1) > 1 ? "s" : ""} via Neo4j
        · ${(conflict.evidence || []).length} evidence source(s)
      </div>
    </div>

    <!-- Evidence -->
    <div class="detail-grid">
      ${renderSourceCard("📋 Official Document (Outdated)", conflict.document, conflict.old_claim, "official")}
      ${renderSourceCard("🔍 New Evidence", primary, conflict.new_claim, "evidence")}
    </div>

    ${secondary.length ? `
      <div class="reasoning-card">
        <h3>Supporting Evidence (${secondary.length} more)</h3>
        ${secondary.map((e) => `<p><strong>${e.source}:</strong> ${e.title} — ${e.content}</p>`).join("")}
      </div>` : ""}

    <div class="reasoning-card recommended">
      <h3>✏️ AI-Recommended Update</h3>
      <p>${conflict.recommended_update}</p>
    </div>

    <div class="reasoning-card">
      <h3>Business Impact &amp; Reasoning</h3>
      <p><strong>Impact:</strong> ${conflict.business_impact}</p>
      <p><strong>Why Company Brain flagged this:</strong> ${conflict.reasoning}</p>
    </div>

    <!-- L0 Risk Check -->
    ${riskHtml}

    <!-- Approval action bar -->
    <div class="action-bar">
      <div class="action-bar-info">
        <strong>Owner: ${conflict.owner}</strong>
        <p>Human approval required before Layer 0 Execution writes to official knowledge.</p>
      </div>
      <div class="action-buttons">
        <button class="danger-button"  id="rejectBtn"  type="button" ${isResolved||isRejected?"disabled":""}>✕ Reject</button>
        <button class="primary-button" id="approveBtn" type="button" ${isResolved||isRejected?"disabled":""}>✓ Approve &amp; Execute</button>
      </div>
    </div>
  `;

  /* Animate score bars */
  scoreFill(`sf-contr-${conflict.id}`, contrPct, "contradiction");
  scoreFill(`sf-fresh-${conflict.id}`, freshPct, "freshness");
  scoreFill(`sf-auth-${conflict.id}`,  authPct,  "authority");

  $("approveBtn")?.addEventListener("click", approveConflict);
  $("rejectBtn")?.addEventListener("click",  rejectConflict);
}

/* ─── Approve / Reject ─────────────────────────────────────────────────── */
async function approveConflict() {
  const btn = $("approveBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Running execution…"; }
  try {
    await request(`/api/conflicts/${selectedConflictId}/approve`, {
      method: "POST",
      body:   JSON.stringify({ reason: "Approved during hackathon demo review." }),
    });
    await refreshAll();
    location.hash = "#execution";
  } catch { if (btn) { btn.disabled = false; btn.textContent = "✓ Approve & Execute"; } }
}

async function rejectConflict() {
  const btn = $("rejectBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Rejecting…"; }
  try {
    await request(`/api/conflicts/${selectedConflictId}/reject`, {
      method: "POST",
      body:   JSON.stringify({ reason: "Rejected during hackathon demo review." }),
    });
    await refreshAll();
  } catch { if (btn) { btn.disabled = false; btn.textContent = "✕ Reject"; } }
}

/* ─── Layer 0: Execution ────────────────────────────────────────────────── */
async function loadExecution() {
  const result = await request(api.workflows);
  const wf = result.workflows;
  $("workflowTimeline").innerHTML = wf.length
    ? wf.map((item, i) => `
        <div class="timeline-item" role="listitem" style="animation-delay:${i * 60}ms">
          <div class="tool-icon-wrap" title="${item.tool}">${TOOL_ICONS[item.tool] || "🔧"}</div>
          <div>
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <div style="margin-top:6px;display:flex;gap:5px;flex-wrap:wrap;">
              ${layerChip(item.layer || "Layer 0 — Execution", "l0")}
            </div>
          </div>
          <div class="tl-meta">
            ${badge(item.status)}
            <span class="muted" style="font-size:11px;">${formatRelative(item.created_at)}</span>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state">Approve a conflict above to trigger the Layer 0 Execution Engine (Risk Check → KB Update → Jira → Slack → GitHub).</div>`;
}

/* ─── Audit Logs ────────────────────────────────────────────────────────── */
async function loadAuditLogs() {
  const result = await request(api.audit);
  $("auditLogs").innerHTML = result.audit_logs.length
    ? result.audit_logs.map((item) => `
        <div class="audit-item" role="listitem">
          <div>
            <div class="audit-time">${formatTime(item.timestamp)}</div>
            <div class="muted" style="font-size:11px;margin-top:2px;">${formatRelative(item.timestamp)}</div>
          </div>
          <div>
            <h3>${item.title}</h3>
            <p>${item.actor} <strong>${item.action}</strong> using ${item.evidence_count} evidence source(s)${item.risk_level ? ` · Risk: ${item.risk_level}` : ""}.</p>
          </div>
          ${badge(item.action)}
        </div>
      `).join("")
    : `<div class="empty-state">No audit events yet. Approve or reject a conflict to create a log entry.</div>`;
}

/* ─── Refresh All ───────────────────────────────────────────────────────── */
async function refreshAll() {
  const [agents] = await Promise.all([
    loadIntelligenceCore(),
    loadPipeline(),
    loadConflicts(),
    loadExecution(),
    loadAuditLogs(),
  ]);
  await loadHealth(agents);
}

/* ─── Boot ──────────────────────────────────────────────────────────────── */
async function boot() {
  updateNav();
  try {
    await request(api.health);
    $("apiStatus").textContent = "Live";
    $("apiStatus").className   = "status-pill ok";
    await refreshAll();
  } catch {
    $("apiStatus").textContent = "API Offline";
    $("apiStatus").className   = "status-pill warn";
    $("conflictDetail").innerHTML = `
      <div class="empty-state">
        ⚠️ Backend not running.<br>
        <code style="font-size:12px;font-family:monospace;">python backend/app.py</code>
      </div>`;
  }
}

/* ─── Reset ─────────────────────────────────────────────────────────────── */
$("resetButton").addEventListener("click", async () => {
  $("resetButton").disabled    = true;
  $("resetButton").textContent = "Resetting…";
  try {
    await request(api.reset, { method: "POST", body: "{}" });
    selectedConflictId = "conflict-auth-method";
    await refreshAll();
  } finally {
    $("resetButton").innerHTML = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5A4.5 4.5 0 1 1 6.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2 3.5V6.5H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Reset Demo`;
    $("resetButton").disabled = false;
  }
});

boot();
