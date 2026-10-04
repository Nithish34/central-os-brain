import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Bell,
  BookOpen,
  Activity,
  Layers,
  Workflow,
  ShieldCheck,
  Plug,
  Settings,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Cpu,
  HelpCircle,
  Sun,
  Moon,
  Search,
} from 'lucide-react';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { UserProfile } from '../../types';

interface AppShellProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isApiLive: boolean;
  openConflictsCount: number;
  onResetComplete: () => void;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  children: React.ReactNode;
}

/**
 * Roles that can access the System / Engine Room nav group.
 */
const SYSTEM_ROLES = new Set(['owner', 'admin', 'manager', 'engineer', 'compliance', 'devops']);

function hasSystemAccess(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  return SYSTEM_ROLES.has(role);
}

const SYSTEM_VIEW_IDS = [
  'intelligence', 'operations', 'pipeline', 'execution',
  'audit', 'profile',
];

export const AppShell: React.FC<AppShellProps> = ({
  currentView,
  onNavigate,
  isApiLive,
  openConflictsCount,
  onResetComplete,
  currentUser,
  onOpenAuth,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Theme state: default dark, persisted to localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('cbos_theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cbos_theme', theme);
  }, [theme]);

  const canSeeSystem = hasSystemAccess(currentUser);

  // System group: start closed or open if viewing system item
  const [systemGroupOpen, setSystemGroupOpen] = useState(() => false);

  useEffect(() => {
    if (SYSTEM_VIEW_IDS.includes(currentView) && canSeeSystem) {
      setSystemGroupOpen(true);
    }
  }, [currentView, canSeeSystem]);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /** ── Workspace primary nav items ── */
  const primaryItems = [
    {
      id: 'chat',
      label: 'Ask',
      sublabel: 'Get answers instantly',
      icon: <MessageSquare size={16} />,
      badge: null as React.ReactNode,
    },
    {
      id: 'inbox',
      label: 'Review',
      sublabel: 'Needs Your Attention',
      icon: <Bell size={16} />,
      badge:
        openConflictsCount > 0 ? (
          <span className="nav-badge-count">{openConflictsCount}</span>
        ) : null,
    },
    {
      id: 'explore',
      label: 'Explore',
      sublabel: 'What We Know',
      icon: <BookOpen size={16} />,
      badge: null as React.ReactNode,
    },
    {
      id: 'integrations',
      label: 'Connections',
      sublabel: 'Slack, Notion, GitHub',
      icon: <Plug size={16} />,
      badge: null as React.ReactNode,
    },
  ];

  /** ── Settings & Help subgroup ── */
  const secondaryItems = [
    {
      id: 'settings',
      label: 'Settings',
      sublabel: null,
      icon: <Settings size={15} />,
      badge: null as React.ReactNode,
    },
    {
      id: 'help',
      label: 'Help & Docs',
      sublabel: null,
      icon: <HelpCircle size={15} />,
      badge: null as React.ReactNode,
    },
  ];

  /** ── System (Engine Room) nav items — role-gated ── */
  const systemItems = [
    {
      id: 'intelligence',
      label: 'AI Agents & Memory',
      sublabel: null as string | null,
      icon: <Cpu size={15} />,
      badge: null as React.ReactNode,
    },
    {
      id: 'operations',
      label: 'Event Operations',
      sublabel: null as string | null,
      icon: <Activity size={15} />,
      badge: null as React.ReactNode,
    },
    {
      id: 'pipeline',
      label: 'Live Stream',
      sublabel: null as string | null,
      icon: <Layers size={15} />,
      badge: null as React.ReactNode,
    },
    {
      id: 'execution',
      label: 'Automated Actions',
      sublabel: null as string | null,
      icon: <Workflow size={15} />,
      badge: null as React.ReactNode,
    },
    {
      id: 'audit',
      label: 'Security & Logs',
      sublabel: null as string | null,
      icon: <ShieldCheck size={15} />,
      badge: null as React.ReactNode,
    },
    {
      id: 'profile',
      label: 'Team & Access',
      sublabel: null as string | null,
      icon: <UserCheck size={15} />,
      badge: null as React.ReactNode,
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

        {/* Brand */}
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
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="brand-text">
              <strong>Axiom OS</strong>
              <span>Ground Truth 2.0</span>
            </div>
          </a>
        </div>

        {/* Nav */}
        <div className="sidebar-nav-section">
          {/* Top Search Button */}
          {/* Top Search Button */}
          <button
            className="sidebar-search-btn"
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Global search across all documents and systems (⌘K)"
          >
            <span className="sidebar-search-icon">
              <Search size={15} />
            </span>
            <span className="sidebar-search-label">Search</span>
            <kbd className="sidebar-search-kbd">⌘K</kbd>
          </button>

          {/* ── Workspace Primary group ── */}
          <span className="nav-group-label">Workspace</span>

          {primaryItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-btn ${currentView === item.id ? 'active' : ''}`}
              onClick={() => handleLinkClick(item.id)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-text">
                <span className="sidebar-nav-label">{item.label}</span>
                {item.sublabel && (
                  <span className="sidebar-nav-sublabel">{item.sublabel}</span>
                )}
              </span>
              {item.badge}
            </button>
          ))}

          {/* ── Settings & Help Subgroup ── */}
          <div className="sidebar-subgroup">
            <span className="nav-group-label">Settings & Help</span>
            {secondaryItems.map((item) => (
              <button
                key={item.id}
                className={`sidebar-nav-btn ${currentView === item.id ? 'active' : ''}`}
                onClick={() => handleLinkClick(item.id)}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                <span className="sidebar-nav-text">
                  <span className="sidebar-nav-label">{item.label}</span>
                </span>
                {item.badge}
              </button>
            ))}
          </div>

          {/* ── System group (role-gated) ── */}
          {canSeeSystem && (
            <div className="sidebar-system-group">
              <button
                className="sidebar-system-toggle"
                onClick={() => setSystemGroupOpen((prev) => !prev)}
                aria-expanded={systemGroupOpen}
              >
                <span className="nav-group-label">System / Advanced</span>
                {systemGroupOpen
                  ? <ChevronDown size={12} className="sidebar-toggle-chevron" />
                  : <ChevronRight size={12} className="sidebar-toggle-chevron" />
                }
              </button>

              {systemGroupOpen && (
                <div className="sidebar-system-items anim-fade-in">
                  {systemItems.map((item) => (
                    <button
                      key={item.id}
                      className={`sidebar-nav-btn sidebar-nav-btn--system ${currentView === item.id ? 'active' : ''}`}
                      onClick={() => handleLinkClick(item.id)}
                    >
                      <span className="sidebar-nav-icon">{item.icon}</span>
                      <span className="sidebar-nav-text">
                        <span className="sidebar-nav-label">{item.label}</span>
                        {item.sublabel && (
                          <span className="sidebar-nav-sublabel">{item.sublabel}</span>
                        )}
                      </span>
                      {item.badge}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — Theme Toggle + user card */}
        <div className="sidebar-footer">
          {/* Light / Dark Dual Switcher */}
          <div className="sidebar-theme-toggle-wrap">
            <button
              className={`sidebar-theme-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light')}
              title="Switch to Light Theme"
            >
              <Sun size={13} />
              <span>Light</span>
            </button>
            <button
              className={`sidebar-theme-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark')}
              title="Switch to Dark Theme"
            >
              <Moon size={13} />
              <span>Dark</span>
            </button>
          </div>

          <div
            className="user-card-snippet"
            onClick={onOpenAuth}
            style={{ cursor: onOpenAuth ? 'pointer' : 'default' }}
            title="Account & Authentication"
          >
            <div className="user-avatar" style={{ overflow: 'hidden' }}>
              {(currentUser?.avatar_url || localStorage.getItem('cb_user_avatar')) ? (
                <img
                  src={currentUser?.avatar_url || localStorage.getItem('cb_user_avatar') || ''}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : currentUser?.display_name ? (
                currentUser.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
              ) : (
                currentUser?.email ? currentUser.email.slice(0, 2).toUpperCase() : 'U'
              )}
            </div>
            <div className="user-info-text">
              <strong>{currentUser?.display_name || (currentUser?.email ? currentUser.email.split('@')[0] : 'Guest User')}</strong>
              <span>{currentUser?.email || 'Not signed in'}</span>
            </div>
            {currentUser?.role && (
              <span
                className="badge"
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: currentUser?.role === 'admin' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                  color: currentUser?.role === 'admin' ? '#34d399' : '#60a5fa',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {currentUser.role}
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main
        className="app-main-canvas"
        style={{ display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: '100vh' }}
      >
        <TopBar
          currentView={currentView}
          isApiLive={isApiLive}
          onResetComplete={onResetComplete}
          onNavigate={onNavigate}
          currentUser={currentUser}
          onOpenAuth={onOpenAuth}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />
        <div className="app-view-content" style={{ overflowY: 'auto' }}>
          {children}
        </div>
      </main>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={onNavigate}
        onOpenAuth={onOpenAuth}
      />
    </div>
  );
};
export default AppShell;
