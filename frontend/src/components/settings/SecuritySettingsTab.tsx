import React, { useState, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Laptop,
  Smartphone,
  ShieldCheck,
  Key,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { SettingsFormFooter } from './SettingsFormFooter';
import { useToast } from '../ui/ToastContainer';

export const SecuritySettingsTab: React.FC = () => {
  const { showToast } = useToast();

  // Password fields state
  const initialPasswordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  const [pwdForm, setPwdForm] = useState(initialPasswordForm);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(true);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Active Sessions
  const [sessions, setSessions] = useState([
    {
      id: 'sess-1',
      device: 'MacBook Pro (Chrome 128.0)',
      type: 'desktop',
      ip: '192.0.2.45',
      location: 'New York, USA',
      current: true,
      lastActive: 'Active Now',
    },
    {
      id: 'sess-2',
      device: 'iPhone 15 Pro (Safari Mobile)',
      type: 'mobile',
      ip: '198.51.100.22',
      location: 'New York, USA',
      current: false,
      lastActive: '2 hours ago',
    },
    {
      id: 'sess-3',
      device: 'Linux Workstation (Firefox 130.0)',
      type: 'desktop',
      ip: '203.0.113.89',
      location: 'Boston, USA',
      current: false,
      lastActive: 'Yesterday at 4:12 PM',
    },
  ]);

  // Evaluate Password Strength
  const passwordStrength = useMemo(() => {
    const val = pwdForm.newPassword;
    if (!val) return { score: 0, label: '', cls: '' };

    let score = 0;
    if (val.length >= 8) score += 1;
    if (/[A-Z]/.test(val)) score += 1;
    if (/[0-9]/.test(val)) score += 1;
    if (/[^A-Za-z0-9]/.test(val)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', cls: 'is-weak', color: '#ef4444' };
      case 2:
        return { score: 2, label: 'Fair', cls: 'is-fair', color: '#f59e0b' };
      case 3:
        return { score: 3, label: 'Good', cls: 'is-good', color: '#3b82f6' };
      case 4:
        return { score: 4, label: 'Strong', cls: 'is-strong', color: '#10b981' };
      default:
        return { score: 0, label: '', cls: '', color: '' };
    }
  }, [pwdForm.newPassword]);

  const isDirty = Boolean(
    pwdForm.currentPassword || pwdForm.newPassword || pwdForm.confirmPassword
  );

  const handleSavePassword = async () => {
    if (!pwdForm.currentPassword) {
      showToast('Please enter your current password.', 'warning');
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      showToast('New password must be at least 8 characters.', 'warning');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await new Promise((res) => setTimeout(res, 600));
      setPwdForm(initialPasswordForm);
      showToast('🔒 Password changed successfully!', 'success');
    } catch {
      showToast('Failed to update password.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelPassword = () => {
    setPwdForm(initialPasswordForm);
    showToast('Password changes cleared', 'info');
  };

  const handleToggle2FA = () => {
    if (is2FAEnabled) {
      // Prompt to disable
      if (window.confirm('Are you sure you want to disable Two-Factor Authentication? This will lower your workspace security score.')) {
        setIs2FAEnabled(false);
        showToast('Two-factor authentication disabled', 'info');
      }
    } else {
      // Open Setup Modal
      setIs2FAModalOpen(true);
    }
  };

  const handleVerify2FA = () => {
    if (otpCode.length < 6) {
      showToast('Please enter the 6-digit authentication code', 'warning');
      return;
    }
    setIs2FAEnabled(true);
    setIs2FAModalOpen(false);
    setOtpCode('');
    showToast('✅ Two-Factor Authentication successfully enabled!', 'success');
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    showToast('Session revoked and logged out', 'info');
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText('JBSWY3DPEHPK3PXP');
    setCopiedSecret(true);
    showToast('Secret key copied to clipboard', 'info');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="settings-panel" role="tabpanel" id="panel-security" aria-labelledby="tab-security">
      <div>
        <div className="settings-section-head">
          <h2 className="settings-section-title">Security &amp; Authentication</h2>
          <p className="settings-section-desc">
            Manage your account credentials, multi-factor authentication, and connected active sessions.
          </p>
        </div>

        {/* ── Change Password Section ── */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '1rem' }}>
            Change Password
          </h3>

          <div className="settings-form-group">
            <label className="settings-label" htmlFor="sec-current-pwd">
              <span>Current Password</span>
            </label>
            <div className="settings-input-group">
              <input
                id="sec-current-pwd"
                type={showCurrentPwd ? 'text' : 'password'}
                className="settings-input"
                placeholder="••••••••••••"
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="settings-input-icon-btn"
                onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                aria-label={showCurrentPwd ? 'Hide password' : 'Show password'}
              >
                {showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-form-group">
            <label className="settings-label" htmlFor="sec-new-pwd">
              <span>New Password</span>
              <span className="settings-label-hint">Min. 8 characters</span>
            </label>
            <div className="settings-input-group">
              <input
                id="sec-new-pwd"
                type={showNewPwd ? 'text' : 'password'}
                className="settings-input"
                placeholder="••••••••••••"
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="settings-input-icon-btn"
                onClick={() => setShowNewPwd(!showNewPwd)}
                aria-label={showNewPwd ? 'Hide password' : 'Show password'}
              >
                {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {pwdForm.newPassword && (
              <div>
                <div className="password-strength-bar" aria-hidden="true">
                  <div className={`strength-segment ${passwordStrength.score >= 1 ? passwordStrength.cls : ''}`} />
                  <div className={`strength-segment ${passwordStrength.score >= 2 ? passwordStrength.cls : ''}`} />
                  <div className={`strength-segment ${passwordStrength.score >= 3 ? passwordStrength.cls : ''}`} />
                  <div className={`strength-segment ${passwordStrength.score >= 4 ? passwordStrength.cls : ''}`} />
                </div>
                <div className="strength-text" style={{ color: passwordStrength.color }}>
                  Strength: {passwordStrength.label}
                </div>
              </div>
            )}
          </div>

          <div className="settings-form-group">
            <label className="settings-label" htmlFor="sec-confirm-pwd">
              <span>Confirm New Password</span>
            </label>
            <div className="settings-input-group">
              <input
                id="sec-confirm-pwd"
                type={showConfirmPwd ? 'text' : 'password'}
                className="settings-input"
                placeholder="••••••••••••"
                value={pwdForm.confirmPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="settings-input-icon-btn"
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
              >
                {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </section>

        {/* ── Two-Factor Authentication (2FA) ── */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginBottom: '1rem' }}>
            Two-Factor Authentication (2FA)
          </h3>

          <div className="settings-switch-wrapper">
            <div className="settings-switch-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} style={{ color: is2FAEnabled ? '#10b981' : '#64748b' }} />
                <span className="settings-switch-title">Authenticator App (TOTP)</span>
              </div>
              <p className="settings-switch-desc">
                Protect your account with an extra layer of security using Google Authenticator, 1Password, or Authy.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={is2FAEnabled}
              className={`settings-toggle-switch ${is2FAEnabled ? 'is-checked' : ''}`}
              onClick={handleToggle2FA}
              aria-label="Toggle Two-Factor Authentication"
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>
        </section>

        {/* ── Active Sessions ── */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>
              Active Sessions
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {sessions.length} devices logged in
            </span>
          </div>

          <div className="settings-sessions-list">
            {sessions.map((sess) => (
              <div key={sess.id} className="session-item">
                <div className="session-item-info">
                  <div className="session-device-icon">
                    {sess.type === 'desktop' ? <Laptop size={18} /> : <Smartphone size={18} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="session-title">{sess.device}</span>
                      {sess.current && (
                        <span className="badge ok" style={{ fontSize: '9px', padding: '1px 6px' }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div className="session-sub">
                      {sess.ip} • {sess.location} • {sess.lastActive}
                    </div>
                  </div>
                </div>

                {!sess.current && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => handleRevokeSession(sess.id)}
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <SettingsFormFooter
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSavePassword}
        onCancel={handleCancelPassword}
        saveText="Update Password"
      />

      {/* ── 2FA Setup Modal ── */}
      {is2FAModalOpen && (
        <div className="settings-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-2fa-title">
          <div className="settings-modal-card">
            <div className="settings-modal-head">
              <h3 id="modal-2fa-title" className="settings-modal-title">
                Set Up Two-Factor Authentication
              </h3>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setIs2FAModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              Scan the QR code below with your Authenticator app (Google Authenticator, Authy, or 1Password).
            </p>

            {/* Simulated QR Code */}
            <div className="qr-code-placeholder">
              <div style={{ textAlign: 'center', color: '#0f172a' }}>
                <Key size={48} style={{ margin: '0 auto 0.5rem', color: '#3b82f6' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>
                  Axiom OS 2FA Secret
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                Manual Setup Key
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="settings-input"
                  value="JBSWY3DPEHPK3PXP"
                  readOnly
                  style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
                />
                <button type="button" className="btn-secondary" onClick={handleCopySecret}>
                  {copiedSecret ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="settings-form-group">
              <label className="settings-label" htmlFor="2fa-otp">
                Enter 6-digit Code from Authenticator
              </label>
              <input
                id="2fa-otp"
                type="text"
                className="settings-input"
                placeholder="123456"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.125rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIs2FAModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-save"
                onClick={handleVerify2FA}
              >
                Verify &amp; Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
