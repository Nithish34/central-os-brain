# Company Brain OS

Company Brain OS is a 20-hour national hackathon MVP for a self-healing enterprise knowledge system.

The demo shows an official company document becoming outdated, Company Brain detecting a conflict from newer company events, a human approving the AI-recommended fix, and simulated workflow actions being created across Jira, Slack, GitHub, and audit logs.

## MVP Story

1. Official payment documentation says the service uses JWT.
2. Recent engineering communication says the team migrated to OAuth2.
3. Company Brain detects the contradiction and shows evidence.
4. A human approves the recommended update.
5. The system creates workflow actions and records an audit trail.

## Project Structure

```text
backend/   Python demo API
frontend/  Static dashboard demo
data/      Synthetic company data
docs/      Pitch and architecture notes
scripts/   Helper scripts
```

## Quick Start

Use the bundled Python runtime if global Python is not installed:

```powershell
& "C:\Users\andre\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" backend\app.py
```

Then open:

```text
http://localhost:8000
```

## Demo Reset

The app keeps demo state in memory. Restarting the server resets it. The API also includes:

```text
POST /api/demo/reset
```

