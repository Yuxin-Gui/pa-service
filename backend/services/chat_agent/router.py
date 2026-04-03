from fastapi import APIRouter, HTTPException
import httpx
import os
from pydantic import BaseModel
from typing import List
from datetime import datetime

router = APIRouter()

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    reply: str

def _build_system_prompt() -> str:
    from services.tasks.store import task_store
    from services.scheduler.store import schedule_store

    all_tasks   = list(task_store.values())
    pending     = [t for t in all_tasks if t["status"] == "pending"]
    in_progress = [t for t in all_tasks if t["status"] == "in_progress"]
    done        = [t for t in all_tasks if t["status"] == "done"]

    pending_list     = ", ".join(f'"{t["title"]}"' for t in pending[:5]) or "none"
    in_progress_list = ", ".join(f'"{t["title"]}"' for t in in_progress[:3]) or "none"

    now = datetime.utcnow()
    upcoming = []
    for e in schedule_store.values():
        try:
            if datetime.fromisoformat(e["datetime_iso"]) > now:
                upcoming.append(e)
        except Exception:
            pass
    upcoming.sort(key=lambda e: e["datetime_iso"])
    upcoming_list = ", ".join(
        f'"{e["title"]}" at {e["datetime_iso"][:16]}' for e in upcoming[:4]
    ) or "none"

    return f"""You are a smart, friendly Personal Assistant (PA) built into PA-as-a-Service.

Current date/time (UTC): {now.strftime("%Y-%m-%d %H:%M")}

LIVE PLATFORM DATA:
- Tasks — Pending ({len(pending)}): {pending_list}
- Tasks — In Progress ({len(in_progress)}): {in_progress_list}
- Tasks — Completed: {len(done)}
- Upcoming events: {upcoming_list}

Be concise (2-4 sentences), warm and practical. When asked to create a task, tell the user to use the Tasks tab."""


@router.post("/message", response_model=ChatResponse)
async def chat(body: ChatRequest):
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "GROQ_API_KEY is not set. Run: set GROQ_API_KEY=your_key_here")

    system_prompt = _build_system_prompt()

    messages = [{"role": "system", "content": system_prompt}]
    for msg in body.history[-12:]:
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": messages, "max_tokens": 600},
        )

    if r.status_code != 200:
        raise HTTPException(500, f"Groq API error {r.status_code}: {r.text[:200]}")

    reply = r.json()["choices"][0]["message"]["content"]
    return ChatResponse(reply=reply)


@router.get("/health")
async def chat_health():
    has_key = bool(os.environ.get("GROQ_API_KEY", ""))
    return {
        "ready": has_key,
        "message": "Chat agent ready" if has_key else "Set GROQ_API_KEY to enable chat",
    }