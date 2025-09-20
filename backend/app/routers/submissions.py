from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlmodel import select
from ..models import Submission
from ..db import get_session
from ..judge0 import create_submission, get_submission_result

router = APIRouter()


async def poll_and_update(submission_id: int, token: str):
    # simple polling loop
    import asyncio
    from sqlmodel import select

    for _ in range(20):
        await asyncio.sleep(1)
        try:
            res = await get_submission_result(token)
        except Exception:
            continue
        status = res.get("status", {})
        if status.get("id") in (3, 4):  # 3: Accepted? depends on Judge0 statuses
            async with get_session() as session:
                q = await session.exec(select(Submission).where(Submission.id == submission_id))
                sub = q.one()
                sub.status = status.get("description")
                sub.score = 1.0 if status.get("id") == 3 else 0.0
                await session.commit()
            return


@router.post("/", response_model=Submission)
async def create_submission_endpoint(submission: Submission, background_tasks: BackgroundTasks):
    # persist submission
    async with get_session() as session:
        session.add(submission)
        await session.commit()
        await session.refresh(submission)

    # send to judge0
    try:
        res = await create_submission(submission.source_code, submission.language_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    token = res.get("token")
    if token:
        # update submission with token
        async with get_session() as session:
            q = await session.exec(select(Submission).where(Submission.id == submission.id))
            sub = q.one()
            sub.judge_token = token
            sub.status = "submitted"
            await session.commit()

        background_tasks.add_task(poll_and_update, submission.id, token)

    return submission
