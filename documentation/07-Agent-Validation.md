# Validation Agent

## Policy Compliance and AI Reasoning

### 1. Overview

The Validation Agent implements a hybrid validation approach combining deterministic rule-based checks with LLM-powered reasoning. This ensures fast, cost-effective processing while maintaining intelligent handling of edge cases.

---

## 2. Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Rule Validation** | Apply deterministic policy rules |
| **AI Reasoning** | Use LLM for edge case analysis |
| **Confidence Scoring** | Calculate approval confidence |
| **Recommendation** | AUTO_APPROVE, REVIEW, or REJECT |

---

## 3. Hybrid Validation Strategy

### 3.1 Two-Layer Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     HYBRID VALIDATION ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                  LAYER 1: RULE-BASED VALIDATION                       │   │
│  │                     (FREE, FAST, DETERMINISTIC)                       │   │
│  │                                                                       │   │
│  │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │   │
│  │   │   Amount     │ │   Tenure     │ │   Document   │ │   Date     │  │   │
│  │   │   Limit      │ │   Check      │ │   Complete   │ │   Valid    │  │   │
│  │   └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │   │
│  │                                                                       │   │
│  │   Result: PASS / FAIL for each rule                                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│                    ┌──────────────────────────────┐                         │
│                    │    All Rules Passed?         │                         │
│                    └──────────────┬───────────────┘                         │
│                                   │                                          │
│               ┌────────YES────────┴────────NO────────┐                      │
│               │                                      │                      │
│               ▼                                      ▼                      │
│  ┌────────────────────────┐         ┌────────────────────────────────────┐  │
│  │  ✅ HIGH CONFIDENCE    │         │  LAYER 2: LLM REASONING            │  │
│  │     (0.98)             │         │     (COST PER CALL)                │  │
│  │                        │         │                                    │  │
│  │  Recommendation:       │         │  Analyze:                          │  │
│  │  AUTO_APPROVE          │         │  - Failed rules context            │  │
│  │                        │         │  - Business justification          │  │
│  │  LLM Used: NO          │         │  - Policy exceptions               │  │
│  └────────────────────────┘         │                                    │  │
│                                     │  Output:                            │  │
│                                     │  - Confidence (0.0 - 1.0)          │  │
│                                     │  - Recommendation                   │  │
│                                     │  - Reasoning                        │  │
│                                     └────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Cost Optimization Benefits

| Scenario | LLM Calls | Cost |
|----------|-----------|------|
| All rules pass (~70% cases) | 0 | Free |
| Some rules fail (~30% cases) | 1 | ~$0.01 |

---

## 4. Implementation

### 4.1 ValidationAgent Class

```python
class ValidationAgent(BaseAgent):
    """Validates claims against policies using hybrid approach"""
    
    def __init__(self):
        super().__init__("validation_agent", "1.0")
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate claim against policies
        
        Context should contain:
        - claim_id: UUID of the claim
        """
        self.validate_context(context, ["claim_id"])
        
        claim_id = context["claim_id"]
        start_time = datetime.utcnow()
        
        self.logger.info(f"Validating claim {claim_id}")
        
        try:
            # Get claim data
            claim = self._get_claim(claim_id)
            
            # Get applicable policies
            policies = self._get_policies(claim.claim_type, claim.category)
            
            # Layer 1: Rule-based validation (fast, free, deterministic)
            rule_results = self._validate_rules(claim, policies)
            
            # Check if all rules passed
            all_rules_passed = all(r["result"] == "pass" for r in rule_results)
            
            # Layer 2: AI reasoning (only if needed)
            if all_rules_passed:
                # High confidence - no LLM needed
                confidence = 0.98
                recommendation = "AUTO_APPROVE"
                reasoning = "All policy rules satisfied through deterministic checks."
                llm_used = False
            else:
                # Some rules failed - use LLM for edge case reasoning
                llm_result = await self._llm_validation(claim, policies, rule_results)
                confidence = llm_result["confidence"]
                recommendation = llm_result["recommendation"]
                reasoning = llm_result["reasoning"]
                llm_used = True
            
            # Prepare validation result
            validation_result = {
                "agent_name": self.agent_name,
                "executed_at": datetime.utcnow().isoformat(),
                "confidence": confidence,
                "recommendation": recommendation,
                "reasoning": reasoning,
                "rules_checked": rule_results,
                "llm_used": llm_used
            }
            
            # Update claim with validation results
            self._update_claim_validation(claim_id, validation_result)
            
            # Log execution
            self.log_execution(
                claim_id=claim_id,
                status="SUCCESS",
                result_data={
                    "confidence": confidence,
                    "recommendation": recommendation,
                    "llm_used": llm_used
                },
                execution_time_ms=int(execution_time)
            )
            
            return {
                "success": True,
                "claim_id": claim_id,
                "validation": validation_result
            }
            
        except Exception as e:
            self.logger.error(f"Validation failed: {e}")
            raise
```

---

## 5. Rule-Based Validation

### 5.1 Rule Engine

```python
def _validate_rules(self, claim: Any, policies: List[Any]) -> List[Dict[str, Any]]:
    """Rule-based validation - Layer 1"""
    results = []
    
    # Get employee data for tenure check
    employee = self._get_employee(claim.employee_id)
    
    # Rule 1: Amount limit check
    amount_limit = self._get_amount_limit(claim.category, policies)
    if amount_limit:
        results.append({
            "rule_id": f"{claim.category}_AMOUNT",
            "result": "pass" if claim.amount <= amount_limit else "fail",
            "evidence": f"{claim.amount} <= {amount_limit}"
        })
    
    # Rule 2: Tenure requirement
    tenure_months = self._calculate_tenure_months(employee.date_of_joining)
    min_tenure = self._get_min_tenure(claim.category, policies)
    if min_tenure:
        results.append({
            "rule_id": f"{claim.category}_TENURE",
            "result": "pass" if tenure_months >= min_tenure else "fail",
            "evidence": f"{tenure_months} months >= {min_tenure} months"
        })
    
    # Rule 3: Document completeness
    documents = self._get_claim_documents(claim.id)
    required_docs = self._get_required_documents(claim.category, policies)
    has_required_docs = len(documents) >= required_docs
    results.append({
        "rule_id": f"{claim.category}_DOCS",
        "result": "pass" if has_required_docs else "fail",
        "evidence": f"{len(documents)} documents uploaded, {required_docs} required"
    })
    
    # Rule 4: Date validity
    from datetime import date
    max_age_days = 90  # Claims must be within 90 days
    days_old = (date.today() - claim.claim_date).days
    results.append({
        "rule_id": "DATE_VALIDITY",
        "result": "pass" if days_old <= max_age_days else "fail",
        "evidence": f"Claim is {days_old} days old, max allowed: {max_age_days}"
    })
    
    return results
```

### 5.2 Default Policy Limits

```python
def _get_amount_limit(self, category: str, policies: List[Any]) -> float:
    """Get amount limit for category"""
    limits = {
        "CERTIFICATION": 25000,
        "TRAVEL": 50000,
        "TEAM_LUNCH": 500,
        "ONCALL": 2000,
        "OVERTIME": 3000,
    }
    return limits.get(category, 10000)

def _get_min_tenure(self, category: str, policies: List[Any]) -> int:
    """Get minimum tenure in months for category"""
    tenure_requirements = {
        "CERTIFICATION": 6,
        "TRAVEL": 3,
        "TEAM_LUNCH": 0,
        "ONCALL": 1,
    }
    return tenure_requirements.get(category, 0)

def _get_required_documents(self, category: str, policies: List[Any]) -> int:
    """Get required document count"""
    if category in ["CERTIFICATION", "TRAVEL"]:
        return 1
    return 0
```

### 5.3 Rule Result Schema

```json
{
  "rule_id": "CERTIFICATION_AMOUNT",
  "result": "pass",
  "evidence": "5000 <= 25000"
}
```

---

## 6. LLM-Powered Validation

### 6.1 LLM Validation Method

```python
async def _llm_validation(
    self, 
    claim: Any, 
    policies: List[Any], 
    rule_results: List[Dict]
) -> Dict[str, Any]:
    """AI-powered validation for edge cases"""
    
    # Build context for LLM
    failed_rules = [r for r in rule_results if r["result"] == "fail"]
    
    policy_text = "\n\n".join([p.policy_text for p in policies]) if policies else "No specific policy found"
    
    prompt = f"""
Analyze this reimbursement claim for policy compliance:

CLAIM DETAILS:
- Category: {claim.category}
- Amount: {claim.amount} {claim.currency}
- Date: {claim.claim_date}
- Description: {claim.description or 'N/A'}

POLICY RULES:
{policy_text}

RULE-BASED VALIDATION RESULTS:
{self._format_rules(rule_results)}

FAILED RULES:
{self._format_rules(failed_rules) if failed_rules else 'None'}

TASK:
1. Assess if this claim should be approved despite failed rules
2. Consider if there are valid business justifications
3. Provide confidence score (0.0 to 1.0)
4. Make a recommendation: APPROVE, REVIEW, or REJECT

Return in JSON format:
{{
    "confidence": <float>,
    "recommendation": "<APPROVE|REVIEW|REJECT>",
    "reasoning": "<detailed explanation>",
    "justification": "<why this decision makes sense>"
}}
"""
    
    try:
        response = await self.call_llm(
            prompt=prompt,
            system_instruction=(
                "You are a policy compliance expert. "
                "Analyze claims carefully and provide balanced recommendations."
            ),
            temperature=0.3  # Lower temperature for consistent decisions
        )
        
        import json
        result = json.loads(response)
        
        # Adjust confidence based on failed rules
        if failed_rules:
            result["confidence"] = min(result.get("confidence", 0.5), 0.85)
        
        return result
        
    except Exception as e:
        self.logger.error(f"LLM validation failed: {e}")
        return {
            "confidence": 0.5,
            "recommendation": "REVIEW",
            "reasoning": f"LLM validation failed: {e}. Recommend manual review.",
            "justification": "Unable to perform AI validation"
        }
```

### 6.2 LLM Prompt Design

**Prompt Structure:**
1. **Context:** Claim details and policy text
2. **Evidence:** Rule validation results
3. **Task:** Specific instructions for analysis
4. **Output:** Structured JSON format

**Temperature Setting:** 0.3 (low for consistency)

---

## 7. Validation Results

### 7.1 Result Schema

```json
{
  "agent_name": "validation_agent",
  "executed_at": "2024-12-15T10:30:00Z",
  "confidence": 0.92,
  "recommendation": "APPROVE",
  "reasoning": "All policy rules satisfied through deterministic checks.",
  "rules_checked": [
    {
      "rule_id": "CERTIFICATION_AMOUNT",
      "result": "pass",
      "evidence": "5000 <= 25000"
    },
    {
      "rule_id": "CERTIFICATION_TENURE",
      "result": "pass",
      "evidence": "18 months >= 6 months"
    },
    {
      "rule_id": "CERTIFICATION_DOCS",
      "result": "pass",
      "evidence": "1 documents uploaded, 1 required"
    },
    {
      "rule_id": "DATE_VALIDITY",
      "result": "pass",
      "evidence": "Claim is 5 days old, max allowed: 90"
    }
  ],
  "llm_used": false
}
```

### 7.2 Recommendation Types

| Recommendation | Confidence Range | Action |
|----------------|-----------------|--------|
| `AUTO_APPROVE` | >= 0.95 | Skip to settlement |
| `APPROVE` | 0.80 - 0.94 | Manager approval |
| `REVIEW` | 0.60 - 0.79 | HR review |
| `REJECT` | < 0.60 | Rejection |

---

## 8. Confidence Scoring

### 8.1 Score Calculation

```python
# Configuration weights
AI_WEIGHT_DOCUMENT_ATTACHED = 0.20
AI_WEIGHT_DATA_COMPLETENESS = 0.25
AI_WEIGHT_OCR_CONFIDENCE = 0.20
AI_WEIGHT_AMOUNT_REASONABILITY = 0.15
AI_WEIGHT_DUPLICATE_RISK = 0.10
AI_WEIGHT_CATEGORY_MATCH = 0.10

# Thresholds
AI_THRESHOLD_AUTO_APPROVE = 90.0  # >= this: auto-approve
AI_THRESHOLD_QUICK_REVIEW = 70.0  # >= this: quick review
```

### 8.2 Score Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Document Attached | 20% | Required documents present |
| Data Completeness | 25% | All fields properly filled |
| OCR Confidence | 20% | Quality of document extraction |
| Amount Reasonability | 15% | Within expected range |
| Duplicate Risk | 10% | No similar recent claims |
| Category Match | 10% | Claim matches category |

---

## 9. Policy Integration

### 9.1 Policy Lookup

```python
def _get_policies(self, claim_type: str, category: str) -> List[Any]:
    """Get applicable policies"""
    from database import get_sync_db
    from models import Policy
    
    db = next(get_sync_db())
    return db.query(Policy).filter(
        Policy.policy_type == claim_type,
        Policy.category == category,
        Policy.is_active == True
    ).all()
```

### 9.2 Policy Schema

```python
class Policy(Base):
    __tablename__ = "policies"
    
    id = Column(UUID, primary_key=True)
    tenant_id = Column(UUID, nullable=False)
    policy_type = Column(String(50))     # REIMBURSEMENT, ALLOWANCE
    category = Column(String(50))         # CERTIFICATION, TRAVEL, etc.
    policy_name = Column(String(255))
    policy_text = Column(Text)            # Human-readable policy
    rules = Column(JSONB)                 # Structured rules
    amount_limit = Column(Numeric)
    tenure_requirement_months = Column(Integer)
    required_documents = Column(Integer)
    is_active = Column(Boolean, default=True)
```

---

## 10. Database Updates

### 10.1 Update Claim Validation

```python
def _update_claim_validation(self, claim_id: str, validation_result: Dict):
    """Update claim with validation results"""
    from database import get_sync_db
    from models import Claim
    from uuid import UUID
    
    db = next(get_sync_db())
    claim = db.query(Claim).filter(Claim.id == UUID(claim_id)).first()
    
    if claim:
        if not claim.claim_payload:
            claim.claim_payload = {}
        
        claim.claim_payload["validation"] = validation_result
        db.commit()
```

---

## 11. Error Handling

### 11.1 Graceful Degradation

```python
async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # Normal validation flow
        pass
    except PolicyNotFoundError:
        # Use default policies
        self.logger.warning("No policy found, using defaults")
        policies = self._get_default_policies(claim.category)
    except LLMTimeoutError:
        # Fall back to rule-only validation
        self.logger.warning("LLM timeout, using rule-based only")
        return {
            "confidence": 0.7,
            "recommendation": "REVIEW",
            "reasoning": "AI validation unavailable, manual review required"
        }
```

---

## 12. Performance

### 12.1 Timing

| Scenario | Time | LLM Calls |
|----------|------|-----------|
| All rules pass | 50-100ms | 0 |
| Rules fail, LLM needed | 1-3s | 1 |
| LLM timeout fallback | 5s | 0 |

### 12.2 Optimization

1. **Rule-first:** Always run cheap rules first
2. **Cache policies:** Cache policy lookups
3. **Batch queries:** Fetch all needed data at once
4. **Short-circuit:** Exit early on rejection

---

## 13. Celery Task

```python
@celery_app.task(
    name="agents.validation_agent.validate_claim",
    bind=True,
    max_retries=3
)
def validate_claim_task(self, claim_id: str):
    """Celery task to validate claim"""
    import asyncio
    
    agent = ValidationAgent()
    context = {"claim_id": claim_id}
    
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(agent.execute(context))
    
    return result
```

---

## 14. Monitoring

### 14.1 Key Metrics

- Validation success rate
- LLM usage rate (target: <30%)
- Average confidence score
- Rule failure distribution
- Processing time by scenario

### 14.2 Logging

```python
self.logger.info(f"Validating claim {claim_id}")
self.logger.info(f"All rules passed, high confidence: {confidence}")
self.logger.info(f"Using LLM for edge case analysis")
self.logger.warning(f"LLM validation failed: {e}")
self.logger.error(f"Validation failed: {e}")
```

---

*Document Version: 1.0 | Last Updated: December 2025*
