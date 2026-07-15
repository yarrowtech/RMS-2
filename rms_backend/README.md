# RMS Backend (FastAPI + MongoDB)

This project contains a FastAPI backend implementing an admin onboarding workflow:
- SuperAdmin creates Admin (name, email, department)
- Email is sent with a password-setup JWT link
- Admin sets password via link -> account becomes ACTIVE
- Admin logs in -> receives JWT with department -> frontend redirects to department dashboard

## Setup (local)
1. Copy `.env.example` to `.env` and fill values.
2. Create virtualenv and install requirements:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```
3. Run the app:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
4. Test endpoints (use Postman / curl / frontend):
   - POST /superadmin/admins/create
   - POST /auth/set-password
   - POST /auth/login
   - GET /admin/me (protected)