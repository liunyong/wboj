import os
import httpx
from typing import Optional

JUDGE0_URL = os.getenv("JUDGE0_URL", "http://localhost:2358")


async def create_submission(source: str, language_id: int, stdin: Optional[str] = None, time_limit_ms: int = 1000, memory_limit_kb: int = 65536):
    url = f"{JUDGE0_URL}/submissions?base64_encoded=false&wait=false"
    payload = {
        "source_code": source,
        "language_id": language_id,
        "stdin": stdin or "",
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(url, json=payload, timeout=10)
        r.raise_for_status()
        return r.json()


async def get_submission_result(token: str):
    url = f"{JUDGE0_URL}/submissions/{token}?base64_encoded=false&fields=stdout,stderr,compile_output,status,execution_time,language_id"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, timeout=10)
        r.raise_for_status()
        return r.json()
