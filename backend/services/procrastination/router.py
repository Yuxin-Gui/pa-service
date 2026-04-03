"""
Anti-Procrastination Microservice.
Analyses task data to detect procrastination patterns and deliver
science-backed nudges using Groq AI.
"""

from fastapi import APIRouter
from datetime import datetime, date
import os
import httpx

router = APIRouter()

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"


def _analyse_patterns() -> dict:
    """Analyse task store for procrastination signals."""
    from services.tasks.store import task_store

    tasks      = list(task_store.values())
    today      = date.today()
    overdue    = []
    stuck      = []
    pending_high = []
    done_low   = 0
    done_high  = 0

    for t in tasks:
        # Overdue — has due date in the past and not done
        if t.get("due_date") and t["status"] != "done":
            try:
                due = date.fromisoformat(t["due_date"])
                if due < today:
                    days_overdue = (today - due).days
                    overdue.append({**t, "days_overdue": days_overdue})
            except Exception:
                pass

        # Stuck in progress
        if t["status"] == "in_progress":
            stuck.append(t)

        # Priority avoidance
        if t["status"] == "done":
            if t.get("priority") == "low":
                done_low += 1
            elif t.get("priority") == "high":
                done_high += 1

        # Pending high priority
        if t["status"] == "pending" and t.get("priority") == "high":
            pending_high.append(t)

    total     = len(tasks)
    completed = sum(1 for t in tasks if t["status"] == "done")
    pending   = sum(1 for t in tasks if t["status"] == "pending")

    # Risk score calculation
    risk_score = 0
    if overdue:          risk_score += min(len(overdue) * 20, 40)
    if stuck:            risk_score += min(len(stuck) * 10, 20)
    if pending_high:     risk_score += min(len(pending_high) * 15, 30)
    if done_low > done_high and done_low > 0:
        risk_score += 10

    if risk_score >= 60:   risk_level = "high"
    elif risk_score >= 30: risk_level = "medium"
    else:                  risk_level = "low"

    patterns = []
    if overdue:
        patterns.append(f"{len(overdue)} overdue task(s) — worst offender: '{overdue[0]['title']}' ({overdue[0]['days_overdue']} days late)")
    if stuck:
        patterns.append(f"{len(stuck)} task(s) stuck in progress with no completion")
    if pending_high:
        patterns.append(f"{len(pending_high)} high-priority task(s) not yet started")
    if done_low > done_high and done_low > 0:
        patterns.append("You've been completing low-priority tasks while ignoring high-priority ones")
    if total > 0 and completed == 0:
        patterns.append("No tasks completed yet — backlog is growing")

    return {
        "risk_level":    risk_level,
        "risk_score":    risk_score,
        "patterns":      patterns,
        "overdue":       overdue[:3],
        "stuck":         stuck[:3],
        "pending_high":  pending_high[:3],
        "total_tasks":   total,
        "completed":     completed,
        "pending":       pending,
        "completion_rate": round((completed / total * 100) if total > 0 else 0, 1),
    }


async def _get_ai_nudge(analysis: dict) -> dict:
    api_key = os.environ.get("GROQ_API_KEY", "")

    focus_task = (
        analysis["overdue"][0]["title"] if analysis["overdue"]
        else analysis["pending_high"][0]["title"] if analysis["pending_high"]
        else analysis["stuck"][0]["title"] if analysis["stuck"]
        else None
    )

    # No patterns = no AI needed, return clean positive message
    if not analysis["patterns"] or not focus_task:
        return {
            "one_task": None,
            "pomodoro": "You're on track! A Pomodoro session now will help you stay ahead.",
            "mini_steps": [],
            "encouragement": "You're doing great — keep the momentum going!",
            "implementation": "If it is 9AM, then I will review my task list and plan the day.",
        }

    if not api_key:
        return _fallback_nudge(analysis, focus_task)

    prompt = f"""You are a productivity coach. Be EXTREMELY concise — max 1 sentence per field. Only reference tasks from this list: {[t['title'] for t in analysis['overdue'] + analysis['pending_high'] + analysis['stuck']]}.

ONE_TASK: [exact task name from list above only]
POMODORO: [one sentence max, be specific]
MINI_STEPS: [3-5 words] | [3-5 words] | [3-5 words]
ENCOURAGEMENT: [one warm sentence, max 12 words, no quotes]
IMPLEMENTATION: [If it is TIME, then I will ACTION with exact task name]"""

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 150},
        )

    if r.status_code != 200:
        return _fallback_nudge(analysis, focus_task)

    text = r.json()["choices"][0]["message"]["content"]
    result = {}
    for line in text.split("\n"):
        line = line.strip()
        for key in ["ONE_TASK", "POMODORO", "ENCOURAGEMENT", "IMPLEMENTATION"]:
            if line.startswith(f"{key}:"):
                result[key.lower()] = line[len(key)+1:].strip()
        if line.startswith("MINI_STEPS:"):
            steps = line[len("MINI_STEPS:"):].strip().split("|")
            result["mini_steps"] = [s.strip() for s in steps if s.strip()]

    # Validate one_task is a real task
    real_titles = [t["title"] for t in analysis["overdue"] + analysis["pending_high"] + analysis["stuck"]]
    one_task = result.get("one_task", focus_task)
    if not any(real.lower() in one_task.lower() or one_task.lower() in real.lower() for real in real_titles):
        one_task = focus_task

    return {
        "one_task":       one_task,
        "pomodoro":       result.get("pomodoro", "Do 2 focused 25-min Pomodoros on your most urgent task"),
        "mini_steps":     result.get("mini_steps", ["Open the task", "Read it fully", "Start for 5 minutes"]),
        "encouragement":  result.get("encouragement", "Small steps forward still count as progress."),
        "implementation": result.get("implementation", f"If it is 9AM, then I will start on {focus_task}"),
    }

def _fallback_nudge(analysis: dict, focus_task) -> dict:
    return {
        "one_task":       focus_task or "Your highest priority task",
        "pomodoro":       "Set a 25-minute timer and work on your most overdue task. Take a 5-minute break. Repeat.",
        "mini_steps":     ["Open the task and read it fully", "Write the first sentence or do the first action", "Set a 25-min timer and keep going"],
        "encouragement":  "Procrastination is normal — research shows self-compassion works better than self-criticism. You've got this!",
        "implementation": f"If it is after 9 AM, then I will immediately start on '{focus_task}' before checking my phone.",
    }


@router.get("/analyse")
async def analyse_procrastination():
    """Analyse procrastination patterns and return AI nudge."""
    analysis = _analyse_patterns()
    nudge    = await _get_ai_nudge(analysis)
    return {**analysis, "nudge": nudge}