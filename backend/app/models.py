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
    qadmin = "qadmin"
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
    webcam_photo_path = Column(String(500), nullable=True)
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
    proctoring_status = Column(String(30), default="active")  # active|completed|terminated
    integrity_score = Column(Float, nullable=True)
    violation_count = Column(Integer, default=0)
    termination_reason = Column(String(200), nullable=True)
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
    correct_answer = Column(String(1), nullable=False)
    difficulty = Column(String(10), nullable=False)
    category = Column(String(100), nullable=True)
    batch_tag = Column(String(100), nullable=True, index=True)
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
    batch_tag = Column(String(100), nullable=True, index=True)
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
    batch_tag = Column(String(100), nullable=True, index=True)
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
    ai_recommendation = Column(JSON, nullable=True)  # Full AI recommendation
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


# ─────────────────────────── PROCTORING ───────────────────────────
class ProctorEvent(Base):
    __tablename__ = "proctor_events"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_sessions.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    # tab_switch | fullscreen_exit | gaze_away | paste_attempt | shortcut_attempt
    # right_click | webcam_error | terminated_malpractice | session_start
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    session = relationship("AssessmentSession")


class ProctorSnapshot(Base):
    """Periodic webcam snapshots taken during assessment for AI cheat detection."""
    __tablename__ = "proctor_snapshots"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("assessment_sessions.id"), nullable=False)
    captured_at = Column(DateTime(timezone=True), server_default=func.now())
    thumbnail_b64 = Column(Text, nullable=True)       # compressed JPEG base64 ~5KB
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String(100), nullable=True)  # phone_detected|person_absent|looking_away
    analysis = Column(JSON, nullable=True)            # full Claude Vision JSON response
    session = relationship("AssessmentSession")


# ─────────────────────────── INSTRUCTION VERSIONS ───────────────────────────
class InstructionVersion(Base):
    __tablename__ = "instruction_versions"
    id = Column(Integer, primary_key=True, index=True)
    instruction_type = Column(String(50), nullable=False)  # pre_assessment | post_completion
    content = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    creator = relationship("User")


# ─────────────────────────── ROUND 2 ───────────────────────────


class SiteContent(Base):
    """Editable page content — key/JSON pairs for About and Architecture pages."""
    __tablename__ = "site_content"
    id         = Column(Integer, primary_key=True)
    key        = Column(String(100), unique=True, nullable=False, index=True)
    content    = Column(JSON, nullable=False, default=lambda: {})
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class ProctoringConfig(Base):
    """Single-row global proctoring settings. Admins edit via /admin/proctoring-config."""
    __tablename__ = "proctoring_config"
    id               = Column(Integer, primary_key=True)
    enabled          = Column(Boolean, default=True)
    max_weight       = Column(Integer, default=60)
    grace_frames     = Column(Integer, default=12)
    cooldown_ms      = Column(Integer, default=15000)
    audio_rms        = Column(Float,   default=72.0)
    audio_hold_ms    = Column(Integer, default=9000)
    phone_confidence = Column(Float,   default=0.65)
    phone_frames     = Column(Integer, default=5)
    phone_term_count = Column(Integer, default=3)
    gaze_h           = Column(Float,   default=0.20)
    gaze_v_up        = Column(Float,   default=0.14)
    gaze_v_down      = Column(Float,   default=0.24)
    head_thresh      = Column(Float,   default=0.16)
    snap_ms          = Column(Integer, default=10000)
    violation_weights = Column(JSON,   default=lambda: {
        "phone_detected":5,"multiple_faces":4,"devtools_open":4,
        "copy_attempt":3,"paste_attempt":3,"tab_switch":3,
        "keyboard_shortcut":2,"fullscreen_exit":2,"face_not_detected":1,
        "audio_detected":0,"gaze_away":0,"head_turn":0,
        "eyes_closed":0,"window_blur":0,
    })
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class InPersonQuestion(Base):
    __tablename__ = "inperson_questions"
    id         = Column(Integer, primary_key=True, index=True)
    question   = Column(Text, nullable=False)
    answer     = Column(Text, nullable=False)
    tag        = Column(String(100), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    creator    = relationship("User", foreign_keys=[created_by])


class Round2Question(Base):
    __tablename__ = "round2_questions"
    id = Column(Integer, primary_key=True, index=True)
    scenario_text = Column(Text, nullable=False)
    reference_answer = Column(Text, nullable=False)
    difficulty = Column(String(10), default='high')
    category = Column(String(100), nullable=True)
    batch_tag = Column(String(100), nullable=True, index=True)
    domain_tag = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Round2Session(Base):
    __tablename__ = "round2_sessions"
    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    session_token = Column(String(100), unique=True, index=True, nullable=False)
    status = Column(String(30), default="INVITED")  # INVITED/IN_PROGRESS/SUBMITTED/EVALUATED
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    invited_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    proctoring_status = Column(String(30), default="active")
    integrity_score = Column(Float, nullable=True)
    violation_count = Column(Integer, default=0)
    termination_reason = Column(String(200), nullable=True)
    candidate = relationship("Candidate")
    inviter = relationship("User", foreign_keys=[invited_by])


class Round2Response(Base):
    __tablename__ = "round2_responses"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("round2_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("round2_questions.id"), nullable=False)
    question_order = Column(Integer, default=1)
    free_text_response = Column(Text, nullable=True)
    session = relationship("Round2Session")
    question = relationship("Round2Question")


class Round2Evaluation(Base):
    __tablename__ = "round2_evaluations"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("round2_sessions.id"), unique=True)
    question_details = Column(JSON, nullable=True)
    overall_score = Column(Float, nullable=True)
    ai_recommendation = Column(JSON, nullable=True)
    evaluated_at = Column(DateTime(timezone=True), nullable=True)
    session = relationship("Round2Session")


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
