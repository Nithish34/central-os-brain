export interface EvidenceItem {
  id: string;
  source: 'Slack' | 'GitHub' | 'Gmail' | 'Teams' | 'Jira' | 'Notion' | string;
  title: string;
  content: string;
  author: string;
  owner?: string;
  timestamp: string;
  authority_score: number;
  freshness_score: number;
  url?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  content: string;
  owner: string;
  source: string;
  status: string;
  timestamp: string;
  authority_score?: number;
  freshness_score?: number;
}

export interface AgentRef {
  id: string;
  name: string;
  domain: string;
  icon?: string;
}

export interface Conflict {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  domain: string;
  document_id: string;
  document?: DocumentItem;
  evidence_ids: string[];
  evidence?: EvidenceItem[];
  old_claim: string;
  new_claim: string;
  recommended_update: string;
  business_impact: string;
  owner: string;
  status: 'open' | 'approved' | 'rejected' | 'resolved';
  confidence: number;
  contradiction_score?: number;
  freshness_delta?: number;
  authority_delta?: number;
  detected_by?: string;
  detected_by_agent?: AgentRef;
  risk_level?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  approval_matrix?: string;
  reasoning?: string;
}

export interface RiskCheckRule {
  rule: string;
  passed: boolean;
  severity: string;
}

export interface RiskCheckResult {
  conflict_id: string;
  approved_to_proceed: boolean;
  risk_level: string;
  required_approver: string;
  rules: RiskCheckRule[];
  escalation_path?: string;
}

export interface KnowledgeHealth {
  knowledge_health: number;
  open_conflicts: number;
  stale_documents: number;
  automated_workflows: number;
  last_scan?: string;
  system_status?: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  domain: string;
  description: string;
  status: 'active' | 'idle' | 'running' | 'degraded';
  icon: string;
  conflicts_detected: number;
  tasks_completed: number;
  memory_entries: number;
}

export interface IntelStats {
  rag_engine: {
    total_chunks: number;
    documents_indexed: number;
    events_indexed: number;
    embedding_model: string;
  };
  knowledge_graph: {
    nodes: number;
    edges: number;
    backend: string;
  };
  conflict_detection: {
    conflicts_found: number;
    avg_contradiction: number;
  };
  memory_store: {
    short_term_count: number;
    long_term_count: number;
  };
}

export interface CompanyContextItem {
  key: string;
  value: string;
  authority: string;
}

export interface MemoryData {
  company_context: CompanyContextItem[];
}

export interface PipelineComponent {
  backend: string;
  status: string;
  messages_processed?: number;
  throughput_per_min?: number;
  tasks_completed?: number;
  workers_online?: number;
  events_routed?: number;
  pipelines_active?: number;
  routing_rules?: number;
  runs_total?: number;
  steps_per_run?: number;
}

export interface EventStageItem {
  id: string;
  source: string;
  title: string;
  author: string;
  content: string;
  type: string;
  stage: string;
  ts: string;
}

export interface PipelineStatus {
  event_bus: PipelineComponent;
  background_workers: PipelineComponent;
  event_router: PipelineComponent;
  pipeline_orchestrator: PipelineComponent;
  event_stages: EventStageItem[];
}

export interface WorkflowAction {
  id: string;
  conflict_id: string;
  tool: string;
  title: string;
  description: string;
  status: 'completed' | 'running' | 'pending' | 'failed';
  layer: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: 'approved' | 'rejected' | 'reopened' | 'updated' | string;
  title: string;
  timestamp: string;
  evidence_count: number;
  risk_level?: string;
}

export interface IntegrationConnector {
  provider: string;
  name: string;
  icon: string;
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
  account_name?: string;
  events_ingested: number;
  last_sync: string;
  webhook_endpoint: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  permissions: string[];
}

export interface ChatCitation {
  document_id: string;
  title: string;
  source?: string;
  owner?: string;
  score: number;
  snippet?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'bot';
  text: string;
  timestamp?: string;
  engine?: string;
  sources?: ChatCitation[];
  isStreaming?: boolean;
}

export interface ChatSession {
  session_id: string;
  title: string;
  message_count: number;
  last_active: string;
  created_at: string;
  preview?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'error' | 'warning';
  message: string;
}

