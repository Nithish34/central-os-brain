# Backend

The backend is a small Python HTTP API built with the standard library for maximum demo reliability.

It serves:

- Static frontend files from `frontend/`
- Synthetic enterprise data from `data/`
- Conflict detection endpoints
- Human approval and rejection endpoints
- Simulated workflow and audit logs

## Run

```powershell
& "C:\Users\andre\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" backend\app.py
```

