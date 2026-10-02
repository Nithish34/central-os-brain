import React, { useState } from 'react';
import { ShieldCheck, Search } from 'lucide-react';
import { AuditLog } from '../../types';
import './AuditView.view.css';

interface AuditViewProps {
  auditLogs: AuditLog[];
}

export const AuditView: React.FC<AuditViewProps> = ({ auditLogs }) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(filterQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const latestTs =
    auditLogs.length > 0
      ? new Date(Math.max(...auditLogs.map((l) => new Date(l.timestamp).getTime())))
      : null;

  return (
    <div className="view-container audit-view">
      <header className="audit-head">
        <div className="audit-head-copy">
          <span className="audit-eyebrow">Security / Immutable Ledger</span>
          <h1 className="audit-title">Audit Log</h1>
          <p className="audit-sub">
            Append-only record of approvals, rejections, and policy actions.
          </p>
        </div>
        <div className="audit-head-tools">
          <label className="audit-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Filter by keyword / actor…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </label>
        </div>
      </header>

      <div className="audit-stats">
        <div className="audit-stat">
          <span className="audit-stat-label">Total Entries</span>
          <strong className="audit-stat-value">{auditLogs.length}</strong>
        </div>
        <div className="audit-stat">
          <span className="audit-stat-label">Matching Filter</span>
          <strong className="audit-stat-value">{filteredLogs.length}</strong>
        </div>
        <div className="audit-stat">
          <span className="audit-stat-label">Ledger Mode</span>
          <strong className="audit-stat-value is-ok">APPEND-ONLY</strong>
        </div>
        <div className="audit-stat">
          <span className="audit-stat-label">Latest Entry</span>
          <strong className="audit-stat-value is-mono">
            {latestTs
              ? latestTs.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'}
          </strong>
        </div>
      </div>

      <div className="audit-ledger">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <article className="audit-entry anim-slide-up" key={log.id}>
              <div className="audit-dateline">
                <span className="audit-dateline-time">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className="audit-dateline-date">
                  {new Date(log.timestamp).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="audit-dateline-id">{log.id}</span>
              </div>

              <div className="audit-entry-main">
                <div className="audit-entry-top">
                  <h4 className="audit-entry-title">{log.title}</h4>
                  <span
                    className={`badge ${log.action === 'approved' ? 'approved' : log.action === 'rejected' ? 'rejected' : 'ok'}`}
                  >
                    {log.action.toUpperCase()}
                  </span>
                </div>

                <div className="audit-entry-meta">
                  <span className="audit-meta-item">
                    <span className="audit-meta-key">Actor</span>
                    {log.actor}
                  </span>
                  <span className="audit-meta-item">
                    <span className="audit-meta-key">Action</span>
                    <code>{log.action}</code>
                  </span>
                  <span className="audit-meta-item">
                    <span className="audit-meta-key">Evidence</span>
                    {log.evidence_count} source{log.evidence_count === 1 ? '' : 's'}
                  </span>
                  {log.risk_level && (
                    <span className="audit-meta-item is-risk">
                      <span className="audit-meta-key">Risk</span>
                      {log.risk_level}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="audit-empty">
            <div className="audit-empty-icon">
              <ShieldCheck size={22} />
            </div>
            <span className="audit-empty-eyebrow">
              {filterQuery ? 'No Matching Records' : 'Ledger Empty'}
            </span>
            <h4 className="audit-empty-title">
              {filterQuery ? 'No audit records match your query.' : 'No audit records logged yet.'}
            </h4>
            <p className="audit-empty-sub">
              {filterQuery
                ? 'Try a different keyword, actor name, or action type.'
                : 'Signed decisions will appear here once workflows begin executing.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
