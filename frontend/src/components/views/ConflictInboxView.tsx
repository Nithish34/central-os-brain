import React, { useState, useEffect } from 'react';
import {
  Brain,
  AlertTriangle,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  FileText,
  MessageSquare,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Conflict, KnowledgeHealth, RiskCheckResult } from '../../types';
import { apiService } from '../../services/api';
import { useToast } from '../ui/ToastContainer';

interface ConflictInboxViewProps {
  conflicts: Conflict[];
  health: KnowledgeHealth | null;
  activeAgentsCount: number;
  onRefreshAll: () => void;
  onNavigateExecution: () => void;
}

export const ConflictInboxView: React.FC<ConflictInboxViewProps> = ({
  conflicts,
  health,
  activeAgentsCount,
  onRefreshAll,
  onNavigateExecution,
}) => {
  const [selectedId, setSelectedId] = useState<string>(() => conflicts[0]?.id || 'conflict-auth-method');
  const [riskData, setRiskData] = useState<RiskCheckResult | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { showToast } = useToast();

  const selectedConflict = conflicts.find((c) => c.id === selectedId) || conflicts[0];

  useEffect(() => {
    if (selectedConflict) {
      loadRiskCheck(selectedConflict.id);
    }
  }, [selectedConflict?.id]);

  const loadRiskCheck = async (id: string) => {
    try {
      const res = await apiService.getRiskCheck(id);
      setRiskData(res);
    } catch {
      setRiskData(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedConflict || actionLoading) return;
    setActionLoading(true);
    try {
      await apiService.approveConflict(selectedConflict.id);
      showToast(`✅ Approved '${selectedConflict.title}'! 5 Layer 0 workflows dispatched.`, 'success');
      onRefreshAll();
      onNavigateExecution();
    } catch (err: any) {
      showToast(`Approval failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedConflict || actionLoading) return;
    setActionLoading(true);
    try {
      await apiService.rejectConflict(selectedConflict.id);
      showToast(`❌ Rejected '${selectedConflict.title}'. No documentation changes applied.`, 'warning');
      onRefreshAll();
    } catch (err: any) {
      showToast(`Rejection failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const contrPct = Math.round((selectedConflict?.contradiction_score || 0.88) * 100);
  const freshPct = Math.round((selectedConflict?.freshness_delta || 0.94) * 100);
  const authPct = Math.round((selectedConflict?.authority_delta || 0.85) * 100);

  const primaryEvidence = selectedConflict?.evidence?.[0];
  const secondaryEvidence = selectedConflict?.evidence?.slice(1) || [];
  const isResolved = selectedConflict?.status === 'approved' || selectedConflict?.status === 'resolved';
  const isRejected = selectedConflict?.status === 'rejected';

  return (
    <div className="view-container">
      {/* ── Summary Metric Cards (CSS Grid) ── */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ color: '#3b82f6' }}>
            <Brain size={22} />
          </div>
          <div className="metric-data">
            <label>Knowledge Health</label>
            <strong>{health ? `${health.knowledge_health}%` : '--%'}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="metric-data">
            <label>Open Conflicts</label>
            <strong>{health ? health.open_conflicts : '--'}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ color: '#8b5cf6' }}>
            <Bot size={22} />
          </div>
          <div className="metric-data">
            <label>Active Agents</label>
            <strong>{activeAgentsCount || 2}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ color: '#10b981' }}>
            <Zap size={22} />
          </div>
          <div className="metric-data">
            <label>Automated Workflows</label>
            <strong>{health ? health.automated_workflows : '--'}</strong>
          </div>
        </div>
      </div>

      {/* ── Master-Detail Conflict Triage Grid ── */}
      <div className="triage-grid">
        {/* Left Column: Conflict Cards */}
        <div className="conflict-list-col">
          <div className="col-header">
            <h3>Detected Contradictions</h3>
            <span className="badge open" style={{ fontSize: '11px' }}>
              {conflicts.filter((c) => c.status === 'open').length} requiring review
            </span>
          </div>

          <div className="conflict-cards-stack">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className={`conflict-card ${selectedId === c.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="conflict-card-head">
                  <h4>{c.title}</h4>
                  <span className={`badge ${c.severity}`}>{c.severity.toUpperCase()}</span>
                </div>

                <p className="conflict-card-body">{c.business_impact}</p>

                <div className="conflict-card-meta">
                  <span className={`badge ${c.status}`}>{c.status.toUpperCase()}</span>
                  <span className="badge">{c.confidence}% conf.</span>
                  {c.detected_by_agent && (
                    <span className="layer-chip l2">
                      {c.detected_by_agent.icon || '🤖'} {c.detected_by_agent.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Conflict Detail */}
        {selectedConflict ? (
          <article className="conflict-detail-panel anim-fade-in">
            {isResolved && (
              <div
                className="badge approved"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', justifyContent: 'flex-start' }}
              >
                <CheckCircle2 size={16} />
                <span>
                  <strong>Approved &amp; Executed:</strong> 5 enterprise workflows synchronized across Jira, Slack, GitHub &amp; KB.
                </span>
              </div>
            )}

            {isRejected && (
              <div
                className="badge rejected"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', justifyContent: 'flex-start' }}
              >
                <XCircle size={16} />
                <span>
                  <strong>Rejected:</strong> Contradiction dismissed. Official documentation remains untouched.
                </span>
              </div>
            )}

            {/* Header Row */}
            <div className="detail-head-row">
              <div>
                <span className="layer-chip l2">LAYER 2 CONTRADICTION ENGINE</span>
                <h2>{selectedConflict.title}</h2>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span>Domain: <strong>{selectedConflict.domain}</strong></span>
                  <span>·</span>
                  <span>Owner: <strong>{selectedConflict.owner}</strong></span>
                  <span>·</span>
                  <span>Risk Level: <strong style={{ color: '#f87171' }}>{selectedConflict.risk_level || 'CRITICAL'}</strong></span>
                </div>
              </div>

              <span className={`badge ${selectedConflict.severity}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
                {selectedConflict.severity.toUpperCase()}
              </span>
            </div>

            {/* Multi-Agent Confidence Scores with Animated Gauge Fills */}
            <div className="score-card">
              <div className="score-card-head">
                <span style={{ fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🧠 Multi-Agent Confidence Gauge <span className="layer-chip l2">L2</span>
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#60a5fa' }}>
                  {selectedConflict.confidence}% Combined Score
                </span>
              </div>

              <div className="score-row-grid">
                <div className="score-item">
                  <div className="score-item-labels">
                    <span>Contradiction Probability</span>
                    <strong>{contrPct}%</strong>
                  </div>
                  <div className="score-track">
                    <div className="score-fill contradiction" style={{ width: `${contrPct}%` }}></div>
                  </div>
                </div>

                <div className="score-item">
                  <div className="score-item-labels">
                    <span>Freshness Delta (Age Stale vs Evidence)</span>
                    <strong>{freshPct}%</strong>
                  </div>
                  <div className="score-track">
                    <div className="score-fill freshness" style={{ width: `${freshPct}%` }}></div>
                  </div>
                </div>

                <div className="score-item">
                  <div className="score-item-labels">
                    <span>Authority Delta (Source Weight)</span>
                    <strong>{authPct}%</strong>
                  </div>
                  <div className="score-track">
                    <div className="score-fill authority" style={{ width: `${authPct}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Side-by-Side Comparison Grid */}
            <div className="comparison-grid">
              {/* Outdated Doc Card */}
              <div className="source-box official">
                <div className="source-box-head">
                  <h4>📋 Official Document (Outdated)</h4>
                  <span className="badge">{selectedConflict.document?.source || 'Knowledge Base'}</span>
                </div>
                <div className="claim-quote">"{selectedConflict.old_claim}"</div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                  {selectedConflict.document?.content || 'Recorded in payment architecture technical specifications.'}
                </p>
                <div className="source-meta-chips">
                  <span className="badge">Owner: {selectedConflict.document?.owner || selectedConflict.owner}</span>
                  <span className="badge">Author: {selectedConflict.document?.owner || 'Architecture Team'}</span>
                  <span className="badge">Status: Stale</span>
                </div>
              </div>

              {/* Live Operational Evidence Card */}
              <div className="source-box evidence">
                <div className="source-box-head">
                  <h4>⚡ Live Operational Evidence</h4>
                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
                    {primaryEvidence?.source || 'Slack'}
                  </span>
                </div>
                <div className="claim-quote">"{selectedConflict.new_claim}"</div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                  {primaryEvidence?.content || 'Engineers confirming migration in production channel.'}
                </p>
                <div className="source-meta-chips">
                  <span className="badge">By: {primaryEvidence?.author || 'Lead Engineer'}</span>
                  <span className="badge">Auth: {Math.round((primaryEvidence?.authority_score || 0.95) * 100)}%</span>
                  <span className="badge">Fresh: {Math.round((primaryEvidence?.freshness_score || 0.98) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Secondary Evidence */}
            {secondaryEvidence.length > 0 && (
              <div className="reasoning-card">
                <h4>📎 Supporting Secondary Evidence ({secondaryEvidence.length} additional sources)</h4>
                {secondaryEvidence.map((e) => (
                  <p key={e.id} style={{ fontSize: '12px', marginTop: '4px' }}>
                    <strong>[{e.source}] {e.title}:</strong> {e.content} (by {e.author})
                  </p>
                ))}
              </div>
            )}

            {/* AI-Recommended Patch Preview */}
            <div className="patch-card">
              <h4>✏️ AI-Synthesized Knowledge Base Patch</h4>
              <p>{selectedConflict.recommended_update}</p>
            </div>

            {/* Business Impact & Why Flagged */}
            <div className="reasoning-card">
              <h4>💼 Business Impact &amp; Multi-Agent Rationale</h4>
              <p><strong>Impact:</strong> {selectedConflict.business_impact}</p>
              <p style={{ marginTop: '4px' }}>
                <strong>Why Flagged:</strong> {selectedConflict.reasoning || 'Automated graph inspection detected contradiction between core spec and live engineering commit.'}
              </p>
            </div>

            {/* Layer 0 Pre-Approval Safety Gate */}
            {riskData && (
              <div className={`risk-gate-panel ${riskData.approved_to_proceed ? 'passed' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '12.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} color="#f59e0b" /> Layer 0 Pre-Approval Safety &amp; Policy Matrix
                  </strong>
                  <span className="layer-chip l0">L0 GATE</span>
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  {riskData.rules.map((r, i) => (
                    <div key={i} className={`risk-rule-item ${r.passed ? 'ok' : 'fail'}`}>
                      {r.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      <span>{r.rule}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                  Required Sign-Off: <strong>{riskData.required_approver}</strong> · Risk: <strong>{riskData.risk_level}</strong>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="action-bar-row">
              <div className="action-bar-info">
                <strong>Designated Approver: {selectedConflict.owner}</strong>
                <p>Human approval triggers automated Layer 0 sync across Knowledge Base, Jira, Slack, &amp; GitHub.</p>
              </div>

              <div className="action-bar-buttons">
                <button
                  className="btn btn-danger"
                  onClick={handleReject}
                  disabled={actionLoading || isResolved || isRejected}
                >
                  <XCircle size={14} />
                  <span>Reject</span>
                </button>

                <button
                  className="btn btn-success"
                  onClick={handleApprove}
                  disabled={actionLoading || isResolved || isRejected}
                >
                  <CheckCircle2 size={14} />
                  <span>{actionLoading ? 'Executing 5 Workflows…' : '✓ Approve & Execute Fix'}</span>
                </button>
              </div>
            </div>
          </article>
        ) : (
          <div className="conflict-detail-panel" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: 'var(--text-muted)' }}>Select a conflict on the left to inspect evidence and execute approvals.</p>
          </div>
        )}
      </div>
    </div>
  );
};
