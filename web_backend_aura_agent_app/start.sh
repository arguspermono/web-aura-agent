#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Aura-Agent Backend — Quick Start Script (Bash for Windows/Git Bash)
# ─────────────────────────────────────────────────────────────────────────────

PORT=${1:-8000}

echo ""
echo "  Aura-Agent Backend"
echo "  ──────────────────"

# ── Locate virtual environment ────────────────────────────────────────────────
if [ -d "venv" ]; then
    VENV_PATH="venv"
elif [ -d ".venv" ]; then
    VENV_PATH=".venv"
else
    echo "  [ERROR] No virtual environment found (checked 'venv' and '.venv')."
    echo "  Run: python -m venv venv && source venv/Scripts/activate && pip install -r requirements.txt"
    exit 1
fi

echo "  Activating virtual environment: $VENV_PATH"
source $VENV_PATH/Scripts/activate

# ── Check .env exists ─────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    echo "  [WARN] .env file not found. Copying from .env.example..."
    cp .env.example .env
fi

# ── Launch uvicorn ────────────────────────────────────────────────────────────
echo "  Server URLs:"
echo "    Browser / Swagger :  http://localhost:$PORT/docs"
echo ""
echo "  Running: $VENV_PATH/Scripts/python -m uvicorn main:app --host 0.0.0.0 --port $PORT --reload"
echo "  Press Ctrl+C to stop."
echo ""

$VENV_PATH/Scripts/python -m uvicorn main:app --host 0.0.0.0 --port $PORT --reload
