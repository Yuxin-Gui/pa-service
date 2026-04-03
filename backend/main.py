"""
PA-as-a-Service — API Gateway
Orchestrates: Scheduler, Task Manager, GitHub Agent, Mastodon Agent, PA Chat Agent
"""
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from services.scheduler.router    import router as scheduler_router
from services.tasks.router        import router as tasks_router
from services.github_agent.router import router as github_router
from services.mastodon_agent.router import router as mastodon_router
from services.chat_agent.router          import router as chat_router
from services.procrastination.router     import router as procrastination_router
from services.finance.router             import router as finance_router
from services.hackernews.router          import router as hackernews_router
from services.singapore.router           import router as singapore_router
from services.research.router            import router as research_router
from shared.models import HealthResponse, PAStatus

app = FastAPI(
    title="PA-as-a-Service",
    description="Personal Assistant microservices platform with Claude AI",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all microservice routers
app.include_router(scheduler_router, prefix="/api/scheduler", tags=["Scheduler"])
app.include_router(tasks_router,     prefix="/api/tasks",     tags=["Tasks"])
app.include_router(github_router,    prefix="/api/github",    tags=["GitHub Agent"])
app.include_router(mastodon_router,  prefix="/api/mastodon",  tags=["Mastodon Agent"])
app.include_router(chat_router,            prefix="/api/chat",            tags=["PA Chat Agent"])
app.include_router(procrastination_router, prefix="/api/procrastination", tags=["Anti-Procrastination"])
app.include_router(finance_router,         prefix="/api/finance",         tags=["Finance Tracker"])

@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        services=["scheduler", "tasks", "github_agent", "mastodon_agent", "chat_agent"],
    )


@app.get("/api/status", response_model=PAStatus)
async def status():
    from services.tasks.store     import task_store
    from services.scheduler.store import schedule_store
    from services.finance.store   import finance_store

    pending  = sum(1 for t in task_store.values() if t["status"] == "pending")
    done     = sum(1 for t in task_store.values() if t["status"] == "done")
    upcoming = len(list(schedule_store.values()))

    return PAStatus(
        total_tasks=len(task_store),
        pending_tasks=pending,
        completed_tasks=done,
        upcoming_events=upcoming,
        total_expenses=len(finance_store),
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
