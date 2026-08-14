import React, { useState } from 'react';
import { ShieldCheck, Search } from 'lucide-react';
import { AuditLog } from '../../types';

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

  return (
    <div className="view-container">
      {/* Header & Search */}
      <div className="audit-search-row">
        <div>
          <span className="layer-chip l1">ENTERPRISE GOVERNANCE</span>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            Immutable Decision Audit &amp; Compliance Log
          </h2>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Filter by keyword / actor…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '32px' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', opacity: 0.5 }} />
        </div>
      </div>

      <div className="audit-stack">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div key={log.id} className="audit-item-row anim-slide-up">
              <div className="audit-time-col">
                <strong>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
                <span>{new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>

              <div className="audit-body-col">
                <h4>{log.title}</h4>
                <p>
                  <strong>{log.actor}</strong> applied action <code style={{ color: '#60a5fa' }}>{log.action}</code> using {log.evidence_count} evidence source(s)
                  {log.risk_level ? ` · Risk: ${log.risk_level}` : ''}.
                </p>
              </div>

              <span className={`badge ${log.action === 'approved' ? 'approved' : log.action === 'rejected' ? 'rejected' : 'ok'}`}>
                {log.action.toUpperCase()}
              </span>
            </div>
          ))
        ) : (
          <div className="audit-item-row" style={{ padding: '40px', textAlign: 'center', display: 'grid', placeItems: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              {filterQuery ? 'No audit records match your query.' : 'No audit records logged yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
