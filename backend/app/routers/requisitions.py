"""
Requisition management — admin creates job requisitions which appear
as the "Applying for" dropdown on the candidate registration page.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import require_admin, require_any_staff

router = APIRouter(tags=["requisitions"])


def _to_dict(r: models.Requisition):
    return {
        "id":          r.id,
        "req_id":      r.req_id,
        "title":       r.title,
        "department":  r.department,
        "location":    r.location,
        "description": r.description,
        "is_active":   r.is_active,
        "created_at":  r.created_at,
        "candidate_count": len(r.candidates) if r.candidates else 0,
        # display label used in dropdowns
        "label": f"{r.req_id} — {r.title}" + (f" ({r.location})" if r.location else ""),
    }


# ── Public endpoint (no auth) — used by registration page ──────────────────
@router.get("/api/candidate/requisitions")
def list_active_requisitions(db: Session = Depends(get_db)):
    items = (
        db.query(models.Requisition)
        .filter(models.Requisition.is_active == True)
        .order_by(models.Requisition.req_id)
        .all()
    )
    return [_to_dict(r) for r in items]


# ── Admin endpoints ─────────────────────────────────────────────────────────
@router.get("/api/admin/requisitions")
def list_requisitions(
    db: Session = Depends(get_db),
    current_user=Depends(require_any_staff),
):
    items = db.query(models.Requisition).order_by(models.Requisition.id.desc()).all()
    return [_to_dict(r) for r in items]


@router.post("/api/admin/requisitions")
def create_requisition(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    req_id = (payload.get("req_id") or "").strip().upper()
    title  = (payload.get("title") or "").strip()
    if not req_id or not title:
        raise HTTPException(400, "req_id and title are required.")

    existing = db.query(models.Requisition).filter_by(req_id=req_id).first()
    if existing:
        raise HTTPException(400, f"Requisition ID '{req_id}' already exists.")

    r = models.Requisition(
        req_id      = req_id,
        title       = title,
        department  = (payload.get("department") or "").strip() or None,
        location    = (payload.get("location") or "").strip() or None,
        description = (payload.get("description") or "").strip() or None,
        is_active   = True,
        created_by  = current_user.id,
    )
    db.add(r)
    db.commit()
    return _to_dict(r)


@router.patch("/api/admin/requisitions/{req_id_or_id}")
def update_requisition(
    req_id_or_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    # Accept either numeric id or string req_id
    r = None
    if req_id_or_id.isdigit():
        r = db.query(models.Requisition).filter_by(id=int(req_id_or_id)).first()
    if not r:
        r = db.query(models.Requisition).filter_by(req_id=req_id_or_id.upper()).first()
    if not r:
        raise HTTPException(404, "Requisition not found.")

    for field in ("title", "department", "location", "description", "is_active"):
        if field in payload:
            setattr(r, field, payload[field])

    db.commit()
    return _to_dict(r)


@router.delete("/api/admin/requisitions/{req_id_or_id}")
def deactivate_requisition(
    req_id_or_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    r = None
    if req_id_or_id.isdigit():
        r = db.query(models.Requisition).filter_by(id=int(req_id_or_id)).first()
    if not r:
        r = db.query(models.Requisition).filter_by(req_id=req_id_or_id.upper()).first()
    if not r:
        raise HTTPException(404, "Requisition not found.")
    r.is_active = False
    db.commit()
    return {"message": f"Requisition {r.req_id} deactivated."}
