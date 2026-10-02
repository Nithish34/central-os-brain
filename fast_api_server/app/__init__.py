"""
Company Brain OS - Prototype Backend Package
"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

__version__ = "1.0.0"

