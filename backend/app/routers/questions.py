"""
Question Bank Management Routes
Supports CRUD, bulk import (CSV/Excel), bulk export for all 3 segments.
"""
import io
import csv
import json
from typing import Optional, List

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.auth import require_admin

router = APIRouter(prefix="/api/admin/questions", tags=["questions"])


# ════════════════════════════════════════════════════
#                   SEGMENT 1
# ════════════════════════════════════════════════════
@router.get("/seg1")
def list_seg1(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    difficulty: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = db.query(models.QuestionSeg1)
    if difficulty:
        q = q.filter(models.QuestionSeg1.difficulty == difficulty)
    if category:
        q = q.filter(models.QuestionSeg1.category == category)
    if is_active is not None:
        q = q.filter(models.QuestionSeg1.is_active == is_active)
    if search:
        q = q.filter(models.QuestionSeg1.question_text.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(models.QuestionSeg1.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_q1_to_dict(i) for i in items], "total": total, "page": page, "page_size": page_size}


@router.post("/seg1")
def create_seg1(
    payload: schemas.QuestionSeg1Create,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = models.QuestionSeg1(**payload.dict())
    db.add(q)
    db.commit()
    return {"message": "Question created.", "id": q.id}


@router.put("/seg1/{question_id}")
def update_seg1(
    question_id: int,
    payload: schemas.QuestionSeg1Update,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = db.query(models.QuestionSeg1).filter(models.QuestionSeg1.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    for field, value in payload.dict(exclude_none=True).items():
        setattr(q, field, value)
    db.commit()
    return {"message": "Question updated."}


@router.delete("/seg1/{question_id}")
def delete_seg1(
    question_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = db.query(models.QuestionSeg1).filter(models.QuestionSeg1.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    q.is_active = False  # Soft delete
    db.commit()
    return {"message": "Question deactivated."}


@router.post("/seg1/import")
async def import_seg1(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await _import_questions(file, db, models.QuestionSeg1, "seg1")


@router.get("/seg1/export")
def export_seg1(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    items = db.query(models.QuestionSeg1).all()
    return _export_questions(items, "seg1_questions")


# ════════════════════════════════════════════════════
#                   SEGMENT 2
# ════════════════════════════════════════════════════
@router.get("/seg2")
def list_seg2(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    difficulty: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = db.query(models.QuestionSeg2)
    if difficulty:
        q = q.filter(models.QuestionSeg2.difficulty == difficulty)
    if is_active is not None:
        q = q.filter(models.QuestionSeg2.is_active == is_active)
    if search:
        q = q.filter(models.QuestionSeg2.question_text.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(models.QuestionSeg2.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_q2_to_dict(i) for i in items], "total": total, "page": page, "page_size": page_size}


@router.post("/seg2")
def create_seg2(
    payload: schemas.QuestionSeg2Create,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = models.QuestionSeg2(**payload.dict())
    db.add(q)
    db.commit()
    return {"message": "Question created.", "id": q.id}


@router.put("/seg2/{question_id}")
def update_seg2(
    question_id: int,
    payload: schemas.QuestionSeg2Update,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = db.query(models.QuestionSeg2).filter(models.QuestionSeg2.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    for field, value in payload.dict(exclude_none=True).items():
        setattr(q, field, value)
    db.commit()
    return {"message": "Question updated."}


@router.delete("/seg2/{question_id}")
def delete_seg2(
    question_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = db.query(models.QuestionSeg2).filter(models.QuestionSeg2.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    q.is_active = False
    db.commit()
    return {"message": "Question deactivated."}


@router.post("/seg2/import")
async def import_seg2(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await _import_questions(file, db, models.QuestionSeg2, "seg2")


@router.get("/seg2/export")
def export_seg2(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    items = db.query(models.QuestionSeg2).all()
    return _export_questions(items, "seg2_questions")


# ════════════════════════════════════════════════════
#                   SEGMENT 3
# ════════════════════════════════════════════════════
@router.get("/seg3")
def list_seg3(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = db.query(models.QuestionSeg3)
    if is_active is not None:
        q = q.filter(models.QuestionSeg3.is_active == is_active)
    if search:
        q = q.filter(models.QuestionSeg3.scenario_text.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(models.QuestionSeg3.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_q3_to_dict(i) for i in items], "total": total, "page": page, "page_size": page_size}


@router.post("/seg3")
def create_seg3(
    payload: schemas.QuestionSeg3Create,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = models.QuestionSeg3(**payload.dict())
    db.add(q)
    db.commit()
    return {"message": "Question created.", "id": q.id}


@router.put("/seg3/{question_id}")
def update_seg3(
    question_id: int,
    payload: schemas.QuestionSeg3Update,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = db.query(models.QuestionSeg3).filter(models.QuestionSeg3.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    for field, value in payload.dict(exclude_none=True).items():
        setattr(q, field, value)
    db.commit()
    return {"message": "Question updated."}


@router.delete("/seg3/{question_id}")
def delete_seg3(
    question_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    q = db.query(models.QuestionSeg3).filter(models.QuestionSeg3.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    q.is_active = False
    db.commit()
    return {"message": "Question deactivated."}


@router.post("/seg3/import")
async def import_seg3(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    return await _import_questions(file, db, models.QuestionSeg3, "seg3")


@router.get("/seg3/export")
def export_seg3(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    items = db.query(models.QuestionSeg3).all()
    return _export_questions(items, "seg3_questions")


# ════════════════════════════════════════════════════
#                   HELPERS
# ════════════════════════════════════════════════════
def _q1_to_dict(q):
    return {
        "id": q.id, "question_text": q.question_text,
        "option_a": q.option_a, "option_b": q.option_b,
        "option_c": q.option_c, "option_d": q.option_d,
        "correct_answer": q.correct_answer, "difficulty": q.difficulty,
        "category": q.category, "experience_bracket_ids": q.experience_bracket_ids,
        "is_active": q.is_active, "usage_count": q.usage_count,
        "created_at": q.created_at, "updated_at": q.updated_at,
    }

def _q2_to_dict(q):
    return {
        "id": q.id, "question_text": q.question_text,
        "option_a": q.option_a, "option_b": q.option_b,
        "option_c": q.option_c, "option_d": q.option_d,
        "correct_answer": q.correct_answer, "difficulty": q.difficulty,
        "category": q.category, "role_tags": q.role_tags,
        "skill_tags": q.skill_tags, "experience_bracket_ids": q.experience_bracket_ids,
        "is_active": q.is_active, "usage_count": q.usage_count,
        "created_at": q.created_at, "updated_at": q.updated_at,
    }

def _q3_to_dict(q):
    return {
        "id": q.id, "scenario_text": q.scenario_text,
        "reference_answer": q.reference_answer, "difficulty": q.difficulty,
        "role_tags": q.role_tags, "is_active": q.is_active,
        "usage_count": q.usage_count,
        "created_at": q.created_at, "updated_at": q.updated_at,
    }


async def _import_questions(file: UploadFile, db: Session, model_class, segment: str):
    """Handle CSV or Excel import for any segment."""
    filename = file.filename or ""
    content = await file.read()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Only CSV or Excel files are accepted.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {str(e)}")

    created = 0
    errors = []

    for idx, row in df.iterrows():
        try:
            row_dict = row.where(pd.notna(row), None).to_dict()

            if segment == "seg3":
                obj = model_class(
                    scenario_text=row_dict.get("scenario_text", ""),
                    reference_answer=row_dict.get("reference_answer", ""),
                    difficulty=str(row_dict.get("difficulty", "medium")).lower(),
                    role_tags=_parse_list(row_dict.get("role_tags")),
                    is_active=True,
                )
            else:
                obj = model_class(
                    question_text=row_dict.get("question_text", ""),
                    option_a=row_dict.get("option_a", ""),
                    option_b=row_dict.get("option_b", ""),
                    option_c=row_dict.get("option_c", ""),
                    option_d=row_dict.get("option_d", ""),
                    correct_answer=str(row_dict.get("correct_answer", "A")).upper(),
                    difficulty=str(row_dict.get("difficulty", "medium")).lower(),
                    category=row_dict.get("category"),
                    is_active=True,
                )
                if segment == "seg2":
                    obj.role_tags = _parse_list(row_dict.get("role_tags"))
                    obj.skill_tags = _parse_list(row_dict.get("skill_tags"))

            db.add(obj)
            created += 1
        except Exception as e:
            errors.append({"row": idx + 2, "error": str(e)})

    db.commit()
    return {"created": created, "errors": errors}


def _parse_list(value) -> Optional[List[str]]:
    if value is None:
        return None
    if isinstance(value, list):
        return value
    return [v.strip() for v in str(value).split(",") if v.strip()]


def _export_questions(items, filename: str):
    """Export question list as CSV."""
    if not items:
        raise HTTPException(status_code=404, detail="No questions to export.")

    # Convert first item to detect fields
    first = items[0]
    rows = []
    for item in items:
        d = {}
        for col in item.__table__.columns:
            val = getattr(item, col.name)
            if isinstance(val, list):
                val = ",".join(str(v) for v in val) if val else ""
            d[col.name] = val
        rows.append(d)

    df = pd.DataFrame(rows)
    output = io.BytesIO()
    df.to_excel(output, index=False)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}.xlsx"},
    )
