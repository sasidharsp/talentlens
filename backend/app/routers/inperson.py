from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.auth import require_any_staff

router = APIRouter(prefix="/inperson", tags=["inperson"])


@router.get("/tags")
def get_tags(db: Session = Depends(get_db),
             current_user=Depends(require_any_staff)):
    """All unique tags in use, with question count each."""
    rows = db.query(
        models.InPersonQuestion.tag,
        models.func.count(models.InPersonQuestion.id).label("count")
    ).group_by(models.InPersonQuestion.tag)\
     .order_by(models.InPersonQuestion.tag).all()
    return [{"tag": r.tag, "count": r.count} for r in rows]


@router.get("/questions")
def get_questions(
    tag: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_staff),
):
    """List questions, optionally filtered by tag."""
    q = db.query(models.InPersonQuestion)
    if tag:
        q = q.filter(models.InPersonQuestion.tag == tag)
    items = q.order_by(models.InPersonQuestion.tag,
                       models.InPersonQuestion.id).all()
    return [
        {
            "id": i.id,
            "question": i.question,
            "answer": i.answer,
            "tag": i.tag,
            "created_at": i.created_at,
        }
        for i in items
    ]


@router.get("/stats")
def get_stats(db: Session = Depends(get_db),
              current_user=Depends(require_any_staff)):
    total_q   = db.query(models.InPersonQuestion).count()
    total_tags = db.query(models.InPersonQuestion.tag)\
                   .distinct().count()
    return {"total_questions": total_q, "total_tags": total_tags}


@router.post("/questions")
def add_question(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_any_staff),
):
    """Add a new in-person interview question."""
    question = (payload.get("question") or "").strip()
    answer   = (payload.get("answer")   or "").strip()
    tag      = (payload.get("tag")      or "").strip()

    if not question: raise HTTPException(400, "Question is required.")
    if not answer:   raise HTTPException(400, "Answer is required.")
    if not tag:      raise HTTPException(400, "Tag is required.")

    q = models.InPersonQuestion(
        question=question,
        answer=answer,
        tag=tag,
        created_by=current_user.id,
    )
    db.add(q); db.commit(); db.refresh(q)
    return {"id": q.id, "question": q.question, "answer": q.answer, "tag": q.tag}
