import React, { useState } from 'react';
import {
  Shield,
  Bot,
  Bell,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Lock,
  Cpu,
  RefreshCw,
  Sparkles,
  Layers,
  Save,
  Check,
} from 'lucide-react';
import { useToast } from '../ui/ToastContainer';

interface PolicyRule {
  id: string;
  name: string;
  category: 'Security' | 'Infrastructure' | 'Billing' | 'General';
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  action: 'MANDATORY_LEAD' | 'AUTO_HEAL' | 'SQUAD_REVIEW' | 'DUAL_SIGNOFF';
  enabled: boolean;
}

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();

  // AI & Reasoning Settings
  const [llmEngine, setLlmEngine] = useState('gpt-4o-mini');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('axiom_custom_llm_key') || '');
  const [groundingStrictness, setGroundingStrictness] = useState('strict');
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);

  // Auto-healing Toggles
  const [autoHealLowRisk, setAutoHealLowRisk] = useState(true);
  const [autoCreateJira, setAutoCreateJira] = useState(true);
  const [autoNotifySlack, setAutoNotifySlack] = useState(true);

  // Alert Webhooks
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T00/B00/AXIOM_CRITICAL_DRIFT');
  const [jiraProjectKey, setJiraProjectKey] = useState('DOCS');
  const [pagerdutySeverity, setPagerdutySeverity] = useState('P1-Critical Only');

  // Policy Gate Rules
  const [rules, setRules] = useState<PolicyRule[]>([
    {
      id: 'RULE-01',
      name: 'Authentication & IAM Protocol Guard',
      category: 'Security',
      riskLevel: 'CRITICAL',
      description: 'Changes to SAML, OAuth, API tokens or SSO configurations require mandatory CISO / Security Lead authorization.',
      action: 'DUAL_SIGNOFF',
      enabled: true,
    },
    {
      id: 'RULE-02',
      name: 'Database & Failover SLA Thresholds',
      category: 'Infrastructure',
      riskLevel: 'HIGH',
      description: 'Changes to replica lag tolerances, primary failover thresholds, or database ports require SRE Lead approval.',
      action: 'MANDATORY_LEAD',
      enabled: true,
    },
    {
      id: 'RULE-03',
      name: 'API Endpoints & Payment Webhooks',
      category: 'Billing',
      riskLevel: 'HIGH',
      description: 'Webhook signature methods and payment endpoint migrations require Platform Engineering signoff.',
      action: 'MANDATORY_LEAD',
      enabled: true,
    },
    {
      id: 'RULE-04',
      name: 'SDK Parameter & Environment URL Drift',
      category: 'General',
      riskLevel: 'MEDIUM',
      description: 'Non-breaking parameter updates and environment URL changes are routed to the squad lead inbox.',
      action: 'SQUAD_REVIEW',
      enabled: true,
    },
    {
      id: 'RULE-05',
      name: 'Typo & Formatting Documentation Auto-Sync',
      category: 'General',
      riskLevel: 'LOW',
      description: 'Minor non-structural updates and documentation formatting automatically sync without blocking workflows.',
      action: 'AUTO_HEAL',
      enabled: true,
    },
  ]);

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
    showToast('Rule policy updated!', 'info');
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('axiom_custom_llm_key', apiKey.trim());
    showToast('🔑 Custom API key saved for this session!', 'success');
  };

  const handleSaveAll = () => {
    showToast('✅ Axiom OS rules and safety policies successfully saved!', 'success');
  };

  return (
    <div className="view-container anim-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <span className="layer-chip l0">LAYER 0 POLICY &amp; SAFETY GOVERNANCE</span>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em' }}>
            Rules, Safety Gates &amp; System Settings
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Configure autonomous contradiction detection thresholds, Layer 0 approval rules, and automated dispatch workflows.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSaveAll} style={{ padding: '10px 18px' }}>
          <Save size={15} />
          <span>Save All Settings</span>
        </button>
      </div>

      <div className="settings-columns-grid">
        {/* ── Section 1: AI Reasoning & Drift Detection Thresholds ── */}
        <div className="settings-card anim-slide-up">
          <div className="card-header-clean">
            <div className="card-header-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              <Bot size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>AI Reasoning &amp; Detection Engine</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Configure cognitive models and contradiction sensitivity.
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Active AI Model</label>
            <select className="form-select" value={llmEngine} onChange={(e) => setLlmEngine(e.target.value)}>
              <option value="gpt-4o-mini">OpenAI GPT-4o Mini (High Speed · Low Latency)</option>
              <option value="gpt-4o">OpenAI GPT-4o (Maximum Reasoning)</option>
              <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (2M Context Window)</option>
              <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet (Technical Specs Specialist)</option>
              <option value="local-engine">Local Heuristic Reasoner (Air-Gapped / Zero Cloud)</option>
            </select>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Contradiction Confidence Threshold
              </label>
              <strong style={{ color: '#38bdf8', fontSize: '13px' }}>{confidenceThreshold}%</strong>
            </div>
            <input
              type="range"
              className="roi-range-slider"
              min={60}
              max={95}
              step={1}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
            />
            <div className="slider-range-ticks">
              <span>60% (More sensitive)</span>
              <span>85% (Recommended)</span>
              <span>95% (Strict only)</span>
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Factual Grounding Strictness
            </label>
            <select className="form-select" value={groundingStrictness} onChange={(e) => setGroundingStrictness(e.target.value)}>
              <option value="strict">Strict Deterministic (Zero Hallucination · Requires Direct Citation)</option>
              <option value="balanced">Balanced (Flags inferred discrepancies across PR context)</option>
            </select>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Custom LLM API Key (Optional Override)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="password"
                className="form-input"
                placeholder="sk-... or AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              />
              <button className="btn btn-ghost" onClick={handleSaveApiKey}>
                Save Key
              </button>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '3px' }}>
              Leave blank to use the pre-configured system default key.
            </span>
          </div>
        </div>

        {/* ── Section 2: Automation & Dispatch Settings ── */}
        <div className="settings-card anim-slide-up">
          <div className="card-header-clean">
            <div className="card-header-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              <Zap size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Self-Healing Automations</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Control what happens when contradictions are resolved.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
            <label className="form-checkbox-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoHealLowRisk}
                onChange={(e) => setAutoHealLowRisk(e.target.checked)}
              />
              <div>
                <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>
                  Auto-Heal Low-Risk Documentation
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Automatically update spelling, broken internal links, and formatting without human signoff.
                </span>
              </div>
            </label>

            <label className="form-checkbox-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoCreateJira}
                onChange={(e) => setAutoCreateJira(e.target.checked)}
              />
              <div>
                <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>
                  Create Jira Tracking Ticket on Contradiction
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Automatically opens a tracking issue in Jira with diff preview and cited Slack/GitHub evidence.
                </span>
              </div>
            </label>

            <label className="form-checkbox-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoNotifySlack}
                onChange={(e) => setAutoNotifySlack(e.target.checked)}
              />
              <div>
                <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>
                  Broadcast Resolution to Source Slack Channels
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Sends an interactive card back into the originating Slack thread confirming the spec has been updated.
                </span>
              </div>
            </label>
          </div>

          {/* Webhook & Project Config */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'grid', gap: '10px' }}>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Slack Alert Webhook</label>
              <input
                type="text"
                className="form-input"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Jira Project Key</label>
                <input
                  type="text"
                  className="form-input"
                  value={jiraProjectKey}
                  onChange={(e) => setJiraProjectKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>PagerDuty Escalation</label>
                <select className="form-select" value={pagerdutySeverity} onChange={(e) => setPagerdutySeverity(e.target.value)}>
                  <option value="P1-Critical Only">P1 Critical Only</option>
                  <option value="P1-and-P2">P1 &amp; P2 High Risk</option>
                  <option value="Disabled">Disabled</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Layer 0 Safety Gate Policy Rules ── */}
        <div className="settings-card full-width anim-slide-up">
          <div className="card-header-clean">
            <div className="card-header-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Shield size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Layer 0 Pre-Approval Safety Gates Matrix</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Active deterministic rules that halt high-risk self-healing until authorized by designated domain leads.
              </p>
            </div>
          </div>

          <div className="rules-table-wrapper" style={{ marginTop: '16px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rule ID</th>
                  <th>Policy Name &amp; Description</th>
                  <th style={{ width: '110px' }}>Risk Level</th>
                  <th style={{ width: '160px' }}>Enforcement Action</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <span className="mono" style={{ fontSize: '11px', color: '#93c5fd' }}>{rule.id}</span>
                    </td>
                    <td>
                      <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-main)' }}>{rule.name}</strong>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {rule.description}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          fontSize: '10px',
                          background:
                            rule.riskLevel === 'CRITICAL'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : rule.riskLevel === 'HIGH'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : rule.riskLevel === 'MEDIUM'
                              ? 'rgba(59, 130, 246, 0.2)'
                              : 'rgba(16, 185, 129, 0.2)',
                          color:
                            rule.riskLevel === 'CRITICAL'
                              ? '#f87171'
                              : rule.riskLevel === 'HIGH'
                              ? '#fbbf24'
                              : rule.riskLevel === 'MEDIUM'
                              ? '#93c5fd'
                              : '#34d399',
                        }}
                      >
                        {rule.riskLevel}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#e2e8f0' }}>
                        {rule.action === 'DUAL_SIGNOFF' && '🛡️ Dual-Signoff Required'}
                        {rule.action === 'MANDATORY_LEAD' && '👤 Domain Lead Approval'}
                        {rule.action === 'SQUAD_REVIEW' && '👥 Squad Inbox Review'}
                        {rule.action === 'AUTO_HEAL' && '⚡ Autonomous Auto-Heal'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className={`btn btn-sm ${rule.enabled ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => toggleRule(rule.id)}
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
