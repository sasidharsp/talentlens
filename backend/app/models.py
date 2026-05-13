from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    interviewer = "interviewer"


class AssessmentStatus(str, enum.Enum):
    REGISTERED = "REGISTERED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    EVALUATED = "EVALUATED"


class FinalStatus(str, enum.Enum):
    pending = "pending"
    selected = "selected"
    rejected = "rejected"
    on_hold = "on_hold"


# ─────────────────────────── USERS ───────────────────────────
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.interviewer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)


# ─────────────────────────── SYSTEM CONFIG ───────────────────────────
class SystemConfig(Base):
    __tablename__ = "system_config"
    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)


# ─────────────────────────── ROLES CONFIG ───────────────────────────
class RoleConfig(Base):
    __tablename__ = "roles_config"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────── EXPERIENCE BRACKETS ───────────────────────────
class ExperienceBracket(Base):
    __tablename__ = "experience_brackets"
    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(50), nullable=False)
    min_years = Column(Float, nullable=False)
    max_years = Column(Float, nullable=True)  # null = no upper limit
    is_active = Column(Boolean, default=True)


# ─────────────────────────── REQUISITIONS ───────────────────────────
class Requisition(Base):
    __tablename__ = "requisitions"
    id = Column(Integer, primary_key=True, index=True)
    req_id = Column(String(50), unique=True, nullable=False, index=True)  # e.g. REQ-2024-001
    title = Column(String(255), nullable=False)                           # e.g. Senior Java Developer
    department = Column(String(100), nullable=True)
    location = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    candidates = relationship("Candidate", back_populates="requisition")


# ─────────────────────────── CANDIDATES ───────────────────────────
class Candidate(Base):
    __tablename__ = "candidates"
    id = Column(Integer, primary_key=True, index=True)
    reference_code = Column(String(20), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    mobile = Column(String(20), nullable=False)
    role_id = Column(Integer, ForeignKey("roles_config.id"), nullable=True)   # kept for legacy
    requisition_id = Column(Integer, ForeignKey("requisitions.id"), nullable=True)
    years_of_experience = Column(Float, nullable=False)
    current_organization = Column(String(255), nullable=True)
    highest_qualification = Column(String(255), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    resume_path = Column(String(500), nullable=True)
    resume_original_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    role = relationship("RoleConfig")
    requisition = relationship("Requisition", back_populates="candidates")
    sessions = relationship("AssessmentSession", back_populates="candidate")


# ─────────────────────────── ASSESSMENT SESSIONS ───────────────────────────
class AssessmentSession(Base):
    __tablename__ = "assessment_sessions"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    session_token = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(String(20), default="REGISTERED")
    current_segment = Column(Integer, default=0)  # 0=not started, 1,2,3
    instructions_accepted_at = Column(DateTime(timezone=True), nullable=True)
    seg1_start_time = Column(DateTime(timezone=True), nullable=True)
    seg1_end_time = Column(DateTime(timezone=True), nullable=True)
    seg2_start_time = Column(DateTime(timezone=True), nullable=True)
    seg2_end_time = Column(DateTime(timezone=True), nullable=True)
    seg3_start_time = Column(DateTime(timezone=True), nullable=True)
    seg3_end_time = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate", back_populates="sessions")
    responses = relationship("SegmentResponse", back_populates="session")
    evaluation = relationship("EvaluationResult", back_populates="session", uselist=False)
    rounds = relationship("InterviewRound", back_populates="session", order_by="InterviewRound.round_number")
    status_record = relationship("CandidatureStatus", back_populates="session", uselist=False)


# ─────────────────────────── SEGMENT QUESTION BANKS ───────────────────────────
class QuestionSeg1(Base):
    """Experience-based MCQ bank — Segment 1"""
    __tablename__ = "questions_seg1"
    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_answer = Column(String(1), nullable=False)  # A/B/C/D
    difficulty = Column(String(10), nullable=False)      # low/medium/high
    category = Column(String(100), nullable=True)
    experience_bracket_ids = Column(ARRAY(Integer), nullable=True)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class QuestionSeg2(Base):
    """Role & Skills MCQ bank — Segment 2"""
    __tablename__ = "questions_seg2"
    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    option_a = Column(Text, nullable=False)
    option_b = Column(Text, nullable=False)
    option_c = Column(Text, nullable=False)
    option_d = Column(Text, nullable=False)
    correct_answer = Column(String(1), nullable=False)
    difficulty = Column(String(10), nullable=False)
    category = Column(String(100), nullable=True)
    role_tags = Column(ARRAY(String), nullable=True)
    skill_tags = Column(ARRAY(String), nullable=True)
    experience_bracket_ids = Column(ARRAY(Integer), nullable=True)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class QuestionSeg3(Base):
    """Scenario-based open-text bank — Segment 3"""
    __tablename__ = "questions_seg3"
    id = Column(Integer, primary_key=True, index=True)
    scenario_text = Column(Text, nullable=False)
    reference_answer = Column(Text, nullable=False)
    difficulty = Column(String(10), nullable=False)
    role_tags = Column(ARRAY(String), nullable=True)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ─────────────────────────── SEGMENT RESPONSES ───────────────────────────
class SegmentResponse(Base):
    __tablename__ = "segment_responses"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_sessions.id"), nullable=False)
    segment_number = Column(Integer, nullable=False)   # 1, 2, 3
    question_id = Column(Integer, nullable=False)      # FK into respective question table
    selected_answer = Column(String(1), nullable=True) # A/B/C/D for MCQ
    rationale_text = Column(Text, nullable=True)       # Seg 2 optional rationale
    free_text_response = Column(Text, nullable=True)   # Seg 3 scenario answer
    is_correct = Column(Boolean, nullable=True)        # Populated during evaluation
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("AssessmentSession", back_populates="responses")


# ─────────────────────────── EVALUATION RESULTS ───────────────────────────
class EvaluationResult(Base):
    __tablename__ = "evaluation_results"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_sessions.id"), unique=True, nullable=False)
    seg1_score = Column(Float, nullable=True)
    seg1_correct = Column(Integer, nullable=True)
    seg1_total = Column(Integer, nullable=True)
    seg2_score = Column(Float, nullable=True)
    seg2_correct = Column(Integer, nullable=True)
    seg2_total = Column(Integer, nullable=True)
    seg3_score = Column(Float, nullable=True)
    seg3_details = Column(JSON, nullable=True)   # Per-question LLM breakdown
    overall_score = Column(Float, nullable=True)
    evaluated_at = Column(DateTime(timezone=True), nullable=True)
    evaluated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    session = relationship("AssessmentSession", back_populates="evaluation")


# ─────────────────────────── INTERVIEW ROUNDS ───────────────────────────
class InterviewRound(Base):
    __tablename__ = "interview_rounds"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_sessions.id"), nullable=False)
    round_number = Column(Integer, nullable=False)  # 2, 3, 4 (round 1 = assessment)
    interviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    interviewer_name = Column(String(255), nullable=True)
    feedback_text = Column(Text, nullable=True)
    score = Column(Integer, nullable=True)           # 1–10
    outcome = Column(String(20), nullable=True)       # proceed / reject / hold
    round_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    session = relationship("AssessmentSession", back_populates="rounds")


# ─────────────────────────── CANDIDATURE STATUS ───────────────────────────
class CandidatureStatus(Base):
    __tablename__ = "candidature_status"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_sessions.id"), unique=True, nullable=False)
    final_status = Column(String(20), default="pending")
    notes = Column(Text, nullable=True)
    assigned_interviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    session = relationship("AssessmentSession", back_populates="status_record")


# ─────────────────────────── AUDIT LOG ───────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=True)
    resource_id = Column(String(50), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
