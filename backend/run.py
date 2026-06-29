"""
Entry-point for the QazVelo-Engine FastAPI backend.
Run from the `backend/` directory:  python run.py
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
    )
