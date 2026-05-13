"""
Requisition management — admin creates job requisitions which appear
as the "Applying for" dropdown on the candidate registration page.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import require_admin, require_any_staff

router = APIRouter(tags=["requisitions"])


# ── Schemas ─────────────────────────────────────────────────────────────────
class RequisitionCreate(BaseModel):
    req_id: str
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None


class RequisitionUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# ── Helpers ──────────────────────────────────────────────────────────────────
def _candidate_count(r: models.Requisition, db: Session) -> int:
    """Safe count that doesn't fail if requisition_id column missing."""
    try:
        from sqlalchemy import text
        result = db.execute(
            text("SELECT COUNT(*) FROM candidates WHERE requisition_id = :rid"),
            {"rid": r.id}
        ).scalar()
        return result or 0
    except Exception:
        return 0


def _to_dict(r: models.Requisition, db: Session = None) -> dict:
    count = _candidate_count(r, db) if db else 0
    return {
        "id":            r.id,
        "req_id":        r.req_id,
        "title":         r.title,
        "department":    r.department,
        "location":      r.location,
        "description":   r.description,
        "is_active":     r.is_active,
        "created_at":    r.created_at,
        "candidate_count": count,
        "label": f"{r.req_id} \u2014 {r.title}" + (f" ({r.location})" if r.location else ""),
    }


# ── Public endpoint (no auth) ─────────────────────────────────────────────
@router.get("/api/candidate/requisitions")
def list_active_requisitions(db: Session = Depends(get_db)):
    items = (
        db.query(models.Requisition)
        .filter(models.Requisition.is_active == True)
        .order_by(models.Requisition.req_id)
        .all()
    )
    return [_to_dict(r, db) for r in items]


# ── Admin endpoints ───────────────────────────────────────────────────────
@router.get("/api/admin/requisitions")
def list_requisitions(
    db: Session = Depends(get_db),
    current_user=Depends(require_any_staff),
):
    items = db.query(models.Requisition).order_by(models.Requisition.id.desc()).all()
    return [_to_dict(r, db) for r in items]


@router.post("/api/admin/requisitions")
def create_requisition(
    payload: RequisitionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    req_id = payload.req_id.strip().upper()
    title  = payload.title.strip()

    if not req_id or not title:
        raise HTTPException(400, "Req ID and Title are required.")

    existing = db.query(models.Requisition).filter_by(req_id=req_id).first()
    if existing:
        raise HTTPException(400, f"Requisition ID '{req_id}' already exists.")

    r = models.Requisition(
        req_id      = req_id,
        title       = title,
        department  = (payload.department or "").strip() or None,
        location    = (payload.location or "").strip() or None,
        description = (payload.description or "").strip() or None,
        is_active   = True,
        created_by  = current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _to_dict(r, db)


@router.patch("/api/admin/requisitions/{rid}")
def update_requisition(
    rid: int,
    payload: RequisitionUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    r = db.query(models.Requisition).filter_by(id=rid).first()
    if not r:
        raise HTTPException(404, "Requisition not found.")

    data = payload.dict(exclude_none=True)
    for field, value in data.items():
        setattr(r, field, value)

    db.commit()
    db.refresh(r)
    return _to_dict(r, db)


@router.delete("/api/admin/requisitions/{rid}")
def deactivate_requisition(
    rid: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    r = db.query(models.Requisition).filter_by(id=rid).first()
    if not r:
        raise HTTPException(404, "Requisition not found.")
    r.is_active = False
    db.commit()
    return {"message": f"Requisition {r.req_id} deactivated."}
