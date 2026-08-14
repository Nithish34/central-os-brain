import React from 'react';
import { Sparkles, Database, Network, Target, BrainCircuit } from 'lucide-react';
import { IntelStats, AgentProfile, MemoryData } from '../../types';

interface IntelligenceViewProps {
  intelStats: IntelStats | null;
  agents: AgentProfile[];
  memory: MemoryData | null;
}

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({ intelStats, agents, memory }) => {
  const rag = intelStats?.rag_engine;
  const kg = intelStats?.knowledge_graph;
  const cd = intelStats?.conflict_detection;
  const mem = intelStats?.memory_store;

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span className="layer-chip l2">LAYER 2 INTELLIGENCE SYSTEM</span>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
            Autonomous Multi-Agent Core &amp; Memory Store
          </h2>
        </div>
      </div>

      {/* Subsystem Metric Cards */}
      <div className="intel-stats-grid">
        <div className="intel-stat-card">
          <div className="intel-stat-head">
            <span>RAG Vector Engine</span>
            <Database size={16} color="#3b82f6" />
          </div>
          <div className="intel-stat-val">{rag ? rag.total_chunks : 124}</div>
          <div className="intel-stat-sub">
            {rag ? `${rag.documents_indexed} docs · ${rag.events_indexed} events` : 'pgvector 1536-dim embeddings'}
          </div>
        </div>

        <div className="intel-stat-card">
          <div className="intel-stat-head">
            <span>Knowledge Graph</span>
            <Network size={16} color="#8b5cf6" />
          </div>
          <div className="intel-stat-val">{kg ? kg.nodes : 48}</div>
          <div className="intel-stat-sub">
            {kg ? `${kg.edges} relationship edges · ${kg.backend}` : 'Neo4j Graph Topology'}
          </div>
        </div>

        <div className="intel-stat-card">
          <div className="intel-stat-head">
            <span>Conflict Detector</span>
            <Target size={16} color="#f59e0b" />
          </div>
          <div className="intel-stat-val">{cd ? cd.conflicts_found : 3}</div>
          <div className="intel-stat-sub">
            {cd ? `Avg contradiction ${Math.round(cd.avg_contradiction * 100)}%` : 'Semantic drift listener'}
          </div>
        </div>

        <div className="intel-stat-card">
          <div className="intel-stat-head">
            <span>Memory Store</span>
            <BrainCircuit size={16} color="#10b981" />
          </div>
          <div className="intel-stat-val">{mem ? mem.short_term_count + mem.long_term_count : 18}</div>
          <div className="intel-stat-sub">
            {mem ? `${mem.short_term_count} short-term · ${mem.long_term_count} long-term` : 'Hierarchical context buffer'}
          </div>
        </div>
      </div>

      {/* Domain-Specialized Autonomous Agents Grid */}
      <div style={{ display: 'grid', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Domain-Specialized Autonomous Agents</h3>

        <div className="agent-cards-grid">
          {agents.map((agent) => (
            <div key={agent.id} className="agent-card">
              <div className="agent-card-head">
                <div className="agent-icon-box">{agent.icon || '🤖'}</div>
                <div className="agent-card-title">
                  <h4>{agent.name}</h4>
                  <span>{agent.domain}</span>
                </div>
                <span className={`badge ${agent.status}`}>{agent.status.toUpperCase()}</span>
              </div>

              <p className="agent-card-desc">{agent.description}</p>

              <div className="agent-card-stats">
                <span><strong>{agent.conflicts_detected}</strong> conflicts flagged</span>
                <span><strong>{agent.tasks_completed}</strong> tasks completed</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Organizational Context & Memory Explorer */}
      <div style={{ display: 'grid', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Organizational Context &amp; Authority Memory Table</h3>

        <div className="data-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Context Key</th>
                <th>Canonical Enterprise Value</th>
                <th>Validation Authority</th>
              </tr>
            </thead>
            <tbody>
              {(memory?.company_context || [
                { key: 'auth_provider_internal', value: 'OAuth2 Client Credentials (Migrated from JWT)', authority: 'Platform Engineering Lead' },
                { key: 'deployment_cadence_prod', value: 'Tuesday & Thursday 12:00 PM UTC', authority: 'Release Engineering' },
                { key: 'enterprise_onboarding_lead', value: 'Implementation Squad for ACV > Rs. 25L', authority: 'RevOps Lead' },
              ]).map((c, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', color: '#60a5fa', fontWeight: 600 }}>{c.key}</td>
                  <td>{c.value}</td>
                  <td>
                    <span className="badge ok" style={{ fontSize: '11px' }}>
                      {c.authority || 'Verified'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
