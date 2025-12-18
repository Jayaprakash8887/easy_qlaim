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


# NOTE: ClaimCategory is no longer a fixed enum.
# Categories are dynamically loaded from policy_categories table.
# Valid categories depend on the employee's region and claim_type (REIMBURSEMENT/ALLOWANCE).
# Use the /api/v1/policies/categories/active endpoint to get valid categories.


class ClaimStatus(str, Enum):
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
    category: str  # Dynamic - validated against policy_categories table
    amount: float = Field(..., gt=0)
    claim_date: date
    description: Optional[str] = None


class ClaimCreate(ClaimBase):
    """Schema for creating a new claim"""
    claim_payload: Dict[str, Any] = {}
    employee_id: Optional[UUID] = None  # Optional - will use current user if not provided
    title: Optional[str] = None
    vendor: Optional[str] = None
    transaction_ref: Optional[str] = None
    payment_method: Optional[str] = None
    project_code: Optional[str] = None


class BatchClaimItem(BaseModel):
    """Schema for a single claim in a batch"""
    category: str  # Allow any string category
    amount: float = Field(..., gt=0)
    claim_date: date
    title: Optional[str] = None
    vendor: Optional[str] = None
    description: Optional[str] = None
    transaction_ref: Optional[str] = None
    payment_method: Optional[str] = None
    # Field source tracking: 'ocr' for auto-extracted, 'manual' for user-entered
    category_source: Optional[str] = 'manual'
    title_source: Optional[str] = 'manual'
    amount_source: Optional[str] = 'manual'
    date_source: Optional[str] = 'manual'
    vendor_source: Optional[str] = 'manual'
    description_source: Optional[str] = 'manual'
    transaction_ref_source: Optional[str] = 'manual'
    payment_method_source: Optional[str] = 'manual'


class BatchClaimCreate(BaseModel):
    """Schema for creating multiple claims at once"""
    employee_id: UUID
    claim_type: ClaimType = ClaimType.REIMBURSEMENT
    project_code: Optional[str] = None
    claims: List[BatchClaimItem]


class BatchClaimResponse(BaseModel):
    """Response for batch claim creation"""
    success: bool
    total_claims: int
    total_amount: float
    claim_ids: List[UUID]
    claim_numbers: List[str]
    message: str


class ClaimUpdate(BaseModel):
    """Schema for updating a claim"""
    amount: Optional[float] = Field(None, gt=0)
    claim_date: Optional[date] = None
    description: Optional[str] = None
    claim_payload: Optional[Dict[str, Any]] = None
    status: Optional[str] = None  # For resubmission: 'PENDING_MANAGER'
    edited_sources: Optional[List[str]] = None  # Fields edited by user (e.g., ['amount', 'date'])


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
    # Settlement fields
    settled_date: Optional[datetime] = None
    payment_reference: Optional[str] = None
    payment_method: Optional[str] = None
    amount_paid: Optional[float] = None
    category_name: Optional[str] = None  # Human-readable category name from policy_categories
    project_name: Optional[str] = None  # Human-readable project name from projects table
    
    class Config:
        from_attributes = True


class ClaimListResponse(BaseModel):
    """Schema for paginated claim list"""
    total: int
    page: int
    page_size: int
    claims: List[ClaimResponse]


# User Schemas (Unified - combines User and Employee)
class UserBase(BaseModel):
    """Base user schema with common fields"""
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    # Employee fields
    employee_code: Optional[str] = None  # e.g., EMP001
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str
    roles: List[UserRole] = [UserRole.EMPLOYEE]
    date_of_joining: Optional[date] = None
    manager_id: Optional[UUID] = None
    user_data: Dict[str, Any] = {}


class UserUpdate(BaseModel):
    """Schema for updating a user"""
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    region: Optional[str] = None  # Region/location for policy applicability
    roles: Optional[List[UserRole]] = None
    employment_status: Optional[str] = None
    manager_id: Optional[UUID] = None
    user_data: Optional[Dict[str, Any]] = None


class UserResponse(UserBase):
    """Schema for user response"""
    id: UUID
    roles: List[str]
    is_active: bool
    employment_status: Optional[str] = "ACTIVE"
    date_of_joining: Optional[date] = None
    manager_id: Optional[UUID] = None
    region: Optional[str] = None  # Region/location for policy applicability
    user_data: Dict[str, Any] = {}
    created_at: datetime
    
    class Config:
        from_attributes = True


# Employee schemas (extend User schemas)
class EmployeeBase(UserBase):
    """Employee base schema extending UserBase"""
    employee_id: Optional[str] = None  # Maps to employee_code
    
    class Config:
        from_attributes = True


class EmployeeCreate(BaseModel):
    """
    Employee create/update schema.
    Note: Roles are NOT accepted here - they are derived from designation-to-role mappings.
    """
    tenant_id: Optional[UUID] = None  # Tenant ID for multi-tenant isolation
    employee_id: str  # Will be stored as employee_code
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    region: Optional[str] = None  # Region/location for policy applicability
    date_of_joining: Optional[date] = None
    manager_id: Optional[str] = None
    project_ids: Optional[List[str]] = []
    employee_data: Dict[str, Any] = {}




class EmployeeResponse(BaseModel):
    """
    Employee response schema.
    Roles are dynamically resolved from designation-to-role mappings.
    """
    id: UUID
    tenant_id: Optional[UUID] = None
    employee_id: Optional[str] = None  # employee_code
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    manager_id: Optional[UUID] = None
    date_of_joining: Optional[date] = None
    employment_status: str = "ACTIVE"
    region: Optional[str] = None  # Region/location for policy applicability
    roles: List[str] = []  # Dynamically resolved from designation-to-role mappings
    employee_data: Dict[str, Any] = {}
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
    gcs_uri: Optional[str] = None
    gcs_blob_name: Optional[str] = None
    storage_type: str = "local"
    content_type: Optional[str] = None


class DocumentResponse(DocumentBase):
    id: UUID
    claim_id: UUID
    storage_path: str
    file_size: int
    ocr_processed: bool
    ocr_confidence: Optional[float] = None
    uploaded_at: datetime
    gcs_uri: Optional[str] = None
    gcs_blob_name: Optional[str] = None
    storage_type: Optional[str] = "local"
    content_type: Optional[str] = None
    download_url: Optional[str] = None  # Populated dynamically for viewing
    
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
    project_code: Optional[str] = None
    description: Optional[str] = None
    budget_allocated: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    manager_id: Optional[UUID] = None


class ProjectResponse(ProjectBase):
    id: UUID
    budget_allocated: Optional[float]
    budget_spent: float
    budget_available: Optional[float]
    status: str
    start_date: Optional[date]
    end_date: Optional[date]
    manager_id: Optional[UUID]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Return to Employee Schema
class ReturnToEmployee(BaseModel):
    return_reason: str = Field(..., min_length=10)


# Approve/Reject Claim Schema
class ApproveRejectClaim(BaseModel):
    comment: Optional[str] = None


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
    corrected_category: Optional[str] = None  # Dynamic - from policy_categories
    category_change_reason: Optional[str] = None
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


# Employee Project Allocation Schemas
class EmployeeProjectAllocationBase(BaseModel):
    employee_id: UUID
    project_id: UUID
    role: Optional[str] = None
    allocation_percentage: int = 100
    allocated_date: date
    deallocated_date: Optional[date] = None
    notes: Optional[str] = None


class EmployeeProjectAllocationCreate(BaseModel):
    project_id: UUID
    role: Optional[str] = None
    allocation_percentage: int = 100
    allocated_date: Optional[date] = None
    notes: Optional[str] = None


class EmployeeProjectAllocationUpdate(BaseModel):
    role: Optional[str] = None
    allocation_percentage: Optional[int] = None
    deallocated_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class EmployeeProjectAllocationResponse(EmployeeProjectAllocationBase):
    id: UUID
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class EmployeeProjectHistoryResponse(BaseModel):
    """Response model for employee project history with project details"""
    id: UUID
    employee_id: UUID
    project_id: UUID
    project_code: str
    project_name: str
    project_status: str
    role: Optional[str]
    allocation_percentage: int
    status: str  # ACTIVE, COMPLETED, REMOVED
    allocated_date: date
    deallocated_date: Optional[date]
    
    class Config:
        from_attributes = True


# ==================== POLICY MANAGEMENT SCHEMAS ====================

class PolicyStatus(str, Enum):
    PENDING = "PENDING"
    AI_PROCESSING = "AI_PROCESSING"
    EXTRACTED = "EXTRACTED"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"


class CategoryType(str, Enum):
    REIMBURSEMENT = "REIMBURSEMENT"
    ALLOWANCE = "ALLOWANCE"


class FrequencyType(str, Enum):
    ONCE = "ONCE"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"
    UNLIMITED = "UNLIMITED"


class ValidationStatus(str, Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"


# Policy Category Schemas (extracted from policy document)
class PolicyCategoryBase(BaseModel):
    category_name: str = Field(..., min_length=1, max_length=100)
    category_code: str = Field(..., min_length=1, max_length=50)
    category_type: CategoryType
    description: Optional[str] = None
    max_amount: Optional[float] = None
    min_amount: Optional[float] = None
    currency: str = "INR"
    frequency_limit: Optional[str] = None
    frequency_count: Optional[int] = None
    eligibility_criteria: Optional[Dict[str, Any]] = {}
    requires_receipt: bool = True
    requires_approval_above: Optional[float] = None
    allowed_document_types: List[str] = ["PDF", "JPG", "PNG"]
    submission_window_days: Optional[int] = None
    is_active: bool = True
    display_order: int = 0


class PolicyCategoryCreate(PolicyCategoryBase):
    pass


class PolicyCategoryUpdate(BaseModel):
    category_name: Optional[str] = Field(None, min_length=1, max_length=100)
    category_code: Optional[str] = Field(None, min_length=1, max_length=50)
    category_type: Optional[CategoryType] = None
    description: Optional[str] = None
    max_amount: Optional[float] = None
    min_amount: Optional[float] = None
    currency: Optional[str] = None
    frequency_limit: Optional[str] = None
    frequency_count: Optional[int] = None
    eligibility_criteria: Optional[Dict[str, Any]] = None
    requires_receipt: Optional[bool] = None
    requires_approval_above: Optional[float] = None
    allowed_document_types: Optional[List[str]] = None
    submission_window_days: Optional[int] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class PolicyCategoryResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    policy_upload_id: Optional[UUID] = None  # Optional for custom claims which aren't linked to policies
    category_name: str
    category_code: str
    category_type: str
    description: Optional[str]
    max_amount: Optional[float]
    min_amount: Optional[float]
    currency: str
    frequency_limit: Optional[str]
    frequency_count: Optional[int]
    eligibility_criteria: Dict[str, Any]
    requires_receipt: bool
    requires_approval_above: Optional[float]
    allowed_document_types: List[str]
    submission_window_days: Optional[int]
    is_active: bool
    display_order: int
    source_text: Optional[str]
    ai_confidence: Optional[float]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ExtractedClaimListResponse(PolicyCategoryResponse):
    """Schema for listing extracted claims with policy details"""
    policy_name: str
    policy_status: str
    policy_version: Optional[str]
    policy_effective_from: Optional[date]
    policy_region: Optional[str] = None  # Region this policy applies to


# Policy Upload Schemas
class PolicyUploadResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    policy_name: str
    policy_number: str
    description: Optional[str]
    file_name: str
    file_type: str
    file_size: Optional[int]
    storage_path: Optional[str]
    gcs_uri: Optional[str]
    storage_type: str
    content_type: Optional[str] = None
    status: str
    extracted_text: Optional[str]
    extraction_error: Optional[str]
    extracted_at: Optional[datetime]
    extracted_data: Dict[str, Any] = {}
    version: int
    is_active: bool
    replaces_policy_id: Optional[UUID] = None
    effective_from: Optional[date]
    effective_to: Optional[date]
    region: Optional[str] = None  # Region/location this policy applies to
    uploaded_by: UUID
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    review_notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    categories: List[PolicyCategoryResponse] = []
    
    class Config:
        from_attributes = True


class PolicyUploadListResponse(BaseModel):
    id: UUID
    policy_name: str
    policy_number: str
    file_name: str
    status: str
    version: int
    is_active: bool
    effective_from: Optional[date]
    region: Optional[str] = None  # Region/location this policy applies to
    categories_count: int = 0
    uploaded_by: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


class PolicyApprovalRequest(BaseModel):
    review_notes: Optional[str] = None
    effective_from: Optional[date] = None
    approved_by: Optional[UUID] = None  # User ID of approver, defaults to HR Manager
    categories: Optional[List[PolicyCategoryUpdate]] = None  # Optional updates to categories before approval


class PolicyRejectRequest(BaseModel):
    review_notes: str = Field(..., min_length=1)


# Claim Validation Schemas
class ClaimValidationRequest(BaseModel):
    tenant_id: UUID
    category_code: str
    category_type: CategoryType
    amount: float
    currency: str = "INR"
    employee_id: Optional[UUID] = None
    employee_grade: Optional[str] = None
    employee_department: Optional[str] = None
    employee_location: Optional[str] = None
    claim_date: Optional[date] = None
    has_receipt: bool = False
    additional_data: Optional[Dict[str, Any]] = None


class ValidationCheckResult(BaseModel):
    check_name: str
    status: ValidationStatus
    message: str
    details: Optional[Dict[str, Any]] = None


class ClaimValidationResponse(BaseModel):
    status: ValidationStatus
    category_name: str
    category_code: str
    checks: List[ValidationCheckResult] = []
    checks_total: int
    checks_passed: int
    checks_warned: int
    checks_failed: int


# Active Categories Response (for claim submission dropdown)
class ActiveCategoryResponse(BaseModel):
    id: UUID
    category_name: str
    category_code: str
    category_type: str
    description: Optional[str]
    max_amount: Optional[float]
    min_amount: Optional[float]
    currency: str
    requires_receipt: bool
    
    class Config:
        from_attributes = True


# Policy Audit Log Schemas
class PolicyAuditLogResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    entity_type: str
    entity_id: UUID
    action: str
    old_values: Optional[Dict[str, Any]]
    new_values: Optional[Dict[str, Any]]
    description: Optional[str]
    performed_by: UUID
    performed_at: datetime
    
    class Config:
        from_attributes = True


# ==================== CUSTOM CLAIM SCHEMAS ====================
# Custom Claims are standalone claim types not linked to any policy document

class CustomClaimCategoryType(str, Enum):
    """Category type for custom claims"""
    REIMBURSEMENT = "REIMBURSEMENT"
    ALLOWANCE = "ALLOWANCE"


class CustomFieldType(str, Enum):
    """Data types for custom fields"""
    TEXT = "TEXT"
    NUMBER = "NUMBER"
    DATE = "DATE"
    CURRENCY = "CURRENCY"
    DROPDOWN = "DROPDOWN"
    CHECKBOX = "CHECKBOX"
    FILE = "FILE"
    EMAIL = "EMAIL"
    PHONE = "PHONE"


class CustomFieldValidation(BaseModel):
    """Validation rules for custom fields"""
    required: bool = False
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[float] = Field(None, alias="min")
    max_value: Optional[float] = Field(None, alias="max")
    pattern: Optional[str] = None  # Regex pattern for validation
    allowed_values: Optional[List[str]] = None  # For dropdown fields
    
    class Config:
        populate_by_name = True


class CustomFieldDefinition(BaseModel):
    """Definition of a custom field in a custom claim"""
    field_name: str = Field(..., min_length=1, max_length=100, alias="name")
    field_label: str = Field(..., min_length=1, max_length=200, alias="label")
    field_type: str = Field(..., alias="type")
    default_value: Optional[Any] = None
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    options: Optional[List[str]] = []  # For dropdown/select fields
    validation: Optional[CustomFieldValidation] = None
    display_order: int = 0
    required: bool = False
    
    class Config:
        populate_by_name = True


class CustomClaimBase(BaseModel):
    """Base schema for custom claims"""
    claim_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category_type: CustomClaimCategoryType
    region: Optional[str] = None  # Region where this claim type is applicable
    max_amount: Optional[float] = Field(None, ge=0)
    min_amount: Optional[float] = Field(None, ge=0)
    default_amount: Optional[float] = Field(None, ge=0)
    currency: str = "INR"
    frequency_limit: Optional[str] = None  # e.g., "MONTHLY", "YEARLY", "ONCE"
    frequency_count: Optional[int] = Field(None, ge=1)  # Max claims per frequency
    custom_fields: List[CustomFieldDefinition] = []
    eligibility_criteria: Optional[Dict[str, Any]] = None
    requires_receipt: bool = True
    requires_approval_above: Optional[float] = Field(None, ge=0)
    allowed_document_types: List[str] = ["pdf", "jpg", "jpeg", "png"]
    submission_window_days: Optional[int] = Field(None, ge=1)  # Days within which claim must be submitted
    is_active: bool = True
    display_order: int = 0


class CustomClaimCreate(CustomClaimBase):
    """Schema for creating a custom claim"""
    pass


class CustomClaimUpdate(BaseModel):
    """Schema for updating a custom claim"""
    claim_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category_type: Optional[CustomClaimCategoryType] = None
    region: Optional[str] = None
    max_amount: Optional[float] = Field(None, ge=0)
    min_amount: Optional[float] = Field(None, ge=0)
    default_amount: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = None
    frequency_limit: Optional[str] = None
    frequency_count: Optional[int] = Field(None, ge=1)
    custom_fields: Optional[List[CustomFieldDefinition]] = None
    eligibility_criteria: Optional[Dict[str, Any]] = None
    requires_receipt: Optional[bool] = None
    requires_approval_above: Optional[float] = Field(None, ge=0)
    allowed_document_types: Optional[List[str]] = None
    submission_window_days: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class CustomClaimResponse(BaseModel):
    """Full response schema for a custom claim"""
    id: UUID
    tenant_id: UUID
    claim_name: str
    claim_code: str
    description: Optional[str]
    category_type: str
    region: Optional[str]
    max_amount: Optional[float]
    min_amount: Optional[float]
    default_amount: Optional[float]
    currency: str
    frequency_limit: Optional[str]
    frequency_count: Optional[int]
    custom_fields: List[Dict[str, Any]]
    eligibility_criteria: Optional[Dict[str, Any]]
    requires_receipt: bool
    requires_approval_above: Optional[float]
    allowed_document_types: List[str]
    submission_window_days: Optional[int]
    is_active: bool
    display_order: int
    created_by: UUID
    updated_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomClaimListResponse(BaseModel):
    """Simplified list response for custom claims"""
    id: UUID
    claim_name: str
    claim_code: str
    description: Optional[str]
    category_type: str
    region: Optional[str]
    max_amount: Optional[float]
    currency: str
    requires_receipt: bool
    is_active: bool
    fields_count: int
    created_at: datetime

    class Config:
        from_attributes = True

