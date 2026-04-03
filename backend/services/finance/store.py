from datetime import datetime, timedelta
import uuid

finance_store: dict = {}

CATEGORIES = ["Food", "Transport", "Study", "Entertainment", "Shopping", "Health", "Utilities", "Other"]

def _seed():
    now = datetime.utcnow()
    seeds = [
        { "amount": 8.50,  "category": "Food",          "description": "Lunch at canteen",        "date": (now - timedelta(days=1)).strftime("%Y-%m-%d") },
        { "amount": 2.10,  "category": "Transport",      "description": "MRT to school",           "date": (now - timedelta(days=1)).strftime("%Y-%m-%d") },
        { "amount": 45.00, "category": "Study",          "description": "Textbook purchase",       "date": (now - timedelta(days=2)).strftime("%Y-%m-%d") },
        { "amount": 12.90, "category": "Food",           "description": "Dinner with friends",     "date": (now - timedelta(days=2)).strftime("%Y-%m-%d") },
        { "amount": 15.00, "category": "Entertainment",  "description": "Netflix subscription",    "date": (now - timedelta(days=3)).strftime("%Y-%m-%d") },
        { "amount": 4.20,  "category": "Transport",      "description": "Bus fare",                "date": (now - timedelta(days=3)).strftime("%Y-%m-%d") },
        { "amount": 6.80,  "category": "Food",           "description": "Bubble tea",              "date": (now - timedelta(days=4)).strftime("%Y-%m-%d") },
        { "amount": 22.50, "category": "Shopping",       "description": "Stationery",              "date": (now - timedelta(days=5)).strftime("%Y-%m-%d") },
        { "amount": 9.00,  "category": "Food",           "description": "Breakfast + coffee",      "date": (now - timedelta(days=6)).strftime("%Y-%m-%d") },
        { "amount": 3.50,  "category": "Transport",      "description": "Bus to Orchard",          "date": (now - timedelta(days=7)).strftime("%Y-%m-%d") },
    ]
    for s in seeds:
        eid = str(uuid.uuid4())[:8]
        finance_store[eid] = {
            "id":          eid,
            "amount":      s["amount"],
            "category":    s["category"],
            "description": s["description"],
            "date":        s["date"],
            "created_at":  datetime.utcnow().isoformat(),
        }

_seed()