import './IntelligenceView.view.css';
import React from 'react';
import { Database, Network, Target, BrainCircuit, Sparkles } from 'lucide-react';
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
    <div className="view-container iv-view">
      <header className="iv-page-header">
        <div className="iv-header-copy">
          <span className="iv-eyebrow">Intelligence · Layer 2 Core</span>
          <h1 className="iv-page-title">Intelligence</h1>
          <p className="iv-page-sub">
            Vector retrieval, knowledge graph topology, and autonomous reasoning agents.
          </p>
        </div>

        <div className="iv-header-aside">
          <span className="layer-chip l2">LAYER 2 INTELLIGENCE SYSTEM</span>
          <span className="badge">{agents.length} Agents Registered</span>
        </div>
      </header>

      <section className="iv-section">
        <div className="iv-section-head">
          <div className="iv-section-head-copy">
            <span className="iv-section-eyebrow">01 / Subsystems</span>
            <h2 className="iv-section-title">Platform Telemetry</h2>
            <p className="iv-section-sub">
              Metrics across retrieval, graph memory, and conflict detection.
            </p>
          </div>
        </div>

        <div className="intel-stats-grid">
          <div className="intel-stat-card">
            <div className="intel-stat-head">
              <div className="iv-stat-titles">
                <span className="iv-stat-code">RAG · Vector</span>
                <span className="iv-stat-name">RAG Vector Engine</span>
              </div>
              <Database size={16} color="#3b82f6" />
            </div>
            <div className="intel-stat-val">{rag ? rag.total_chunks : 124}</div>
            <div className="intel-stat-sub">
              {rag ? `${rag.documents_indexed} docs · ${rag.events_indexed} events` : 'pgvector 1536-dim embeddings'}
            </div>
          </div>

          <div className="intel-stat-card">
            <div className="intel-stat-head">
              <div className="iv-stat-titles">
                <span className="iv-stat-code">KG · Graph</span>
                <span className="iv-stat-name">Knowledge Graph</span>
              </div>
              <Network size={16} color="#8b5cf6" />
            </div>
            <div className="intel-stat-val">{kg ? kg.nodes : 48}</div>
            <div className="intel-stat-sub">
              {kg ? `${kg.edges} relationship edges · ${kg.backend}` : 'Neo4j Graph Topology'}
            </div>
          </div>

          <div className="intel-stat-card">
            <div className="intel-stat-head">
              <div className="iv-stat-titles">
                <span className="iv-stat-code">CD · Detect</span>
                <span className="iv-stat-name">Conflict Detector</span>
              </div>
              <Target size={16} color="#f59e0b" />
            </div>
            <div className="intel-stat-val">{cd ? cd.conflicts_found : 3}</div>
            <div className="intel-stat-sub">
              {cd ? `Avg contradiction ${Math.round(cd.avg_contradiction * 100)}%` : 'Semantic drift listener'}
            </div>
          </div>

          <div className="intel-stat-card">
            <div className="intel-stat-head">
              <div className="iv-stat-titles">
                <span className="iv-stat-code">MEM · Store</span>
                <span className="iv-stat-name">Memory Store</span>
              </div>
              <BrainCircuit size={16} color="#10b981" />
            </div>
            <div className="intel-stat-val">{mem ? mem.short_term_count + mem.long_term_count : 18}</div>
            <div className="intel-stat-sub">
              {mem ? `${mem.short_term_count} short-term · ${mem.long_term_count} long-term` : 'Hierarchical context buffer'}
            </div>
          </div>
        </div>
      </section>

      <section className="iv-section">
        <div className="iv-section-head">
          <div className="iv-section-head-copy">
            <span className="iv-section-eyebrow">02 / Roster</span>
            <h2 className="iv-section-title">Autonomous Agents</h2>
            <p className="iv-section-sub">
              Domain-specialized agents monitoring contradictions and graph state.
            </p>
          </div>
          <span className="iv-section-aside badge">{agents.length} Active Roster</span>
        </div>

        {agents.length > 0 ? (
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
                  <div className="iv-stat-mini">
                    <strong>{agent.conflicts_detected}</strong>
                    <span>Flagged</span>
                  </div>
                  <div className="iv-stat-mini">
                    <strong>{agent.tasks_completed}</strong>
                    <span>Tasks</span>
                  </div>
                  <div className="iv-stat-mini">
                    <strong>{agent.memory_entries ?? 0}</strong>
                    <span>Memory</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="iv-empty">
            <Sparkles size={26} className="iv-empty-icon" />
            <span className="iv-empty-code">No Agents Registered</span>
            <p>The registry is empty — deploy domain specialists to start watching for drift.</p>
          </div>
        )}
      </section>

      <section className="iv-section">
        <div className="iv-section-head">
          <div className="iv-section-head-copy">
            <span className="iv-section-eyebrow">03 / Context Store</span>
            <h2 className="iv-section-title">Organizational Context &amp; Authority Memory</h2>
            <p className="iv-section-sub">
              Canonical enterprise values with designated validation authority — the source of
              truth every agent checks before flagging.
            </p>
          </div>
          <span className="iv-section-aside layer-chip l2">MEMORY</span>
        </div>

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
                  <td className="iv-ctx-key">{c.key}</td>
                  <td>{c.value}</td>
                  <td>
                    <span className="badge ok">
                      {c.authority || 'Verified'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
