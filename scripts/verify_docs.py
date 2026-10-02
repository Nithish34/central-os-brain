import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "fast_api_server"))
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)

all_ok = True
for path in ["/docs", "/redoc", "/openapi.json"]:
    r = client.get(path)
    csp = r.headers.get("content-security-policy", "NOT SET")
    cdn_allowed = "cdn.jsdelivr.net" in csp
    status_ok = r.status_code == 200
    print(f"PATH: {path}")
    print(f"  STATUS: {r.status_code} {'OK' if status_ok else 'FAIL'}")
    print(f"  cdn.jsdelivr.net in CSP: {cdn_allowed}")
    if not status_ok or not cdn_allowed:
        all_ok = False

print()
if all_ok:
    print("ALL CHECKS PASSED")
else:
    print("SOME CHECKS FAILED")
    sys.exit(1)
