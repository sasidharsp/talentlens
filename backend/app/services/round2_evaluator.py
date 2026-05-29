"""
Round 2 Evaluation Service
Evaluates 5 open-ended responses with cross-round context.
"""
import json, anthropic
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app import models
from app.config import settings


def evaluate_r2_response(
    candidate_answer: str,
    scenario_text: str,
    reference_answer: str,
    role_context: str = "",
) -> dict:
    """Score a single R2 response. Returns score/rationale/strengths/gaps/pending_review."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    role_line = f"\nRole context: {role_context}" if role_context else ""

    prompt = f"""You are a senior BFSI interview panellist conducting a second-round assessment.{role_line}

This is a structured second round for candidates who passed the initial screening.
Evaluate the response with higher standards — look for depth, structure, and practical experience.

Scenario: {scenario_text}

Expected Answer / Rubric: {reference_answer}

Candidate Response: {candidate_answer or "[No response provided]"}

Return ONLY valid JSON:
{{
  "score": <integer 0-10>,
  "rationale": "<2-3 sentences — be specific, reference exact concepts mentioned or missing>",
  "strengths": ["<concrete strength 1>", "<concrete strength 2>"],
  "gaps": ["<specific gap 1>", "<specific gap 2>", "<specific gap 3>"]
}}

Scoring (round 2 standards — stricter):
0=no attempt, 1-2=very weak, 3-4=below expectations, 5-6=meets basic bar,
7-8=solid for this role, 9-10=impressive depth and clarity."""

    try:
        msg = client.messages.create(
            model=settings.llm_model, max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = msg.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"): raw = raw[4:]
        result = json.loads(raw.strip())
        result["pending_review"] = False
        return result
    except Exception as e:
        return {"score": None, "rationale": f"Evaluation failed: {e}",
                "strengths": [], "gaps": [], "pending_review": True}


def run_r2_evaluation(db: Session, r2_session_id: int):
    """
    Full Round 2 evaluation:
    1. Score all 5 responses with role context
    2. Generate AI recommendation comparing R1 and R2 performance
    3. Save results and update session status
    """
    r2_session = db.query(models.Round2Session).filter_by(id=r2_session_id).first()
    if not r2_session: return

    candidate = r2_session.candidate

    # Role context
    role_context = ""
    if candidate.requisition:
        req = candidate.requisition
        parts = [req.title]
        if req.department: parts.append(req.department)
        if req.description: parts.append(req.description[:250])
        role_context = " — ".join(parts)
    if candidate.years_of_experience:
        role_context += f" ({candidate.years_of_experience}y exp)"

    # Evaluate each response
    responses = db.query(models.Round2Response)\
        .filter_by(session_id=r2_session_id)\
        .order_by(models.Round2Response.question_order)\
        .all()

    details = []
    total, count = 0.0, 0
    for resp in responses:
        q = db.query(models.Round2Question).filter_by(id=resp.question_id).first()
        if not q: continue
        res = evaluate_r2_response(
            candidate_answer=resp.free_text_response or "",
            scenario_text=q.scenario_text,
            reference_answer=q.reference_answer,
            role_context=role_context,
        )
        q_score = (res.get("score") or 0) / 10 * 100 if not res["pending_review"] else 0
        details.append({
            "question_order": resp.question_order,
            "question_id": resp.question_id,
            "scenario_text": q.scenario_text[:200] + "...",
            "candidate_answer": resp.free_text_response,
            "score": res.get("score"),
            "rationale": res.get("rationale",""),
            "strengths": res.get("strengths",[]),
            "gaps": res.get("gaps",[]),
            "pending_review": res["pending_review"],
            "question_score": round(q_score, 2),
        })
        total += q_score; count += 1

    overall_score = round(total / count, 2) if count else 0

    # Upsert evaluation record
    eval_rec = db.query(models.Round2Evaluation).filter_by(session_id=r2_session_id).first()
    if not eval_rec:
        eval_rec = models.Round2Evaluation(session_id=r2_session_id)
        db.add(eval_rec)

    eval_rec.question_details = details
    eval_rec.overall_score = overall_score
    eval_rec.evaluated_at = datetime.utcnow()

    r2_session.status = "EVALUATED"
    db.commit()
    db.refresh(eval_rec)

    # Generate cross-round AI recommendation
    try:
        _generate_r2_recommendation(db, r2_session, eval_rec, role_context, details)
    except Exception:
        pass


def _generate_r2_recommendation(db, r2_session, eval_rec, role_context: str, details: list):
    """Generate AI recommendation with R1 vs R2 cross-round context."""
    candidate = r2_session.candidate

    # Pull R1 data for context
    r1_eval = db.query(models.EvaluationResult)\
        .join(models.AssessmentSession)\
        .filter(models.AssessmentSession.candidate_id == candidate.id)\
        .order_by(models.EvaluationResult.evaluated_at.desc())\
        .first()

    r1_context = ""
    if r1_eval:
        r1_rec = r1_eval.ai_recommendation or {}
        r1_context = f"""
ROUND 1 PERFORMANCE (for cross-round comparison)
Round 1 Overall Score: {r1_eval.overall_score:.1f}%
  Segment 1 (Knowledge): {r1_eval.seg1_score:.1f}%
  Segment 2 (Role Fit): {r1_eval.seg2_score:.1f}%
  Segment 3 (Scenarios): {r1_eval.seg3_score:.1f}%
Round 1 AI Verdict: {r1_rec.get('recommendation','N/A')} ({r1_rec.get('confidence','')})
Round 1 Summary: {r1_rec.get('summary','Not available')[:300]}"""

    # R2 question summaries
    q_summary = "\n".join(
        f"Q{d['question_order']}: {d.get('score','?')}/10 — {d.get('rationale','')[:150]}"
        for d in details
    )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    prompt = f"""You are a senior BFSI hiring panel evaluating a Round 2 candidate.
Role: {role_context or "BFSI Professional"}
Candidate: {candidate.full_name} | {candidate.years_of_experience or 0} yrs exp

ROUND 2 PERFORMANCE
Overall Score: {eval_rec.overall_score:.1f}%
Question Scores:
{q_summary}
{r1_context}

Based on the complete two-round picture, provide a final hiring recommendation.
Return ONLY valid JSON:
{{
  "recommendation": "HIRE"|"STRONG_HOLD"|"HOLD"|"REJECT",
  "confidence": "HIGH"|"MEDIUM"|"LOW",
  "summary": "3-4 sentence executive summary covering both rounds",
  "r1_vs_r2": "One sentence comparing performance across rounds — improvement, consistency, or decline",
  "key_observations": ["obs1","obs2","obs3","obs4"],
  "strengths": ["s1","s2","s3"],
  "development_areas": ["d1","d2","d3"],
  "risk_assessment": "Hiring risk narrative",
  "final_recommendation_rationale": "Why this hire/hold/reject decision specifically",
  "suggested_role_level": "Based on performance, what level/band suits this candidate",
  "onboarding_focus": ["focus1","focus2"] 
}}"""

    msg = client.messages.create(
        model=settings.llm_model, max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = msg.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"): raw = raw[4:]
    rec = json.loads(raw.strip())

    rec["r1_score"] = r1_eval.overall_score if r1_eval else None
    rec["r2_score"] = eval_rec.overall_score
    rec["generated_at"] = datetime.utcnow().isoformat()
    rec["generated_by"] = "Auto-generated"

    eval_rec.ai_recommendation = rec
    db.commit()
