from datetime import datetime, timedelta
import uuid

finance_store: dict = {}

CATEGORIES = ["Food", "Transport", "Study", "Entertainment", "Shopping", "Health", "Utilities", "Other"]

def _seed():
    now = datetime.utcnow()
    seeds = [
        { "amount": 8.50,  "category": "Food",         "description": "Lunch at canteen",         "days_ago": 0  },
        { "amount": 2.10,  "category": "Transport",     "description": "MRT to school",            "days_ago": 0  },
        { "amount": 6.80,  "category": "Food",          "description": "Bubble tea",               "days_ago": 1  },
        { "amount": 4.20,  "category": "Transport",     "description": "Bus fare",                 "days_ago": 1  },
        { "amount": 12.90, "category": "Food",          "description": "Dinner with friends",      "days_ago": 2  },
        { "amount": 2.10,  "category": "Transport",     "description": "MRT home",                 "days_ago": 2  },
        { "amount": 9.50,  "category": "Food",          "description": "Chicken rice set",         "days_ago": 3  },
        { "amount": 15.00, "category": "Entertainment", "description": "Netflix subscription",     "days_ago": 5  },
        { "amount": 4.50,  "category": "Food",          "description": "Kopi and toast",           "days_ago": 5  },
        { "amount": 45.00, "category": "Study",         "description": "Textbook purchase",        "days_ago": 7  },
        { "amount": 22.50, "category": "Shopping",      "description": "Stationery supplies",      "days_ago": 8  },
        { "amount": 3.50,  "category": "Transport",     "description": "Bus to Orchard",           "days_ago": 9  },
        { "amount": 11.80, "category": "Food",          "description": "Mala hotpot",              "days_ago": 10 },
        { "amount": 8.00,  "category": "Health",        "description": "Panadol and vitamins",     "days_ago": 12 },
        { "amount": 5.50,  "category": "Food",          "description": "Wonton noodle soup",       "days_ago": 14 },
        { "amount": 18.00, "category": "Study",         "description": "Printing and binding",     "days_ago": 15 },
        { "amount": 7.20,  "category": "Food",          "description": "Nasi lemak",               "days_ago": 17 },
        { "amount": 12.00, "category": "Entertainment", "description": "Movie ticket",             "days_ago": 20 },
        { "amount": 3.80,  "category": "Transport",     "description": "MRT to Jurong",            "days_ago": 22 },
        { "amount": 6.50,  "category": "Food",          "description": "Roti prata",               "days_ago": 25 },
    ]
    for s in seeds:
        eid  = str(uuid.uuid4())[:8]
        date = (now - timedelta(days=s["days_ago"])).strftime("%Y-%m-%d")
        finance_store[eid] = {
            "id":          eid,
            "amount":      s["amount"],
            "category":    s["category"],
            "description": s["description"],
            "date":        date,
            "created_at":  datetime.utcnow().isoformat(),
        }

_seed()