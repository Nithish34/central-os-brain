# Company Brain OS

**Self-healing organizational memory.** Compare official docs with live company activity, surface contradictions with evidence, require a human to approve the fix, then turn that decision into workflow actions.

Traditional RAG searches stale content. Company Brain OS treats knowledge drift as an operational problem: detect it, review it, act on it.

---

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)

---

## What it does

1. **Ingests company activity** from Slack, GitHub, Teams, Gmail, and file/webhook sources, then normalizes it into a canonical `CompanyEvent`.
2. **Detects contradictions** between official documents and newer events (similarity retrieval, NLI / LLM or heuristic scoring, SHA-256 dedup).
3. **Puts humans in the loop.** The Conflict Inbox shows old claim vs new claim, evidence, confidence, and a recommended update. Nothing production-facing runs until approve/reject.
4. **Executes approved decisions** through Layer 0: document update records, GitHub PR remediation when credentials exist, Slack/Jira workflow rows, immutable audit log.
5. **Answers questions in context.** Chat is grounded on live conflicts, docs, and events. With `GEMINI_API_KEY` it uses Gemini; without a key it falls back to a built-in NLP reasoner that can still run intents like “approve this conflict.”
6. **Isolates tenants.** Organizations, JWT auth (local + Google OAuth), RBAC (`owner` → `admin` → `manager` → `employee` → `agent`), CSRF, rate limits, ETag caching.

### Flagship demo

An old **Payment Service Architecture** doc still says internal auth is JWT. A Slack message and a GitHub PR say the team moved to OAuth2 client credentials. The inbox opens a critical conflict; approving it patches the knowledge record and writes Jira / Slack / GitHub / audit workflow actions.

Seeded examples live in `data/` (auth method, release cadence, onboarding ownership).

---

## Architecture

The product loop runs in **FastAPI**.

```text
  Slack | GitHub | Teams | Gmail | Docs | Webhooks
                    │
                    ▼
  ┌─────────────────────────────────────────────┐
  │  Layer 4 — Ingestion                        │
  │  FastAPI webhooks → canonical CompanyEvent  │
  └────────────────────┬────────────────────────┘
                       ▼
  ┌─────────────────────────────────────────────┐
  │  Layer 3 — Pipeline                         │
  │  Normalize → Postgres outbox → Redis streams│
  │  Knowledge / workflow / audit workers       │
  └────────────────────┬────────────────────────┘
                       ▼
  ┌─────────────────────────────────────────────┐
  │  Layer 1 — Data                             │
  │  PostgreSQL (SQLAlchemy + Alembic)          │
  │  Documents, events, conflicts, users, chat  │
  └────────────────────┬────────────────────────┘
                       ▼
  ┌─────────────────────────────────────────────┐
  │  Layer 2 — Intelligence                     │
  │  Conflict detector, RAG, multi-agent        │
  │  profiles, grounded chat                    │
  └────────────────────┬────────────────────────┘
                       ▼
  ┌─────────────────────────────────────────────┐
  │  Human approval — Conflict Inbox            │
  └────────────────────┬────────────────────────┘
                       ▼
  ┌─────────────────────────────────────────────┐
  │  Layer 0 — Execution                        │
  │  Doc update · GitHub PR · Slack · Jira      │
  │  Audit trail                                │
  └─────────────────────────────────────────────┘
```

**Honest scope:** GitHub PR creation is live when `GITHUB_TOKEN` / repo (and optional OAuth) are configured. Jira and Slack dispatches are recorded as workflow + audit actions in the demo path; live Slack OAuth/webhooks exist for ingestion. Redis is used for streams and cache when `REDIS_URL` is set. Neo4j / a full knowledge-graph explorer are roadmap, not required to run the app.

---

## Repository structure

```text
├── fast_api_server/          # Product backend (FastAPI)
│   ├── app/
│   │   ├── api/              # REST: conflicts, chat, workflows, audit, demo
│   │   ├── auth/             # JWT, Google OAuth, bootstrap admin
│   │   ├── core/             # Config, DB, Redis, security middleware
│   │   ├── events/           # Outbox, bus, normalizers, replay
│   │   ├── ingestion/        # Slack / GitHub / Teams / Gmail webhooks
│   │   ├── integrations/     # Connector registry and OAuth clients
│   │   ├── models/           # SQLAlchemy models
│   │   ├── rbac/             # Role permissions
│   │   ├── schemas/          # Pydantic
│   │   ├── services/         # Layers 0–2 (detector, RAG, executor, chat NLP)
│   │   └── workers/          # Outbox publisher + stream consumers
│   ├── migrations/           # Alembic
│   └── run.py
│
├── frontend/                 # React 19 + TypeScript + Vite SPA
│   └── src/
│       ├── components/       # Landing, auth, Ask, Review, Explore, settings
│       ├── services/api.ts   # Typed client for /api/v1
│       └── types/
│
├── data/                     # Seed documents, events, conflicts, agents
├── docs/                     # Architecture, pitch, chatbot, roadmap
├── scripts/                  # Seed, smoke tests, deploy helpers
├── requirements.txt
├── render.yaml               # Render
├── railway.json              # Railway
└── fly.toml                  # Fly.io
```

FastAPI serves the built SPA from `frontend/dist` (falls back to `frontend/`) and mounts the API at `/api/v1` and `/api`.

---

## Dashboard

Hash-routed SPA (`#chat`, `#inbox`, …):

| View | Route | Purpose |
| :--- | :--- | :--- |
| Landing | no hash / `#landing` | Marketing page |
| Auth | `#auth` | Login / register |
| **Ask** | `#chat` | Command Center + grounded copilot |
| **Review** | `#inbox` | Open conflicts, evidence, approve/reject |
| **Reviewed** | `#reviewed` | Decision history |
| **Explore** | `#explore` | What the system currently knows |
| **Connections** | `#integrations` | Slack, GitHub, and other connectors |
| Settings / Help / Profile | `#settings`, `#help`, `#profile` | Account and docs |

A floating chat widget is available on dashboard views. The UI polls live data about every 15 seconds.

---

## Quick start

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL 16 (local or hosted). Redis is optional but recommended for streams/cache.

### 1. Backend

```bash
git clone https://github.com/Nithish34/central-os-brain.git
cd central-os-brain

python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Point `DATABASE_URL` at Postgres. On first boot the API creates tables, seeds the **Acme Corp Demo** org from `data/`, and creates a bootstrap owner if missing.

Default login (from `app/core/config.py`, overridable in `.env`):

- Email: `admin@companybrain.local`
- Password: `AdminSecurePassword123!`

### 2. Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

For UI hot reload: `npm run dev` inside `frontend/` (Vite, typically `http://localhost:5173`). Set `FRONTEND_URL` accordingly.

### 3. Run

```bash
python fast_api_server/run.py
```

| URL | What |
| :--- | :--- |
| [http://localhost:8000](http://localhost:8000) | Dashboard |
| [http://localhost:8000/docs](http://localhost:8000/docs) | OpenAPI |
| [http://localhost:8000/redoc](http://localhost:8000/redoc) | ReDoc |
| [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health) | Health |

Optional: set `GEMINI_API_KEY` (or other LLM keys) in `.env` for model-backed chat. Slack/GitHub OAuth and webhook secrets enable live connectors. Ingestion webhooks live at `/api/v1/ingestion/...` (Slack, GitHub, Teams, Gmail).

---

## Testing

```bash
pytest
python scripts/smoke_test.py
python scripts/test_chat_features.py
python scripts/test_live_api.py
```

---

## Cloud deployment

Blueprints: [`render.yaml`](./render.yaml), [`railway.json`](./railway.json), [`fly.toml`](./fly.toml), [`Procfile`](./Procfile).

Step-by-step notes: [`DEPLOYMENT.md`](./DEPLOYMENT.md). Treat that guide’s Neo4j / root `docker-compose` sections as target infrastructure; the running app is FastAPI plus the built React SPA against PostgreSQL (and Redis when configured).

---

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Pitch](./docs/PITCH.md)
- [Chatbot architecture](./docs/CHATBOT_ARCHITECTURE.md)
- [Prototype roadmap](./docs/PROTOTYPE_ROADMAP.md)

---

## License

MIT
