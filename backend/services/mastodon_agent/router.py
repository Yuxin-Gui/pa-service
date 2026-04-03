from fastapi import APIRouter, HTTPException
import httpx
import os
import re
from collections import Counter
from shared.models import MastodonAnalysisRequest, MastodonTrendResult

router = APIRouter()
GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"

def _extract_topics(posts):
    all_tags = []
    for post in posts:
        tags = re.findall(r"#(\w+)", post.get("content", ""))
        all_tags.extend([t.lower() for t in tags])
        for tag in post.get("tags", []):
            all_tags.append(tag.get("name", "").lower())
    return [tag for tag, _ in Counter(all_tags).most_common(8)]


async def _analyse_with_groq(posts, topics):
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return _analyse_basic(posts, topics)

    sample = "\n".join([f"- @{p.get('account','?')}: {p.get('content','')[:150]}" for p in posts[:10]])
    prompt = f"""Analyse these Mastodon posts and respond in this exact format:
SENTIMENT: [1-2 sentence mood summary]
REC1: [recommendation]
REC2: [recommendation]
REC3: [recommendation]
REC4: [recommendation]

Trending topics: {', '.join(topics[:6]) or 'none'}
Posts:
{sample}"""

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 400},
        )

    if r.status_code != 200:
        return _analyse_basic(posts, topics)

    text = r.json()["choices"][0]["message"]["content"]
    sentiment, recommendations = "", []
    for line in text.split("\n"):
        line = line.strip()
        if line.startswith("SENTIMENT:"):
            sentiment = line[len("SENTIMENT:"):].strip()
        elif line.startswith("REC") and ":" in line:
            rec = line.split(":", 1)[1].strip()
            if rec:
                recommendations.append(rec)

    return sentiment or "Mixed sentiment detected.", recommendations or _analyse_basic(posts, topics)[1]


def _analyse_basic(posts, topics):
    positive = {"great","love","amazing","excited","wonderful","happy","good","excellent","awesome"}
    negative = {"bad","hate","terrible","awful","sad","disappointed","broken","failed","ugly"}
    pos = neg = 0
    for post in posts:
        words = set(re.sub("<[^>]+>", "", post.get("content","")).lower().split())
        pos += len(words & positive)
        neg += len(words & negative)
    if pos > neg * 1.5:
        sentiment = "Predominantly positive — your feed is energetic and upbeat."
    elif neg > pos * 1.5:
        sentiment = "Mostly negative sentiment — people are venting or critiquing."
    else:
        sentiment = "Mixed/neutral sentiment — balanced discourse across topics."
    recs = []
    if topics:
        recs.append(f"Consider posting about #{topics[0]} to join the trending conversation.")
    recs += ["Boost positive content to amplify community morale.",
             "Use 2–3 hashtags per post for optimal reach.",
             "Engage by replying to high-boost posts in your feed."]
    return sentiment, recs


@router.post("/analyse", response_model=MastodonTrendResult)
async def analyse_feed(body: MastodonAnalysisRequest):
    base = body.instance_url.rstrip("/")
    headers = {"Authorization": f"Bearer {body.access_token}"}
    async with httpx.AsyncClient(timeout=15) as client:
        url = (f"{base}/api/v1/timelines/tag/{body.hashtag}?limit=40"
               if body.hashtag else f"{base}/api/v1/timelines/home?limit=40")
        r = await client.get(url, headers=headers)
        if r.status_code == 401:
            raise HTTPException(401, "Invalid Mastodon access token")
        r.raise_for_status()
        raw_posts = r.json()

    posts = [{"id": p["id"], "content": re.sub("<[^>]+>","",p.get("content",""))[:200],
              "account": p["account"]["acct"], "reblogs": p.get("reblogs_count",0),
              "favourites": p.get("favourites_count",0), "created_at": p.get("created_at",""),
              "tags": p.get("tags",[])} for p in raw_posts]

    topics = _extract_topics(posts)
    sentiment, recs = await _analyse_with_groq(posts, topics)
    return MastodonTrendResult(instance=base, recent_posts=posts[:10], trending_topics=topics,
                               sentiment_summary=sentiment, recommended_actions=recs)


@router.get("/demo-trends")
async def demo_trends():
    demo_posts = [
        {"account": "openclaw@fosstodon.org", "content": "OpenClaw 2.1 just dropped! #OpenClaw #AI", "reblogs": 42, "favourites": 118, "created_at": "2026-03-26T08:00:00Z", "tags": []},
        {"account": "devnews@hachyderm.io", "content": "The rise of PA APIs — great breakdown. #API #Dev", "reblogs": 31, "favourites": 87, "created_at": "2026-03-26T07:30:00Z", "tags": []},
        {"account": "aiethics@sigmoid.social", "content": "Always encrypt API keys at rest! #security", "reblogs": 19, "favourites": 64, "created_at": "2026-03-26T07:00:00Z", "tags": []},
        {"account": "pythonista@fosstodon.org", "content": "FastAPI + Groq = amazing dev experience. #python #FastAPI", "reblogs": 55, "favourites": 203, "created_at": "2026-03-26T06:30:00Z", "tags": []},
    ]
    topics = _extract_topics(demo_posts)
    sentiment, recs = await _analyse_with_groq(demo_posts, topics)
    return MastodonTrendResult(instance="https://mastodon.social", recent_posts=demo_posts,
                               trending_topics=topics or ["openclaw","ai","api","security","python","fastapi"],
                               sentiment_summary=sentiment, recommended_actions=recs)