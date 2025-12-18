# Approval Agent

## Intelligent Routing and Approval Workflow

### 1. Overview

The Approval Agent determines the appropriate routing for claims based on validation confidence and organizational hierarchy. It implements intelligent auto-approval for high-confidence claims while ensuring proper oversight for edge cases.

---

## 2. Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Routing Decision** | Determine next approval stage |
| **Auto-Approval** | Process high-confidence claims automatically |
| **Status Updates** | Update claim workflow status |
| **Approval Records** | Create audit trail entries |
| **Notifications** | Trigger stakeholder alerts |

---

## 3. Routing Logic

### 3.1 Decision Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPROVAL ROUTING LOGIC                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                     ┌─────────────────────────┐                             │
│                     │  Validation Results     │                             │
│                     │  - Confidence: 0.92     │                             │
│                     │  - Recommendation: X    │                             │
│                     │  - Failed Rules: [...]  │                             │
│                     └───────────┬─────────────┘                             │
│                                 │                                            │
│                                 ▼                                            │
│              ┌──────────────────────────────────────┐                       │
│              │  Auto-Approval Enabled?              │                       │
│              │  Confidence >= 0.95?                 │                       │
│              │  Recommendation = AUTO_APPROVE?      │                       │
│              └────────────────┬─────────────────────┘                       │
│                               │                                              │
│               ┌───────YES─────┴───────NO────────┐                           │
│               │                                 │                           │
│               ▼                                 ▼                           │
│   ┌───────────────────────┐     ┌─────────────────────────────────────┐    │
│   │  FINANCE_APPROVED     │     │  Check for Policy Exceptions        │    │
│   │  (Auto-Approved)      │     │  (Failed Rules?)                    │    │
│   │                       │     └───────────────┬─────────────────────┘    │
│   │  → Ready for         │                     │                           │
│   │    Settlement        │     ┌───────YES─────┴───────NO────────┐         │
│   └───────────────────────┘    │                                 │         │
│                                ▼                                 ▼         │
│                   ┌─────────────────────┐     ┌─────────────────────┐      │
│                   │    PENDING_HR       │     │  Check Confidence   │      │
│                   │    (Policy Review)  │     │  Level              │      │
│                   └─────────────────────┘     └──────────┬──────────┘      │
│                                                          │                  │
│                              ┌────────────────────────────┼────────┐        │
│                              │                            │        │        │
│                          >= 0.80                      0.60-0.79  < 0.60    │
│                              │                            │        │        │
│                              ▼                            ▼        ▼        │
│                   ┌─────────────────┐       ┌───────────────┐ ┌────────┐   │
│                   │ PENDING_MANAGER │       │  PENDING_HR   │ │REJECTED│   │
│                   │ (Normal Review) │       │  (HR Review)  │ │        │   │
│                   └─────────────────┘       └───────────────┘ └────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Routing Rules

| Condition | New Status | Routed To |
|-----------|------------|-----------|
| Auto-approval enabled & confidence >= 0.95 | `FINANCE_APPROVED` | Auto |
| Has policy exceptions (failed rules) | `PENDING_HR` | HR |
| Confidence >= 0.80 | `PENDING_MANAGER` | Manager |
| Confidence 0.60 - 0.79 | `PENDING_HR` | HR |
| Confidence < 0.60 | `REJECTED` | System |

---

## 4. Implementation

### 4.1 ApprovalAgent Class

```python
class ApprovalAgent(BaseAgent):
    """Handles claim routing and approval workflow"""
    
    def __init__(self):
        super().__init__("approval_agent", "1.0")
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Route claim based on validation results
        
        Context should contain:
        - claim_id: UUID of the claim
        """
        self.validate_context(context, ["claim_id"])
        
        claim_id = context["claim_id"]
        start_time = datetime.utcnow()
        
        self.logger.info(f"Routing claim {claim_id}")
        
        try:
            # Get claim with validation results
            claim = self._get_claim(claim_id)
            
            # Get validation results
            validation = claim.claim_payload.get("validation", {})
            confidence = validation.get("confidence", 0.0)
            recommendation = validation.get("recommendation", "REVIEW")
            
            # Determine routing
            new_status = self._determine_routing(
                confidence, 
                recommendation,
                claim
            )
            
            # Update claim status
            self._update_claim_status(claim_id, new_status)
            
            # Create approval record
            self._create_approval_record(claim_id, new_status)
            
            # Send notifications
            await self._send_notifications(claim, new_status)
            
            execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Log execution
            self.log_execution(
                claim_id=claim_id,
                status="SUCCESS",
                result_data={
                    "new_status": new_status,
                    "confidence": confidence,
                    "auto_approved": new_status == "FINANCE_APPROVED"
                },
                execution_time_ms=int(execution_time)
            )
            
            return {
                "success": True,
                "claim_id": claim_id,
                "new_status": new_status,
                "routed_to": self._get_approver_role(new_status)
            }
            
        except Exception as e:
            self.logger.error(f"Routing failed: {e}")
            raise
```

### 4.2 Routing Determination

```python
def _determine_routing(
    self, 
    confidence: float,
    recommendation: str,
    claim: Any
) -> str:
    """Determine next status based on confidence and recommendation"""
    
    # Auto-approve if high confidence and enabled
    if settings.ENABLE_AUTO_APPROVAL:
        if confidence >= settings.AUTO_APPROVAL_CONFIDENCE_THRESHOLD:
            if recommendation == "AUTO_APPROVE" or recommendation == "APPROVE":
                self.logger.info(f"Auto-approving claim {claim.id}")
                return "FINANCE_APPROVED"  # Skip to finance for settlement
    
    # Check for policy exceptions
    validation = claim.claim_payload.get("validation", {})
    failed_rules = [
        r for r in validation.get("rules_checked", []) 
        if r.get("result") == "fail"
    ]
    
    if failed_rules:
        # Has policy exceptions - route to HR
        return "PENDING_HR"
    
    # Medium confidence - manager review
    if confidence >= 0.80:
        return "PENDING_MANAGER"
    
    # Low confidence - reject or HR review
    if confidence < 0.60:
        return "REJECTED"
    
    # Default - manager review
    return "PENDING_MANAGER"
```

---

## 5. Auto-Approval

### 5.1 Configuration

```python
# config.py
ENABLE_AUTO_APPROVAL: bool = True
AUTO_APPROVAL_CONFIDENCE_THRESHOLD: float = 0.95
```

### 5.2 Auto-Approval Criteria

All conditions must be met:
1. ✅ `ENABLE_AUTO_APPROVAL = True`
2. ✅ Confidence >= 0.95
3. ✅ Recommendation = `AUTO_APPROVE` or `APPROVE`
4. ✅ No failed validation rules

### 5.3 Auto-Approval Benefits

| Metric | Without Auto-Approval | With Auto-Approval |
|--------|----------------------|-------------------|
| Processing Time | 2-5 days | < 1 minute |
| Manual Reviews | 100% | ~30% |
| Bottlenecks | Manager availability | None |

---

## 6. Status Management

### 6.1 Status Update

```python
def _update_claim_status(self, claim_id: str, new_status: str):
    """Update claim status"""
    from database import get_sync_db
    from models import Claim
    from uuid import UUID
    
    db = next(get_sync_db())
    claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
    
    if claim:
        claim.status = new_status
        claim.updated_at = datetime.utcnow()
        db.commit()
        self.logger.info(f"Claim {claim_id} status updated to {new_status}")
```

### 6.2 Status Descriptions

| Status | Description | Next Actions |
|--------|-------------|--------------|
| `PENDING_MANAGER` | Awaiting manager | Approve/Reject/Return |
| `MANAGER_APPROVED` | Manager approved | Auto-advance to HR/Finance |
| `PENDING_HR` | Policy exception review | Approve/Reject/Return |
| `HR_APPROVED` | HR approved | Advance to Finance |
| `PENDING_FINANCE` | Settlement pending | Process payment |
| `FINANCE_APPROVED` | Ready for settlement | Settlement |
| `SETTLED` | Payment complete | Archive |
| `REJECTED` | Claim declined | End |
| `RETURNED_TO_EMPLOYEE` | Needs correction | Employee edit |

---

## 7. Approval Records

### 7.1 Create Approval Record

```python
def _create_approval_record(self, claim_id: str, status: str):
    """Create approval record for audit trail"""
    from database import get_sync_db
    from models import Approval, Claim
    from uuid import UUID
    
    db = next(get_sync_db())
    claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
    
    if claim:
        approval_stage = self._get_approver_role(status)
        
        approval = Approval(
            tenant_id=claim.tenant_id,
            claim_id=claim.id,
            approval_stage=approval_stage,
            status="PENDING" if "PENDING" in status else "APPROVED",
            created_at=datetime.utcnow()
        )
        
        db.add(approval)
        db.commit()
```

### 7.2 Approval Model

```python
class Approval(Base):
    __tablename__ = "approvals"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, nullable=False)
    claim_id = Column(UUID, ForeignKey("claims.id"))
    
    # Approval stage
    approval_stage = Column(String(50))  # MANAGER, HR, FINANCE
    approver_id = Column(UUID, ForeignKey("users.id"))
    approver_name = Column(String(255))
    
    # Decision
    status = Column(String(50))  # PENDING, APPROVED, REJECTED, RETURNED
    decision_date = Column(DateTime)
    notes = Column(Text)
    
    created_at = Column(DateTime)
```

---

## 8. Notifications

### 8.1 Notification Trigger

```python
async def _send_notifications(self, claim: Any, new_status: str):
    """Send notifications to stakeholders"""
    self.logger.info(f"Sending notification for claim {claim.id} - Status: {new_status}")
    
    # Determine recipients
    recipients = self._get_notification_recipients(claim, new_status)
    
    # Create notification records
    for recipient in recipients:
        notification = Notification(
            tenant_id=claim.tenant_id,
            user_id=recipient.id,
            notification_type=self._get_notification_type(new_status),
            title=self._get_notification_title(new_status),
            message=self._get_notification_message(claim, new_status),
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(notification)
    
    db.commit()
```

### 8.2 Notification Recipients

| Status | Recipients |
|--------|------------|
| `PENDING_MANAGER` | Employee's manager |
| `PENDING_HR` | HR team |
| `PENDING_FINANCE` | Finance team |
| `FINANCE_APPROVED` | Employee, Finance |
| `REJECTED` | Employee |
| `RETURNED_TO_EMPLOYEE` | Employee |

---

## 9. Role Mapping

### 9.1 Status to Role

```python
def _get_approver_role(self, status: str) -> str:
    """Get approver role for status"""
    role_mapping = {
        "PENDING_MANAGER": "MANAGER",
        "PENDING_HR": "HR",
        "PENDING_FINANCE": "FINANCE",
        "FINANCE_APPROVED": "AUTO",
        "REJECTED": "SYSTEM"
    }
    return role_mapping.get(status, "UNKNOWN")
```

### 9.2 Approval Hierarchy

```
Employee Submits
       │
       ▼
┌─────────────┐
│   MANAGER   │ ─── Approve ──► ┌────────────┐
│   Review    │                 │    HR      │ ─── Approve ──► ┌──────────┐
└─────────────┘                 │   Review   │                 │ FINANCE  │
       │                        └────────────┘                 │ Settle   │
       │                               │                       └──────────┘
    Reject                          Reject
       │                               │
       ▼                               ▼
   REJECTED                        REJECTED
```

---

## 10. Error Handling

### 10.1 Failure Scenarios

```python
async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # Normal routing flow
        pass
    except ClaimNotFoundError:
        self.logger.error(f"Claim {claim_id} not found")
        raise HTTPException(404, "Claim not found")
    except ValidationNotFoundError:
        # No validation results - default to manual review
        self.logger.warning(f"No validation for claim {claim_id}")
        new_status = "PENDING_MANAGER"
    except DatabaseError as e:
        self.logger.error(f"Database error: {e}")
        raise
```

---

## 11. Performance

### 11.1 Timing

| Operation | Time |
|-----------|------|
| Routing decision | 5-10ms |
| Status update | 10-20ms |
| Approval record | 10-20ms |
| Notifications | 20-50ms |
| Total | 50-100ms |

### 11.2 No LLM Usage

The Approval Agent makes no LLM calls - all decisions are based on:
- Validation results (from Validation Agent)
- Configuration settings
- Simple rule logic

---

## 12. Celery Task

```python
@celery_app.task(name="agents.approval_agent.route_claim")
def route_claim_task(claim_id: str):
    """Celery task to route claim"""
    import asyncio
    
    agent = ApprovalAgent()
    context = {"claim_id": claim_id}
    
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(agent.execute(context))
    
    return result
```

---

## 13. Configuration Reference

```python
# Auto-approval settings
ENABLE_AUTO_APPROVAL = True
AUTO_APPROVAL_CONFIDENCE_THRESHOLD = 0.95

# Confidence thresholds for routing
CONFIDENCE_THRESHOLD_MANAGER = 0.80
CONFIDENCE_THRESHOLD_HR = 0.60
CONFIDENCE_THRESHOLD_REJECT = 0.60
```

---

## 14. Monitoring

### 14.1 Key Metrics

- Auto-approval rate (target: 30-50%)
- Average routing time
- Claims per status
- Rejection rate
- Return rate

### 14.2 Logging

```python
self.logger.info(f"Routing claim {claim_id}")
self.logger.info(f"Auto-approving claim {claim.id}")
self.logger.info(f"Claim {claim_id} status updated to {new_status}")
self.logger.info(f"Sending notification for claim {claim.id}")
self.logger.error(f"Routing failed: {e}")
```

---

*Document Version: 1.0 | Last Updated: December 2024*
