Simple OJ backend using FastAPI and Judge0

Environment variables:
- `DATABASE_URL` e.g. `sqlite+aiosqlite:///./test.db` or a postgres URL
- `JUDGE0_URL` base URL for Judge0 API (e.g. `http://localhost:2358`)
- `SECRET_KEY` for JWT (placeholder)

Quick start (development):

1. Create virtualenv and install:
```
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
2. Run:
```
uvicorn app.main:app --reload
```
