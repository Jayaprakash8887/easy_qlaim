"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID
from enum import Enum


class ClaimType(str, Enum):
    REIMBURSEMENT = "REIMBURSEMENT"
    ALLOWANCE = "ALLOWANCE"


class ClaimCategory(str, Enum):
    CERTIFICATION = "CERTIFICATION"
    TRAVEL = "TRAVEL"
    TEAM_LUNCH = "TEAM_LUNCH"
    ONCALL = "ONCALL"
    OVERTIME = "OVERTIME"
    RELOCATION = "RELOCATION"
    INTERNET = "INTERNET"
    MOBILE = "MOBILE"


class ClaimStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    AI_PROCESSING = "AI_PROCESSING"
    PENDING_MANAGER = "PENDING_MANAGER"
    RETURNED_TO_EMPLOYEE = "RETURNED_TO_EMPLOYEE"
    MANAGER_APPROVED = "MANAGER_APPROVED"
    PENDING_HR = "PENDING_HR"
    HR_APPROVED = "HR_APPROVED"
    PENDING_FINANCE = "PENDING_FINANCE"
    FINANCE_APPROVED = "FINANCE_APPROVED"
    SETTLED = "SETTLED"
    REJECTED = "REJECTED"


class PaymentMethod(str, Enum):
    NEFT = "NEFT"
    RTGS = "RTGS"
    CHEQUE = "CHEQUE"
    CASH = "CASH"
    UPI = "UPI"


class UserRole(str, Enum):
    EMPLOYEE = "EMPLOYEE"
    MANAGER = "MANAGER"
    HR = "HR"
    FINANCE = "FINANCE"
    ADMIN = "ADMIN"


# Field Tracking Schemas
class FieldTracking(BaseModel):
    """OCR field tracking"""
    value: Any
    source: str  # OCR, OCR_EDITED, MANUAL
    confidence: float = 1.0
    edited: bool = False
    edit_history: List[Dict[str, Any]] = []
    original_ocr_value: Optional[Any] = None
    ocr_timestamp: Optional[datetime] = None


# Claim Schemas
class ClaimBase(BaseModel):
    claim_type: ClaimType
    category: ClaimCategory
    amount: float = Field(..., gt=0)
    claim_date: date
    description: Optional[str] = None


class ClaimCreate(ClaimBase):
    """Schema for creating a new claim"""
    claim_payload: Dict[str, Any] = {}


class ClaimUpdate(BaseModel):
    """Schema for updating a claim"""
    amount: Optional[float] = Field(None, gt=0)
    claim_date: Optional[date] = None
    description: Optional[str] = None
    claim_payload: Optional[Dict[str, Any]] = None


class ClaimResponse(ClaimBase):
    """Schema for claim response"""
    id: UUID
    claim_number: str
    employee_id: UUID
    employee_name: str
    department: Optional[str]
    status: ClaimStatus
    currency: str
    submission_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    claim_payload: Dict[str, Any]
    return_count: int
    can_edit: bool
    settled: bool
    
    class Config:
        from_attributes = True


class ClaimListResponse(BaseModel):
    """Schema for paginated claim list"""
    total: int
    page: int
    page_size: int
    claims: List[ClaimResponse]


# Employee Schemas
class EmployeeBase(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    date_of_joining: Optional[date] = None
    employee_data: Dict[str, Any] = {}


class EmployeeResponse(EmployeeBase):
    id: UUID
    manager_id: Optional[UUID] = None
    date_of_joining: Optional[date]
    employment_status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str
    roles: List[UserRole] = [UserRole.EMPLOYEE]


class UserResponse(UserBase):
    id: UUID
    roles: List[str]
    is_active: bool
    employee_id: Optional[UUID] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# Document Schemas
class DocumentBase(BaseModel):
    filename: str
    file_type: Optional[str] = None
    document_type: Optional[str] = None


class DocumentCreate(DocumentBase):
    claim_id: UUID
    storage_path: str
    file_size: int


class DocumentResponse(DocumentBase):
    id: UUID
    claim_id: UUID
    storage_path: str
    file_size: int
    ocr_processed: bool
    ocr_confidence: Optional[float] = None
    uploaded_at: datetime
    
    class Config:
        from_attributes = True


# Comment Schemas
class CommentBase(BaseModel):
    comment_text: str
    comment_type: str = "GENERAL"


class CommentCreate(CommentBase):
    claim_id: UUID
    visible_to_employee: bool = True


class CommentResponse(CommentBase):
    id: UUID
    claim_id: UUID
    user_id: UUID
    user_name: str
    user_role: str
    visible_to_employee: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Approval Schemas
class ApprovalBase(BaseModel):
    approval_stage: str
    notes: Optional[str] = None


class ApprovalCreate(ApprovalBase):
    claim_id: UUID


class ApprovalUpdate(BaseModel):
    status: str  # APPROVED, REJECTED, RETURNED
    notes: Optional[str] = None


class ApprovalResponse(ApprovalBase):
    id: UUID
    claim_id: UUID
    approver_id: Optional[UUID]
    approver_name: Optional[str]
    status: str
    decision_date: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Project Schemas
class ProjectBase(BaseModel):
    project_code: str
    project_name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    budget_allocated: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    description: Optional[str] = None
    budget_allocated: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class ProjectResponse(ProjectBase):
    id: UUID
    budget_allocated: Optional[float]
    budget_spent: float
    budget_available: Optional[float]
    status: str
    start_date: Optional[date]
    end_date: Optional[date]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Return to Employee Schema
class ReturnToEmployee(BaseModel):
    claim_id: UUID
    return_reason: str = Field(..., min_length=10)


# Settlement Schema
class SettleClaim(BaseModel):
    claim_id: UUID
    payment_reference: str
    payment_method: PaymentMethod
    amount_paid: float
    settlement_notes: Optional[str] = None


class BulkSettlement(BaseModel):
    claim_ids: List[UUID]
    payment_method: PaymentMethod
    settlement_notes: Optional[str] = None


# HR Correction Schema
class HRCorrection(BaseModel):
    claim_id: UUID
    corrected_claim_type: Optional[ClaimCategory] = None
    type_change_reason: Optional[str] = None
    approved_amount: Optional[float] = None
    amount_adjustment_reason: Optional[str] = None


# Agent Execution Schema
class AgentExecutionCreate(BaseModel):
    claim_id: Optional[UUID] = None
    agent_name: str
    agent_version: Optional[str] = None
    task_id: Optional[str] = None
    started_at: datetime


class AgentExecutionComplete(BaseModel):
    status: str  # SUCCESS, FAILURE
    result_data: Dict[str, Any] = {}
    error_message: Optional[str] = None
    confidence_score: Optional[float] = None
    llm_tokens_used: Optional[int] = None
    execution_time_ms: Optional[int] = None


# Policy Schema
class PolicyBase(BaseModel):
    policy_name: str
    policy_type: str
    category: Optional[str] = None
    policy_text: str


class PolicyCreate(PolicyBase):
    policy_rules: Dict[str, Any] = {}
    version: Optional[str] = "1.0"
    effective_from: date


class PolicyResponse(PolicyBase):
    id: UUID
    version: Optional[str]
    is_active: bool
    effective_from: date
    effective_to: Optional[date]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Dashboard/Analytics Schemas
class ClaimStats(BaseModel):
    total_claims: int
    pending_approval: int
    approved: int
    rejected: int
    total_amount: float
    average_amount: float


class DashboardData(BaseModel):
    stats: ClaimStats
    recent_claims: List[ClaimResponse]
    pending_approvals: List[ClaimResponse]
