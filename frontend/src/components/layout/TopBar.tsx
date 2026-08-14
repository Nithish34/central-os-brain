import React, { useState } from 'react';
import { RefreshCw, Zap, ShieldCheck } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../ui/ToastContainer';

interface TopBarProps {
  currentView: string;
  isApiLive: boolean;
  onResetComplete: () => void;
  onNavigate?: (view: string) => void;
}

const VIEW_METADATA: Record<string, { eyebrow: string; title: string }> = {
  chat: { eyebrow: 'AI Assistant', title: 'Ask AI & Copilot' },
  inbox: { eyebrow: 'Conflict Resolver', title: 'Review & Fix Issues' },
  intelligence: { eyebrow: 'Autonomous Agents', title: 'AI Agents & Memory' },
  pipeline: { eyebrow: 'Real-Time Activity', title: 'Live Activity Stream' },
  execution: { eyebrow: 'Automated Fixes', title: 'Automated Actions & History' },
  audit: { eyebrow: 'Security Records', title: 'Security & Audit Logs' },
  integrations: { eyebrow: 'Connected Systems', title: 'Connected Apps & Tools' },
  settings: { eyebrow: 'Safety Rules', title: 'Rules & Settings' },
  profile: { eyebrow: 'Access Control', title: 'Team & Access Roles' },
};

export const TopBar: React.FC<TopBarProps> = ({ currentView, isApiLive, onResetComplete, onNavigate }) => {
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
