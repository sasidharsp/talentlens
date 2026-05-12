# TalentLens — Candidate Assessment & Interview Lifecycle Platform

A full-stack, AI-powered candidate assessment platform with three-segment evaluations, LLM-based scenario scoring, and a complete interview lifecycle dashboard.

---

## 🏗️ Architecture

```
talentlens/
├── backend/          # Python 3.11 · FastAPI · SQLAlchemy · PostgreSQL
├── frontend/         # React 18 · Vite · Tailwind CSS
├── docker-compose.yml
└── nginx.conf
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Anthropic API key (for Segment 3 LLM evaluation)

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env and set:
#   SECRET_KEY=<long random string>
#   ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Start the stack

```bash
docker-compose up --build -d
```

App will be available at:
- **Candidate Portal**: http://localhost
- **Admin Panel**: http://localhost/admin/login
- **API Docs**: http://localhost:8000/api/docs

### Default Admin Credentials
```
Email:    admin@talentlens.io
Password: Admin@123
```
> ⚠️ Change these immediately in production!

---

## 🎯 Features

### Candidate Portal
- Self-registration with resume upload (PDF/DOCX)
- Unique reference code per candidate
- 3-segment timed assessment with auto-save
- Timer auto-submits each segment on expiry
- Progress resume if page is accidentally refreshed

### Segment Structure
| Segment | Type | Default Questions | Default Timer |
|---------|------|-------------------|---------------|
| 1 | Experience-based MCQ | 15 | 3 min/question |
| 2 | Role & Skills MCQ + Rationale | 10 | 8 min |
| 3 | Scenario Open-text | 2 | 4 min/question |

### Admin Portal
- **Dashboard**: Real-time pipeline stats and recent candidates
- **Candidate List**: Searchable, filterable table with scores
- **Candidate Detail**: Full profile, responses, score breakdown, LLM eval
- **AI Evaluation**: One-click Claude-powered evaluation of all segments
- **Interview Rounds**: Record multiple interview rounds with scores/outcomes
- **Final Status**: Mark candidates as selected/rejected/on-hold
- **Question Bank**: CRUD + CSV/Excel import/export for all 3 segments
- **Settings**: Configure all assessment parameters without code changes
- **User Management**: Super admin can create/manage admin users and interviewers

### RBAC
| Role | Access |
|------|--------|
| `super_admin` | Full access including user management |
| `admin` | Candidates, evaluation, questions, settings |
| `interviewer` | Read-only candidates + add round feedback |

---

## 🔑 API Reference

Full interactive docs at `/api/docs` (Swagger UI).

### Candidate Endpoints (no auth)
```
POST /api/candidate/register
GET  /api/candidate/instructions/{token}
POST /api/candidate/accept-instructions/{token}
GET  /api/candidate/segment/{token}/{1|2|3}
POST /api/candidate/save-progress/{token}
POST /api/candidate/submit-segment/{token}
```

### Admin Endpoints (JWT required)
```
POST /api/auth/login
GET  /api/admin/dashboard/stats
GET  /api/admin/candidates
GET  /api/admin/candidates/{session_id}
POST /api/admin/candidates/{session_id}/evaluate
POST /api/admin/candidates/{session_id}/rounds
PATCH /api/admin/candidates/{session_id}/status
GET  /api/admin/questions/seg{1|2|3}
POST /api/admin/questions/seg{1|2|3}
PUT  /api/admin/questions/seg{1|2|3}/{id}
POST /api/admin/questions/seg{1|2|3}/import
GET  /api/admin/questions/seg{1|2|3}/export
GET  /api/admin/config
PUT  /api/admin/config
GET  /api/admin/users          (super_admin)
POST /api/admin/users          (super_admin)
PATCH /api/admin/users/{id}   (super_admin)
```

---

## 📊 Scoring Logic

```
Overall Score = (Seg1 Score × W1) + (Seg2 Score × W2) + (Seg3 Score × W3)

Default weights: W1=30%, W2=40%, W3=30%
All weights configurable in Settings.

Segment 3 (LLM):
  Per-question score = (Relevance × 33%) + (Context × 33%) + (Semantics × 34%)
  Each dimension scored 0–10 by Claude, then normalized to 0–100%
```

---

## 🧩 Question Import Format

### Segment 1 & 2 (CSV/Excel columns)
```
question_text | option_a | option_b | option_c | option_d | correct_answer | difficulty | category | role_tags | skill_tags
```

### Segment 3 (CSV/Excel columns)
```
scenario_text | reference_answer | difficulty | role_tags
```

- `correct_answer`: A, B, C, or D
- `difficulty`: low, medium, or high
- `role_tags`: comma-separated string, e.g. `Software Engineer,DevOps Engineer`

---

## 🛠️ Local Development (without Docker)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit with your local DB URL
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # runs on http://localhost:3000
```

### Database
```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_DB=talentlens \
  -e POSTGRES_PASSWORD=talentlens \
  postgres:16-alpine
```

---

## 🔒 Security Notes

- All candidate-facing routes are unauthenticated (by design — candidates use session tokens)
- Admin routes require JWT Bearer tokens
- Refresh tokens auto-rotate on use
- Resume files stored with randomized filenames
- Duplicate candidate detection (same email + role within configurable cooldown)
- All question deletions are soft-deletes to preserve assessment integrity

---

## 🗄️ Database Schema

Key tables: `users`, `candidates`, `assessment_sessions`, `questions_seg1/2/3`, `segment_responses`, `evaluation_results`, `interview_rounds`, `candidature_status`, `system_config`, `audit_log`

All tables are created automatically on first startup via SQLAlchemy `create_all`.
