import React, { useState } from 'react';
import { RefreshCw, Zap, ShieldCheck, User, Shield, Search, Building } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../ui/ToastContainer';
import { UserProfile } from '../../types';

interface TopBarProps {
  currentView: string;
  isApiLive: boolean;
  onResetComplete: () => void;
  onNavigate?: (view: string) => void;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onOpenCommandPalette?: () => void;
}

const VIEW_METADATA: Record<string, { eyebrow: string; title: string }> = {
  // ── Answer Layer (plain language) ──────────────────────────────────────
  chat:         { eyebrow: 'Ask',                 title: 'Ask — Get Answers' },
  inbox:        { eyebrow: 'Needs Your Attention', title: 'Review — Needs Your Attention' },
  explore:      { eyebrow: 'Browse Knowledge',     title: 'Explore — What We Know' },
  // ── Engine Room (technical language, gated to System roles) ─────────────
  intelligence: { eyebrow: 'Autonomous Agents',   title: 'AI Agents & Memory' },
  operations:   { eyebrow: 'Event Operations',    title: 'Event-Driven Platform & Observability' },
  pipeline:     { eyebrow: 'Real-Time Activity',  title: 'Live Activity Stream' },
  execution:    { eyebrow: 'Automated Fixes',      title: 'Automated Actions & History' },
  audit:        { eyebrow: 'Security Records',    title: 'Security & Audit Logs' },
  integrations: { eyebrow: 'Connected Systems',   title: 'Connected Apps & Tools' },
  settings:     { eyebrow: 'Safety Rules',        title: 'Rules & Settings' },
  profile:      { eyebrow: 'Access Control',      title: 'Team & Access Roles' },
};

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  isApiLive,
  onResetComplete,
  onNavigate,
  currentUser,
  onOpenAuth,
  onOpenCommandPalette,
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const { showToast } = useToast();

  const meta = VIEW_METADATA[currentView] || VIEW_METADATA.chat;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await apiService.resetDemo();
      showToast('🔄 Demo state cleanly reset to baseline!', 'success');
      onResetComplete();
    } catch (err: any) {
      showToast(`Reset failed: ${err.message}`, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <div className="topbar-badge-live">
          <span className="pulse-dot"></span>
          <span>{isApiLive ? 'Enterprise Brain Live' : 'Connecting to Core...'}</span>
        </div>
        <div className="topbar-divider"></div>
        <div>
          <p className="view-heading-eyebrow">{meta.eyebrow}</p>
          <h1 className="view-heading-title">{meta.title}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        {onOpenCommandPalette && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenCommandPalette}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              fontSize: '12px',
              background: 'var(--bg-inset, #070a10)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            <Search size={13} />
            <span>Search workspace…</span>
            <kbd
              style={{
                fontSize: '10px',
                color: 'var(--text-dim, #64748b)',
                background: 'var(--bg-surface-sub, #162236)',
                padding: '1px 5px',
                borderRadius: '3px',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              ⌘K
            </kbd>
          </button>
        )}
        {currentUser && onOpenAuth && (
          <button
            className="btn btn-secondary"
            onClick={onOpenAuth}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 10px' }}
            title="Manage Identity, Roles, and Multi-Tenancy"
          >
            <Shield size={13} className="text-blue" />
            <span>{currentUser.display_name || 'Admin User'}</span>
            <span
              className="layer-chip l2"
              style={{ fontSize: '9px', padding: '1px 5px', textTransform: 'uppercase' }}
            >
              {currentUser.role || 'ADMIN'}
            </span>
          </button>
        )}

        {onNavigate && (
          <button
            className="btn btn-ghost"
            onClick={() => onNavigate('landing')}
            title="View Product Landing Page & Architecture Overview"
          >
            <span>Product Page</span>
          </button>
        )}

        <button
          className="btn btn-ghost"
          onClick={handleReset}
          disabled={isResetting}
          title="Reset database to initial synthetic demo state"
        >
          <RefreshCw size={14} className={isResetting ? 'anim-spin' : ''} style={{ animation: isResetting ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isResetting ? 'Resetting…' : 'Reset Demo'}</span>
        </button>

        <span className={`badge ${isApiLive ? 'ok' : 'warning'}`}>
          {isApiLive ? 'Live 100%' : 'API Offline'}
        </span>
      </div>
    </header>
  );
};
