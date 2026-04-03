"""In-memory store for Task Manager service — includes seed data."""

from datetime import datetime
import uuid

task_store: dict = {}


def _seed():
    seeds = [
        {
            "title": "Complete PA-as-a-Service final report",
            "description": "Write introduction, literature review, solution design, illustrative examples and conclusions",
            "priority": "high",
            "status": "in_progress",
            "due_date": "2026-04-17",
        },
        {
            "title": "Prepare PowerPoint presentation slides",
            "description": "Create slides covering architecture, API demos, and procrastination research findings",
            "priority": "high",
            "status": "pending",
            "due_date": "2026-04-17",
        },
        {
            "title": "Record demo video walkthrough",
            "description": "Screen record a full demo of all 8 microservices for submission",
            "priority": "medium",
            "status": "pending",
            "due_date": "2026-04-15",
        },
        {
            "title": "Review and submit zip file to NTU Learn",
            "description": "Package report, slides, and GitHub link into a single zip and submit",
            "priority": "high",
            "status": "pending",
            "due_date": "2026-04-17",
        },
        {
            "title": "Push final code to GitHub",
            "description": "Ensure all microservices, README and .gitignore are committed and pushed",
            "priority": "medium",
            "status": "done",
            "due_date": "2026-04-14",
        },
    ]
    for s in seeds:
        tid = str(uuid.uuid4())[:8]
        task_store[tid] = {
            "id":          tid,
            "title":       s["title"],
            "description": s["description"],
            "priority":    s["priority"],
            "status":      s["status"],
            "due_date":    s["due_date"],
            "created_at":  datetime.utcnow().isoformat(),
        }



_seed()
