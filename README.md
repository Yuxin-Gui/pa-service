# PA-as-a-Service

A full-stack Personal Assistant platform built for NTU Cloud Computing (Topic 2).
Decomposes PA capabilities into 11 independent microservices communicating via RESTful APIs,
powered by Groq AI (Llama 3.1/3.3).

## Features

| Service | API Used | Auth Required |
|---|---|---|
| Task Manager | Internal | No |
| Scheduler | Internal | No |
| GitHub Agent | GitHub REST API | Optional (token increases rate limits) |
| Mastodon Agent | Mastodon REST API | Yes (free account) |
| HackerNews Agent | HN Firebase API | No |
| Singapore Agent | data.gov.sg + LTA DataMall | No (LTA optional) |
| Research Assistant | arXiv.org API | No |
| PA Chat | Groq API (Llama 3.3 70B) | Yes (free) |
| Focus Mode | Groq API (Llama 3.1 8B) | Yes (free) |
| Finance Tracker | Groq API (Llama 3.1 8B) | Yes (free) |
| Reports | Open-Meteo API | No |

## Setup

### Prerequisites
- Python 3.12+
- Node.js 18+

### Backend
```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env`:
```
GROQ_API_KEY=your-groq-key-here
MASTODON_ACCESS_TOKEN=your-mastodon-token
MASTODON_INSTANCE=https://mastodon.social
LTA_API_KEY=your-lta-key-here  # optional
```
```bash
python -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000

## API Documentation
Visit http://localhost:8000/docs for the full interactive API reference.

## Architecture
- **Backend**: FastAPI (Python) with 11 microservice routers
- **Frontend**: React 18 with Chart.js
- **AI**: Groq API — Llama 3.3 70B (chat/tool-calling) + Llama 3.1 8B (analysis)
- **External APIs**: GitHub, Mastodon, HackerNews, data.gov.sg, LTA DataMall, arXiv, Open-Meteo

## Procrastination Science
The Focus Mode implements peer-reviewed interventions:
- Implementation Intentions (Gollwitzer, 1999) — increases follow-through by 300%
- Pomodoro Technique (Cirillo, 1980s)
- Self-Compassion (Sirois, Durham University)
- Nudge Theory friction barriers (Thaler & Sunstein, 2008)