/* ─── API Routes ───────────────────────────────────────────────────────── */
const api = {
  health:       "/api/v1/health",
  knowledge:    "/api/v1/knowledge/health",
  conflicts:    "/api/v1/conflicts",
  agents:       "/api/v1/agents",
  intelligence: "/api/v1/intelligence/health",
  memory:       "/api/v1/intelligence/memory",
  pipeline:     "/api/v1/pipeline/status",
  dataFdn:      "/api/v1/data-foundation",
  workflows:    "/api/v1/workflows",
  audit:        "/api/v1/audit-logs",
  integrations: "/api/v1/integrations",
  authLogin:    "/api/v1/auth/login",
  authMe:       "/api/v1/auth/me",
  reset:        "/api/v1/demo/reset",
  riskCheck:    (id) => `/api/v1/conflicts/${id}/risk-check`,
};

/* ─── State ────────────────────────────────────────────────────────────── */
let selectedConflictId = "conflict-auth-method";
let conflicts = [];
let auditLogsCache = [];
let authToken = "";

/* ─── Helpers ──────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(path, { ...options, headers });
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
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatRelative(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const secs = Math.max(0, Math.floor(diff / 1000));
  if (secs < 60) return `just now (${secs}s ago)`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SOURCE_ICONS = { Slack:"💬", GitHub:"🐙", Notion:"📖", Jira:"🎯", Teams:"👥", Gmail:"✉️", Confluence:"📚", default:"📄" };
function sourceIcon(src) { return SOURCE_ICONS[src] || SOURCE_ICONS.default; }

const TOOL_ICONS = { "Risk & Policy Engine":"🛡️", "Knowledge Base":"📘", "Jira":"🎯", "Slack":"💬", "GitHub":"🐙" };

/* ─── Toast Notifications ──────────────────────────────────────────────── */
window.showToast = function (message) {
  const container = $("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 200ms ease-out";
    setTimeout(() => toast.remove(), 200);
  }, 3200);
};

/* ─── View Routing (Tab Switcher) ──────────────────────────────────────── */
const VIEW_TITLES = {
  "#chat":         { eyebrow: "Core Intelligence & Autonomous Action", title: "AI Command Center & Copilot" },
  "#inbox":        { eyebrow: "Self-Healing Knowledge Triage", title: "Conflict Inbox" },
  "#intelligence": { eyebrow: "Layer 2 — Autonomous AI Reasoning", title: "Intelligence Core & Multi-Agent System" },
  "#pipeline":     { eyebrow: "Layer 3 — Asynchronous Ingestion", title: "Processing Pipeline & Event Bus" },
  "#execution":    { eyebrow: "Layer 0 — Automated Multi-System Action", title: "Execution Timeline & Connectors" },
  "#audit":        { eyebrow: "Enterprise Governance & Traceability", title: "Decision Audit & Compliance Log" },
  "#integrations": { eyebrow: "Layer 5 — Connected Enterprise Sources", title: "Enterprise Integrations Catalog" },
  "#settings":     { eyebrow: "Platform Governance & Configuration", title: "Settings & Safety Policy Gates" },
  "#profile":      { eyebrow: "Layer 5 — Identity & Access Control", title: "User Profile & RBAC Matrix" },
};

function switchView() {
  const hash = location.hash || "#chat";
  const viewKey = hash.replace("#", "");
  const targetViewId = `view-${viewKey}`;

  // Update Sidebar active state
  document.querySelectorAll(".nav a").forEach((a) => {
    const active = a.getAttribute("href") === hash;
    a.classList.toggle("active", active);
    a.setAttribute("aria-current", active ? "page" : "false");
  });

  // Switch visible view panel
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.remove("active");
  });

  const activePanel = $(targetViewId) || $("view-chat") || $("view-inbox");
  if (activePanel) activePanel.classList.add("active");

  // Update Header title & eyebrow
  const info = VIEW_TITLES[hash] || VIEW_TITLES["#chat"] || VIEW_TITLES["#inbox"];
  $("viewEyebrow").textContent = info.eyebrow;
  $("viewTitle").textContent   = info.title;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Hide floating widget if on #chat page to prevent redundancy
  const fab = $("chatFab");
  if (fab) {
    fab.style.display = (hash === "#chat") ? "none" : "flex";
    const panel = $("chatPanel");
    if (panel && hash === "#chat") panel.style.display = "none";
  }
}
window.addEventListener("hashchange", switchView);

/* ─── Loaders ──────────────────────────────────────────────────────────── */

// 1. Health & Overview
async function loadHealth(agents) {
  try {
    const h = await request(api.knowledge);
    $("knowledgeHealth").textContent = `${h.knowledge_health}%`;
    $("openConflicts").textContent   = h.open_conflicts;
    $("workflowCount").textContent   = h.automated_workflows;

    const active = (agents || []).filter((a) => a.status === "active").length;
    $("activeAgents").textContent = active || "2";

    const cb = $("conflictBadge");
    if (cb) cb.textContent = h.open_conflicts || "0";
    const cl = $("conflictCountLabel");
    if (cl) cl.textContent = `${h.open_conflicts} open`;
  } catch (e) {
    console.error("Error loading health:", e);
  }
}

// 2. Conflicts & Detail
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
      class="conflict-card ${c.id === selectedConflictId ? "selected" : ""}"
      data-conflict-id="${c.id}"
      role="listitem"
      type="button"
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
  `).join("") || `<div class="empty-state">No open conflicts detected.</div>`;

  document.querySelectorAll(".conflict-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedConflictId = card.dataset.conflictId;
      renderConflictList();
      renderConflictDetail();
    });
  });
}

function scoreFill(id, pct) {
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
      <p style="color:var(--text-sec);font-size:12.5px;line-height:1.5;">${item.content}</p>
      <div class="source-meta">
        <span class="badge">${item.owner}</span>
        <span class="badge">${formatTime(item.timestamp)}</span>
        <span class="badge">${Math.round(item.authority_score * 100)}% auth</span>
        <span class="badge">${Math.round(item.freshness_score * 100)}% fresh</span>
      </div>
    </div>
  `;
}

async function renderConflictDetail() {
  const conflict = conflicts.find((c) => c.id === selectedConflictId) || conflicts[0];
  if (!conflict) {
    $("conflictDetail").innerHTML = `<div class="empty-state">No conflicts found.</div>`;
    return;
  }

  selectedConflictId = conflict.id;
  const primary   = conflict.evidence[0];
  const secondary = conflict.evidence.slice(1);
  const isResolved = ["approved", "resolved"].includes(conflict.status);
  const isRejected = conflict.status === "rejected";

  let riskHtml = "";
  try {
    const riskData = await request(api.riskCheck(conflict.id));
    const allPass  = riskData.approved_to_proceed;
    riskHtml = `
      <div class="risk-panel ${allPass ? "passed" : ""}">
        <h4>
          🛡️ Layer 0 — Pre-Approval Risk &amp; Policy Gate
          <span class="layer-chip l0" style="margin-left:auto;">L0 GATE</span>
        </h4>
        ${riskData.rules.map((r) => `
          <div class="risk-rule ${r.passed ? "ok" : "fail"}">
            <span class="rule-icon">${r.passed ? "✓" : "✗"}</span>
            <span>${r.rule}</span>
          </div>
        `).join("")}
        <div style="margin-top:8px;font-size:11.5px;color:var(--text-sec);">
          Required Approver: <strong>${riskData.required_approver}</strong>
          · Risk Level: <strong>${riskData.risk_level}</strong>
          ${riskData.escalation_path ? `· Escalation: ${riskData.escalation_path}` : ""}
        </div>
      </div>
    `;
  } catch {}

  const contrPct = Math.round((conflict.contradiction_score || 0) * 100);
  const freshPct = Math.round((conflict.freshness_delta     || 0) * 100);
  const authPct  = Math.round((conflict.authority_delta     || 0) * 100);

  $("conflictDetail").innerHTML = `
    ${isResolved ? `<div class="approved-banner">✅ Approved — 5 execution workflows triggered across Knowledge Base, Jira, Slack, and GitHub.</div>` : ""}
    ${isRejected ? `<div class="approved-banner" style="background:var(--red-light);border-color:#fca5a5;color:var(--red);">❌ Rejected — no changes written.</div>` : ""}

    <div class="detail-head">
      <div>
        <p class="eyebrow">Layer 2 Contradiction Engine</p>
        <h2>${conflict.title}</h2>
      </div>
      ${badge(conflict.status)}
    </div>

    <!-- AI Intelligence Scores -->
    <div class="score-section">
      <div class="score-section-head">
        <span class="score-section-label">🧠 Multi-Agent Confidence Scores ${layerChip("L2","l2")}</span>
        <span class="score-section-value">${conflict.confidence}% overall confidence</span>
      </div>
      <div>
        <div class="score-row">
          <div class="score-row-head"><span>Contradiction Score</span><span>${contrPct}%</span></div>
          <div class="score-track"><div class="score-fill contradiction" id="sf-contr-${conflict.id}"></div></div>
        </div>
        <div class="score-row">
          <div class="score-row-head"><span>Freshness Delta</span><span>${freshPct}%</span></div>
          <div class="score-track"><div class="score-fill freshness" id="sf-fresh-${conflict.id}"></div></div>
        </div>
        <div class="score-row">
          <div class="score-row-head"><span>Authority Delta</span><span>${authPct}%</span></div>
          <div class="score-track"><div class="score-fill authority" id="sf-auth-${conflict.id}"></div></div>
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--muted);margin-top:6px;">
        Detected by ${agentTag(conflict.detected_by_agent)} · 1 Neo4j Graph Hop · ${(conflict.evidence || []).length} Verified Evidence Source(s)
      </div>
    </div>

    <!-- Side-by-Side Comparison -->
    <div class="detail-grid">
      ${renderSourceCard("📋 Official Document (Outdated)", conflict.document, conflict.old_claim, "official")}
      ${renderSourceCard("🔍 Real Operational Evidence", primary, conflict.new_claim, "evidence")}
    </div>

    ${secondary.length ? `
      <div class="reasoning-card">
        <h3>Supporting Secondary Evidence (${secondary.length} additional)</h3>
        ${secondary.map((e) => `<p style="font-size:12px;margin-bottom:4px;"><strong>${e.source}:</strong> ${e.title} — ${e.content}</p>`).join("")}
      </div>` : ""}

    <div class="reasoning-card recommended">
      <h3>✏️ AI-Recommended Patch</h3>
      <p>${conflict.recommended_update}</p>
    </div>

    <div class="reasoning-card">
      <h3>Business Impact &amp; Reasoning</h3>
      <p><strong>Impact:</strong> ${conflict.business_impact}</p>
      <p style="margin-top:4px;"><strong>Why Flagged:</strong> ${conflict.reasoning}</p>
    </div>

    <!-- Risk Check -->
    ${riskHtml}

    <!-- Action Bar -->
    <div class="action-bar">
      <div class="action-bar-info">
        <strong>Designated Approver: ${conflict.owner}</strong>
        <p>Human approval required before automated execution writes to official knowledge.</p>
      </div>
      <div class="action-buttons">
        <button class="danger-button"  id="rejectBtn"  type="button" ${isResolved||isRejected?"disabled":""}>✕ Reject</button>
        <button class="primary-button" id="approveBtn" type="button" ${isResolved||isRejected?"disabled":""}>✓ Approve &amp; Execute</button>
      </div>
    </div>
  `;

  scoreFill(`sf-contr-${conflict.id}`, contrPct);
  scoreFill(`sf-fresh-${conflict.id}`, freshPct);
  scoreFill(`sf-auth-${conflict.id}`,  authPct);

  $("approveBtn")?.addEventListener("click", approveConflict);
  $("rejectBtn")?.addEventListener("click",  rejectConflict);
}

// 3. Approve / Reject Actions
async function approveConflict() {
  const btn = $("approveBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Executing 5 actions…"; }
  try {
    await request(`/api/v1/conflicts/${selectedConflictId}/approve`, {
      method: "POST",
      body: JSON.stringify({ reason: "Approved via Enterprise Dashboard review." }),
    });
    window.showToast("✅ Conflict approved! Knowledge base updated and 5 workflows dispatched.");
    await refreshAll();
    location.hash = "#execution";
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "✓ Approve & Execute"; }
  }
}

async function rejectConflict() {
  const btn = $("rejectBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Rejecting…"; }
  try {
    await request(`/api/v1/conflicts/${selectedConflictId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: "Rejected by reviewer." }),
    });
    window.showToast("❌ Conflict rejected. No changes were applied.");
    await refreshAll();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "✕ Reject"; }
  }
}

// 4. Intelligence Core View
async function loadIntelligenceCore() {
  const [intelData, agentData, memData] = await Promise.all([
    request(api.intelligence),
    request(api.agents),
    request(api.memory),
  ]);

  const agents = agentData.agents;
  const rag    = intelData.rag_engine;
  const kg     = intelData.knowledge_graph;
  const cd     = intelData.conflict_detection;
  const mem    = intelData.memory_store;

  $("intelStats").innerHTML = `
    <div class="intel-stat">
      <div class="ist-head"><span class="ist-icon">🔎</span><span class="ist-name">RAG Engine</span></div>
      <div class="ist-value">${rag.total_chunks}</div>
      <div class="ist-sub">${rag.documents_indexed} docs · ${rag.events_indexed} events indexed · pgvector 1536d</div>
    </div>
    <div class="intel-stat">
      <div class="ist-head"><span class="ist-icon">🕸️</span><span class="ist-name">Knowledge Graph</span></div>
      <div class="ist-value">${kg.nodes}</div>
      <div class="ist-sub">${kg.edges} relationship edges · ${kg.backend}</div>
    </div>
    <div class="intel-stat">
      <div class="ist-head"><span class="ist-icon">🎯</span><span class="ist-name">Conflict Detector</span></div>
      <div class="ist-value">${cd.conflicts_found}</div>
      <div class="ist-sub">open · avg contradiction ${Math.round(cd.avg_contradiction * 100)}%</div>
    </div>
    <div class="intel-stat">
      <div class="ist-head"><span class="ist-icon">🧠</span><span class="ist-name">Memory Store</span></div>
      <div class="ist-value">${mem.short_term_count + mem.long_term_count}</div>
      <div class="ist-sub">${mem.short_term_count} short-term · ${mem.long_term_count} long-term</div>
    </div>
  `;

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
      <div style="font-size:11.5px;color:var(--muted);margin-top:6px;">
        <strong style="color:${agent.conflicts_detected > 0 ? "var(--red)" : "var(--muted)"};">
          ${agent.conflicts_detected} conflict${agent.conflicts_detected !== 1 ? "s" : ""}
        </strong> detected
      </div>
    </div>
  `).join("");

  // Context table
  $("contextMemoryTable").innerHTML = (memData.company_context || []).map((c) => `
    <tr>
      <td class="mono" style="font-weight:600;color:var(--blue);">${c.key}</td>
      <td>${c.value}</td>
      <td><span class="badge" style="background:#f0fdf4;color:#166534;">Verified</span></td>
    </tr>
  `).join("");

  return agents;
}

// 5. Processing Pipeline View
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
      <div class="pc-head"><span class="pc-icon">⚙️</span><span class="pc-name">Celery Workers</span></div>
      <div class="pc-backend">${bw.backend}</div>
      <div class="pc-value">${bw.tasks_completed}</div>
      <div class="pc-sub">${bw.workers_online} workers online · ${badge(bw.status)}</div>
    </div>
    <div class="pipeline-component">
      <div class="pc-head"><span class="pc-icon">🔀</span><span class="pc-name">Event Router</span></div>
      <div class="pc-backend">Domain Rule Engine</div>
      <div class="pc-value">${er.events_routed}</div>
      <div class="pc-sub">${er.pipelines_active} active · ${er.routing_rules} rules · ${badge(er.status)}</div>
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

// 6. Execution Workflows View
async function loadExecution() {
  const result = await request(api.workflows);
  const wf = result.workflows;
  $("workflowTimeline").innerHTML = wf.length
    ? wf.map((item) => `
        <div class="timeline-item" role="listitem">
          <div class="tool-icon-wrap" title="${item.tool}">${TOOL_ICONS[item.tool] || "🔧"}</div>
          <div>
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <div style="margin-top:6px;display:flex;gap:6px;">
              ${layerChip(item.layer || "Layer 0 — Execution", "l0")}
              <span class="badge" style="font-family:monospace;">${item.tool}</span>
            </div>
          </div>
          <div class="tl-meta" style="text-align:right;">
            ${badge(item.status)}
            <div style="font-size:11.5px;font-weight:600;color:var(--text);margin-top:4px;">${formatTime(item.created_at)}</div>
            <div class="muted" style="font-size:10.5px;">${formatRelative(item.created_at)}</div>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state">No actions executed yet. Approve a conflict from the Conflict Inbox to trigger automated execution across Knowledge Base, Jira, Slack, and GitHub.</div>`;
}

// 7. Audit Logs View & Filter
async function loadAuditLogs() {
  const result = await request(api.audit);
  auditLogsCache = result.audit_logs;
  renderAuditLogs(auditLogsCache);
}

function renderAuditLogs(logs) {
  $("auditLogs").innerHTML = logs.length
    ? logs.map((item) => `
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
    : `<div class="empty-state">No audit logs recorded yet.</div>`;
}

$("auditSearchInput")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = auditLogsCache.filter((l) =>
    l.title.toLowerCase().includes(q) ||
    l.actor.toLowerCase().includes(q) ||
    l.action.toLowerCase().includes(q)
  );
  renderAuditLogs(filtered);
});

// 8. Integrations Catalog View
async function loadIntegrations() {
  try {
    const integrations = await request(api.integrations);
    $("integrationsGrid").innerHTML = integrations.map((conn) => `
      <div class="integration-card">
        <div class="ic-header">
          <div class="ic-title-group">
            <span class="ic-icon">${conn.icon}</span>
            <div>
              <div class="ic-name">${conn.name}</div>
              <div class="ic-account">${conn.account_name || "Enterprise Workspace"}</div>
            </div>
          </div>
          ${badge(conn.status)}
        </div>
        <div class="ic-meta">
          <div>Events Ingested: <strong>${conn.events_ingested}</strong></div>
          <div>Last Sync: <strong>${formatRelative(conn.last_sync)}</strong></div>
          <div style="font-family:monospace;font-size:10.5px;color:var(--muted);margin-top:4px;">Endpoint: ${conn.webhook_endpoint}</div>
        </div>
        <div class="ic-actions">
          <button class="ghost-button" style="flex:1;" type="button" onclick="triggerSync('${conn.provider}')">🔄 Sync Now</button>
        </div>
      </div>
    `).join("");
  } catch (e) {
    console.error("Error loading integrations:", e);
  }
}

window.triggerSync = async function (provider) {
  try {
    await request(`/api/v1/integrations/${provider}/sync`, { method: "POST" });
    window.showToast(`🔄 Synchronized ${provider.toUpperCase()} connector!`);
    await loadIntegrations();
  } catch (e) {
    window.showToast(`Sync requested for ${provider}`);
  }
};

// 9. Profile & RBAC View
async function loadProfile() {
  try {
    // Bootstrap login to populate token
    const loginData = await request(api.authLogin, {
      method: "POST",
      body: JSON.stringify({ email: "admin@companybrain.local", password: "admin1234" }),
    });
    authToken = loginData.access_token;
    $("bearerTokenInput").value = authToken;

    const me = loginData.user;
    $("profileName").textContent  = me.display_name;
    $("profileEmail").textContent = me.email;

    $("profilePermissions").innerHTML = (me.permissions || []).map((p) => `
      <span class="perm-chip">${p}</span>
    `).join("");
  } catch (e) {
    console.error("Error loading profile:", e);
  }
}

/* ─── Refresh All ───────────────────────────────────────────────────────── */
async function refreshAll() {
  const [agents] = await Promise.all([
    loadIntelligenceCore(),
    loadPipeline(),
    loadConflicts(),
    loadExecution(),
    loadAuditLogs(),
    loadIntegrations(),
    loadProfile(),
  ]);
  await loadHealth(agents);
}

/* ─── Boot & Reset ──────────────────────────────────────────────────────── */
async function boot() {
  switchView();
  try {
    await request(api.health);
    $("apiStatus").textContent = "Live";
    $("apiStatus").className   = "status-pill ok";
    await refreshAll();
  } catch {
    $("apiStatus").textContent = "API Offline";
    $("apiStatus").className   = "status-pill warn";
  }

  // Live real-time polling every 3.5 seconds
  setInterval(async () => {
    try {
      await refreshAll();
    } catch {}
  }, 3500);
}

$("resetButton").addEventListener("click", async () => {
  $("resetButton").disabled    = true;
  $("resetButton").textContent = "Resetting…";
  try {
    await request(api.reset, { method: "POST", body: "{}" });
    selectedConflictId = "conflict-auth-method";
    window.showToast("🔄 Prototype database cleanly reset to baseline!");
    await refreshAll();
  } finally {
    $("resetButton").innerHTML = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5A4.5 4.5 0 1 1 6.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2 3.5V6.5H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Reset Demo`;
    $("resetButton").disabled = false;
  }
});

boot();

/* ─── AI Command Center & Stateful Conversation Controller ───────────── */
(function initAIChatSystem() {
  const SESSION_KEY = "cbos_chat_session_id";
  let activeSessionId = localStorage.getItem(SESSION_KEY) || null;
  let savedSessionsCache = [];

  // Floating elements
  const fab        = $("chatFab");
  const panel      = $("chatPanel");
  const miniMsgs   = $("chatMessages");
  const miniInput  = $("chatInput");
  const miniSend   = $("chatSendBtn");
  const miniClose  = $("chatCloseBtn");
  const iconOpen   = $("chatFabIconOpen");
  const iconClose  = $("chatFabIconClose");
  const unreadDot  = $("chatUnreadDot");
  let isMiniOpen   = false;

  // Full-screen elements
  const fsList     = $("fsSessionList");
  const fsNewBtn   = $("fsNewChatBtn");
  const fsSearch   = $("fsSessionSearch");
  const fsMsgs     = $("fsChatMessages");
  const fsInput    = $("fsChatInput");
  const fsSend     = $("fsChatSendBtn");
  const fsClear    = $("fsClearChatBtn");
  const fsTitle    = $("fsChatHeaderTitle");
  const fsStatus   = $("fsChatHeaderStatus");
  const fsCount    = $("fsSessionCountBadge");

  function scrollToBottom() {
    if (fsMsgs) fsMsgs.scrollTop = fsMsgs.scrollHeight;
    if (miniMsgs) miniMsgs.scrollTop = miniMsgs.scrollHeight;
  }

  function renderMarkdown(text) {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code style='background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12.5px'>$1</code>")
      .replace(/^---$/gm, "<hr style='border:none;border-top:1px solid var(--border);margin:10px 0;'>")
      .replace(/\n/g, "<br/>")
      .replace(/#{1,3}\s(.+)/g, "<strong style='font-size:1.05em;display:block;margin:4px 0;'>$1</strong>");
  }

  function appendMessageToContainer(container, role, text, timestamp, engine) {
    if (!container) return;
    const wrap = document.createElement("div");
    wrap.className = `chat-msg ${role}`;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.innerHTML = renderMarkdown(text);

    const metaRow = document.createElement("div");
    metaRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10.5px;opacity:0.65;margin-top:6px;padding-top:4px;border-top:1px solid rgba(0,0,0,0.05);";

    if (role === "bot") {
      const engineName = engine === "gemini-1.5-flash" ? "✨ Gemini 1.5 Flash" : (engine === "gpt-4o-mini" ? "🤖 GPT-4o Mini" : (engine === "claude-3-5-sonnet" ? "🔮 Claude 3.5 Sonnet" : "🧠 Cognitive NLP Engine"));
      metaRow.innerHTML = `<span style="font-weight:600;">${engineName}</span><span>${timestamp ? formatTime(timestamp) : 'Live State'}</span>`;
      bubble.appendChild(metaRow);
    } else if (timestamp) {
      const timeTag = document.createElement("div");
      timeTag.style.cssText = "font-size:10px;opacity:0.6;text-align:right;margin-top:4px;";
      timeTag.textContent = formatTime(timestamp);
      bubble.appendChild(timeTag);
    }

    wrap.appendChild(bubble);
    container.appendChild(wrap);
    scrollToBottom();
  }

  // Model selection persistence
  const modelSelect = $("chatModelSelect");
  const SAVED_MODEL_KEY = "cbos_selected_model";
  if (modelSelect) {
    const savedModel = localStorage.getItem(SAVED_MODEL_KEY);
    if (savedModel) modelSelect.value = savedModel;
    modelSelect.addEventListener("change", () => {
      localStorage.setItem(SAVED_MODEL_KEY, modelSelect.value);
      window.showToast(`🤖 AI Model changed to: ${modelSelect.options[modelSelect.selectedIndex].text}`);
    });
  }

  function showTyping() {
    [fsMsgs, miniMsgs].forEach((container) => {
      if (!container) return;
      const wrap = document.createElement("div");
      wrap.className = "chat-msg bot chat-typing-indicator-wrap";
      wrap.innerHTML = `<div class="chat-typing">
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
      </div>`;
      container.appendChild(wrap);
    });
    scrollToBottom();
  }

  function removeTyping() {
    document.querySelectorAll(".chat-typing-indicator-wrap").forEach((el) => el.remove());
  }

  function formatTimeAgo(isoStr) {
    if (!isoStr) return "recently";
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  /* ─── Sessions List Rendering ────────────────────────────────────────── */
  async function loadSessionsList() {
    try {
      const res = await fetch("/api/v1/chat/sessions");
      if (!res.ok) return;
      const data = await res.json();
      savedSessionsCache = data.sessions || [];

      if (fsCount) fsCount.textContent = `${savedSessionsCache.length} conversation${savedSessionsCache.length === 1 ? "" : "s"}`;
      renderSessionsSidebar();
    } catch (e) {
      console.error("Error loading sessions:", e);
    }
  }

  function renderSessionsSidebar() {
    if (!fsList) return;
    const query = (fsSearch ? fsSearch.value.trim().toLowerCase() : "");
    const filtered = savedSessionsCache.filter(s =>
      s.title.toLowerCase().includes(query) || (s.preview && s.preview.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
      fsList.innerHTML = `
        <div style="text-align:center;padding:24px 12px;color:var(--muted);font-size:12px;">
          ${query ? 'No matching conversations.' : 'No saved conversations yet.<br/>Start a new chat!'}
        </div>`;
      return;
    }

    fsList.innerHTML = "";
    filtered.forEach((sess) => {
      const isActive = sess.session_id === activeSessionId;
      const item = document.createElement("div");
      item.className = `fs-session-item ${isActive ? "active" : ""}`;
      item.setAttribute("role", "listitem");
      item.onclick = (e) => {
        if (e.target.closest(".fs-session-del-btn")) return;
        selectSession(sess.session_id);
      };

      item.innerHTML = `
        <div class="fs-session-info">
          <span class="fs-session-title">${sess.title || "Conversation"}</span>
          <div class="fs-session-meta">
            <span>💬 ${sess.message_count} msgs</span>
            <span>&middot;</span>
            <span>${formatTimeAgo(sess.last_active)}</span>
          </div>
          ${sess.preview ? `<div class="fs-session-preview">${sess.preview}</div>` : ""}
        </div>
        <button class="fs-session-del-btn" title="Delete conversation" aria-label="Delete conversation">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      `;

      const delBtn = item.querySelector(".fs-session-del-btn");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSession(sess.session_id);
      });

      fsList.appendChild(item);
    });
  }

  if (fsSearch) {
    fsSearch.addEventListener("input", renderSessionsSidebar);
  }

  /* ─── Select / Switch Session ────────────────────────────────────────── */
  async function selectSession(sessionId) {
    if (!sessionId) return;
    activeSessionId = sessionId;
    localStorage.setItem(SESSION_KEY, activeSessionId);
    renderSessionsSidebar();

    try {
      const res = await fetch(`/api/v1/chat/session/${sessionId}`);
      if (!res.ok) {
        // Session expired or deleted on server
        localStorage.removeItem(SESSION_KEY);
        activeSessionId = null;
        createNewSession();
        return;
      }
      const data = await res.json();

      // Update Header Title & Status
      if (fsTitle) fsTitle.textContent = data.title || "AI Command Center & Copilot";
      if (fsStatus) {
        fsStatus.innerHTML = `<span class="chat-online-dot"></span> Session active &nbsp;&middot;&nbsp; ${data.message_count} messages in context`;
      }

      // Update floating header
      const miniStatus = panel ? panel.querySelector(".chat-status") : null;
      if (miniStatus) {
        miniStatus.innerHTML = `<span class="chat-online-dot"></span> Session ${sessionId.slice(0, 8)}… &nbsp;&middot;&nbsp; ${data.message_count} msgs`;
      }

      // Replay messages
      if (fsMsgs) fsMsgs.innerHTML = "";
      if (miniMsgs) miniMsgs.innerHTML = "";

      if (!data.history || data.history.length === 0) {
        const welcomeHtml = `
          <div class="chat-msg bot">
            <div class="chat-bubble">
              👋 Welcome to this conversation session.<br/><br/>
              Ask anything about your <strong>Conflict Inbox</strong>, <strong>Pipeline Events</strong>, or execute actions directly!
            </div>
          </div>`;
        if (fsMsgs) fsMsgs.innerHTML = welcomeHtml;
        if (miniMsgs) miniMsgs.innerHTML = welcomeHtml;
      } else {
        data.history.forEach((m) => {
          appendMessageToContainer(fsMsgs, m.role, m.text, m.timestamp);
          appendMessageToContainer(miniMsgs, m.role, m.text, m.timestamp);
        });
      }
      scrollToBottom();
    } catch (e) {
      console.error("Error selecting session:", e);
    }
  }

  /* ─── Start New Conversation ─────────────────────────────────────────── */
  async function createNewSession(customTitle) {
    try {
      const res = await fetch("/api/v1/chat/sessions/new", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ title: customTitle || "New Conversation" })
      });
      const data = await res.json();
      activeSessionId = data.session_id;
      localStorage.setItem(SESSION_KEY, activeSessionId);

      if (fsTitle) fsTitle.textContent = data.title || "New Conversation";
      if (fsStatus) fsStatus.innerHTML = `<span class="chat-online-dot"></span> Fresh conversation started`;

      const welcomeHtml = `
        <div class="chat-msg bot">
          <div class="chat-bubble">
            👋 <strong>New Conversation Started</strong><br/><br/>
            I have full operational awareness across your <strong>Conflict Inbox</strong>, <strong>Processing Pipeline</strong>, and <strong>Execution Layer</strong>. What would you like to investigate or approve?
          </div>
        </div>`;
      if (fsMsgs) fsMsgs.innerHTML = welcomeHtml;
      if (miniMsgs) miniMsgs.innerHTML = welcomeHtml;

      await loadSessionsList();
      window.showToast("💬 New conversation started!");
      if (fsInput) fsInput.focus();
    } catch (e) {
      console.error("Error creating session:", e);
    }
  }

  if (fsNewBtn) fsNewBtn.addEventListener("click", () => createNewSession());

  /* ─── Delete Session ─────────────────────────────────────────────────── */
  async function deleteSession(sessionId) {
    try {
      await fetch(`/api/v1/chat/session/${sessionId}`, { method: "DELETE" });
      savedSessionsCache = savedSessionsCache.filter(s => s.session_id !== sessionId);

      if (activeSessionId === sessionId) {
        if (savedSessionsCache.length > 0) {
          selectSession(savedSessionsCache[0].session_id);
        } else {
          createNewSession();
        }
      } else {
        renderSessionsSidebar();
      }
      window.showToast("🗑️ Conversation deleted.");
    } catch (e) {
      console.error("Error deleting session:", e);
    }
  }

  /* ─── Clear Current Messages ─────────────────────────────────────────── */
  async function clearCurrentSession() {
    if (!activeSessionId) return;
    try {
      await fetch(`/api/v1/chat/session/${activeSessionId}`, { method: "DELETE" });
      const welcomeHtml = `
        <div class="chat-msg bot">
          <div class="chat-bubble">
            💬 Messages cleared for this conversation. What would you like to explore?
          </div>
        </div>`;
      if (fsMsgs) fsMsgs.innerHTML = welcomeHtml;
      if (miniMsgs) miniMsgs.innerHTML = welcomeHtml;
      await loadSessionsList();
      window.showToast("🧠 Conversation memory cleared!");
    } catch (e) {
      console.error("Error clearing session:", e);
    }
  }

  if (fsClear) fsClear.addEventListener("click", clearCurrentSession);

  /* ─── Send Message ───────────────────────────────────────────────────── */
  async function sendChatMessage(text) {
    const msg = (text || "").trim();
    if (!msg) return;

    if (fsInput) fsInput.value = "";
    if (miniInput) miniInput.value = "";
    if (fsSend) fsSend.disabled = true;
    if (miniSend) miniSend.disabled = true;

    const nowIso = new Date().toISOString();
    appendMessageToContainer(fsMsgs, "user", msg, nowIso);
    appendMessageToContainer(miniMsgs, "user", msg, nowIso);
    showTyping();

    const selectedProvider = modelSelect ? modelSelect.value : "auto";
    const customKey = localStorage.getItem("cbos_custom_llm_key") || null;

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          message: msg,
          session_id: activeSessionId,
          provider: selectedProvider,
          api_key: customKey
        })
      });
      const data = await res.json();
      removeTyping();

      if (data.session_id && data.session_id !== activeSessionId) {
        activeSessionId = data.session_id;
        localStorage.setItem(SESSION_KEY, activeSessionId);
      }

      if (data.title && fsTitle) {
        fsTitle.textContent = data.title;
      }

      const reply = data.reply || "I couldn't process that command.";
      appendMessageToContainer(fsMsgs, "bot", reply, data.timestamp, data.engine);
      appendMessageToContainer(miniMsgs, "bot", reply, data.timestamp, data.engine);

      if (fsStatus) {
        fsStatus.innerHTML = `<span class="chat-online-dot"></span> Session active &nbsp;&middot;&nbsp; ${data.message_count || 0} messages in context`;
      }

      // If the message was an action (approval/rejection), refresh app state
      if (anyActionKeyword(msg)) {
        await refreshAll();
      }

      // Refresh conversations list in background
      loadSessionsList();
    } catch (e) {
      removeTyping();
      const err = "⚠️ Connection error. Make sure the backend server is running.";
      appendMessageToContainer(fsMsgs, "bot", err);
      appendMessageToContainer(miniMsgs, "bot", err);
    } finally {
      if (fsSend) fsSend.disabled = false;
      if (miniSend) miniSend.disabled = false;
      if (fsInput && location.hash === "#chat") fsInput.focus();
    }
  }

  function anyActionKeyword(txt) {
    const t = txt.toLowerCase();
    return ["approve", "reject", "reopen", "change owner", "set severity", "update risk"].some(k => t.includes(k));
  }

  // Full-screen events
  if (fsSend) fsSend.addEventListener("click", () => sendChatMessage(fsInput ? fsInput.value : ""));
  if (fsInput) {
    fsInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(fsInput.value);
      }
    });
  }

  // Mini floating events
  if (miniSend) miniSend.addEventListener("click", () => sendChatMessage(miniInput ? miniInput.value : ""));
  if (miniInput) {
    miniInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(miniInput.value);
      }
    });
  }

  function toggleMiniChat() {
    isMiniOpen = !isMiniOpen;
    if (panel) panel.style.display = isMiniOpen ? "flex" : "none";
    if (iconOpen) iconOpen.style.display = isMiniOpen ? "none" : "block";
    if (iconClose) iconClose.style.display = isMiniOpen ? "block" : "none";
    if (unreadDot) unreadDot.style.display = "none";
    if (isMiniOpen && miniInput) {
      miniInput.focus();
      scrollToBottom();
    }
  }

  if (fab) fab.addEventListener("click", toggleMiniChat);
  if (miniClose) miniClose.addEventListener("click", toggleMiniChat);

  // Global suggestion triggers
  window.fsSendSuggestion = function(text) {
    if (fsInput) fsInput.value = text;
    sendChatMessage(text);
  };

  window.sendSuggestion = function(text) {
    if (miniInput) miniInput.value = text;
    if (!isMiniOpen) toggleMiniChat();
    sendChatMessage(text);
  };

  /* ─── Initialization on Boot ─────────────────────────────────────────── */
  async function init() {
    await loadSessionsList();
    if (activeSessionId) {
      await selectSession(activeSessionId);
    } else if (savedSessionsCache.length > 0) {
      await selectSession(savedSessionsCache[0].session_id);
    } else {
      await createNewSession();
    }
  }

  init();
})();

