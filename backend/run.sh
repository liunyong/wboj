#!/usr/bin/env bash
export DATABASE_URL=${DATABASE_URL:-sqlite+aiosqlite:///./test.db}
export JUDGE0_URL=${JUDGE0_URL:-http://localhost:2358}
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
