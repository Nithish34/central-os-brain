import React, { useState } from 'react';
import {
  Shield,
  LogOut,
  X,
  User,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Lock,
  Building,
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../ui/ToastContainer';
import { UserProfile } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
}) => {
  const [showSwitchForm, setShowSwitchForm] = useState(false);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [orgName, setOrgName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      showToast('Please enter both email and password.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiService.login(email, password);
      showToast(`Welcome back, ${data.user.display_name}!`, 'success');
      onAuthSuccess(data.user);
      setShowSwitchForm(false);
      onClose();
    } catch (err: any) {
      showToast(`Sign in failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiService.register(
        email,
        password,
        displayName,
        orgName || `${displayName}'s Workspace`
      );
      showToast(`Organization created! Welcome, ${data.user.display_name}.`, 'success');
      onAuthSuccess(data.user);
      setShowSwitchForm(false);
      onClose();
    } catch (err: any) {
      showToast(`Registration failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      showToast('Logged out successfully.', 'info');
      onAuthSuccess({
        id: 'anon',
        email: '',
        display_name: '',
        role: '',
        permissions: [],
      });
      onClose();
    } catch (err: any) {
      showToast(`Logout error: ${err.message}`, 'error');
    }
  };

  const userName = currentUser?.display_name || 'David Chen';
  const userEmail = currentUser?.email || 'admin@companybrain.local';
  const userRole = (currentUser?.role || 'Admin').toUpperCase();
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="surface-card animate-scale-up"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          background: 'var(--bg-surface-elevated, #0f172a)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
        }}
      >
        {/* ── Top Header with Close Button ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="layer-chip l2" style={{ fontSize: '10px', padding: '2px 8px' }}>
              SECURITY &amp; IDENTITY
            </span>
            <span className="badge ok" style={{ fontSize: '10px', padding: '2px 8px' }}>
              {userRole}
            </span>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: '4px', color: '#94a3b8' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── User Profile Card (Name, Current Email, Profile Photo at Top) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '12px',
            marginBottom: '20px',
          }}
        >
          {/* Profile Photo / Avatar */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 700,
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {(currentUser?.avatar_url || localStorage.getItem('cb_user_avatar')) ? (
              <img
                src={currentUser?.avatar_url || localStorage.getItem('cb_user_avatar') || ''}
                alt={userName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initials || <User size={24} />
            )}
          </div>

          {/* User Name & Current Mail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
            <h3
              id="auth-modal-title"
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {userName}
            </h3>
            <span
              style={{
                fontSize: '13px',
                color: '#94a3b8',
                wordBreak: 'break-all',
              }}
            >
              {userEmail}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#10b981',
                }}
              />
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>
                Active Session
              </span>
            </div>
          </div>
        </div>

        {/* ── Main Modal Body ── */}
        {!showSwitchForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            {/* Account Details Box */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Organization</span>
                <strong style={{ color: '#e2e8f0' }}>Company Brain Enterprise</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Authentication</span>
                <strong style={{ color: '#e2e8f0' }}>Argon2id + Bearer JWT</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>2FA Protection</span>
                <strong style={{ color: '#34d399' }}>Enabled (TOTP)</strong>
              </div>
            </div>

            {/* Switch / Add Account Trigger */}
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                width: '100%',
                fontSize: '12px',
                justifyContent: 'center',
                padding: '8px',
                color: '#60a5fa',
                border: '1px dashed rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
              }}
              onClick={() => setShowSwitchForm(true)}
            >
              + Sign in with another account
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            {/* Sub-form Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${tab === 'login' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => setTab('login')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${tab === 'register' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                  onClick={() => setTab('register')}
                >
                  Register
                </button>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '11px', color: '#94a3b8' }}
                onClick={() => setShowSwitchForm(false)}
              >
                Back to Profile
              </button>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                window.location.href = '/api/v1/auth/google/login';
              }}
              disabled={isLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 14px',
                background: '#ffffff',
                color: '#1f2937',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                marginBottom: '12px',
              }}
            >
              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            {tab === 'login' ? (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="email"
                  className="input-text"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: '12px' }}
                />
                <input
                  type="password"
                  className="input-text"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: '12px' }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                  style={{ marginTop: '4px', fontSize: '12px', padding: '7px' }}
                >
                  {isLoading ? <RefreshCw size={13} className="anim-spin" /> : <ArrowRight size={13} />}
                  <span>Sign In</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  className="input-text"
                  placeholder="Full Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: '12px' }}
                />
                <input
                  type="email"
                  className="input-text"
                  placeholder="Work Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: '12px' }}
                />
                <input
                  type="password"
                  className="input-text"
                  placeholder="Password (min 8 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={{ width: '100%', fontSize: '12px' }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                  style={{ marginTop: '4px', fontSize: '12px', padding: '7px' }}
                >
                  {isLoading ? <RefreshCw size={13} className="anim-spin" /> : <CheckCircle2 size={13} />}
                  <span>Create Account</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Bottom Action Bar: Sign Out in one corner (Left), Cancel in other corner (Right) ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Left Corner: Sign Out Button */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              background: 'rgba(239, 68, 68, 0.08)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onClick={handleLogout}
            title="Sign out of active account"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>

          {/* Right Corner: Cancel Button */}
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 500,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#e2e8f0',
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
