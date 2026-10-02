import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider } from './components/ui/ToastContainer';
import { AppShell } from './components/layout/AppShell';
import { CommandCenterView } from './components/views/CommandCenterView';
import { ConflictInboxView } from './components/views/ConflictInboxView';
import { IntelligenceView } from './components/views/IntelligenceView';
import { ExploreView } from './components/views/ExploreView';
import { PipelineView } from './components/views/PipelineView';
import { ExecutionView } from './components/views/ExecutionView';
import { AuditView } from './components/views/AuditView';
import { IntegrationsView } from './components/views/IntegrationsView';
import { OperationsView } from './components/views/OperationsView';
import { SettingsView } from './components/views/SettingsView';
import { HelpView } from './components/views/HelpView';
import { ProfileView } from './components/views/ProfileView';
import { LandingPage } from './components/landing/LandingPage';
import { FloatingChatWidget } from './components/chat/FloatingChatWidget';
import { AuthModal } from './components/auth/AuthModal';
import { AuthPage } from './components/auth/AuthPage';
import { apiService, setAuthToken } from './services/api';
import {
  Conflict,
  KnowledgeHealth,
  AgentProfile,
  IntelStats,
  MemoryData,
  PipelineStatus,
  WorkflowAction,
  AuditLog,
  IntegrationConnector,
  UserProfile,
} from './types';

export const AppContent: React.FC = () => {
  // Navigation State (hash-based)
  const [currentView, setCurrentView] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    // Show landing page on fresh load (no hash), otherwise restore the hashed view
    return hash || 'landing';
  });

  // Domain State
  const [isApiLive, setIsApiLive] = useState<boolean>(false);
  const [health, setHealth] = useState<KnowledgeHealth | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [intelStats, setIntelStats] = useState<IntelStats | null>(null);
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStatus | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowAction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConnector[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Check OAuth callback in URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDesc = urlParams.get('error_description');

    if (error) {
      console.error('OAuth error from provider:', error, errorDesc);
      window.history.replaceState({}, document.title, window.location.pathname + '#auth');
      return;
    }

    if (token) {
      setAuthToken(token);
      apiService.getProfile().then((user) => {
        if (user) {
          setUserProfile(user);
          window.history.replaceState({}, document.title, window.location.pathname + '#chat');
          handleNavigate('chat');
        }
      }).catch((err) => {
        console.error('Failed to load profile from OAuth token:', err);
        window.history.replaceState({}, document.title, window.location.pathname + '#auth');
      });
      return;
    }

    if (code && state) {
      fetch(`/api/v1/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
        headers: { Accept: 'application/json' },
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'OAuth authentication failed' }));
            throw new Error(err.detail || 'OAuth callback exchange failed');
          }
          return res.json();
        })
        .then((data) => {
          if (data?.user) {
            if (data.access_token) {
              setAuthToken(data.access_token);
            }
            setUserProfile(data.user);
            window.history.replaceState({}, document.title, window.location.pathname + '#chat');
            handleNavigate('chat');
          }
        })
        .catch((err) => {
          console.error('OAuth callback exchange failed:', err);
          window.history.replaceState({}, document.title, window.location.pathname + '#auth');
        });
    }
  }, []);

  // Hash change listener
  useEffect(() => {
    const handleHashChange = () => {
      // No hash = user navigated back to root → show landing page
      const hash = window.location.hash.replace('#', '') || 'landing';
      setCurrentView(hash);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (view: string) => {
    window.location.hash = `#${view}`;
    setCurrentView(view);
  };

  // Fetch all domain data
  const refreshAll = useCallback(async () => {
    try {
      await apiService.checkHealth();
      setIsApiLive(true);
    } catch {
      setIsApiLive(false);
    }

    try {
      const [
        hRes,
        cRes,
        aRes,
        iRes,
        mRes,
        pRes,
        wRes,
        audRes,
        intRes,
      ] = await Promise.allSettled([
        apiService.getKnowledgeHealth(),
        apiService.getConflicts(),
        apiService.getAgents(),
        apiService.getIntelligenceHealth(),
        apiService.getMemory(),
        apiService.getPipelineStatus(),
        apiService.getWorkflows(),
        apiService.getAuditLogs(),
        apiService.getIntegrations(),
      ]);

      if (hRes.status === 'fulfilled') setHealth(hRes.value);
      if (cRes.status === 'fulfilled') setConflicts(cRes.value.conflicts || []);
      if (aRes.status === 'fulfilled') setAgents(aRes.value.agents || []);
      if (iRes.status === 'fulfilled') setIntelStats(iRes.value);
      if (mRes.status === 'fulfilled') setMemory(mRes.value);
      if (pRes.status === 'fulfilled') setPipeline(pRes.value);
      if (wRes.status === 'fulfilled') setWorkflows(wRes.value.workflows || []);
      if (audRes.status === 'fulfilled') setAuditLogs(audRes.value.audit_logs || []);
      if (intRes.status === 'fulfilled') setIntegrations(intRes.value || []);
    } catch (err) {
      console.error('Error refreshing domain state:', err);
    }
  }, []);

  // Initial Boot & Smart Polling Loop
  useEffect(() => {
    // Validate active session token if present
    const storedToken = localStorage.getItem('cb_token');
    const storedAvatar = localStorage.getItem('cb_user_avatar');
    if (storedToken) {
      apiService.getProfile().then((user) => {
        if (user) {
          setUserProfile({
            ...user,
            avatar_url: user.avatar_url || storedAvatar || undefined,
          });
        }
      }).catch(() => {
        localStorage.removeItem('cb_token');
        setUserProfile(null);
      });
    }

    // Only refresh domain data if not on landing/auth page
    if (currentView !== 'landing' && currentView !== 'auth') {
      refreshAll();
    }

    const interval = setInterval(() => {
      // Don't poll in background tabs or on public landing/auth pages
      if (document.hidden || currentView === 'landing' || currentView === 'auth') {
        return;
      }
      refreshAll();
    }, 15000);

    const handleVisibilityChange = () => {
      if (!document.hidden && currentView !== 'landing' && currentView !== 'auth') {
        refreshAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshAll, currentView]);

  const renderActiveView = () => {
    switch (currentView) {
      case 'chat':
        return (
          <CommandCenterView
            onNavigateInbox={() => handleNavigate('inbox')}
            onRefreshAll={refreshAll}
          />
        );
      case 'inbox':
        return (
          <ConflictInboxView
            conflicts={conflicts}
            health={health}
            activeAgentsCount={agents.filter((a) => a.status === 'active').length}
            onRefreshAll={refreshAll}
            onNavigateExecution={() => handleNavigate('execution')}
          />
        );
      case 'explore':
        return <ExploreView memory={memory} intelStats={intelStats} />;
      case 'intelligence':
        // Engine Room — technical internals view (Admin/Engineer only via System nav)
        return (
          <IntelligenceView
            intelStats={intelStats}
            agents={agents}
            memory={memory}
          />
        );
      case 'operations':
        return <OperationsView />;
      case 'pipeline':
        return <PipelineView pipeline={pipeline} onRefreshAll={refreshAll} />;
      case 'execution':
        return (
          <ExecutionView
            workflows={workflows}
            onNavigateInbox={() => handleNavigate('inbox')}
          />
        );
      case 'audit':
        return <AuditView auditLogs={auditLogs} />;
      case 'integrations':
        return (
          <IntegrationsView
            integrations={integrations}
            onRefreshAll={refreshAll}
            onNavigate={handleNavigate}
          />
        );
      case 'settings':
        return (
          <SettingsView
            currentUser={userProfile}
            onUpdateProfile={(updated) => {
              if (updated.avatar_url !== undefined) {
                if (updated.avatar_url) {
                  localStorage.setItem('cb_user_avatar', updated.avatar_url);
                } else {
                  localStorage.removeItem('cb_user_avatar');
                }
              }
              setUserProfile((prev) => (prev ? { ...prev, ...updated } : (updated as UserProfile)));
            }}
            onSignOut={() => {
              localStorage.removeItem('cb_token');
              localStorage.removeItem('cb_user_avatar');
              setUserProfile(null);
              handleNavigate('auth');
            }}
          />
        );
      case 'help':
        return <HelpView onNavigate={handleNavigate} />;
      case 'profile':
        return <ProfileView user={userProfile} />;
      default:
        // Default landing is Ask (Chat)
        return (
          <CommandCenterView
            onNavigateInbox={() => handleNavigate('inbox')}
            onRefreshAll={refreshAll}
          />
        );
    }
  };

  // Dedicated Login / Register View
  if (currentView === 'login' || currentView === 'signup' || currentView === 'register' || currentView === 'auth') {
    return (
      <AuthPage
        initialMode={currentView === 'signup' || currentView === 'register' ? 'register' : 'login'}
        currentUser={userProfile}
        onAuthSuccess={(u) => {
          setUserProfile(u);
          handleNavigate('chat');
          refreshAll();
        }}
        onNavigateHome={() => handleNavigate('landing')}
      />
    );
  }

  if (currentView === 'landing') {
    return (
      <LandingPage
        currentUser={userProfile}
        onLaunchApp={(target) => {
          // Navigate into the dashboard or target view
          handleNavigate(target || 'chat');
        }}
      />
    );
  }

  return (
    <AppShell
      currentView={currentView}
      onNavigate={handleNavigate}
      isApiLive={isApiLive}
      openConflictsCount={health?.open_conflicts || conflicts.filter((c) => c.status === 'open').length}
      onResetComplete={refreshAll}
      currentUser={userProfile}
      onOpenAuth={() => setIsAuthModalOpen(true)}
    >
      {renderActiveView()}

      <FloatingChatWidget
        currentView={currentView}
        onOpenFullChat={() => handleNavigate('chat')}
        onRefreshAll={refreshAll}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={userProfile}
        onAuthSuccess={(u) => {
          setUserProfile(u);
          refreshAll();
        }}
      />
    </AppShell>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
