"""In-memory store for Scheduler service — includes seed data."""

from datetime import datetime, timedelta
import uuid

schedule_store: dict = {}


def _seed():
    now = datetime.utcnow()
    seeds = [
        {
            "title": "Groupmate sync meeting",
            "datetime_iso": (now + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S"),
            "description": "Review project progress and divide remaining work",
            "reminder_minutes": 30,
        },
        {
            "title": "Project submission deadline",
            "datetime_iso": "2026-04-17T23:59:00",
            "description": "Final report + PPT due on NTU Learn",
            "reminder_minutes": 120,
        },
        {
            "title": "Optional demo check-in",
            "datetime_iso": (now + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S"),
            "description": "Prepare a short demo of the PA platform",
            "reminder_minutes": 60,
        },
        {
            "title": "API integration testing",
            "datetime_iso": (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S"),
            "description": "Test all four microservice endpoints end-to-end",
            "reminder_minutes": 15,
        },
    ]
    for s in seeds:
        eid = str(uuid.uuid4())[:8]
        schedule_store[eid] = {
            "id": eid,
            "title": s["title"],
            "datetime_iso": s["datetime_iso"],
            "description": s["description"],
            "reminder_minutes": s["reminder_minutes"],
            "created_at": datetime.utcnow().isoformat(),
        }


_seed()
