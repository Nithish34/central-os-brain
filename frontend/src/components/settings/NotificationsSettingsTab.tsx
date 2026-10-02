import React, { useState } from 'react';
import { Check, Bell, Mail, Smartphone, MessageSquare } from 'lucide-react';
import { SettingsFormFooter } from './SettingsFormFooter';
import { useToast } from '../ui/ToastContainer';

interface NotificationEventConfig {
  id: string;
  category: string;
  title: string;
  description: string;
  email: boolean;
  sms: boolean;
  push: boolean;
}

export const NotificationsSettingsTab: React.FC = () => {
  const { showToast } = useToast();

  const initialConfigs: NotificationEventConfig[] = [
    {
      id: 'sec-alerts',
      category: 'Security',
      title: 'Security & Access Alerts',
      description: 'Critical authentication changes, new device logins, and IAM policy overrides.',
      email: true,
      sms: true,
      push: true,
    },
    {
      id: 'drift-events',
      category: 'Governance',
      title: 'Contradiction & Spec Drift',
      description: 'New high-risk policy contradictions detected across Slack and GitHub documentation.',
      email: true,
      sms: false,
      push: true,
    },
    {
      id: 'billing-events',
      category: 'Organization',
      title: 'Invoices & Billing Updates',
      description: 'Monthly statements, payment failure warnings, and seat tier adjustments.',
      email: true,
      sms: false,
      push: false,
    },
    {
      id: 'team-events',
      category: 'Organization',
      title: 'Team & Member Activity',
      description: 'New team invitations accepted, role modifications, and workspace domain joins.',
      email: false,
      sms: false,
      push: true,
    },
    {
      id: 'product-updates',
      category: 'Application',
      title: 'Product & Engine Updates',
      description: 'New reasoning models, system features, and architectural release notes.',
      email: true,
      sms: false,
      push: false,
    },
  ];

  const [configs, setConfigs] = useState<NotificationEventConfig[]>(initialConfigs);
  const [savedConfigs, setSavedConfigs] = useState<NotificationEventConfig[]>(initialConfigs);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = JSON.stringify(configs) !== JSON.stringify(savedConfigs);

  const toggleChannel = (id: string, channel: 'email' | 'sms' | 'push') => {
    setConfigs((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [channel]: !item[channel] } : item
      )
    );
  };

  const handleEnableAll = () => {
    setConfigs((prev) =>
      prev.map((item) => ({ ...item, email: true, sms: true, push: true }))
    );
    showToast('All notification channels enabled', 'info');
  };

  const handleMuteAll = () => {
    setConfigs((prev) =>
      prev.map((item) => ({ ...item, email: false, sms: false, push: false }))
    );
    showToast('All notifications muted', 'info');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise((res) => setTimeout(res, 500));
      setSavedConfigs(configs);
      showToast('🔔 Notification preferences successfully updated!', 'success');
    } catch {
      showToast('Failed to save notification settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setConfigs(savedConfigs);
    showToast('Notification changes discarded', 'info');
  };

  return (
    <div className="settings-panel" role="tabpanel" id="panel-notifications" aria-labelledby="tab-notifications">
      <div>
        <div className="settings-section-head">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 className="settings-section-title">Notification Channels</h2>
              <p className="settings-section-desc">
                Configure granular delivery rules for Email, SMS, and in-app Push notifications.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                onClick={handleEnableAll}
              >
                Enable All
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                onClick={handleMuteAll}
              >
                Mute All
              </button>
            </div>
          </div>
        </div>

        {/* ── Granular Notification Matrix Table ── */}
        <div className="notifications-matrix-wrap">
          <table className="notifications-matrix-table" aria-label="Notification matrix">
            <thead>
              <tr>
                <th style={{ width: '55%' }}>Notification Event</th>
                <th style={{ width: '15%', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Mail size={14} />
                    <span>Email</span>
                  </div>
                </th>
                <th style={{ width: '15%', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Smartphone size={14} />
                    <span>SMS</span>
                  </div>
                </th>
                <th style={{ width: '15%', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Bell size={14} />
                    <span>Push</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {configs.map((event) => (
                <tr key={event.id}>
                  <td>
                    <span className="notifications-event-title">{event.title}</span>
                    <span className="notifications-event-desc">{event.description}</span>
                  </td>

                  {/* Email Toggle */}
                  <td className="matrix-checkbox-cell">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={event.email}
                      aria-label={`Toggle Email for ${event.title}`}
                      className={`matrix-checkbox-btn ${event.email ? 'is-active' : ''}`}
                      onClick={() => toggleChannel(event.id, 'email')}
                    >
                      {event.email && <Check size={12} strokeWidth={3} />}
                    </button>
                  </td>

                  {/* SMS Toggle */}
                  <td className="matrix-checkbox-cell">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={event.sms}
                      aria-label={`Toggle SMS for ${event.title}`}
                      className={`matrix-checkbox-btn ${event.sms ? 'is-active' : ''}`}
                      onClick={() => toggleChannel(event.id, 'sms')}
                    >
                      {event.sms && <Check size={12} strokeWidth={3} />}
                    </button>
                  </td>

                  {/* Push Toggle */}
                  <td className="matrix-checkbox-cell">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={event.push}
                      aria-label={`Toggle Push for ${event.title}`}
                      className={`matrix-checkbox-btn ${event.push ? 'is-active' : ''}`}
                      onClick={() => toggleChannel(event.id, 'push')}
                    >
                      {event.push && <Check size={12} strokeWidth={3} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Slack / Webhook dispatch card */}
        <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <MessageSquare size={16} style={{ color: '#3b82f6' }} />
            <strong style={{ fontSize: '0.875rem', color: '#ffffff' }}>Instant Messaging Webhook Routing</strong>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>
            Looking for real-time Slack channels or PagerDuty escalation integrations? Manage high-priority routing webhooks in the Integrations hub.
          </p>
        </div>
      </div>

      <SettingsFormFooter
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
};
