"""Candidate-facing Round 2 endpoints."""
import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models
from app.database import get_db

router = APIRouter(prefix="/round2", tags=["round2-candidate"])


@router.post("/verify")
def verify_reference_code(payload: dict, db: Session = Depends(get_db)):
    """
    Candidate enters their Round 1 reference code.
    Returns their Round 2 session token if invited.
    """
    ref_code = str(payload.get("reference_code","")).strip().upper()
    if not ref_code: raise HTTPException(400, "Reference code is required.")

    candidate = db.query(models.Candidate).filter_by(reference_code=ref_code).first()
    if not candidate:
        raise HTTPException(404, "Reference code not found. Please check and try again.")

    r2_session = db.query(models.Round2Session).filter_by(
        candidate_id=candidate.id
    ).order_by(models.Round2Session.id.desc()).first()

    if not r2_session:
        raise HTTPException(403, "You have not been invited to Round 2 yet. Please contact the assessment team.")

    if r2_session.status == "EVALUATED":
        raise HTTPException(400, "You have already completed Round 2.")

    if r2_session.status == "SUBMITTED":
        raise HTTPException(400, "Your Round 2 has been submitted and is under evaluation.")

    return {
        "session_token": r2_session.session_token,
        "candidate_name": candidate.full_name,
        "status": r2_session.status,
        "role": candidate.requisition.title if candidate.requisition else "—",
    }


@router.get("/session/{token}")
def get_r2_session(token: str, db: Session = Depends(get_db)):
    s = _get_r2_session(db, token)
    c = s.candidate
    r2_eval = db.query(models.Round2Evaluation).filter_by(session_id=s.id).first()
    return {
        "status": s.status,
        "candidate_name": c.full_name,
        "role": c.requisition.title if c.requisition else "—",
        "overall_score": r2_eval.overall_score if r2_eval else None,
    }


@router.post("/start/{token}")
def start_r2_session(token: str, db: Session = Depends(get_db)):
    """Select 5 random questions and mark session as in-progress."""
    s = _get_r2_session(db, token)
    if s.status == "SUBMITTED" or s.status == "EVALUATED":
        raise HTTPException(400, "Round 2 already completed.")

    # Select 5 random active questions
    questions = db.query(models.Round2Question).filter_by(is_active=True)\
        .order_by(models.Round2Question.id).all()
    if len(questions) < 5:
        raise HTTPException(503, f"Not enough Round 2 questions available (need 5, have {len(questions)}).")

    selected = random.sample(questions, 5)

    # If responses already exist (re-start), return existing assignment
    existing = db.query(models.Round2Response).filter_by(session_id=s.id).first()
    if not existing:
        for i, q in enumerate(selected, 1):
            db.add(models.Round2Response(
                session_id=s.id, question_id=q.id, question_order=i
            ))

    s.status = "IN_PROGRESS"
    if not s.started_at: s.started_at = datetime.utcnow()
    db.commit()

    # Return questions (no reference answers to candidate)
    assignments = db.query(models.Round2Response)\
        .filter_by(session_id=s.id)\
        .order_by(models.Round2Response.question_order)\
        .all()

    return {
        "questions": [{
            "question_id": a.question_id,
            "question_order": a.question_order,
            "scenario_text": a.question.scenario_text,
            "existing_response": a.free_text_response,
        } for a in assignments],
        "total_questions": len(assignments),
    }


@router.post("/save-response/{token}")
def save_r2_response(token: str, payload: dict, db: Session = Depends(get_db)):
    """Save/update response for a single question."""
    s = _get_r2_session(db, token)
    if s.status == "SUBMITTED": raise HTTPException(400, "Already submitted.")

    question_id = payload.get("question_id")
    response_text = str(payload.get("response","")).strip()

    resp = db.query(models.Round2Response).filter_by(
        session_id=s.id, question_id=question_id
    ).first()
    if not resp: raise HTTPException(404, "Question not part of your session.")

    resp.free_text_response = response_text
    db.commit()
    return {"saved": True}


@router.post("/submit/{token}")
def submit_r2(token: str, payload: dict, db: Session = Depends(get_db)):
    """Submit all responses and trigger background evaluation."""
    s = _get_r2_session(db, token)
    if s.status == "SUBMITTED": raise HTTPException(400, "Already submitted.")

    # Save any final responses included in payload
    for resp_data in payload.get("responses", []):
        resp = db.query(models.Round2Response).filter_by(
            session_id=s.id, question_id=resp_data.get("question_id")
        ).first()
        if resp and resp_data.get("response"):
            resp.free_text_response = resp_data["response"].strip()

    s.status = "SUBMITTED"
    s.submitted_at = datetime.utcnow()
    db.commit()

    # Background evaluation
    import threading
    from app.services.round2_evaluator import run_r2_evaluation
    from app.database import SessionLocal

    def _eval(sid):
        bg_db = SessionLocal()
        try: run_r2_evaluation(bg_db, sid)
        except Exception: pass
        finally: bg_db.close()

    threading.Thread(target=_eval, args=(s.id,), daemon=True).start()
    return {"submitted": True, "message": "Round 2 submitted. Thank you!"}


@router.post("/proctor-event/{token}")
def r2_proctor_event(token: str, payload: dict, db: Session = Depends(get_db)):
    s = _get_r2_session(db, token)
    event_type = payload.get("event_type","unknown")
    if event_type in ["tab_switch","fullscreen_exit","gaze_away"]:
        s.violation_count = (s.violation_count or 0) + 1
    db.commit()
    return {"logged": True}


@router.post("/terminate/{token}")
def terminate_r2(token: str, payload: dict, db: Session = Depends(get_db)):
    s = _get_r2_session(db, token)
    reason = payload.get("reason","Terminated")
    s.status = "SUBMITTED"
    s.proctoring_status = "terminated"
    s.submitted_at = datetime.utcnow()
    s.termination_reason = reason
    s.integrity_score = max(0, 100 - (s.violation_count or 0) * 10)
    db.commit()
    return {"terminated": True}


def _get_r2_session(db: Session, token: str):
    s = db.query(models.Round2Session).filter_by(session_token=token).first()
    if not s: raise HTTPException(404, "Session not found.")
    return s
