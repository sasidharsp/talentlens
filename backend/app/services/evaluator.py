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
    question_prompt: str = "",
    role_context: str = "",
) -> Dict[str, Any]:
    """
    Use Claude to evaluate a scenario response.
    role_context: e.g. "Senior Java Developer (BFSI) — Spring Boot, Microservices, Kafka"
    Returns: { score, rationale, strengths, gaps, pending_review }
    On failure: marks as pending_review instead of erroring out.
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    role_section = f"""
ROLE CONTEXT
The candidate is applying for: {role_context}
Evaluate their answer specifically against what someone in this role should know and demonstrate.
Adjust your scoring benchmark accordingly — a senior role demands more depth, precision, and domain expertise.
""" if role_context else ""

    system_prompt = f"You are an expert BFSI assessor evaluating candidate responses for professional roles.{(' The role being assessed is: ' + role_context + '.') if role_context else ''}"

    user_prompt = f"""Evaluate the candidate's answer against the ideal answer and rubric provided.
{role_section}
Scenario: {scenario_text}

Question: {question_prompt or "Respond to the scenario above."}

Ideal Answer / Rubric: {reference_answer}

Candidate Answer: {candidate_answer if candidate_answer else "[No answer provided]"}

Return ONLY valid JSON in this exact format:
{{
  "score": <integer 0-10>,
  "rationale": "<2-3 sentences explaining the score in context of the role>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "gaps": ["<gap 1>", "<gap 2>"]
}}

Scoring: 0=no attempt, 1-3=poor, 4-6=adequate, 7-8=good, 9-10=excellent.
Score relative to what is expected for {role_context or "a BFSI professional"}.
Be specific — name the exact concepts, tools, or approaches that were present or missing."""

    try:
        message = client.messages.create(
            model=settings.llm_model,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        result["pending_review"] = False
        return result
    except Exception as e:
        return {
            "score": None,
            "rationale": f"Automated evaluation failed: {str(e)}",
            "strengths": [],
            "gaps": [],
            "pending_review": True,
            "error": str(e),
        }


def evaluate_seg3(
    db: Session,
    session_id: int,
    role_context: str = "",
) -> Dict[str, Any]:
    """Evaluate all Segment 3 responses using LLM with role context."""
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
            role_context=role_context,
        )

        # Handle pending review case
        if llm_result.get("pending_review"):
            q_score = 0.0
        else:
            raw_score = llm_result.get("score") or 0
            q_score = (raw_score / 10) * 100

        details.append({
            "question_id": resp.question_id,
            "scenario_text": question.scenario_text[:200] + "...",
            "candidate_answer": resp.free_text_response,
            "score": llm_result.get("score"),
            "rationale": llm_result.get("rationale", ""),
            "strengths": llm_result.get("strengths", []),
            "gaps": llm_result.get("gaps", []),
            "pending_review": llm_result.get("pending_review", False),
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

    # Build role context for Level 2 contextualised evaluation
    session = db.query(models.AssessmentSession).filter_by(id=session_id).first()
    role_context = ""
    if session and session.candidate:
        candidate = session.candidate
        if candidate.requisition:
            req = candidate.requisition
            parts = [f"{req.title}"]
            if req.department: parts.append(req.department)
            if req.description: parts.append(req.description[:300])
            role_context = " — ".join(parts)
        elif candidate.role:
            role_context = candidate.role.name
        if candidate.years_of_experience:
            role_context += f" ({candidate.years_of_experience} years experience)"

    # Segment 1
    seg1 = score_mcq_segment(db, session_id, 1, models.QuestionSeg1)
    # Segment 2
    seg2 = score_mcq_segment(db, session_id, 2, models.QuestionSeg2)
    # Segment 3 — with role context
    seg3_result = evaluate_seg3(db, session_id, role_context=role_context)

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
    session_rec = db.query(models.AssessmentSession).filter(
        models.AssessmentSession.id == session_id
    ).first()
    if session_rec:
        session_rec.status = "EVALUATED"

    db.commit()
    db.refresh(eval_record)

    # ── Auto-generate AI recommendation in background ──
    try:
        _auto_recommend(db, session_id, eval_record, role_context, evaluator_user_id)
    except Exception:
        pass  # Never block evaluation if recommendation fails

    return eval_record


def _auto_recommend(db, session_id: int, eval_record, role_context: str, evaluator_user_id: Optional[int]):
    """
    Automatically generate AI recommendation after evaluation.
    Runs synchronously but exceptions are swallowed so they never block.
    """
    import json as json_lib
    import anthropic as anthropic_sdk
    from datetime import timedelta

    session = db.query(models.AssessmentSession).filter_by(id=session_id).first()
    if not session or not session.candidate:
        return

    candidate = session.candidate

    # Cohort stats
    from sqlalchemy import func as sqlfunc
    cohort = db.query(
        sqlfunc.avg(models.EvaluationResult.overall_score).label("avg"),
        sqlfunc.count(models.EvaluationResult.id).label("total"),
    ).first()
    cohort_avg   = round(cohort.avg or 0, 1)
    cohort_total = max(cohort.total or 1, 1)

    below_count = db.query(models.EvaluationResult).filter(
        models.EvaluationResult.overall_score < (eval_record.overall_score or 0)
    ).count()
    percentile = round((below_count / cohort_total) * 100)
    pass_count = db.query(models.EvaluationResult).filter(
        models.EvaluationResult.overall_score >= 70
    ).count()
    pass_rate = round(pass_count / cohort_total * 100)

    # Seg 2 rationale samples
    seg2_rationales = db.query(models.SegmentResponse).filter(
        models.SegmentResponse.session_id == session_id,
        models.SegmentResponse.segment_number == 2,
        models.SegmentResponse.rationale_text.isnot(None),
        models.SegmentResponse.rationale_text != "",
    ).limit(3).all()
    rationale_samples = [r.rationale_text for r in seg2_rationales if r.rationale_text]

    # Seg 3 summary
    seg3_summary = []
    for i, det in enumerate(eval_record.seg3_details or [], 1):
        if det.get("pending_review"):
            seg3_summary.append(f"Q{i}: Pending manual review")
        else:
            seg3_summary.append(
                f"Q{i}: {det.get('score',0)}/10 — {det.get('rationale','')[:200]}"
            )

    role_label = candidate.requisition.title if candidate.requisition else (
        candidate.role.name if candidate.role else "BFSI Professional"
    )

    prompt = f"""You are an expert BFSI talent assessor. Provide a concise hiring recommendation.

CANDIDATE: {candidate.full_name} | {role_label} | {candidate.years_of_experience or 0} yrs exp

SCORES: Seg1={eval_record.seg1_score:.1f}% ({eval_record.seg1_correct}/{eval_record.seg1_total}) | Seg2={eval_record.seg2_score:.1f}% ({eval_record.seg2_correct}/{eval_record.seg2_total}) | Seg3={eval_record.seg3_score:.1f}% | Overall={eval_record.overall_score:.1f}%

SEG2 RATIONALE SAMPLES: {chr(10).join(f'• "{r}"' for r in rationale_samples) if rationale_samples else "None provided"}

SEG3 ANALYSIS: {chr(10).join(seg3_summary) if seg3_summary else "No scenario responses"}

COHORT: {cohort_total} evaluated | Average={cohort_avg}% | This candidate={percentile}th percentile | Pass rate={pass_rate}%

ROLE CONTEXT: {role_context or role_label}

Return ONLY this JSON:
{{
  "recommendation": "SHORTLIST"|"HOLD"|"REJECT",
  "confidence": "HIGH"|"MEDIUM"|"LOW",
  "summary": "2-3 sentence executive summary",
  "key_observations": ["obs1","obs2","obs3","obs4"],
  "strengths": ["s1","s2","s3"],
  "development_areas": ["d1","d2","d3"],
  "risk_assessment": "Brief risk assessment",
  "interview_focus": ["f1","f2","f3"],
  "cohort_standing": "One sentence comparative summary",
  "score_interpretation": "What the score pattern reveals"
}}"""

    client = anthropic_sdk.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model=settings.llm_model,
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
    rec = json_lib.loads(raw.strip())

    # Enrich with cohort data
    rec["cohort_data"] = {
        "total_evaluated": cohort_total,
        "cohort_average": cohort_avg,
        "percentile": percentile,
        "pass_rate": pass_rate,
        "candidate_score": round(eval_record.overall_score, 1),
    }
    rec["generated_at"] = datetime.utcnow().isoformat()
    rec["generated_by"] = "Auto-generated"

    eval_record.ai_recommendation = rec
    db.commit()
