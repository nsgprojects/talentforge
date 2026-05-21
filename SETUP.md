# TalentForge v2 — Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Python 3 + python-docx (`pip3 install python-docx`)

## Step 1 — Install dependencies
```bash
npm run install:all
```

## Step 2 — Environment variables
Copy `.env.example` to `server/.env` and fill in:
```env
DATABASE_URL=postgresql://localhost:5432/talentforge
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
ANTHROPIC_API_KEY=sk-ant-...
PORT=5000
CLIENT_URL=http://localhost:5173
```

## Step 3 — Database
```bash
# Create the database
createdb talentforge

# Run schema migration
npm run db:migrate

# Seed with demo users
npm run db:seed
```

## Step 4 — Run
```bash
# Terminal 1 — API server
npm run dev:server

# Terminal 2 — React client
npm run dev:client
```

Open http://localhost:5173

## Demo credentials
| Role      | Email                    | Password       |
|-----------|--------------------------|----------------|
| Admin     | admin@talentforge.com    | Admin@123      |
| Recruiter | ravi@talentforge.com     | Recruiter@123  |
| Recruiter | priya@talentforge.com    | Recruiter@123  |

## Two roles
- **Admin**: full access — monitoring, analytics, user management + everything recruiters can do
- **Recruiter**: Resume Optimizer (6-step), Resume library, Points library (own points only)

## Resume Optimizer — 6 steps
1. Upload DOCX/PDF/TXT (auto-parsed, saved as base resume V1)
2. Paste job description (AI extracts required/preferred skills)
3. AI gap analysis → review gaps → AI bullet generation per role
4. Preview & select bullets (side-by-side old vs new)
5. Export — Python inserts into original DOCX (formatting preserved)
6. Before/after dashboard with score comparison and download

## DOCX export note
Requires Python 3 and python-docx:
```bash
pip3 install python-docx
```
If not available, falls back to plain text export automatically.

## Points library ownership
- Admin sees ALL points from all recruiters
- Recruiters see ONLY their own saved/selected points
