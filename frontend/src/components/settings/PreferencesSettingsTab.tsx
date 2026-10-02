import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Bot, Sparkles, Sliders } from 'lucide-react';
import { SettingsFormFooter } from './SettingsFormFooter';
import { useToast } from '../ui/ToastContainer';

export const PreferencesSettingsTab: React.FC = () => {
  const { showToast } = useToast();

  const currentTheme = (localStorage.getItem('cbos_theme') as 'dark' | 'light') || 'dark';

  const initialForm = {
    theme: currentTheme,
    language: 'en-US',
    dateFormat: 'YYYY-MM-DD',
    aiEngine: 'gpt-4o-mini',
    groundingStrictness: 'strict',
    confidenceThreshold: 85,
    soundEffects: true,
  };

  const [form, setForm] = useState(initialForm);
  const [savedForm, setSavedForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setForm((prev) => ({ ...prev, theme: newTheme }));
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('cbos_theme', newTheme);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise((res) => setTimeout(res, 500));
      setSavedForm(form);
      localStorage.setItem('cbos_theme', form.theme);
      showToast('⚙️ Application preferences saved!', 'success');
    } catch {
      showToast('Failed to save preferences.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(savedForm);
    document.documentElement.setAttribute('data-theme', savedForm.theme);
    localStorage.setItem('cbos_theme', savedForm.theme);
    showToast('Preferences reset to saved state', 'info');
  };

  return (
    <div className="settings-panel" role="tabpanel" id="panel-preferences" aria-labelledby="tab-preferences">
      <div>
        <div className="settings-section-head">
          <h2 className="settings-section-title">Application Preferences</h2>
          <p className="settings-section-desc">
            Customize your interface appearance, language, and default AI engine parameters.
          </p>
        </div>

        {/* ── Theme Selection ── */}
        <section style={{ marginBottom: '2rem' }}>
          <label className="settings-label" style={{ marginBottom: '0.75rem' }}>
            <span>Appearance &amp; Theme</span>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            <button
              type="button"
              className={`settings-nav-item-btn ${form.theme === 'dark' ? 'is-active' : ''}`}
              style={{ justifyContent: 'center', padding: '1rem', flexDirection: 'column', gap: '0.5rem' }}
              onClick={() => handleThemeChange('dark')}
            >
              <Moon size={20} />
              <span>Dark Theme</span>
            </button>

            <button
              type="button"
              className={`settings-nav-item-btn ${form.theme === 'light' ? 'is-active' : ''}`}
              style={{ justifyContent: 'center', padding: '1rem', flexDirection: 'column', gap: '0.5rem' }}
              onClick={() => handleThemeChange('light')}
            >
              <Sun size={20} />
              <span>Light Theme</span>
            </button>
          </div>
        </section>

        {/* ── AI Engine Configuration ── */}
        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bot size={18} style={{ color: '#3b82f6' }} />
            AI Reasoning Engine Defaults
          </h3>

          <div className="settings-form-group">
            <label className="settings-label" htmlFor="pref-ai-engine">
              <span>Default Cognitive Model</span>
            </label>
            <select
              id="pref-ai-engine"
              className="settings-select"
              value={form.aiEngine}
              onChange={(e) => setForm({ ...form, aiEngine: e.target.value })}
            >
              <option value="gpt-4o-mini">OpenAI GPT-4o Mini (High Speed · Low Latency)</option>
              <option value="gpt-4o">OpenAI GPT-4o (Maximum Reasoning)</option>
              <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (2M Context Window)</option>
              <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet (Specs Specialist)</option>
            </select>
          </div>

          <div className="settings-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label className="settings-label" htmlFor="pref-threshold" style={{ margin: 0 }}>
                <span>Contradiction Detection Sensitivity</span>
              </label>
              <strong style={{ fontSize: '0.875rem', color: '#3b82f6' }}>{form.confidenceThreshold}%</strong>
            </div>
            <input
              id="pref-threshold"
              type="range"
              min={60}
              max={95}
              step={1}
              value={form.confidenceThreshold}
              onChange={(e) => setForm({ ...form, confidenceThreshold: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              <span>60% (Sensitive)</span>
              <span>85% (Recommended)</span>
              <span>95% (Strict only)</span>
            </div>
          </div>
        </section>

        {/* ── Regional & Localization ── */}
        <section>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '1rem' }}>
            Localization
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="settings-form-group">
              <label className="settings-label" htmlFor="pref-lang">
                <span>Display Language</span>
              </label>
              <select
                id="pref-lang"
                className="settings-select"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Español</option>
                <option value="de-DE">Deutsch</option>
                <option value="ja-JP">日本語</option>
              </select>
            </div>

            <div className="settings-form-group">
              <label className="settings-label" htmlFor="pref-date-format">
                <span>Date Format</span>
              </label>
              <select
                id="pref-date-format"
                className="settings-select"
                value={form.dateFormat}
                onChange={(e) => setForm({ ...form, dateFormat: e.target.value })}
              >
                <option value="YYYY-MM-DD">2026-10-02 (ISO Standard)</option>
                <option value="MM/DD/YYYY">10/02/2026 (US)</option>
                <option value="DD/MM/YYYY">02/10/2026 (EU)</option>
              </select>
            </div>
          </div>
        </section>
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
