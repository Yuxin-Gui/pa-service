from fastapi import APIRouter, HTTPException
from shared.models import ScheduleCreate, ScheduleOut
from services.scheduler.store import schedule_store
from datetime import datetime
import uuid

router = APIRouter()

@router.get("/", response_model=list[ScheduleOut])
async def get_events():
    return list(schedule_store.values())

@router.post("/", response_model=ScheduleOut)
async def create_event(body: ScheduleCreate):
    eid = str(uuid.uuid4())[:8]
    event = {
        "id": eid,
        "title": body.title,
        "datetime_iso": body.datetime_iso,
        "description": body.description or "",
        "reminder_minutes": body.reminder_minutes,
        "created_at": datetime.utcnow().isoformat(),
    }
    schedule_store[eid] = event
    return event

@router.delete("/{event_id}", status_code=204)
async def delete_event(event_id: str):
    if event_id not in schedule_store:
        raise HTTPException(404, "Event not found")
    del schedule_store[event_id]