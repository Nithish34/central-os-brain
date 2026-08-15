import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Activity,
  Radio,
  Cpu,
  GitBranch,
  Search,
  Filter,
  MessageSquare,
  Mail,
  Github,
  Users,
  CheckCircle2,
  Zap,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Send,
  X,
  Sparkles,
} from 'lucide-react';
import { PipelineStatus } from '../../types';
import { apiService } from '../../services/api';
import { useToast } from '../ui/ToastContainer';

interface PipelineViewProps {
  pipeline: PipelineStatus | null;
  onRefreshAll?: () => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({ pipeline, onRefreshAll }) => {
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isAutoStreaming, setIsAutoStreaming] = useState<boolean>(false);
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);

  // Custom event form state
  const [customSource, setCustomSource] = useState<string>('slack');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customAuthor, setCustomAuthor] = useState<string>('');
  const [customContent, setCustomContent] = useState<string>('');

  const autoStreamTimerRef = useRef<any>(null);
  const { showToast } = useToast();

  const eb = pipeline?.event_bus;
  const bw = pipeline?.background_workers;
  const er = pipeline?.event_router;
  const po = pipeline?.pipeline_orchestrator;
  const stages = pipeline?.event_stages || [];

  // Auto-streaming effect
  useEffect(() => {
    if (isAutoStreaming) {
      autoStreamTimerRef.current = setInterval(async () => {
        const sources = ['slack', 'github', 'gmail', 'teams', 'jira'];
        const randomSource = sources[Math.floor(Math.random() * sources.length)];
        try {
          await apiService.simulateIncomingEvent({ source: randomSource });
          if (onRefreshAll) onRefreshAll();
        } catch {
          // ignore
        }
      }, 5000);
    } else {
      if (autoStreamTimerRef.current) {
        clearInterval(autoStreamTimerRef.current);
        autoStreamTimerRef.current = null;
      }
    }

    return () => {
      if (autoStreamTimerRef.current) {
        clearInterval(autoStreamTimerRef.current);
      }
    };
  }, [isAutoStreaming, onRefreshAll]);

  const handleSimulateEvent = async (source: string) => {
    setIsSimulating(true);
    try {
      const res = await apiService.simulateIncomingEvent({ source });
      showToast(`⚡ Real-time event ingested from ${source.toUpperCase()}!`, 'success');
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      showToast(`Simulation failed: ${err.message}`, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSendCustomEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customContent.trim()) {
      showToast('Please enter message content.', 'warning');
      return;
    }

    setIsSimulating(true);
    try {
      await apiService.simulateIncomingEvent({
        source: customSource,
        title: customTitle.trim() || `${customSource.toUpperCase()} message: ${customContent.slice(0, 30)}…`,
        content: customContent.trim(),
        author: customAuthor.trim() || 'Engineering Ops',
      });
      showToast(`🚀 Custom ${customSource.toUpperCase()} event successfully ingested and analyzed!`, 'success');
      setShowCustomModal(false);
      setCustomTitle('');
      setCustomAuthor('');
      setCustomContent('');
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      showToast(`Failed to ingest custom event: ${err.message}`, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

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
      {/* Header with Real-Time Simulator Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="layer-chip l3">LAYER 3 ASYNCHRONOUS INGESTION</span>
            <span className="badge ok" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px' }}>
              <span className="pulse-dot" style={{ width: '6px', height: '6px' }}></span>
              Real-Time Ingestion Active
            </span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em' }}>
            Event Bus, Workers &amp; Live Ingested Streams
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Real-time feed of messages, emails, commits, and tickets ingested across Slack, GitHub, Gmail, Teams, and Jira.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Auto-Stream Toggle */}
          <button
            className={`btn ${isAutoStreaming ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => {
              setIsAutoStreaming(!isAutoStreaming);
              showToast(
                !isAutoStreaming
                  ? '🟢 Live Auto-Streaming Started (events arrive every 5s)'
                  : '⏸️ Live Auto-Streaming Paused',
                !isAutoStreaming ? 'info' : 'warning'
              );
            }}
            title="Automatically ingest realistic events every 5 seconds"
          >
            {isAutoStreaming ? <Pause size={14} /> : <Play size={14} />}
            <span>{isAutoStreaming ? 'Pause Auto-Stream' : 'Auto-Stream Feed'}</span>
          </button>

          {/* Quick Simulate Dropdown Buttons */}
          <button
            className="btn btn-primary"
            onClick={() => handleSimulateEvent('slack')}
            disabled={isSimulating}
            title="Simulate an instant Slack message"
          >
            <Zap size={14} />
            <span>+ Slack</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => handleSimulateEvent('github')}
            disabled={isSimulating}
            title="Simulate an instant GitHub PR event"
          >
            <Zap size={14} />
            <span>+ GitHub</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => handleSimulateEvent('gmail')}
            disabled={isSimulating}
            title="Simulate an instant Gmail notification"
          >
            <Zap size={14} />
            <span>+ Mail</span>
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => setShowCustomModal(true)}
            title="Compose and send a custom ingested message"
          >
            <Plus size={14} />
            <span>Compose Event</span>
          </button>

          {onRefreshAll && (
            <button className="btn btn-ghost" onClick={onRefreshAll} title="Refresh Live Stream">
              <RefreshCw size={14} />
            </button>
          )}
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

      {/* Compose Custom Event Modal */}
      {showCustomModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
          <div className="modal-card anim-scale-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '12px', width: '90%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#60a5fa" /> Ingest Real-Time Operational Event
              </h3>
              <button className="btn btn-ghost" onClick={() => setShowCustomModal(false)} style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendCustomEvent} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Source Platform</label>
                <select
                  className="form-input"
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="slack">💬 Slack Channel</option>
                  <option value="github">🐙 GitHub Pull Request / Issue</option>
                  <option value="gmail">✉️ Gmail / Email Notification</option>
                  <option value="teams">👥 Microsoft Teams Chat</option>
                  <option value="jira">🎯 Jira Ticket</option>
                  <option value="notion">📖 Notion Knowledge Base</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Sender / Author</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Priya Raman (Platform Lead) or billing-ops@company.com"
                  value={customAuthor}
                  onChange={(e) => setCustomAuthor(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Subject / Event Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Payment Auth RFC Approved: Migrate to OAuth2"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Message Body / Decision Content *</label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="e.g., Decision confirmed today: All internal payment calls are migrating from JWT to OAuth2 client credentials. Support for JWT ends in September."
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCustomModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSimulating || !customContent.trim()}>
                  <Send size={13} />
                  <span>{isSimulating ? 'Ingesting…' : 'Ingest & Trigger Pipeline'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
