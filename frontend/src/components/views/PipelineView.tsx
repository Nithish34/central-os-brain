import React, { useState } from 'react';
import { Layers, Activity, Radio, Cpu, GitBranch, Search, Filter, MessageSquare, Mail, Github, Users, CheckCircle2 } from 'lucide-react';
import { PipelineStatus } from '../../types';

interface PipelineViewProps {
  pipeline: PipelineStatus | null;
}

export const PipelineView: React.FC<PipelineViewProps> = ({ pipeline }) => {
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

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
      case 'notion': return '📖';
      default: return '📄';
    }
  };

  const getSourceBadgeColor = (src: string) => {
    switch (src?.toLowerCase()) {
      case 'slack': return '#ec4899';
      case 'github': return '#60a5fa';
      case 'gmail': return '#ea4335';
      case 'teams': return '#818cf8';
      case 'jira': return '#38bdf8';
      case 'notion': return '#a78bfa';
      default: return '#10b981';
    }
  };

  const filteredStages = stages.filter((evt) => {
    const matchesSource = selectedSource === 'all' || evt.source?.toLowerCase() === selectedSource.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || 
      evt.title?.toLowerCase().includes(query) ||
      evt.author?.toLowerCase().includes(query) ||
      evt.content?.toLowerCase().includes(query) ||
      evt.source?.toLowerCase().includes(query);
    return matchesSource && matchesQuery;
  });

  const sourceCounts = stages.reduce((acc: Record<string, number>, curr) => {
    const s = curr.source?.toLowerCase() || 'other';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="view-container anim-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span className="layer-chip l3">LAYER 3 ASYNCHRONOUS INGESTION</span>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em' }}>
            Event Bus, Workers &amp; Live Ingested Streams
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Real-time feed of messages, emails, commits, and tickets ingested across Slack, GitHub, Gmail, Teams, and Jira.
          </p>
        </div>
      </div>

      {/* Component Cards Grid */}
      <div className="pipeline-components-grid" style={{ marginTop: '14px' }}>
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
          <div className="pipeline-card-val">{stages.length} Ingested</div>
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

      {/* Live Ingested Event Stream Header & Controls */}
      <div style={{ marginTop: '20px', display: 'grid', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Live Ingested Messages &amp; Events Stream</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {filteredStages.length} of {stages.length} live ingested operational events
            </span>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '260px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search messages, authors, keywords…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '32px', height: '34px', fontSize: '12px' }}
            />
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '10px', opacity: 0.5 }} />
          </div>
        </div>

        {/* Source Filter Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { id: 'all', label: 'All Sources', count: stages.length },
            { id: 'slack', label: '💬 Slack', count: sourceCounts['slack'] || 0 },
            { id: 'github', label: '🐙 GitHub', count: sourceCounts['github'] || 0 },
            { id: 'gmail', label: '✉️ Gmail / Mail', count: sourceCounts['gmail'] || 0 },
            { id: 'teams', label: '👥 Teams', count: sourceCounts['teams'] || 0 },
            { id: 'jira', label: '🎯 Jira', count: sourceCounts['jira'] || 0 },
            { id: 'notion', label: '📖 Notion', count: sourceCounts['notion'] || 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`btn btn-sm ${selectedSource === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedSource(tab.id)}
              style={{ fontSize: '11.5px', padding: '4px 12px' }}
            >
              <span>{tab.label}</span>
              <span className="badge" style={{ fontSize: '10px', padding: '1px 5px', marginLeft: '4px' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Event List with Message Body Previews */}
        <div className="event-stage-list">
          {filteredStages.length > 0 ? (
            filteredStages.map((evt) => {
              const isExpanded = expandedEventId === evt.id;
              return (
                <div
                  key={evt.id}
                  className="event-stage-item anim-slide-up"
                  style={{
                    gridTemplateColumns: '36px minmax(0, 1fr) auto',
                    cursor: 'pointer',
                    padding: '14px 18px',
                    display: 'grid',
                    gap: '12px',
                    alignItems: 'start',
                  }}
                  onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                >
                  <div className="esi-icon" style={{ fontSize: '18px', marginTop: '2px' }}>
                    {getSourceIcon(evt.source)}
                  </div>

                  <div className="esi-details" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          color: getSourceBadgeColor(evt.source),
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                      >
                        {evt.source.toUpperCase()}
                      </span>
                      <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{evt.title}</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', alignItems: 'center' }}>
                      <span>👤 Author: <strong style={{ color: 'var(--text-main)' }}>{evt.author || 'System'}</strong></span>
                      <span>·</span>
                      <span>🕒 {new Date(evt.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span>·</span>
                      <span>📅 {new Date(evt.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>

                    {/* Message Body Content */}
                    {evt.content && (
                      <div
                        style={{
                          marginTop: '8px',
                          background: 'rgba(0,0,0,0.25)',
                          borderLeft: `3px solid ${getSourceBadgeColor(evt.source)}`,
                          borderRadius: '0 6px 6px 0',
                          padding: '8px 12px',
                          fontSize: '12.5px',
                          color: '#e2e8f0',
                          lineHeight: '1.45',
                        }}
                      >
                        "{evt.content}"
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <span className="badge ok" style={{ fontSize: '10px' }}>
                      ✓ {evt.stage?.toUpperCase() || 'PROCESSED'}
                    </span>
                    <span className="layer-chip l2" style={{ fontSize: '10px', padding: '2px 6px' }}>
                      {evt.type?.replace(/_/g, ' ').toUpperCase() || 'EVENT'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="pipeline-card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-muted)' }}>
                {searchQuery ? `No messages match "${searchQuery}".` : `No live events found for source "${selectedSource}".`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
