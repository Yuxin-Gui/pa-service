"""
Personal Finance Tracker microservice.
Tracks spending, categorises expenses, generates AI monthly summaries.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from collections import defaultdict
from pydantic import BaseModel
from typing import Optional
import uuid
import os
import httpx

router = APIRouter()

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"

CATEGORIES = ["Food", "Transport", "Study", "Entertainment", "Shopping", "Health", "Utilities", "Other"]


class ExpenseCreate(BaseModel):
    amount:      float
    category:    str
    description: Optional[str] = ""
    date:        Optional[str] = None


class ExpenseOut(BaseModel):
    id:          str
    amount:      float
    category:    str
    description: str
    date:        str
    created_at:  str


@router.get("/", response_model=list[ExpenseOut])
async def get_expenses():
    from services.finance.store import finance_store
    return sorted(finance_store.values(), key=lambda x: x["date"], reverse=True)


@router.post("/", response_model=ExpenseOut)
async def add_expense(body: ExpenseCreate):
    from services.finance.store import finance_store
    if body.category not in CATEGORIES:
        raise HTTPException(400, f"Invalid category. Choose from: {CATEGORIES}")
    eid = str(uuid.uuid4())[:8]
    expense = {
        "id":          eid,
        "amount":      round(body.amount, 2),
        "category":    body.category,
        "description": body.description or "",
        "date":        body.date or datetime.utcnow().strftime("%Y-%m-%d"),
        "created_at":  datetime.utcnow().isoformat(),
    }
    finance_store[eid] = expense
    return expense


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(expense_id: str):
    from services.finance.store import finance_store
    if expense_id not in finance_store:
        raise HTTPException(404, "Expense not found")
    del finance_store[expense_id]


@router.get("/summary")
async def get_summary():
    from services.finance.store import finance_store
    expenses = list(finance_store.values())
    if not expenses:
        return { "total": 0, "by_category": {}, "this_week": 0, "ai_insight": None }

    now       = datetime.utcnow()
    week_ago  = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")

    total_month  = sum(e["amount"] for e in expenses if e["date"] >= month_ago)
    total_week   = sum(e["amount"] for e in expenses if e["date"] >= week_ago)

    by_category  = defaultdict(float)
    for e in expenses:
        if e["date"] >= month_ago:
            by_category[e["category"]] += e["amount"]
    by_category = dict(sorted(by_category.items(), key=lambda x: -x[1]))

    # Top spending category
    top_cat = max(by_category, key=by_category.get) if by_category else None

    # AI insight
    ai_insight = await _get_ai_insight(total_week, total_month, by_category, expenses)

    return {
        "total_month":  round(total_month, 2),
        "total_week":   round(total_week, 2),
        "by_category":  {k: round(v, 2) for k, v in by_category.items()},
        "top_category": top_cat,
        "ai_insight":   ai_insight,
        "expense_count": len([e for e in expenses if e["date"] >= month_ago]),
    }


async def _get_ai_insight(week: float, month: float, by_cat: dict, expenses: list) -> str:
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        top = max(by_cat, key=by_cat.get) if by_cat else "unknown"
        return f"You spent ${week:.2f} this week and ${month:.2f} this month. Your biggest category is {top}."

    cat_str = ", ".join(f"{k}: ${v:.2f}" for k, v in list(by_cat.items())[:5])
    prompt = f"""You are a personal finance assistant for a university student in Singapore. Give ONE clear, specific, actionable sentence about their spending. 

Rules:
- Pick the most interesting pattern (biggest category, overspending, good saving)
- Use exact dollar amounts
- Be direct and easy to understand
- No jargon, no contradictions
- Example good insight: "You spent S$47 on food this week — try cooking at home twice to save around S$15."
- Example bad insight: anything vague or contradictory

Data:
- This week: S${week:.2f}
- This month: S${month:.2f}  
- By category: {cat_str}

One sentence only:"""


    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 80},
        )
    if r.status_code == 200:
        return r.json()["choices"][0]["message"]["content"].strip()
    return f"You spent S${week:.2f} this week across {len(by_cat)} categories."


@router.get("/categories")
async def get_categories():
    return CATEGORIES

@router.get("/health")
async def finance_health():
    from services.finance.store import finance_store
    return {"status": "ok", "expense_count": len(finance_store)}