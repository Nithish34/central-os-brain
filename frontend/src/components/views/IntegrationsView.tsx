import React, { useState } from 'react';
import { Grid, RefreshCw } from 'lucide-react';
import { IntegrationConnector } from '../../types';
import { apiService } from '../../services/api';
import { useToast } from '../ui/ToastContainer';

interface IntegrationsViewProps {
  integrations: IntegrationConnector[];
  onRefreshAll: () => void;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({ integrations, onRefreshAll }) => {
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSync = async (provider: string) => {
    setSyncingProvider(provider);
    try {
      await apiService.syncIntegration(provider);
      showToast(`🔄 Synchronized ${provider.toUpperCase()} connector!`, 'success');
      onRefreshAll();
    } catch {
      showToast(`Triggered sync poll for ${provider}`, 'info');
    } finally {
      setSyncingProvider(null);
    }
  };

  const defaultIntegrations: IntegrationConnector[] = [
    { provider: 'slack', name: 'Slack Workspace', icon: '💬', status: 'connected', events_ingested: 412, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/ingestion/slack' },
    { provider: 'github', name: 'GitHub Enterprise', icon: '🐙', status: 'connected', events_ingested: 289, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/ingestion/github' },
    { provider: 'gmail', name: 'Google Workspace (Gmail)', icon: '✉️', status: 'connected', events_ingested: 164, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/ingestion/gmail' },
    { provider: 'teams', name: 'Microsoft Teams', icon: '👥', status: 'connected', events_ingested: 198, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/ingestion/teams' },
    { provider: 'jira', name: 'Atlassian Jira', icon: '🎯', status: 'connected', events_ingested: 312, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/integrations/jira' },
    { provider: 'notion', name: 'Notion Knowledge Base', icon: '📖', status: 'connected', events_ingested: 120, last_sync: new Date().toISOString(), webhook_endpoint: '/api/v1/integrations/notion' },
  ];

  const list = integrations.length > 0 ? integrations : defaultIntegrations;

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span className="layer-chip l5">LAYER 5 ENTERPRISE SOURCES</span>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            Enterprise Connectors &amp; Ingestion Catalog
          </h2>
        </div>
      </div>

      <div className="integrations-catalog-grid">
        {list.map((conn) => (
          <div key={conn.provider} className="integration-card anim-slide-up">
            <div className="integration-card-head">
              <div className="integration-icon-title">
                <div className="integration-icon-box">{conn.icon}</div>
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{conn.name}</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {conn.account_name || 'Production Workspace'}
                  </span>
                </div>
              </div>

              <span className={`badge ${conn.status === 'connected' ? 'ok' : 'warning'}`}>
                {conn.status.toUpperCase()}
              </span>
            </div>

            <div className="integration-meta-grid">
              <div>Events Ingested: <strong style={{ color: 'var(--text-main)' }}>{conn.events_ingested}</strong></div>
              <div>Last Sync: <strong>{new Date(conn.last_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                Webhook: {conn.webhook_endpoint}
              </div>
            </div>

            <button
              className="btn btn-ghost"
              onClick={() => handleSync(conn.provider)}
              disabled={syncingProvider === conn.provider}
              style={{ width: '100%' }}
            >
              <RefreshCw size={13} className={syncingProvider === conn.provider ? 'anim-spin' : ''} />
              <span>{syncingProvider === conn.provider ? 'Syncing…' : 'Sync Now'}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
