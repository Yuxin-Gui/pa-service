"""
Singapore Agent — live PSI, weather, and bus arrivals from Singapore Government APIs.
"""

from fastapi import APIRouter
import httpx
import os
from datetime import datetime

router = APIRouter()

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"


async def _get_weather() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast")
            if r.status_code == 200:
                data = r.json()
                # New API structure: data.data.items[0].forecasts
                forecasts = data.get("data", {}).get("items", [{}])[0].get("forecasts", [])
                if forecasts:
                    return {
                        "area":     forecasts[0].get("area", "Singapore"),
                        "forecast": forecasts[0].get("forecast", "Unavailable"),
                    }
    except Exception as e:
        print(f"Weather error: {e}")
    return {"area": "Singapore", "forecast": "Unavailable"}


async def _get_psi() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api-open.data.gov.sg/v2/real-time/api/psi")
            if r.status_code == 200:
                data = r.json()
                readings = data.get("data", {}).get("items", [{}])[0].get("readings", {})
                psi_24h  = readings.get("psi_twenty_four_hourly", {})
                val      = psi_24h.get("national") or psi_24h.get("central")
                return {"psi": val, "status": _psi_status(val)}
    except Exception as e:
        print(f"PSI error: {e}")
    return {"psi": None, "status": "Unavailable"}


def _psi_status(psi) -> str:
    if psi is None:  return "Unavailable"
    if psi <= 50:    return "Good"
    if psi <= 100:   return "Moderate"
    if psi <= 200:   return "Unhealthy"
    if psi <= 300:   return "Very Unhealthy"
    return "Hazardous"


async def _get_bus(bus_stop: str) -> list:
    lta_key = os.environ.get("LTA_API_KEY", "")
    if not lta_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode={bus_stop}",
                headers={"AccountKey": lta_key}
            )
            if r.status_code == 200:
                services = r.json().get("Services", [])
                load_map = {
                    "SEA": "Seats available",
                    "SDA": "Standing available",
                    "LSD": "Limited standing",
                }
                result = []
                for s in services:
                    next1 = s.get("NextBus", {})
                    eta   = next1.get("EstimatedArrival", "")
                    mins  = "–"
                    if eta:
                        try:
                            from datetime import timezone, timedelta
                            sgt = timezone(timedelta(hours=8))
                            arrival = datetime.fromisoformat(eta).astimezone(sgt)
                            now_sgt = datetime.now(sgt)
                            diff = (arrival - now_sgt).total_seconds()
                            mins = max(0, int(diff // 60))
                        except Exception:
                            pass
                    result.append({
                        "service": s.get("ServiceNo", ""),
                        "load":    load_map.get(next1.get("Load", ""), "Seats available"),
                        "eta_min": mins,
                    })
                return result
    except Exception as e:
        print(f"Bus error: {e}")
    return []


async def _ai_briefing(psi, weather, bus, tasks) -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")

    task_list    = ", ".join(t["title"] for t in tasks[:3]) if tasks else "no pending tasks"
    alert_text   = f"{len(bus)} bus service(s) running" if bus else "No bus data"
    psi_text     = f"PSI {psi['psi']} ({psi['status']})" if psi.get("psi") else "PSI data unavailable"
    weather_text = f"{weather.get('forecast', 'Unknown')} near {weather.get('area', 'Singapore')}"

    if not api_key:
        return f"Weather: {weather_text}. Air quality: {psi_text}."

    prompt = f"""You are a helpful Singapore PA assistant. Write exactly 2 short, natural sentences for an NTU student.

Conditions right now:
- Weather: {weather_text}
- Air quality: {psi_text}
- Transport: {alert_text}
- Most urgent task: {task_list}

Rules:
- Do NOT write "Sentence 1:" or "Sentence 2:" — just write the sentences naturally
- Sentence 1: practical outdoor advice (weather + air quality)
- Sentence 2: one task nudge, specific and encouraging
- Maximum 30 words total
- Casual, friendly tone"""

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 100},
        )

    if r.status_code == 200:
        return r.json()["choices"][0]["message"]["content"].strip()
    return f"Weather: {weather_text}. Air quality: {psi_text}."


@router.get("/daily")
async def singapore_daily(bus_stop: str = "83139"):
    from services.tasks.store import task_store
    tasks   = [t for t in task_store.values() if t["status"] == "pending"]
    weather = await _get_weather()
    psi     = await _get_psi()
    bus     = await _get_bus(bus_stop)
    brief   = await _ai_briefing(psi, weather, bus, tasks)

    return {
        "weather":      weather,
        "psi":          psi,
        "bus_arrivals": bus,
        "bus_stop":     bus_stop,
        "briefing":     brief,
        "updated":      datetime.utcnow().isoformat(),
    }


@router.get("/health")
async def sg_health():
    return {"status": "ok", "source": "data.gov.sg + LTA DataMall v3"}