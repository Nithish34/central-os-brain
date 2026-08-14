import React, { useState } from 'react';
import {
  Workflow,
  CheckCircle2,
  Clock,
  Zap,
  Shield,
  Activity,
  ArrowRight,
  Filter,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  GitPullRequest,
  MessageSquare,
  FileText,
  Layers,
  Database,
  Lock,
  Share2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WorkflowAction } from '../../types';
import { useToast } from '../ui/ToastContainer';

interface ExecutionViewProps {
  workflows: WorkflowAction[];
  onNavigateInbox: () => void;
}

interface ActionDetailItem {
  id: string;
  conflict_id: string;
  title: string;
  description: string;
  tool: string;
  status: string;
  created_at: string;
  layer: string;
  latency: string;
  approver: string;
  auditHash: string;
  diffSnippet: { removed: string; added: string };
  affectedTargets: { name: string; status: string; detail: string }[];
  payloadJson: Record<string, any>;
}

export const ExecutionView: React.FC<ExecutionViewProps> = ({ workflows, onNavigateInbox }) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const initialActionDetails: ActionDetailItem[] = [
    {
      id: 'ACT-9021',
      conflict_id: 'conf-01',
      title: 'Synchronized Webhook HMAC-SHA256 Authentication Specs',
      description: 'Patched official payments architecture documentation and dispatched synchronized updates across all engineering systems.',
      tool: 'Confluence',
      status: 'completed',
      created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      layer: 'Layer 0 Multi-System Dispatch',
      latency: '34 ms',
      approver: 'Sarah Jenkins (Platform Engineering Lead)',
      auditHash: '0x7f8a92b419c83de1a789ef201c4827bb459a11',
      diffSnippet: {
        removed: '- Auth: Static Bearer token in Authorization header',
        added: '+ Auth: HMAC-SHA256 signature in X-Signature header with rotating secret',
      },
      affectedTargets: [
        { name: 'Confluence Knowledge Base', status: 'SYNCHRONIZED', detail: 'Patched Payments Spec v2.1 (page-id: 84920)' },
        { name: 'Jira Software', status: 'TICKET_CREATED', detail: 'Created tracking issue DEV-842' },
        { name: 'Slack Messaging', status: 'BROADCAST_SENT', detail: 'Posted confirmation card in #engineering-core' },
        { name: 'GitHub Repositories', status: 'PR_SUBMITTED', detail: 'Opened documentation PR #492 on main' },
      ],
      payloadJson: {
        action_id: 'ACT-9021',
        event_type: 'self_healing.doc_patch.dispatched',
        latency_ms: 34,
        policy_gate_evaluated: 'RULE-03_PAYMENT_WEBHOOKS',
        approver_signoff: 'sarah.j@enterprise.com',
        audit_trail_recorded: true,
        targets_synced: 4,
      },
    },
    {
      id: 'ACT-9022',
      conflict_id: 'conf-02',
      title: 'Updated Database Replication Failover Tolerance to 120ms',
      description: 'Dispatched PostgreSQL cluster failover tolerance update to match EU compliance regulations merged in PR #482.',
      tool: 'GitHub',
      status: 'completed',
      created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      layer: 'Layer 0 Multi-System Dispatch',
      latency: '42 ms',
      approver: 'Marcus Vance (Principal Systems Architect)',
      auditHash: '0x93bc842918df9302ba74819cae90184b23891c',
      diffSnippet: {
        removed: '- Replica lag alert threshold: 500ms',
        added: '+ Replica lag alert threshold: 120ms (EU compliance SLA strict)',
      },
      affectedTargets: [
        { name: 'GitHub Wiki Runbooks', status: 'SYNCHRONIZED', detail: 'Updated postgres-ha-runbook.md' },
        { name: 'Datadog Monitors', status: 'MONITOR_UPDATED', detail: 'Synced threshold alert #204' },
        { name: 'Slack SRE Channel', status: 'BROADCAST_SENT', detail: 'Notified on-call squad in #sre-alerts' },
      ],
      payloadJson: {
        action_id: 'ACT-9022',
        event_type: 'self_healing.infra_runbook.dispatched',
        latency_ms: 42,
        policy_gate_evaluated: 'RULE-02_DATABASE_FAILOVER',
        approver_signoff: 'marcus.v@enterprise.com',
        audit_trail_recorded: true,
        targets_synced: 3,
      },
    },
    {
      id: 'ACT-9023',
      conflict_id: 'conf-03',
      title: 'Dispatched Enterprise SSO OIDC OAuth 2.0 Policy Migration',
      description: 'Deprecated legacy SAML 1.1 certificates and updated company-wide security standards across portals.',
      tool: 'Security & Policy Engine',
      status: 'completed',
      created_at: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
      layer: 'Layer 0 Multi-System Dispatch',
      latency: '29 ms',
      approver: 'Elena Rostova (CISO)',
      auditHash: '0x49ca810398bb27183e9104719bbac7291038bc',
      diffSnippet: {
        removed: '- SSO Standard: Okta SAML 1.1 Federation',
        added: '+ SSO Standard: OIDC OAuth 2.0 with PKCE & Hardware MFA',
      },
      affectedTargets: [
        { name: 'Security Policy Portal', status: 'SYNCHRONIZED', detail: 'Updated standard sec-pol-08' },
        { name: 'Jira Security Board', status: 'TICKET_CREATED', detail: 'Created SEC-309 migration epic' },
        { name: 'Microsoft Teams IT Channel', status: 'BROADCAST_SENT', detail: 'Notified #it-sec-ops channel' },
      ],
      payloadJson: {
        action_id: 'ACT-9023',
        event_type: 'self_healing.security_policy.dispatched',
        latency_ms: 29,
        policy_gate_evaluated: 'RULE-01_AUTH_IAM_GUARD',
        approver_signoff: 'elena.r@enterprise.com',
        audit_trail_recorded: true,
        targets_synced: 3,
      },
    },
  ];

  const [actionsList, setActionsList] = useState<ActionDetailItem[]>(initialActionDetails);
  const [selectedActionId, setSelectedActionId] = useState<string>(initialActionDetails[0].id);

  const selectedAction = actionsList.find((a) => a.id === selectedActionId) || actionsList[0];

  const getToolIcon = (tool: string) => {
    switch (tool?.toLowerCase()) {
      case 'jira':
        return '🎯';
      case 'slack':
        return '💬';
      case 'github':
        return '🐙';
      case 'confluence':
      case 'knowledge base':
        return '📘';
      default:
        return '🛡️';
    }
  };

  const getToolColor = (tool: string) => {
    switch (tool?.toLowerCase()) {
      case 'jira':
        return '#3b82f6';
      case 'slack':
        return '#ec4899';
      case 'github':
        return '#60a5fa';
      case 'confluence':
      case 'knowledge base':
        return '#0ea5e9';
      default:
        return '#10b981';
    }
  };

  const filteredActions = actionsList.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.tool.toLowerCase().includes(selectedFilter.toLowerCase());
  });

  const triggerManualTest = () => {
    const newId = `ACT-${Math.floor(1000 + Math.random() * 9000)}`;
    const newAction: ActionDetailItem = {
      id: newId,
      conflict_id: 'conf-sim',
      title: 'Automated Rate-Limiting Policy Sync (Tier 1 API)',
      description: 'Updated rate limit headers from 1000 req/min to 2500 req/min across Gateway documentation & Jira.',
      tool: 'Confluence',
      status: 'completed',
      created_at: new Date().toISOString(),
      layer: 'Layer 0 Multi-System Dispatch',
      latency: '26 ms',
      approver: 'David Chen (VP Engineering)',
      auditHash: `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
      diffSnippet: {
        removed: '- Rate Limit: 1000 req/min per API Key',
        added: '+ Rate Limit: 2500 req/min per API Key (Tier 1 Standard)',
      },
      affectedTargets: [
        { name: 'Gateway Docs', status: 'SYNCHRONIZED', detail: 'Updated api-rate-limits.md' },
        { name: 'Jira Software', status: 'TICKET_CREATED', detail: 'Created DEV-991' },
        { name: 'Slack Alerts', status: 'BROADCAST_SENT', detail: 'Notified #engineering-core' },
      ],
      payloadJson: {
        action_id: newId,
        event_type: 'self_healing.gateway_limit.dispatched',
        latency_ms: 26,
        policy_gate_evaluated: 'RULE-04_RATE_LIMITS',
        approver_signoff: 'david.c@enterprise.com',
        audit_trail_recorded: true,
        targets_synced: 3,
      },
    };

    setActionsList([newAction, ...actionsList]);
    setSelectedActionId(newId);

    confetti({
      particleCount: 75,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#3b82f6', '#10b981', '#38bdf8', '#fbbf24'],
    });

    showToast(`⚡ Dispatched action ${newId} across 3 enterprise targets!`, 'success');
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(selectedAction.auditHash);
    setCopied(true);
    showToast('📋 Cryptographic audit hash copied to clipboard!', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="view-container anim-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span className="layer-chip l0">LAYER 0 MULTI-SYSTEM DISPATCH</span>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em' }}>
            Automated Actions &amp; Execution Timeline
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Live record of synchronized documentation patches, Jira tickets, Slack broadcasts, and GitHub PRs dispatched by Axiom OS.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={triggerManualTest}>
            <Zap size={15} />
            <span>Trigger Test Dispatch</span>
          </button>
          <button className="btn btn-ghost" onClick={onNavigateInbox}>
            <span>Review Open Issues</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Visual 4-Step Pipeline Bar ── */}
      <div className="execution-pipeline-bar anim-slide-up">
        <div className="pipeline-step-pill">
          <div className="pipeline-step-num">01</div>
          <div>
            <strong>Ingest Stream</strong>
            <span>Slack · GitHub · Teams</span>
          </div>
        </div>
        <span className="pipeline-arrow">➔</span>

        <div className="pipeline-step-pill">
          <div className="pipeline-step-num">02</div>
          <div>
            <strong>Cognitive Reasoning</strong>
            <span>pgvector + Neo4j Graph</span>
          </div>
        </div>
        <span className="pipeline-arrow">➔</span>

        <div className="pipeline-step-pill">
          <div className="pipeline-step-num">03</div>
          <div>
            <strong>Layer 0 Safety Gate</strong>
            <span>Lead Signoff Cleared</span>
          </div>
        </div>
        <span className="pipeline-arrow">➔</span>

        <div className="pipeline-step-pill active">
          <div className="pipeline-step-num">04</div>
          <div>
            <strong>Multi-System Dispatch</strong>
            <span>100% Deterministic Sync</span>
          </div>
        </div>
      </div>

      {/* ── 4 Clean Executive Metric KPI Cards ── */}
      <div className="intel-stats-grid anim-slide-up" style={{ marginTop: '16px', marginBottom: '20px' }}>
        <div className="intel-stat-card">
          <div className="intel-stat-head">
            <span>Total Actions Dispatched</span>
            <Zap size={16} color="#60a5fa" />
          </div>
          <div className="intel-stat-val" style={{ color: '#93c5fd' }}>
            {actionsList.length}
          </div>
          <div className="intel-stat-sub">
            Synchronized across all targets
          </div>
        </div>

        <div className="intel-stat-card">
          <div className="intel-stat-head">
            <span>Dispatch Latency</span>
            <Activity size={16} color="#34d399" />
          </div>
          <div className="intel-stat-val" style={{ color: '#34d399' }}>
            34 ms
          </div>
          <div className="intel-stat-sub">
            High-throughput event bus
          </div>
        </div>

        <div className="intel-stat-card">
          <div className="intel-stat-head">
            <span>Layer 0 Safety Compliance</span>
            <Shield size={16} color="#fbbf24" />
          </div>
          <div className="intel-stat-val" style={{ color: '#fbbf24' }}>
            100%
          </div>
          <div className="intel-stat-sub">
            All policy gates cleared
          </div>
        </div>

        <div className="intel-stat-card">
          <div className="intel-stat-head">
            <span>Connected Targets</span>
            <CheckCircle2 size={16} color="#a78bfa" />
          </div>
          <div className="intel-stat-val" style={{ color: '#c4b5fd' }}>
            5
          </div>
          <div className="intel-stat-sub">
            Jira · Slack · GitHub · Docs
          </div>
        </div>
      </div>

      {/* ── Split Master-Detail Layout ── */}
      <div className="execution-master-grid">
        {/* Left Column: Actions Feed */}
        <div className="execution-feed-col">
          {/* Target Filters */}
          <div className="feed-filter-bar">
            {[
              { id: 'all', label: 'All Actions' },
              { id: 'confluence', label: '📘 Docs' },
              { id: 'github', label: '🐙 GitHub' },
              { id: 'security', label: '🛡️ Security' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`btn btn-sm ${selectedFilter === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedFilter(tab.id)}
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="execution-actions-stack">
            {filteredActions.map((action) => {
              const isSelected = selectedActionId === action.id;
              return (
                <div
                  key={action.id}
                  className={`execution-card-item ${isSelected ? 'selected' : ''} anim-slide-up`}
                  onClick={() => setSelectedActionId(action.id)}
                >
                  <div className="exec-card-top">
                    <div className="exec-tool-tag" style={{ color: getToolColor(action.tool) }}>
                      <span>{getToolIcon(action.tool)}</span>
                      <strong>{action.id}</strong>
                    </div>
                    <span className="exec-latency-badge">⚡ {action.latency}</span>
                  </div>

                  <strong className="exec-card-title">{action.title}</strong>
                  <p className="exec-card-desc">{action.description}</p>

                  <div className="exec-card-footer">
                    <span className="badge ok" style={{ fontSize: '9.5px' }}>
                      ✓ COMPLETED
                    </span>
                    <span className="exec-timestamp">
                      {new Date(action.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Execution Inspector & Live Telemetry Details */}
        <div className="execution-inspector-col">
          <div className="inspector-card anim-slide-up">
            <div className="inspector-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="mono" style={{ fontSize: '13px', color: '#93c5fd', fontWeight: 700 }}>
                    {selectedAction.id}
                  </span>
                  <span className="badge ok" style={{ fontSize: '10px' }}>
                    100% DETERMINISTIC DISPATCH
                  </span>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, marginTop: '4px' }}>
                  {selectedAction.title}
                </h3>
              </div>
              <span className="inspector-latency-tag">⚡ {selectedAction.latency} Latency</span>
            </div>

            {/* Approver & Cryptographic Audit Ref */}
            <div className="inspector-meta-row">
              <div className="inspector-meta-item">
                <span>Authorized Domain Approver</span>
                <strong style={{ color: 'var(--text-main)' }}>{selectedAction.approver}</strong>
              </div>
              <div className="inspector-meta-item">
                <span>Cryptographic SHA-256 Audit Ref</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="mono" style={{ color: '#38bdf8', fontSize: '11px' }}>
                    {selectedAction.auditHash.substring(0, 18)}…
                  </span>
                  <button className="btn btn-ghost" onClick={handleCopyHash} style={{ padding: '2px 6px', height: 'auto' }}>
                    {copied ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Diff Preview */}
            <div className="inspector-section">
              <span className="inspector-section-label">Synchronized Documentation Diff:</span>
              <div className="sim-patch-box" style={{ marginTop: '6px' }}>
                <div className="sim-diff-line line-del">{selectedAction.diffSnippet.removed}</div>
                <div className="sim-diff-line line-add">{selectedAction.diffSnippet.added}</div>
              </div>
            </div>

            {/* Target Multi-System Dispatch Matrix */}
            <div className="inspector-section">
              <span className="inspector-section-label">Simultaneous Downstream Dispatch Targets:</span>
              <div className="targets-matrix-grid">
                {selectedAction.affectedTargets.map((target, tIdx) => (
                  <div key={tIdx} className="target-node-card">
                    <div className="target-node-top">
                      <CheckCircle2 size={14} color="#34d399" />
                      <strong>{target.name}</strong>
                    </div>
                    <span className="target-node-status">{target.status}</span>
                    <p className="target-node-detail">{target.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Live JSON Execution Telemetry */}
            <div className="inspector-section">
              <span className="inspector-section-label">Raw Dispatch Telemetry (JSON Payload):</span>
              <div className="terminal-code-block" style={{ marginTop: '6px' }}>
                <div className="code-line">
                  <span className="code-comment">// Verified Layer 0 Execution Output Payload</span>
                </div>
                <div className="code-line">
                  <span className="code-key">"status"</span>: <span className="code-val">"DISPATCH_CONFIRMED_200_OK"</span>,
                </div>
                <div className="code-line">
                  <span className="code-key">"telemetry"</span>: {JSON.stringify(selectedAction.payloadJson, null, 2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
