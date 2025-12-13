"""
Database models using SQLAlchemy ORM for PostgreSQL
"""
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date, Text, 
    Numeric, ForeignKey, Index, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime

Base = declarative_base()


class Claim(Base):
    """Main claims table with OCR tracking, HR corrections, return workflow"""
    __tablename__ = "claims"
    
    # Identity
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    claim_number = Column(String(50), unique=True, nullable=False)
    
    # Employee & Claim Info
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    employee_name = Column(String(255), nullable=False)
    department = Column(String(100))
    claim_type = Column(String(20), nullable=False)  # REIMBURSEMENT or ALLOWANCE
    category = Column(String(50), nullable=False)  # CERTIFICATION, TRAVEL, TEAM_LUNCH, ONCALL
    
    # Financial
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="INR")
    
    # Status & Workflow
    status = Column(String(50), nullable=False, default="DRAFT")
    
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
    employee = relationship("Employee", back_populates="claims")
    documents = relationship("Document", back_populates="claim", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="claim", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="claim", cascade="all, delete-orphan")
    agent_executions = relationship("AgentExecution", back_populates="claim", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT', 'SUBMITTED', 'AI_PROCESSING', 'PENDING_MANAGER', "
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


class Employee(Base):
    """Employee master data"""
    __tablename__ = "employees"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=False)
    
    # Personal Info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20))
    
    # Employment
    department = Column(String(100))
    designation = Column(String(100))
    manager_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"))
    date_of_joining = Column(Date)
    employment_status = Column(String(20), default="ACTIVE")
    
    # Additional data
    employee_data = Column(JSONB, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    claims = relationship("Claim", back_populates="employee")
    manager = relationship("Employee", remote_side=[id])
    
    __table_args__ = (
        Index("idx_employees_tenant", "tenant_id"),
        Index("idx_employees_employee_id", "employee_id"),
        Index("idx_employees_email", "email"),
        Index("idx_employees_manager", "manager_id"),
    )


class User(Base):
    """Users for authentication and authorization"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Auth
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Profile
    full_name = Column(String(255))
    roles = Column(ARRAY(String), default=[])  # EMPLOYEE, MANAGER, HR, FINANCE, ADMIN
    
    # Linked employee
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"))
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    
    __table_args__ = (
        Index("idx_users_tenant", "tenant_id"),
        Index("idx_users_username", "username"),
        Index("idx_users_email", "email"),
    )


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
    storage_path = Column(String(500), nullable=False)
    
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
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Project info
    project_code = Column(String(50), unique=True, nullable=False)
    project_name = Column(String(255), nullable=False)
    description = Column(Text)
    
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
