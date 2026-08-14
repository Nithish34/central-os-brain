import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider } from './components/ui/ToastContainer';
import { AppShell } from './components/layout/AppShell';
import { CommandCenterView } from './components/views/CommandCenterView';
import { ConflictInboxView } from './components/views/ConflictInboxView';
import { IntelligenceView } from './components/views/IntelligenceView';
import { PipelineView } from './components/views/PipelineView';
import { ExecutionView } from './components/views/ExecutionView';
import { AuditView } from './components/views/AuditView';
import { IntegrationsView } from './components/views/IntegrationsView';
import { SettingsView } from './components/views/SettingsView';
import { ProfileView } from './components/views/ProfileView';
import { LandingPage } from './components/landing/LandingPage';
import { FloatingChatWidget } from './components/chat/FloatingChatWidget';
import { apiService } from './services/api';
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
    return hash || 'chat';
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

  // Hash change listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || 'chat';
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

  // Initial Boot & Live Polling Loop (every 3.5 seconds)
  useEffect(() => {
    // Bootstrap login
    apiService.login().then((data) => {
      if (data?.user) setUserProfile(data.user);
    }).catch(() => {});

    refreshAll();

    const interval = setInterval(() => {
      refreshAll();
    }, 3500);

    return () => clearInterval(interval);
  }, [refreshAll]);

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
      case 'intelligence':
        return (
          <IntelligenceView
            intelStats={intelStats}
            agents={agents}
            memory={memory}
          />
        );
      case 'pipeline':
        return <PipelineView pipeline={pipeline} />;
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
          />
        );
      case 'settings':
        return <SettingsView />;
      case 'profile':
        return <ProfileView user={userProfile} />;
      default:
        return (
          <CommandCenterView
            onNavigateInbox={() => handleNavigate('inbox')}
            onRefreshAll={refreshAll}
          />
        );
    }
  };

  if (currentView === 'landing') {
    return <LandingPage onLaunchApp={(target) => handleNavigate(target || 'chat')} />;
  }

  return (
    <AppShell
      currentView={currentView}
      onNavigate={handleNavigate}
      isApiLive={isApiLive}
      openConflictsCount={health?.open_conflicts || conflicts.filter((c) => c.status === 'open').length}
      onResetComplete={refreshAll}
    >
      {renderActiveView()}

      <FloatingChatWidget
        currentView={currentView}
        onOpenFullChat={() => handleNavigate('chat')}
        onRefreshAll={refreshAll}
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
