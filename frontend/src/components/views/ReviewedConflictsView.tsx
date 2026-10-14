import './ReviewedConflictsView.view.css';
import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ArrowRight,
  GitPullRequest,
  Clock,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  Inbox,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Conflict } from '../../types';

interface ReviewedConflictsViewProps {
  conflicts: Conflict[];
  onNavigateReview: () => void;
  onRefreshAll?: () => void;
}

// Fallback demo items to ensure the view looks lived-in and rich even before the user's first triage
const SEEDED_REVIEWED_ITEMS: Conflict[] = [
  {
    id: 'conf-resolved-01',
    title: 'Webhook HMAC-SHA256 Signature Specification',
    severity: 'high',
    domain: 'Platform Engineering',
    document_id: 'doc-payments',
    evidence_ids: ['evt-slack-webhook', 'evt-gh-pr-412'],
    old_claim: 'Webhooks utilize static Authorization header with Bearer token authentication.',
    new_claim: 'Webhooks migrated to HMAC-SHA256 signature in X-Signature header with rotating secret.',
    recommended_update: 'Update payments documentation to specify HMAC-SHA256 signature verification.',
    business_impact: 'Third-party webhook integrations failing due to credential mismatch.',
    owner: 'Platform Engineering Lead',
    status: 'approved',
    confidence: 96,
    contradiction_score: 0.94,
    target_repo: 'acme-corp/payment-service',
    target_file_path: 'docs/webhooks.md',
    recommended_diff:
      '--- a/docs/webhooks.md\n+++ b/docs/webhooks.md\n@@ -14,3 +14,3 @@\n-Auth: Static Bearer token in Authorization header\n+Auth: HMAC-SHA256 signature in X-Signature header with rotating secret',
    resolved_by: 'Sarah Jenkins (Platform Lead)',
    resolved_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: 'conf-resolved-02',
    title: 'Cache Cluster Infrastructure Drift: Redis 7.2',
    severity: 'high',
    domain: 'Infrastructure',
    document_id: 'doc-infra-cache',
    evidence_ids: ['evt-infra-announcement'],
    old_claim: 'Primary cache layer runs on Redis 6.2 standalone instances.',
    new_claim: 'Primary cache cluster migrated to Redis 7.2 cluster topology.',
    recommended_update: 'Update infrastructure manifest to document Redis 7.2 cluster topology.',
    business_impact: 'Operational tooling may fail due to incompatible cluster connection strings.',
    owner: 'Site Reliability Engineering',
    status: 'approved',
    confidence: 91,
    contradiction_score: 0.89,
    target_repo: 'acme-corp/infra-manifests',
    target_file_path: 'terraform/redis.tf',
    recommended_diff:
      '--- a/terraform/redis.tf\n+++ b/terraform/redis.tf\n@@ -8,2 +8,2 @@\n-engine_version = "6.2"\n+engine_version = "7.2"',
    resolved_by: 'Alex Rivera (Staff SRE)',
    resolved_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: 'conf-resolved-03',
    title: 'Deprecated JWT Auth in Staging Gateway',
    severity: 'medium',
    domain: 'Security & Auth',
    document_id: 'doc-auth-staging',
    evidence_ids: ['evt-sec-chat'],
    old_claim: 'Staging environment supports legacy JWT token fallback for internal test harnesses.',
    new_claim: 'All legacy JWT token fallback disabled; OAuth2 client credentials required.',
    recommended_update: 'Update staging setup instructions to remove JWT test fallback note.',
    business_impact: 'Dev test suites running against staging experience 401 unauthorized errors.',
    owner: 'Security Engineering',
    status: 'rejected',
    confidence: 84,
    contradiction_score: 0.81,
    target_repo: 'acme-corp/auth-service',
    target_file_path: 'README.md',
    recommended_diff: '',
    resolved_by: 'Marcus Vance (Security Director)',
    resolved_at: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
  },
];

function formatTimeAgo(iso?: string): string {
  if (!iso) return 'Recently';
  const ms = Date.now() - Date.parse(iso);
  if (isNaN(ms)) return 'Recently';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const ReviewedConflictsView: React.FC<ReviewedConflictsViewProps> = ({
  conflicts,
  onNavigateReview,
  onRefreshAll,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'score'>('newest');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['conf-resolved-01']));

  // Combine real reviewed conflicts from API with demo seeded history
  const reviewedItems: Conflict[] = useMemo(() => {
    const realReviewed = conflicts.filter((c) => {
      const s = (c.status || '').toLowerCase();
      return s === 'approved' || s === 'resolved' || s === 'rejected' || s === 'dismissed';
    });

    const realIds = new Set(realReviewed.map((r) => r.id));
    const supplemental = SEEDED_REVIEWED_ITEMS.filter((s) => !realIds.has(s.id));

    // Place real reviewed items at the very top
    return [...realReviewed, ...supplemental];
  }, [conflicts]);

  // Extract unique domains for dropdown
  const uniqueDomains = useMemo(() => {
    const set = new Set<string>();
    reviewedItems.forEach((c) => {
      if (c.domain) set.add(c.domain);
    });
    return Array.from(set).sort();
  }, [reviewedItems]);

  // Filter & Search logic
  const filteredItems = useMemo(() => {
    let list = reviewedItems;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => {
        return (
          c.title.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.domain || '').toLowerCase().includes(q) ||
          (c.owner || '').toLowerCase().includes(q) ||
          (c.old_claim || '').toLowerCase().includes(q) ||
          (c.new_claim || '').toLowerCase().includes(q) ||
          (c.target_repo || '').toLowerCase().includes(q) ||
          (c.target_file_path || '').toLowerCase().includes(q) ||
          (c.resolved_by || '').toLowerCase().includes(q)
        );
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((c) => {
        const s = (c.status || '').toLowerCase();
        if (statusFilter === 'approved') return s === 'approved' || s === 'resolved';
        if (statusFilter === 'rejected') return s === 'rejected' || s === 'dismissed';
        return true;
      });
    }

    // Severity filter
    if (severityFilter !== 'all') {
      list = list.filter((c) => (c.severity || '').toLowerCase() === severityFilter.toLowerCase());
    }

    // Domain filter
    if (domainFilter !== 'all') {
      list = list.filter((c) => c.domain === domainFilter);
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (sortBy === 'score') {
        return (b.contradiction_score || 0) - (a.contradiction_score || 0);
      }
      if (sortBy === 'oldest') {
        return (Date.parse(a.resolved_at || '0') || 0) - (Date.parse(b.resolved_at || '0') || 0);
      }
      // default: newest
      return (Date.parse(b.resolved_at || '0') || 0) - (Date.parse(a.resolved_at || '0') || 0);
    });
  }, [reviewedItems, searchQuery, statusFilter, severityFilter, domainFilter, sortBy]);

  // Aggregate stats
  const totalCount = reviewedItems.length;
  const approvedCount = reviewedItems.filter((c) => {
    const s = (c.status || '').toLowerCase();
    return s === 'approved' || s === 'resolved';
  }).length;
  const rejectedCount = totalCount - approvedCount;
  const openCount = conflicts.filter((c) => (c.status || '').toLowerCase() === 'open').length;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSeverityFilter('all');
    setDomainFilter('all');
    setSortBy('newest');
  };

  return (
    <div className="view-container reviewed-view">
      {/* ── Page Header ── */}
      <header className="reviewed-header">
        <div className="reviewed-header-copy">
          <div className="reviewed-eyebrow">
            <CheckCircle2 size={13} />
            <span>Decision & Triage History</span>
          </div>
          <h1 className="reviewed-title">Reviewed Conflicts</h1>
          <p className="reviewed-subtitle">
            Archive of verified organizational contradictions. Inspect applied Git patches,
            retained baselines, and human reviewer decisions across Slack, GitHub, Jira, and documentation.
          </p>
        </div>

        <div className="reviewed-header-actions">
          <button className="reviewed-jump-btn" onClick={onNavigateReview}>
            <Inbox size={15} />
            <span>Open Triage ({openCount} open)</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* ── Metrics Strip ── */}
      <div className="reviewed-metrics-strip">
        <div className="reviewed-metric-card">
          <div className="reviewed-metric-icon total">
            <Layers size={18} />
          </div>
          <div className="reviewed-metric-data">
            <label>Total Reviewed</label>
            <strong>{totalCount}</strong>
          </div>
        </div>

        <div className="reviewed-metric-card">
          <div className="reviewed-metric-icon approved">
            <CheckCircle2 size={18} />
          </div>
          <div className="reviewed-metric-data">
            <label>Approved & Applied</label>
            <strong>{approvedCount}</strong>
          </div>
        </div>

        <div className="reviewed-metric-card">
          <div className="reviewed-metric-icon rejected">
            <XCircle size={18} />
          </div>
          <div className="reviewed-metric-data">
            <label>Dismissed / Kept Baseline</label>
            <strong>{rejectedCount}</strong>
          </div>
        </div>

        <div className="reviewed-metric-card">
          <div className="reviewed-metric-icon sync">
            <Shield size={18} />
          </div>
          <div className="reviewed-metric-data">
            <label>Knowledge Sync Rate</label>
            <strong>{totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 100}%</strong>
          </div>
        </div>
      </div>

      {/* ── Controls: Search & Filters ── */}
      <div className="reviewed-controls">
        <div className="reviewed-search-row">
          <div className="reviewed-search-wrap">
            <Search size={16} className="reviewed-search-icon" />
            <input
              type="text"
              className="reviewed-search-input"
              placeholder="Search reviewed conflicts by title, domain, repo, file, or claim..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="reviewed-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="reviewed-filters-row">
          <div className="reviewed-filter-group">
            {/* Status Pills */}
            <div className="reviewed-status-pills">
              <button
                className={`reviewed-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({totalCount})
              </button>
              <button
                className={`reviewed-pill-btn approved ${statusFilter === 'approved' ? 'active approved' : ''}`}
                onClick={() => setStatusFilter('approved')}
              >
                Approved ({approvedCount})
              </button>
              <button
                className={`reviewed-pill-btn rejected ${statusFilter === 'rejected' ? 'active rejected' : ''}`}
                onClick={() => setStatusFilter('rejected')}
              >
                Dismissed ({rejectedCount})
              </button>
            </div>

            {/* Severity Filter */}
            <select
              className="reviewed-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Domain Filter */}
            {uniqueDomains.length > 0 && (
              <select
                className="reviewed-select"
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
              >
                <option value="all">All Domains</option>
                {uniqueDomains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Order */}
            <select
              className="reviewed-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="score">Sort: Highest Impact</option>
            </select>
          </div>

          <div className="reviewed-results-count">
            Showing {filteredItems.length} of {totalCount} records
          </div>
        </div>
      </div>

      {/* ── Conflict Cards List ── */}
      {filteredItems.length === 0 ? (
        <div className="reviewed-empty">
          <Inbox size={32} className="reviewed-empty-icon" />
          <h3>No matching reviewed conflicts</h3>
          <p>
            {searchQuery || statusFilter !== 'all' || severityFilter !== 'all'
              ? 'No conflicts match your active search and filter criteria. Try clearing filters.'
              : 'No conflicts have been approved or dismissed yet. Review open contradictions to populate history.'}
          </p>
          {searchQuery || statusFilter !== 'all' || severityFilter !== 'all' ? (
            <button className="reviewed-empty-action" onClick={handleResetFilters}>
              Reset Filters
            </button>
          ) : (
            <button className="reviewed-empty-action" onClick={onNavigateReview}>
              Go to Review Inbox
            </button>
          )}
        </div>
      ) : (
        <div className="reviewed-list">
          {filteredItems.map((c) => {
            const isApproved =
              (c.status || '').toLowerCase() === 'approved' ||
              (c.status || '').toLowerCase() === 'resolved';
            const isExpanded = expandedIds.has(c.id);
            const severity = (c.severity || 'medium').toLowerCase();
            const timeAgo = formatTimeAgo(c.resolved_at);

            return (
              <div key={c.id} className="reviewed-card">
                {/* Header row */}
                <div className="reviewed-card-header" onClick={() => toggleExpand(c.id)}>
                  <div className="reviewed-card-title-group">
                    <div className="reviewed-card-meta-top">
                      <span className={`reviewed-badge ${isApproved ? 'approved' : 'rejected'}`}>
                        {isApproved ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {isApproved ? 'Approved' : 'Dismissed'}
                      </span>
                      <span className={`reviewed-badge ${severity}`}>
                        {severity.toUpperCase()}
                      </span>
                      {c.domain && (
                        <span className="reviewed-target-repo">{c.domain}</span>
                      )}
                      {c.target_repo && (
                        <span className="reviewed-target-repo">
                          {c.target_repo}
                          {c.target_file_path ? `: ${c.target_file_path}` : ''}
                        </span>
                      )}
                    </div>
                    <h3 className="reviewed-card-title">{c.title}</h3>
                  </div>

                  <div className="reviewed-card-aside">
                    <span className="reviewed-timestamp">
                      <Clock size={12} />
                      {timeAgo}
                    </span>
                    <button
                      className={`reviewed-expand-btn ${isExpanded ? 'rotated' : ''}`}
                      aria-label="Toggle details"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="reviewed-card-details">
                    {/* Resolution Summary Banner */}
                    <div
                      className={`reviewed-resolution-callout ${isApproved ? 'approved' : 'rejected'}`}
                    >
                      {isApproved ? (
                        <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                      ) : (
                        <XCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                      )}
                      <div>
                        <strong>
                          {isApproved
                            ? 'Approved & Dispatched — Knowledge base updated'
                            : 'Dismissed — Discrepancy evaluated and retained baseline documentation'}
                        </strong>
                        <div style={{ marginTop: 2, opacity: 0.9 }}>
                          {isApproved
                            ? c.recommended_update ||
                              'The operational reality was verified and merged into official documentation.'
                            : 'Reviewer determined the detected event was informal or non-standard, keeping existing baseline.'}
                        </div>
                      </div>
                    </div>

                    {/* Claims Comparison */}
                    <div className="reviewed-claims-grid">
                      <div className="reviewed-claim-box">
                        <span className="reviewed-claim-label">Previous Baseline (Source A)</span>
                        <p className="reviewed-claim-text">{c.old_claim || 'N/A'}</p>
                      </div>

                      <div className="reviewed-claim-box">
                        <span className="reviewed-claim-label">
                          Operational Evidence (Source B)
                        </span>
                        <p className="reviewed-claim-text">{c.new_claim || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Unified Git Diff (if present) */}
                    {c.recommended_diff && (
                      <div className="reviewed-diff-wrap">
                        <div className="reviewed-diff-header">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <GitPullRequest size={13} />
                            Applied Unified Diff
                          </span>
                          <span>{c.target_file_path || 'spec.md'}</span>
                        </div>
                        <div className="reviewed-diff-code">
                          {c.recommended_diff.split('\n').map((line, idx) => {
                            let type = '';
                            if (line.startsWith('+')) type = 'add';
                            else if (line.startsWith('-')) type = 'del';
                            else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++'))
                              type = 'hdr';
                            return (
                              <span key={idx} className={`diff-line ${type}`}>
                                {line}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer / Provenance info */}
                    <div className="reviewed-card-footer">
                      <div className="reviewed-footer-left">
                        {c.resolved_by && (
                          <div className="reviewed-footer-item">
                            <span>Reviewed by:</span>
                            <strong style={{ color: '#e2e8f0' }}>{c.resolved_by}</strong>
                          </div>
                        )}
                        {c.owner && (
                          <div className="reviewed-footer-item">
                            <span>Domain Owner:</span>
                            <span>{c.owner}</span>
                          </div>
                        )}
                        {c.contradiction_score && (
                          <div className="reviewed-footer-item">
                            <span>Confidence:</span>
                            <span>{Math.round(c.contradiction_score * 100)}%</span>
                          </div>
                        )}
                      </div>

                      <div className="reviewed-footer-item">
                        <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.6 }}>
                          ID: {c.id}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
