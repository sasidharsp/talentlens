"""
Evaluator Service
- MCQ scoring for Segment 1 & 2
- LLM-based semantic scoring for Segment 3 (Relevance, Context, Semantics)
"""
import json
import anthropic
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app import models
from app.config import settings


def score_mcq_segment(
    db: Session,
    session_id: int,
    segment_number: int,
    question_model,
) -> Dict[str, Any]:
    """Score a single MCQ segment. Returns correct count, total, and score."""
    responses = db.query(models.SegmentResponse).filter(
        models.SegmentResponse.session_id == session_id,
        models.SegmentResponse.segment_number == segment_number,
    ).all()

    correct = 0
    total = len(responses)

    for resp in responses:
        question = db.query(question_model).filter(question_model.id == resp.question_id).first()
        if question and resp.selected_answer:
            is_correct = resp.selected_answer.upper() == question.correct_answer.upper()
            resp.is_correct = is_correct
            if is_correct:
                correct += 1
        else:
            resp.is_correct = False

    db.commit()
    score = (correct / total * 100) if total > 0 else 0.0
    return {"correct": correct, "total": total, "score": round(score, 2)}


def evaluate_scenario_with_llm(
    candidate_answer: str,
    reference_answer: str,
    scenario_text: str,
) -> Dict[str, Any]:
    """
    Use Claude to evaluate a scenario response on three dimensions:
    - Relevance (0-10): Does the answer address the scenario?
    - Context  (0-10): Does it show domain/industry understanding?
    - Semantics (0-10): Is the meaning aligned with the reference answer?
    Returns a dict with scores and justifications.
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    prompt = f"""You are an expert evaluator for candidate assessment. Evaluate the candidate's answer to the following scenario question.

SCENARIO QUESTION:
{scenario_text}

REFERENCE ANSWER (for evaluator use only):
{reference_answer}

CANDIDATE'S ANSWER:
{candidate_answer if candidate_answer else "[No answer provided]"}

Evaluate the candidate's answer on THREE dimensions. Return ONLY valid JSON in this exact format:
{{
  "relevance": {{
    "score": <integer 0-10>,
    "justification": "<one sentence>"
  }},
  "context": {{
    "score": <integer 0-10>,
    "justification": "<one sentence>"
  }},
  "semantics": {{
    "score": <integer 0-10>,
    "justification": "<one sentence>"
  }},
  "overall_comment": "<two sentences summarizing the answer quality>"
}}

Scoring guide:
- Relevance: How directly does the answer address what was asked? 0=completely off-topic, 10=directly on point
- Context: Does the answer show understanding of the business/domain context? 0=no context awareness, 10=excellent domain insight
- Semantics: How closely does the meaning align with the reference answer? 0=contradicts, 10=fully aligned

Be fair and objective. If no answer was provided, score 0 across all dimensions."""

    try:
        message = client.messages.create(
            model=settings.llm_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        return result
    except Exception as e:
        # Fallback zero scores on error
        return {
            "relevance": {"score": 0, "justification": f"Evaluation error: {str(e)}"},
            "context": {"score": 0, "justification": "Evaluation error"},
            "semantics": {"score": 0, "justification": "Evaluation error"},
            "overall_comment": f"Automated evaluation failed: {str(e)}",
            "error": str(e),
        }


def evaluate_seg3(
    db: Session,
    session_id: int,
    relevance_weight: float = 0.33,
    context_weight: float = 0.33,
    semantics_weight: float = 0.34,
) -> Dict[str, Any]:
    """Evaluate all Segment 3 responses using LLM."""
    responses = db.query(models.SegmentResponse).filter(
        models.SegmentResponse.session_id == session_id,
        models.SegmentResponse.segment_number == 3,
    ).all()

    details = []
    total_score = 0.0
    count = 0

    for resp in responses:
        question = db.query(models.QuestionSeg3).filter(
            models.QuestionSeg3.id == resp.question_id
        ).first()
        if not question:
            continue

        llm_result = evaluate_scenario_with_llm(
            candidate_answer=resp.free_text_response or "",
            reference_answer=question.reference_answer,
            scenario_text=question.scenario_text,
        )

        # Weighted composite per question
        r = llm_result.get("relevance", {}).get("score", 0)
        c = llm_result.get("context", {}).get("score", 0)
        s = llm_result.get("semantics", {}).get("score", 0)
        q_score = (r * relevance_weight + c * context_weight + s * semantics_weight) / 10 * 100

        details.append({
            "question_id": resp.question_id,
            "scenario_text": question.scenario_text[:200] + "...",
            "candidate_answer": resp.free_text_response,
            "llm_evaluation": llm_result,
            "question_score": round(q_score, 2),
        })
        total_score += q_score
        count += 1

    avg_score = round(total_score / count, 2) if count > 0 else 0.0
    return {"score": avg_score, "details": details}


def run_full_evaluation(db: Session, session_id: int, evaluator_user_id: Optional[int] = None):
    """
    Orchestrate full evaluation: MCQ + LLM.
    Creates or updates EvaluationResult record.
    Updates session status to EVALUATED.
    """
    # Load config weights
    def get_weight(key, default):
        cfg = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
        try:
            return float(cfg.value) / 100 if cfg else default
        except Exception:
            return default

    w1 = get_weight("score_weight_seg1", 0.30)
    w2 = get_weight("score_weight_seg2", 0.40)
    w3 = get_weight("score_weight_seg3", 0.30)

    # Segment 1
    seg1 = score_mcq_segment(db, session_id, 1, models.QuestionSeg1)
    # Segment 2
    seg2 = score_mcq_segment(db, session_id, 2, models.QuestionSeg2)
    # Segment 3
    seg3_result = evaluate_seg3(db, session_id)

    overall = (
        seg1["score"] * w1 +
        seg2["score"] * w2 +
        seg3_result["score"] * w3
    )

    # Upsert EvaluationResult
    eval_record = db.query(models.EvaluationResult).filter(
        models.EvaluationResult.session_id == session_id
    ).first()

    if not eval_record:
        eval_record = models.EvaluationResult(session_id=session_id)
        db.add(eval_record)

    eval_record.seg1_score = seg1["score"]
    eval_record.seg1_correct = seg1["correct"]
    eval_record.seg1_total = seg1["total"]
    eval_record.seg2_score = seg2["score"]
    eval_record.seg2_correct = seg2["correct"]
    eval_record.seg2_total = seg2["total"]
    eval_record.seg3_score = seg3_result["score"]
    eval_record.seg3_details = seg3_result["details"]
    eval_record.overall_score = round(overall, 2)
    eval_record.evaluated_at = datetime.utcnow()
    eval_record.evaluated_by = evaluator_user_id

    # Update session status
    session = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.id == session_id
    ).first()
    if session:
        session.status = "EVALUATED"

    db.commit()
    db.refresh(eval_record)
    return eval_record
