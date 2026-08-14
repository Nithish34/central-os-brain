const api = {
  health: "/api/health",
  knowledge: "/api/knowledge/health",
  conflicts: "/api/conflicts",
  workflows: "/api/workflows",
  audit: "/api/audit-logs",
  reset: "/api/demo/reset",
};

let selectedConflictId = "conflict-auth-method";
let conflicts = [];

const $ = (id) => document.getElementById(id);

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function badge(value) {
  const normalized = String(value).toLowerCase();
  return `<span class="badge ${normalized}">${value}</span>`;
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadHealth() {
  const health = await request(api.knowledge);
  $("knowledgeHealth").textContent = `${health.knowledge_health}%`;
  $("openConflicts").textContent = health.open_conflicts;
  $("staleDocuments").textContent = health.stale_documents;
  $("workflowCount").textContent = health.automated_workflows;
  $("lastScan").textContent = `Last scan ${formatTime(health.last_scan)}`;
}

function renderConflictList() {
  $("conflictList").innerHTML = conflicts
    .map(
      (conflict) => `
        <button class="conflict-card ${conflict.id === selectedConflictId ? "selected" : ""}" data-conflict-id="${conflict.id}">
          <div class="conflict-card-head">
            <h3>${conflict.title}</h3>
            ${badge(conflict.severity)}
          </div>
          <p>${conflict.business_impact}</p>
          <div class="source-meta">
            ${badge(conflict.status)}
            <span class="badge">${conflict.confidence}% confidence</span>
            <span class="badge">${conflict.owner}</span>
          </div>
        </button>
      `
    )
    .join("");

  document.querySelectorAll(".conflict-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedConflictId = card.dataset.conflictId;
      renderConflictList();
      renderConflictDetail();
    });
  });
}

function renderSourceCard(title, item, claim) {
  if (!item) return "";
  return `
    <div class="source-card">
      <div class="card-row">
        <h3>${title}</h3>
        <span class="badge">${item.source}</span>
      </div>
      <p><strong>Claim:</strong> ${claim}</p>
      <p>${item.content}</p>
      <div class="source-meta">
        <span class="badge">${item.owner}</span>
        <span class="badge">${formatTime(item.timestamp)}</span>
        <span class="badge">${Math.round(item.authority_score * 100)} authority</span>
      </div>
    </div>
  `;
}

function renderConflictDetail() {
  const conflict = conflicts.find((item) => item.id === selectedConflictId) || conflicts[0];
  if (!conflict) {
    $("conflictDetail").innerHTML = `<div class="empty-state">No conflicts found.</div>`;
    return;
  }

  selectedConflictId = conflict.id;
  const primaryEvidence = conflict.evidence[0];
  const secondaryEvidence = conflict.evidence.slice(1);
  const approved = conflict.status === "approved" || conflict.status === "resolved";

  $("conflictDetail").innerHTML = `
    <div class="detail-head">
      <div>
        <p class="eyebrow">Conflict Review</p>
        <h2>${conflict.title}</h2>
      </div>
      ${badge(conflict.status)}
    </div>

    <div class="confidence">
      <div class="card-row">
        <strong>AI confidence</strong>
        <strong>${conflict.confidence}%</strong>
      </div>
      <div class="confidence-track">
        <div class="confidence-fill" style="width:${conflict.confidence}%"></div>
      </div>
    </div>

    <div class="detail-grid">
      ${renderSourceCard("Official Knowledge", conflict.document, conflict.old_claim)}
      ${renderSourceCard("New Evidence", primaryEvidence, conflict.new_claim)}
    </div>

    ${
      secondaryEvidence.length
        ? `<div class="reasoning-card">
            <h3>Supporting Evidence</h3>
            ${secondaryEvidence.map((item) => `<p>${item.source}: ${item.title} - ${item.content}</p>`).join("")}
          </div>`
        : ""
    }

    <div class="reasoning-card">
      <h3>Recommended Update</h3>
      <p>${conflict.recommended_update}</p>
      <p><strong>Why it matters:</strong> ${conflict.business_impact}</p>
      <p><strong>Reasoning:</strong> ${conflict.reasoning}</p>
    </div>

    <div class="action-bar">
      <div>
        <strong>Owner: ${conflict.owner}</strong>
        <p class="muted">Human approval is required before Company Brain changes official knowledge.</p>
      </div>
      <div class="top-actions">
        <button class="danger-button" id="rejectButton" type="button" ${approved ? "disabled" : ""}>Reject</button>
        <button class="primary-button" id="approveButton" type="button" ${approved ? "disabled" : ""}>Approve Fix</button>
      </div>
    </div>
  `;

  $("approveButton")?.addEventListener("click", approveSelectedConflict);
  $("rejectButton")?.addEventListener("click", rejectSelectedConflict);
}

async function loadConflicts() {
  const result = await request(api.conflicts);
  conflicts = result.conflicts;
  renderConflictList();
  renderConflictDetail();
}

async function approveSelectedConflict() {
  await request(`/api/conflicts/${selectedConflictId}/approve`, {
    method: "POST",
    body: JSON.stringify({ reason: "Approved during hackathon demo review." }),
  });
  await refreshAll();
  location.hash = "#workflow";
}

async function rejectSelectedConflict() {
  await request(`/api/conflicts/${selectedConflictId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason: "Rejected during hackathon demo review." }),
  });
  await refreshAll();
}

async function loadWorkflows() {
  const result = await request(api.workflows);
  const workflows = result.workflows;
  $("workflowTimeline").innerHTML = workflows.length
    ? workflows
        .map(
          (item) => `
            <div class="timeline-item">
              <strong>${item.tool}</strong>
              <div>
                <h3>${item.title}</h3>
                <p>${item.description}</p>
              </div>
              ${badge(item.status)}
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">Approve a conflict to trigger simulated enterprise workflows.</div>`;
}

async function loadAuditLogs() {
  const result = await request(api.audit);
  const logs = result.audit_logs;
  $("auditLogs").innerHTML = logs.length
    ? logs
        .map(
          (item) => `
            <div class="audit-item">
              <strong>${formatTime(item.timestamp)}</strong>
              <div>
                <h3>${item.title}</h3>
                <p>${item.actor} ${item.action} this recommendation using ${item.evidence_count} evidence source(s).</p>
              </div>
              ${badge(item.action)}
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">No audit events yet.</div>`;
}

async function refreshAll() {
  await loadHealth();
  await loadConflicts();
  await loadWorkflows();
  await loadAuditLogs();
}

async function boot() {
  try {
    await request(api.health);
    $("apiStatus").textContent = "Live";
    $("apiStatus").className = "status-pill ok";
    await refreshAll();
  } catch (error) {
    $("apiStatus").textContent = "API Offline";
    $("apiStatus").className = "status-pill warn";
    $("conflictDetail").innerHTML = `<div class="empty-state">Start the backend server to load the demo.</div>`;
  }
}

$("resetButton").addEventListener("click", async () => {
  await request(api.reset, { method: "POST", body: "{}" });
  selectedConflictId = "conflict-auth-method";
  await refreshAll();
});

boot();
