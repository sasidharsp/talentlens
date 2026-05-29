"""Admin endpoints for Round 2 — question bank + candidates + invite."""
import secrets, io
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app import models
from app.database import get_db
from app.auth import require_admin, require_super_admin, require_any_staff, require_questions

router = APIRouter(prefix="/admin/round2", tags=["round2-admin"])


# ─── QUESTION BANK ───────────────────────────────────────────────

@router.get("/questions")
def list_r2_questions(
    batch_tag: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1, page_size: int = 20,
    db: Session = Depends(get_db),
    current_user=Depends(require_questions),
):
    q = db.query(models.Round2Question).filter_by(is_active=True)
    if batch_tag: q = q.filter_by(batch_tag=batch_tag)
    if search: q = q.filter(models.Round2Question.scenario_text.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(models.Round2Question.id.desc())\
             .offset((page-1)*page_size).limit(page_size).all()
    return {
        "total": total, "page": page, "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
        "items": [_q_dict(q) for q in items],
    }


@router.post("/questions")
def create_r2_question(payload: dict, db: Session = Depends(get_db), current_user=Depends(require_questions)):
    if not payload.get("scenario_text"): raise HTTPException(400, "scenario_text required")
    q = models.Round2Question(
        scenario_text=payload["scenario_text"].strip(),
        reference_answer=payload.get("reference_answer","").strip(),
        difficulty=payload.get("difficulty","high"),
        category=payload.get("category"),
        batch_tag=payload.get("batch_tag"),
        domain_tag=payload.get("domain_tag"),
    )
    db.add(q); db.commit(); db.refresh(q)
    return _q_dict(q)


@router.put("/questions/{qid}")
def update_r2_question(qid: int, payload: dict, db: Session = Depends(get_db), current_user=Depends(require_questions)):
    q = db.query(models.Round2Question).filter_by(id=qid, is_active=True).first()
    if not q: raise HTTPException(404, "Not found")
    for field in ["scenario_text","reference_answer","difficulty","category","batch_tag","domain_tag"]:
        if field in payload: setattr(q, field, payload[field])
    db.commit(); return _q_dict(q)


@router.delete("/questions/{qid}")
def delete_r2_question(qid: int, db: Session = Depends(get_db), current_user=Depends(require_questions)):
    q = db.query(models.Round2Question).filter_by(id=qid).first()
    if not q: raise HTTPException(404, "Not found")
    q.is_active = False; db.commit()
    return {"message": "Question deleted."}


@router.get("/questions/batch-tags")
def r2_batch_tags(db: Session = Depends(get_db), current_user=Depends(require_questions)):
    rows = db.query(models.Round2Question.batch_tag)\
             .filter(models.Round2Question.batch_tag.isnot(None),
                     models.Round2Question.is_active == True).distinct().all()
    return sorted(r[0] for r in rows if r[0])


@router.get("/questions/template")
def r2_template(current_user=Depends(require_questions)):
    csv = "scenario_text,reference_answer,difficulty,batch_tag,category\n"
    csv += '"A critical payment service is degrading under load. Walk us through your diagnosis and resolution plan.","Check metrics, identify bottleneck, scale/throttle, communicate status, post-incident review",high,Middleware-L2-Jun2025,Performance\n'
    csv += '"Your team deployed a change that caused a 30% spike in error rates. What do you do?","Rollback immediately, assess impact, root cause, communicate, fix forward",high,Middleware-L2-Jun2025,Incident\n'
    return StreamingResponse(io.BytesIO(csv.encode()), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=TalentLens_Round2_Template.csv"})


@router.post("/questions/import")
async def import_r2_questions(
    file: UploadFile = File(...),
    batch_tag: str = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_questions),
):
    import pandas as pd
    content = await file.read()
    fname = (file.filename or "").lower()
    try:
        df = pd.read_csv(io.BytesIO(content)) if fname.endswith(".csv") else pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Cannot read file: {e}")

    df.columns = [str(c).strip().lower().replace(" ","_") for c in df.columns]
    df.dropna(how="all", inplace=True)

    def _clean(v):
        if not v: return v
        import re
        v = str(v).replace('\r\n','\n').replace('\r','\n')
        v = v.replace('\u2018',"'").replace('\u2019',"'").replace('\u201c','"').replace('\u201d','"')
        return re.sub(r'\n{3,}','\n\n',v).strip()

    created, errors = 0, []
    for idx, row in df.iterrows():
        rv = row.where(pd.notna(row), None).to_dict()
        rn = idx + 2
        st = _clean(rv.get("scenario_text") or rv.get("question_text") or "")
        ra = _clean(rv.get("reference_answer") or rv.get("ideal_answer") or "")
        if not st: errors.append({"row": rn, "error": "scenario_text required"}); continue
        q = models.Round2Question(
            scenario_text=st, reference_answer=ra,
            difficulty=str(rv.get("difficulty","high")).lower(),
            category=str(rv.get("category","")).strip() or None,
            batch_tag=batch_tag,
            domain_tag=str(rv.get("domain_tag","")).strip() or None,
        )
        db.add(q); created += 1

    db.commit()
    return {"created": created, "errors": errors, "batch_tag": batch_tag,
            "message": f"{created} R2 questions imported with tag '{batch_tag}'. {len(errors)} skipped."}


# ─── INVITE CANDIDATE ───────────────────────────────────────────────

@router.post("/invite/{r1_session_id}")
def invite_to_round2(
    r1_session_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Invite a shortlisted candidate to Round 2."""
    r1_session = db.query(models.AssessmentSession).filter_by(id=r1_session_id).first()
    if not r1_session: raise HTTPException(404, "Candidate session not found.")
    if r1_session.status not in ("EVALUATED",):
        raise HTTPException(400, "Candidate must be evaluated before Round 2 invitation.")

    # Check if already invited
    existing = db.query(models.Round2Session).filter_by(
        candidate_id=r1_session.candidate_id
    ).first()
    if existing:
        return {"already_invited": True, "status": existing.status,
                "session_token": existing.session_token}

    # Check we have R2 questions
    r2_count = db.query(models.Round2Question).filter_by(is_active=True).count()
    if r2_count < 5:
        raise HTTPException(400, f"Need at least 5 active Round 2 questions (have {r2_count}). Add more to the Round 2 Question Bank.")

    token = secrets.token_urlsafe(32)
    r2_session = models.Round2Session(
        candidate_id=r1_session.candidate_id,
        session_token=token,
        status="INVITED",
        invited_by=current_user.id,
    )
    db.add(r2_session); db.commit(); db.refresh(r2_session)

    return {
        "invited": True,
        "session_token": token,
        "candidate_name": r1_session.candidate.full_name,
        "message": f"{r1_session.candidate.full_name} invited to Round 2. They can use their reference code: {r1_session.candidate.reference_code}",
    }


# ─── R2 CANDIDATE LIST & DETAIL ─────────────────────────────────────

@router.get("/candidates")
def list_r2_candidates(
    page: int = 1, page_size: int = 30,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_staff),
):
    q = db.query(models.Round2Session).order_by(models.Round2Session.invited_at.desc())
    total = q.count()
    sessions = q.offset((page-1)*page_size).limit(page_size).all()

    items = []
    for s in sessions:
        c = s.candidate
        r2_eval = db.query(models.Round2Evaluation).filter_by(session_id=s.id).first()

        # Get R1 score for comparison
        r1_eval = db.query(models.EvaluationResult)\
            .join(models.AssessmentSession)\
            .filter(models.AssessmentSession.candidate_id == c.id)\
            .order_by(models.EvaluationResult.evaluated_at.desc())\
            .first()

        rec = r2_eval.ai_recommendation if r2_eval and r2_eval.ai_recommendation else {}
        items.append({
            "r2_session_id": s.id,
            "candidate_id": c.id,
            "reference_code": c.reference_code,
            "full_name": c.full_name,
            "email": c.email,
            "role": c.requisition.title if c.requisition else (c.role.name if c.role else "—"),
            "r2_status": s.status,
            "r1_score": r1_eval.overall_score if r1_eval else None,
            "r2_score": r2_eval.overall_score if r2_eval else None,
            "r2_verdict": rec.get("recommendation"),
            "invited_at": s.invited_at,
            "submitted_at": s.submitted_at,
        })

    return {"total": total, "page": page, "items": items}


@router.get("/candidates/{r2_session_id}")
def r2_candidate_detail(
    r2_session_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_staff),
):
    s = db.query(models.Round2Session).filter_by(id=r2_session_id).first()
    if not s: raise HTTPException(404, "Not found")
    c = s.candidate
    r2_eval = db.query(models.Round2Evaluation).filter_by(session_id=s.id).first()
    responses = db.query(models.Round2Response)\
        .filter_by(session_id=s.id)\
        .order_by(models.Round2Response.question_order)\
        .all()

    r1_session = db.query(models.AssessmentSession)\
        .filter_by(candidate_id=c.id)\
        .order_by(models.AssessmentSession.id.desc()).first()
    r1_eval = db.query(models.EvaluationResult)\
        .filter_by(session_id=r1_session.id).first() if r1_session else None

    return {
        "r2_session": {"id": s.id, "status": s.status, "invited_at": s.invited_at,
                       "started_at": s.started_at, "submitted_at": s.submitted_at,
                       "integrity_score": s.integrity_score, "violation_count": s.violation_count,
                       "termination_reason": s.termination_reason},
        "candidate": {"id": c.id, "full_name": c.full_name, "email": c.email,
                      "reference_code": c.reference_code,
                      "role": c.requisition.title if c.requisition else "—",
                      "years_of_experience": c.years_of_experience,
                      "webcam_photo_path": c.webcam_photo_path},
        "evaluation": {
            "overall_score": r2_eval.overall_score,
            "question_details": r2_eval.question_details,
            "ai_recommendation": r2_eval.ai_recommendation,
            "evaluated_at": r2_eval.evaluated_at,
        } if r2_eval else None,
        "responses": [{
            "question_order": r.question_order,
            "question_id": r.question_id,
            "scenario_text": r.question.scenario_text if r.question else "",
            "free_text_response": r.free_text_response,
        } for r in responses],
        "r1_comparison": {
            "r1_score": r1_eval.overall_score if r1_eval else None,
            "r1_seg1": r1_eval.seg1_score if r1_eval else None,
            "r1_seg2": r1_eval.seg2_score if r1_eval else None,
            "r1_seg3": r1_eval.seg3_score if r1_eval else None,
            "r1_verdict": r1_eval.ai_recommendation.get("recommendation") if r1_eval and r1_eval.ai_recommendation else None,
        },
    }


@router.post("/candidates/{r2_session_id}/evaluate")
def force_r2_evaluate(
    r2_session_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    s = db.query(models.Round2Session).filter_by(id=r2_session_id).first()
    if not s: raise HTTPException(404, "Not found")
    if s.status not in ("SUBMITTED","EVALUATED"):
        raise HTTPException(400, "Candidate has not submitted Round 2 yet.")
    from app.services.round2_evaluator import run_r2_evaluation
    run_r2_evaluation(db, r2_session_id)
    return {"message": "Round 2 evaluation complete."}


def _q_dict(q):
    return {
        "id": q.id, "scenario_text": q.scenario_text,
        "reference_answer": q.reference_answer, "difficulty": q.difficulty,
        "category": q.category, "batch_tag": q.batch_tag, "domain_tag": q.domain_tag,
        "usage_count": q.usage_count, "created_at": q.created_at,
    }
