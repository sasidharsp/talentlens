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
        .outerjoin(models.RoleConfig, models.Candidate.role_id == models.RoleConfig.id)
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
        role_display = (
            role.name if role
            else (candidate.requisition.title if candidate.requisition else "—")
        )
        req = candidate.requisition
        items.append({
            "session_id": session.id,
            "reference_code": candidate.reference_code,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "mobile": candidate.mobile,
            "role_name": role_display,
            "requisition": {
                "id": req.id,
                "req_id": req.req_id,
                "title": req.title,
            } if req else None,
            "years_of_experience": candidate.years_of_experience,
            "submitted_at": session.submitted_at,
            "registered_at": candidate.created_at,
            "ai_verdict": evaluation.ai_recommendation.get("recommendation") if evaluation and evaluation.ai_recommendation else None,
            "status": session.status,
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
            "role": {"id": role.id, "name": role.name} if role else None,
            "requisition": {
                "id": candidate.requisition.id,
                "req_id": candidate.requisition.req_id,
                "title": candidate.requisition.title,
                "department": candidate.requisition.department,
                "location": candidate.requisition.location,
                "label": f"{candidate.requisition.req_id} — {candidate.requisition.title}",
            } if candidate.requisition else None,
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
            "ai_recommendation": evaluation.ai_recommendation,
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
    return {c.key: c.value for c in configs}


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

# ─────────────── DELETE CANDIDATE (super_admin only) ───────────────
@router.delete("/candidates/{session_id}")
def delete_candidate(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_super_admin),
):
    session = db.query(models.AssessmentSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(404, "Session not found.")

    candidate_name = session.candidate.full_name if session.candidate else "Unknown"

    # Delete cascade: responses, evaluation, rounds, status, proctor events, then session, then candidate
    db.query(models.ProctorEvent).filter_by(session_id=session_id).delete()
    db.query(models.SegmentResponse).filter_by(session_id=session_id).delete()
    db.query(models.EvaluationResult).filter_by(session_id=session_id).delete()
    db.query(models.InterviewRound).filter_by(session_id=session_id).delete()
    db.query(models.CandidatureStatus).filter_by(session_id=session_id).delete()

    candidate_id = session.candidate_id
    db.delete(session)
    db.flush()

    candidate = db.query(models.Candidate).filter_by(id=candidate_id).first()
    if candidate:
        db.delete(candidate)

    db.add(models.AuditLog(
        user_id=current_user.id,
        action="candidate_deleted",
        resource="candidate",
        resource_id=str(session_id),
        details={"candidate_name": candidate_name},
    ))
    db.commit()
    return {"message": f"Candidate '{candidate_name}' permanently deleted."}


# ─────────────── PROCTOR EVENTS ───────────────
@router.get("/candidates/{session_id}/proctor-events")
def get_proctor_events(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_any_staff),
):
    events = (
        db.query(models.ProctorEvent)
        .filter_by(session_id=session_id)
        .order_by(models.ProctorEvent.timestamp)
        .all()
    )
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "details": e.details,
            "timestamp": e.timestamp,
        }
        for e in events
    ]


# ─────────────── ANALYTICS ───────────────
@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_any_staff),
):
    from sqlalchemy import func as sqlfunc, case
    from datetime import timedelta

    # ── Overall stats ──
    total = db.query(models.AssessmentSession).count()
    submitted = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.status.in_(["SUBMITTED", "EVALUATED"])
    ).count()
    evaluated = db.query(models.AssessmentSession).filter_by(status="EVALUATED").count()

    # Scores
    scores = db.query(models.EvaluationResult.overall_score).filter(
        models.EvaluationResult.overall_score.isnot(None)
    ).all()
    score_values = [s[0] for s in scores]
    avg_score = round(sum(score_values) / len(score_values), 1) if score_values else 0
    pass_count = sum(1 for s in score_values if s >= 70)
    pass_rate = round(pass_count / len(score_values) * 100, 1) if score_values else 0

    # Segment averages
    seg_avgs = db.query(
        sqlfunc.avg(models.EvaluationResult.seg1_score),
        sqlfunc.avg(models.EvaluationResult.seg2_score),
        sqlfunc.avg(models.EvaluationResult.seg3_score),
    ).first()

    # Score distribution buckets
    buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for s in score_values:
        if s <= 20: buckets["0-20"] += 1
        elif s <= 40: buckets["21-40"] += 1
        elif s <= 60: buckets["41-60"] += 1
        elif s <= 80: buckets["61-80"] += 1
        else: buckets["81-100"] += 1

    # Candidates by requisition
    from sqlalchemy.orm import aliased
    req_counts = (
        db.query(models.Requisition.req_id, models.Requisition.title, sqlfunc.count(models.Candidate.id))
        .outerjoin(models.Candidate, models.Candidate.requisition_id == models.Requisition.id)
        .group_by(models.Requisition.id)
        .order_by(sqlfunc.count(models.Candidate.id).desc())
        .limit(10)
        .all()
    )

    # Candidates by day (last 30 days)
    since = datetime.utcnow() - timedelta(days=30)
    daily = (
        db.query(
            sqlfunc.date_trunc("day", models.Candidate.created_at).label("day"),
            sqlfunc.count(models.Candidate.id).label("count"),
        )
        .filter(models.Candidate.created_at >= since)
        .group_by("day")
        .order_by("day")
        .all()
    )

    # Final status breakdown
    status_counts = (
        db.query(models.CandidatureStatus.final_status, sqlfunc.count())
        .group_by(models.CandidatureStatus.final_status)
        .all()
    )

    # Proctoring violations summary
    violation_counts = (
        db.query(models.ProctorEvent.event_type, sqlfunc.count())
        .group_by(models.ProctorEvent.event_type)
        .all()
    )
    terminated_count = db.query(models.AssessmentSession).filter_by(
        proctoring_status="terminated"
    ).count()

    return {
        "overview": {
            "total": total,
            "submitted": submitted,
            "evaluated": evaluated,
            "avg_score": avg_score,
            "pass_rate": pass_rate,
            "terminated_for_malpractice": terminated_count,
        },
        "segment_averages": {
            "seg1": round(seg_avgs[0] or 0, 1),
            "seg2": round(seg_avgs[1] or 0, 1),
            "seg3": round(seg_avgs[2] or 0, 1),
        },
        "score_distribution": [
            {"range": k, "count": v} for k, v in buckets.items()
        ],
        "by_requisition": [
            {"req_id": r[0], "title": r[1], "count": r[2]} for r in req_counts
        ],
        "daily_registrations": [
            {"day": str(d[0])[:10], "count": d[1]} for d in daily
        ],
        "final_status_breakdown": [
            {"status": s[0], "count": s[1]} for s in status_counts
        ],
        "violation_summary": [
            {"type": v[0], "count": v[1]} for v in violation_counts
        ],
    }


# ─────────────── INSTRUCTION VERSIONS ───────────────
@router.get("/instructions/{instruction_type}")
def get_instructions(
    instruction_type: str,
    db: Session = Depends(get_db),
):
    """Get latest active instruction version. Public — used by candidate portal."""
    latest = (
        db.query(models.InstructionVersion)
        .filter_by(instruction_type=instruction_type, is_active=True)
        .order_by(models.InstructionVersion.id.desc())
        .first()
    )
    if not latest:
        # Fall back to SystemConfig
        cfg = db.query(models.SystemConfig).filter_by(key=f"{instruction_type}_content").first()
        return {"content": cfg.value if cfg else "", "version": None, "updated_at": None}
    return {
        "content": latest.content,
        "version": latest.id,
        "updated_at": latest.created_at,
        "created_by": latest.creator.full_name if latest.creator else "System",
    }


@router.post("/instructions/{instruction_type}")
def save_instructions(
    instruction_type: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    """Save a new version of instructions."""
    content = payload.get("content", "")
    if not content.strip():
        raise HTTPException(400, "Content cannot be empty.")

    # Deactivate previous versions
    db.query(models.InstructionVersion).filter_by(
        instruction_type=instruction_type
    ).update({"is_active": False})

    version = models.InstructionVersion(
        instruction_type=instruction_type,
        content=content,
        created_by=current_user.id,
        is_active=True,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return {
        "message": "Instructions saved.",
        "version": version.id,
        "updated_at": version.created_at,
    }


@router.get("/instructions/{instruction_type}/history")
def get_instruction_history(
    instruction_type: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    versions = (
        db.query(models.InstructionVersion)
        .filter_by(instruction_type=instruction_type)
        .order_by(models.InstructionVersion.id.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id": v.id,
            "created_at": v.created_at,
            "created_by": v.creator.full_name if v.creator else "System",
            "is_active": v.is_active,
            "preview": v.content[:100] + "..." if len(v.content) > 100 else v.content,
        }
        for v in versions
    ]

# ─────────────── AI RECOMMENDATION ───────────────
@router.post("/candidates/{session_id}/recommend")
def generate_ai_recommendation(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_any_staff),
):
    """
    Generate a holistic AI recommendation for a candidate using Claude.
    Considers all three segment scores, Seg 2 rationales, Seg 3 detailed feedback,
    and benchmarks against the full cohort.
    """
    import json as json_lib
    import anthropic as anthropic_sdk
    from app.config import settings

    session = db.query(models.AssessmentSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(404, "Session not found.")

    evaluation = db.query(models.EvaluationResult).filter_by(session_id=session_id).first()
    if not evaluation:
        raise HTTPException(400, "Run AI Evaluation first before generating a recommendation.")

    candidate = session.candidate
    role_label = candidate.requisition.title if candidate.requisition else (
        candidate.role.name if candidate.role else "BFSI Professional"
    )

    # ── Cohort statistics ──
    from sqlalchemy import func as sqlfunc
    cohort = db.query(
        sqlfunc.avg(models.EvaluationResult.overall_score).label("avg"),
        sqlfunc.min(models.EvaluationResult.overall_score).label("min"),
        sqlfunc.max(models.EvaluationResult.overall_score).label("max"),
        sqlfunc.count(models.EvaluationResult.id).label("total"),
    ).first()

    cohort_avg   = round(cohort.avg or 0, 1)
    cohort_total = cohort.total or 1

    # Percentile rank
    below_count = db.query(models.EvaluationResult).filter(
        models.EvaluationResult.overall_score < (evaluation.overall_score or 0)
    ).count()
    percentile = round((below_count / cohort_total) * 100)

    # Pass rate (>= 70%)
    pass_count = db.query(models.EvaluationResult).filter(
        models.EvaluationResult.overall_score >= 70
    ).count()
    pass_rate = round(pass_count / cohort_total * 100)

    # ── Seg 2 rationale samples ──
    seg2_rationales = db.query(models.SegmentResponse).filter(
        models.SegmentResponse.session_id == session_id,
        models.SegmentResponse.segment_number == 2,
        models.SegmentResponse.rationale_text.isnot(None),
        models.SegmentResponse.rationale_text != "",
    ).limit(3).all()

    rationale_samples = [r.rationale_text for r in seg2_rationales if r.rationale_text]

    # ── Seg 3 summary ──
    seg3_summary = []
    for i, det in enumerate(evaluation.seg3_details or [], 1):
        if det.get("pending_review"):
            seg3_summary.append(f"Q{i}: Pending manual review")
        else:
            seg3_summary.append(
                f"Q{i}: Score {det.get('score', 0)}/10\n"
                f"   Assessment: {det.get('rationale', '')[:200]}\n"
                f"   Strengths: {', '.join((det.get('strengths') or [])[:2])}\n"
                f"   Gaps: {', '.join((det.get('gaps') or [])[:3])}"
            )

    # ── Build prompt ──
    prompt = f"""You are an expert BFSI talent assessor. Provide a comprehensive hiring recommendation.

CANDIDATE PROFILE
Name: {candidate.full_name}
Role Applied: {role_label}
Experience: {candidate.years_of_experience or 'Not specified'} years

ASSESSMENT SCORES
Segment 1 — Knowledge MCQ: {evaluation.seg1_score:.1f}% ({evaluation.seg1_correct}/{evaluation.seg1_total} correct)
Segment 2 — Role Competency MCQ: {evaluation.seg2_score:.1f}% ({evaluation.seg2_correct}/{evaluation.seg2_total} correct)
Segment 3 — Scenario Response: {evaluation.seg3_score:.1f}%
Overall Score: {evaluation.overall_score:.1f}%

SEGMENT 2 RATIONALE SAMPLES (candidate's own reasoning)
{chr(10).join(f'• "{r}"' for r in rationale_samples) if rationale_samples else "No rationale provided"}

SEGMENT 3 DETAILED AI ANALYSIS
{chr(10).join(seg3_summary) if seg3_summary else "No scenario responses evaluated"}

COHORT BENCHMARKING ({cohort_total} candidates evaluated)
• This candidate: {evaluation.overall_score:.1f}%
• Cohort average: {cohort_avg}%
• Percentile rank: {percentile}th percentile
• Cohort pass rate (≥70%): {pass_rate}%

Based on the complete profile above, provide your recommendation as a JSON object:
{{
  "recommendation": "SHORTLIST" | "HOLD" | "REJECT",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "summary": "2-3 sentence executive summary of the candidate",
  "key_observations": ["observation 1", "observation 2", "observation 3", "observation 4"],
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "development_areas": ["area 1", "area 2", "area 3"],
  "risk_assessment": "Brief hiring risk assessment",
  "interview_focus": ["focus area 1", "focus area 2", "focus area 3"],
  "cohort_standing": "How this candidate compares to the cohort in 1 sentence",
  "score_interpretation": "What the score pattern reveals about the candidate"
}}

Return ONLY the JSON object. Be honest, specific, and BFSI-domain aware."""

    try:
        client = anthropic_sdk.Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model=settings.llm_model,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]
        rec = json_lib.loads(raw.strip())
    except Exception as e:
        raise HTTPException(500, f"AI recommendation failed: {str(e)}")

    # Enrich with cohort data
    rec["cohort_data"] = {
        "total_evaluated": cohort_total,
        "cohort_average": cohort_avg,
        "percentile": percentile,
        "pass_rate": pass_rate,
        "candidate_score": round(evaluation.overall_score, 1),
    }
    rec["generated_at"] = datetime.utcnow().isoformat()
    rec["generated_by"] = current_user.full_name

    # Save to evaluation record
    evaluation.ai_recommendation = rec
    db.commit()

    return rec

# ─────────────── ROUND 2 STATUS FOR CANDIDATE DETAIL ───────────────
@router.get("/candidates/{session_id}/r2-status")
def get_r2_status(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_any_staff),
):
    """Get Round 2 invitation/completion status for a candidate."""
    session = db.query(models.AssessmentSession).filter_by(id=session_id).first()
    if not session: raise HTTPException(404, "Not found")

    r2 = db.query(models.Round2Session).filter_by(
        candidate_id=session.candidate_id
    ).order_by(models.Round2Session.id.desc()).first()

    if not r2: return {"r2_status": None, "r2_session_id": None}

    r2_eval = db.query(models.Round2Evaluation).filter_by(session_id=r2.id).first()
    rec = r2_eval.ai_recommendation if r2_eval and r2_eval.ai_recommendation else {}

    return {
        "r2_status": r2.status,
        "r2_session_id": r2.id,
        "r2_score": r2_eval.overall_score if r2_eval else None,
        "r2_verdict": rec.get("recommendation"),
        "r2_invited_at": r2.invited_at,
    }
