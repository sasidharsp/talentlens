import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.database import engine, SessionLocal, Base
from app import models
from app.auth import get_password_hash
from app.config import settings
from app.routers import auth, candidates, admin, questions
from app.routers import requisitions as req_router
from app.routers import round2_admin, round2_candidate
from app.routers import inperson as inperson_router

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TalentLens API",
    description="Candidate Assessment & Interview Lifecycle Platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(candidates.router)
app.include_router(admin.router)
app.include_router(questions.router)
app.include_router(req_router.router)
app.include_router(round2_admin.router)
app.include_router(round2_candidate.router)
app.include_router(inperson_router.router)

# Serve uploaded files
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.on_event("startup")
def seed_defaults():
    """Seed the database with default configuration and a super admin account."""
    db: Session = SessionLocal()
    try:
        # ── Safe migrations for new columns (won't fail if already exists) ──
        from sqlalchemy import text
        migrations = [
            # Add requisition_id column if not present
            "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS requisition_id INTEGER REFERENCES requisitions(id)",
            # Make role_id nullable
            "ALTER TABLE candidates ALTER COLUMN role_id DROP NOT NULL",
            # New columns on candidates
            "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS webcam_photo_path VARCHAR(500)",
            # New columns on assessment_sessions
            "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS proctoring_status VARCHAR(30) DEFAULT 'active'",
            "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS integrity_score FLOAT",
            "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0",
            "ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(200)",
            "ALTER TABLE evaluation_results ADD COLUMN IF NOT EXISTS ai_recommendation JSONB",
            "ALTER TABLE questions_seg1 ADD COLUMN IF NOT EXISTS batch_tag VARCHAR(100)",
            "ALTER TABLE questions_seg2 ADD COLUMN IF NOT EXISTS batch_tag VARCHAR(100)",
            "ALTER TABLE questions_seg3 ADD COLUMN IF NOT EXISTS batch_tag VARCHAR(100)",
            # Add qadmin to the role enum if using PostgreSQL enum type
            "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='qadmin' AND enumtypid=(SELECT oid FROM pg_type WHERE typname='userrole')) THEN ALTER TYPE userrole ADD VALUE 'qadmin'; END IF; END $$",
            """CREATE TABLE IF NOT EXISTS inperson_questions (
                id SERIAL PRIMARY KEY,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                tag VARCHAR(100) NOT NULL,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )""",
            """CREATE TABLE IF NOT EXISTS proctoring_config (
                id SERIAL PRIMARY KEY,
                enabled BOOLEAN DEFAULT TRUE,
                max_weight INTEGER DEFAULT 60,
                grace_frames INTEGER DEFAULT 12,
                cooldown_ms INTEGER DEFAULT 15000,
                audio_rms FLOAT DEFAULT 72.0,
                audio_hold_ms INTEGER DEFAULT 9000,
                phone_confidence FLOAT DEFAULT 0.65,
                phone_frames INTEGER DEFAULT 5,
                phone_term_count INTEGER DEFAULT 3,
                gaze_h FLOAT DEFAULT 0.20,
                gaze_v_up FLOAT DEFAULT 0.14,
                gaze_v_down FLOAT DEFAULT 0.24,
                head_thresh FLOAT DEFAULT 0.16,
                snap_ms INTEGER DEFAULT 10000,
                violation_weights JSONB DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )""",
            "ALTER TABLE proctoring_config ADD COLUMN IF NOT EXISTS snap_ms INTEGER DEFAULT 10000",
            "ALTER TABLE proctoring_config ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE",
            "ALTER TABLE proctoring_config ADD COLUMN IF NOT EXISTS violation_weights JSONB DEFAULT '{}'::jsonb",
        ]
        for sql in migrations:
            try:
                db.execute(text(sql))
                db.commit()
            except Exception:
                db.rollback()  # Column already exists or other non-fatal error

        # ── Default super admin ──
        if not db.query(models.User).filter(models.User.email == "admin@talentlens.io").first():
            admin_user = models.User(
                email="admin@talentlens.io",
                hashed_password=get_password_hash("Admin@123"),
                full_name="Super Admin",
                role="super_admin",
                is_active=True,
            )
            db.add(admin_user)

        # ── Default system config ──
        defaults = {
            "seg1_question_count": ("15", "Number of questions in Segment 1"),
            "seg2_question_count": ("10", "Number of questions in Segment 2"),
            "seg3_question_count": ("2", "Number of questions in Segment 3"),
            "seg1_timer_minutes": ("3", "Timer for Segment 1 in minutes"),
            "seg2_timer_minutes": ("8", "Timer for Segment 2 in minutes"),
            "seg3_timer_minutes": ("4", "Timer for Segment 3 in minutes"),
            "seg1_difficulty_high": ("3", "High difficulty count for Segment 1"),
            "seg1_difficulty_medium": ("7", "Medium difficulty count for Segment 1"),
            "seg1_difficulty_low": ("5", "Low difficulty count for Segment 1"),
            "score_weight_seg1": ("30", "Weight % for Segment 1 in composite score"),
            "score_weight_seg2": ("40", "Weight % for Segment 2 in composite score"),
            "score_weight_seg3": ("30", "Weight % for Segment 3 in composite score"),
            "max_upload_size_mb": ("5", "Maximum resume upload size in MB"),
            "assessment_instructions": (
                "<h2>Assessment Instructions</h2>"
                "<p>Welcome to the TalentLens Assessment. Please read these instructions carefully before you begin.</p>"
                "<ul>"
                "<li><strong>Segment 1:</strong> 15 Multiple Choice Questions – 3 minutes timer. Answers are auto-submitted when time expires.</li>"
                "<li><strong>Segment 2:</strong> 10 Multiple Choice Questions with optional rationale – 8 minutes timer.</li>"
                "<li><strong>Segment 3:</strong> 2 Scenario-Based Questions requiring detailed written responses – 4 minutes timer.</li>"
                "</ul>"
                "<p>Once you begin a segment you cannot return to a previous one. Ensure a stable internet connection throughout.</p>",
                "HTML content shown on the instructions screen",
            ),
            "llm_relevance_weight": ("33", "LLM evaluation weight for Relevance dimension"),
            "llm_context_weight": ("33", "LLM evaluation weight for Context dimension"),
            "llm_semantics_weight": ("34", "LLM evaluation weight for Semantics dimension"),
            "num_interview_rounds": ("3", "Total number of interview rounds (after assessment)"),
            "duplicate_cooldown_days": ("30", "Days before same email+role can re-apply"),
        }
        for key, (value, description) in defaults.items():
            if not db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first():
                db.add(models.SystemConfig(key=key, value=value, description=description))

        # ── Default roles ──
        default_roles = [
            "Software Engineer", "Senior Software Engineer", "Data Analyst",
            "Data Scientist", "Product Manager", "DevOps Engineer",
            "QA Engineer", "Business Analyst", "Solution Architect",
            "Project Manager",
        ]
        for rname in default_roles:
            if not db.query(models.RoleConfig).filter(models.RoleConfig.name == rname).first():
                db.add(models.RoleConfig(name=rname, is_active=True))

        # ── Default experience brackets ──
        brackets = [
            ("0-2 years", 0.0, 2.0),
            ("2-5 years", 2.0, 5.0),
            ("5-10 years", 5.0, 10.0),
            ("10+ years", 10.0, None),
        ]
        for label, mn, mx in brackets:
            if not db.query(models.ExperienceBracket).filter(
                models.ExperienceBracket.label == label
            ).first():
                db.add(models.ExperienceBracket(label=label, min_years=mn, max_years=mx))


        # ── Default pre_assessment instructions (editable via admin Settings) ──
        if not db.query(models.InstructionVersion).filter_by(
            instruction_type="pre_assessment", is_active=True
        ).first():
            db.add(models.InstructionVersion(
                instruction_type="pre_assessment",
                content=(
                    "Once you begin a segment you cannot return to a previous one. "
                    "Ensure a stable internet connection throughout.\n"
                    "Proctoring: This assessment is monitored via webcam. By proceeding you "
                    "consent to periodic snapshots, gaze & movement tracking, and audio activity "
                    "detection for integrity purposes. All data is used solely for assessment evaluation."
                ),
                is_active=True,
            ))

        db.commit()
        print("✅ Database seeded with defaults.")
    except Exception as e:
        print(f"⚠️  Seed error (non-fatal): {e}")
        db.rollback()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "TalentLens API", "version": "1.0.0"}
