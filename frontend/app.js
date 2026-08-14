/* ─── API Routes ──────────────────────────────────────────────────────── */
const api = {
  health:    "/api/health",
  knowledge: "/api/knowledge/health",
  conflicts: "/api/conflicts",
  workflows: "/api/workflows",
  audit:     "/api/audit-logs",
  reset:     "/api/demo/reset",
};

/* ─── State ───────────────────────────────────────────────────────────── */
let selectedConflictId = "conflict-auth-method";
let conflicts = [];

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function badge(value) {
  const normalized = String(value).toLowerCase().replace(/\s+/g, "-");
  const display = String(value);
  return `<span class="badge ${normalized}">${display}</span>`;
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute:"2-digit",
  });
}

function formatRelative(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1)   return "just now";
  if (hours < 24)  return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ─── Tool Icons ──────────────────────────────────────────────────────── */
const TOOL_ICONS = {
  "Knowledge Base": { emoji: "📘", cls: "kb"     },
  "Jira":           { emoji: "🎯", cls: "jira"   },
  "Slack":          { emoji: "💬", cls: "slack"  },
  "GitHub":         { emoji: "🐙", cls: "github" },
};

function toolBadge(name) {
  const t = TOOL_ICONS[name] || { emoji: "🔧", cls: "" };
  return `<span class="tool-badge ${t.cls}">${t.emoji} ${name}</span>`;
}

function toolIconWrap(name) {
  const t = TOOL_ICONS[name] || { emoji: "🔧", cls: "" };
  return `<div class="tool-icon-wrap" title="${name}" aria-hidden="true">${t.emoji}</div>`;
}

/* ─── Nav Active State ────────────────────────────────────────────────── */
function updateNav() {
  const hash = location.hash || "#command";
  document.querySelectorAll(".nav a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === hash);
    a.setAttribute("aria-current", a.getAttribute("href") === hash ? "page" : "false");
  });
}

window.addEventListener("hashchange", updateNav);

/* ─── Knowledge Health ────────────────────────────────────────────────── */
async function loadHealth() {
  const h = await request(api.knowledge);
  $("knowledgeHealth").textContent = `${h.knowledge_health}%`;
  $("openConflicts").textContent    = h.open_conflicts;
  $("staleDocuments").textContent   = h.stale_documents;
  $("workflowCount").textContent    = h.automated_workflows;
  $("lastScan").textContent         = `Last scan ${formatTime(h.last_scan)}`;

  const badge = $("conflictBadge");
  if (badge) badge.textContent = h.open_conflicts || "";
}

/* ─── Conflict List ───────────────────────────────────────────────────── */
function renderConflictList() {
  $("conflictList").innerHTML = conflicts
    .map((c) => `
      <button
        class="conflict-card severity-${c.severity} ${c.id === selectedConflictId ? "selected" : ""}"
        data-conflict-id="${c.id}"
        role="listitem"
        aria-pressed="${c.id === selectedConflictId}"
        aria-label="${c.title}, severity ${c.severity}, status ${c.status}"
      >
        <div class="conflict-card-head">
          <h3>${c.title}</h3>
          ${badge(c.severity)}
        </div>
        <p class="impact-text">${c.business_impact}</p>
        <div class="conflict-meta">
          ${badge(c.status)}
          <span class="badge">${c.confidence}% confidence</span>
          <span class="badge">${c.owner}</span>
        </div>
      </button>
    `)
    .join("");

  document.querySelectorAll(".conflict-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedConflictId = card.dataset.conflictId;
      renderConflictList();
      renderConflictDetail();
    });
  });
}

/* ─── Source Card ─────────────────────────────────────────────────────── */
function renderSourceCard(title, item, claim, type) {
  if (!item) return "";
  const authorityPct = Math.round((item.authority_score || 0) * 100);
  const freshnessPct = Math.round((item.freshness_score || 0) * 100);
  return `
    <div class="source-card ${type}" role="region" aria-label="${title}">
      <div class="source-card-head">
        <h3>${title}</h3>
        <span class="badge">${item.source}</span>
      </div>
      <p class="claim-text">"${claim}"</p>
      <p style="color:var(--text-secondary);font-size:13px;line-height:1.5;">${item.content}</p>
      <div class="source-meta">
        <span class="badge">${item.owner}</span>
        <span class="badge" title="Published">${formatTime(item.timestamp)}</span>
        <span class="badge" title="Authority score">${authorityPct}% authority</span>
        <span class="badge" title="Freshness">${freshnessPct}% fresh</span>
      </div>
    </div>
  `;
}

/* ─── Conflict Detail ─────────────────────────────────────────────────── */
function renderConflictDetail() {
  const conflict = conflicts.find((c) => c.id === selectedConflictId) || conflicts[0];
  if (!conflict) {
    $("conflictDetail").innerHTML = `<div class="empty-state">No conflicts found.</div>`;
    return;
  }

  selectedConflictId = conflict.id;
  const primaryEvidence   = conflict.evidence[0];
  const secondaryEvidence = conflict.evidence.slice(1);
  const isResolved        = conflict.status === "approved" || conflict.status === "resolved";
  const isRejected        = conflict.status === "rejected";
  const confidenceCls     = conflict.confidence >= 80 ? "high" : conflict.confidence >= 60 ? "medium" : "low";

  $("conflictDetail").innerHTML = `
    ${isResolved ? `
      <div class="approved-banner" role="status">
        ✅ This conflict was approved and all workflows have been triggered.
      </div>
    ` : ""}
    ${isRejected ? `
      <div class="approved-banner" style="background:var(--red-light);border-color:#fca5a5;color:var(--red);" role="status">
        ❌ This conflict was rejected and no changes were applied.
      </div>
    ` : ""}

    <div class="detail-head">
      <div>
        <p class="eyebrow">Conflict Review</p>
        <h2>${conflict.title}</h2>
      </div>
      ${badge(conflict.status)}
    </div>

    <!-- Confidence meter -->
    <div class="confidence-section" aria-label="AI confidence score">
      <div class="confidence-row">
        <span class="confidence-label">AI Detection Confidence</span>
        <span class="confidence-value" aria-label="${conflict.confidence} percent">${conflict.confidence}%</span>
      </div>
      <div class="confidence-track" role="progressbar" aria-valuenow="${conflict.confidence}" aria-valuemin="0" aria-valuemax="100">
        <div class="confidence-fill ${confidenceCls}" id="confFill" style="width:0%"></div>
      </div>
      <p style="font-size:11.5px;color:var(--muted);margin-top:6px;">
        Based on source authority, freshness delta, and evidence agreement across ${(conflict.evidence || []).length} source(s).
      </p>
    </div>

    <!-- Evidence side-by-side -->
    <div class="detail-grid">
      ${renderSourceCard("📋 Official Document (Outdated)", conflict.document, conflict.old_claim, "official")}
      ${renderSourceCard("🔍 New Evidence", primaryEvidence, conflict.new_claim, "evidence")}
    </div>

    <!-- Supporting evidence -->
    ${secondaryEvidence.length ? `
      <div class="reasoning-card" style="margin-bottom:12px;">
        <h3>Supporting Evidence (${secondaryEvidence.length} more source${secondaryEvidence.length > 1 ? "s" : ""})</h3>
        ${secondaryEvidence.map((e) => `
          <p><strong>${e.source}:</strong> ${e.title} — ${e.content}</p>
        `).join("")}
      </div>
    ` : ""}

    <!-- Recommended update -->
    <div class="reasoning-card recommended">
      <h3>✏️ AI-Recommended Update</h3>
      <p>${conflict.recommended_update}</p>
    </div>

    <!-- Business impact + reasoning -->
    <div class="reasoning-card">
      <h3>Business Impact &amp; Reasoning</h3>
      <p><strong>Impact:</strong> ${conflict.business_impact}</p>
      <p><strong>Why Company Brain flagged this:</strong> ${conflict.reasoning}</p>
    </div>

    <!-- Approval action bar -->
    <div class="action-bar">
      <div class="action-bar-info">
        <strong>Owner: ${conflict.owner}</strong>
        <p>Human approval required before Company Brain modifies official knowledge.</p>
      </div>
      <div class="action-buttons">
        <button class="danger-button"   id="rejectButton"  type="button" ${isResolved || isRejected ? "disabled" : ""} aria-label="Reject this conflict recommendation">
          ✕ Reject
        </button>
        <button class="primary-button"  id="approveButton" type="button" ${isResolved || isRejected ? "disabled" : ""} aria-label="Approve and trigger enterprise workflows">
          ✓ Approve Fix
        </button>
      </div>
    </div>
  `;

  /* Animate confidence bar after render */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = $("confFill");
      if (fill) fill.style.width = `${conflict.confidence}%`;
    });
  });

  $("approveButton")?.addEventListener("click", approveSelectedConflict);
  $("rejectButton")?.addEventListener("click", rejectSelectedConflict);
}

/* ─── Load Conflicts ─────────────────────────────────────────────────── */
async function loadConflicts() {
  const result = await request(api.conflicts);
  conflicts = result.conflicts;
  renderConflictList();
  renderConflictDetail();
}

/* ─── Approve / Reject ────────────────────────────────────────────────── */
async function approveSelectedConflict() {
  const btn = $("approveButton");
  if (btn) { btn.disabled = true; btn.textContent = "Approving…"; }
  try {
    await request(`/api/conflicts/${selectedConflictId}/approve`, {
      method: "POST",
      body: JSON.stringify({ reason: "Approved during hackathon demo review." }),
    });
    await refreshAll();
    location.hash = "#workflow";
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "✓ Approve Fix"; }
  }
}

async function rejectSelectedConflict() {
  const btn = $("rejectButton");
  if (btn) { btn.disabled = true; btn.textContent = "Rejecting…"; }
  try {
    await request(`/api/conflicts/${selectedConflictId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: "Rejected during hackathon demo review." }),
    });
    await refreshAll();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "✕ Reject"; }
  }
}

/* ─── Workflows ───────────────────────────────────────────────────────── */
async function loadWorkflows() {
  const result = await request(api.workflows);
  const workflows = result.workflows;
  $("workflowTimeline").innerHTML = workflows.length
    ? workflows.map((item, i) => `
        <div class="timeline-item" role="listitem" style="animation-delay:${i * 60}ms">
          ${toolIconWrap(item.tool)}
          <div>
            <h3>${item.title}</h3>
            <p>${item.description}</p>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
            ${badge(item.status)}
            <span class="muted" style="font-size:11px;">${formatRelative(item.created_at)}</span>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state" role="status">Approve a conflict above to trigger simulated Jira, Slack, GitHub &amp; audit workflows.</div>`;
}

/* ─── Audit Logs ──────────────────────────────────────────────────────── */
async function loadAuditLogs() {
  const result = await request(api.audit);
  const logs = result.audit_logs;
  $("auditLogs").innerHTML = logs.length
    ? logs.map((item) => `
        <div class="audit-item" role="listitem">
          <div>
            <div class="audit-time">${formatTime(item.timestamp)}</div>
            <div class="muted" style="font-size:11px;margin-top:2px;">${formatRelative(item.timestamp)}</div>
          </div>
          <div>
            <h3>${item.title}</h3>
            <p>${item.actor} <strong>${item.action}</strong> this recommendation using ${item.evidence_count} evidence source(s)${item.reason ? ` — "${item.reason}"` : ""}.</p>
          </div>
          ${badge(item.action)}
        </div>
      `).join("")
    : `<div class="empty-state" role="status">No audit events recorded yet. Approve or reject a conflict to generate an audit entry.</div>`;
}

/* ─── Refresh All ─────────────────────────────────────────────────────── */
async function refreshAll() {
  await Promise.all([
    loadHealth(),
    loadConflicts(),
    loadWorkflows(),
    loadAuditLogs(),
  ]);
}

/* ─── Boot ────────────────────────────────────────────────────────────── */
async function boot() {
  updateNav();
  try {
    await request(api.health);
    $("apiStatus").textContent  = "Live";
    $("apiStatus").className    = "status-pill ok";
    await refreshAll();
  } catch {
    $("apiStatus").textContent  = "API Offline";
    $("apiStatus").className    = "status-pill warn";
    $("conflictDetail").innerHTML = `
      <div class="empty-state" role="alert">
        ⚠️ Backend not running. Start the server with:<br>
        <code style="font-family:monospace;font-size:12px;">python backend/app.py</code>
      </div>`;
  }
}

/* ─── Reset ───────────────────────────────────────────────────────────── */
$("resetButton").addEventListener("click", async () => {
  $("resetButton").textContent = "Resetting…";
  $("resetButton").disabled    = true;
  try {
    await request(api.reset, { method: "POST", body: "{}" });
    selectedConflictId = "conflict-auth-method";
    await refreshAll();
  } finally {
    $("resetButton").innerHTML  = `
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M2 6.5A4.5 4.5 0 1 1 6.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2 3.5V6.5H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Reset Demo`;
    $("resetButton").disabled = false;
  }
});

boot();
