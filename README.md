# PA-as-a-Service 

> **NTU Cloud Computing Assignment — Topic 2: Personal Assistant-as-a-Service**
> A microservices platform that unifies 11 personal assistant capabilities into one interface, powered by Meta Llama 3 via Groq AI.

[![Python](https://img.shields.io/badge/Python-3.12-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev)
[![Groq](https://img.shields.io/badge/AI-Groq%20Llama%203-orange)](https://groq.com)

---

## What It Does

PA-as-a-Service decomposes a personal assistant into 11 independent REST microservices. The platform integrates 8 external APIs and connects them through a cross-service AI reasoning layer — the PA Chat Agent knows your tasks, calendar, and spending in real time, and can act across all services through tool-calling.

**The problem it solves:** Knowledge workers switch between 8–10 apps per study session, costing an average of 23 minutes 15 seconds of refocus time per switch (Mark et al., 2008). PA-as-a-Service reduces that to one application.

---

## Architecture

```
Frontend (React 18 — port 3000)
        │  HTTP / JSON (CORS)
        ▼
Backend  (FastAPI — port 8000)
        │
        ├── /api/tasks          → In-memory task store
        ├── /api/scheduler      → In-memory event store
        ├── /api/github         → GitHub REST API v3
        ├── /api/mastodon       → Mastodon REST API
        ├── /api/hackernews     → HN Firebase API (no key)
        ├── /api/singapore      → data.gov.sg + LTA DataMall v3
        ├── /api/research       → arXiv API (Cornell, no key)
        ├── /api/chat           → Groq llama-3.3-70b-versatile
        ├── /api/procrastination→ Groq llama-3.1-8b-instant
        ├── /api/finance        → Groq llama-3.1-8b-instant
        └── /api/status         → Aggregate dashboard stats
```

---

## Microservices

| # | Service | Tab | External API | Auth |
|---|---------|-----|-------------|------|
| 1 | Task Manager | Tasks | None (in-memory) | None |
| 2 | Scheduler | Scheduler | None (in-memory) | None |
| 3 | GitHub Agent | GitHub | `api.github.com` | Optional token |
| 4 | Mastodon Agent | Mastodon | Instance `/api/v1/` | Access token |
| 5 | HackerNews Agent | Tech News | `hacker-news.firebaseio.com` | None |
| 6 | Singapore Agent | SG Context | `data.gov.sg` + LTA DataMall v3 | LTA key optional |
| 7 | Research Assistant | Research | `export.arxiv.org` (HTTPS) | None |
| 8 | PA Chat Agent | PA Chat | Groq `llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| 9 | Focus Mode | Focus Mode | Groq `llama-3.1-8b-instant` | `GROQ_API_KEY` |
| 10 | Finance Tracker | Finance | Groq `llama-3.1-8b-instant` | `GROQ_API_KEY` |
| 11 | Reports | Reports | Open-Meteo API | None |

---

## Folder Structure

```
pa-service/
├── start.bat                          # One-click start (Windows)
├── README.md
│
├── backend/
│   ├── main.py                        # FastAPI gateway — mounts all 11 routers
│   ├── requirements.txt
│   ├── .env                           # API keys (NOT committed — see below)
│   ├── shared/
│   │   └── models.py                  # Shared Pydantic models
│   └── services/
│       ├── tasks/
│       │   ├── router.py
│       │   └── store.py               # In-memory task store + seed data
│       ├── scheduler/
│       │   ├── router.py
│       │   └── store.py               # In-memory scheduler store + seed data
│       ├── github_agent/
│       │   └── router.py
│       ├── mastodon_agent/
│       │   └── router.py
│       ├── hackernews/
│       │   └── router.py
│       ├── singapore/
│       │   └── router.py
│       ├── research/
│       │   └── router.py
│       ├── chat_agent/
│       │   └── router.py              # Tool-calling: create_task, add_expense, create_event, complete_task
│       ├── procrastination/
│       │   └── router.py              # Risk engine + Gollwitzer implementation intentions
│       └── finance/
│           ├── router.py
│           └── store.py               # In-memory finance store + 30-day seed data
│
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── App.jsx                    # All 11 panels + sidebar + dashboard
        └── index.js
```

---

## Prerequisites

- **Python 3.12+**
- **Node.js 18+** and npm
- **Groq API key** (free — no credit card required): https://console.groq.com

Optional:
- **LTA DataMall API key** (free — bus arrivals): https://datamall.lta.gov.sg
- **Mastodon access token** (free — from your instance settings)
- **GitHub personal access token** (optional — increases rate limit from 60 to 5,000 req/hr)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Yuxin-Gui/pa-service.git
cd pa-service
```

### 2. Configure API keys

Create `backend/.env`:

```env
GROQ_API_KEY=your_groq_key_here

# Optional — enables live bus arrivals in SG Context tab
LTA_API_KEY=your_lta_key_here

# Optional — enables live Mastodon feed analysis
MASTODON_ACCESS_TOKEN=your_mastodon_token_here
MASTODON_INSTANCE=https://mastodon.social
```

> **Note:** `.env` is in `.gitignore` and will never be committed. The application runs without `LTA_API_KEY` and `MASTODON_ACCESS_TOKEN` — those tabs degrade gracefully with instructions to register.

### 3. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Install frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Running the Application

### Windows (one command)

From the project root:

```
start.bat
```

This opens two terminal windows — one for the backend, one for the frontend.

### Manual (any OS)

**Terminal 1 — Backend:**
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm start
```

Then open **http://localhost:3000** in your browser.

**API documentation:** http://localhost:8000/docs (auto-generated OpenAPI/Swagger)

---

## Feature Highlights

### PA Chat — Tool-Calling AI
The chat agent reads your live task list, events, and spending at every request. Type natural language to act across the platform:

```
"Add $8.50 for chicken rice lunch"          → logs expense to Finance
"Create high priority task: write report"    → adds task to Task Manager
"Schedule groupmate meeting tomorrow 2pm"    → creates scheduler event
"Mark 'Push final code to GitHub' as done"  → updates task status
```

The backend calls Groq, parses the tool-call response, executes the store write, and returns a confirmation — all transparently.

### HackerNews Agent — Task-Correlation
Fetches the top 20 HN stories, concurrently retrieves metadata using `asyncio.gather()`, and runs AI summarisation via Groq. A deterministic keyword-matching algorithm (no LLM judgment) flags stories as relevant to your active tasks — no false positives.

### Singapore Agent — Live Government Data
Hits three endpoints concurrently:
- `data.gov.sg/v1/environment/2-hour-nowcast` — weather near central Singapore
- `data.gov.sg/v1/environment/psi` — national PSI air quality index
- `datamall2.mytransport.sg/ltaodataservice/v3/BusArrival` — bus ETAs (requires free LTA key)

Groq generates a 2-sentence practical daily briefing combining all three data sources with your most urgent task.

### Research Assistant — Smart arXiv Search
A `_smart_query()` function maps student task terms to meaningful academic queries before hitting `export.arxiv.org`. For example:
- `"microservices"` → `"microservices architecture"`
- `"procrastination"` → `"procrastination academic performance"`
- `"chatbot"` → `"conversational agent NLP"`

This prevents arXiv from receiving task-management language that would return irrelevant results.

### Focus Mode — Behavioral Science Engine
Computes a procrastination risk score from four weighted factors (overdue tasks, stuck in-progress tasks, high-priority backlog, priority avoidance pattern). At **HIGH** risk (score ≥ 60), a Focus Lock overlay covers the entire application and requires explicit acknowledgement before proceeding — implementing the friction mechanism from Thaler & Sunstein (2008).

AI-generated implementation intentions follow Gollwitzer's (1999) if-then format:
> *"If it is after 3 PM, then I will sit down at my desk and work on 'Write literature review' for 25 minutes."*

The 25-minute Pomodoro timer is based on Cirillo (2006). Encouragement messages are written around Sirois's (2014) self-compassion findings.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | List all active services |
| GET | `/api/status` | Task/event/expense counts for dashboard |
| GET | `/api/tasks/` | List all tasks |
| POST | `/api/tasks/` | Create a task |
| PATCH | `/api/tasks/{id}/status` | Update task status |
| DELETE | `/api/tasks/{id}` | Delete a task |
| GET | `/api/scheduler/` | List all events |
| POST | `/api/scheduler/` | Create an event |
| DELETE | `/api/scheduler/{id}` | Delete an event |
| POST | `/api/github/analyse` | AI analysis of a GitHub repo |
| GET | `/api/github/trending` | Trending Python repos this week |
| POST | `/api/mastodon/analyse` | Analyse live Mastodon feed |
| GET | `/api/mastodon/demo-trends` | Demo trends (no token required) |
| GET | `/api/hackernews/top` | Top HN stories with AI summaries |
| GET | `/api/singapore/daily` | Live SG weather, PSI, bus arrivals + AI briefing |
| GET | `/api/research/search?query=` | Search arXiv papers |
| GET | `/api/research/suggest` | Auto-suggest papers from active tasks |
| POST | `/api/chat/message` | Send message to PA Chat Agent |
| POST | `/api/procrastination/analyse` | Compute risk score + implementation intention |
| GET | `/api/finance/summary` | Spending stats + AI insight |
| POST | `/api/finance/expenses` | Log a new expense |
| GET | `/api/finance/expenses` | List all expenses |

---

## UX Design Decisions

All interface decisions were evaluated against Nielsen's (1994) ten usability heuristics:

| Heuristic | Implementation |
|-----------|---------------|
| H1: System status | Toast notifications on every action (top-right) |
| H2: Real-world match | `friendlyError()` translates all HTTP codes to plain English |
| H3: User control | `UndoBar` (5-second window) on every delete |
| H4: Consistency | Single design token object (`const C`) across all 11 panels |
| H5: Error prevention | Submit buttons disabled until all required fields are valid |
| H6: Recognition over recall | Quick-search pills in Research; trending cards in GitHub |
| H7: Efficiency | Task filter pills (All / Pending / In Progress / Done / Overdue) |
| H8: Minimalist design | Sidebar grouped into 3 sections per Miller's (1956) 7±2 rule |
| H9: Error recovery | Per-error-type messages; token fields link to registration pages |
| H10: Help | Tooltips on GitHub and Mastodon token fields |

The sidebar groups 11 tabs into three sections — **Core**, **AI Agents**, **Personal** — keeping each group within Miller's (1956) 7 ± 2 working memory range.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend framework | FastAPI 0.115 + Uvicorn |
| AI inference | Groq API (llama-3.3-70b-versatile, llama-3.1-8b-instant) |
| Frontend framework | React 18 |
| HTTP client (backend) | httpx (async) |
| Data validation | Pydantic v2 |
| Storage | In-memory Python dicts (task_store, schedule_store, finance_store) |
| External APIs | GitHub REST v3, Mastodon REST, HN Firebase, data.gov.sg, LTA DataMall v3, arXiv, Open-Meteo |

---

## Why Groq Instead of OpenAI/Anthropic?

Groq's free tier requires no credit card and provides generous rate limits for development. It serves Meta's open-source Llama 3 models through an OpenAI-compatible API, making it straightforward to switch providers later by changing a single base URL and API key.

---

## Known Limitations

- **In-memory storage only** — all data resets on backend restart. A production deployment would use SQLite or PostgreSQL.
- **Single-user** — no authentication layer. All services share one in-memory store.
- **LTA bus arrivals require a free key** — the Singapore Agent displays a registration link if `LTA_API_KEY` is absent.

---

## References

- Cirillo, F. (2006). *The Pomodoro Technique.* FC Garage.
- Fielding, R. T. (2000). *Architectural styles and the design of network-based software architectures* [Doctoral dissertation, UC Irvine].
- Gollwitzer, P. M. (1999). Implementation intentions. *American Psychologist, 54*(9), 736–740.
- Mark, G., Gudith, D., & Klocke, U. (2008). The cost of interrupted work. *CHI '08*, 107–110.
- Mark, G. (2022, August). How much time do we waste toggling between applications? *Harvard Business Review.*
- Miller, G. A. (1956). The magical number seven. *Psychological Review, 63*(2), 81–97.
- Newman, S. (2015). *Building microservices.* O'Reilly Media.
- Nielsen, J. (1994). Heuristic evaluation. In *Usability inspection methods* (pp. 25–62). Wiley.
- Sirois, F. M. (2014). Procrastination and stress. *Self and Identity, 13*(2), 128–145.
- Thaler, R. H., & Sunstein, C. R. (2008). *Nudge.* Yale University Press.

---

## Submission

- **Due:** April 17, 2026
- **Course:** Cloud Computing — NTU SCSE
- **Assignment:** Topic 2 — Personal Assistant-as-a-Service
- **GitHub:** https://github.com/Yuxin-Gui/pa-service
