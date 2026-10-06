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
  RiskCheckResult,
  ChatSession,
} from '../types';

let authToken = localStorage.getItem('cbos_token') || localStorage.getItem('cb_token') || '';

export function setAuthToken(token: string) {
  authToken = token;
  if (token) {
    localStorage.setItem('cbos_token', token);
    localStorage.setItem('cb_token', token);
  } else {
    localStorage.removeItem('cbos_token');
    localStorage.removeItem('cb_token');
  }
}

export function getAuthToken(): string {
  return authToken;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const csrfToken = getCookie('cb_csrf_token') || localStorage.getItem('cb_csrf_token');
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
  }

  return res.json();
}

export const apiService = {
  // Health & Overview
  async checkHealth(): Promise<{ status: string }> {
    return request<{ status: string }>('/api/v1/health');
  },

  async getKnowledgeHealth(): Promise<KnowledgeHealth> {
    return request<KnowledgeHealth>('/api/v1/knowledge/health');
  },

  // Conflicts
  async getConflicts(): Promise<{ conflicts: Conflict[] }> {
    return request<{ conflicts: Conflict[] }>('/api/v1/conflicts');
  },

  async getConflict(id: string): Promise<{ conflict: Conflict }> {
    return request<{ conflict: Conflict }>(`/api/v1/conflicts/${id}`);
  },

  async getRiskCheck(id: string): Promise<RiskCheckResult> {
    return request<RiskCheckResult>(`/api/v1/conflicts/${id}/risk-check`);
  },

  async approveConflict(id: string, reason: string = 'Approved via Enterprise Dashboard'): Promise<{ conflict: Conflict; workflows: WorkflowAction[] }> {
    return request<{ conflict: Conflict; workflows: WorkflowAction[] }>(`/api/v1/conflicts/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async rejectConflict(id: string, reason: string = 'Rejected by reviewer'): Promise<{ conflict: Conflict }> {
    return request<{ conflict: Conflict }>(`/api/v1/conflicts/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Intelligence Core (Layer 2)
  async getAgents(): Promise<{ agents: AgentProfile[] }> {
    return request<{ agents: AgentProfile[] }>('/api/v1/agents');
  },

  async getIntelligenceHealth(): Promise<IntelStats> {
    return request<IntelStats>('/api/v1/intelligence/health');
  },

  async getMemory(): Promise<MemoryData> {
    return request<MemoryData>('/api/v1/intelligence/memory');
  },

  // Processing Pipeline (Layer 3)
  async getPipelineStatus(): Promise<PipelineStatus> {
    return request<PipelineStatus>('/api/v1/pipeline/status');
  },

  // Execution (Layer 0)
  async getWorkflows(): Promise<{ workflows: WorkflowAction[] }> {
    return request<{ workflows: WorkflowAction[] }>('/api/v1/workflows');
  },

  // Audit Logs
  async getAuditLogs(): Promise<{ audit_logs: AuditLog[] }> {
    return request<{ audit_logs: AuditLog[] }>('/api/v1/audit-logs');
  },

  // Integrations (Layer 5)
  async getIntegrations(): Promise<IntegrationConnector[]> {
    return request<IntegrationConnector[]>('/api/v1/integrations');
  },

  async getSlackStatus(): Promise<{ is_connected: boolean; is_active: boolean; connection_id?: string; slack_team_id?: string; slack_user_id?: string; last_polled_at?: string; created_at?: string }> {
    return request<{ is_connected: boolean; is_active: boolean; connection_id?: string; slack_team_id?: string; slack_user_id?: string; last_polled_at?: string; created_at?: string }>('/api/slack/status');
  },

  async getGitHubStatus(): Promise<{ is_connected: boolean; is_active: boolean; connection_id?: string; github_user_id?: string; github_login?: string; synced_repos?: string[]; repo_count?: number; last_polled_at?: string; created_at?: string }> {
    return request<{ is_connected: boolean; is_active: boolean; connection_id?: string; github_user_id?: string; github_login?: string; synced_repos?: string[]; repo_count?: number; last_polled_at?: string; created_at?: string }>('/api/github/status');
  },

  async syncGitHubNow(): Promise<{ status: string; message?: string }> {
    return request<{ status: string; message?: string }>('/api/github/sync', {
      method: 'POST',
    });
  },

  async disconnectGitHub(): Promise<{ status: string; message?: string }> {
    return request<{ status: string; message?: string }>('/api/github/disconnect', {
      method: 'DELETE',
    });
  },

  async getAuthorizeUrl(provider: string): Promise<{ authorization_url: string; state: string }> {
    if (provider.toLowerCase() === 'slack') {
      return request<{ authorization_url: string; state: string }>('/api/slack/connect');
    }
    if (provider.toLowerCase() === 'github') {
      return request<{ authorization_url: string; state: string }>('/api/github/connect');
    }
    return request<{ authorization_url: string; state: string }>(`/api/v1/integrations/${provider}/authorize`);
  },

  async connectIntegration(provider: string, data: { access_token?: string; account_id?: string; account_name?: string; credentials?: Record<string, any> }): Promise<{ status: string; provider: string; message: string }> {
    return request<{ status: string; provider: string; message: string }>(`/api/v1/integrations/${provider}/connect`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async disconnectIntegration(provider: string): Promise<{ message?: string }> {
    return request<{ message?: string }>(`/api/v1/integrations/${provider}/disconnect`, {
      method: 'POST',
    });
  },

  async syncIntegration(provider: string): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>(`/api/v1/integrations/${provider}/sync`, {
      method: 'POST',
    });
  },

  async simulateIncomingEvent(payload?: {
    source?: string;
    title?: string;
    content?: string;
    author?: string;
    eventType?: string;
  }): Promise<{ ok: boolean; event: any; message: string; pipelineTriggered: boolean }> {
    return request<{ ok: boolean; event: any; message: string; pipelineTriggered: boolean }>('/api/v1/ingestion/simulate', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  // Auth & Profile
  async login(email: string = 'admin@companybrain.local', password: string = 'admin1234'): Promise<{ access_token: string; user: UserProfile }> {
    const data = await request<{ access_token: string; user: UserProfile }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  },

  async register(email: string, password: string, displayName: string, orgName?: string): Promise<{ access_token: string; user: UserProfile }> {
    const data = await request<{ access_token: string; user: UserProfile }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: displayName, organization_name: orgName || `${displayName}'s Org` }),
    });
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  },

  async verifyGoogleToken(credential: string, orgId?: string): Promise<{ access_token: string; user: UserProfile; csrf_token: string }> {
    const data = await request<{ access_token: string; user: UserProfile; csrf_token: string }>('/api/v1/auth/oauth/google/verify', {
      method: 'POST',
      body: JSON.stringify({ credential, organization_id: orgId }),
    });
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  },

  async getGoogleAuthorizeUrl(redirectUri?: string): Promise<{ authorization_url: string; state: string }> {
    const qs = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
    return request<{ authorization_url: string; state: string }>(`/api/v1/auth/oauth/google/authorize${qs}`);
  },

  async logout(): Promise<void> {
    try {
      await request('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken('');
    }
  },

  async getProfile(): Promise<UserProfile> {
    return request<UserProfile>('/api/v1/auth/me');
  },

  // Operations & Event Platform Observability (Phase 4)
  async getCanonicalEvents(params?: {
    provider?: string;
    event_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; limit: number; offset: number; events: any[] }> {
    const searchParams = new URLSearchParams();
    if (params?.provider) searchParams.set('provider', params.provider);
    if (params?.event_type) searchParams.set('event_type', params.event_type);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return request<{ total: number; limit: number; offset: number; events: any[] }>(
      `/api/v1/operations/events${qs ? `?${qs}` : ''}`
    );
  },

  async getEventLifecycle(eventId: string): Promise<any> {
    return request<any>(`/api/v1/operations/events/${eventId}`);
  },

  async getWorkerMetrics(): Promise<{ status: string; stream: string; consumer_groups: Record<string, { status: string; pending_messages: number }> }> {
    return request<{ status: string; stream: string; consumer_groups: Record<string, { status: string; pending_messages: number }> }>(
      '/api/v1/operations/workers'
    );
  },

  async getDeadLetters(params?: {
    consumer_group?: string;
    resolution_status?: string;
    limit?: number;
  }): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (params?.consumer_group) searchParams.set('consumer_group', params.consumer_group);
    if (params?.resolution_status) searchParams.set('resolution_status', params.resolution_status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return request<any[]>(`/api/v1/operations/dead-letters${qs ? `?${qs}` : ''}`);
  },

  async retryDeadLetter(dlqId: string): Promise<{ status: string; dlq_id: string; event_id: string; message: string }> {
    return request<{ status: string; dlq_id: string; event_id: string; message: string }>(
      `/api/v1/operations/dead-letters/${dlqId}/retry`,
      { method: 'POST' }
    );
  },

  async triggerReplay(payload: {
    reason: string;
    provider?: string;
    event_type?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<any> {
    return request<any>('/api/v1/operations/events/replay', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Demo Reset
  async resetDemo(): Promise<{ ok: boolean; message: string }> {
    return request<{ ok: boolean; message: string }>('/api/v1/demo/reset', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  // AI Stateful Chat & Streaming
  async sendChatMessage(payload: {
    message: string;
    session_id?: string | null;
    provider?: string;
    model?: string | null;
    api_key?: string | null;
  }): Promise<{ reply: string; engine_used: string; session_id: string; timestamp: string; sources?: any[] }> {
    return request<{ reply: string; engine_used: string; session_id: string; timestamp: string; sources?: any[] }>('/api/v1/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async streamChatMessage(
    payload: {
      message: string;
      session_id?: string | null;
      provider?: string;
      model?: string | null;
      api_key?: string | null;
    },
    onChunk: (chunkText: string) => void,
    onDone: (data: { session_id: string; title: string; engine: string; sources: any[]; full_text: string }) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const csrfToken = getCookie('cb_csrf_token') || localStorage.getItem('cb_csrf_token');
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      let res = await fetch('/api/v1/chat/stream', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      });

      // If /stream returned 405 or 404 (e.g. backend running older process before restart), fallback to standard /chat
      if (res.status === 405 || res.status === 404) {
        const fallbackData = await apiService.sendChatMessage(payload);
        // Simulate smooth stream into onChunk
        const words = fallbackData.reply.split(/(\s+)/);
        for (const w of words) {
          onChunk(w);
          await new Promise((r) => setTimeout(r, 12));
        }
        onDone({
          session_id: fallbackData.session_id,
          title: 'Conversation',
          engine: fallbackData.engine_used,
          sources: fallbackData.sources || [],
          full_text: fallbackData.reply,
        });
        return;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
      }

      if (!res.body) {
        throw new Error('Response body is null');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            if (!jsonStr) continue;
            try {
              const data = JSON.parse(jsonStr);
              if (data.error) {
                onError(new Error(data.error));
                return;
              }
              if (!data.done) {
                if (data.chunk) {
                  onChunk(data.chunk);
                }
              } else {
                onDone(data);
              }
            } catch {
              // Non-fatal parse error on partial line
            }
          }
        }
      }
    } catch (err: any) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  },


  async getChatSessions(): Promise<{ sessions: ChatSession[] }> {
    try {
      return await request<{ sessions: ChatSession[] }>('/api/v1/chat/sessions');
    } catch {
      return { sessions: [] };
    }
  },

  async getChatSession(sessionId: string): Promise<{ session_id: string; title: string; history: any[] }> {
    return request<{ session_id: string; title: string; history: any[] }>(`/api/v1/chat/session/${sessionId}`);
  },

  async createChatSession(title?: string): Promise<{ session_id: string; title: string; history: any[] }> {
    return request<{ session_id: string; title: string; history: any[] }>('/api/v1/chat/sessions/new', {
      method: 'POST',
      body: JSON.stringify({ title: title || 'New Conversation' }),
    });
  },

  async renameChatSession(sessionId: string, title: string): Promise<{ ok: boolean; session_id: string; title: string }> {
    return request<{ ok: boolean; session_id: string; title: string }>(`/api/v1/chat/session/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  },

  async deleteChatSession(sessionId: string): Promise<{ ok: boolean; session_id: string }> {
    return request<{ ok: boolean; session_id: string }>(`/api/v1/chat/session/${sessionId}`, {
      method: 'DELETE',
    });
  },
};

