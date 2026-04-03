"""
Singapore Agent — live PSI air quality from data.gov.sg
and bus arrivals from LTA DataMall (free registration required).
"""

from fastapi import APIRouter
import httpx
import os
from datetime import datetime

router = APIRouter()

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"


async def _get_psi() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.data.gov.sg/v1/environment/psi")
            if r.status_code == 200:
                data     = r.json()
                readings = data.get("items", [{}])[0].get("readings", {})
                psi_24h  = readings.get("psi_twenty_four_hourly", {})
                national = psi_24h.get("national") or psi_24h.get("central") or None
                return {
                    "psi":      national,
                    "status":   _psi_status(national),
                    "updated":  data.get("items", [{}])[0].get("timestamp", ""),
                }
    except Exception:
        pass
    return {"psi": None, "status": "Unavailable", "updated": ""}


async def _get_weather() -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.data.gov.sg/v1/environment/2-hour-nowcast")
            if r.status_code == 200:
                data      = r.json()
                forecasts = data.get("items", [{}])[0].get("forecasts", [])
                central   = ["Ang Mo Kio", "Bishan", "Toa Payoh", "Novena"]
                for f in forecasts:
                    if f.get("area") in central:
                        return {"area": f["area"], "forecast": f["forecast"]}
                if forecasts:
                    return {"area": forecasts[0].get("area","Singapore"), "forecast": forecasts[0].get("forecast","")}
    except Exception:
        pass
    return {"area": "Singapore", "forecast": "Unavailable"}


async def _get_bus(bus_stop: str) -> dict:
    lta_key = os.environ.get("LTA_API_KEY", "")
    if not lta_key:
        return {
            "available": False,
            "message":   "Register free at datamall.lta.gov.sg and add LTA_API_KEY to your .env file",
            "stop":      bus_stop,
        }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode={bus_stop}",
                headers={"AccountKey": lta_key, "accept": "application/json"},
            )
            if r.status_code == 200:
                services = r.json().get("Services", [])[:4]
                buses    = []
                for s in services:
                    n1 = s.get("NextBus", {})
                    eta = n1.get("EstimatedArrival", "")
                    if eta:
                        from datetime import timezone
                        now  = datetime.now(timezone.utc)
                        arr  = datetime.fromisoformat(eta.replace("Z","+00:00"))
                        mins = max(0, int((arr - now).total_seconds() // 60))
                        eta_str = f"{mins} min" if mins <= 60 else "—"
                    else:
                        eta_str = "—"
                    buses.append({
                        "service": s.get("ServiceNo"),
                        "eta":     eta_str,
                        "load":    n1.get("Load", ""),
                        "type":    n1.get("Type", ""),
                    })
                return {"available": True, "stop": bus_stop, "buses": buses}
    except Exception:
        pass
    return {"available": False, "message": "Bus data unavailable", "stop": bus_stop}


def _psi_status(psi) -> str:
    if psi is None: return "Unavailable"
    psi = int(psi)
    if psi <= 50:  return "Good"
    if psi <= 100: return "Moderate"
    if psi <= 200: return "Unhealthy"
    if psi <= 300: return "Very Unhealthy"
    return "Hazardous"


def _psi_advice(psi, status) -> str:
    if status == "Unavailable": return "PSI data currently unavailable."
    if status == "Good":        return "Air quality is good — safe for all outdoor activities."
    if status == "Moderate":    return "Acceptable air quality — unusually sensitive people should limit prolonged outdoor exertion."
    if status == "Unhealthy":   return "Unhealthy — reduce prolonged outdoor exertion, especially if sensitive."
    return "Very unhealthy — avoid outdoor activities."


async def _ai_briefing(psi: dict, weather: dict, bus: dict, tasks: list) -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return f"Air quality: {psi['status']}. Weather: {weather['forecast']}. {_psi_advice(psi.get('psi'), psi['status'])}"

    task_str = ", ".join(t["title"] for t in tasks[:3]) if tasks else "none"
    bus_str  = (", ".join(f"Bus {b['service']} in {b['eta']}" for b in bus.get("buses", []))
                if bus.get("available") else "Bus data unavailable")
    psi_str  = f"PSI {psi['psi']} ({psi['status']})" if psi["psi"] else "PSI unavailable"

    prompt = f"""You are a friendly PA for an NTU student in Singapore. Write exactly 2 practical sentences.

Current conditions:
- Air quality: {psi_str}
- Weather: {weather['forecast']} near {weather['area']}
- Bus arrivals: {bus_str}
- Urgent tasks: {task_str}

Sentence 1: outdoor safety advice based on PSI and weather.
Sentence 2: one specific task reminder. Be direct and practical."""

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 80},
        )
    if r.status_code == 200:
        return r.json()["choices"][0]["message"]["content"].strip()
    return f"{_psi_advice(psi.get('psi'), psi['status'])} Weather: {weather['forecast']}."


@router.get("/daily")
async def singapore_daily(bus_stop: str = "83139"):
    from services.tasks.store import task_store
    tasks   = [t for t in task_store.values() if t["status"] == "pending"]
    psi     = await _get_psi()
    weather = await _get_weather()
    bus     = await _get_bus(bus_stop)
    brief   = await _ai_briefing(psi, weather, bus, tasks)
    return {
        "psi":      psi,
        "weather":  weather,
        "bus":      bus,
        "briefing": brief,
        "sources":  ["data.gov.sg (PSI + Weather)", "datamall.lta.gov.sg (Bus)"],
        "updated":  datetime.utcnow().isoformat(),
    }


@router.get("/health")
async def sg_health():
    has_lta = bool(os.environ.get("LTA_API_KEY", ""))
    return {
        "status":  "ok",
        "sources": "data.gov.sg (free) + LTA DataMall (free registration)",
        "lta_key": "configured" if has_lta else "not set — bus arrivals disabled",
    }