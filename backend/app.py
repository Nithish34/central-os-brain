import os
import sys
from pathlib import Path

# Add backend directory to sys.path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import uvicorn
from app.core.config import settings


def main() -> None:
    host = os.environ.get("HOST", settings.HOST)
    port = int(os.environ.get("PORT", settings.PORT))
    print(f"Starting {settings.APP_NAME} Prototype on http://{host}:{port}")
    print(f"Swagger API Docs: http://{host}:{port}/docs")
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    main()
