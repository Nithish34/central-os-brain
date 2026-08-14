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

let authToken = localStorage.getItem('cbos_token') || '';

export function setAuthToken(token: string) {
  authToken = token;
  if (token) {
    localStorage.setItem('cbos_token', token);
  } else {
    localStorage.removeItem('cbos_token');
  }
}

export function getAuthToken(): string {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(path, {
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

  async syncIntegration(provider: string): Promise<{ status: string; message: string }> {
    return request<{ status: string; message: string }>(`/api/v1/integrations/${provider}/sync`, {
      method: 'POST',
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

  async getProfile(): Promise<UserProfile> {
    return request<UserProfile>('/api/v1/auth/me');
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

      let res = await fetch('/api/v1/chat/stream', {
        method: 'POST',
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

