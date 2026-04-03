"""
PA Chat Agent — conversational AI with tool-calling capability.
Can create tasks, log expenses, schedule events, and complete tasks.
"""

from fastapi import APIRouter, HTTPException
import httpx
import os
import json
from pydantic import BaseModel
from typing import List
from datetime import datetime

router = APIRouter()

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

# ── Tool definitions ──────────────────────────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a new task in the Task Manager",
            "parameters": {
                "type": "object",
                "properties": {
                    "title":       { "type": "string",  "description": "Task title" },
                    "priority":    { "type": "string",  "enum": ["high", "medium", "low"], "description": "Task priority" },
                    "description": { "type": "string",  "description": "Optional description" },
                    "due_date":    { "type": "string",  "description": "Optional due date in YYYY-MM-DD format" },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_expense",
            "description": "Log a new expense in the Finance Tracker",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount":      { "type": "number", "description": "Amount in SGD" },
                    "category":    { "type": "string", "enum": ["Food", "Transport", "Study", "Entertainment", "Shopping", "Health", "Utilities", "Other"] },
                    "description": { "type": "string", "description": "What was it for?" },
                    "date":        { "type": "string", "description": "Date in YYYY-MM-DD format, defaults to today" },
                },
                "required": ["amount", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_event",
            "description": "Schedule a new calendar event",
            "parameters": {
                "type": "object",
                "properties": {
                    "title":            { "type": "string",  "description": "Event title" },
                    "datetime_iso":     { "type": "string",  "description": "Date and time in ISO format e.g. 2026-04-05T14:00:00" },
                    "description":      { "type": "string",  "description": "Optional description" },
                    "reminder_minutes": { "type": "integer", "description": "Reminder minutes before (15, 30, 60, or 120)" },
                },
                "required": ["title", "datetime_iso"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Mark a task as done",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": { "type": "string", "description": "The task ID to mark as done" },
                },
                "required": ["task_id"],
            },
        },
    },
]

# ── Tool execution ────────────────────────────────────────────────────────────
async def _execute_tool(name: str, args: dict) -> str:
    """Execute a tool call and return a result string."""
    try:
        if name == "create_task":
            from services.tasks.store import task_store
            from datetime import datetime
            import uuid
            tid = str(uuid.uuid4())[:8]
            task = {
                "id":          tid,
                "title":       args["title"],
                "description": args.get("description", ""),
                "priority":    args.get("priority", "medium"),
                "status":      "pending",
                "due_date":    args.get("due_date", None),
                "created_at":  datetime.utcnow().isoformat(),
            }
            task_store[tid] = task
            return f"✅ Task created: '{args['title']}' (ID: {tid}, priority: {args.get('priority','medium')})"

        elif name == "add_expense":
            from services.finance.store import finance_store
            from datetime import datetime
            import uuid
            eid = str(uuid.uuid4())[:8]
            expense = {
                "id":          eid,
                "amount":      round(float(args["amount"]), 2),
                "category":    args["category"],
                "description": args.get("description", ""),
                "date":        args.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
                "created_at":  datetime.utcnow().isoformat(),
            }
            finance_store[eid] = expense
            return f"✅ Expense logged: S${args['amount']:.2f} for {args['category']} — '{args.get('description', '')}'"

        elif name == "create_event":
            from services.scheduler.store import schedule_store
            from datetime import datetime
            import uuid
            eid = str(uuid.uuid4())[:8]
            event = {
                "id":               eid,
                "title":            args["title"],
                "datetime_iso":     args["datetime_iso"],
                "description":      args.get("description", ""),
                "reminder_minutes": args.get("reminder_minutes", 30),
                "created_at":       datetime.utcnow().isoformat(),
            }
            schedule_store[eid] = event
            return f"✅ Event scheduled: '{args['title']}' on {args['datetime_iso'][:16]}"

        elif name == "complete_task":
            from services.tasks.store import task_store
            tid = args["task_id"]
            if tid in task_store:
                task_store[tid]["status"] = "done"
                return f"✅ Task '{task_store[tid]['title']}' marked as done!"
            return f"❌ Task ID {tid} not found."

    except Exception as e:
        return f"❌ Error executing {name}: {str(e)}"

    return f"❌ Unknown tool: {name}"


# ── System prompt ─────────────────────────────────────────────────────────────
def _build_system_prompt() -> str:
    from services.tasks.store import task_store
    from services.scheduler.store import schedule_store
    from services.finance.store import finance_store

    all_tasks   = list(task_store.values())
    pending     = [t for t in all_tasks if t["status"] == "pending"]
    in_progress = [t for t in all_tasks if t["status"] == "in_progress"]
    done        = [t for t in all_tasks if t["status"] == "done"]

    pending_list = ", ".join(f'"{t["title"]}"' for t in pending[:5]) or "none"
    in_prog_list = ", ".join(f'"{t["title"]}"' for t in in_progress[:3]) or "none"

    # IDs kept separate — only for tool use, never shown to user
    task_id_ref  = "\n".join(f'  "{t["title"]}" → ID: {t["id"]}' for t in all_tasks[:10])

    now = datetime.utcnow()
    upcoming = sorted(
        [e for e in schedule_store.values() if datetime.fromisoformat(e["datetime_iso"]) > now],
        key=lambda e: e["datetime_iso"]
    )[:4]
    upcoming_list = ", ".join(f'"{e["title"]}" at {e["datetime_iso"][:16]}' for e in upcoming) or "none"

    from datetime import timedelta
    week_ago    = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago   = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    week_total  = sum(e["amount"] for e in finance_store.values() if e["date"] >= week_ago)
    month_total = sum(e["amount"] for e in finance_store.values() if e["date"] >= month_ago)

    return f"""You are a smart, action-oriented Personal Assistant built into PA-as-a-Service.

Current date/time (UTC): {now.strftime("%Y-%m-%d %H:%M")}

LIVE DATA:
- Tasks pending ({len(pending)}): {pending_list}
- Tasks in progress ({len(in_progress)}): {in_prog_list}
- Tasks completed: {len(done)}
- Upcoming events: {upcoming_list}
- Spending this week: S${week_total:.2f} | this month: S${month_total:.2f}

TASK ID REFERENCE (use for complete_task tool only, NEVER show IDs to user):
{task_id_ref}

TOOLS AVAILABLE — use them proactively:
- create_task: when user wants to add/create a task
- add_expense: when user mentions spending money
- create_event: when user wants to schedule something
- complete_task: when user says a task is done (use ID from reference above)

PLATFORM FEATURES:
1. Tasks tab — create/track/complete tasks
2. Scheduler tab — calendar events with reminders
3. GitHub Agent — AI repo analysis and trending repos
4. Mastodon Agent — social feed sentiment analysis
5. HackerNews Agent — top tech stories AI-summarised
6. Singapore Agent — live PSI, weather and bus arrivals
7. Research Assistant — arXiv academic papers
8. Focus Mode — Pomodoro timer with anti-procrastination AI
9. Reports tab — charts and AI daily briefing
10. Finance tab — expense tracking with AI insights

STYLE:
- Be concise (2-3 sentences max)
- Always USE tools when user wants to create/log something
- After using a tool, confirm what you did in one sentence
- NEVER show task IDs to the user in your responses"""


# ── Chat endpoint ─────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role:    str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    reply: str

@router.post("/message", response_model=ChatResponse)
async def chat(body: ChatRequest):
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "GROQ_API_KEY is not set.")

    system_prompt = _build_system_prompt()
    messages = [{"role": "system", "content": system_prompt}]
    for msg in body.history[-10:]:
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": messages, "tools": TOOLS, "max_tokens": 300},
        )

    if r.status_code != 200:
        raise HTTPException(500, f"Groq API error {r.status_code}: {r.text[:200]}")

    resp     = r.json()
    choice   = resp["choices"][0]
    message  = choice["message"]
    finish   = choice["finish_reason"]

    # ── Handle tool calls ──
    if finish == "tool_calls" and message.get("tool_calls"):
        tool_results = []
        for tc in message["tool_calls"]:
            fn_name = tc["function"]["name"]
            fn_args = json.loads(tc["function"]["arguments"])
            result  = await _execute_tool(fn_name, fn_args)
            tool_results.append(result)

        # Send tool results back for a natural reply
        messages.append({"role": "assistant", "content": None, "tool_calls": message["tool_calls"]})
        for tc, res in zip(message["tool_calls"], tool_results):
            messages.append({"role": "tool", "tool_call_id": tc["id"], "content": res})

        async with httpx.AsyncClient(timeout=30) as client:
            r2 = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": GROQ_MODEL, "messages": messages, "max_tokens": 200},
            )
        if r2.status_code == 200:
            reply = r2.json()["choices"][0]["message"]["content"]
        else:
            reply = "\n".join(tool_results)
        return ChatResponse(reply=reply)

    # ── Normal text reply ──
    reply = message.get("content", "Sorry, I couldn't process that.")
    return ChatResponse(reply=reply)


@router.get("/health")
async def chat_health():
    has_key = bool(os.environ.get("GROQ_API_KEY", ""))
    return {"ready": has_key, "message": "Chat agent ready" if has_key else "Set GROQ_API_KEY"}