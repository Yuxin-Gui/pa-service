"""In-memory store for Scheduler service — includes seed data."""

from datetime import datetime, timedelta
import uuid

schedule_store: dict = {}


def _seed():
    now = datetime.utcnow()
    seeds = [
        {
            "title": "Final submission deadline",
            "datetime_iso": "2026-04-17T23:59:00",
            "description": "Submit zip file with report, slides and GitHub link to NTU Learn",
            "reminder_minutes": 120,
        },
        {
            "title": "Groupmate review meeting",
            "datetime_iso": (now + timedelta(days=2)).strftime("%Y-%m-%dT14:00:00"),
            "description": "Review report draft and finalise slide deck together",
            "reminder_minutes": 30,
        },
        {
            "title": "Optional demo check-in",
            "datetime_iso": "2026-04-10T15:00:00",
            "description": "Prepare live demo of all 8 microservices for the optional check-in session",
            "reminder_minutes": 60,
        },
        {
            "title": "Report proofreading session",
            "datetime_iso": (now + timedelta(days=1)).strftime("%Y-%m-%dT20:00:00"),
            "description": "Final read-through of report before submission",
            "reminder_minutes": 15,
        },
    ]
    for s in seeds:
        eid = str(uuid.uuid4())[:8]
        schedule_store[eid] = {
            "id":               eid,
            "title":            s["title"],
            "datetime_iso":     s["datetime_iso"],
            "description":      s["description"],
            "reminder_minutes": s["reminder_minutes"],
            "created_at":       datetime.utcnow().isoformat(),
        }


_seed()
