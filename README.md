# Company Brain OS 🧠⚡

> **Self-Healing Organizational Memory & Enterprise Knowledge Intelligence Platform**
> 
> Detects out-of-date documentation, resolves contradictions between official docs and real-time communication (Slack, GitHub, Jira, Notion), and turns approved decisions into automated enterprise actions.

---

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Neo4j](https://img.shields.io/badge/Neo4j-5.18-008CC1?style=flat-square&logo=neo4j&logoColor=white)](https://neo4j.com)
[![Redis](https://img.shields.io/badge/Redis-7.2-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](./LICENSE)

---

## 💡 The Problem & The Solution

- **The Problem:** Companies lose truth over time. Official documentation drifts out of sync while actual engineering, product, and business decisions happen across Slack threads, Jira tickets, GitHub PRs, and meeting transcripts. Traditional RAG systems passively search stale content, propagating obsolete policies and broken architecture specs.
- **The Solution:** **Company Brain OS** is a proactive, self-healing knowledge layer. It continuously ingests enterprise activity, cross-references fresh events against authoritative documentation, detects semantic contradictions, scores impact, and prompts humans with evidence-backed recommendations to update docs and trigger automated workflow remedies.

---

## 🌟 Key Capabilities

1. **Continuous Ingestion & Real-Time Connectors**
   - Ingests from Slack, GitHub, Jira, Notion, Google Drive, webhooks, and raw file uploads.
   - Real-time event streaming and ingestion pipeline with deduplication and chunking.

2. **Dual Vector & Graph Knowledge Foundation**
   - **pgvector**: Dense semantic embeddings for hybrid RAG retrieval.
   - **Neo4j Knowledge Graph**: Entity-relationship mapping across documents, teams, domains, policies, and code repositories.

3. **Multi-Agent Intelligence Core**
   - Specialized agents for **Security**, **Engineering**, **Compliance**, **Product**, and **Operations**.
   - Autonomous contradiction reasoning, confidence scoring, and remediation plan synthesis.

4. **Human-in-the-Loop Governance**
   - Interactive Conflict Inbox with side-by-side evidence inspection, diff visualization, and confidence metrics.
   - One-click approval, rejection, or human modification before any production action executes.

5. **Actionable Workflow Automation**
   - Auto-generates GitHub Pull Requests to update markdown specs.
   - Dispatches Slack alerts and interactive notifications.
   - Creates and updates Jira tracking issues.
   - Immutable audit logging for enterprise compliance and SOC2 traceability.

6. **Interactive AI Chatbot & Knowledge Explorer**
   - Conversational assistant powered by graph + vector RAG context with citation links.
   - Visual Knowledge Graph explorer for dependencies, concepts, and cross-team dependencies.

7. **Enterprise Security & Observability**
   - Multi-tenant architecture with Organization isolation and Role-Based Access Control (RBAC).
   - Real-time pipeline latency metrics, caching (Redis + ETags), rate limiting, and CSRF protection.

---

## 🏗️ Architecture Overview

```text
       Enterprise Sources (Slack | GitHub | Jira | Notion | Docs)
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │               Layer 4: Ingestion & Webhooks             │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │               Layer 3: Event Stream & Pipeline          │
       │              (Chunking, Normalization, Queuing)         │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │               Layer 1: Data & Graph Foundation          │
       │           (PostgreSQL + pgvector | Neo4j Graph)         │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │            Layer 2: Multi-Agent Intelligence Core       │
       │    (Contradiction Engine, Reasoning, Confidence Score)  │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │              Human-in-the-Loop Approval Layer           │
       │         (Conflict Inbox, Evidence Review, Diffs)        │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │               Layer 0: Execution Engine                 │
       │   GitHub PRs ─── Slack Alerts ─── Jira ─── Audit Trail  │
       └─────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```text
├── fast_api_server/        # Python FastAPI backend & REST API
│   ├── app/
│   │   ├── api/            # API v1 route handlers (conflicts, workflows, chat, etc.)
│   │   ├── auth/           # JWT authentication & user management
│   │   ├── core/           # Database, configuration, security middleware
│   │   ├── events/         # Event streaming & pipeline processors
│   │   ├── ingestion/      # Multi-source connectors (Slack, GitHub, Jira, etc.)
│   │   ├── integrations/   # External webhook handlers & API clients
│   │   ├── models/         # SQLAlchemy ORM database models
│   │   ├── rbac/           # Role-based access control engine
│   │   ├── schemas/        # Pydantic validation schemas
│   │   ├── services/       # Conflict detection, agent reasoning, graph & vector RAG
│   │   └── workers/        # Asynchronous background tasks
│   ├── migrations/         # Alembic database migration scripts
│   └── run.py              # Server entry point
│
├── frontend/               # Modern React 19 + TypeScript Single Page Application
│   ├── src/
│   │   ├── components/     # UI views (Command Center, Inbox, Graph, Chat, etc.)
│   │   ├── services/       # Typed API client services
│   │   ├── styles/         # Design system & CSS modules
│   │   └── types/          # TypeScript interface definitions
│   ├── package.json        # Frontend dependencies & build scripts
│   └── vite.config.ts      # Vite bundler configuration
│
├── data/                   # Synthetic enterprise knowledge datasets & fixtures
├── docs/                   # Architecture specs, roadmaps, and pitch documentation
├── scripts/                # Verification suites, deployment scripts & smoke tests
├── docker-compose.yml      # Multi-container orchestration (App, Postgres, Redis, Neo4j)
├── render.yaml             # Render one-click cloud deployment blueprint
├── DEPLOYMENT.md           # Comprehensive multi-cloud production deployment guide
└── requirements.txt        # Python backend dependencies
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **npm**
- *(Optional)* **Docker & Docker Compose** for local Postgres/Redis/Neo4j

### 2. Backend Setup

```bash
# 1. Clone the repository
git clone https://github.com/Nithish34/central-os-brain.git
cd central-os-brain

# 2. Create and activate a virtual environment
# Windows:
python -m venv .venv
.venv\Scripts\activate
# macOS / Linux:
# python3 -m venv .venv && source .venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run build
cd ..
```

*(For frontend hot-reloading during UI development, run `npm run dev` inside `frontend/`)*

### 4. Start the Application

```bash
python fast_api_server/run.py
```

Open your browser and navigate to:
- 🌐 **Web Dashboard:** [http://localhost:8000](http://localhost:8000)
- 📚 **Interactive Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- 📖 **ReDoc Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 🐳 Docker Deployment

To launch the full stack with PostgreSQL (pgvector), Redis, and Neo4j:

### One-Command Setup

**Windows PowerShell:**
```powershell
.\scripts\deploy.ps1
```

**macOS / Linux:**
```bash
chmod +x ./scripts/deploy.sh
./scripts/deploy.sh
```

**Or standard Docker Compose:**
```bash
docker compose up -d --build
```

### Live Service Endpoints

| Service | Address | Description |
| :--- | :--- | :--- |
| **Web Dashboard** | `http://localhost:8000` | Full React 19 SPA & Command Center |
| **Swagger API Docs** | `http://localhost:8000/docs` | Interactive OpenAPI Explorer |
| **Health Check** | `http://localhost:8000/api/v1/health` | Service health & latency |
| **Neo4j Browser** | `http://localhost:7474` | Knowledge Graph visualizer (`neo4j` / `companybrain123`) |
| **PostgreSQL** | `localhost:5432` | Relational & Vector DB (`company_brain`) |
| **Redis** | `localhost:6379` | Stream queue & caching |

---

## 🧪 Testing & Verification

Run automated test suites and validation scripts:

```bash
# Run backend pytest suite
pytest

# Run end-to-end smoke test
python scripts/smoke_test.py

# Verify chat and RAG intelligence
python scripts/test_chat_features.py

# Test live API health and endpoints
python scripts/test_live_api.py
```

---

## ☁️ Cloud Deployment

Company Brain OS is production-ready for deployment on:
- **Render:** Includes [`render.yaml`](./render.yaml) blueprint for one-click setup.
- **Railway:** Includes [`railway.json`](./railway.json) and [`Procfile`](./Procfile).
- **Fly.io:** Includes [`fly.toml`](./fly.toml).
- **AWS / GCP / DigitalOcean:** Standard containerized Docker deployment.

For complete step-by-step instructions, see the [Production Deployment Guide](./DEPLOYMENT.md).

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
