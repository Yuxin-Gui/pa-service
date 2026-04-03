"""In-memory store for Task Manager service — includes seed data."""

from datetime import datetime
import uuid

task_store: dict = {}


def _seed():
    seeds = [
        {
            "title": "Review project requirements",
            "description": "Read the PA-as-a-Service assignment brief carefully",
            "priority": "high",
            "due_date": "2026-04-17",
        },
        {
            "title": "Set up development environment",
            "description": "Install Python, Node.js and all dependencies",
            "priority": "high",
            "due_date": "2026-03-30",
        },
        {
            "title": "Write final report",
            "description": "Document architecture, design decisions and API examples",
            "priority": "medium",
            "due_date": "2026-04-17",
        },
        {
            "title": "Prepare demo slides",
            "description": "Make PowerPoint for optional demo session",
            "priority": "low",
            "due_date": "2026-04-15",
        },
    ]
    for s in seeds:
        tid = str(uuid.uuid4())[:8]
        task_store[tid] = {
            "id": tid,
            "title": s["title"],
            "description": s["description"],
            "priority": s["priority"],
            "status": "pending",
            "due_date": s["due_date"],
            "created_at": datetime.utcnow().isoformat(),
        }


_seed()
