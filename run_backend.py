"""Poach Plagiarism Detection Server - Root Launcher
Run:
    python run_backend.py
"""
import os
import sys
from pathlib import Path

# Ensure backend directory is in sys.path
_backend_dir = Path(__file__).resolve().parent / "backend"
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"\n=======================================================")
    print(f"  Poach Plagiarism Detection & Originality Engine")
    print(f"  API Documentation: http://{host}:{port}/docs")
    print(f"  Web Dashboard:     http://{host}:{port}/")
    print(f"  Health Status:     http://{host}:{port}/api/health")
    print(f"=======================================================\n")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
