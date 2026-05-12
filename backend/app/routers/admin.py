"""
Admin routes — requires authentication.
Handles: candidate listing, evaluation triggering, interview rounds, status management, user management.
"""
import math
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import (
    get_current_user, require_admin, require_super_admin, require_any_staff,
    get_password_hash,
)
from app.services.evaluator import run_full_evaluation
from app.config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─────────────── DASHBOARD STATS ───────────────
@router.get("/dashboard/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_any_staff),
):
    total = db.query(models.AssessmentSession).count()
    submitted = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.status.in_(["SUBMITTED", "EVALUATED"])
    ).count()
    evaluated = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.status == "EVALUATED"
    ).count()
    selected = db.query(models.CandidatureStatus).filter(
        models.CandidatureStatus.final_status == "selected"
    ).count()
    rejected = db.query(models.CandidatureStatus).filter(
        models.CandidatureStatus.final_status == "rejected"
    ).count()
    return {
        "total_candidates": total,
        "submitted": submitted,
        "pending_evaluation": submitted - evaluated,
        "evaluated": evaluated,
        "selected": selected,
        "rejected": rejected,
        "in_progress": total - submitted,
    }


# ─────────────── CANDIDATE LIST ───────────────
@router.get("/candidates")
def list_candidates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    role_id: Optional[int] = None,
    final_status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_any_staff),
):
    query = (
        db.query(
            models.AssessmentSession,
            models.Candidate,
            models.RoleConfig,
            models.EvaluationResult,
            models.CandidatureStatus,
        )
        .join(models.Candidate, models.AssessmentSession.candidate_id == models.Candidate.id)
        .join(models.RoleConfig, models.Candidate.role_id == models.RoleConfig.id)
        .outerjoin(models.EvaluationResult, models.AssessmentSession.id == models.EvaluationResult.session_id)
        .outerjoin(models.CandidatureStatus, models.AssessmentSession.id == models.CandidatureStatus.session_id)
    )

    if status:
        query = query.filter(models.AssessmentSession.status == status)
    if role_id:
        query = query.filter(models.Candidate.role_id == role_id)
    if final_status:
        query = query.filter(models.CandidatureStatus.final_status == final_status)
    if search:
        query = query.filter(
            models.Candidate.full_name.ilike(f"%{search}%") |
            models.Candidate.email.ilike(f"%{search}%") |
            models.Candidate.reference_code.ilike(f"%{search}%")
        )

    total = query.count()
    rows = query.order_by(models.AssessmentSession.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for session, candidate, role, evaluation, cs in rows:
        items.append({
            "session_id": session.id,
            "reference_code": candidate.reference_code,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "mobile": candidate.mobile,
            "role_name": role.name,
            "years_of_experience": candidate.years_of_experience,
            "submitted_at": session.submitted_at,
            "status": session.status,
            "seg1_score": evaluation.seg1_score if evaluation else None,
            "seg2_score": evaluation.seg2_score if evaluation else None,
            "seg3_score": evaluation.seg3_score if evaluation else None,
            "overall_score": evaluation.overall_score if evaluation else None,
            "final_status": cs.final_status if cs else "pending",
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size),
    }


# ─────────────── CANDIDATE DETAIL ───────────────
@router.get("/candidates/{session_id}")
def get_candidate_detail(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_any_staff),
):
    session = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    candidate = session.candidate
    role = candidate.role
    evaluation = session.evaluation
    cs = session.status_record
    rounds = session.rounds

    # Build response details with question text
    responses_detail = []
    for resp in session.responses:
        detail = {
            "id": resp.id,
            "segment_number": resp.segment_number,
            "question_id": resp.question_id,
            "selected_answer": resp.selected_answer,
            "rationale_text": resp.rationale_text,
            "free_text_response": resp.free_text_response,
            "is_correct": resp.is_correct,
        }
        # Enrich with question text
        if resp.segment_number == 1:
            q = db.query(models.QuestionSeg1).filter(models.QuestionSeg1.id == resp.question_id).first()
            if q:
                detail.update({
                    "question_text": q.question_text,
                    "correct_answer": q.correct_answer,
                    "options": {"A": q.option_a, "B": q.option_b, "C": q.option_c, "D": q.option_d},
                })
        elif resp.segment_number == 2:
            q = db.query(models.QuestionSeg2).filter(models.QuestionSeg2.id == resp.question_id).first()
            if q:
                detail.update({
                    "question_text": q.question_text,
                    "correct_answer": q.correct_answer,
                    "options": {"A": q.option_a, "B": q.option_b, "C": q.option_c, "D": q.option_d},
                })
        elif resp.segment_number == 3:
            q = db.query(models.QuestionSeg3).filter(models.QuestionSeg3.id == resp.question_id).first()
            if q:
                detail.update({"scenario_text": q.scenario_text})
        responses_detail.append(detail)

    return {
        # ── session object (matches frontend destructuring) ──
        "session": {
            "id": session.id,
            "status": session.status,
            "current_segment": session.current_segment,
            "submitted_at": session.submitted_at,
            "instructions_accepted_at": session.instructions_accepted_at,
            "seg1_start_time": session.seg1_start_time,
            "seg1_end_time": session.seg1_end_time,
            "seg2_start_time": session.seg2_start_time,
            "seg2_end_time": session.seg2_end_time,
            "seg3_start_time": session.seg3_start_time,
            "seg3_end_time": session.seg3_end_time,
            "created_at": session.created_at,
        },
        # ── candidate with role as object ──
        "candidate": {
            "id": candidate.id,
            "reference_code": candidate.reference_code,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "mobile": candidate.mobile,
            "role": {"id": role.id, "name": role.name},
            "years_of_experience": candidate.years_of_experience,
            "current_organization": candidate.current_organization,
            "highest_qualification": candidate.highest_qualification,
            "linkedin_url": candidate.linkedin_url,
            "resume_path": candidate.resume_path,
            "resume_original_name": candidate.resume_original_name,
            "created_at": candidate.created_at,
        },
        # ── evaluation ──
        "evaluation": {
            "seg1_score": evaluation.seg1_score,
            "seg1_correct": evaluation.seg1_correct,
            "seg1_total": evaluation.seg1_total,
            "seg2_score": evaluation.seg2_score,
            "seg2_correct": evaluation.seg2_correct,
            "seg2_total": evaluation.seg2_total,
            "seg3_score": evaluation.seg3_score,
            "seg3_details": evaluation.seg3_details,
            "overall_score": evaluation.overall_score,
            "evaluated_at": evaluation.evaluated_at,
        } if evaluation else None,
        # ── responses with consistent segment_number key ──
        "responses": responses_detail,
        # ── rounds ──
        "rounds": [
            {
                "id": r.id,
                "round_number": r.round_number,
                "interviewer_name": r.interviewer_name,
                "feedback_text": r.feedback_text,
                "score": r.score,
                "outcome": r.outcome,
                "round_date": r.round_date,
                "created_at": r.created_at,
            }
            for r in rounds
        ],
        # ── status_record as object (matches frontend destructuring) ──
        "status_record": {
            "final_status": cs.final_status if cs else "pending",
            "notes": cs.notes if cs else None,
            "updated_at": cs.updated_at if cs else None,
            "assigned_interviewer_id": cs.assigned_interviewer_id if cs else None,
        },
    }


# ─────────────── EVALUATE ───────────────
@router.post("/candidates/{session_id}/evaluate")
def evaluate_candidate(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    session = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status not in ["SUBMITTED", "EVALUATED"]:
        raise HTTPException(status_code=400, detail="Assessment not yet submitted by candidate.")

    result = run_full_evaluation(db, session_id, evaluator_user_id=current_user.id)

    # Audit log
    log = models.AuditLog(
        user_id=current_user.id,
        action="EVALUATE",
        resource="assessment_session",
        resource_id=str(session_id),
        details={"overall_score": result.overall_score},
    )
    db.add(log)
    db.commit()

    return {
        "message": "Evaluation complete.",
        "overall_score": result.overall_score,
        "seg1_score": result.seg1_score,
        "seg2_score": result.seg2_score,
        "seg3_score": result.seg3_score,
    }


# ─────────────── INTERVIEW ROUNDS (append-only, immutable) ───────────────
@router.post("/candidates/{session_id}/rounds")
def add_round_entry(
    session_id: int,
    payload: schemas.RoundCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_any_staff),
):
    """
    Always INSERTS a new entry — existing entries are immutable.
    Multiple entries per round_number are allowed (amendment = new entry).
    """
    if payload.round_number < 2:
        raise HTTPException(status_code=400, detail="Round number must be 2 or higher.")

    # Verify session exists
    session = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    round_rec = models.InterviewRound(
        session_id=session_id,
        round_number=payload.round_number,
        interviewer_id=current_user.id,
        interviewer_name=payload.interviewer_name or current_user.full_name,
        feedback_text=payload.feedback_text,
        score=payload.score,
        outcome=payload.outcome,
        round_date=payload.round_date or datetime.utcnow(),
    )
    db.add(round_rec)
    db.commit()

    # Audit log
    db.add(models.AuditLog(
        user_id=current_user.id,
        action="round_entry_added",
        resource="interview_rounds",
        resource_id=str(session_id),
        details={
            "round_number": payload.round_number,
            "interviewer": payload.interviewer_name or current_user.full_name,
            "outcome": payload.outcome,
        },
    ))
    db.commit()
    return {"message": f"Round {payload.round_number} entry saved.", "id": round_rec.id}


# ─────────────── FINAL STATUS ───────────────
@router.patch("/candidates/{session_id}/status")
def update_final_status(
    session_id: int,
    payload: schemas.StatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    cs = db.query(models.CandidatureStatus).filter(
        models.CandidatureStatus.session_id == session_id
    ).first()
    if not cs:
        cs = models.CandidatureStatus(session_id=session_id)
        db.add(cs)
    cs.final_status = payload.final_status
    cs.notes = payload.notes
    cs.assigned_interviewer_id = payload.assigned_interviewer_id
    cs.updated_by = current_user.id
    cs.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Status updated."}


# ─────────────── RESUME DOWNLOAD ───────────────
@router.get("/candidates/{session_id}/resume")
def download_resume(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_any_staff),
):
    session = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    candidate = session.candidate
    if not candidate.resume_path:
        raise HTTPException(status_code=404, detail="No resume uploaded.")
    file_path = os.path.join(settings.upload_dir, candidate.resume_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Resume file not found on server.")
    return FileResponse(
        file_path,
        filename=candidate.resume_original_name or candidate.resume_path,
        media_type="application/octet-stream",
    )


# ─────────────── USER MANAGEMENT (Super Admin) ───────────────
@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin),
):
    users = db.query(models.User).all()
    return [
        {
            "id": u.id, "email": u.email, "full_name": u.full_name,
            "role": u.role.value, "is_active": u.is_active,
            "created_at": u.created_at, "last_login": u.last_login,
        }
        for u in users
    ]


@router.post("/users")
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin),
):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered.")
    user = models.User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    return {"message": "User created.", "id": user.id}


@router.patch("/users/{user_id}")
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if payload.full_name:
        user.full_name = payload.full_name
    if payload.role:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)
    db.commit()
    return {"message": "User updated."}


# ─────────────── ROLES CONFIG ───────────────
@router.get("/roles")
def list_roles(db: Session = Depends(get_db)):
    return db.query(models.RoleConfig).filter(models.RoleConfig.is_active == True).all()


@router.post("/roles")
def create_role(
    payload: schemas.RoleConfigCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    existing = db.query(models.RoleConfig).filter(models.RoleConfig.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Role already exists.")
    role = models.RoleConfig(name=payload.name, is_active=payload.is_active)
    db.add(role)
    db.commit()
    return {"message": "Role created.", "id": role.id}


@router.patch("/roles/{role_id}")
def update_role(
    role_id: int,
    payload: schemas.RoleConfigCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    role = db.query(models.RoleConfig).filter(models.RoleConfig.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found.")
    role.name = payload.name
    role.is_active = payload.is_active
    db.commit()
    return {"message": "Role updated."}


# ─────────────── EXPERIENCE BRACKETS ───────────────
@router.get("/experience-brackets")
def list_brackets(db: Session = Depends(get_db)):
    return db.query(models.ExperienceBracket).all()


@router.post("/experience-brackets")
def create_bracket(
    payload: schemas.ExperienceBracketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    b = models.ExperienceBracket(**payload.dict())
    db.add(b)
    db.commit()
    return {"message": "Bracket created.", "id": b.id}


# ─────────────── SYSTEM CONFIG ───────────────
@router.get("/config")
def get_config(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    configs = db.query(models.SystemConfig).all()
    return {c.key: {"value": c.value, "description": c.description} for c in configs}


@router.put("/config")
def update_config(
    payload: schemas.ConfigUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    cfg = db.query(models.SystemConfig).filter(models.SystemConfig.key == payload.key).first()
    if cfg:
        cfg.value = payload.value
        if payload.description:
            cfg.description = payload.description
        cfg.updated_by = current_user.id
    else:
        cfg = models.SystemConfig(
            key=payload.key,
            value=payload.value,
            description=payload.description,
            updated_by=current_user.id,
        )
        db.add(cfg)
    db.commit()
    return {"message": f"Config '{payload.key}' updated."}


# ─────────────── BACKUPS ───────────────
@router.get("/backup/resumes")
def download_all_resumes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin),
):
    """ZIP all uploaded resumes and stream to browser."""
    import zipfile, io
    from fastapi.responses import StreamingResponse

    candidates = db.query(models.Candidate).filter(
        models.Candidate.resume_path.isnot(None)
    ).all()

    buf = io.BytesIO()
    count = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for c in candidates:
            file_path = os.path.join(settings.upload_dir, c.resume_path)
            if os.path.exists(file_path):
                ext = os.path.splitext(c.resume_original_name or c.resume_path)[1]
                safe_name = f"{c.reference_code}_{c.full_name.replace(' ', '_')}{ext}"
                zf.write(file_path, safe_name)
                count += 1

    if count == 0:
        raise HTTPException(status_code=404, detail="No resume files found on server.")

    buf.seek(0)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"talentlens_resumes_{timestamp}.zip"

    db.add(models.AuditLog(
        user_id=current_user.id,
        action="backup_resumes_downloaded",
        resource="resumes",
        details={"file_count": count, "filename": filename},
    ))
    db.commit()

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/backup/database")
def download_database_dump(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin),
):
    """Stream a PostgreSQL dump of all app data as a .sql file."""
    import subprocess, io
    from fastapi.responses import StreamingResponse

    db_url = settings.database_url
    # Convert SQLAlchemy URL to psql-compatible format
    pg_url = db_url.replace("postgresql+psycopg2://", "postgresql://").replace("postgresql://", "")

    try:
        result = subprocess.run(
            ["pg_dump", f"--dbname=postgresql://{pg_url}",
             "--no-owner", "--no-acl", "--format=plain"],
            capture_output=True, timeout=120
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"pg_dump failed: {result.stderr.decode()}")

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"talentlens_db_{timestamp}.sql"

        db.add(models.AuditLog(
            user_id=current_user.id,
            action="backup_database_downloaded",
            resource="database",
            details={"filename": filename, "size_bytes": len(result.stdout)},
        ))
        db.commit()

        return StreamingResponse(
            io.BytesIO(result.stdout),
            media_type="application/sql",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="pg_dump not available on this server. Use Railway dashboard → PostgreSQL → Backups instead."
        )


# ─────────────── AUDIT LOG ───────────────
@router.get("/audit-log")
def get_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin),
):
    total = db.query(models.AuditLog).count()
    rows = (
        db.query(models.AuditLog)
        .order_by(models.AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [
            {
                "id": r.id, "user_id": r.user_id, "action": r.action,
                "resource": r.resource, "resource_id": r.resource_id,
                "details": r.details, "created_at": r.created_at,
            }
            for r in rows
        ],
        "total": total,
    }
