import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  GitPullRequest,
  MessageSquare,
  FileText,
  Lock,
  Server,
  Calculator,
  Terminal,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  Eye,
  Check,
  Building2,
  Users,
  Clock,
  TrendingUp,
  Play,
  Sliders,
  HelpCircle,
  ChevronDown,
  Quote,
  Flame,
  Network,
  Share2,
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: (targetView?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  // Rotator text for hero headline
  const [rotatorIndex, setRotatorIndex] = useState(0);
  const rotatorTexts = [
    'Stops Documentation Drift.',
    'Resolves Tribal Slack Knowledge.',
    'Prevents Costly Outages.',
    'Automates Multi-System Patches.',
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setRotatorIndex((prev) => (prev + 1) % rotatorTexts.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  // Interactive Live Walkthrough Step State
  const [activeStep, setActiveStep] = useState<number>(0);

  // Scenario state for Interactive Contradiction Simulator
  const [selectedScenario, setSelectedScenario] = useState<number>(0);
  const [simulatedResolved, setSimulatedResolved] = useState<boolean>(false);
  const [activeArchLayer, setActiveArchLayer] = useState<number>(0);

  // ROI Calculator states
  const [engineersCount, setEngineersCount] = useState<number>(65);
  const [hoursWastedPerWeek, setHoursWastedPerWeek] = useState<number>(4.5);
  const [hourlyRate, setHourlyRate] = useState<number>(110);

  // Compute ROI
  const annualHoursSaved = Math.round(engineersCount * hoursWastedPerWeek * 50 * 0.78);
  const annualDollarsSaved = Math.round(annualHoursSaved * hourlyRate);

  // FAQ Accordion open/close state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Canvas particle mesh background
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes
    const particleCount = Math.min(width > 768 ? 55 : 25, 60);
    const particles: { x: number; y: number; vx: number; vy: number; radius: number; color: string }[] = [];
    const colors = ['rgba(59, 130, 246, ', 'rgba(6, 182, 212, ', 'rgba(52, 211, 153, '];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}0.7)`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const triggerCelebration = () => {
    setSimulatedResolved(true);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#3b82f6', '#10b981', '#38bdf8', '#fbbf24', '#a855f7'],
    });
  };

  const scenarios = [
    {
      id: 0,
      title: 'Payment API Token Mismatch',
      sourceIcon: '💬',
      source: 'Slack #engineering-core',
      sourceTime: '12 mins ago',
      sourceText: 'We migrated the payment webhook endpoint to HMAC-SHA256 headers last night. Deprecated old bearer tokens.',
      docTitle: 'Architecture Spec: Payments v2.1',
      docLastUpdated: '14 days ago',
      docText: 'All payment webhooks authenticate using static Bearer Token passed via Authorization header.',
      confidence: 88,
      risk: 'HIGH',
      agent: 'Engineering Domain Agent',
      patchDiff: {
        removed: '- Authentication: Static Bearer Token in Authorization header',
        added: '+ Authentication: HMAC-SHA256 header (X-Signature-SHA256) with rotating secret',
      },
      affectedSystems: ['Confluence Docs', 'Jira DEV-842', 'GitHub PR #492', 'Slack Alert'],
    },
    {
      id: 1,
      title: 'Database Replication Policy Drift',
      sourceIcon: '🐙',
      source: 'GitHub PR #482 (Merged)',
      sourceTime: '2 hours ago',
      sourceText: 'Changed multi-region replica lag tolerance from 500ms to 120ms to support EU compliance requirements.',
      docTitle: 'Infrastructure Runbook: PostgreSQL Cluster',
      docLastUpdated: '3 months ago',
      docText: 'Replica lag alert threshold is set to 500ms before primary failover triggers.',
      confidence: 94,
      risk: 'CRITICAL',
      agent: 'Infrastructure & SRE Agent',
      patchDiff: {
        removed: '- Replica failover lag threshold: 500ms',
        added: '+ Replica failover lag threshold: 120ms (EU compliance strict SLA)',
      },
      affectedSystems: ['Notion Runbooks', 'Datadog Monitor #204', 'GitHub Wiki'],
    },
    {
      id: 2,
      title: 'SSO OAuth Provider Deprecation',
      sourceIcon: '🛡️',
      source: 'Microsoft Teams #it-sec-ops',
      sourceTime: 'Yesterday',
      sourceText: 'Legacy Okta SAML 1.1 certificates expire end of month. All enterprise apps must use OIDC OAuth 2.0.',
      docTitle: 'Security Policy: Enterprise SSO Standard',
      docLastUpdated: '8 months ago',
      docText: 'Internal employee portals authenticate via SAML 1.1 federation endpoints.',
      confidence: 82,
      risk: 'MEDIUM',
      agent: 'Security & Compliance Agent',
      patchDiff: {
        removed: '- SSO Standard: SAML 1.1 Federation',
        added: '+ SSO Standard: OIDC OAuth 2.0 with PKCE and Hardware MFA',
      },
      affectedSystems: ['Security Portal', 'Jira SEC-309', 'Slack Broadcast'],
    },
  ];

  const currentScenario = scenarios[selectedScenario];

  const walkthroughSteps = [
    {
      step: '01',
      title: 'Real-Time Ingestion',
      badge: 'L3 Event Bus',
      desc: 'Connectors stream raw messages, commits, PRs, and meeting notes from Slack, GitHub, Jira, Teams, and Gmail into a high-throughput event bus.',
      telemetry: {
        event: 'github.pr.merged',
        repo: 'company/core-billing',
        author: 'sarah.k@engineering',
        latency: '42ms',
      },
    },
    {
      step: '02',
      title: 'Hybrid RAG & Graph Matching',
      badge: 'L1 Knowledge Graph',
      desc: 'pgvector searches 1536-dim semantic embeddings while Neo4j maps dependency relationships across services, repositories, and documentation specs.',
      telemetry: {
        vector_match: 'spec_payments_v2.md',
        similarity: 0.942,
        graph_nodes_traversed: 18,
        drift_delta: '+14 days',
      },
    },
    {
      step: '03',
      title: 'Contradiction Detection',
      badge: 'L2 Multi-Agent Core',
      desc: 'Specialized domain agents cross-examine the newly ingested event against canonical documentation and score factual contradiction confidence.',
      telemetry: {
        agent: 'Engineering Domain Agent',
        verdict: 'CONTRADICTION_CONFIRMED',
        confidence: 0.88,
        risk_score: 'HIGH',
      },
    },
    {
      step: '04',
      title: 'Layer 0 Safety Gates',
      badge: 'L0 Risk Governance',
      desc: 'Deterministic policy rules inspect risk score. Low-risk items auto-heal; high-risk changes require designated domain lead authorization.',
      telemetry: {
        policy_rule: 'RULE-04_AUTH_METHODS',
        gate_status: 'PRE_APPROVAL_REQUIRED',
        approver: 'Platform Engineering Lead',
        audit_id: 'audit-9021',
      },
    },
    {
      step: '05',
      title: 'Autonomous Self-Healing',
      badge: 'L0 Dispatch Engine',
      desc: 'Upon approval, Axiom OS dispatches synchronized updates: patches Knowledge Base docs, updates Jira issues, notifies Slack, and creates PR diffs.',
      telemetry: {
        confluence_updated: true,
        jira_ticket_synced: 'DEV-842',
        slack_broadcast_sent: '#engineering-alerts',
        status: 'RESOLVED_100%',
      },
    },
  ];

  const archLayers = [
    {
      layer: 'Layer 0',
      name: 'Risk & Policy Governance Engine',
      role: 'Action Execution & Safety Gates',
      color: '#ef4444',
      badge: 'L0 SAFETY',
      desc: 'Evaluates risk score (Low, Medium, High, Critical), enforces RBAC approval policies, and safely dispatches automated patches to Jira, Slack, GitHub, and internal knowledge bases.',
      metrics: ['5 Configurable Policy Rules', 'Strict Pre-Approval Gates', 'Multi-System Dispatcher'],
    },
    {
      layer: 'Layer 1',
      name: 'Vector & Knowledge Graph Memory',
      role: 'Dual Relational & Spatial Storage',
      color: '#3b82f6',
      badge: 'L1 STORAGE',
      desc: 'Dual-model persistence combining pgvector (1536-dimensional semantic embeddings) with Neo4j Knowledge Graph nodes to map dependencies across documents and operational teams.',
      metrics: ['pgvector Cosine Search', 'Neo4j Dependency Graph', 'Immutable Hash-Chained Audit Trail'],
    },
    {
      layer: 'Layer 2',
      name: 'Multi-Agent Intelligence Core',
      role: 'Autonomous Reasoning & Drift Detection',
      color: '#10b981',
      badge: 'L2 COGNITION',
      desc: 'Specialized autonomous domain agents (Engineering, SRE, Product, Security) continuously cross-examine ingested communication events against official documentation to detect factual drift.',
      metrics: ['85%+ Contradiction Confidence', 'Automated Patch Generation', 'Short-Term Memory Context'],
    },
    {
      layer: 'Layer 3',
      name: 'Real-Time Ingestion Pipeline',
      role: 'Event Bus & Celery Workers',
      color: '#8b5cf6',
      badge: 'L3 PIPELINE',
      desc: 'High-throughput event streaming bus processing inbound webhooks from Slack, GitHub PRs, Microsoft Teams, Gmail, Jira, and Confluence with microsecond deduplication.',
      metrics: ['Event Bus Stream', 'Distributed Celery Workers', 'Async Normalization'],
    },
    {
      layer: 'Layer 4 & 5',
      name: 'Enterprise Connectors & RBAC',
      role: 'Webhooks, Auth & API Gateway',
      color: '#06b6d4',
      badge: 'L4/L5 GOVERNANCE',
      desc: 'Zero-trust JWT authentication, role-based access control with granular permission gates, and standardized normalizers for enterprise SaaS ecosystems.',
      metrics: ['6 Pre-Built Connectors', '13 Granular RBAC Permissions', 'FastAPI High-Speed Endpoints'],
    },
  ];

  const agentSwarm = [
    {
      name: 'Engineering Domain Agent',
      status: 'Active · 24/7 Monitoring',
      icon: '⚙️',
      color: '#3b82f6',
      scope: 'Monitors API specs, SDK versions, endpoints & database schemas.',
      log: 'Indexed PR #482 · Found authentication discrepancy in payments v2.1 spec (Confidence: 88%).',
    },
    {
      name: 'Infrastructure & SRE Agent',
      status: 'Active · 24/7 Monitoring',
      icon: '⚡',
      color: '#10b981',
      scope: 'Monitors failover thresholds, runbooks, latency SLAs & alerting limits.',
      log: 'Analyzed Datadog monitor config vs PostgreSQL runbook · Flagged 380ms threshold drift.',
    },
    {
      name: 'Security & Compliance Agent',
      status: 'Active · 24/7 Monitoring',
      icon: '🛡️',
      color: '#ef4444',
      scope: 'Monitors OAuth certificates, SOC2 controls, IAM policies & audit trails.',
      log: 'Detected Okta SAML 1.1 deprecation announcement · Proposed OIDC OAuth 2.0 migration patch.',
    },
    {
      name: 'Product & Operations Agent',
      status: 'Active · 24/7 Monitoring',
      icon: '📊',
      color: '#f59e0b',
      scope: 'Monitors release notes, feature flags, user tiers & billing definitions.',
      log: 'Synced Stripe billing tier updates with internal Sales onboarding documentation.',
    },
  ];

  const testimonials = [
    {
      quote: 'Axiom OS eliminated our worst engineering nightmare: engineers debugging outages using 6-month-old documentation. Incident triage time plummeted from 45 minutes to 90 seconds.',
      author: 'David Chen',
      role: 'VP of Platform Engineering',
      company: 'Fintech Scaleup (450+ Engineers)',
      avatar: 'DC',
      metric: '94% Faster Triage',
    },
    {
      quote: 'The Layer 0 Governance gate gave our security & compliance team complete confidence. AI detects discrepancies autonomously, but humans retain full execution authority on high-risk changes.',
      author: 'Elena Rostova',
      role: 'Chief Information Security Officer',
      company: 'Cloud Enterprise SaaS',
      avatar: 'ER',
      metric: 'Zero Unauthorized Drifts',
    },
    {
      quote: 'We had critical architecture decisions buried in Slack threads and PR descriptions. Axiom OS turns chaotic everyday chatter into verified, self-healing canonical specs.',
      author: 'Marcus Vance',
      role: 'Principal Systems Architect',
      company: 'Global Logistics Corp',
      avatar: 'MV',
      metric: '$320k/yr Saved in Dev Hours',
    },
  ];

  const faqs = [
    {
      q: 'How does Axiom OS detect contradictions between Slack/GitHub and documentation?',
      a: 'Axiom OS pairs high-speed embedding search (pgvector 1536d) with Neo4j Knowledge Graphs. When an event arrives from Slack or a GitHub PR, autonomous domain agents cross-examine the statement against existing document vectors and graph dependencies, computing a contradiction score with cited evidence.',
    },
    {
      q: 'Will the AI automatically change our production docs without permission?',
      a: 'No. Axiom OS utilizes deterministic Layer 0 Policy Governance. Low-risk non-structural updates can be set to auto-sync, while critical architecture or security documentation halts at the pre-approval gate until authorized by designated domain approvers.',
    },
    {
      q: 'How long does deployment and onboarding take?',
      a: 'Deployments take under 15 minutes. Connect your Slack workspace, GitHub repositories, and Jira/Confluence instance via standard OAuth or webhook normalizers, and Axiom OS begins indexing immediately.',
    },
    {
      q: 'Can we self-host Axiom OS in our own VPC / on-premise?',
      a: 'Yes. Axiom OS is architected for zero-data retention and can be fully deployed inside your AWS VPC, GCP, Azure, or air-gapped on-premise Kubernetes cluster.',
    },
  ];

  return (
    <div className="landing-page-root anim-fade-in">
      {/* ── Dynamic Ambient Particle Mesh Canvas ── */}
      <canvas ref={canvasRef} className="landing-particle-canvas" />

      {/* ── Redesigned Sleek Top Navigation Bar ── */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          {/* Left Brand Identity */}
          <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="brand-logo-img-wrapper">
              <img src="/images/axiom_logo.jpg" alt="Axiom OS" className="brand-logo-img" />
            </div>
            <div className="brand-title-wrap">
              <span className="brand-name">Axiom <span className="title-gradient">OS</span></span>
              <span className="brand-tag-pill">Enterprise 2.0</span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="landing-nav-links">
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#simulator" className="nav-link">Live Simulator</a>
            <a href="#architecture" className="nav-link">7-Layer Engine</a>
            <a href="#roi" className="nav-link">ROI Calculator</a>
            <a href="#security" className="nav-link">Security &amp; Trust</a>
          </nav>

          {/* Right Action Controls */}
          <div className="landing-nav-actions">
            <button className="btn btn-ghost-nav" onClick={() => onLaunchApp('inbox')}>
              <Shield size={14} color="#3b82f6" />
              <span>Conflict Triage</span>
            </button>
            <button className="btn btn-launch-nav" onClick={() => onLaunchApp('chat')}>
              <span>Launch App</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section with 3D Holographic Brain & Floating HUD ── */}
      <section id="hero-showcase" className="landing-hero">
        <div className="hero-glow-bg"></div>
        <div className="hero-container">
          <div className="hero-badge-pill anim-scale-in">
            <span className="pulse-dot"></span>
            <span>✨ Introducing Axiom OS 2.0 · Autonomous Self-Healing for Enterprise Knowledge</span>
          </div>

          <h1 className="hero-headline anim-slide-up">
            The Self-Healing Operating System For{' '}
            <span className="title-gradient">Enterprise Knowledge</span>
          </h1>

          {/* Dynamic Animated Headline Sub-Rotator */}
          <div className="hero-rotator-wrap anim-slide-up">
            <span className="rotator-prefix">Continuous AI reasoning that:</span>
            <strong className="rotator-text-animated" key={rotatorIndex}>
              {rotatorTexts[rotatorIndex]}
            </strong>
          </div>

          <p className="hero-subhead anim-slide-up">
            Stop silent documentation drift. Axiom OS continuously ingests Slack, GitHub, Teams &amp; Gmail, detects when reality diverges from official specs, and safely executes self-healing updates with Layer 0 policy governance.
          </p>

          <div className="hero-cta-row anim-slide-up">
            <button className="btn btn-primary btn-hero-lg" onClick={() => onLaunchApp('chat')}>
              <Sparkles size={16} />
              <span>Launch AI Command Center</span>
              <ArrowRight size={16} />
            </button>
            <a href="#simulator" className="btn btn-secondary btn-hero-lg">
              <Play size={15} color="#60a5fa" />
              <span>Try Interactive Simulator</span>
            </a>
          </div>

          {/* ── 3D Holographic Visual Stage with Live Telemetry HUD ── */}
          <div className="hero-visual-stage anim-scale-in">
            <div className="hero-image-wrapper">
              <img
                src="/images/neural_brain_hero.jpg"
                alt="Axiom OS 3D Holographic Neural Core"
                className="hero-3d-image"
              />
              <div className="hero-image-overlay"></div>

              {/* Floating Live Telemetry HUD Badges */}
              <div className="hud-badge hud-top-left anim-fade-in">
                <span className="pulse-dot"></span>
                <div>
                  <strong>pgvector 1536d</strong>
                  <span>Hybrid Semantic Search Active</span>
                </div>
              </div>

              <div className="hud-badge hud-top-right anim-fade-in">
                <Shield size={14} color="#34d399" />
                <div>
                  <strong>Layer 0 Pre-Approval</strong>
                  <span>Strict Policy Gates Armed</span>
                </div>
              </div>

              <div className="hud-badge hud-bottom-left anim-fade-in">
                <Activity size={14} color="#60a5fa" />
                <div>
                  <strong>Sub-3.5s Ingestion</strong>
                  <span>Slack · GitHub · Jira · Teams</span>
                </div>
              </div>

              <div className="hud-badge hud-bottom-right anim-fade-in">
                <CheckCircle2 size={14} color="#f59e0b" />
                <div>
                  <strong>Autonomous Multi-Agent</strong>
                  <span>4 Domain Agents Reasoning</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics Bar */}
          <div className="hero-stats-row">
            <div className="hero-stat-card">
              <strong>100%</strong>
              <span>Autonomous Drift Detection</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-card">
              <strong>&lt; 3.5s</strong>
              <span>Real-Time Ingestion &amp; RAG</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-card">
              <strong>Layer 0</strong>
              <span>Pre-Approval Safety Gate</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-card">
              <strong>Zero</strong>
              <span>Knowledge Decay Outages</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Enterprise Integrations Infinite Marquee ── */}
      <section className="landing-section integrations-marquee-section">
        <div className="section-container">
          <div className="marquee-header">
            <span>Seamless Enterprise Ingestion &amp; Two-Way Action Dispatch</span>
          </div>
          <div className="marquee-wrapper">
            <div className="marquee-track">
              {[
                { name: 'Slack', color: '#ec4899' },
                { name: 'GitHub', color: '#60a5fa' },
                { name: 'Jira', color: '#3b82f6' },
                { name: 'Confluence', color: '#0ea5e9' },
                { name: 'Notion', color: '#ffffff' },
                { name: 'Microsoft Teams', color: '#818cf8' },
                { name: 'Gmail', color: '#ef4444' },
                { name: 'Google Docs', color: '#3b82f6' },
                { name: 'Linear', color: '#a855f7' },
                { name: 'Datadog', color: '#f97316' },
                { name: 'GitLab', color: '#f43f5e' },
                { name: 'PagerDuty', color: '#10b981' },
              ].map((tool, idx) => (
                <div key={idx} className="marquee-card">
                  <span className="marquee-dot" style={{ background: tool.color }}></span>
                  <span className="marquee-tool-name">{tool.name}</span>
                </div>
              ))}
              {/* Duplicate track for seamless infinite scroll */}
              {[
                { name: 'Slack', color: '#ec4899' },
                { name: 'GitHub', color: '#60a5fa' },
                { name: 'Jira', color: '#3b82f6' },
                { name: 'Confluence', color: '#0ea5e9' },
                { name: 'Notion', color: '#ffffff' },
                { name: 'Microsoft Teams', color: '#818cf8' },
                { name: 'Gmail', color: '#ef4444' },
                { name: 'Google Docs', color: '#3b82f6' },
                { name: 'Linear', color: '#a855f7' },
                { name: 'Datadog', color: '#f97316' },
                { name: 'GitLab', color: '#f43f5e' },
                { name: 'PagerDuty', color: '#10b981' },
              ].map((tool, idx) => (
                <div key={`dup-${idx}`} className="marquee-card">
                  <span className="marquee-dot" style={{ background: tool.color }}></span>
                  <span className="marquee-tool-name">{tool.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 5-Step Interactive Product Walkthrough Pipeline ── */}
      <section id="how-it-works" className="landing-section walkthrough-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">End-to-End Pipeline</span>
            <h2 className="section-title">How Axiom OS Reconciles Reality &amp; Documentation</h2>
            <p className="section-subtitle">
              From the moment an engineer answers a question in Slack to verified multi-system document synchronization.
            </p>
          </div>

          <div className="walkthrough-grid">
            {/* Left Steps Navigation */}
            <div className="walkthrough-steps-list">
              {walkthroughSteps.map((stepItem, idx) => (
                <button
                  key={idx}
                  className={`walkthrough-step-card ${activeStep === idx ? 'active' : ''}`}
                  onClick={() => setActiveStep(idx)}
                >
                  <div className="step-card-top">
                    <span className="step-num">{stepItem.step}</span>
                    <span className="layer-chip">{stepItem.badge}</span>
                  </div>
                  <strong className="step-title">{stepItem.title}</strong>
                  <p className="step-desc">{stepItem.desc}</p>
                </button>
              ))}
            </div>

            {/* Right Interactive Telemetry Terminal View */}
            <div className="walkthrough-terminal-view">
              <div className="terminal-window">
                <div className="terminal-header">
                  <div className="terminal-dots">
                    <span className="dot dot-red"></span>
                    <span className="dot dot-yellow"></span>
                    <span className="dot dot-green"></span>
                  </div>
                  <div className="terminal-title">
                    <span>axiom-os-orchestrator // pipeline_trace.json</span>
                  </div>
                  <span className="badge ok">LIVE TELEMETRY</span>
                </div>

                <div className="terminal-body">
                  <div className="terminal-code-block">
                    <div className="code-line">
                      <span className="code-comment">// Step {walkthroughSteps[activeStep].step}: {walkthroughSteps[activeStep].title}</span>
                    </div>
                    <div className="code-line">
                      <span className="code-key">"status"</span>: <span className="code-val">"PROCESSING_OK"</span>,
                    </div>
                    <div className="code-line">
                      <span className="code-key">"timestamp"</span>: <span className="code-val">"{new Date().toISOString()}"</span>,
                    </div>
                    <div className="code-line">
                      <span className="code-key">"telemetry"</span>: {JSON.stringify(walkthroughSteps[activeStep].telemetry, null, 2)}
                    </div>
                  </div>

                  <div className="terminal-status-bar">
                    <span className="pulse-dot"></span>
                    <span>Continuous Reasoning Loop Active · 3.5s Ingest Latency</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Interactive Contradiction Playground ── */}
      <section id="simulator" className="landing-section simulator-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Interactive Live Playground</span>
            <h2 className="section-title">Experience Real-Time Contradiction Resolution</h2>
            <p className="section-subtitle">
              Choose a real-world enterprise scenario below and click the Layer 0 trigger to watch Axiom OS execute a verified self-healing patch.
            </p>
          </div>

          {/* Scenario Selector Tabs */}
          <div className="simulator-tab-bar">
            {scenarios.map((sc, idx) => (
              <button
                key={sc.id}
                className={`sim-tab ${selectedScenario === idx ? 'active' : ''}`}
                onClick={() => {
                  setSelectedScenario(idx);
                  setSimulatedResolved(false);
                }}
              >
                <span className="sim-tab-icon">{sc.sourceIcon}</span>
                <span className="sim-tab-title">{sc.title}</span>
                <span
                  className="badge"
                  style={{
                    fontSize: '9px',
                    background:
                      sc.risk === 'CRITICAL'
                        ? 'rgba(239,68,68,0.2)'
                        : sc.risk === 'HIGH'
                        ? 'rgba(245,158,11,0.2)'
                        : 'rgba(59,130,246,0.2)',
                    color: sc.risk === 'CRITICAL' ? '#f87171' : sc.risk === 'HIGH' ? '#fbbf24' : '#93c5fd',
                  }}
                >
                  {sc.risk}
                </span>
              </button>
            ))}
          </div>

          {/* Simulator Master Stage Grid */}
          <div className="simulator-stage-grid">
            {/* Column 1: Live Ingested Reality vs Outdated Spec */}
            <div className="sim-col sim-sources-col">
              <div className="sim-card">
                <div className="sim-card-header">
                  <div className="sim-card-header-left">
                    <MessageSquare size={15} color="#60a5fa" />
                    <strong>Live Ingested Reality</strong>
                  </div>
                  <span className="badge badge-source">{currentScenario.source}</span>
                </div>
                <div className="sim-card-body">
                  <p className="sim-event-text">"{currentScenario.sourceText}"</p>
                  <span className="sim-timestamp">Arrived: {currentScenario.sourceTime}</span>
                </div>
              </div>

              <div className="sim-card sim-card-drift">
                <div className="sim-card-header">
                  <div className="sim-card-header-left">
                    <FileText size={15} color="#f87171" />
                    <strong>Official Documentation Spec</strong>
                  </div>
                  <span className="badge badge-doc">{currentScenario.docLastUpdated}</span>
                </div>
                <div className="sim-card-body">
                  <span className="sim-doc-name">{currentScenario.docTitle}</span>
                  <p className="sim-doc-text">"{currentScenario.docText}"</p>
                </div>
              </div>
            </div>

            {/* Column 2: Cognitive Reasoning & Proposed Self-Healing Patch */}
            <div className="sim-col sim-reasoning-col">
              <div className="sim-card sim-card-reasoning">
                <div className="sim-card-header">
                  <div className="sim-card-header-left">
                    <Sparkles size={16} color="#34d399" />
                    <strong>AI Contradiction Detection</strong>
                  </div>
                  <span className="badge badge-agent">{currentScenario.agent}</span>
                </div>

                <div className="sim-reasoning-metrics">
                  <div className="sim-metric-item">
                    <span>Contradiction Confidence</span>
                    <strong style={{ color: '#34d399' }}>{currentScenario.confidence}%</strong>
                  </div>
                  <div className="sim-metric-item">
                    <span>Risk Classification</span>
                    <strong style={{ color: currentScenario.risk === 'CRITICAL' ? '#f87171' : '#fbbf24' }}>
                      {currentScenario.risk}
                    </strong>
                  </div>
                  <div className="sim-metric-item">
                    <span>Governance Gate</span>
                    <strong style={{ color: '#60a5fa' }}>Layer 0 Required</strong>
                  </div>
                </div>

                {/* Patch Preview */}
                <div className="sim-patch-box">
                  <div className="sim-patch-title">
                    <Terminal size={12} />
                    <span>Self-Healing Knowledge Base Patch</span>
                  </div>
                  <div className="sim-diff-line line-del">{currentScenario.patchDiff.removed}</div>
                  <div className="sim-diff-line line-add">{currentScenario.patchDiff.added}</div>
                </div>

                {/* Affected Downstream Systems */}
                <div className="sim-affected-systems">
                  <span className="sim-systems-label">Multi-System Execution Targets:</span>
                  <div className="sim-systems-tags">
                    {currentScenario.affectedSystems.map((sys, sIdx) => (
                      <span key={sIdx} className="sim-system-chip">
                        <CheckCircle2 size={11} color="#34d399" />
                        {sys}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Interactive Action Button */}
                <div className="sim-action-footer">
                  {simulatedResolved ? (
                    <div className="sim-success-alert anim-scale-in">
                      <CheckCircle2 size={20} color="#34d399" />
                      <div>
                        <strong>🎉 Patch Executed &amp; Synced!</strong>
                        <span>Knowledge base updated · Jira created · Slack notified · Immutable Audit Log #audit-sim recorded.</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-action-pulse"
                      onClick={triggerCelebration}
                      style={{ width: '100%', padding: '12px' }}
                    >
                      <Zap size={15} />
                      <span>Simulate Layer 0 Approval &amp; Dispatch</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Multi-Agent Domain Swarm Showcase ── */}
      <section className="landing-section swarm-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Layer 2 Cognition</span>
            <h2 className="section-title">Autonomous Domain Agent Swarm</h2>
            <p className="section-subtitle">
              Specialized domain agents with custom cognitive prompts monitor your code, infrastructure, security, and product specs around the clock.
            </p>
          </div>

          <div className="agent-swarm-grid">
            {agentSwarm.map((agent, idx) => (
              <div key={idx} className="agent-swarm-card">
                <div className="agent-card-header">
                  <div className="agent-avatar" style={{ borderColor: `${agent.color}50`, background: `${agent.color}15` }}>
                    <span>{agent.icon}</span>
                  </div>
                  <div>
                    <h4>{agent.name}</h4>
                    <span className="agent-status">
                      <span className="pulse-dot" style={{ background: agent.color }}></span>
                      {agent.status}
                    </span>
                  </div>
                </div>

                <p className="agent-scope">{agent.scope}</p>

                <div className="agent-terminal-log">
                  <Terminal size={11} color={agent.color} />
                  <span>{agent.log}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive Before vs After Comparison ── */}
      <section id="comparison" className="landing-section comparison-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Transformation Matrix</span>
            <h2 className="section-title">The Cost of Tribal Knowledge vs Autonomous Ground Truth</h2>
            <p className="section-subtitle">
              See the dramatic operational shift across your engineering, product, and SRE workflows.
            </p>
          </div>

          <div className="bento-grid">
            <div className="bento-card bento-problem">
              <div className="bento-icon-box icon-red">
                <AlertTriangle size={22} />
              </div>
              <h3>Without Axiom OS</h3>
              <ul className="bento-list">
                <li>
                  <strong>Silent Spec Decay:</strong> Production architecture diverges from Confluence runbooks unnoticed for months.
                </li>
                <li>
                  <strong>Tribal Knowledge in Slack:</strong> Critical decisions are buried in thread replies and never synced to source docs.
                </li>
                <li>
                  <strong>Costly Outages &amp; Misalignment:</strong> On-call engineers follow outdated wiki steps during critical P1 incidents.
                </li>
                <li>
                  <strong>Manual Documentation Debt:</strong> Teams waste 4+ hours per engineer every week hunting for verified truth.
                </li>
              </ul>
            </div>

            <div className="bento-card bento-solution">
              <div className="bento-icon-box icon-green">
                <Sparkles size={22} />
              </div>
              <h3>With Axiom OS</h3>
              <ul className="bento-list">
                <li>
                  <strong>Real-Time Drift Detection:</strong> Ingests live operational streams and flags factual conflicts in under 3.5 seconds.
                </li>
                <li>
                  <strong>Multi-Agent Domain Swarm:</strong> Engineering, SRE, and Security agents reason across hybrid RAG and Knowledge Graphs.
                </li>
                <li>
                  <strong>Automated Self-Healing:</strong> Produces ready-to-merge doc patches and auto-syncs Jira, Slack &amp; GitHub.
                </li>
                <li>
                  <strong>Layer 0 Risk Governance:</strong> High-risk changes require human-in-the-loop authorization with immutable audit trails.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7-Layer Architecture Interactive Explorer ── */}
      <section id="architecture" className="landing-section architecture-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Deep Tech Architecture</span>
            <h2 className="section-title">The 7-Layer Autonomous Brain Stack</h2>
            <p className="section-subtitle">
              Engineered with mathematical precision across ingestion, vector retrieval, multi-agent reasoning, and deterministic Layer 0 policy execution.
            </p>
          </div>

          <div className="arch-explorer-layout">
            {/* Left Layer Navigation */}
            <div className="arch-layer-nav">
              {archLayers.map((layer, idx) => (
                <button
                  key={idx}
                  className={`arch-layer-btn ${activeArchLayer === idx ? 'active' : ''}`}
                  onClick={() => setActiveArchLayer(idx)}
                >
                  <div className="arch-btn-header">
                    <span
                      className="arch-btn-badge"
                      style={{ background: `${layer.color}20`, color: layer.color, borderColor: `${layer.color}40` }}
                    >
                      {layer.badge}
                    </span>
                    <span className="arch-btn-role">{layer.role}</span>
                  </div>
                  <strong className="arch-btn-name">{layer.name}</strong>
                </button>
              ))}
            </div>

            {/* Right Layer Active Detail Display */}
            <div className="arch-layer-detail-card">
              <div className="arch-detail-header">
                <div className="arch-detail-title-group">
                  <span
                    className="arch-badge-large"
                    style={{ color: archLayers[activeArchLayer].color, borderColor: `${archLayers[activeArchLayer].color}50` }}
                  >
                    {archLayers[activeArchLayer].layer}
                  </span>
                  <div>
                    <h3>{archLayers[activeArchLayer].name}</h3>
                    <span className="arch-sub-role">{archLayers[activeArchLayer].role}</span>
                  </div>
                </div>
              </div>

              <p className="arch-desc-text">{archLayers[activeArchLayer].desc}</p>

              <div className="arch-metrics-matrix">
                {archLayers[activeArchLayer].metrics.map((m, mIdx) => (
                  <div key={mIdx} className="arch-metric-card">
                    <CheckCircle2 size={16} color={archLayers[activeArchLayer].color} />
                    <span>{m}</span>
                  </div>
                ))}
              </div>

              <div className="arch-detail-footer">
                <button className="btn btn-ghost" onClick={() => onLaunchApp('intelligence')}>
                  <span>Inspect Live Layer in Intelligence Core</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive ROI & Value Calculator ── */}
      <section id="roi" className="landing-section roi-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Enterprise Value &amp; ROI</span>
            <h2 className="section-title">Calculate Your Organization's Annual Savings</h2>
            <p className="section-subtitle">
              Eliminating context hunting, outdated runbook bugs, and manual documentation updates delivers immediate bottom-line impact.
            </p>
          </div>

          <div className="roi-calculator-grid">
            {/* Left: Interactive Input Sliders */}
            <div className="roi-card roi-inputs-card">
              <h3>Team &amp; Workflow Parameters</h3>

              {/* Slider 1: Team Size */}
              <div className="roi-slider-group">
                <div className="roi-slider-label">
                  <span>Engineers &amp; Operators</span>
                  <strong>{engineersCount} people</strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={engineersCount}
                  onChange={(e) => setEngineersCount(Number(e.target.value))}
                  className="roi-range-slider"
                />
                <div className="slider-range-ticks">
                  <span>10</span>
                  <span>250</span>
                  <span>500+</span>
                </div>
              </div>

              {/* Slider 2: Hours Lost to Drift */}
              <div className="roi-slider-group">
                <div className="roi-slider-label">
                  <span>Hours Lost to Context Drift (per engineer / week)</span>
                  <strong>{hoursWastedPerWeek} hours/wk</strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="0.5"
                  value={hoursWastedPerWeek}
                  onChange={(e) => setHoursWastedPerWeek(Number(e.target.value))}
                  className="roi-range-slider"
                />
                <div className="slider-range-ticks">
                  <span>1 hr</span>
                  <span>6 hrs</span>
                  <span>12 hrs</span>
                </div>
              </div>

              {/* Slider 3: Hourly Rate */}
              <div className="roi-slider-group">
                <div className="roi-slider-label">
                  <span>Average Fully-Loaded Hourly Rate ($)</span>
                  <strong>${hourlyRate}/hour</strong>
                </div>
                <input
                  type="range"
                  min="50"
                  max="250"
                  step="5"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  className="roi-range-slider"
                />
                <div className="slider-range-ticks">
                  <span>$50/hr</span>
                  <span>$150/hr</span>
                  <span>$250/hr</span>
                </div>
              </div>
            </div>

            {/* Right: Calculated Savings Output */}
            <div className="roi-card roi-outputs-card">
              <span className="roi-output-badge">Estimated Annual Impact</span>

              <div className="roi-big-metric">
                <span className="roi-currency">$</span>
                <span className="roi-number">{annualDollarsSaved.toLocaleString()}</span>
                <span className="roi-period">/ year</span>
              </div>
              <span className="roi-metric-sub">Direct Engineering Cost Recovered</span>

              <div className="roi-metric-sub-grid">
                <div className="roi-sub-stat">
                  <Clock size={16} color="#60a5fa" />
                  <div>
                    <strong>{annualHoursSaved.toLocaleString()} hrs</strong>
                    <span>Engineering Time Saved</span>
                  </div>
                </div>

                <div className="roi-sub-stat">
                  <TrendingUp size={16} color="#34d399" />
                  <div>
                    <strong>94.2%</strong>
                    <span>Faster Outage Triage</span>
                  </div>
                </div>
              </div>

              <button className="btn btn-primary" onClick={() => onLaunchApp('chat')} style={{ width: '100%', marginTop: '16px' }}>
                <span>Deploy Axiom OS</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Customer Testimonials ── */}
      <section className="landing-section testimonials-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Enterprise Validation</span>
            <h2 className="section-title">Trusted by Modern Engineering Leaders</h2>
            <p className="section-subtitle">
              See how high-velocity engineering organizations maintain absolute knowledge truth across their stack.
            </p>
          </div>

          <div className="testimonials-grid">
            {testimonials.map((t, idx) => (
              <div key={idx} className="testimonial-card">
                <div className="testimonial-header">
                  <Quote size={24} color="#3b82f6" />
                  <span className="badge ok">{t.metric}</span>
                </div>
                <p className="testimonial-quote">"{t.quote}"</p>
                <div className="testimonial-footer">
                  <div className="testimonial-avatar">{t.avatar}</div>
                  <div>
                    <strong>{t.author}</strong>
                    <span>{t.role} · {t.company}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Enterprise Security & Trust Matrix ── */}
      <section id="security" className="landing-section security-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Enterprise Governance &amp; Compliance</span>
            <h2 className="section-title">Built for High-Stakes Security &amp; Isolation</h2>
            <p className="section-subtitle">
              Your source code, communications, and confidential architecture specs never leave your security perimeter.
            </p>
          </div>

          <div className="security-grid">
            <div className="sec-card">
              <div className="sec-icon">
                <Lock size={20} color="#3b82f6" />
              </div>
              <h4>Zero-Retention &amp; VPC Isolation</h4>
              <p>Deploy fully self-hosted within your AWS VPC, GCP, Azure, or air-gapped on-premise infrastructure.</p>
            </div>

            <div className="sec-card">
              <div className="sec-icon">
                <Shield size={20} color="#10b981" />
              </div>
              <h4>Hash-Chained Immutable Audit Trail</h4>
              <p>Every single conflict detection, AI reasoning trace, and human approval is cryptographically logged.</p>
            </div>

            <div className="sec-card">
              <div className="sec-icon">
                <Users size={20} color="#8b5cf6" />
              </div>
              <h4>Granular 13-Point RBAC Matrix</h4>
              <p>Enforce strict role-based access control policies across Admins, Approvers, and Read-Only Auditors.</p>
            </div>

            <div className="sec-card">
              <div className="sec-icon">
                <Activity size={20} color="#f59e0b" />
              </div>
              <h4>Deterministic Layer 0 Risk Scoring</h4>
              <p>High-risk code or architecture changes automatically halt until authorized by designated domain leads.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive FAQ Accordion ── */}
      <section className="landing-section faq-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Frequently Asked Questions</span>
            <h2 className="section-title">Everything You Need to Know</h2>
          </div>

          <div className="faq-accordion-list">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className={`faq-item ${openFaq === idx ? 'open' : ''}`}
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <div className="faq-question-row">
                  <strong>{faq.q}</strong>
                  <ChevronDown size={18} className={`faq-chevron ${openFaq === idx ? 'rotate' : ''}`} />
                </div>
                {openFaq === idx && (
                  <div className="faq-answer anim-slide-up">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Conversion CTA Banner ── */}
      <section className="landing-cta-banner">
        <div className="cta-banner-container">
          <div className="cta-banner-glow"></div>
          <h2>Ready to Eliminate Knowledge Decay Across Your Enterprise?</h2>
          <p>
            Launch Axiom OS in seconds. Connect your Slack, GitHub, and Jira streams to activate real-time self-healing intelligence.
          </p>
          <div className="cta-banner-buttons">
            <button className="btn btn-primary btn-hero-lg" onClick={() => onLaunchApp('chat')}>
              <Sparkles size={16} />
              <span>Launch AI Command Center</span>
              <ArrowRight size={16} />
            </button>
            <button className="btn btn-secondary btn-hero-lg" onClick={() => onLaunchApp('inbox')}>
              <span>Open Conflict Inbox</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="brand-group">
                <div className="brand-logo-img-wrapper mini">
                  <img src="/images/axiom_logo.jpg" alt="Axiom OS" className="brand-logo-img" />
                </div>
                <strong>Axiom OS</strong>
              </div>
              <p>Autonomous Knowledge Drift Detection, Self-Healing Memory &amp; Layer 0 Policy Execution.</p>
            </div>

            <div className="footer-links-col">
              <strong>Core System</strong>
              <button onClick={() => onLaunchApp('chat')}>AI Command Center</button>
              <button onClick={() => onLaunchApp('inbox')}>Conflict Inbox</button>
              <button onClick={() => onLaunchApp('intelligence')}>Intelligence Core</button>
              <button onClick={() => onLaunchApp('pipeline')}>Processing Pipeline</button>
            </div>

            <div className="footer-links-col">
              <strong>Governance</strong>
              <button onClick={() => onLaunchApp('execution')}>Execution Timeline</button>
              <button onClick={() => onLaunchApp('audit')}>Audit Logs</button>
              <button onClick={() => onLaunchApp('settings')}>Policy Gates</button>
              <button onClick={() => onLaunchApp('profile')}>RBAC Permissions</button>
            </div>

            <div className="footer-links-col">
              <strong>Protocols</strong>
              <span>pgvector 1536d</span>
              <span>Neo4j Cypher</span>
              <span>Celery Async Bus</span>
              <span>FastAPI Gateway</span>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© 2026 Axiom OS Inc. Enterprise Architecture. All rights reserved.</span>
            <div className="footer-status-pill">
              <span className="pulse-dot"></span>
              <span>7-Layer Autonomous Brain Online (100% Health)</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
