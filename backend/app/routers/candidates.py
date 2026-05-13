"""
Candidate-facing routes (no authentication required).
Handles: registration, assessment session, auto-save, submission.
"""
import os
import secrets
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.config import settings
from app.services.question_selector import (
    select_seg1_questions,
    select_seg2_questions,
    select_seg3_questions,
    get_config_int,
)

router = APIRouter(prefix="/api/candidate", tags=["candidate"])


def generate_reference_code(db: Session) -> str:
    year = datetime.utcnow().year
    while True:
        suffix = ''.join(secrets.choice(string.digits) for _ in range(6))
        code = f"TL-{year}-{suffix}"
        if not db.query(models.Candidate).filter(models.Candidate.reference_code == code).first():
            return code


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


# ─── REGISTRATION ───
@router.post("/register")
async def register_candidate(
    full_name: str = Form(...),
    email: str = Form(...),
    mobile: str = Form(...),
    requisition_id: Optional[int] = Form(None),
    role_id: Optional[int] = Form(None),          # kept for backward compat
    years_of_experience: float = Form(...),
    current_organization: Optional[str] = Form(None),
    highest_qualification: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    resume: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    if not requisition_id and not role_id:
        raise HTTPException(400, "Please select a requisition / role.")

    # Validate requisition
    requisition = None
    if requisition_id:
        requisition = db.query(models.Requisition).filter(
            models.Requisition.id == requisition_id,
            models.Requisition.is_active == True,
        ).first()
        if not requisition:
            raise HTTPException(400, "Selected requisition is no longer active.")

    # Duplicate check — same email + requisition within cooldown
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=30)
    dup_q = db.query(models.Candidate).filter(
        models.Candidate.email == email,
        models.Candidate.created_at >= cutoff,
    )
    if requisition_id:
        dup_q = dup_q.filter(models.Candidate.requisition_id == requisition_id)
    elif role_id:
        dup_q = dup_q.filter(models.Candidate.role_id == role_id)
    if dup_q.first():
        raise HTTPException(409, "A submission for this email and requisition already exists within the last 30 days.")

    # Handle resume upload
    resume_path = None
    resume_original_name = None
    if resume:
        max_mb = get_config_int(db, "max_upload_size_mb", 5)
        content = await resume.read()
        if len(content) > max_mb * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"Resume exceeds {max_mb}MB limit.")
        ext = os.path.splitext(resume.filename or "")[1].lower()
        if ext not in [".pdf", ".docx", ".doc"]:
            raise HTTPException(status_code=400, detail="Only PDF and DOCX files are accepted.")
        os.makedirs(settings.upload_dir, exist_ok=True)
        filename = f"{secrets.token_hex(16)}{ext}"
        save_path = os.path.join(settings.upload_dir, filename)
        with open(save_path, "wb") as f:
            f.write(content)
        resume_path = filename
        resume_original_name = resume.filename

    ref_code = generate_reference_code(db)
    candidate = models.Candidate(
        reference_code=ref_code,
        full_name=full_name,
        email=email,
        mobile=mobile,
        role_id=role_id,
        requisition_id=requisition_id,
        years_of_experience=years_of_experience,
        current_organization=current_organization,
        highest_qualification=highest_qualification,
        linkedin_url=linkedin_url,
        resume_path=resume_path,
        resume_original_name=resume_original_name,
    )
    db.add(candidate)
    db.flush()

    session_token = generate_session_token()
    session = models.AssessmentSession(
        candidate_id=candidate.id,
        session_token=session_token,
        status="REGISTERED",
        current_segment=0,
    )
    db.add(session)

    status_rec = models.CandidatureStatus(
        session_id=session.id if False else None,  # set after commit
    )
    db.commit()
    db.refresh(session)

    # Create candidature status record
    cs = models.CandidatureStatus(session_id=session.id, final_status="pending")
    db.add(cs)
    db.commit()

    return {
        "reference_code": ref_code,
        "session_token": session_token,
        "message": "Registration successful. Please proceed to your assessment.",
    }


# ─── GET INSTRUCTIONS ───
@router.get("/instructions/{session_token}")
def get_instructions(session_token: str, db: Session = Depends(get_db)):
    session = _get_session_or_404(db, session_token)
    cfg = db.query(models.SystemConfig).filter(
        models.SystemConfig.key == "assessment_instructions"
    ).first()
    instructions = cfg.value if cfg else "Please complete all three segments carefully."

    seg1_timer = get_config_int(db, "seg1_timer_minutes", 3) * 60
    seg2_timer = get_config_int(db, "seg2_timer_minutes", 8) * 60
    seg3_timer = get_config_int(db, "seg3_timer_minutes", 4) * 60
    seg1_count = get_config_int(db, "seg1_question_count", 15)
    seg2_count = get_config_int(db, "seg2_question_count", 10)
    seg3_count = get_config_int(db, "seg3_question_count", 2)

    return {
        "instructions": instructions,
        "segments": [
            {"number": 1, "description": "Experience-Based MCQs", "questions": seg1_count, "timer_seconds": seg1_timer},
            {"number": 2, "description": "Role & Skills MCQs with Rationale", "questions": seg2_count, "timer_seconds": seg2_timer},
            {"number": 3, "description": "Scenario-Based Open Questions", "questions": seg3_count, "timer_seconds": seg3_timer},
        ],
        "candidate_name": session.candidate.full_name,
        "status": session.status,
    }


# ─── ACCEPT INSTRUCTIONS ───
@router.post("/accept-instructions/{session_token}")
def accept_instructions(session_token: str, db: Session = Depends(get_db)):
    session = _get_session_or_404(db, session_token)
    if session.status not in ["REGISTERED"]:
        raise HTTPException(status_code=400, detail="Instructions already accepted.")
    session.instructions_accepted_at = datetime.utcnow()
    db.commit()
    return {"message": "Instructions accepted. You may now begin the assessment."}


# ─── GET SEGMENT QUESTIONS ───
@router.get("/segment/{session_token}/{segment_number}")
def get_segment(session_token: str, segment_number: int, db: Session = Depends(get_db)):
    if segment_number not in [1, 2, 3]:
        raise HTTPException(status_code=400, detail="Invalid segment number.")

    session = _get_session_or_404(db, session_token)
    candidate = session.candidate
    # role may be None if candidate registered via requisition with no role_id
    role = candidate.role
    role_name = role.name if role else (
        candidate.requisition.title if candidate.requisition else ""
    )

    if session.status == "SUBMITTED":
        raise HTTPException(status_code=400, detail="Assessment already submitted.")

    # Check instructions were accepted
    if not session.instructions_accepted_at:
        raise HTTPException(status_code=400, detail="Instructions not yet accepted.")

    # Prevent skipping segments
    if segment_number > 1 and session.current_segment < segment_number - 1:
        raise HTTPException(status_code=400, detail=f"Must complete segment {segment_number - 1} first.")

    # Check if already answered this segment (allow re-fetch for resume)
    existing = db.query(models.SegmentResponse).filter(
        models.SegmentResponse.session_id == session.id,
        models.SegmentResponse.segment_number == segment_number,
    ).first()

    if segment_number == 1:
        questions = select_seg1_questions(db, candidate.years_of_experience)
        timer = get_config_int(db, "seg1_timer_minutes", 3) * 60
        formatted = [
            {
                "id": q.id,
                "question_text": q.question_text,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "difficulty": q.difficulty,
                "segment": 1,
                "is_scenario": False,
            }
            for q in questions
        ]
    elif segment_number == 2:
        questions = select_seg2_questions(db, candidate.years_of_experience, role_name)
        timer = get_config_int(db, "seg2_timer_minutes", 8) * 60
        formatted = [
            {
                "id": q.id,
                "question_text": q.question_text,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "difficulty": q.difficulty,
                "segment": 2,
                "is_scenario": False,
                "has_rationale": True,
            }
            for q in questions
        ]
    else:  # segment 3
        questions = select_seg3_questions(db, role_name)
        timer = get_config_int(db, "seg3_timer_minutes", 4) * 60
        formatted = [
            {
                "id": q.id,
                "scenario_text": q.scenario_text,
                "segment": 3,
                "is_scenario": True,
            }
            for q in questions
        ]

    # Record segment start time
    now = datetime.utcnow()
    if segment_number == 1 and not session.seg1_start_time:
        session.seg1_start_time = now
        session.current_segment = 1
        session.status = "IN_PROGRESS"
    elif segment_number == 2 and not session.seg2_start_time:
        session.seg2_start_time = now
        session.current_segment = 2
    elif segment_number == 3 and not session.seg3_start_time:
        session.seg3_start_time = now
        session.current_segment = 3
    db.commit()

    # Get existing responses for resume — returned as LIST for frontend compatibility
    saved = []
    if existing:
        all_resp = db.query(models.SegmentResponse).filter(
            models.SegmentResponse.session_id == session.id,
            models.SegmentResponse.segment_number == segment_number,
        ).all()
        saved = [
            {
                "question_id": r.question_id,
                "selected_answer": r.selected_answer,
                "rationale_text": r.rationale_text,
                "free_text_response": r.free_text_response,
            }
            for r in all_resp
        ]

    return {
        "segment": segment_number,
        "questions": formatted,
        "timer_seconds": timer,
        "saved_responses": saved,
    }


# ─── SAVE PROGRESS (auto-save) ───
@router.post("/save-progress/{session_token}")
def save_progress(
    session_token: str,
    payload: schemas.SaveProgressPayload,
    db: Session = Depends(get_db),
):
    session = _get_session_or_404(db, session_token)
    if session.status == "SUBMITTED":
        raise HTTPException(status_code=400, detail="Assessment already submitted.")
    _upsert_responses(db, session.id, payload.segment, payload.responses)
    return {"message": "Progress saved."}


# ─── SUBMIT SEGMENT / FINAL SUBMISSION ───
@router.post("/submit-segment/{session_token}")
def submit_segment(
    session_token: str,
    payload: schemas.SubmitAssessmentPayload,
    db: Session = Depends(get_db),
):
    session = _get_session_or_404(db, session_token)
    if session.status == "SUBMITTED":
        raise HTTPException(status_code=400, detail="Assessment already submitted.")

    _upsert_responses(db, session.id, payload.segment, payload.responses)
    now = datetime.utcnow()

    if payload.segment == 1:
        session.seg1_end_time = now
    elif payload.segment == 2:
        session.seg2_end_time = now
    elif payload.segment == 3:
        session.seg3_end_time = now
        session.status = "SUBMITTED"
        session.submitted_at = now

    db.commit()

    if payload.segment == 3:
        return {"message": "Assessment submitted successfully. Thank you!", "submitted": True}
    return {"message": f"Segment {payload.segment} submitted. Proceed to segment {payload.segment + 1}.", "submitted": False}


# ─── HELPERS ───
def _get_session_or_404(db: Session, token: str) -> models.AssessmentSession:
    session = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.session_token == token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Assessment session not found.")
    return session


def _upsert_responses(db: Session, session_id: int, segment: int, responses: list):
    for resp_data in responses:
        qid = resp_data.get("question_id")
        if not qid:
            continue
        existing = db.query(models.SegmentResponse).filter(
            models.SegmentResponse.session_id == session_id,
            models.SegmentResponse.segment_number == segment,
            models.SegmentResponse.question_id == qid,
        ).first()
        if existing:
            if segment in [1, 2]:
                existing.selected_answer = resp_data.get("selected_answer")
            if segment == 2:
                existing.rationale_text = resp_data.get("rationale_text")
            if segment == 3:
                existing.free_text_response = resp_data.get("free_text_response")
        else:
            new_resp = models.SegmentResponse(
                session_id=session_id,
                segment_number=segment,
                question_id=qid,
                selected_answer=resp_data.get("selected_answer"),
                rationale_text=resp_data.get("rationale_text"),
                free_text_response=resp_data.get("free_text_response"),
            )
            db.add(new_resp)
    db.commit()
