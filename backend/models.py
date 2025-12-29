"""
Database models using SQLAlchemy ORM for PostgreSQL
"""
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date, Text, 
    Numeric, ForeignKey, Index, CheckConstraint, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime

Base = declarative_base()


# ==================== MULTI-TENANT SAAS MODELS ====================

class Tenant(Base):
    """
    Organization/Company entity for multi-tenancy.
    Each tenant represents a customer organization using the platform.
    """
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Tenant identification
    name = Column(String(255), nullable=False)  # Full company name
    code = Column(String(50), unique=True, nullable=False)  # Short code, e.g., "TARENTO"
    domain = Column(String(255))  # Optional email domain for auto-association
    
    # Settings
    settings = Column(JSONB, default={})  # Tenant-specific configurations
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    designations = relationship("Designation", back_populates="tenant", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_tenants_code", "code"),
        Index("idx_tenants_active", "is_active"),
        Index("idx_tenants_domain", "domain"),
    )


class Designation(Base):
    """
    Tenant-specific job titles/designations.
    Used for mapping to application roles.
    """
    __tablename__ = "designations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Designation details
    name = Column(String(100), nullable=False)  # e.g., "Senior Project Manager"
    code = Column(String(50), nullable=False)   # e.g., "SR_PM"
    description = Column(Text)
    
    # Hierarchy
    level = Column(Integer, default=0)  # For organizational hierarchy if needed
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="designations")
    role_mappings = relationship("DesignationRoleMapping", back_populates="designation", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_designations_tenant", "tenant_id"),
        Index("idx_designations_name", "name"),
        Index("idx_designations_code", "code"),
        Index("idx_designations_active", "is_active"),
        Index("idx_designations_tenant_name", "tenant_id", "name"),
    )


class DesignationRoleMapping(Base):
    """
    Maps designations to application roles (tenant-specific).
    A designation can have multiple role mappings.
    Note: SYSTEM_ADMIN role is excluded - it's platform-level only.
    """
    __tablename__ = "designation_role_mappings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    designation_id = Column(UUID(as_uuid=True), ForeignKey("designations.id"), nullable=False)
    
    # Application role (EMPLOYEE, MANAGER, HR, FINANCE, ADMIN)
    # Note: SYSTEM_ADMIN is NOT allowed here - it's platform-level only
    role = Column(String(50), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    designation = relationship("Designation", back_populates="role_mappings")
    
    __table_args__ = (
        CheckConstraint(
            "role IN ('EMPLOYEE', 'MANAGER', 'HR', 'FINANCE', 'ADMIN')",
            name="valid_designation_role"
        ),
        Index("idx_designation_roles_tenant", "tenant_id"),
        Index("idx_designation_roles_designation", "designation_id"),
        Index("idx_designation_roles_role", "role"),
    )


class IBU(Base):
    """
    Independent Business Unit for organizational reporting.
    Projects can be tagged to IBUs for IBU-level claim reporting.
    """
    __tablename__ = "ibus"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # IBU identification
    code = Column(String(50), nullable=False)  # Short code, e.g., "IBU-TECH", "IBU-FIN"
    name = Column(String(255), nullable=False)  # Full name, e.g., "Technology Services"
    description = Column(Text)
    
    # IBU head/manager
    head_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Budget tracking
    annual_budget = Column(Numeric(14, 2))
    budget_spent = Column(Numeric(14, 2), default=0)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Additional metadata
    extra_data = Column(JSONB, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_ibu_tenant_code"),
        Index("idx_ibus_tenant", "tenant_id"),
        Index("idx_ibus_code", "code"),
        Index("idx_ibus_active", "is_active"),
        Index("idx_ibus_head", "head_id"),
    )


class Department(Base):
    """
    Tenant-specific departments for organizational structure.
    Used for employee assignment and claim categorization.
    """
    __tablename__ = "departments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Department identification
    code = Column(String(50), nullable=False)  # Short code, e.g., "ENGG", "HR"
    name = Column(String(255), nullable=False)  # Full name, e.g., "Engineering"
    description = Column(Text)
    
    # Department head
    head_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Display order for UI
    display_order = Column(Integer, default=0)
    
    # Additional metadata
    extra_data = Column(JSONB, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_department_tenant_code"),
        Index("idx_departments_tenant", "tenant_id"),
        Index("idx_departments_code", "code"),
        Index("idx_departments_name", "name"),
        Index("idx_departments_active", "is_active"),
        Index("idx_departments_head", "head_id"),
    )


class Claim(Base):
    """Main claims table with OCR tracking, HR corrections, return workflow"""
    __tablename__ = "claims"
    
    # Identity
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    claim_number = Column(String(50), unique=True, nullable=False)
    
    # Employee & Claim Info
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    employee_name = Column(String(255), nullable=False)
    department = Column(String(100))
    claim_type = Column(String(20), nullable=False)  # REIMBURSEMENT or ALLOWANCE
    category = Column(String(50), nullable=False)  # CERTIFICATION, TRAVEL, TEAM_LUNCH, ONCALL
    
    # Financial
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="INR")
    
    # Status & Workflow
    status = Column(String(50), nullable=False, default="PENDING_MANAGER")
    
    # Dates
    submission_date = Column(DateTime(timezone=True))
    claim_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Description
    description = Column(Text)
    
    # Complete claim payload (JSONB for flexibility)
    claim_payload = Column(JSONB, nullable=False, default={})
    
    # OCR extracted text for full-text search
    ocr_text = Column(Text)
    
    # Denormalized fields for fast queries
    total_amount = Column(Numeric(12, 2))
    
    # Return workflow tracking
    returned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    returned_at = Column(DateTime(timezone=True))
    return_reason = Column(Text)
    return_count = Column(Integer, default=0)
    can_edit = Column(Boolean, default=False)
    
    # Settlement tracking
    settled = Column(Boolean, default=False)
    settled_date = Column(DateTime(timezone=True))
    settled_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    payment_reference = Column(String(100))
    payment_method = Column(String(20))  # NEFT, RTGS, CHEQUE, CASH, UPI
    amount_paid = Column(Numeric(12, 2))
    
    # Relationships
    employee = relationship("User", back_populates="claims", foreign_keys=[employee_id])
    documents = relationship("Document", back_populates="claim", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="claim", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="claim", cascade="all, delete-orphan")
    agent_executions = relationship("AgentExecution", back_populates="claim", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('AI_PROCESSING', 'PENDING_MANAGER', "
            "'RETURNED_TO_EMPLOYEE', 'MANAGER_APPROVED', 'PENDING_HR', 'HR_APPROVED', "
            "'PENDING_FINANCE', 'FINANCE_APPROVED', 'SETTLED', 'REJECTED')",
            name="valid_status"
        ),
        CheckConstraint("claim_type IN ('REIMBURSEMENT', 'ALLOWANCE')", name="valid_claim_type"),
        CheckConstraint(
            "payment_method IS NULL OR payment_method IN ('NEFT', 'RTGS', 'CHEQUE', 'CASH', 'UPI')",
            name="valid_payment_method"
        ),
        Index("idx_claims_tenant", "tenant_id"),
        Index("idx_claims_employee", "employee_id"),
        Index("idx_claims_status", "status"),
        Index("idx_claims_status_employee", "status", "employee_id"),
        Index("idx_claims_amount", "amount"),
        Index("idx_claims_submission_date", "submission_date"),
        Index("idx_claims_claim_number", "claim_number"),
        Index("idx_claims_payload_gin", "claim_payload", postgresql_using="gin"),
    )


class User(Base):
    """
    Unified User model combining authentication, authorization, and employee data.
    This replaces the separate Employee table for simpler data management.
    """
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Authentication
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Profile / Employee Info
    employee_code = Column(String(50))  # e.g., EMP001 - unique per tenant (see __table_args__)
    first_name = Column(String(100))
    last_name = Column(String(100))
    full_name = Column(String(255))  # Computed or manual
    phone = Column(String(20))
    mobile = Column(String(20))
    address = Column(Text)
    
    # Profile Picture / Avatar
    avatar_url = Column(Text)  # Signed URL or public URL for display (can be long)
    avatar_storage_path = Column(String(1000))  # Cloud storage path (e.g., gs://bucket/path)
    avatar_blob_name = Column(String(500))  # Blob name for generating signed URLs
    
    # Employment
    department = Column(String(100))
    designation = Column(String(100))
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    date_of_joining = Column(Date)
    employment_status = Column(String(20), default="ACTIVE")  # ACTIVE, INACTIVE, ON_LEAVE
    
    # Region/Location (e.g., 'INDIA', 'USA', 'SEZ_BANGALORE', 'STP_CHENNAI')
    region = Column(ARRAY(String), nullable=True)
    
    # Roles & Permissions
    # All tenant users get EMPLOYEE role by default (except SYSTEM_ADMIN which is platform-level)
    # Additional roles: MANAGER, HR, FINANCE, ADMIN
    roles = Column(ARRAY(String), default=['EMPLOYEE'])
    
    # Additional data (JSONB for flexibility)
    user_data = Column(JSONB, default={})
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    
    # Relationships
    claims = relationship("Claim", back_populates="employee", foreign_keys="[Claim.employee_id]")
    manager = relationship("User", remote_side=[id], backref="direct_reports")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_users_tenant", "tenant_id"),
        Index("idx_users_username", "username"),
        Index("idx_users_email", "email"),
        Index("idx_users_employee_code", "employee_code"),
        Index("idx_users_department", "department"),
        Index("idx_users_manager", "manager_id"),
        # Composite unique constraint: employee_code is unique per tenant
        UniqueConstraint("tenant_id", "employee_code", name="uq_users_tenant_employee_code"),
    )
    
    @property
    def display_name(self):
        """Get display name, preferring first+last over full_name"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.full_name or self.username


# Employee alias for User model
Employee = User


class Document(Base):
    """Uploaded documents with OCR results"""
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False)
    
    # File info
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50))
    file_size = Column(Integer)
    storage_path = Column(String(500), nullable=False)  # Local path or GCS blob name
    
    # Cloud storage info
    gcs_uri = Column(String(500))  # Full GCS URI (gs://bucket/path)
    gcs_blob_name = Column(String(500))  # Blob name for signed URL generation
    storage_type = Column(String(20), default="local")  # 'local' or 'gcs'
    content_type = Column(String(100))  # MIME type
    
    # Document type
    document_type = Column(String(50))  # INVOICE, RECEIPT, CERTIFICATE, TICKET, etc.
    
    # OCR results
    ocr_text = Column(Text)
    ocr_data = Column(JSONB, default={})
    ocr_confidence = Column(Float)
    ocr_processed = Column(Boolean, default=False)
    ocr_processed_at = Column(DateTime(timezone=True))
    
    # Timestamps
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    claim = relationship("Claim", back_populates="documents")
    
    __table_args__ = (
        Index("idx_documents_tenant", "tenant_id"),
        Index("idx_documents_claim", "claim_id"),
        Index("idx_documents_type", "document_type"),
    )


class Comment(Base):
    """Multi-stakeholder comments with full audit trail"""
    __tablename__ = "comments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False)
    
    # Comment data
    comment_text = Column(Text, nullable=False)
    comment_type = Column(String(50), default="GENERAL")  # GENERAL, RETURN, APPROVAL, REJECTION, HR_CORRECTION
    
    # Author
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    user_name = Column(String(255), nullable=False)
    user_role = Column(String(50), nullable=False)
    
    # Visibility
    visible_to_employee = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    claim = relationship("Claim", back_populates="comments")
    
    __table_args__ = (
        Index("idx_comments_tenant", "tenant_id"),
        Index("idx_comments_claim", "claim_id"),
        Index("idx_comments_created", "created_at"),
    )


class Approval(Base):
    """Approval workflow tracking"""
    __tablename__ = "approvals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False)
    
    # Approval stage
    approval_stage = Column(String(50), nullable=False)  # MANAGER, HR, FINANCE
    approver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approver_name = Column(String(255))
    
    # Decision
    status = Column(String(50), nullable=False)  # PENDING, APPROVED, REJECTED, RETURNED
    decision_date = Column(DateTime(timezone=True))
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    claim = relationship("Claim", back_populates="approvals")
    
    __table_args__ = (
        Index("idx_approvals_tenant", "tenant_id"),
        Index("idx_approvals_claim", "claim_id"),
        Index("idx_approvals_approver", "approver_id"),
        Index("idx_approvals_status", "status"),
    )


class Project(Base):
    """Project master for project-based claims"""
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'project_code', name='uq_project_tenant_code'),
    )
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Project info
    project_code = Column(String(50), nullable=False)  # Unique per tenant via composite constraint
    project_name = Column(String(255), nullable=False)
    description = Column(Text)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # IBU association
    ibu_id = Column(UUID(as_uuid=True), ForeignKey("ibus.id"))
    
    # Relationship to IBU
    ibu = relationship("IBU", foreign_keys=[ibu_id], lazy="joined")
    
    # Budget
    budget_allocated = Column(Numeric(12, 2))
    budget_spent = Column(Numeric(12, 2), default=0)
    budget_available = Column(Numeric(12, 2))
    
    # Status
    status = Column(String(20), default="ACTIVE")  # ACTIVE, COMPLETED, CLOSED
    
    # Dates
    start_date = Column(Date)
    end_date = Column(Date)
    
    # Additional data
    project_data = Column(JSONB, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("idx_projects_tenant", "tenant_id"),
        Index("idx_projects_code", "project_code"),
        Index("idx_projects_status", "status"),
        Index("idx_projects_ibu", "ibu_id"),
    )


class AgentExecution(Base):
    """Agent execution tracking and learning"""
    __tablename__ = "agent_executions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id"))
    
    # Agent info
    agent_name = Column(String(100), nullable=False)
    agent_version = Column(String(20))
    
    # Execution
    task_id = Column(String(100))  # Celery task ID
    execution_time_ms = Column(Integer)
    
    # Result
    status = Column(String(20), nullable=False)  # SUCCESS, FAILURE, RETRY
    result_data = Column(JSONB, default={})
    error_message = Column(Text)
    
    # Learning metrics
    confidence_score = Column(Float)
    llm_tokens_used = Column(Integer)
    llm_cost = Column(Numeric(10, 6))
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    claim = relationship("Claim", back_populates="agent_executions")
    
    __table_args__ = (
        Index("idx_agent_executions_tenant", "tenant_id"),
        Index("idx_agent_executions_claim", "claim_id"),
        Index("idx_agent_executions_agent", "agent_name"),
        Index("idx_agent_executions_started", "started_at"),
    )


class Policy(Base):
    """Policy documents and rules"""
    __tablename__ = "policies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Policy info
    policy_name = Column(String(255), nullable=False)
    policy_type = Column(String(50), nullable=False)  # REIMBURSEMENT, ALLOWANCE
    category = Column(String(50))  # CERTIFICATION, TRAVEL, etc.
    
    # Content
    policy_text = Column(Text, nullable=False)
    policy_rules = Column(JSONB, default={})  # Structured rules
    
    # Version
    version = Column(String(20))
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("idx_policies_tenant", "tenant_id"),
        Index("idx_policies_type", "policy_type"),
        Index("idx_policies_category", "category"),
        Index("idx_policies_active", "is_active"),
    )


class EmployeeProjectAllocation(Base):
    """Tracks history of employee-project allocations"""
    __tablename__ = "employee_project_allocations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Employee and Project references
    employee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    
    # Allocation details
    role = Column(String(100))  # Role in the project: MEMBER, LEAD, MANAGER, etc.
    allocation_percentage = Column(Integer, default=100)  # Percentage allocation (0-100)
    
    # Status
    status = Column(String(20), default="ACTIVE")  # ACTIVE, COMPLETED, REMOVED
    
    # Dates
    allocated_date = Column(Date, nullable=False)
    deallocated_date = Column(Date)  # NULL if still active
    
    # Audit
    allocated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    deallocated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    employee = relationship("User", backref="project_allocations", foreign_keys=[employee_id])
    project = relationship("Project", backref="employee_allocations")
    
    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'COMPLETED', 'REMOVED')", name="valid_allocation_status"),
        CheckConstraint("allocation_percentage >= 0 AND allocation_percentage <= 100", name="valid_allocation_percentage"),
        Index("idx_allocations_tenant", "tenant_id"),
        Index("idx_allocations_employee", "employee_id"),
        Index("idx_allocations_project", "project_id"),
        Index("idx_allocations_status", "status"),
        Index("idx_allocations_employee_status", "employee_id", "status"),
        Index("idx_allocations_dates", "allocated_date", "deallocated_date"),
    )


class SystemSettings(Base):
    """System-wide settings and configurations"""
    __tablename__ = "system_settings"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'setting_key', name='uq_settings_tenant_key'),
        Index("idx_settings_tenant", "tenant_id"),
        Index("idx_settings_key", "setting_key"),
        Index("idx_settings_category", "category"),
    )
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Setting identification
    setting_key = Column(String(100), nullable=False)  # Unique per tenant via composite constraint
    setting_value = Column(Text, nullable=False)
    setting_type = Column(String(20), nullable=False, default="string")  # string, boolean, number, json
    
    # Metadata
    description = Column(Text)
    category = Column(String(50), default="general")  # general, notifications, policies
    
    # Audit
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


# ==================== POLICY & CRITERIA MANAGEMENT ====================

class PolicyUpload(Base):
    """
    Policy documents uploaded by Admin.
    Similar to how claims are uploaded - AI extracts categories and rules from the document.
    """
    __tablename__ = "policy_uploads"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Policy identification
    policy_name = Column(String(255), nullable=False)
    policy_number = Column(String(50), unique=True, nullable=False)  # Auto-generated like claim numbers
    description = Column(Text)
    
    # File details
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)  # PDF, DOCX, JPG, PNG
    file_size = Column(Integer)
    storage_path = Column(String(500))
    gcs_uri = Column(String(500))
    gcs_blob_name = Column(String(500))
    storage_type = Column(String(20), default="local")
    content_type = Column(String(100))
    
    # Processing status (like claims AI processing)
    status = Column(String(30), nullable=False, default="PENDING")
    # PENDING -> AI_PROCESSING -> EXTRACTED -> APPROVED -> ACTIVE / REJECTED
    
    # AI Extraction
    extracted_text = Column(Text)  # OCR/parsed text
    extraction_error = Column(Text)
    extracted_at = Column(DateTime(timezone=True))
    
    # AI extracted data (raw JSON from AI)
    extracted_data = Column(JSONB, default={})
    # Structure: {
    #   "claim_types": ["REIMBURSEMENT", "ALLOWANCE"],
    #   "categories": [
    #     {
    #       "name": "Travel",
    #       "code": "TRAVEL", 
    #       "type": "REIMBURSEMENT",
    #       "description": "...",
    #       "rules": [...]
    #     }
    #   ]
    # }
    
    # Versioning
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=False)
    replaces_policy_id = Column(UUID(as_uuid=True), ForeignKey("policy_uploads.id"))
    
    # Effective dates (set on approval)
    effective_from = Column(Date)
    effective_to = Column(Date)
    
    # Region/Location applicability (e.g., 'INDIA', 'USA', 'SEZ_BANGALORE', 'STP_CHENNAI')
    region = Column(ARRAY(String), nullable=True)  # NULL means applicable to all regions
    
    # Audit
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    review_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    categories = relationship("PolicyCategory", back_populates="policy_upload", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'AI_PROCESSING', 'EXTRACTED', 'APPROVED', 'ACTIVE', 'REJECTED', 'ARCHIVED')",
            name="valid_policy_status"
        ),
        Index("idx_policy_uploads_tenant", "tenant_id"),
        Index("idx_policy_uploads_status", "status"),
        Index("idx_policy_uploads_active", "is_active"),
        Index("idx_policy_uploads_number", "policy_number"),
        Index("idx_policy_uploads_region", "region"),
    )


class PolicyCategory(Base):
    """
    Categories extracted from policy documents.
    Each category has its rules and becomes available for claim submission once approved.
    """
    __tablename__ = "policy_categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    policy_upload_id = Column(UUID(as_uuid=True), ForeignKey("policy_uploads.id"), nullable=False)
    
    # Category details (extracted by AI, editable by admin)
    category_name = Column(String(100), nullable=False)
    category_code = Column(String(50), nullable=False)  # e.g., TRAVEL, CERTIFICATION
    category_type = Column(String(20), nullable=False)  # REIMBURSEMENT or ALLOWANCE
    description = Column(Text)
    
    # Limits
    max_amount = Column(Numeric(12, 2))
    min_amount = Column(Numeric(12, 2))
    currency = Column(String(3), default="INR")
    
    # Frequency
    frequency_limit = Column(String(50))  # ONCE, DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, UNLIMITED
    frequency_count = Column(Integer)  # Number of times allowed per frequency period
    
    # Eligibility (JSON for flexibility)
    eligibility_criteria = Column(JSONB, default={})
    # Structure: {"grades": ["L3", "L4"], "departments": ["Engineering"], "locations": ["Domestic"]}
    
    # Documentation requirements
    requires_receipt = Column(Boolean, default=True)
    requires_approval_above = Column(Numeric(12, 2))  # Amount above which needs approval
    allowed_document_types = Column(ARRAY(String), default=["PDF", "JPG", "PNG"])
    
    # Time constraints
    submission_window_days = Column(Integer)  # Days within which claim must be submitted
    
    # Status
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    
    # Source tracking
    source_text = Column(Text)  # Original text from policy for reference
    ai_confidence = Column(Float)  # AI confidence score for extraction
    
    # Audit
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    policy_upload = relationship("PolicyUpload", back_populates="categories")
    
    __table_args__ = (
        CheckConstraint("category_type IN ('REIMBURSEMENT', 'ALLOWANCE')", name="valid_policy_category_type"),
        Index("idx_policy_categories_tenant", "tenant_id"),
        Index("idx_policy_categories_policy", "policy_upload_id"),
        Index("idx_policy_categories_type", "category_type"),
        Index("idx_policy_categories_code", "category_code"),
        Index("idx_policy_categories_active", "is_active"),
    )


class ClaimValidation(Base):
    """
    Records of claim validation results against policy rules.
    """
    __tablename__ = "claim_validations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    claim_id = Column(UUID(as_uuid=True), ForeignKey("claims.id"), nullable=False)
    policy_category_id = Column(UUID(as_uuid=True), ForeignKey("policy_categories.id"))
    
    # Validation result
    validation_status = Column(String(20), nullable=False)  # PASS, WARNING, FAIL
    
    # Detailed results
    validation_results = Column(JSONB, nullable=False, default=[])
    # Example: [{"check": "amount_limit", "status": "PASS", "message": "Within limit"}]
    
    # Summary
    checks_total = Column(Integer, default=0)
    checks_passed = Column(Integer, default=0)
    checks_warned = Column(Integer, default=0)
    checks_failed = Column(Integer, default=0)
    
    # Timestamps
    validated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    __table_args__ = (
        CheckConstraint("validation_status IN ('PASS', 'WARNING', 'FAIL')", name="valid_claim_validation_status"),
        Index("idx_claim_validations_tenant", "tenant_id"),
        Index("idx_claim_validations_claim", "claim_id"),
        Index("idx_claim_validations_status", "validation_status"),
    )


class PolicyAuditLog(Base):
    """
    Audit log for policy changes.
    """
    __tablename__ = "policy_audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Entity
    entity_type = Column(String(50), nullable=False)  # POLICY_UPLOAD, POLICY_CATEGORY
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Action
    action = Column(String(50), nullable=False)  # CREATE, UPDATE, APPROVE, REJECT, ACTIVATE, DEACTIVATE
    
    # Changes
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    description = Column(Text)
    
    # Actor
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    performed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    __table_args__ = (
        Index("idx_policy_audit_tenant", "tenant_id"),
        Index("idx_policy_audit_entity", "entity_type", "entity_id"),
        Index("idx_policy_audit_action", "action"),
        Index("idx_policy_audit_date", "performed_at"),
    )


class CustomClaim(Base):
    """
    Custom claim definitions created by Admin.
    These are standalone claim types not linked to any policy document.
    """
    __tablename__ = "custom_claims"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Custom claim identification
    claim_name = Column(String(255), nullable=False)
    claim_code = Column(String(50), unique=True, nullable=False)  # Auto-generated like CC-2024-0001
    description = Column(Text)
    
    # Category type: REIMBURSEMENT or ALLOWANCE
    category_type = Column(String(20), nullable=False)
    
    # Region/Location applicability
    region = Column(ARRAY(String), nullable=True)  # NULL or empty means applicable to all regions
    
    # Limits
    max_amount = Column(Numeric(12, 2))
    min_amount = Column(Numeric(12, 2))
    default_amount = Column(Numeric(12, 2))  # Default amount for allowances
    currency = Column(String(3), default="INR")
    
    # Frequency
    frequency_limit = Column(String(50))  # ONCE, DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, UNLIMITED
    frequency_count = Column(Integer)  # Number of times allowed per frequency period
    
    # Custom fields definition (JSON array of field definitions)
    custom_fields = Column(JSONB, default=[])
    # Structure: [
    #   {
    #     "name": "vendor_name",
    #     "label": "Vendor Name",
    #     "type": "text",  # text, number, date, select, file, boolean
    #     "required": true,
    #     "placeholder": "Enter vendor name",
    #     "options": [],  # For select type
    #     "validation": {
    #       "min_length": 1,
    #       "max_length": 100,
    #       "min": null,
    #       "max": null,
    #       "pattern": null
    #     },
    #     "default_value": null
    #   }
    # ]
    
    # Eligibility (JSON for flexibility)
    eligibility_criteria = Column(JSONB, default={})
    # Structure: {"grades": ["L3", "L4"], "departments": ["Engineering"], "locations": ["Domestic"]}
    
    # Documentation requirements
    requires_receipt = Column(Boolean, default=True)
    requires_approval_above = Column(Numeric(12, 2))  # Amount above which needs approval
    allowed_document_types = Column(ARRAY(String), default=["PDF", "JPG", "PNG"])
    
    # Time constraints
    submission_window_days = Column(Integer)  # Days within which claim must be submitted
    
    # Status
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint("category_type IN ('REIMBURSEMENT', 'ALLOWANCE')", name="valid_custom_claim_category_type"),
        Index("idx_custom_claims_tenant", "tenant_id"),
        Index("idx_custom_claims_type", "category_type"),
        Index("idx_custom_claims_code", "claim_code"),
        Index("idx_custom_claims_active", "is_active"),
        Index("idx_custom_claims_region", "region"),
    )


class Notification(Base):
    """
    User notifications for the bell icon.
    Stores notifications for each user with read/unread status.
    """
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=True)  # NULL for system_admin platform notifications
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Notification content
    type = Column(String(50), nullable=False)  # claim_approved, claim_rejected, claim_returned, pending_approval, claim_submitted, system, tenant
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Priority
    priority = Column(String(20), default="medium")  # high, medium, low
    
    # Related entity (optional)
    related_entity_type = Column(String(50))  # claim, employee, tenant
    related_entity_id = Column(UUID(as_uuid=True))
    
    # Action URL for navigation
    action_url = Column(String(500))
    
    # Read status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime(timezone=True))
    
    # Clear/archive status (for clearing notifications)
    is_cleared = Column(Boolean, default=False)
    cleared_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = Column(DateTime(timezone=True))  # Optional expiry for time-sensitive notifications
    
    # Relationships
    user = relationship("User", back_populates="notifications")
    
    __table_args__ = (
        CheckConstraint(
            "type IN ('claim_approved', 'claim_rejected', 'claim_returned', 'pending_approval', 'claim_submitted', 'system', 'tenant')",
            name="valid_notification_type"
        ),
        CheckConstraint("priority IN ('high', 'medium', 'low')", name="valid_notification_priority"),
        Index("idx_notifications_user", "user_id"),
        Index("idx_notifications_tenant", "tenant_id"),
        Index("idx_notifications_type", "type"),
        Index("idx_notifications_read", "is_read"),
        Index("idx_notifications_cleared", "is_cleared"),
        Index("idx_notifications_created", "created_at"),
        Index("idx_notifications_user_unread", "user_id", "is_read"),
    )


class Region(Base):
    """
    Tenant-specific regions for policy and employee management.
    """
    __tablename__ = "regions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    name = Column(String(100), nullable=False)
    code = Column(String(50))  # e.g., IND, US-CA
    currency = Column(String(10))  # e.g., INR, USD
    description = Column(Text)
    
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'name', name='uq_region_name_tenant'),
        Index("idx_regions_tenant", "tenant_id"),
        Index("idx_regions_active", "is_active"),
    )


# ==================== SECURITY & AUDIT MODELS ====================

class AuditLog(Base):
    """
    Tamper-proof audit log for security and compliance.
    Records all security-relevant events and data access patterns.
    """
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Event identification
    event_type = Column(String(50), nullable=False)  # AUTH_LOGIN, DATA_READ, CLAIM_APPROVED, etc.
    event_timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Actor information
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user_email = Column(String(255))  # Denormalized for historical accuracy
    tenant_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Resource being accessed/modified
    resource_type = Column(String(100))  # claim, employee, document, policy, etc.
    resource_id = Column(UUID(as_uuid=True))  # ID of the resource
    
    # Action details
    action = Column(String(100))  # create, read, update, delete, login, logout, etc.
    action_details = Column(JSONB, default={})  # Additional context (fields changed, etc.)
    
    # Request context
    ip_address = Column(String(45))  # IPv4 or IPv6
    user_agent = Column(String(500))
    request_method = Column(String(10))  # GET, POST, PUT, DELETE
    request_path = Column(String(500))
    
    # Outcome
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    
    # Tamper detection - SHA-256 hash of log entry
    integrity_hash = Column(String(64), nullable=False)
    previous_hash = Column(String(64))  # Chain hash for sequence verification
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    __table_args__ = (
        CheckConstraint(
            """event_type IN (
                'AUTH_LOGIN', 'AUTH_LOGOUT', 'AUTH_FAILED', 'AUTH_TOKEN_REFRESH',
                'AUTH_PASSWORD_CHANGE', 'AUTH_PASSWORD_RESET', 'AUTH_MFA_ENABLED', 'AUTH_MFA_DISABLED',
                'DATA_CREATE', 'DATA_READ', 'DATA_UPDATE', 'DATA_DELETE', 'DATA_EXPORT', 'DATA_BULK_ACCESS',
                'CLAIM_SUBMITTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'CLAIM_RETURNED', 'CLAIM_SETTLED', 'CLAIM_EDITED',
                'ADMIN_ACTION', 'CONFIG_CHANGE', 'PERMISSION_CHANGE',
                'SECURITY_ALERT', 'SUSPICIOUS_ACTIVITY'
            )""",
            name="valid_audit_event_type"
        ),
        Index("idx_audit_event_type", "event_type"),
        Index("idx_audit_timestamp", "event_timestamp"),
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_tenant", "tenant_id"),
        Index("idx_audit_resource", "resource_type", "resource_id"),
        Index("idx_audit_success", "success"),
        Index("idx_audit_ip", "ip_address"),
        Index("idx_audit_tenant_timestamp", "tenant_id", "event_timestamp"),
        Index("idx_audit_user_timestamp", "user_id", "event_timestamp"),
    )


# ==================== INTEGRATION MODELS ====================

class IntegrationApiKey(Base):
    """
    API Keys for external system integrations.
    Allows third-party systems to access the platform securely.
    """
    __tablename__ = "integration_api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Key identification
    name = Column(String(100), nullable=False)  # Display name for the key
    description = Column(Text)  # Description of what this key is used for
    
    # The actual key (hashed for security, prefix stored for display)
    key_prefix = Column(String(10), nullable=False)  # First 8 chars for identification
    key_hash = Column(String(128), nullable=False)  # SHA-256 hash of the full key
    
    # Permissions
    permissions = Column(ARRAY(String), default=[])  # List of permissions: read_claims, write_claims, etc.
    
    # Rate limiting
    rate_limit = Column(Integer, default=1000)  # Requests per hour
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Expiry
    expires_at = Column(DateTime(timezone=True))
    
    # Tracking
    last_used_at = Column(DateTime(timezone=True))
    usage_count = Column(Integer, default=0)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("idx_api_keys_tenant", "tenant_id"),
        Index("idx_api_keys_prefix", "key_prefix"),
        Index("idx_api_keys_active", "is_active"),
    )


class IntegrationWebhook(Base):
    """
    Webhook configurations for sending event notifications to external systems.
    """
    __tablename__ = "integration_webhooks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Webhook details
    name = Column(String(100), nullable=False)
    description = Column(Text)
    url = Column(String(500), nullable=False)  # Webhook endpoint URL
    
    # Authentication
    secret = Column(String(128))  # Secret for HMAC signature verification
    auth_type = Column(String(20), default='hmac')  # hmac, bearer, basic, none
    auth_config = Column(JSONB, default={})  # Additional auth config (headers, etc.)
    
    # Events to trigger webhook
    events = Column(ARRAY(String), default=[])  # claim_submitted, claim_approved, etc.
    
    # Retry configuration
    retry_count = Column(Integer, default=3)
    retry_delay_seconds = Column(Integer, default=60)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Health tracking
    last_triggered_at = Column(DateTime(timezone=True))
    last_success_at = Column(DateTime(timezone=True))
    last_failure_at = Column(DateTime(timezone=True))
    failure_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("idx_webhooks_tenant", "tenant_id"),
        Index("idx_webhooks_active", "is_active"),
    )


class IntegrationSSOConfig(Base):
    """
    Single Sign-On (SSO) configuration for tenant authentication.
    Supports multiple SSO providers.
    """
    __tablename__ = "integration_sso_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, unique=True)
    
    # Provider type
    provider = Column(String(50), nullable=False)  # azure_ad, okta, google, keycloak, saml
    
    # Common OAuth/OIDC settings
    client_id = Column(String(255))
    client_secret = Column(String(500))  # Encrypted
    issuer_url = Column(String(500))
    authorization_url = Column(String(500))
    token_url = Column(String(500))
    userinfo_url = Column(String(500))
    jwks_url = Column(String(500))
    
    # SAML-specific settings
    saml_metadata_url = Column(String(500))
    saml_entity_id = Column(String(255))
    saml_certificate = Column(Text)  # X.509 certificate
    
    # Attribute mapping
    attribute_mapping = Column(JSONB, default={
        "email": "email",
        "name": "name",
        "employee_id": "employee_id"
    })
    
    # Feature flags
    auto_provision_users = Column(Boolean, default=False)  # Auto-create users on first login
    sync_user_attributes = Column(Boolean, default=True)  # Update user attributes on login
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("idx_sso_tenant", "tenant_id"),
        Index("idx_sso_provider", "provider"),
        Index("idx_sso_active", "is_active"),
    )


class IntegrationHRMS(Base):
    """
    HRMS (Human Resource Management System) integration configuration.
    For syncing employee data from external HR systems.
    """
    __tablename__ = "integration_hrms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, unique=True)
    
    # Provider type
    provider = Column(String(50), nullable=False)  # workday, bamboohr, sap_successfactors, oracle_hcm, zoho_people, darwinbox
    
    # Connection settings
    api_url = Column(String(500))
    api_key = Column(String(500))  # Encrypted
    api_secret = Column(String(500))  # Encrypted
    
    # OAuth settings (for providers that use OAuth)
    oauth_client_id = Column(String(255))
    oauth_client_secret = Column(String(500))  # Encrypted
    oauth_token_url = Column(String(500))
    oauth_scope = Column(String(255))
    
    # Sync configuration
    sync_enabled = Column(Boolean, default=False)
    sync_frequency = Column(String(20), default='daily')  # hourly, daily, weekly, manual
    last_sync_at = Column(DateTime(timezone=True))
    last_sync_status = Column(String(20))  # success, failed, in_progress
    last_sync_error = Column(Text)
    
    # Field mapping
    field_mapping = Column(JSONB, default={
        "employee_id": "employee_id",
        "email": "email",
        "name": "full_name",
        "department": "department",
        "designation": "job_title",
        "manager_id": "manager_id",
        "region": "location"
    })
    
    # Sync options
    sync_employees = Column(Boolean, default=True)
    sync_departments = Column(Boolean, default=True)
    sync_managers = Column(Boolean, default=True)
    
    # Status
    is_active = Column(Boolean, default=False)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("idx_hrms_tenant", "tenant_id"),
        Index("idx_hrms_provider", "provider"),
        Index("idx_hrms_active", "is_active"),
    )


class IntegrationERP(Base):
    """
    ERP/Finance system integration configuration.
    For syncing financial data to external accounting systems.
    """
    __tablename__ = "integration_erp"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, unique=True)
    
    # Provider type
    provider = Column(String(50), nullable=False)  # sap, oracle_financials, dynamics365, netsuite, quickbooks, tally, zoho_books
    
    # Connection settings
    api_url = Column(String(500))
    api_key = Column(String(500))  # Encrypted
    api_secret = Column(String(500))  # Encrypted
    
    # OAuth settings
    oauth_client_id = Column(String(255))
    oauth_client_secret = Column(String(500))  # Encrypted
    oauth_token_url = Column(String(500))
    oauth_scope = Column(String(255))
    
    # Company/entity settings
    company_code = Column(String(50))
    cost_center = Column(String(50))
    gl_account_mapping = Column(JSONB, default={})  # Map claim categories to GL accounts
    
    # Export configuration
    export_enabled = Column(Boolean, default=False)
    export_frequency = Column(String(20), default='manual')  # realtime, daily, weekly, manual
    export_format = Column(String(20), default='json')  # json, xml, csv
    auto_export_on_settlement = Column(Boolean, default=False)
    
    # Last export tracking
    last_export_at = Column(DateTime(timezone=True))
    last_export_status = Column(String(20))  # success, failed, in_progress
    last_export_error = Column(Text)
    
    # Status
    is_active = Column(Boolean, default=False)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("idx_erp_tenant", "tenant_id"),
        Index("idx_erp_provider", "provider"),
        Index("idx_erp_active", "is_active"),
    )


class IntegrationCommunication(Base):
    """
    Communication platform integrations (Slack, Microsoft Teams, etc.)
    For sending notifications to team channels.
    """
    __tablename__ = "integration_communication"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Provider type
    provider = Column(String(50), nullable=False)  # slack, microsoft_teams, google_chat
    
    # Slack-specific settings
    slack_workspace_id = Column(String(50))
    slack_bot_token = Column(String(255))  # Encrypted
    slack_channel_id = Column(String(50))
    
    # Teams-specific settings
    teams_tenant_id = Column(String(100))
    teams_webhook_url = Column(String(500))
    teams_channel_id = Column(String(100))
    
    # Notification preferences
    notify_on_claim_submitted = Column(Boolean, default=True)
    notify_on_claim_approved = Column(Boolean, default=True)
    notify_on_claim_rejected = Column(Boolean, default=True)
    notify_on_claim_settled = Column(Boolean, default=True)
    notify_managers = Column(Boolean, default=True)
    notify_finance = Column(Boolean, default=True)
    
    # Status
    is_active = Column(Boolean, default=False)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('tenant_id', 'provider', name='uq_communication_tenant_provider'),
        Index("idx_comm_tenant", "tenant_id"),
        Index("idx_comm_provider", "provider"),
        Index("idx_comm_active", "is_active"),
    )


class WebhookDeliveryLog(Base):
    """
    Log of webhook delivery attempts for debugging and monitoring.
    """
    __tablename__ = "webhook_delivery_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("integration_webhooks.id"), nullable=False)
    
    # Event details
    event_type = Column(String(50), nullable=False)
    event_payload = Column(JSONB, default={})
    
    # Delivery details
    attempt_number = Column(Integer, default=1)
    request_url = Column(String(500))
    request_headers = Column(JSONB, default={})
    request_body = Column(Text)
    
    # Response details
    response_status_code = Column(Integer)
    response_headers = Column(JSONB, default={})
    response_body = Column(Text)
    
    # Status
    success = Column(Boolean, default=False)
    error_message = Column(Text)
    duration_ms = Column(Integer)  # Response time in milliseconds
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    __table_args__ = (
        Index("idx_webhook_log_webhook", "webhook_id"),
        Index("idx_webhook_log_event", "event_type"),
        Index("idx_webhook_log_success", "success"),
        Index("idx_webhook_log_created", "created_at"),
    )


class ApprovalSkipRule(Base):
    """
    Rules for skipping approval levels based on employee designation or email.
    Allows CXOs and senior executives to bypass certain approval levels.
    """
    __tablename__ = "approval_skip_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    
    # Rule identification
    rule_name = Column(String(100), nullable=False)  # e.g., "CXO Fast Track"
    description = Column(Text)
    
    # Rule criteria - can match by designation OR specific emails
    match_type = Column(String(20), nullable=False, default="designation")  # "designation" or "email"
    designations = Column(ARRAY(String), default=[])  # List of designation codes, e.g., ["CEO", "CFO", "CTO"]
    emails = Column(ARRAY(String), default=[])  # Specific email addresses
    
    # Approval levels to skip (these won't be required for matching employees)
    skip_manager_approval = Column(Boolean, default=False)
    skip_hr_approval = Column(Boolean, default=False)
    skip_finance_approval = Column(Boolean, default=False)  # Usually kept False - Finance settles
    
    # Optional amount threshold (above this, normal approval flow applies)
    max_amount_threshold = Column(Numeric(15, 2), nullable=True)  # NULL = unlimited
    
    # Category restrictions (optional - only applies to specific categories)
    category_codes = Column(ARRAY(String), default=[])  # Empty = all categories
    
    # Priority (lower number = higher priority, checked first)
    priority = Column(Integer, default=100)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index("idx_approval_skip_tenant", "tenant_id"),
        Index("idx_approval_skip_active", "is_active"),
        Index("idx_approval_skip_priority", "priority"),
        Index("idx_approval_skip_match_type", "match_type"),
    )
