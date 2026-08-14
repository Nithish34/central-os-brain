# Company Brain OS — Production Deployment Guide

This guide covers deploying **Company Brain OS** across multiple environments, from single-command Docker Compose to Cloud Platforms (Render, Railway, Fly.io, AWS, GCP, and DigitalOcean).

---

## 🏗️ Architecture Overview

Company Brain OS is containerized as a unified full-stack architecture:
- **Application Container (`app`)**:
  - **Frontend**: Vite + React 19 Single Page Application built into optimized static assets.
  - **Backend**: FastAPI 0.110+ on Python 3.11 with ASGI Uvicorn server serving the REST API (`/api/v1`), Swagger Docs (`/docs`), and the SPA dashboard with deep-link routing.
- **Relational & Vector Storage (`postgres`)**: PostgreSQL 16 with `pgvector` extension for documents, events, conflicts, audits, and embeddings.
- **Cache & Event Stream (`redis`)**: Redis 7.2 for real-time pub/sub streams and response caching.
- **Knowledge Graph Database (`neo4j`)**: Neo4j 5.18 Community with APOC plugins for entity-relationship and conflict graphs.

---

## 🚀 Option 1: Docker Compose Deployment (Recommended for Local / VPS / EC2)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/) (v2.0+)

### 1. Configure Environment
Copy the production environment template:
```bash
cp .env.production.example .env.production
```
*(On Windows PowerShell: `Copy-Item .env.production.example .env.production`)*

Edit `.env.production` and provide your secrets (e.g. `GEMINI_API_KEY`, `JWT_SECRET`).

### 2. Deploy with One Command

#### Windows (PowerShell):
```powershell
.\scripts\deploy.ps1
```

#### Linux / macOS / VPS (Bash):
```bash
chmod +x ./scripts/deploy.sh
./scripts/deploy.sh
```

#### Or Standard Docker Compose:
```bash
docker compose up -d --build
```

### 3. Verify Live Services

| Service | URL / Port | Credentials / Note |
| :--- | :--- | :--- |
| **Web Dashboard** | `http://localhost:8000` | Full React UI & SPA |
| **Swagger API Docs** | `http://localhost:8000/docs` | Interactive OpenAPI Explorer |
| **ReDoc API Docs** | `http://localhost:8000/redoc` | OpenAPI Specifications |
| **API Health Check** | `http://localhost:8000/api/v1/health` | Returns `{"status":"ok"}` |
| **Neo4j Browser** | `http://localhost:7474` | User: `neo4j` / Password: `companybrain123` |
| **PostgreSQL** | `localhost:5432` | User: `postgres` / DB: `company_brain` |
| **Redis** | `localhost:6379` | Stream & Cache |

To view container logs:
```bash
docker compose logs -f app
```

To stop services:
```bash
docker compose down
```

---

## ☁️ Option 2: Render One-Click Deployment (Render Blueprint)

The repository includes a ready-to-use [`render.yaml`](./render.yaml) Blueprint that provisions:
- 1 Web Service (FastAPI + React Dashboard)
- 1 Managed PostgreSQL Database with pgvector
- 1 Managed Redis Cache

### Steps:
1. Push your repository to **GitHub** or **GitLab**.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **Blueprints** → **New Blueprint Instance**.
4. Select your `central-os-brain` repository.
5. In the environment configuration, set your `GEMINI_API_KEY`.
6. Click **Apply**. Render will automatically build the multi-stage Docker image and connect the managed PostgreSQL & Redis databases.

---

## 🚂 Option 3: Railway Deployment

The repository includes [`railway.json`](./railway.json) and [`Procfile`](./Procfile).

### Steps:
1. Install Railway CLI: `npm i -g @railway/cli` or use [railway.app](https://railway.app).
2. Run in project directory:
   ```bash
   railway login
   railway init
   railway up
   ```
3. In the Railway dashboard:
   - Add a **PostgreSQL** plugin (provides `DATABASE_URL`).
   - Add a **Redis** plugin (provides `REDIS_URL`).
   - Set environment variable `GEMINI_API_KEY` and `JWT_SECRET`.
4. Railway will automatically build the Dockerfile and expose a public `https://xxx.up.railway.app` URL.

---

## 🪽 Option 4: Fly.io Deployment

The repository includes [`fly.toml`](./fly.toml).

### Steps:
1. Install [Flyctl](https://fly.io/docs/hands-on/install-flyctl/).
2. Run:
   ```bash
   fly launch
   ```
3. Set secrets:
   ```bash
   fly secrets set GEMINI_API_KEY="your_api_key" JWT_SECRET="your_jwt_secret"
   ```
4. Attach Postgres and Redis (optional):
   ```bash
   fly postgres create
   fly postgres attach <postgres-app-name>
   fly redis create
   ```
5. Deploy:
   ```bash
   fly deploy
   ```

---

## 🌐 Option 5: AWS / Google Cloud / DigitalOcean VPS

### For VPS (Ubuntu 22.04+ on AWS EC2, DigitalOcean, Linode, Hetzner):
1. SSH into your VPS:
   ```bash
   ssh user@your-server-ip
   ```
2. Clone repository & install Docker:
   ```bash
   git clone https://github.com/your-username/central-os-brain.git
   cd central-os-brain
   curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
   ```
3. Launch with production compose:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. Configure Nginx with SSL (Certbot):
   ```nginx
   server {
       server_name brain.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```
   Install SSL:
   ```bash
   sudo certbot --nginx -d brain.yourdomain.com
   ```

---

## 🔐 Production Checklist

- [ ] **JWT Secret**: Ensure `JWT_SECRET` is set to a secure 256-bit random string (`openssl rand -hex 32`).
- [ ] **Admin Credentials**: Change default `ADMIN_BOOTSTRAP_PASSWORD` in production.
- [ ] **CORS**: In `backend/app/core/config.py` or `.env`, restrict `CORS_ALLOWED_ORIGINS` to your production domain(s).
- [ ] **Database Backups**: Schedule automated snapshot backups of the `postgres_data` volume.
- [ ] **API Keys**: Store `GEMINI_API_KEY`, `SLACK_SIGNING_SECRET`, `GITHUB_TOKEN`, and `JIRA_API_TOKEN` in cloud secret managers or environment variables.
