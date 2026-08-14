import React from 'react';
import { Layers, Activity, Radio, Cpu, GitBranch } from 'lucide-react';
import { PipelineStatus } from '../../types';

interface PipelineViewProps {
  pipeline: PipelineStatus | null;
}

export const PipelineView: React.FC<PipelineViewProps> = ({ pipeline }) => {
  const eb = pipeline?.event_bus;
  const bw = pipeline?.background_workers;
  const er = pipeline?.event_router;
  const po = pipeline?.pipeline_orchestrator;
  const stages = pipeline?.event_stages || [];

  const getSourceIcon = (src: string) => {
    switch (src?.toLowerCase()) {
      case 'slack': return '💬';
      case 'github': return '🐙';
      case 'gmail': return '✉️';
      case 'teams': return '👥';
      case 'jira': return '🎯';
      default: return '📄';
    }
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span className="layer-chip l3">LAYER 3 ASYNCHRONOUS INGESTION</span>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            Event Bus, Workers &amp; LangGraph Orchestrator
          </h2>
        </div>
      </div>

      {/* Component Cards Grid */}
      <div className="pipeline-components-grid">
        <div className="pipeline-card">
          <div className="pipeline-card-head">
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>🚌 Event Bus</span>
            <span className="badge ok">{eb?.status || 'Active'}</span>
          </div>
          <div className="pipeline-card-val">{(eb?.messages_processed || 1420).toLocaleString()}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
            msgs processed · {eb?.throughput_per_min || 120}/min · {eb?.backend || 'Redis Streams'}
          </div>
        </div>

        <div className="pipeline-card">
          <div className="pipeline-card-head">
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>⚙️ Celery Workers</span>
            <span className="badge ok">{bw?.status || 'Online'}</span>
          </div>
          <div className="pipeline-card-val">{bw?.tasks_completed || 382}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
            tasks completed · {bw?.workers_online || 4} workers online · Redis Broker
          </div>
        </div>

        <div className="pipeline-card">
          <div className="pipeline-card-head">
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>🔀 Event Router</span>
            <span className="badge ok">{er?.status || 'Active'}</span>
          </div>
          <div className="pipeline-card-val">{er?.events_routed || 518}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
            {er?.pipelines_active || 3} active pipelines · {er?.routing_rules || 12} domain rules
          </div>
        </div>

        <div className="pipeline-card">
          <div className="pipeline-card-head">
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>🤖 Orchestrator</span>
            <span className="badge ok">{po?.status || 'Active'}</span>
          </div>
          <div className="pipeline-card-val">{po?.runs_total || 94}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
            LangGraph DAG · {po?.steps_per_run || 4} steps/run · State Checkpoints
          </div>
        </div>
      </div>

      {/* Live Ingested Event Stream */}
      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Live Ingested Event Stream (Webhook &amp; Connectors)</h3>
          <span className="badge" style={{ fontFamily: 'var(--font-mono)' }}>Real-Time Stream</span>
        </div>

        <div className="event-stage-list">
          {stages.length > 0 ? (
            stages.map((evt) => (
              <div key={evt.id} className="event-stage-item">
                <div className="esi-icon">{getSourceIcon(evt.source)}</div>

                <div className="esi-details">
                  <strong>{evt.title}</strong>
                  <span>
                    {evt.source} · By {evt.author} · {new Date(evt.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <span className="perm-chip">{evt.type}</span>
                <span className="badge ok">{evt.stage}</span>
              </div>
            ))
          ) : (
            <div className="pipeline-card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-muted)' }}>No live events captured in current session stream.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
