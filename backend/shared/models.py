from pydantic import BaseModel
from typing import List, Optional

class HealthResponse(BaseModel):
    status: str
    services: List[str]

class PAStatus(BaseModel):
    total_tasks: int
    pending_tasks: int
    completed_tasks: int
    upcoming_events: int

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: str = "medium"
    due_date: Optional[str] = None

class TaskOut(BaseModel):
    id: str
    title: str
    description: str
    priority: str
    status: str
    due_date: Optional[str]
    created_at: str

class ScheduleCreate(BaseModel):
    title: str
    datetime_iso: str
    description: Optional[str] = ""
    reminder_minutes: int = 30

class ScheduleOut(BaseModel):
    id: str
    title: str
    datetime_iso: str
    description: str
    reminder_minutes: int
    created_at: str

class GitHubAnalysisRequest(BaseModel):
    owner: str
    repo: str
    token: Optional[str] = None

class GitHubAnalysisResult(BaseModel):
    repo: str
    stars: int
    forks: int
    open_issues: int
    description: str
    language: str
    recent_commits: List[dict]
    top_contributors: List[dict]
    vibe_summary: str

class MastodonAnalysisRequest(BaseModel):
    instance_url: str
    access_token: str
    hashtag: Optional[str] = ""

class MastodonTrendResult(BaseModel):
    instance: str
    recent_posts: List[dict]
    trending_topics: List[str]
    sentiment_summary: str
    recommended_actions: List[str]