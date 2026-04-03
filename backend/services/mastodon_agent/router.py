from fastapi import APIRouter, HTTPException
import httpx
import os
import re
from collections import Counter
from html import unescape
from shared.models import MastodonAnalysisRequest, MastodonTrendResult

router = APIRouter()
GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"


def _clean_content(raw: str) -> str:
    """Strip HTML, decode entities, aggressively remove URLs and fragments."""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = unescape(text)
    # Remove full URLs
    text = re.sub(r"https?://\S+", "", text)
    # Remove broken https:// fragments with spaces
    text = re.sub(r"https?://\s*\S*", "", text)
    # Remove any remaining domain/path patterns (word.word/anything)
    text = re.sub(r"\b[\w-]+\.[\w]{2,}/[\w/\-#?=&%\.]*", "", text)
    # Remove orphaned path fragments starting with /
    text = re.sub(r"\s/[\w/\-#?=&%\.]+", " ", text)
    # Fix hashtag spacing
    text = re.sub(r"#\s+(\w+)", r"#\1", text)
    # Clean up extra whitespace
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text[:220]


def _is_english(text: str) -> bool:
    """Reject non-English posts using common non-English word detection."""
    if not text or len(text) < 15:
        return False
    # Reject if contains common non-English words
    non_english = ["pola", "pero", "aqui", "tedes", "unha", "estas", "foron", "datos", 
                   "mediante", "como", "para", "este", "esta", "pelo", "pela", "votre",
                   "avec", "pour", "dans", "oder", "und", "der", "die", "das"]
    text_lower = text.lower()
    if any(f" {w} " in f" {text_lower} " for w in non_english):
        return False
    ascii_count = sum(1 for c in text if ord(c) < 128)
    return ascii_count / len(text) > 0.88


def _extract_topics(posts):
    all_tags = []
    for post in posts:
        tags = re.findall(r"#(\w+)", post.get("content", ""))
        all_tags.extend([t.lower() for t in tags if t.isalpha()])
        for tag in post.get("tags", []):
            name = tag.get("name", "").lower()
            if name:
                all_tags.append(name)
    return [tag for tag, _ in Counter(all_tags).most_common(8)]


async def _analyse_with_groq(posts, topics):
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return _analyse_basic(posts, topics)

    sample = "\n".join([
        f"- @{p.get('account','?')} ({p.get('favourites',0)} favs): {p.get('content','')[:120]}"
        for p in posts[:8] if p.get("content")
    ])

    prompt = f"""You are a social media analyst. Analyse these Mastodon posts and respond in EXACTLY this format:

SENTIMENT: [1 specific sentence about the mood — reference actual topics discussed, not just "positive"]
REC1: [specific actionable tip, max 10 words]
REC2: [specific actionable tip, max 10 words]
REC3: [specific actionable tip, max 10 words]
REC4: [specific actionable tip, max 10 words]

Trending topics: {', '.join(topics[:5]) or 'none'}
Posts:
{sample}"""

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 200},
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
        words = set(post.get("content","").lower().split())
        pos += len(words & positive)
        neg += len(words & negative)
    if pos > neg * 1.5:
        sentiment = "The community is energetic and upbeat — lots of positive engagement."
    elif neg > pos * 1.5:
        sentiment = "Some frustration in the feed — people are raising concerns or critiques."
    else:
        sentiment = "Balanced discussion across topics with a mix of technical and conversational posts."
    recs = []
    if topics:
        recs.append(f"Post about #{topics[0]} to join the top trending conversation.")
    recs += [
        "Engage by replying to high-favourite posts in your feed.",
        "Use 2–3 hashtags per post for optimal reach.",
        "Boost quality content from others to grow your network.",
    ]
    return sentiment, recs


@router.post("/analyse", response_model=MastodonTrendResult)
async def analyse_feed(body: MastodonAnalysisRequest):
    base    = body.instance_url.rstrip("/")
    headers = {"Authorization": f"Bearer {body.access_token}"}
    async with httpx.AsyncClient(timeout=15) as client:
        url = (f"{base}/api/v1/timelines/tag/{body.hashtag}?limit=40"
               if body.hashtag else f"{base}/api/v1/timelines/home?limit=40")
        r = await client.get(url, headers=headers)
        if r.status_code == 401:
            raise HTTPException(401, "Invalid access token — check your Mastodon credentials.")
        if r.status_code == 404:
            raise HTTPException(404, "Mastodon instance not found — check the instance URL.")
        r.raise_for_status()
        raw_posts = r.json()

    posts = []
    for p in raw_posts:
        content = _clean_content(p.get("content", ""))
        if not content or not _is_english(content):
            continue
        posts.append({
            "id":         p["id"],
            "content":    content,
            "account":    p["account"]["acct"],
            "reblogs":    p.get("reblogs_count", 0),
            "favourites": p.get("favourites_count", 0),
            "created_at": p.get("created_at", ""),
            "tags":       p.get("tags", []),
        })

    topics          = _extract_topics(posts)
    sentiment, recs = await _analyse_with_groq(posts, topics)

    return MastodonTrendResult(
        instance=base, recent_posts=posts[:8],
        trending_topics=topics,
        sentiment_summary=sentiment,
        recommended_actions=recs,
    )


@router.get("/demo-trends")
async def demo_trends():
    demo_posts = [
        {"account": "openclaw@fosstodon.org",  "content": "OpenClaw 2.1 just dropped with async task runners! Loving the new API design.",          "reblogs": 42, "favourites": 118, "created_at": "2026-04-03T08:00:00Z", "tags": []},
        {"account": "devnews@hachyderm.io",     "content": "The rise of PA APIs — great breakdown of microservices and REST architecture.",           "reblogs": 31, "favourites": 87,  "created_at": "2026-04-03T07:30:00Z", "tags": []},
        {"account": "aiethics@sigmoid.social",  "content": "Storing API keys securely: always encrypt at rest and rotate regularly.",                "reblogs": 19, "favourites": 64,  "created_at": "2026-04-03T07:00:00Z", "tags": []},
        {"account": "pythonista@fosstodon.org", "content": "FastAPI + Groq = the best developer experience in 2026. Highly recommend this stack.",   "reblogs": 55, "favourites": 203, "created_at": "2026-04-03T06:30:00Z", "tags": []},
    ]
    topics          = _extract_topics(demo_posts)
    sentiment, recs = await _analyse_with_groq(demo_posts, topics)
    return MastodonTrendResult(
        instance="https://mastodon.social",
        recent_posts=demo_posts,
        trending_topics=topics or ["openclaw", "ai", "api", "security", "python", "fastapi"],
        sentiment_summary=sentiment,
        recommended_actions=recs,
    )