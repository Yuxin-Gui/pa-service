from fastapi import APIRouter, HTTPException
import httpx
import os
from shared.models import GitHubAnalysisRequest, GitHubAnalysisResult

router = APIRouter()
GH_API   = "https://api.github.com"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"

async def _gh_get(path: str, token: str | None) -> dict | list:
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{GH_API}{path}", headers=headers)
        if r.status_code == 404:
            raise HTTPException(404, "GitHub repo not found")
        if r.status_code == 403:
            raise HTTPException(403, "GitHub rate-limit hit — provide a token")
        r.raise_for_status()
        return r.json()


async def _vibe_groq(repo_data: dict, commits: list, contributors: list) -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")
    lang          = repo_data.get("language") or "unknown"
    stars         = repo_data.get("stargazers_count", 0)
    forks         = repo_data.get("forks_count", 0)
    issues        = repo_data.get("open_issues_count", 0)
    description   = repo_data.get("description") or "No description"
    commit_msgs   = [c["commit"]["message"].split("\n")[0] for c in commits[:5]]
    contrib_names = [c["login"] for c in contributors[:5]]

    if not api_key:
        return _vibe_basic(stars, issues, lang, commit_msgs)

    prompt = f"""Analyse this GitHub repository and write a sharp 3-4 sentence vibe summary.

- Language: {lang}
- Stars: {stars:,} | Forks: {forks:,} | Open issues: {issues}
- Description: {description}
- Recent commits: {commit_msgs}
- Top contributors: {contrib_names}

Be specific, reference actual numbers, give a genuine developer opinion. Max one emoji. 3-4 sentences only."""

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 300},
        )

    if r.status_code == 200:
        return r.json()["choices"][0]["message"]["content"]
    return _vibe_basic(stars, issues, lang, commit_msgs)


def _vibe_basic(stars, issues, lang, commit_msgs):
    lines = [f"🔭 This {lang} repo has {stars:,} stars — "]
    lines.append("a genuine community darling. " if stars > 10_000 else
                 "solid traction. " if stars > 1_000 else "still growing. ")
    lines.append(f"With {issues} open issues, ")
    lines.append("there's plenty of work to be done. " if issues > 50 else "the project looks well-maintained. ")
    if commit_msgs:
        lines.append(f'Recent work: "{commit_msgs[0]}".')
    return "".join(lines)


@router.post("/analyse", response_model=GitHubAnalysisResult)
async def analyse_repo(body: GitHubAnalysisRequest):
    repo_path   = f"/repos/{body.owner}/{body.repo}"
    repo_data   = await _gh_get(repo_path, body.token)
    commits_raw = await _gh_get(f"{repo_path}/commits?per_page=10", body.token)
    contrib_raw = await _gh_get(f"{repo_path}/contributors?per_page=5", body.token)

    recent_commits = [
        {"sha": c["sha"][:7], "message": c["commit"]["message"].split("\n")[0][:80],
         "author": c["commit"]["author"]["name"], "date": c["commit"]["author"]["date"]}
        for c in (commits_raw if isinstance(commits_raw, list) else [])
    ]
    top_contributors = [
        {"login": c["login"], "contributions": c["contributions"], "avatar": c["avatar_url"]}
        for c in (contrib_raw if isinstance(contrib_raw, list) else [])
    ]
    vibe = await _vibe_groq(repo_data, commits_raw if isinstance(commits_raw, list) else [], top_contributors)

    return GitHubAnalysisResult(
        repo=f"{body.owner}/{body.repo}",
        stars=repo_data.get("stargazers_count", 0),
        forks=repo_data.get("forks_count", 0),
        open_issues=repo_data.get("open_issues_count", 0),
        description=repo_data.get("description") or "",
        language=repo_data.get("language") or "N/A",
        recent_commits=recent_commits,
        top_contributors=top_contributors,
        vibe_summary=vibe,
    )


@router.get("/trending")
async def trending_repos(language: str = "python"):
    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    data = await _gh_get(
        f"/search/repositories?q=language:{language}+created:>{cutoff}&sort=stars&order=desc&per_page=6",
        token=None,
    )
    results = []
    for r in data.get("items", []):
        desc = r.get("description") or ""
        # Filter out non-English descriptions
        if any(ord(c) > 127 for c in desc[:30]):
            continue
        results.append({
            "name": r["full_name"], "stars": r["stargazers_count"],
            "description": desc[:100],
            "url": r["html_url"], "language": r.get("language")
        })
    return results[:6]