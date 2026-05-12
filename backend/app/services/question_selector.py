"""
Question Selector Service
Picks questions from the bank based on candidate profile, experience, and role.
"""
import random
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app import models


def get_experience_bracket(db: Session, years: float) -> Optional[models.ExperienceBracket]:
    """Find the matching experience bracket for a given years value."""
    brackets = db.query(models.ExperienceBracket).filter(
        models.ExperienceBracket.is_active == True
    ).all()
    for bracket in brackets:
        if bracket.min_years <= years:
            if bracket.max_years is None or years < bracket.max_years:
                return bracket
    return None


def get_config_int(db: Session, key: str, default: int) -> int:
    cfg = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
    if cfg:
        try:
            return int(cfg.value)
        except (ValueError, TypeError):
            pass
    return default


def get_config_str(db: Session, key: str, default: str) -> str:
    cfg = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
    return cfg.value if cfg else default


def select_seg1_questions(db: Session, years_of_experience: float) -> List[models.QuestionSeg1]:
    """
    Select Segment 1 questions based on experience bracket.
    Respects difficulty mix from system config.
    """
    total = get_config_int(db, "seg1_question_count", 15)
    high_count = get_config_int(db, "seg1_difficulty_high", 3)
    medium_count = get_config_int(db, "seg1_difficulty_medium", 7)
    low_count = get_config_int(db, "seg1_difficulty_low", 5)

    bracket = get_experience_bracket(db, years_of_experience)
    bracket_id = bracket.id if bracket else None

    def pull(difficulty: str, count: int) -> List[models.QuestionSeg1]:
        query = db.query(models.QuestionSeg1).filter(
            models.QuestionSeg1.is_active == True,
            models.QuestionSeg1.difficulty == difficulty,
        )
        if bracket_id:
            query = query.filter(
                models.QuestionSeg1.experience_bracket_ids.contains([bracket_id])
            )
        pool = query.all()
        return random.sample(pool, min(count, len(pool)))

    questions: List[models.QuestionSeg1] = []
    questions += pull("high", high_count)
    questions += pull("medium", medium_count)
    questions += pull("low", low_count)

    # If we didn't hit the target, fill from any difficulty
    if len(questions) < total:
        used_ids = {q.id for q in questions}
        extras_query = db.query(models.QuestionSeg1).filter(
            models.QuestionSeg1.is_active == True,
            ~models.QuestionSeg1.id.in_(used_ids),
        )
        if bracket_id:
            extras_query = extras_query.filter(
                models.QuestionSeg1.experience_bracket_ids.contains([bracket_id])
            )
        pool = extras_query.all()
        needed = total - len(questions)
        questions += random.sample(pool, min(needed, len(pool)))

    random.shuffle(questions)
    return questions[:total]


def select_seg2_questions(
    db: Session,
    years_of_experience: float,
    role_name: str,
) -> List[models.QuestionSeg2]:
    """
    Select Segment 2 questions based on role and experience bracket.
    """
    total = get_config_int(db, "seg2_question_count", 10)
    bracket = get_experience_bracket(db, years_of_experience)
    bracket_id = bracket.id if bracket else None

    # Try role + bracket specific first
    query = db.query(models.QuestionSeg2).filter(
        models.QuestionSeg2.is_active == True
    )

    # Filter by role tag (partial match)
    query = query.filter(
        models.QuestionSeg2.role_tags.contains([role_name])
    )

    pool = query.all()

    if len(pool) < total:
        # Fallback: drop role filter, just use bracket
        fallback_query = db.query(models.QuestionSeg2).filter(
            models.QuestionSeg2.is_active == True,
            ~models.QuestionSeg2.id.in_([q.id for q in pool]),
        )
        if bracket_id:
            fallback_query = fallback_query.filter(
                models.QuestionSeg2.experience_bracket_ids.contains([bracket_id])
            )
        pool += fallback_query.all()

    if len(pool) < total:
        # Final fallback: any active question
        all_ids = {q.id for q in pool}
        remainder = db.query(models.QuestionSeg2).filter(
            models.QuestionSeg2.is_active == True,
            ~models.QuestionSeg2.id.in_(all_ids),
        ).all()
        pool += remainder

    selected = random.sample(pool, min(total, len(pool)))
    random.shuffle(selected)
    return selected[:total]


def select_seg3_questions(db: Session, role_name: str) -> List[models.QuestionSeg3]:
    """Select Segment 3 scenario questions based on role."""
    total = get_config_int(db, "seg3_question_count", 2)

    query = db.query(models.QuestionSeg3).filter(
        models.QuestionSeg3.is_active == True,
        models.QuestionSeg3.role_tags.contains([role_name]),
    )
    pool = query.all()

    if len(pool) < total:
        fallback = db.query(models.QuestionSeg3).filter(
            models.QuestionSeg3.is_active == True,
            ~models.QuestionSeg3.id.in_([q.id for q in pool]),
        ).all()
        pool += fallback

    selected = random.sample(pool, min(total, len(pool)))
    return selected
