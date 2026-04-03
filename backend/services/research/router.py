"""
Research Assistant — searches arXiv for academic papers
using smart keyword extraction from user tasks.
"""

from fastapi import APIRouter
import httpx
import os
import re
import xml.etree.ElementTree as ET
from urllib.parse import quote

router = APIRouter()

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"
ARXIV_API  = "https://export.arxiv.org/api/query"  # HTTPS

STOP_WORDS = {
    "a","an","the","and","or","but","in","on","at","to","for","of","with",
    "by","from","is","was","are","were","be","been","have","has","had",
    "do","does","did","will","would","could","should","may","might",
    "complete","write","prepare","review","finalise","submit","create",
    "make","build","add","update","fix","check","read","my","your","our",
    "this","that","these","those","it","its","we","they","them","their",
    "final","report","slides","presentation","code","project","assignment",
}

def _smart_query(task_title: str) -> str:
    """Extract meaningful academic keywords from a task title."""
    words  = re.findall(r"[a-zA-Z]+", task_title.lower())
    kws    = [w for w in words if w not in STOP_WORDS and len(w) > 4]
    # Map common student terms to academic equivalents
    mapping = {
        "microservices":  "microservices architecture",
        "procrastination":"procrastination academic performance",
        "fastapi":        "REST API web framework",
        "mastodon":       "federated social network",
        "github":         "software version control collaboration",
        "scheduling":     "task scheduling algorithm",
        "finance":        "personal finance management",
        "chatbot":        "conversational agent NLP",
        "cloud":          "cloud computing scalability",
    }
    title_lower = task_title.lower()
    for key, replacement in mapping.items():
        if key in title_lower:
            return replacement
    return " ".join(kws[:4]) if kws else "cloud computing microservices"


def _parse_arxiv(xml_text: str) -> list[dict]:
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    try:
        root    = ET.fromstring(xml_text)
        papers  = []
        for entry in root.findall("atom:entry", ns):
            title   = entry.findtext("atom:title",   "", ns).strip().replace("\n", " ")
            summary = entry.findtext("atom:summary", "", ns).strip().replace("\n", " ")[:250]
            url     = entry.findtext("atom:id",      "", ns).strip()
            pub     = entry.findtext("atom:published","", ns)[:10]
            authors = [a.findtext("atom:name","",ns) for a in entry.findall("atom:author",ns)][:3]
            if title and "atom:entry" not in title:
                papers.append({"title": title, "summary": summary, "url": url, "published": pub, "authors": authors})
        return papers
    except Exception:
        return []


async def _ai_relevance(papers: list[dict], query: str) -> list[dict]:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key or not papers:
        for p in papers:
            p["relevance"] = "Relevant to your research topic."
        return papers

    papers_text = "\n".join([
        f"{i+1}. {p['title']}" for i, p in enumerate(papers[:5])
    ])

    prompt = f"""Research topic: "{query}"

For each paper, write ONE sentence (max 12 words) explaining its practical relevance to a student studying this topic.

Papers:
{papers_text}

Respond EXACTLY:
1: [sentence]
2: [sentence]
3: [sentence]
4: [sentence]
5: [sentence]"""

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 200},
        )

    if r.status_code == 200:
        text  = r.json()["choices"][0]["message"]["content"]
        lines = {int(l.split(":")[0].strip())-1: l.split(":",1)[1].strip()
                 for l in text.strip().split("\n")
                 if ":" in l and l.split(":")[0].strip().isdigit()}
        for i, paper in enumerate(papers[:5]):
            paper["relevance"] = lines.get(i, "Relevant to your research topic.")

    return papers


@router.get("/search")
async def search_papers(query: str, max_results: int = 5):
    url = f"{ARXIV_API}?search_query=all:{quote(query)}&start=0&max_results={max_results}&sortBy=relevance"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url)
    if r.status_code != 200:
        return {"papers": [], "query": query, "error": "arXiv API unavailable — try again shortly"}
    papers = _parse_arxiv(r.text)
    papers = await _ai_relevance(papers, query)
    return {"papers": papers[:5], "query": query, "source": "arXiv.org — Cornell University", "total": len(papers)}


@router.get("/suggest")
async def suggest_papers():
    from services.tasks.store import task_store
    tasks = [t for t in task_store.values() if t["status"] in ("pending","in_progress")]
    if not tasks:
        query = "cloud computing microservices"
    else:
        query = _smart_query(tasks[0]["title"])
    return await search_papers(query, max_results=5)


@router.get("/health")
async def research_health():
    return {"status": "ok", "source": "arXiv.org (Cornell University, HTTPS, no auth)"}