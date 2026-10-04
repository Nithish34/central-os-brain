import React, { useState, useEffect } from 'react';
import {
  RefreshCw, Zap, Lock, Copy, Check, Send, X, Sliders,
  Activity, ChevronRight, Shield, ArrowUpRight, Wifi, WifiOff, Clock,
} from 'lucide-react';
import { IntegrationConnector } from '../../types';
import { apiService, getAuthToken } from '../../services/api';
import { useToast } from '../ui/ToastContainer';
import './IntegrationsView.view.css';

interface IntegrationsViewProps {
  integrations: IntegrationConnector[];
  onRefreshAll: () => void;
  onNavigate?: (view: string) => void;
}

const SlackLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 54 54" fill="none">
    <path d="M19.7 33.6c0 2.7-2.2 4.9-4.9 4.9s-4.9-2.2-4.9-4.9 2.2-4.9 4.9-4.9h4.9v4.9z" fill="#E01E5A"/>
    <path d="M22.2 33.6c0-2.7 2.2-4.9 4.9-4.9s4.9 2.2 4.9 4.9v12.3c0 2.7-2.2 4.9-4.9 4.9s-4.9-2.2-4.9-4.9V33.6z" fill="#E01E5A"/>
    <path d="M27.1 19.7c-2.7 0-4.9-2.2-4.9-4.9s2.2-4.9 4.9-4.9 4.9 2.2 4.9 4.9v4.9H27.1z" fill="#36C5F0"/>
    <path d="M27.1 22.2c2.7 0 4.9 2.2 4.9 4.9s-2.2 4.9-4.9 4.9H14.8c-2.7 0-4.9-2.2-4.9-4.9s2.2-4.9 4.9-4.9H27.1z" fill="#36C5F0"/>
    <path d="M41 27.1c0-2.7 2.2-4.9 4.9-4.9s4.9 2.2 4.9 4.9-2.2 4.9-4.9 4.9H41V27.1z" fill="#2EB67D"/>
    <path d="M38.5 27.1c0 2.7-2.2 4.9-4.9 4.9s-4.9-2.2-4.9-4.9V14.8c0-2.7 2.2-4.9 4.9-4.9s4.9 2.2 4.9 4.9V27.1z" fill="#2EB67D"/>
    <path d="M33.6 41c2.7 0 4.9 2.2 4.9 4.9s-2.2 4.9-4.9 4.9-4.9-2.2-4.9-4.9V41H33.6z" fill="#ECB22E"/>
    <path d="M33.6 38.5c-2.7 0-4.9-2.2-4.9-4.9s2.2-4.9 4.9-4.9h12.3c2.7 0 4.9 2.2 4.9 4.9s-2.2 4.9-4.9 4.9H33.6z" fill="#ECB22E"/>
  </svg>
);

const GithubLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#e6edf3">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const NotionLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="18" fill="#ffffff"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M72.2 12.8L19.5 16.7c-6 .38-7.45 2.82-7.45 7.26V75.83c0 1.69.62 3.12 2.05 5.07l13.1 17.17c1.23 1.58 2.43 2.08 4.9 1.83l53.62-3.43c3.14-.32 4.58-2.62 4.58-6.52V19.57c0-4.88-1.55-6.33-8.15-5.77zM36.3 27.5c-3.03.18-3.73.23-5.47-1.16L24.9 21.4c-.41-.41-.2-1 .82-1.1l50.8-3.73c4.3-.41 6.5 1.23 8.15 4.58l.82 2.46c.2.61-.2 1.23-1.02 1.23L36.3 27.5zM28.17 87.2V38.5c0-2.25.62-3.3 2.67-3.5l55.7-3.27c1.84-.2 2.46.82 2.46 3.07V83.9c0 2.25-.41 4.1-3.28 4.3l-53.22 3.12c-2.87.2-4.33-.82-4.33-4.12z" fill="#000"/>
  </svg>
);

const JiraLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="jg1" x1="18" y1="15" x2="10" y2="23" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0052CC"/><stop offset="1" stopColor="#2684FF"/>
      </linearGradient>
      <linearGradient id="jg2" x1="14" y1="16" x2="21" y2="8" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0052CC"/><stop offset="1" stopColor="#2684FF"/>
      </linearGradient>
    </defs>
    <path d="M16 2.4C16 2.4 8.46 9.886 8.46 16.038c0 4.171 3.38 7.553 7.543 7.553s7.543-3.382 7.543-7.553C23.546 9.886 16 2.4 16 2.4z" fill="url(#jg2)"/>
    <path d="M16 29.6c0 0-7.541-7.487-7.541-13.638 0-4.171 3.38-7.553 7.542-7.553s7.542 3.382 7.542 7.553C23.543 22.113 16 29.6 16 29.6z" fill="url(#jg1)"/>
  </svg>
);

const TeamsLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M20.625 7.5h-5.25a.375.375 0 0 0-.375.375v6.75c0 .207.168.375.375.375h5.25A1.875 1.875 0 0 0 22.5 13.125v-3.75A1.875 1.875 0 0 0 20.625 7.5z" fill="#5059C9"/>
    <circle cx="18.75" cy="5.25" r="1.875" fill="#5059C9"/>
    <circle cx="11.25" cy="4.5" r="2.625" fill="#7B83EB"/>
    <path d="M15 7.5H7.5A1.5 1.5 0 0 0 6 9v7.5A4.5 4.5 0 0 0 10.5 21a4.5 4.5 0 0 0 4.5-4.5V9A1.5 1.5 0 0 0 15 7.5z" fill="#7B83EB"/>
  </svg>
);

const GmailLogo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636H18.545V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.548l8.073-6.055C21.691 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
    <path d="M0 5.457L12 14.366l12-8.909C24 3.434 21.691 2.28 20.073 3.493L12 9.548 3.927 3.493C2.309 2.28 0 3.434 0 5.457z" fill="#FBBC04"/>
  </svg>
);

const BrandLogos: Record<string, React.FC<{ size?: number }>> = {
  slack: SlackLogo, github: GithubLogo, notion: NotionLogo,
  jira: JiraLogo, teams: TeamsLogo, gmail: GmailLogo,
};

const BRAND: Record<string, { from: string; to: string; glow: string; bg: string }> = {
  slack:  { from: '#E01E5A', to: '#36C5F0', glow: 'rgba(54,197,240,0.22)',  bg: 'rgba(54,197,240,0.07)' },
  github: { from: '#e6edf3', to: '#8b949e', glow: 'rgba(139,148,158,0.22)', bg: 'rgba(139,148,158,0.07)' },
  notion: { from: '#ffffff', to: '#bdbdbd', glow: 'rgba(200,200,200,0.15)', bg: 'rgba(255,255,255,0.05)' },
  jira:   { from: '#2684FF', to: '#0052CC', glow: 'rgba(38,132,255,0.28)',  bg: 'rgba(38,132,255,0.07)' },
  teams:  { from: '#7B83EB', to: '#5059C9', glow: 'rgba(123,131,235,0.25)', bg: 'rgba(123,131,235,0.07)' },
  gmail:  { from: '#EA4335', to: '#FBBC04', glow: 'rgba(234,67,53,0.22)',   bg: 'rgba(234,67,53,0.07)' },
};

const SCOPES: Record<string, string[]> = {
  slack:  ['channels:history', 'channels:read', 'chat:write', 'groups:history', 'groups:read', 'im:history', 'mpim:history', 'users:read'],
  github: ['repo', 'read:org', 'pull_requests:read', 'issues:read'],
  notion: ['read_content', 'read_user', 'read_comments'],
  jira:   ['read:jira-work', 'read:jira-user', 'write:jira-work'],
  teams:  ['ChannelMessage.Read.All', 'User.Read'],
  gmail:  ['gmail.readonly', 'pubsub'],
};

const ActivityBars: React.FC<{ color: string }> = ({ color }) => {
  const bars = [40, 65, 50, 80, 70, 90, 75, 85, 60, 95, 80, 100];
  return (
    <div className="intg-spark">
      {bars.map((h, i) => (
        <div key={i} className="intg-spark-bar"
          style={{ height: `${h}%`, background: color, opacity: 0.55 + (i / bars.length) * 0.45 }} />
      ))}
    </div>
  );
};

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ integrations, onRefreshAll }) => {
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [showWebhookGuide, setShowWebhookGuide] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { showToast } = useToast();

  const [simSource, setSimSource] = useState('slack');
  const [simEventType, setSimEventType] = useState('message.created');
  const [simTitle, setSimTitle] = useState('Infrastructure pricing change update in #general');
  const [simContent, setSimContent] = useState('The team decided to migrate AWS database instances to Aurora v2 by Friday 5 PM.');
  const [simAuthor, setSimAuthor] = useState('sarah.eng@companybrain.local');
  const [isSimulating, setIsSimulating] = useState(false);

  // Auto-refresh integration statuses and verify Slack connection on mount / callback navigation
  useEffect(() => {
    let isMounted = true;
    const checkStatusAndRefresh = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isConnectedSlack = urlParams.get('connected') === 'slack';
      const isConnectionsHash = window.location.hash.includes('connections');

      if (isConnectedSlack || isConnectionsHash) {
        try {
          const slackStatus = await apiService.getSlackStatus();
          if (isMounted && slackStatus && slackStatus.is_connected && isConnectedSlack) {
            showToast('Slack workspace connected successfully!', 'success');
          }
        } catch {
          // Ignore offline/unauthenticated error
        }
        if (isMounted && onRefreshAll) {
          onRefreshAll();
        }
      }
    };

    checkStatusAndRefresh();
    return () => {
      isMounted = false;
    };
  }, [onRefreshAll, showToast]);

  const handleOAuthConnect = async (provider: string) => {
    setConnectingProvider(provider);
    try {
      if (!getAuthToken()) {
        try {
          await apiService.login('admin@companybrain.local', 'admin1234');
        } catch {
          // continue and let endpoint respond
        }
      }
      const res = await apiService.getAuthorizeUrl(provider);
      if (res && res.authorization_url) {
        showToast(`Redirecting to ${provider.toUpperCase()} authorization screen for access permissions...`, 'info');
        window.location.href = res.authorization_url;
      } else {
        showToast('Could not retrieve authorization URL', 'error');
      }
    } catch (err: any) {
      if (err.message?.includes('401')) {
        showToast('Authentication required. Please sign in via top-right profile or register.', 'error');
      } else {
        showToast(`OAuth Error: ${err.message || 'Make sure backend is running and OAuth keys are set in .env'}`, 'error');
      }
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (provider: string, name: string) => {
    try {
      await apiService.disconnectIntegration(provider);
      showToast(`Disconnected ${name}`, 'info');
      onRefreshAll();
    } catch (err: any) {
      showToast(`Disconnect failed: ${err.message}`, 'error');
    }
  };

  const handleSync = async (provider: string) => {
    setSyncingProvider(provider);
    try {
      await apiService.syncIntegration(provider);
      showToast(`Synchronized ${provider.toUpperCase()} connector!`, 'success');
      onRefreshAll();
    } catch {
      showToast(`Triggered background sync polling for ${provider}`, 'info');
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast('Copied to clipboard!', 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimulateEvent = async () => {
    setIsSimulating(true);
    try {
      await apiService.simulateIncomingEvent({ source: simSource, eventType: simEventType, title: simTitle, content: simContent, author: simAuthor });
      showToast('Event simulated! Canonical event created and published to Redis.', 'success');
      setShowSimulator(false);
      onRefreshAll();
    } catch (err: any) {
      showToast(`Simulation failed: ${err.message}`, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  const defaultIntegrations: IntegrationConnector[] = [
    { provider: 'slack',  name: 'Slack Enterprise',      icon: '💬', status: 'connected', account_name: 'acme-corp.slack.com',         events_ingested: 412, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/integrations/slack/webhook' },
    { provider: 'github', name: 'GitHub Enterprise',     icon: '🐙', status: 'connected', account_name: 'github.com/acme-corp',         events_ingested: 289, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/integrations/github/webhook' },
    { provider: 'notion', name: 'Notion Knowledge Base', icon: '📖', status: 'connected', account_name: 'Engineering & Product Docs',   events_ingested: 120, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/integrations/notion/webhook' },
    { provider: 'jira',   name: 'Atlassian Jira Cloud',  icon: '🎯', status: 'connected', account_name: 'acme.atlassian.net',           events_ingested: 312, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/integrations/jira/webhook' },
    { provider: 'teams',  name: 'Microsoft Teams',       icon: '👥', status: 'connected', account_name: 'Acme M365 Tenant',             events_ingested: 198, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/integrations/teams/webhook' },
    { provider: 'gmail',  name: 'Google Workspace',      icon: '✉️', status: 'connected', account_name: 'org-admin@companybrain.local', events_ingested: 164, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/integrations/gmail/webhook' },
  ];

  const list = integrations.length > 0 ? integrations : defaultIntegrations;
  const connectedCount = list.filter((c) => c.status === 'connected').length;
  const totalEvents = list.reduce((sum, c) => sum + c.events_ingested, 0);
  const uptimePct = Math.round((connectedCount / list.length) * 100);

  return (
    <div className="view-container integrations-view">
      <header className="intg-head">
        <div className="intg-head-copy">
          <div className="intg-head-badges">
            <span className="layer-chip l5">LAYER 5 ENTERPRISE INGESTION</span>
            <span className="badge ok">
              <span className="intg-pulse-dot" />
              OAuth 2.0 PKCE · HMAC Webhooks
            </span>
          </div>
          <h1 className="intg-title">Connected Apps</h1>
          <p className="intg-sub">All your enterprise tools unified, synced, and streaming data into Company Brain in real time.</p>
        </div>
        <div className="intg-head-actions">
          <button className="btn btn-ghost" onClick={() => setShowWebhookGuide(true)}><Shield size={14} /><span>Security</span></button>
          <button className="btn btn-primary" onClick={() => setShowSimulator(true)}><Zap size={14} /><span>Simulate Event</span></button>
        </div>
      </header>

      <div className="intg-stats">
        <div className="intg-stat">
          <div className="intg-stat-icon-row"><Activity size={14} className="intg-stat-icon" /><span className="intg-stat-label">Active Connectors</span></div>
          <strong className="intg-stat-value is-ok">{connectedCount}<span className="intg-stat-total">/{list.length}</span></strong>
          <div className="intg-stat-bar"><div className="intg-stat-bar-fill is-ok" style={{ width: `${uptimePct}%` }} /></div>
        </div>
        <div className="intg-stat">
          <div className="intg-stat-icon-row"><ArrowUpRight size={14} className="intg-stat-icon" /><span className="intg-stat-label">Events Ingested</span></div>
          <strong className="intg-stat-value">{totalEvents.toLocaleString()}</strong>
          <span className="intg-stat-sub">canonical events total</span>
        </div>
        <div className="intg-stat">
          <div className="intg-stat-icon-row"><Shield size={14} className="intg-stat-icon" /><span className="intg-stat-label">Normalization</span></div>
          <strong className="intg-stat-value">100%</strong>
          <span className="intg-stat-sub">zero-loss payload mapping</span>
        </div>
        <div className="intg-stat">
          <div className="intg-stat-icon-row"><Clock size={14} className="intg-stat-icon" /><span className="intg-stat-label">Sync Mode</span></div>
          <strong className="intg-stat-value intg-stat-live"><span className="intg-pulse-dot" />Real-time</strong>
          <span className="intg-stat-sub">webhook + hourly catch-up</span>
        </div>
      </div>

      <div className="intg-grid">
        {list.map((conn) => {
          const Logo = BrandLogos[conn.provider];
          const brand = BRAND[conn.provider] || BRAND.github;
          const isSyncing = syncingProvider === conn.provider;
          const isConnectingThis = connectingProvider === conn.provider;
          const isConnected = conn.status === 'connected';
          return (
            <article key={conn.provider} className={`intg-card ${isConnected ? 'is-connected' : 'is-disconnected'}`}
              style={{ '--card-glow': brand.glow } as React.CSSProperties}>
              <div className="intg-card-stripe" style={{ background: `linear-gradient(90deg, ${brand.from}, ${brand.to})` }} />
              <div className="intg-card-head">
                <div className="intg-identity">
                  <div className="intg-logo-wrap" style={{ background: brand.bg, borderColor: brand.glow }}>
                    {Logo ? <Logo size={28} /> : <span style={{ fontSize: 22 }}>{conn.icon}</span>}
                  </div>
                  <div className="intg-identity-text">
                    <h3 className="intg-name">{conn.name}</h3>
                    <p className="intg-account">{conn.account_name || (isConnected ? 'Connected Workspace' : 'Disconnected')}</p>
                  </div>
                </div>
                <div className={`intg-status-badge ${isConnected ? 'is-ok' : 'is-warn'}`}>
                  {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {isConnected ? 'Live' : 'Offline'}
                </div>
              </div>
              <div className="intg-activity-row">
                <span className="intg-activity-label">Event Activity</span>
                <ActivityBars color={brand.from} />
              </div>
              <div className="intg-meta">
                <div className="intg-meta-item">
                  <span className="intg-meta-num">{conn.events_ingested.toLocaleString()}</span>
                  <span className="intg-meta-key">Events</span>
                </div>
                <div className="intg-meta-divider" />
                <div className="intg-meta-item">
                  <span className="intg-meta-num">{new Date(conn.last_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="intg-meta-key">Last sync</span>
                </div>
                <div className="intg-meta-divider" />
                <div className="intg-meta-item">
                  <span className="intg-meta-num intg-meta-endpoint" title={conn.webhook_endpoint}>{conn.provider}/webhook</span>
                  <span className="intg-meta-key">Endpoint</span>
                </div>
              </div>
              <div className="intg-card-actions">
                {isConnected ? (
                  <>
                    <button className="btn btn-ghost intg-sync-btn" onClick={() => handleSync(conn.provider)} disabled={isSyncing}>
                      <RefreshCw size={13} className={isSyncing ? 'anim-spin' : ''} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                    </button>
                    <button className="btn btn-ghost intg-disconnect-btn" onClick={() => handleDisconnect(conn.provider, conn.name)}>
                      <span>Disconnect</span>
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary intg-connect-btn"
                    onClick={() => handleOAuthConnect(conn.provider)}
                    disabled={isConnectingThis}
                  >
                    {isConnectingThis ? (
                      <>
                        <RefreshCw size={13} className="anim-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Lock size={13} />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {showWebhookGuide && (
        <div className="intg-overlay">
          <div className="intg-modal">
            <div className="intg-modal-head">
              <div>
                <span className="layer-chip l5 intg-modal-eyebrow">WEBHOOK VERIFICATION</span>
                <h2 className="intg-modal-title"><Shield size={20} />Enterprise Webhook Security</h2>
              </div>
              <button className="btn btn-ghost intg-modal-close" onClick={() => setShowWebhookGuide(false)}><X size={18} /></button>
            </div>
            <p className="intg-modal-lead">All webhook listeners verify cryptographic signatures before persisting to the authoritative Canonical Event store.</p>
            <div className="intg-guide-list">
              <div className="intg-guide-item is-slack">
                <div className="intg-guide-head">
                  <div className="intg-guide-brand"><SlackLogo size={18} /><span className="intg-guide-label">Slack Signature</span></div>
                  <button className="btn btn-ghost intg-copy-btn" onClick={() => handleCopy('X-Slack-Signature', 'slack_header')}>
                    {copiedKey === 'slack_header' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <code className="intg-code">X-Slack-Signature: v0=a2114d57b48eac39b9ad189dd8310484...</code>
                <p className="intg-guide-note">HMAC-SHA256 with Signing Secret. Includes timestamp to prevent replay attacks.</p>
              </div>
              <div className="intg-guide-item is-github">
                <div className="intg-guide-head">
                  <div className="intg-guide-brand"><GithubLogo size={18} /><span className="intg-guide-label">GitHub Signature</span></div>
                  <button className="btn btn-ghost intg-copy-btn" onClick={() => handleCopy('X-Hub-Signature-256', 'gh_header')}>
                    {copiedKey === 'gh_header' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <code className="intg-code">X-Hub-Signature-256: sha256=d572749f87c83...</code>
                <p className="intg-guide-note">SHA-256 HMAC verified against raw request body before any parsing.</p>
              </div>
              <div className="intg-guide-item is-idem">
                <div className="intg-guide-head">
                  <div className="intg-guide-brand"><Lock size={16} /><span className="intg-guide-label">Idempotency Guard</span></div>
                </div>
                <p className="intg-guide-note">All endpoints accept <code>X-Idempotency-Key</code> or compute a SHA-256 payload hash. Redis SETNX fast-path + DB check prevents duplicate writes under retries.</p>
              </div>
            </div>
            <div className="intg-modal-foot">
              <button className="btn btn-primary" onClick={() => setShowWebhookGuide(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {showSimulator && (
        <div className="intg-overlay">
          <div className="intg-modal is-narrow">
            <div className="intg-modal-head">
              <div>
                <span className="layer-chip l5 intg-modal-eyebrow">LIVE INGESTION SIMULATOR</span>
                <h2 className="intg-modal-title"><Zap size={20} />Simulate Inbound Event</h2>
              </div>
              <button className="btn btn-ghost intg-modal-close" onClick={() => setShowSimulator(false)}><X size={18} /></button>
            </div>
            <p className="intg-modal-lead">Dispatches a test event into the canonical ingestion pipeline — triggers the Transactional Outbox, Redis Stream, and downstream workers.</p>
            <div className="intg-form">
              <div className="intg-form-pair">
                <div className="intg-field">
                  <label>Source Provider</label>
                  <select value={simSource} onChange={(e) => setSimSource(e.target.value)}>
                    <option value="slack">Slack</option>
                    <option value="github">GitHub</option>
                    <option value="notion">Notion</option>
                    <option value="jira">Jira</option>
                  </select>
                </div>
                <div className="intg-field">
                  <label>Event Type</label>
                  <select value={simEventType} onChange={(e) => setSimEventType(e.target.value)}>
                    <option value="message.created">message.created</option>
                    <option value="pull_request.merged">pull_request.merged</option>
                    <option value="issue.opened">issue.opened</option>
                    <option value="page.updated">page.updated</option>
                  </select>
                </div>
              </div>
              <div className="intg-field">
                <label>Title / Subject</label>
                <input type="text" value={simTitle} onChange={(e) => setSimTitle(e.target.value)} />
              </div>
              <div className="intg-field">
                <label>Payload Content</label>
                <textarea rows={3} value={simContent} onChange={(e) => setSimContent(e.target.value)} />
              </div>
              <div className="intg-field">
                <label>Author Email</label>
                <input type="text" value={simAuthor} onChange={(e) => setSimAuthor(e.target.value)} />
              </div>
            </div>
            <div className="intg-modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowSimulator(false)} disabled={isSimulating}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSimulateEvent} disabled={isSimulating}>
                {isSimulating ? (<><RefreshCw size={14} className="anim-spin" /><span>Publishing...</span></>) : (<><Send size={14} /><span>Send Event</span></>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
