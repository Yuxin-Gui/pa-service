@echo off
echo Starting PA-as-a-Service...
start cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"
timeout /t 3
start cmd /k "cd frontend && npm start"