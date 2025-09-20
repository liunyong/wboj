from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True)
    hashed_password: str
    is_teacher: bool = Field(default=False)


class Problem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    statement: str
    time_limit_ms: int = Field(default=1000)
    memory_limit_kb: int = Field(default=65536)


class Submission(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    problem_id: int = Field(index=True)
    language_id: int = Field(default=52)  # default to python3.8? Judge0 id
    source_code: str
    status: Optional[str] = Field(default="pending")
    score: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    judge_token: Optional[str] = None
