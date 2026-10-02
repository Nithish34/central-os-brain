import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Server,
  RefreshCw,
  AlertTriangle,
  Play,
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  Database,
  Radio,
  FileCode,
  Layers,
  X,
  ChevronRight,
  Shield,
  Zap,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../ui/ToastContainer';
import {
  CanonicalEventSummary,
  EventLifecycleDetail,
  DeadLetterItem,
  WorkerMetricsResponse,
  ReplayRequestPayload,
} from '../../types';
import { DataTable, ColumnDef } from '../ui/DataTable';
import { Drawer } from '../ui/Drawer';
import { StatusBadge } from '../ui/StatusBadge';
import { StatCard } from '../ui/StatCard';
import { CodeBlock } from '../ui/CodeBlock';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SearchInput } from '../ui/SearchInput';

export const OperationsView: React.FC = () => {
  const { showToast } = useToast();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'events' | 'metrics' | 'dlq'>('events');

  // Ledger state
  const [events, setEvents] = useState<CanonicalEventSummary[]>([]);
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);

  // Deep lifecycle drawer state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [lifecycleDetail, setLifecycleDetail] = useState<EventLifecycleDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Worker & Redis stream metrics state
  const [workerMetrics, setWorkerMetrics] = useState<WorkerMetricsResponse | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false);

  // Dead Letter Queue state
  const [deadLetters, setDeadLetters] = useState<DeadLetterItem[]>([]);
  const [isLoadingDlq, setIsLoadingDlq] = useState<boolean>(false);
  const [retryingDlqId, setRetryingDlqId] = useState<string | null>(null);

  // Historical Replay Modal state
  const [showReplayModal, setShowReplayModal] = useState<boolean>(false);
  const [replayReason, setReplayReason] = useState<string>('Disaster recovery / knowledge re-index');
  const [replayProvider, setReplayProvider] = useState<string>('');
  const [replayEventType, setReplayEventType] = useState<string>('');
  const [replayLimit, setReplayLimit] = useState<number>(500);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  // Load canonical events
  const loadEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const res = await apiService.getCanonicalEvents({
        provider: selectedProvider || undefined,
        event_type: selectedEventType || undefined,
        limit: 100,
        offset: 0,
      });
      setEvents(res.events || []);
      setTotalEvents(res.total || 0);
    } catch {
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [selectedProvider, selectedEventType]);

  // Load worker metrics
  const loadMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    try {
      const res = await apiService.getWorkerMetrics();
      setWorkerMetrics(res);
    } catch {
      setWorkerMetrics(null);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  // Load dead letters
  const loadDeadLetters = useCallback(async () => {
    setIsLoadingDlq(true);
    try {
      const res = await apiService.getDeadLetters({ limit: 50 });
      setDeadLetters(res || []);
    } catch {
      setDeadLetters([]);
    } finally {
      setIsLoadingDlq(false);
    }
  }, []);

  // Initial tab loading & auto-refresh
  useEffect(() => {
    if (activeTab === 'events') loadEvents();
    if (activeTab === 'metrics') loadMetrics();
    if (activeTab === 'dlq') loadDeadLetters();

    const timer = setInterval(() => {
      if (activeTab === 'events') loadEvents();
      if (activeTab === 'metrics') loadMetrics();
      if (activeTab === 'dlq') loadDeadLetters();
    }, 8000);
    return () => clearInterval(timer);
  }, [activeTab, loadEvents, loadMetrics, loadDeadLetters]);

  // Fetch full event lifecycle
  const handleInspectEvent = async (eventId: string) => {
    setSelectedEventId(eventId);
    setIsLoadingDetail(true);
    try {
      const detail = await apiService.getEventLifecycle(eventId);
      setLifecycleDetail(detail);
    } catch (err: any) {
      showToast(`Could not load event lifecycle: ${err.message}`, 'error');
      setSelectedEventId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Retry Dead Letter item
  const handleRetryDlq = async (dlqId: string) => {
    setRetryingDlqId(dlqId);
    try {
      const res = await apiService.retryDeadLetter(dlqId);
      showToast(`✅ ${res.message || 'Event re-queued successfully'}`, 'success');
      loadDeadLetters();
    } catch (err: any) {
      showToast(`Retry failed: ${err.message}`, 'error');
    } finally {
      setRetryingDlqId(null);
    }
  };

  // Trigger Historical Replay
  const handleExecuteReplay = async () => {
    if (!replayReason.trim()) {
      showToast('Please provide an audit reason for the replay.', 'warning');
      return;
    }
    setIsReplaying(true);
    try {
      const payload: ReplayRequestPayload = {
        reason: replayReason,
        provider: replayProvider || undefined,
        event_type: replayEventType || undefined,
        limit: replayLimit,
      };
      const res = await apiService.triggerReplay(payload);
      showToast(
        `🚀 Replay triggered! Run ID: ${res.run_id?.slice(0, 8)} (${res.events_replayed} events replayed)`,
        'success'
      );
      setShowReplayModal(false);
      loadEvents();
      loadMetrics();
    } catch (err: any) {
      showToast(`Replay execution failed: ${err.message}`, 'error');
    } finally {
      setIsReplaying(false);
    }
  };

  // Filter events by search query
  const filteredEvents = events.filter((ev) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ev.event_id?.toLowerCase().includes(q) ||
      ev.provider?.toLowerCase().includes(q) ||
      ev.event_type?.toLowerCase().includes(q) ||
      ev.actor?.toLowerCase().includes(q) ||
      ev.correlation_id?.toLowerCase().includes(q) ||
      ev.payload_preview?.toLowerCase().includes(q)
    );
  });

  // Table Columns for Events
  const eventColumns: ColumnDef<CanonicalEventSummary>[] = [
    {
      key: 'provider',
      header: 'Provider & Type',
      width: '240px',
      sortable: true,
      render: (item) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge
            variant={
              item.provider === 'slack'
                ? 'info'
                : item.provider === 'github'
                ? 'ai'
                : item.provider === 'notion'
                ? 'warning'
                : 'neutral'
            }
            size="sm"
          >
            {item.provider.toUpperCase()}
          </StatusBadge>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-main)' }}>
            {item.event_type}
          </span>
        </div>
      ),
    },
    {
      key: 'event_id',
      header: 'Event ID & Idempotency',
      sortable: true,
      render: (item) => (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#38bdf8' }}>
            {item.event_id.slice(0, 20)}...
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
            Key: {item.idempotency_key ? item.idempotency_key.slice(0, 16) : 'N/A'}...
          </div>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor & Source',
      width: '180px',
      render: (item) => (
        <div>
          <div style={{ fontWeight: 550, color: 'var(--text-main)' }}>{item.actor || 'system'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.source || 'webhook'}</div>
        </div>
      ),
    },
    {
      key: 'occurred_at',
      header: 'Occurred At',
      width: '180px',
      sortable: true,
      render: (item) => (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {new Date(item.occurred_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'correlation_id',
      header: 'Correlation ID',
      width: '140px',
      render: (item) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-dim)',
            background: 'var(--bg-inset)',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {item.correlation_id ? item.correlation_id.slice(0, 10) : 'none'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '90px',
      align: 'right',
      render: (item) => (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '4px 8px', fontSize: '12px', gap: '4px' }}
          onClick={(e) => {
            e.stopPropagation();
            handleInspectEvent(item.event_id);
          }}
        >
          <span>Inspect</span>
          <ChevronRight size={13} />
        </button>
      ),
    },
  ];

  return (
    <div className="view-container animate-fade-in">
      {/* Header Bar */}
      <div
        className="view-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <StatusBadge variant="l4" dot size="sm">
              PHASE 4 DATA PLATFORM
            </StatusBadge>
            <StatusBadge variant="success" size="sm">
              REDIS STREAMS + POSTGRES OUTBOX
            </StatusBadge>
          </div>
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity className="text-cyan" size={28} />
            Operations Console
          </h1>
          <p className="view-subtitle" style={{ maxWidth: '780px' }}>
            Event ledger, worker consumer groups, and stream observability.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (activeTab === 'events') loadEvents();
              if (activeTab === 'metrics') loadMetrics();
              if (activeTab === 'dlq') loadDeadLetters();
            }}
            title="Refresh current tab"
          >
            <RefreshCw
              size={14}
              className={isLoadingEvents || isLoadingMetrics || isLoadingDlq ? 'anim-spin' : ''}
            />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowReplayModal(true)}
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              border: 'none',
            }}
          >
            <Play size={14} />
            <span>Run Historical Replay</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <StatCard
          label="Canonical Events"
          value={totalEvents || events.length || 0}
          subtext="Authoritative PostgreSQL Ledger"
          icon={<Database size={20} />}
          accentColor="#06b6d4"
        />
        <StatCard
          label="Stream Delivery"
          value="Redis Streams"
          subtext="SKIP LOCKED Outbox Publisher"
          icon={<Radio size={20} />}
          accentColor="#3b82f6"
        />
        <StatCard
          label="Consumer Groups"
          value="3 Worker Pools"
          subtext="knowledge, workflow, audit"
          icon={<Server size={20} />}
          accentColor="#8b5cf6"
        />
        <StatCard
          label="Dead Letter Queue"
          value={deadLetters.length}
          subtext={deadLetters.length === 0 ? 'Zero unhandled failures' : 'Requires review/retry'}
          icon={<AlertTriangle size={20} />}
          accentColor={deadLetters.length > 0 ? '#ef4444' : '#10b981'}
        />
      </div>

      {/* Tabs Navigation */}
      <div className="filter-bar" style={{ marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          className={`filter-tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <Database size={15} />
          <span>Canonical Ledger ({events.length})</span>
        </button>
        <button
          type="button"
          className={`filter-tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          <Server size={15} />
          <span>Worker Pool &amp; Stream Lag</span>
        </button>
        <button
          type="button"
          className={`filter-tab ${activeTab === 'dlq' ? 'active' : ''}`}
          onClick={() => setActiveTab('dlq')}
        >
          <AlertTriangle size={15} />
          <span>Dead Letter Queue ({deadLetters.length})</span>
        </button>
      </div>

      {/* TAB 1: Canonical Events Ledger */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Filtering Bar */}
          <div
            className="surface-card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search event ID, provider, actor..."
            />

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Filter size={14} className="text-muted" />
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="input-select"
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                <option value="">All Providers</option>
                <option value="slack">Slack</option>
                <option value="github">GitHub</option>
                <option value="notion">Notion</option>
                <option value="jira">Jira</option>
                <option value="replay">Replay</option>
              </select>

              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="input-select"
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                <option value="">All Event Types</option>
                <option value="message.created">message.created</option>
                <option value="pull_request.merged">pull_request.merged</option>
                <option value="issue.opened">issue.opened</option>
                <option value="page.updated">page.updated</option>
              </select>
            </div>
          </div>

          {/* DataTable Component */}
          <DataTable<CanonicalEventSummary>
            columns={eventColumns}
            data={filteredEvents}
            keyExtractor={(item) => item.event_id}
            isLoading={isLoadingEvents}
            emptyMessage="No canonical events found"
            emptySubtext="Simulate events via Connected Apps or trigger historical replay."
            onRowClick={(item) => handleInspectEvent(item.event_id)}
            pageSize={15}
          />
        </div>
      )}

      {/* TAB 2: Worker Pool & Stream Metrics */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="surface-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Radio className="text-cyan" size={18} />
                  Redis Streams Partition &amp; Consumer Group Health
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Primary Stream Key: <code style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{workerMetrics?.stream || 'company_brain:events'}</code>
                </p>
              </div>
              <StatusBadge variant="success" dot size="md">
                Workers Online • Late-ACK Active
              </StatusBadge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {workerMetrics?.consumer_groups ? (
                Object.entries(workerMetrics.consumer_groups).map(([groupName, groupData]) => (
                  <div
                    key={groupName}
                    style={{
                      background: 'var(--bg-surface-sub)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '18px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <div style={{ fontWeight: 650, fontSize: '14px', fontFamily: 'var(--font-mono)', color: '#f1f5f9' }}>
                          {groupName}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {groupName === 'knowledge-workers'
                            ? 'Chunking, Vector Embeddings & Graph UPSERT'
                            : groupName === 'workflow-workers'
                            ? 'Conflict Detection & Automated Actions'
                            : 'Compliance Ledger & Immutable Audit'}
                        </div>
                      </div>
                      <StatusBadge variant={groupData.status === 'healthy' ? 'success' : 'warning'} size="sm">
                        {groupData.status}
                      </StatusBadge>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-inset)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pending Lag (PEL):</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: groupData.pending_messages > 0 ? '#f59e0b' : '#10b981' }}>
                        {groupData.pending_messages} msgs
                      </span>
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <StatusBadge variant="info" size="sm">ACK Mode: Late XACK</StatusBadge>
                      <StatusBadge variant="neutral" size="sm">Idempotency: Guaranteed</StatusBadge>
                      <StatusBadge variant="warning" size="sm">Max Retries: 3</StatusBadge>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ gridColumn: '1 / -1', padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Server size={28} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <p>Telemetry stream active...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Dead Letter Queue (DLQ) */}
      {activeTab === 'dlq' && (
        <div className="space-y-4">
          <div className="surface-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle className={deadLetters.length > 0 ? 'text-red' : 'text-green'} size={18} />
                Failed Consumer Executions (DLQ)
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Events that exhausted retry attempts. Inspect stack traces and trigger re-queues.
              </p>
            </div>
            <StatusBadge variant={deadLetters.length > 0 ? 'danger' : 'success'} dot size="md">
              {deadLetters.length} Unresolved Failures
            </StatusBadge>
          </div>

          <DataTable<DeadLetterItem>
            columns={[
              {
                key: 'dlq_id',
                header: 'DLQ ID & Event',
                render: (item) => (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#f87171' }}>
                      {(item.dlq_id || item.id)?.slice(0, 18)}...
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      Event: {item.event_id?.slice(0, 18)}...
                    </div>
                  </div>
                ),
              },
              {
                key: 'consumer_group',
                header: 'Consumer Group',
                render: (item) => (
                  <StatusBadge variant="ai" size="sm">
                    {item.consumer_group}
                  </StatusBadge>
                ),
              },
              {
                key: 'failure_reason',
                header: 'Failure Reason',
                render: (item) => (
                  <div style={{ maxWidth: '320px' }}>
                    <div style={{ fontWeight: 550, color: 'var(--text-main)', fontSize: '12px' }}>
                      {item.failure_reason}
                    </div>
                    {item.error_details && (
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.error_details}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'attempts',
                header: 'Attempts',
                width: '100px',
                render: (item) => (
                  <StatusBadge variant="warning" size="sm">
                    {item.attempts} retries
                  </StatusBadge>
                ),
              },
              {
                key: 'failed_at',
                header: 'Failed At',
                width: '140px',
                render: (item) => (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {new Date(item.failed_at).toLocaleTimeString()}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                width: '110px',
                align: 'right',
                render: (item) => (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '12px', gap: '4px' }}
                    onClick={() => handleRetryDlq(item.dlq_id || item.id || '')}
                    disabled={retryingDlqId === (item.dlq_id || item.id)}
                  >
                    <RotateCcw size={12} className={retryingDlqId === (item.dlq_id || item.id) ? 'anim-spin' : ''} />
                    <span>Retry</span>
                  </button>
                ),
              },
            ]}
            data={deadLetters}
            keyExtractor={(item) => item.dlq_id || item.id || ''}
            isLoading={isLoadingDlq}
            emptyMessage="All Consumer Groups Healthy"
            emptySubtext="No unhandled worker failures in Dead Letter storage."
          />
        </div>
      )}

      {/* Reusable Event Lifecycle Drawer */}
      <Drawer
        isOpen={Boolean(selectedEventId)}
        onClose={() => setSelectedEventId(null)}
        eyebrow={<StatusBadge variant="l4" size="sm">CANONICAL EVENT TRACE</StatusBadge>}
        title={selectedEventId ? `${selectedEventId.slice(0, 24)}...` : 'Event Inspector'}
        subtitle="Unified Transactional Outbox and Downstream Consumer DAG"
      >
        {isLoadingDetail ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="anim-spin" style={{ margin: '0 auto 12px' }} />
            <p>Fetching unified lifecycle trace...</p>
          </div>
        ) : lifecycleDetail ? (
          <div className="space-y-6">
            {/* Specification Panel */}
            <div className="surface-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 650, marginBottom: '12px', color: '#93c5fd' }}>
                Canonical Event Specification
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Provider:</span>
                  <p style={{ fontWeight: 600, textTransform: 'capitalize' }}>{lifecycleDetail.provider}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Event Type:</span>
                  <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{lifecycleDetail.event_type}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Occurred:</span>
                  <p>{new Date(lifecycleDetail.occurred_at).toLocaleString()}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Correlation ID:</span>
                  <p style={{ fontFamily: 'var(--font-mono)' }}>{lifecycleDetail.correlation_id || 'none'}</p>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Idempotency Key:</span>
                  <p style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', color: '#38bdf8' }}>
                    {lifecycleDetail.idempotency_key}
                  </p>
                </div>
              </div>
            </div>

            {/* Outbox Publishing State */}
            <div className="surface-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 650, marginBottom: '12px', color: '#67e8f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={16} />
                Transactional Outbox Publishing
              </h3>
              {lifecycleDetail.outbox && lifecycleDetail.outbox.length > 0 ? (
                lifecycleDetail.outbox.map((ob) => (
                  <div key={ob.outbox_id} style={{ background: 'var(--bg-inset)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <StatusBadge variant={ob.status === 'published' ? 'success' : ob.status === 'failed' ? 'danger' : 'warning'} size="sm">
                        Outbox: {ob.status}
                      </StatusBadge>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        Attempts: {ob.attempts}
                      </span>
                    </div>
                    {ob.published_at && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Published to Redis Stream at: {new Date(ob.published_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Directly processed.</p>
              )}
            </div>

            {/* Consumer Group State */}
            <div className="surface-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 650, marginBottom: '12px', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Server size={16} />
                Consumer Group Delivery &amp; State Tracking
              </h3>
              {lifecycleDetail.consumer_groups && lifecycleDetail.consumer_groups.length > 0 ? (
                <div className="space-y-2">
                  {lifecycleDetail.consumer_groups.map((cg) => (
                    <div
                      key={cg.state_id}
                      style={{
                        background: 'var(--bg-inset)',
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: `3px solid ${
                          cg.status === 'processed'
                            ? '#10b981'
                            : cg.status === 'failed' || cg.status === 'dead_letter'
                            ? '#ef4444'
                            : '#3b82f6'
                        }`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 650, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {cg.consumer_group}
                        </span>
                        <StatusBadge variant={cg.status === 'processed' ? 'success' : cg.status === 'processing' ? 'info' : 'danger'} size="sm">
                          {cg.status}
                        </StatusBadge>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
                        <span>Run ID: {cg.run_id ? cg.run_id.slice(0, 8) : 'default'}</span>
                        <span>Attempts: {cg.attempt_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No consumer state records yet.</p>
              )}
            </div>

            {/* Raw JSON CodeBlock */}
            <CodeBlock
              title="Canonical Event Payload (JSON)"
              code={lifecycleDetail.payload}
              maxHeight="240px"
              collapsible
            />
          </div>
        ) : null}
      </Drawer>

      {/* Historical Replay Modal Dialog */}
      <ConfirmDialog
        isOpen={showReplayModal}
        title="Execute Historical Event Replay"
        description="Re-executes historical canonical events against downstream consumers with an isolated run_id. Vector embeddings are updated deterministically via UPSERT."
        confirmLabel="Execute Replay"
        variant="primary"
        isLoading={isReplaying}
        onConfirm={handleExecuteReplay}
        onCancel={() => setShowReplayModal(false)}
      >
        <div className="space-y-3" style={{ marginTop: '10px' }}>
          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Audit Reason (Required for Compliance)
            </label>
            <input
              type="text"
              className="input-text"
              value={replayReason}
              onChange={(e) => setReplayReason(e.target.value)}
              placeholder="e.g. Q3 Knowledge Re-index"
              style={{ width: '100%', fontSize: '12.5px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Provider Filter
              </label>
              <select
                className="input-select"
                value={replayProvider}
                onChange={(e) => setReplayProvider(e.target.value)}
                style={{ width: '100%', fontSize: '12.5px' }}
              >
                <option value="">All Providers</option>
                <option value="slack">Slack Only</option>
                <option value="github">GitHub Only</option>
                <option value="notion">Notion Only</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Max Events Limit
              </label>
              <input
                type="number"
                className="input-text"
                value={replayLimit}
                onChange={(e) => setReplayLimit(Number(e.target.value))}
                max={5000}
                min={1}
                style={{ width: '100%', fontSize: '12.5px' }}
              />
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
};
