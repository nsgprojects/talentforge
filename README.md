# ✦ TalentForge — IT Staffing Resume Platform

AI-powered resume management for IT staffing companies.  
Build, version, and tailor resumes to any job description with full admin monitoring.

---

## Prerequisites — Install These First

| Tool | Version | Install |
|------|---------|---------|
| **Node.js** | 18 or 20 LTS | https://nodejs.org (download LTS) |
| **npm** | comes with Node | — |
| **Docker Desktop** | latest | https://www.docker.com/products/docker-desktop |
| **Git** | any | https://git-scm.com |

> **Check your versions:**
> ```bash
> node  --version   # must be 18.x or 20.x
> npm   --version   # 9.x or 10.x
> docker --version  # any recent version
> ```

---

## Quick Start (5 steps)

### Step 1 — Clone / get the project

```bash
# If using Git:
git clone <your-repo-url> talentforge
cd talentforge

# Or just navigate to the folder you already have:
cd talentforge
```

---

### Step 2 — Set up environment variables

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in:

```env
# Required — generate a strong secret:
JWT_SECRET=your_super_long_random_secret_here

# Required — your Anthropic API key from https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx

# Database — keep these as-is if using Docker
DB_HOST=localhost
DB_PORT=5432
DB_NAME=talentforge
DB_USER=postgres
DB_PASSWORD=postgres
```

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### Step 3 — Start PostgreSQL with Docker

```bash
# From the talentforge/ root folder:
docker compose up -d postgres

# Verify it's running (should show "healthy"):
docker compose ps
```

> Docker Desktop must be running before this step.

---

### Step 4 — Install dependencies + run migrations + seed

```bash
# Install all Node modules for server and client
npm install --prefix server
npm install --prefix client

# Apply the database schema
npm run db:migrate

# Seed initial users and sample data
npm run db:seed
```

**Seed output confirms success:**
```
✓ Admin user created    →  admin@talentforge.com  /  Admin@123
✓ 2 employees created   →  sriran@talentforge.com  /  Employee@123
✓ 1 recruiter created   →  ravi@talentforge.com   /  Recruiter@123
✓ Tech ecosystems seeded
✓ Sample base resume and bullet points seeded
```

---

### Step 5 — Start the app

**Open two terminal windows:**

**Terminal 1 — Backend API:**
```bash
cd talentforge/server
npm run dev
# ✦ TalentForge API running on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd talentforge/client
npm run dev
# Local: http://localhost:5173
```

**Open your browser:** http://localhost:5173

---

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@talentforge.com | Admin@123 |
| **Recruiter** | ravi@talentforge.com | Recruiter@123 |
| **Employee** | sriran@talentforge.com | Employee@123 |

---

## Project Structure

```
talentforge/
├── docker-compose.yml          ← PostgreSQL + pgAdmin
├── package.json                ← Root scripts
│
├── server/                     ← Express API (port 5000)
│   ├── index.js                ← Entry point
│   ├── .env                    ← YOUR env vars (git-ignored)
│   ├── .env.example            ← Template
│   ├── db/
│   │   ├── index.js            ← pg connection pool
│   │   ├── schema.sql          ← All tables + triggers
│   │   ├── migrate.js          ← Run: npm run db:migrate
│   │   └── seed.js             ← Run: npm run db:seed
│   ├── middleware/
│   │   └── auth.js             ← JWT + role guard
│   └── routes/
│       ├── auth.js             ← POST /api/auth/login|logout
│       ├── users.js            ← GET|POST|PUT|DELETE /api/users
│       ├── resumes.js          ← /api/resumes/base & /tailored
│       ├── ai.js               ← POST /api/ai/generate-points
│       ├── points.js           ← /api/points (library)
│       └── monitoring.js       ← /api/monitoring/* (admin)
│
└── client/                     ← React + Vite (port 5173)
    ├── index.html
    ├── vite.config.js          ← Proxy /api → localhost:5000
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx             ← Router + PrivateRoute
        ├── index.css
        ├── lib/api.js          ← Axios client with JWT
        ├── context/AuthContext.jsx
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardLayout.jsx
            ├── admin/          ← AdminDashboard, Monitor, Analytics, Users
            ├── employer/       ← ResumesPage
            ├── employee/       ← BasePage
            └── shared/         ← BuilderPage, LibraryPage
```

---

## API Reference

### Auth
```
POST   /api/auth/login       { email, password } → { token, user }
POST   /api/auth/logout      Bearer token required
GET    /api/auth/me          Bearer token required
PATCH  /api/auth/page        { page }  — updates monitoring current_page
```

### Users (admin only)
```
GET    /api/users            List all users with online status
POST   /api/users            { name, email, phone, role, password }
PUT    /api/users/:id        { name, phone, status }
DELETE /api/users/:id        Soft-suspend
```

### Resumes
```
GET    /api/resumes/base           Employee: own resumes only
POST   /api/resumes/base           Create base resume
PUT    /api/resumes/base/:id       Update base resume
DELETE /api/resumes/base/:id       Soft delete
GET    /api/resumes/tailored       Employer: own tailored resumes
POST   /api/resumes/tailored       Create tailored resume
PUT    /api/resumes/tailored/:id   Update tailored resume
```

### AI
```
POST   /api/ai/generate-points   { jd, roles[], ecosystem, save_to_library }
       → { roles: [{company, title, points[]}], points_saved }

POST   /api/ai/analyze-resume    { resume_content, job_description? }
       → { ats_score, grade, urgent_fixes[], critical_fixes[], optional_fixes[] }
```

### Points Library
```
GET    /api/points              ?ecosystem=DevOps&stack=CI/CD&search=terraform
GET    /api/points/ecosystems   All ecosystems with point counts
POST   /api/points              Manually add a point
POST   /api/points/:id/copy     Increment usage counter
DELETE /api/points/:id          Admin: flag/hide point
```

### Monitoring (admin only)
```
GET    /api/monitoring/stats        Platform-wide numbers
GET    /api/monitoring/users        All users + online status + activity stats
GET    /api/monitoring/activity     Recent activity feed (all users)
GET    /api/monitoring/activity/:id Activity for a specific user
```

---

## Useful Commands

```bash
# Reset the whole database and re-seed
npm run db:reset

# Open pgAdmin GUI in browser (optional)
docker compose --profile tools up -d
# Then visit: http://localhost:5050
# Login: admin@talentforge.com / admin123
# Add server: host=postgres, db=talentforge, user=postgres, pass=postgres

# Stop PostgreSQL
npm run db:down

# Check API health
curl http://localhost:5000/api/health

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@talentforge.com","password":"Admin@123"}'
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED 5432` | Docker Desktop is not running — start it first |
| `relation "users" does not exist` | Run `npm run db:migrate` first |
| `JWT_SECRET is not defined` | Copy `.env.example` to `.env` and fill in values |
| Port 5000 in use | Change `PORT=5001` in `server/.env` and `proxy` in `vite.config.js` |
| Port 5173 in use | Vite will auto-use 5174 — update `CLIENT_URL` in `server/.env` |
| `Invalid API Key` | Your `ANTHROPIC_API_KEY` in `.env` is wrong or has whitespace |
| npm install errors | Delete `node_modules` and `package-lock.json` and retry |

---

## Next Steps — Connecting the UI

The `client/src/pages/` scaffold pages are ready to receive the full UI components
from the interactive prototype. For each page:

1. Copy the component from the demo widget
2. Replace mock data arrays with `useEffect` + `api.get('/api/...')`
3. Replace mock mutations with `api.post/put/delete`
4. Use `useAuth()` hook for `user.role` and `user.id`

The `api` client in `src/lib/api.js` handles JWT headers and 401 auto-logout automatically.
