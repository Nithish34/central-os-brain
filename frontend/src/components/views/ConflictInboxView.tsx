/**
 * ConflictInboxView — "Needs Your Attention"  (route: /inbox)
 *
 * Changes from the original:
 *  - Title / header renamed: "Needs Your Attention"
 *  - Default list view: raw confidence scores (0.83, etc.) removed from
 *    primary row display; replaced with plain-language framing
 *    ("Two sources disagree", "This may be outdated")
 *  - Confidence/severity meter now uses ConfidenceMeter (gradient bar)
 *    instead of the same pill style used for binary connection states
 *  - Detail panel: one-sentence plain-language summary above the technical
 *    diff; existing side-by-side comparison collapsed under "See details"
 *  - Primary actions relabeled:
 *      "Approve & Execute Fix" → "Confirm this is correct"
 *      "Reject" → "This isn't right"
 *  - Freshness indicator per row ("Updated today" / "From 3 weeks ago")
 *  - Numeric confidence scores still accessible in the expanded detail view
 *  - All underlying API calls unchanged
 */

import './ConflictInboxView.view.css';
import React, { useState, useEffect } from 'react';
import {
  Brain,
  AlertTriangle,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  Shield,
  Inbox,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Conflict, KnowledgeHealth, RiskCheckResult } from '../../types';
import { apiService } from '../../services/api';
import { useToast } from '../ui/ToastContainer';
import { ConfidenceMeter } from '../ui/ConfidenceMeter';

interface ConflictInboxViewProps {
  conflicts: Conflict[];
  health: KnowledgeHealth | null;
  activeAgentsCount: number;
  onRefreshAll: () => void;
  onNavigateExecution: () => void;
}

/**
 * Returns a plain-language framing of why this conflict needs attention.
 */
function conflictSummary(c: Conflict): string {
  if (c.severity === 'critical') return 'Two sources strongly disagree — this needs urgent review.';
  if (c.severity === 'high') return 'Two sources disagree on an important topic.';
  if ((c.freshness_delta || 0) > 0.7) return 'This may be outdated — a newer source says something different.';
  return 'Sources are giving conflicting information.';
}

/**
 * Plain-language freshness label from a conflict's evidence timestamps.
 * Since the API shape doesn't always expose an explicit "updated_at" on the
 * conflict itself, we derive from evidence or fall back to a reasonable label.
 */
function freshnessLabel(c: Conflict): { text: string; stale: boolean } {
  const primary = c.evidence?.[0];
  if (!primary?.timestamp) return { text: 'Age unknown', stale: false };
  const ageMs = Date.now() - Date.parse(primary.timestamp);
  const ageDays = Math.floor(ageMs / 86_400_000);
  if (ageDays === 0) return { text: 'Updated today', stale: false };
  if (ageDays === 1) return { text: 'Updated yesterday', stale: false };
  if (ageDays < 7) return { text: `${ageDays} days ago`, stale: false };
  const weeks = Math.floor(ageDays / 7);
  return { text: `From ${weeks} week${weeks > 1 ? 's' : ''} ago`, stale: weeks >= 3 };
}

export const ConflictInboxView: React.FC<ConflictInboxViewProps> = ({
  conflicts,
  health,
  activeAgentsCount,
  onRefreshAll,
  onNavigateExecution,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    () => conflicts[0]?.id || 'conflict-auth-method'
  );
  const [riskData, setRiskData] = useState<RiskCheckResult | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const { showToast } = useToast();

  const selectedConflict = conflicts.find((c) => c.id === selectedId) || conflicts[0];

  useEffect(() => {
    if (selectedConflict) loadRiskCheck(selectedConflict.id);
  }, [selectedConflict?.id]);

  // Collapse technical details when switching conflicts
  useEffect(() => {
    setDetailsExpanded(false);
  }, [selectedId]);

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
      showToast(`✅ Confirmed — knowledge base updated.`, 'success');
      onRefreshAll();
      onNavigateExecution();
    } catch (err: any) {
      showToast(`Could not confirm: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedConflict || actionLoading) return;
    setActionLoading(true);
    try {
      await apiService.rejectConflict(selectedConflict.id);
      showToast(`Dismissed — no changes were made.`, 'warning');
      onRefreshAll();
    } catch (err: any) {
      showToast(`Could not dismiss: ${err.message}`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const primaryEvidence = selectedConflict?.evidence?.[0];
  const secondaryEvidence = selectedConflict?.evidence?.slice(1) || [];
  const isResolved =
    selectedConflict?.status === 'approved' || selectedConflict?.status === 'resolved';
  const isRejected = selectedConflict?.status === 'rejected';
  const openCount = conflicts.filter((c) => c.status === 'open').length;
  const dateline = new Date()
    .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    .toUpperCase();

  return (
    <div className="view-container ci-view">
      <header className="ci-page-header">
        <div className="ci-header-copy">
          <h1 className="ci-page-title">Needs Your Attention</h1>
          <p className="ci-page-sub">
            Our system found conflicting information across your connected tools. Review and decide
            what's correct.
          </p>
        </div>

        <div className="ci-header-aside">
          <span>{dateline}</span>
        </div>
      </header>

      {/* ── Summary metrics (plain-language labels) ── */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-wrap ci-icon-brand">
            <Brain size={22} />
          </div>
          <div className="metric-data">
            <label>Knowledge Health</label>
            <strong>{health ? `${health.knowledge_health}%` : '--%'}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap ci-icon-warn">
            <AlertTriangle size={22} />
          </div>
          <div className="metric-data">
            <label>Items to Review</label>
            <strong>{health ? health.open_conflicts : '--'}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap ci-icon-agent">
            <Bot size={22} />
          </div>
          <div className="metric-data">
            <label>Active Monitors</label>
            <strong>{activeAgentsCount || 2}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap ci-icon-ok">
            <Zap size={22} />
          </div>
          <div className="metric-data">
            <label>Automated Fixes Done</label>
            <strong>{health ? health.automated_workflows : '--'}</strong>
          </div>
        </div>
      </div>

      <div className="triage-grid">
        {/* ── Conflict List ── */}
        <div className="conflict-list-col">
          <div className="col-header">
            <div className="ci-col-title">
              <h3>Items Needing Review</h3>
            </div>
            <span className="badge open">{openCount} open</span>
          </div>

          <div className="conflict-cards-stack">
            {conflicts.length > 0 ? (
              conflicts.map((c, i) => {
                const fresh = freshnessLabel(c);
                return (
                  <div
                    key={c.id}
                    className={`conflict-card ${selectedId === c.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="conflict-card-head">
                      <div className="ci-card-heading">
                        <span className="ci-card-index">{String(i + 1).padStart(2, '0')}</span>
                        <h4>{c.title}</h4>
                      </div>
                      {/* Severity pill — binary status, uses existing badge class */}
                      <span className={`badge ${c.severity}`}>{c.severity.toUpperCase()}</span>
                    </div>

                    {/* Plain-language summary instead of raw score */}
                    <p className="conflict-card-body ci-plain-summary">{conflictSummary(c)}</p>

                    <div className="conflict-card-meta">
                      <span className={`badge ${c.status}`}>{c.status.toUpperCase()}</span>
                      {/* Freshness indicator — plain language */}
                      <span className={`ci-freshness-tag ${fresh.stale ? 'stale' : ''}`}>
                        {fresh.text}
                      </span>
                      {c.detected_by_agent && (
                        <span className="layer-chip l2">
                          {c.detected_by_agent.icon || '🤖'} {c.detected_by_agent.name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="ci-empty">
                <CheckCircle2 size={26} className="ci-empty-icon" />
                <span className="ci-empty-code">All clear</span>
                <p>Nothing needs your attention right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Conflict Detail Panel ── */}
        {selectedConflict ? (
          <article className="conflict-detail-panel anim-fade-in">
            {isResolved && (
              <div className="badge approved ci-banner">
                <CheckCircle2 size={16} />
                <span>
                  <strong>Confirmed & updated:</strong> Knowledge base and connected tools
                  have been synchronised.
                </span>
              </div>
            )}

            {isRejected && (
              <div className="badge rejected ci-banner">
                <XCircle size={16} />
                <span>
                  <strong>Dismissed:</strong> No changes were made.
                </span>
              </div>
            )}

            <div className="detail-head-row">
              <div className="ci-detail-title">
                <h2>{selectedConflict.title}</h2>
                <div className="ci-dateline">
                  <span>
                    Topic: <strong>{selectedConflict.domain}</strong>
                  </span>
                  <span className="ci-dateline-sep">/</span>
                  <span>
                    Owner: <strong>{selectedConflict.owner}</strong>
                  </span>
                </div>
              </div>
              <span className={`badge ${selectedConflict.severity} ci-detail-severity`}>
                {selectedConflict.severity.toUpperCase()}
              </span>
            </div>

            {/* ── Plain-language summary ── */}
            <div className="ci-plain-detail-summary">
              <p>
                {selectedConflict.old_claim && selectedConflict.new_claim
                  ? `One source says "${selectedConflict.old_claim}" — but another says "${selectedConflict.new_claim}". Which is correct?`
                  : conflictSummary(selectedConflict)}
              </p>
            </div>

            {/* ── Confidence meter (gradient, NOT a pill) ── */}
            <div className="ci-confidence-section">
              <ConfidenceMeter
                value={(selectedConflict.confidence || 85) / 100}
                label="How certain the system is that these sources conflict"
                size="md"
              />
            </div>

            {/* ── "See details" toggle — technical diff collapsed by default ── */}
            <button
              className="ci-details-toggle"
              onClick={() => setDetailsExpanded((v) => !v)}
              aria-expanded={detailsExpanded}
            >
              {detailsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{detailsExpanded ? 'Hide details' : 'See details'}</span>
            </button>

            {detailsExpanded && (
              <div className="ci-technical-details anim-fade-in">
                {/* Technical score breakdown (moved to expanded section) */}
                <div className="score-card">
                  <div className="score-card-head">
                    <span className="ci-score-label">Confidence breakdown</span>
                    <span className="ci-score-total">{selectedConflict.confidence}% Combined</span>
                  </div>
                  <div className="score-row-grid">
                    <div className="score-item">
                      <div className="score-item-labels">
                        <span>Contradiction Probability</span>
                        <strong>{Math.round((selectedConflict.contradiction_score || 0.88) * 100)}%</strong>
                      </div>
                      <div className="score-track">
                        <div
                          className="score-fill contradiction"
                          style={{ width: `${Math.round((selectedConflict.contradiction_score || 0.88) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="score-item">
                      <div className="score-item-labels">
                        <span>Freshness Delta (Age vs Evidence)</span>
                        <strong>{Math.round((selectedConflict.freshness_delta || 0.94) * 100)}%</strong>
                      </div>
                      <div className="score-track">
                        <div
                          className="score-fill freshness"
                          style={{ width: `${Math.round((selectedConflict.freshness_delta || 0.94) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="score-item">
                      <div className="score-item-labels">
                        <span>Authority Delta (Source Weight)</span>
                        <strong>{Math.round((selectedConflict.authority_delta || 0.85) * 100)}%</strong>
                      </div>
                      <div className="score-track">
                        <div
                          className="score-fill authority"
                          style={{ width: `${Math.round((selectedConflict.authority_delta || 0.85) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical side-by-side diff */}
                <div className="comparison-grid">
                  <div className="source-box official">
                    <div className="source-box-head">
                      <div className="ci-source-block">
                        <span className="ci-source-eyebrow">Source A · Older</span>
                        <h4>Official Document</h4>
                      </div>
                      <span className="badge">{selectedConflict.document?.source || 'Knowledge Base'}</span>
                    </div>
                    <div className="claim-quote">"{selectedConflict.old_claim}"</div>
                    <p className="ci-source-body">
                      {selectedConflict.document?.content ||
                        'Recorded in technical specifications.'}
                    </p>
                    <div className="source-meta-chips">
                      <span className="badge">Owner: {selectedConflict.document?.owner || selectedConflict.owner}</span>
                      <span className="badge">Status: Older</span>
                    </div>
                  </div>

                  <div className="source-box evidence">
                    <div className="source-box-head">
                      <div className="ci-source-block">
                        <span className="ci-source-eyebrow">Source B · Newer</span>
                        <h4>Live Evidence</h4>
                      </div>
                      <span className="badge ci-live-badge">{primaryEvidence?.source || 'Slack'}</span>
                    </div>
                    <div className="claim-quote">"{selectedConflict.new_claim}"</div>
                    <p className="ci-source-body">
                      {primaryEvidence?.content || 'Confirmed in a recent message.'}
                    </p>
                    <div className="source-meta-chips">
                      <span className="badge">By: {primaryEvidence?.author || 'Team member'}</span>
                      <span className="badge">Auth: {Math.round((primaryEvidence?.authority_score || 0.95) * 100)}%</span>
                      <span className="badge">Fresh: {Math.round((primaryEvidence?.freshness_score || 0.98) * 100)}%</span>
                    </div>
                  </div>
                </div>

                {secondaryEvidence.length > 0 && (
                  <div className="reasoning-card">
                    <h4>Additional supporting sources ({secondaryEvidence.length})</h4>
                    {secondaryEvidence.map((e) => (
                      <div key={e.id} className="ci-evidence-line">
                        <span className="ci-evidence-src">{e.source}</span>
                        <p>
                          <strong>{e.title}:</strong> {e.content}{' '}
                          <span className="ci-evidence-author">by {e.author}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI recommendation */}
            <div className="patch-card">
              <h4>Suggested update</h4>
              <p>{selectedConflict.recommended_update}</p>
            </div>

            {/* Why it was flagged */}
            <div className="reasoning-card">
              <h4>Why this was flagged</h4>
              <p>
                {selectedConflict.reasoning ||
                  'Our system detected a contradiction between an older document and a recent update.'}
              </p>
              <p style={{ marginTop: '4px', color: 'var(--text-muted, #94a3b8)', fontSize: '13px' }}>
                Impact: {selectedConflict.business_impact}
              </p>
            </div>

            {/* Risk gate (if present — still relevant to non-technical users) */}
            {riskData && (
              <div className={`risk-gate-panel ${riskData.approved_to_proceed ? 'passed' : ''}`}>
                <div className="ci-gate-top">
                  <strong className="ci-gate-title">
                    <Shield size={14} color="#f59e0b" /> Safety check
                  </strong>
                </div>
                <div className="ci-gate-rules">
                  {riskData.rules.map((r, i) => (
                    <div key={i} className={`risk-rule-item ${r.passed ? 'ok' : 'fail'}`}>
                      {r.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      <span>{r.rule}</span>
                    </div>
                  ))}
                </div>
                <div className="ci-gate-foot">
                  Needs approval from: <strong>{riskData.required_approver}</strong>
                </div>
              </div>
            )}

            {/* ── Primary action bar — plain language labels ── */}
            <div className="action-bar-row">
              <div className="action-bar-info">
                <strong>Owner: {selectedConflict.owner}</strong>
                <p>
                  Confirming will update the knowledge base and connected tools automatically.
                </p>
              </div>

              <div className="action-bar-buttons">
                <button
                  className="btn btn-danger"
                  onClick={handleReject}
                  disabled={actionLoading || isResolved || isRejected}
                >
                  <XCircle size={14} />
                  <span>This isn't right</span>
                </button>

                <button
                  className="btn btn-success"
                  onClick={handleApprove}
                  disabled={actionLoading || isResolved || isRejected}
                >
                  <CheckCircle2 size={14} />
                  <span>{actionLoading ? 'Updating…' : 'Confirm this is correct'}</span>
                </button>
              </div>
            </div>
          </article>
        ) : (
          <div className="conflict-detail-panel ci-empty-detail">
            <div className="ci-empty">
              <Inbox size={26} className="ci-empty-icon" />
              <span className="ci-empty-code">Nothing selected</span>
              <p>Select an item on the left to review it.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
