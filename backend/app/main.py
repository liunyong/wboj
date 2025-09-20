from fastapi import FastAPI
from .db import init_db
from .routers import problems, submissions

app = FastAPI(title="Mini OJ")


@app.on_event("startup")
async def on_startup():
    await init_db()


app.include_router(problems.router, prefix="/problems", tags=["problems"])
app.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
