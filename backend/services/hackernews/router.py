"""
HackerNews Agent — fetches top tech stories, AI-summarises them,
and correlates to user tasks with strict validation.
"""

from fastapi import APIRouter
import httpx
import os
import asyncio
from datetime import datetime, timezone

router = APIRouter()

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"
HN_API     = "https://hacker-news.firebaseio.com/v0"


def _time_ago(unix_ts: int) -> str:
    if not unix_ts:
        return "unknown"
    now  = datetime.now(timezone.utc).timestamp()
    diff = int(now - unix_ts)
    if diff < 3600:  return f"{diff // 60}m ago"
    if diff < 86400: return f"{diff // 3600}h ago"
    return f"{diff // 86400}d ago"


async def _fetch_story(client: httpx.AsyncClient, story_id: int) -> dict | None:
    try:
        r = await client.get(f"{HN_API}/item/{story_id}.json", timeout=8)
        if r.status_code == 200:
            d = r.json()
            if d and d.get("type") == "story" and d.get("title") and not d.get("dead"):
                return d
    except Exception:
        pass
    return None


def _extract_keywords(task_title: str) -> set:
    stop_words = {
        "a","an","the","and","or","but","in","on","at","to","for","of","with",
        "by","from","is","was","are","were","be","been","have","has","had","do",
        "does","did","will","would","could","should","may","might","shall","can",
        "need","complete","write","prepare","review","finalise","submit","create",
        "make","build","add","update","fix","check","read","file","zip","ntu",
        "learn","record","video","push","code","final","slides","demo",
        "walkthrough","presentation","into","its","all","our","this","that",
    }
    words = task_title.lower().replace("-", " ").split()
    return {w for w in words if len(w) >= 3 and w not in stop_words}


def _find_relevant_task(story_title: str, task_keywords: dict) -> str | None:
    story_words = set(story_title.lower().replace("-", " ").split())
    for task_title, keywords in task_keywords.items():
        if keywords & story_words:
            return task_title
    return None


async def _ai_summarise(stories: list[dict], tasks: list[dict]) -> list[dict]:
    api_key = os.environ.get("GROQ_API_KEY", "")

    task_keywords = {}
    for t in tasks[:5]:
        kws = _extract_keywords(t["title"])
        if kws:
            task_keywords[t["title"]] = kws

    if not api_key:
        return [{
            "id":            s["id"],
            "title":         s["title"],
            "url":           s.get("url", f"https://news.ycombinator.com/item?id={s['id']}"),
            "score":         s.get("score", 0),
            "comments":      s.get("descendants", 0),
            "time_ago":      _time_ago(s.get("time", 0)),
            "summary":       "AI summary unavailable — set GROQ_API_KEY.",
            "relevant_task": _find_relevant_task(s["title"], task_keywords),
        } for s in stories]

    stories_text = "\n".join([f"{i+1}. {s['title']}" for i, s in enumerate(stories)])

    prompt = f"""Summarise each Hacker News story in ONE plain-English sentence. Max 12 words each. No jargon.

Stories:
{stories_text}

Respond EXACTLY like this, nothing else:
1: [summary]
2: [summary]
3: [summary]
4: [summary]
5: [summary]
6: [summary]
7: [summary]
8: [summary]"""

    summaries = {}
    async with httpx.AsyncClient(timeout=25) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 300},
        )
        if r.status_code == 200:
            text = r.json()["choices"][0]["message"]["content"]
            for line in text.strip().split("\n"):
                line = line.strip()
                if ":" in line:
                    parts = line.split(":", 1)
                    try:
                        idx = int(parts[0].strip()) - 1
                        summaries[idx] = parts[1].strip()
                    except ValueError:
                        pass

    return [{
        "id":            s["id"],
        "title":         s["title"],
        "url":           s.get("url", f"https://news.ycombinator.com/item?id={s['id']}"),
        "score":         s.get("score", 0),
        "comments":      s.get("descendants", 0),
        "time_ago":      _time_ago(s.get("time", 0)),
        "summary":       summaries.get(i, "Trending tech story on Hacker News."),
        "relevant_task": _find_relevant_task(s["title"], task_keywords),
    } for i, s in enumerate(stories)]


@router.get("/top")
async def get_top_stories():
    from services.tasks.store import task_store
    tasks = [t for t in task_store.values() if t["status"] != "done"]

    async with httpx.AsyncClient(timeout=10) as client:
        r       = await client.get(f"{HN_API}/topstories.json")
        top_ids = r.json()[:20]

    async with httpx.AsyncClient() as client:
        raw = await asyncio.gather(*[_fetch_story(client, sid) for sid in top_ids])

    stories = [s for s in raw if s][:8]
    results = await _ai_summarise(stories, tasks)

    return {
        "stories":       results,
        "total_fetched": len(results),
        "source":        "Hacker News Firebase API",
        "fetched_at":    datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health")
async def hn_health():
    return {"status": "ok", "source": "Hacker News (no auth required)"}