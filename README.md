# Online Voting System

Production-ready role-based online voting system for a representative assembly.

## Stack
- Frontend: React (Vite), TypeScript, TailwindCSS, ShadCN-style UI, React Router, Axios, React Hook Form, Zod
- Backend: Laravel 11 (REST API), MySQL, Sanctum SPA auth, Policies, Middleware

## Repository Layout
- `backend/` - Laravel 11 API
- `frontend/` - Vite SPA
- `DEPLOYMENT.md` - deployment runbook
- `SECURITY_CHECKLIST.md` - hardening checklist

## Quick Start

### Backend
1. `cd backend`
2. `cp .env.example .env`
3. Set database and origin values in `.env`
4. `composer install`
5. `php artisan key:generate`
6. `php artisan migrate --seed`
7. `php artisan serve`

Seeded users:
- `superadmin@voting.local` / `Password@123`
- `electionadmin@voting.local` / `Password@123`
- `voter@voting.local` / `Password@123`

### Frontend
1. `cd frontend`
2. `cp .env.example .env`
3. `npm install`
4. `npm run dev`

## API Highlights
- Auth: `POST /api/login`, `POST /api/logout`, `GET /api/user`
- Elections: `GET /api/elections`, `POST /api/elections`, `PUT /api/elections/{id}`, `DELETE /api/elections/{id}`
- Positions/Candidates: `POST /api/elections/{id}/positions`, `POST /api/elections/{id}/candidates`
- Vote: `POST /api/vote`
- Results: `GET /api/elections/{id}/results`, `GET /api/elections/{id}/results/export`
- Audit Logs: `GET /api/audit-logs`

## Security Controls Implemented
- Sanctum stateful SPA auth
- CSRF cookie flow
- Role middleware (`super_admin`, `election_admin`, `voter`)
- Policy authorization for election/candidate/vote actions
- Login rate limiting
- Immutable vote model
- Anonymous `voter_hash` tracking (SHA-256)
- Audit logging for sensitive actions
