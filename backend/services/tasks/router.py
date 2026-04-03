from fastapi import APIRouter, HTTPException
from shared.models import TaskCreate, TaskOut
from services.tasks.store import task_store
from datetime import datetime
import uuid

router = APIRouter()

@router.get("/", response_model=list[TaskOut])
async def get_tasks():
    return list(task_store.values())

@router.post("/", response_model=TaskOut)
async def create_task(body: TaskCreate):
    tid = str(uuid.uuid4())[:8]
    task = {
        "id": tid,
        "title": body.title,
        "description": body.description or "",
        "priority": body.priority,
        "status": "pending",
        "due_date": body.due_date,
        "created_at": datetime.utcnow().isoformat(),
    }
    task_store[tid] = task
    return task

@router.patch("/{task_id}/status", response_model=TaskOut)
async def update_status(task_id: str, status: str):
    if task_id not in task_store:
        raise HTTPException(404, "Task not found")
    if status not in ("pending", "in_progress", "done"):
        raise HTTPException(400, "Invalid status")
    task_store[task_id]["status"] = status
    return task_store[task_id]

@router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str):
    if task_id not in task_store:
        raise HTTPException(404, "Task not found")
    del task_store[task_id]