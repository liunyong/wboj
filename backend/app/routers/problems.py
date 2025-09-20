from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from ..models import Problem
from ..db import get_session

router = APIRouter()


@router.post("/", response_model=Problem)
async def create_problem(problem: Problem):
    async with get_session() as session:
        session.add(problem)
        await session.commit()
        await session.refresh(problem)
        return problem


@router.get("/", response_model=list[Problem])
async def list_problems():
    async with get_session() as session:
        q = await session.exec(select(Problem))
        return q.all()
