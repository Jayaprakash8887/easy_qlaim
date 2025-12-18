# Orchestrator Agent

## Master Workflow Coordinator

### 1. Overview

The Orchestrator Agent is the central coordinator of the Easy Qlaim multi-agent system. It receives claim submissions, determines the appropriate processing workflow, and manages the execution of specialized agents in the correct sequence.

---

## 2. Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Workflow Selection** | Determines processing path based on claim type |
| **Agent Coordination** | Builds and executes Celery task chains |
| **Status Management** | Updates claim status throughout processing |
| **Error Handling** | Manages failures and sets appropriate status |

---

## 3. Workflow Logic

### 3.1 Claim Type Detection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR DECISION TREE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         ┌─────────────────────┐                             │
│                         │  Claim Submitted    │                             │
│                         └──────────┬──────────┘                             │
│                                    │                                         │
│                                    ▼                                         │
│                         ┌─────────────────────┐                             │
│                         │  What is claim_type? │                            │
│                         └──────────┬──────────┘                             │
│                                    │                                         │
│                    ┌───────────────┴───────────────┐                        │
│                    ▼                               ▼                        │
│         ┌─────────────────────┐       ┌─────────────────────┐              │
│         │   REIMBURSEMENT     │       │     ALLOWANCE       │              │
│         │   (Receipt-based)   │       │   (Flat amount)     │              │
│         └──────────┬──────────┘       └──────────┬──────────┘              │
│                    │                              │                         │
│                    ▼                              │                         │
│         ┌─────────────────────┐                  │                         │
│         │  Has Documents?     │                  │                         │
│         └──────────┬──────────┘                  │                         │
│                    │                              │                         │
│         ┌────────Yes────────┐                    │                         │
│         ▼                   ▼                    ▼                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐                │
│  │ Document    │    │ Validation  │    │ Allowance       │                │
│  │ Agent       │───▶│ Agent       │    │ Workflow        │                │
│  └─────────────┘    └──────┬──────┘    │ (No Documents)  │                │
│                            │           └────────┬────────┘                │
│                            ▼                    │                          │
│                     ┌─────────────┐              │                         │
│                     │ Approval    │◀─────────────┘                         │
│                     │ Agent       │                                        │
│                     └─────────────┘                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Workflow Types

**Reimbursement Workflow (with documents):**
```python
def _build_reimbursement_workflow(self, claim_id: str, has_documents: bool):
    """Build workflow for reimbursement claims."""
    
    tasks = []
    
    # Step 1: Document processing (if documents uploaded)
    if has_documents:
        tasks.append(process_documents_task.s(claim_id))
    
    # Step 2: Fetch employee and project data
    tasks.append(fetch_employee_data_task.s(claim_id))
    
    # Step 3: Validate against policies
    tasks.append(validate_claim_task.s(claim_id))
    
    # Step 4: Route for approval
    tasks.append(route_claim_task.s(claim_id))
    
    # Create chain workflow
    return chain(*tasks)()
```

**Allowance Workflow (no documents):**
```python
def _build_allowance_workflow(self, claim_id: str):
    """Build workflow for allowance claims."""
    
    # Allowance workflow: No document processing
    return chain(
        fetch_employee_data_task.s(claim_id),
        validate_claim_task.s(claim_id),
        route_claim_task.s(claim_id),
    )()
```

---

## 4. Implementation

### 4.1 OrchestratorAgent Class

```python
class OrchestratorAgent(BaseAgent):
    """Orchestrates the entire claim processing workflow"""
    
    def __init__(self):
        super().__init__("orchestrator", "1.0")
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Orchestrate claim processing workflow
        
        Context should contain:
        - claim_id: UUID of the claim
        - claim_type: REIMBURSEMENT or ALLOWANCE
        - has_documents: Boolean
        """
        self.validate_context(context, ["claim_id", "claim_type"])
        
        claim_id = context["claim_id"]
        claim_type = context["claim_type"]
        has_documents = context.get("has_documents", False)
        
        self.logger.info(f"Orchestrating claim {claim_id} - Type: {claim_type}")
        
        try:
            # Update claim status to AI_PROCESSING
            self._update_claim_status(claim_id, "AI_PROCESSING")
            
            # Build workflow based on claim type
            if claim_type == "ALLOWANCE":
                workflow = self._build_allowance_workflow(claim_id)
            else:
                workflow = self._build_reimbursement_workflow(claim_id, has_documents)
            
            # Execute workflow
            result = await workflow
            
            self.logger.info(f"Claim {claim_id} processed successfully")
            
            return {
                "success": True,
                "claim_id": claim_id,
                "workflow_result": result
            }
            
        except Exception as e:
            self.logger.error(f"Orchestration failed for claim {claim_id}: {e}")
            self._update_claim_status(claim_id, "REJECTED")
            raise
```

### 4.2 Status Update Method

```python
def _update_claim_status(self, claim_id: str, status: str):
    """Update claim status in database"""
    try:
        from database import get_sync_db
        from models import Claim
        from uuid import UUID
        
        db = next(get_sync_db())
        claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
        
        if claim:
            claim.status = status
            claim.updated_at = datetime.utcnow()
            db.commit()
            self.logger.info(f"Claim {claim_id} status updated to {status}")
        else:
            self.logger.error(f"Claim {claim_id} not found")
            
    except Exception as e:
        self.logger.error(f"Error updating claim status: {e}")
```

---

## 5. Celery Task Integration

### 5.1 Task Definition

```python
@celery_app.task(name="agents.orchestrator.process_claim")
def process_claim_task(claim_id: str, claim_type: str, has_documents: bool = False):
    """
    Celery task to process a claim through the orchestrator
    
    Args:
        claim_id: UUID string of the claim
        claim_type: REIMBURSEMENT or ALLOWANCE
        has_documents: Whether documents were uploaded
    """
    import asyncio
    
    orchestrator = OrchestratorAgent()
    
    context = {
        "claim_id": claim_id,
        "claim_type": claim_type,
        "has_documents": has_documents,
    }
    
    # Run async execute in sync context
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(orchestrator.execute(context))
    
    return result
```

### 5.2 Triggering from API

```python
@router.post("/claims", response_model=ClaimResponse)
async def create_claim(
    claim_data: ClaimCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new claim and trigger AI processing."""
    
    # 1. Create claim record
    claim = Claim(
        tenant_id=current_user.tenant_id,
        employee_id=current_user.id,
        claim_type=claim_data.claim_type,
        category=claim_data.category,
        amount=claim_data.amount,
        status="SUBMITTED",
        # ... other fields
    )
    db.add(claim)
    db.commit()
    
    # 2. Handle document uploads
    has_documents = bool(claim_data.documents)
    if has_documents:
        # Store documents...
        pass
    
    # 3. Trigger orchestrator (async)
    process_claim_task.delay(
        claim_id=str(claim.id),
        claim_type=claim.claim_type,
        has_documents=has_documents
    )
    
    return ClaimResponse.from_orm(claim)
```

---

## 6. Status Transitions

### 6.1 Valid Status Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLAIM STATUS TRANSITIONS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SUBMITTED ──────▶ AI_PROCESSING ──────┬─────▶ PENDING_MANAGER              │
│                         │              │                │                   │
│                         │              │                ▼                   │
│                    (on error)          │        MANAGER_APPROVED            │
│                         │              │                │                   │
│                         ▼              │                ▼                   │
│                      REJECTED          │          PENDING_HR                │
│                                        │                │                   │
│                                        │                ▼                   │
│                                        │          HR_APPROVED               │
│                                        │                │                   │
│                                        │                ▼                   │
│                                        │         PENDING_FINANCE            │
│                                        │                │                   │
│                                        ├───(auto)───▶   ▼                   │
│                                                   FINANCE_APPROVED          │
│                                                         │                   │
│                                                         ▼                   │
│                                                      SETTLED                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Status Descriptions

| Status | Set By | Description |
|--------|--------|-------------|
| `SUBMITTED` | API | Initial claim submission |
| `AI_PROCESSING` | Orchestrator | Agents actively processing |
| `PENDING_MANAGER` | Approval Agent | Awaiting manager approval |
| `MANAGER_APPROVED` | Manager Action | Manager has approved |
| `PENDING_HR` | Approval Agent | Policy exception review |
| `HR_APPROVED` | HR Action | HR has approved |
| `PENDING_FINANCE` | System | Awaiting settlement |
| `FINANCE_APPROVED` | Approval Agent | Ready for payment |
| `SETTLED` | Finance Action | Payment complete |
| `REJECTED` | Any | Claim declined |
| `RETURNED_TO_EMPLOYEE` | Approver | Needs employee correction |

---

## 7. Error Handling

### 7.1 Failure Scenarios

| Scenario | Handling |
|----------|----------|
| Document OCR fails | Continue with manual review |
| LLM timeout | Retry with backoff, then manual |
| Database error | Celery retry mechanism |
| Invalid claim data | Reject with error message |

### 7.2 Error Recovery

```python
async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # Normal workflow execution
        result = await self._run_workflow(context)
        return result
        
    except DocumentProcessingError as e:
        # OCR failure - allow manual processing
        self.logger.warning(f"Document processing failed: {e}")
        self._update_claim_status(claim_id, "PENDING_MANAGER")
        self._add_comment(
            claim_id, 
            "Automatic document processing failed. Manual review required.",
            comment_type="SYSTEM"
        )
        return {"success": False, "needs_manual_review": True}
        
    except ValidationError as e:
        # Validation failure - reject
        self.logger.error(f"Validation failed: {e}")
        self._update_claim_status(claim_id, "REJECTED")
        self._add_comment(
            claim_id, 
            f"Claim rejected: {str(e)}",
            comment_type="REJECTION"
        )
        raise
        
    except Exception as e:
        # Unknown error - log and reject
        self.logger.error(f"Orchestration failed: {e}")
        self._update_claim_status(claim_id, "REJECTED")
        raise
```

---

## 8. Performance Characteristics

### 8.1 Timing

| Metric | Value |
|--------|-------|
| Orchestrator execution | 50-200ms |
| Full reimbursement workflow | 5-15s |
| Full allowance workflow | 1-3s |
| Status update | <50ms |

### 8.2 Throughput

- **Concurrent workflows:** Limited by Celery workers
- **Recommended workers:** 4 per CPU core
- **Queue capacity:** Limited by Redis memory

---

## 9. Configuration

### 9.1 Celery Configuration

```python
# celery_app.py
celery_app = Celery(
    "reimbursement",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='UTC',
    enable_utc=True,
    
    # Retry configuration
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    
    # Concurrency
    worker_concurrency=4,
    worker_prefetch_multiplier=1,
)
```

### 9.2 Feature Flags

```python
# config.py
ENABLE_AUTO_APPROVAL: bool = True
AUTO_APPROVAL_CONFIDENCE_THRESHOLD: float = 0.95
ENABLE_OCR: bool = True
ENABLE_AI_VALIDATION: bool = True
```

---

## 10. Monitoring

### 10.1 Key Metrics

- Workflows started per minute
- Workflow completion rate
- Average workflow duration
- Failure rate by error type

### 10.2 Logging

```python
# Orchestrator logging examples
self.logger.info(f"Orchestrating claim {claim_id} - Type: {claim_type}")
self.logger.info(f"Claim {claim_id} status updated to {status}")
self.logger.error(f"Orchestration failed for claim {claim_id}: {e}")
```

---

*Document Version: 1.0 | Last Updated: December 2024*
