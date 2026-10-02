import './PipelineView.view.css';
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
    <div className="view-container anim-fade-in pl-view">
      {/* Header with Real-Time Simulator Action Buttons */}
      <header className="pl-header">
        <div className="pl-header-main">
          <div className="pl-eyebrow-row">
            <span className="layer-chip l3">LAYER 3 ASYNCHRONOUS INGESTION</span>
            <span className="badge ok pl-live-badge">
              <span className="pulse-dot"></span>
              Real-Time Ingestion Active
            </span>
          </div>
          <div className="pl-dateline">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · LIVE INGESTION BUS
          </div>
          <h1 className="pl-title">Live Ingestion Bus</h1>
          <p className="pl-subcopy">
            Real-time stream of inbound events across connected sources.
          </p>
        </div>

        {/* Action Controls */}
        <div className="pl-header-actions">
          <div className="pl-sim-cluster">
            <button
              className={`btn ${isAutoStreaming ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => {
                setIsAutoStreaming(!isAutoStreaming);
                showToast(!isAutoStreaming ? 'Live Auto-Streaming Started (events arrive every 5s)' : 'Auto-Streaming Paused', !isAutoStreaming ? 'info' : 'warning');
              }}
              title="Automatically ingest realistic events every 5 seconds"
            >
              {isAutoStreaming ? <Pause size={14} /> : <Play size={14} />}
              <span>{isAutoStreaming ? 'Pause Auto-Stream' : 'Auto-Stream Feed'}</span>
            </button>

            <button className="btn btn-primary" onClick={() => handleSimulateEvent('slack')} disabled={isSimulating} title="Simulate an instant Slack message">
              <Zap size={14} />
              <span>+ Slack</span>
            </button>

            <button className="btn btn-primary" onClick={() => handleSimulateEvent('github')} disabled={isSimulating} title="Simulate an instant GitHub PR event">
              <Zap size={14} />
              <span>+ GitHub</span>
            </button>

            <button className="btn btn-primary" onClick={() => handleSimulateEvent('gmail')} disabled={isSimulating} title="Simulate an instant Gmail notification">
              <Zap size={14} />
              <span>+ Mail</span>
            </button>

            <button className="btn btn-ghost" onClick={() => setShowCustomModal(true)} title="Compose and send a custom ingested message">
              <Plus size={14} />
              <span>Compose</span>
            </button>

            {onRefreshAll && (
              <button className="btn btn-ghost" onClick={onRefreshAll} title="Refresh Live Stream">
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Component Cards Grid */}
      <section className="pl-comp-grid" aria-label="Pipeline components">
        <div className="pl-comp c1">
          <div className="pl-comp-head">
            <span className="pl-comp-name">
              <Radio size={14} />
              Event Bus
            </span>
            <span className="badge ok">{eb?.status || 'Active'}</span>
          </div>
          <div className="pl-comp-val">{(eb?.messages_processed || 1420).toLocaleString()}</div>
          <div className="pl-comp-sub">
            msgs processed · {eb?.throughput_per_min || 120}/min · {eb?.backend || 'Redis Streams'}
          </div>
        </div>

        <div className="pl-comp c2">
          <div className="pl-comp-head">
            <span className="pl-comp-name">
              <Cpu size={14} />
              Celery Workers
            </span>
            <span className="badge ok">{bw?.status || 'Online'}</span>
          </div>
          <div className="pl-comp-val">{bw?.tasks_completed || 382}</div>
          <div className="pl-comp-sub">
            tasks completed · {bw?.workers_online || 4} workers online · Redis Broker
          </div>
        </div>

        <div className="pl-comp c3">
          <div className="pl-comp-head">
            <span className="pl-comp-name">
              <GitBranch size={14} />
              Event Router
            </span>
            <span className="badge ok">{er?.status || 'Active'}</span>
          </div>
          <div className="pl-comp-val">{stages.length} Ingested</div>
          <div className="pl-comp-sub">
            {er?.pipelines_active || 3} active pipelines · {er?.routing_rules || 12} domain rules
          </div>
        </div>

        <div className="pl-comp c4">
          <div className="pl-comp-head">
            <span className="pl-comp-name">
              <Activity size={14} />
              Orchestrator
            </span>
            <span className="badge ok">{po?.status || 'Active'}</span>
          </div>
          <div className="pl-comp-val">{po?.runs_total || 94}</div>
          <div className="pl-comp-sub">
            LangGraph DAG · {po?.steps_per_run || 4} steps/run · State Checkpoints
          </div>
        </div>
      </section>

      {/* Live Ingested Event Stream Header & Controls */}
      <section className="pl-stream" aria-label="Live event stream">
        <div className="pl-stream-head">
          <div>
            <span className="pl-section-eyebrow">Live Operational Feed</span>
            <h2 className="pl-section-title">Ingested Messages &amp; Events Stream</h2>
            <span className="pl-section-count">
              Showing {filteredStages.length} of {stages.length} live ingested operational events
            </span>
          </div>

          {/* Search Box */}
          <div className="pl-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search messages, authors, keywords…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Source Filter Tabs */}
        <div className="pl-filters">
          {[
            { id: 'all', label: 'All Sources', count: stages.length },
            { id: 'slack', label: 'Slack', count: sourceCounts['slack'] || 0 },
            { id: 'github', label: 'GitHub', count: sourceCounts['github'] || 0 },
            { id: 'gmail', label: 'Gmail / Mail', count: sourceCounts['gmail'] || 0 },
            { id: 'teams', label: 'Teams', count: sourceCounts['teams'] || 0 },
            { id: 'jira', label: 'Jira', count: sourceCounts['jira'] || 0 },
            { id: 'notion', label: 'Notion', count: sourceCounts['notion'] || 0 },
          ].map((tab) => (
            <button key={tab.id} className={`pl-filter ${selectedSource === tab.id ? 'active' : ''}`} onClick={() => setSelectedSource(tab.id)}>
              <span>{tab.label}</span>
              <span className="pl-filter-count">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Event List with Message Body Previews */}
        <div className="pl-list">
          {filteredStages.length > 0 ? (
            filteredStages.map((evt) => {
              const isExpanded = expandedEventId === evt.id;
              const accent = getSourceBadgeColor(evt.source);
              return (
                <article key={evt.id} className="pl-event anim-slide-up" onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}>
                  <div className="pl-event-icon">{getSourceIcon(evt.source)}</div>

                  <div className="pl-event-main">
                    <div className="pl-event-topline">
                      <span className="pl-source-chip" style={{ color: accent }}>
                        {evt.source?.toUpperCase()}
                      </span>
                      <h3 className="pl-event-title">{evt.title}</h3>
                    </div>

                    <div className="pl-event-meta">
                      <span className="pl-event-author">
                        Author <strong>{evt.author || 'System'}</strong>
                      </span>
                      <span className="pl-meta-time">
                        {new Date(evt.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="pl-meta-time">
                        {new Date(evt.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {evt.content && (
                      <div
                        className={`pl-content-preview ${isExpanded ? 'open' : ''}`}
                        style={{ borderLeftColor: accent }}
                      >
                        {evt.content}
                      </div>
                    )}
                    <span className="pl-expand-hint">{isExpanded ? 'Collapse preview' : 'Expand full content'}</span>
                  </div>

                  <div className="pl-event-side">
                    <span className="badge ok">{evt.stage?.toUpperCase() || 'PROCESSED'}</span>
                    <span className="pl-stage-chip">{evt.type?.replace(/_/g, ' ').toUpperCase() || 'EVENT'}</span>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="pl-empty">
              <div className="pl-empty-icon">
                <Radio size={22} />
              </div>
              <div className="pl-empty-title">
                {searchQuery ? `No messages match "${searchQuery}"` : `No live events for source "${selectedSource}"`}
              </div>
              <div className="pl-empty-sub">
                Try a different filter, clear the search, or simulate a new event to populate the live stream.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Compose Custom Event Modal */}
      {showCustomModal && (
        <div className="pl-modal-overlay">
          <div className="pl-modal anim-scale-in">
            <div className="pl-modal-head">
              <div>
                <span className="pl-modal-eyebrow">Ingestion Simulator</span>
                <h2 className="pl-modal-title">
                  <Sparkles size={18} />
                  Ingest Real-Time Operational Event
                </h2>
              </div>
              <button className="btn btn-ghost" onClick={() => setShowCustomModal(false)} aria-label="Close modal">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendCustomEvent} className="pl-form">
              <div className="pl-field">
                <label className="pl-field-label">Source Platform</label>
                <select className="pl-input" value={customSource} onChange={(e) => setCustomSource(e.target.value)}>
                  <option value="slack">Slack Channel</option>
                  <option value="github">GitHub Pull Request / Issue</option>
                  <option value="gmail">Gmail / Email Notification</option>
                  <option value="teams">Microsoft Teams Chat</option>
                  <option value="jira">Jira Ticket</option>
                  <option value="notion">Notion Knowledge Base</option>
                </select>
              </div>

              <div className="pl-field">
                <label className="pl-field-label">Sender / Author</label>
                <input
                  type="text"
                  className="pl-input"
                  placeholder="e.g., Priya Raman (Platform Lead) or billing-ops@company.com"
                  value={customAuthor}
                  onChange={(e) => setCustomAuthor(e.target.value)}
                />
              </div>

              <div className="pl-field">
                <label className="pl-field-label">Subject / Event Title</label>
                <input
                  type="text"
                  className="pl-input"
                  placeholder="e.g., Payment Auth RFC Approved: Migrate to OAuth2"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </div>

              <div className="pl-field">
                <label className="pl-field-label">Message Body / Decision Content *</label>
                <textarea
                  className="pl-input"
                  rows={4}
                  placeholder="e.g., Decision confirmed today: All internal payment calls are migrating from JWT to OAuth2 client credentials. Support for JWT ends in September."
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                  required
                />
              </div>

              <div className="pl-form-actions">
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
