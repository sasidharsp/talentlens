from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
from enum import Enum


# ─── AUTH ───
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class RefreshRequest(BaseModel):
    refresh_token: str


# ─── USERS ───
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "interviewer"

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]
    class Config: from_attributes = True


# ─── CANDIDATE REGISTRATION ───
class CandidateRegister(BaseModel):
    full_name: str
    email: EmailStr
    mobile: str
    role_id: int
    years_of_experience: float
    current_organization: Optional[str] = None
    highest_qualification: Optional[str] = None
    linkedin_url: Optional[str] = None

class CandidateOut(BaseModel):
    id: int
    reference_code: str
    full_name: str
    email: str
    mobile: str
    role_id: int
    years_of_experience: float
    current_organization: Optional[str]
    highest_qualification: Optional[str]
    linkedin_url: Optional[str]
    resume_path: Optional[str]
    created_at: datetime
    class Config: from_attributes = True


# ─── ASSESSMENT ───
class AssessmentSessionOut(BaseModel):
    session_token: str
    status: str
    current_segment: int
    class Config: from_attributes = True

class QuestionForCandidate(BaseModel):
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    segment: int
    is_scenario: bool = False
    scenario_text: Optional[str] = None

class SegmentData(BaseModel):
    segment: int
    questions: List[QuestionForCandidate]
    timer_seconds: int

class SaveProgressPayload(BaseModel):
    segment: int
    responses: List[Dict[str, Any]]  # [{question_id, selected_answer, rationale_text, free_text_response}]

class SubmitAssessmentPayload(BaseModel):
    segment: int
    responses: List[Dict[str, Any]]


# ─── QUESTIONS ───
class QuestionSeg1Create(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    difficulty: str
    category: Optional[str] = None
    experience_bracket_ids: Optional[List[int]] = None
    is_active: bool = True

    @field_validator('correct_answer')
    @classmethod
    def validate_answer(cls, v):
        if v.upper() not in ['A', 'B', 'C', 'D']:
            raise ValueError('correct_answer must be A, B, C, or D')
        return v.upper()

    @field_validator('difficulty')
    @classmethod
    def validate_difficulty(cls, v):
        if v.lower() not in ['low', 'medium', 'high']:
            raise ValueError('difficulty must be low, medium, or high')
        return v.lower()

class QuestionSeg1Update(QuestionSeg1Create):
    question_text: Optional[str] = None
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_answer: Optional[str] = None
    difficulty: Optional[str] = None

class QuestionSeg1Out(BaseModel):
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    difficulty: str
    category: Optional[str]
    experience_bracket_ids: Optional[List[int]]
    is_active: bool
    usage_count: int
    created_at: datetime
    updated_at: datetime
    class Config: from_attributes = True


class QuestionSeg2Create(BaseModel):
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    difficulty: str
    category: Optional[str] = None
    role_tags: Optional[List[str]] = None
    skill_tags: Optional[List[str]] = None
    experience_bracket_ids: Optional[List[int]] = None
    is_active: bool = True

    @field_validator('correct_answer')
    @classmethod
    def validate_answer(cls, v):
        if v.upper() not in ['A', 'B', 'C', 'D']:
            raise ValueError('correct_answer must be A, B, C, or D')
        return v.upper()

class QuestionSeg2Update(QuestionSeg2Create):
    question_text: Optional[str] = None
    option_a: Optional[str] = None
    option_b: Optional[str] = None
    option_c: Optional[str] = None
    option_d: Optional[str] = None
    correct_answer: Optional[str] = None
    difficulty: Optional[str] = None

class QuestionSeg2Out(BaseModel):
    id: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    difficulty: str
    category: Optional[str]
    role_tags: Optional[List[str]]
    skill_tags: Optional[List[str]]
    experience_bracket_ids: Optional[List[int]]
    is_active: bool
    usage_count: int
    created_at: datetime
    updated_at: datetime
    class Config: from_attributes = True


class QuestionSeg3Create(BaseModel):
    scenario_text: str
    reference_answer: str
    difficulty: str
    role_tags: Optional[List[str]] = None
    is_active: bool = True

class QuestionSeg3Update(QuestionSeg3Create):
    scenario_text: Optional[str] = None
    reference_answer: Optional[str] = None
    difficulty: Optional[str] = None

class QuestionSeg3Out(BaseModel):
    id: int
    scenario_text: str
    reference_answer: str
    difficulty: str
    role_tags: Optional[List[str]]
    is_active: bool
    usage_count: int
    created_at: datetime
    updated_at: datetime
    class Config: from_attributes = True


# ─── ROLES & BRACKETS ───
class RoleConfigCreate(BaseModel):
    name: str
    is_active: bool = True

class RoleConfigOut(BaseModel):
    id: int
    name: str
    is_active: bool
    class Config: from_attributes = True

class ExperienceBracketCreate(BaseModel):
    label: str
    min_years: float
    max_years: Optional[float] = None
    is_active: bool = True

class ExperienceBracketOut(BaseModel):
    id: int
    label: str
    min_years: float
    max_years: Optional[float]
    is_active: bool
    class Config: from_attributes = True


# ─── CONFIG ───
class ConfigUpdate(BaseModel):
    key: str
    value: str
    description: Optional[str] = None


# ─── INTERVIEW ROUNDS ───
class RoundCreate(BaseModel):
    round_number: int
    interviewer_name: Optional[str] = None
    feedback_text: Optional[str] = None
    score: Optional[int] = None
    outcome: Optional[str] = None
    round_date: Optional[datetime] = None

class RoundOut(BaseModel):
    id: int
    round_number: int
    interviewer_name: Optional[str]
    feedback_text: Optional[str]
    score: Optional[int]
    outcome: Optional[str]
    round_date: Optional[datetime]
    created_at: datetime
    class Config: from_attributes = True


# ─── CANDIDATURE STATUS ───
class StatusUpdate(BaseModel):
    final_status: str
    notes: Optional[str] = None
    assigned_interviewer_id: Optional[int] = None

class StatusOut(BaseModel):
    final_status: str
    notes: Optional[str]
    assigned_interviewer_id: Optional[int]
    class Config: from_attributes = True


# ─── ADMIN CANDIDATE LIST ITEM ───
class CandidateListItem(BaseModel):
    session_id: int
    reference_code: str
    full_name: str
    email: str
    role_name: str
    years_of_experience: float
    submitted_at: Optional[datetime]
    status: str
    seg1_score: Optional[float]
    seg2_score: Optional[float]
    seg3_score: Optional[float]
    overall_score: Optional[float]
    final_status: str

class PaginatedCandidates(BaseModel):
    items: List[CandidateListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── EVALUATION ───
class EvaluationOut(BaseModel):
    seg1_score: Optional[float]
    seg1_correct: Optional[int]
    seg1_total: Optional[int]
    seg2_score: Optional[float]
    seg2_correct: Optional[int]
    seg2_total: Optional[int]
    seg3_score: Optional[float]
    seg3_details: Optional[Any]
    overall_score: Optional[float]
    evaluated_at: Optional[datetime]
    class Config: from_attributes = True
