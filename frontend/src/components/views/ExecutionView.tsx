import './ExecutionView.view.css';
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
    <div className="view-container anim-fade-in ex-view">
      {/* Header */}
      <header className="ex-header">
        <div className="ex-header-main">
          <div className="ex-eyebrow-row">
            <span className="layer-chip l0">LAYER 0 MULTI-SYSTEM DISPATCH</span>
            <span className="badge ok">
              <span className="pulse-dot"></span>
              Deterministic Sync Active
            </span>
          </div>
          <div className="ex-dateline">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · EXECUTION TIMELINE
          </div>
          <h1 className="ex-title">Execution Timeline</h1>
          <p className="ex-subcopy">
            Synchronized patches, tickets, and broadcasts dispatched across connected tools.
          </p>
        </div>
        <div className="ex-header-actions">
          <button className="btn btn-primary" onClick={triggerManualTest}>
            <Zap size={15} />
            <span>Trigger Test Dispatch</span>
          </button>
          <button className="btn btn-ghost" onClick={onNavigateInbox}>
            <span>Review Open Issues</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* ── Visual 4-Step Pipeline Bar ── */}
      <section className="ex-pipe-bar anim-slide-up" aria-label="Dispatch pipeline">
        <div className="ex-pipe-step">
          <div className="ex-pipe-num">01</div>
          <div className="ex-pipe-text">
            <strong>Ingest Stream</strong>
            <span>Slack · GitHub · Teams</span>
          </div>
        </div>
        <span className="ex-pipe-arrow">
          <ArrowRight size={16} />
        </span>

        <div className="ex-pipe-step">
          <div className="ex-pipe-num">02</div>
          <div className="ex-pipe-text">
            <strong>Cognitive Reasoning</strong>
            <span>pgvector + Neo4j Graph</span>
          </div>
        </div>
        <span className="ex-pipe-arrow">
          <ArrowRight size={16} />
        </span>

        <div className="ex-pipe-step">
          <div className="ex-pipe-num">03</div>
          <div className="ex-pipe-text">
            <strong>Layer 0 Safety Gate</strong>
            <span>Lead Signoff Cleared</span>
          </div>
        </div>
        <span className="ex-pipe-arrow">
          <ArrowRight size={16} />
        </span>

        <div className="ex-pipe-step active">
          <div className="ex-pipe-num">04</div>
          <div className="ex-pipe-text">
            <strong>Multi-System Dispatch</strong>
            <span>100% Deterministic Sync</span>
          </div>
        </div>
      </section>

      {/* ── 4 Executive Metric KPI Cards ── */}
      <section className="ex-kpi-row anim-slide-up" aria-label="Execution KPIs">
        <div className="ex-kpi k-blue">
          <div className="ex-kpi-head">
            <span className="ex-kpi-label">Total Actions Dispatched</span>
            <Zap size={16} color="#60a5fa" />
          </div>
          <div className="ex-kpi-val">{actionsList.length}</div>
          <div className="ex-kpi-sub">Synchronized across all targets</div>
        </div>

        <div className="ex-kpi k-green">
          <div className="ex-kpi-head">
            <span className="ex-kpi-label">Dispatch Latency</span>
            <Activity size={16} color="#34d399" />
          </div>
          <div className="ex-kpi-val">34 ms</div>
          <div className="ex-kpi-sub">High-throughput event bus</div>
        </div>

        <div className="ex-kpi k-amber">
          <div className="ex-kpi-head">
            <span className="ex-kpi-label">Layer 0 Safety Compliance</span>
            <Shield size={16} color="#fbbf24" />
          </div>
          <div className="ex-kpi-val">100%</div>
          <div className="ex-kpi-sub">All policy gates cleared</div>
        </div>

        <div className="ex-kpi k-purple">
          <div className="ex-kpi-head">
            <span className="ex-kpi-label">Connected Targets</span>
            <CheckCircle2 size={16} color="#a78bfa" />
          </div>
          <div className="ex-kpi-val">5</div>
          <div className="ex-kpi-sub">Jira · Slack · GitHub · Docs</div>
        </div>
      </section>

      {/* ── Split Master-Detail Layout ── */}
      <div className="ex-grid">
        {/* Left Column: Actions Feed */}
        <div className="ex-feed">
          <div className="ex-feed-panel">
            {/* Target Filters */}
            <div className="ex-filter-rail">
              {[
                { id: 'all', label: 'All Actions' },
                { id: 'confluence', label: 'Docs' },
                { id: 'github', label: 'GitHub' },
                { id: 'security', label: 'Security' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`ex-filter ${selectedFilter === tab.id ? 'active' : ''}`}
                  onClick={() => setSelectedFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="ex-actions">
              {filteredActions.map((action) => {
                const isSelected = selectedActionId === action.id;
                return (
                  <div
                    key={action.id}
                    className={`ex-card ${isSelected ? 'selected' : ''} anim-slide-up`}
                    onClick={() => setSelectedActionId(action.id)}
                  >
                    <div className="ex-card-top">
                      <div className="ex-card-id" style={{ color: getToolColor(action.tool) }}>
                        <span className="ex-tool-emoji">{getToolIcon(action.tool)}</span>
                        <span>{action.id}</span>
                      </div>
                      <span className="ex-latency">{action.latency}</span>
                    </div>

                    <strong className="ex-card-title">{action.title}</strong>
                    <p className="ex-card-desc">{action.description}</p>

                    <div className="ex-card-foot">
                      <span className="badge ok">COMPLETED</span>
                      <span className="ex-card-time">
                        {new Date(action.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Execution Inspector & Live Telemetry Details */}
        <div className="ex-inspector-col">
          <div className="ex-inspector anim-slide-up">
            <div className="ex-insp-head">
              <div>
                <div className="ex-insp-ids">
                  <span className="ex-insp-id">{selectedAction.id}</span>
                  <span className="badge ok">100% DETERMINISTIC DISPATCH</span>
                </div>
                <h2 className="ex-insp-title">{selectedAction.title}</h2>
              </div>
              <span className="ex-insp-latency">{selectedAction.latency} Latency</span>
            </div>

            {/* Approver & Cryptographic Audit Ref */}
            <div className="ex-meta-row">
              <div className="ex-meta-item">
                <span className="ex-meta-label">Authorized Domain Approver</span>
                <strong className="ex-meta-val">{selectedAction.approver}</strong>
              </div>
              <div className="ex-meta-item">
                <span className="ex-meta-label">Cryptographic SHA-256 Audit Ref</span>
                <div className="ex-hash-row">
                  <span className="ex-hash">{selectedAction.auditHash.substring(0, 18)}…</span>
                  <button className="btn btn-ghost ex-copy-btn" onClick={handleCopyHash} aria-label="Copy audit hash">
                    {copied ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Diff Preview */}
            <div className="ex-section">
              <span className="ex-section-label">Synchronized Documentation Diff</span>
              <div className="ex-diff">
                <div className="ex-diff-line del">{selectedAction.diffSnippet.removed}</div>
                <div className="ex-diff-line add">{selectedAction.diffSnippet.added}</div>
              </div>
            </div>

            {/* Target Multi-System Dispatch Matrix */}
            <div className="ex-section">
              <span className="ex-section-label">Simultaneous Downstream Dispatch Targets</span>
              <div className="ex-targets">
                {selectedAction.affectedTargets.map((target, tIdx) => (
                  <div key={tIdx} className="ex-target">
                    <div className="ex-target-top">
                      <CheckCircle2 size={14} />
                      <strong>{target.name}</strong>
                    </div>
                    <span className="ex-target-status">{target.status}</span>
                    <p className="ex-target-detail">{target.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Live JSON Execution Telemetry */}
            <div className="ex-section">
              <span className="ex-section-label">Raw Dispatch Telemetry (JSON Payload)</span>
              <pre className="ex-telemetry">
                <span className="ex-comment">{'// Verified Layer 0 Execution Output Payload\n'}</span>
                {'"status": "DISPATCH_CONFIRMED_200_OK",\n'}
                {'"telemetry": '}
                {JSON.stringify(selectedAction.payloadJson, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
