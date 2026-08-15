import React from 'react';
import {
  Brain,
  Inbox,
  Sparkles,
  Layers,
  Workflow,
  ShieldCheck,
  Grid,
  Settings,
  UserCheck,
  Cpu,
  Menu,
} from 'lucide-react';
import { TopBar } from './TopBar';

interface AppShellProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isApiLive: boolean;
  openConflictsCount: number;
  onResetComplete: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentView,
  onNavigate,
  isApiLive,
  openConflictsCount,
  onResetComplete,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const navItems = [
    {
      id: 'chat',
      label: 'Ask AI',
      icon: <Brain size={16} />,
      badge: <span className="layer-chip l2">COPILOT</span>,
    },
    {
      id: 'inbox',
      label: 'Review Issues',
      icon: <Inbox size={16} />,
      badge: openConflictsCount > 0 ? <span className="badge open">{openConflictsCount}</span> : null,
    },
    {
      id: 'intelligence',
      label: 'AI Agents & Memory',
      icon: <Sparkles size={16} />,
      badge: <span className="layer-chip l2">BRAIN</span>,
    },
    {
      id: 'pipeline',
      label: 'Live Activity Stream',
      icon: <Layers size={16} />,
      badge: <span className="layer-chip l3">FEED</span>,
    },
    {
      id: 'execution',
      label: 'Automated Actions',
      icon: <Workflow size={16} />,
      badge: <span className="layer-chip l0">AUTO</span>,
    },
    {
      id: 'audit',
      label: 'Security & Logs',
      icon: <ShieldCheck size={16} />,
    },
  ];

  const govItems = [
    {
      id: 'integrations',
      label: 'Connected Apps',
      icon: <Grid size={16} />,
      badge: <span className="layer-chip l5">APPS</span>,
    },
    {
      id: 'settings',
      label: 'Rules & Settings',
      icon: <Settings size={16} />,
    },
    {
      id: 'profile',
      label: 'Team & Access Roles',
      icon: <UserCheck size={16} />,
      badge: <span className="perm-chip" style={{ fontSize: '9px', padding: '1px 5px' }}>ADMIN</span>,
    },
  ];

  const handleLinkClick = (id: string) => {
    onNavigate(id);
    setSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <a
            href="#chat"
            className="brand-group"
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick('chat');
            }}
          >
            <div className="brand-mark" style={{ overflow: 'hidden', padding: 0 }}>
              <img
                src="/images/axiom_logo.jpg"
                alt="Axiom OS"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div className="brand-text">
              <strong>Axiom OS</strong>
              <span>Ground Truth 2.0</span>
            </div>
          </a>
        </div>

        <div className="sidebar-nav-section">
          <p className="nav-section-label">Main Workspace</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${currentView === item.id ? 'active' : ''}`}
              onClick={() => handleLinkClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge}
            </button>
          ))}

          <p className="nav-section-label" style={{ marginTop: '12px' }}>
            Settings &amp; Security
          </p>
          {govItems.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${currentView === item.id ? 'active' : ''}`}
              onClick={() => handleLinkClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge}
            </button>
          ))}
        </div>

        {/* User Role Snippet */}
        <div className="sidebar-footer">
          <div className="user-card-snippet">
            <div className="user-avatar">EA</div>
            <div className="user-info-text">
              <strong>Enterprise Admin</strong>
              <span>admin@axiomos.local</span>
            </div>
            <span className="badge" style={{ fontSize: '9.5px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
              FULL
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="app-main-canvas" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: '100vh' }}>
        <TopBar currentView={currentView} isApiLive={isApiLive} onResetComplete={onResetComplete} onNavigate={onNavigate} />
        <div className="app-view-content" style={{ overflowY: 'auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
};
