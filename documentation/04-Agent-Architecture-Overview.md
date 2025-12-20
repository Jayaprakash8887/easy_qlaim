# Agent Architecture Overview

## Easy Qlaim - Multi-Agent AI System

### 1. Overview

Easy Qlaim employs a multi-agent architecture where specialized AI agents collaborate to process expense claims. This design provides modularity, scalability, and intelligent decision-making throughout the claim lifecycle.

---

## 2. Agent Ecosystem

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AGENT ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                         ┌─────────────────────────┐                             │
│                         │   ORCHESTRATOR AGENT    │                             │
│                         │   (Master Coordinator)  │                             │
│                         └───────────┬─────────────┘                             │
│                                     │                                            │
│            ┌────────────────────────┼────────────────────────┐                  │
│            │                        │                        │                  │
│            ▼                        ▼                        ▼                  │
│  ┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐     │
│  │  DOCUMENT       │    │   VALIDATION        │    │    APPROVAL         │     │
│  │    AGENT        │    │     AGENT           │    │      AGENT          │     │
│  │                 │    │                     │    │                     │     │
│  │  • OCR Extract  │    │  • Rule Engine      │    │  • Smart Routing    │     │
│  │  • LLM Vision   │    │  • AI Reasoning     │    │  • Auto-Approval    │     │
│  │  • Data Parse   │    │  • Risk Scoring     │    │  • Workflow Mgmt    │     │
│  └─────────────────┘    └─────────────────────┘    └─────────────────────┘     │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                     SUPPORTING AGENTS                                     │   │
│  │  ┌─────────────────────┐        ┌─────────────────────────────────────┐  │   │
│  │  │  NOTIFICATION       │        │  DUPLICATE DETECTION                │  │   │
│  │  │    AGENT            │        │       AGENT                         │  │   │
│  │  │  • Email Alerts     │        │  • Similarity Check                 │  │   │
│  │  │  • Status Updates   │        │  • Fraud Prevention                 │  │   │
│  │  └─────────────────────┘        └─────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Responsibilities

### 3.1 Agent Summary Table

| Agent | Responsibility | Triggers | LLM Usage |
|-------|----------------|----------|-----------|
| **Orchestrator** | Workflow coordination | Claim submission | No |
| **Document** | OCR & data extraction | Has attachments | Yes (Vision) |
| **Validation** | Policy compliance check | Always | Conditional |
| **Approval** | Routing & auto-approval | Always | No |
| **Notification** | User alerts | Status changes | No |
| **Duplicate Detection** | Fraud prevention | Optional | Yes |

### 3.2 Agent Execution Order

**Reimbursement Claims (with documents):**
```
1. Orchestrator Agent
   │
   ├─► 2. Document Agent (OCR Processing)
   │       └─► Extract text, parse amounts, dates
   │
   ├─► 3. Validation Agent (Policy Check)
   │       ├─► Rule-based validation first
   │       └─► LLM reasoning if rules fail
   │
   └─► 4. Approval Agent (Routing)
           └─► Route based on confidence + rules
```

**Allowance Claims (no documents):**
```
1. Orchestrator Agent
   │
   ├─► 2. Validation Agent (Policy Check)
   │       └─► Rule-based validation
   │
   └─► 3. Approval Agent (Routing)
           └─► Route based on confidence
```

---

## 4. Base Agent Architecture

### 4.1 Base Agent Class

All agents inherit from a common base class:

```python
class BaseAgent(ABC):
    """
    Abstract base class for all agents.
    Provides common functionality: logging, LLM calls, execution tracking.
    """
    
    def __init__(self, agent_name: str, version: str):
        self.agent_name = agent_name
        self.version = version
        self.logger = logging.getLogger(f"agent.{agent_name}")
    
    @abstractmethod
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent's primary task."""
        pass
    
    def validate_context(self, context: Dict, required_keys: List[str]):
        """Ensure required context keys are present."""
        missing = [key for key in required_keys if key not in context]
        if missing:
            raise ValueError(f"Missing required context keys: {missing}")
    
    async def call_llm(
        self, 
        prompt: str, 
        system_instruction: str = None,
        temperature: float = 0.7
    ) -> str:
        """Call configured LLM provider."""
        # Uses multi-provider LLM service
        return await llm_service.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=temperature
        )
    
    def log_execution(
        self,
        claim_id: str,
        status: str,
        result_data: Dict,
        execution_time_ms: int,
        error_message: str = None
    ):
        """Log agent execution to database for audit."""
        execution = AgentExecution(
            agent_name=self.agent_name,
            agent_version=self.version,
            claim_id=UUID(claim_id),
            status=status,
            result_data=result_data,
            execution_time_ms=execution_time_ms,
            error_message=error_message,
            executed_at=datetime.utcnow()
        )
        db.add(execution)
        db.commit()
```

### 4.2 Agent Execution Model

```python
class AgentExecution(Base):
    """
    Tracks every agent execution for audit and debugging.
    """
    __tablename__ = "agent_executions"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID, nullable=False)
    claim_id = Column(UUID, ForeignKey("claims.id"))
    
    # Agent info
    agent_name = Column(String(50), nullable=False)
    agent_version = Column(String(20), nullable=False)
    
    # Execution details
    status = Column(String(20))  # SUCCESS, FAILURE, PARTIAL
    result_data = Column(JSONB)
    execution_time_ms = Column(Integer)
    error_message = Column(Text)
    
    # Timing
    executed_at = Column(DateTime(timezone=True))
```

---

## 5. Workflow Orchestration

### 5.1 Celery Task Chains

Agents are executed as Celery tasks in chains:

```python
# Reimbursement workflow
workflow = chain(
    process_documents_task.s(claim_id),    # Document Agent
    validate_claim_task.s(claim_id),        # Validation Agent
    route_claim_task.s(claim_id),           # Approval Agent
)

# Execute workflow
workflow.apply_async()
```

### 5.2 Workflow Visualization

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CLAIM PROCESSING WORKFLOW                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Employee                                                                        │
│  Submits    ──▶ ┌─────────────┐                                                 │
│  Claim          │   API       │                                                 │
│                 │  Endpoint   │                                                 │
│                 └──────┬──────┘                                                 │
│                        │                                                         │
│                        ▼                                                         │
│                 ┌─────────────┐                                                 │
│                 │   Celery    │                                                 │
│                 │   Queue     │                                                 │
│                 └──────┬──────┘                                                 │
│                        │                                                         │
│                        ▼                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐     │
│  │                      ORCHESTRATOR AGENT                                 │     │
│  │                                                                         │     │
│  │   1. Set claim status: AI_PROCESSING                                   │     │
│  │   2. Determine workflow based on claim type                            │     │
│  │   3. Build task chain                                                   │     │
│  │   4. Execute chain                                                      │     │
│  └──────────────────────────────┬─────────────────────────────────────────┘     │
│                                 │                                                │
│           ┌─────────────────────┼─────────────────────┐                         │
│           ▼                     ▼                     ▼                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ Document Agent  │─▶│ Validation Agent│─▶│ Approval Agent  │                 │
│  │                 │  │                 │  │                 │                 │
│  │ Input:          │  │ Input:          │  │ Input:          │                 │
│  │ - Claim ID      │  │ - Claim ID      │  │ - Claim ID      │                 │
│  │ - Documents     │  │ - OCR data      │  │ - Validation    │                 │
│  │                 │  │ - Policies      │  │   results       │                 │
│  │ Output:         │  │                 │  │                 │                 │
│  │ - OCR text      │  │ Output:         │  │ Output:         │                 │
│  │ - Parsed data   │  │ - Confidence    │  │ - New status    │                 │
│  │ - Confidence    │  │ - Recommendation│  │ - Routing       │                 │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
│                                                │                                 │
│                                                ▼                                 │
│                                       ┌─────────────────┐                       │
│                                       │  Notification   │                       │
│                                       │     Agent       │                       │
│                                       └─────────────────┘                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. LLM Integration

### 6.1 Multi-Provider Support

Easy Qlaim supports multiple LLM providers:

```python
# Supported LLM providers
LLM_PROVIDERS = {
    "gemini": "Google Gemini 2.0",
    "openai": "OpenAI GPT-4",
    "azure_openai": "Azure OpenAI",
    "anthropic": "Anthropic Claude",
    "bedrock": "AWS Bedrock",
    "ollama": "Local Ollama"
}

# Provider configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini")
```

### 6.2 LLM Usage Strategy

**Cost Optimization:**
1. **Rule-based first:** All validations start with deterministic rules
2. **LLM on exception:** Only invoke LLM when rules fail or confidence is low
3. **Caching:** Cache LLM responses where appropriate
4. **Temperature control:** Lower temperature for factual tasks

```python
class ValidationAgent(BaseAgent):
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        # Layer 1: Rule-based validation (FREE, FAST)
        rule_results = self._validate_rules(claim, policies)
        
        all_rules_passed = all(r["result"] == "pass" for r in rule_results)
        
        if all_rules_passed:
            # High confidence - NO LLM NEEDED
            return {
                "confidence": 0.98,
                "recommendation": "AUTO_APPROVE",
                "llm_used": False
            }
        else:
            # Some rules failed - USE LLM for reasoning
            llm_result = await self._llm_validation(claim, policies, rule_results)
            return {
                **llm_result,
                "llm_used": True
            }
```

### 6.3 LLM Prompt Engineering

**Structured Output:**
```python
VALIDATION_PROMPT = """
Analyze this reimbursement claim for policy compliance:

CLAIM DETAILS:
- Category: {category}
- Amount: {amount} {currency}
- Date: {claim_date}
- Description: {description}

POLICY RULES:
{policy_text}

RULE-BASED VALIDATION RESULTS:
{rule_results}

FAILED RULES:
{failed_rules}

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
```

---

## 7. Agent Communication

### 7.1 Data Flow Between Agents

Agents communicate through the claim record:

```python
# Document Agent updates claim
claim.claim_payload["ocr_results"] = {
    "text": "...",
    "confidence": 0.95,
    "extracted_data": {...}
}

# Validation Agent reads and updates
ocr_data = claim.claim_payload.get("ocr_results", {})
claim.claim_payload["validation"] = {
    "confidence": 0.85,
    "recommendation": "APPROVE",
    "rules_checked": [...]
}

# Approval Agent reads validation
validation = claim.claim_payload.get("validation", {})
# Routes based on confidence and recommendation
```

### 7.2 Claim Payload Schema

```json
{
  "claim_payload": {
    "submitted_data": {
      "employee_id": "uuid",
      "amount": 5000,
      "category": "CERTIFICATION"
    },
    
    "ocr_results": {
      "documents_processed": 1,
      "results": [
        {
          "document_id": "uuid",
          "confidence": 0.95,
          "extracted_data": {
            "amount": 5000,
            "vendor": "AWS Training",
            "date": "2024-12-01"
          }
        }
      ]
    },
    
    "validation": {
      "agent_name": "validation_agent",
      "executed_at": "2024-12-15T10:30:00Z",
      "confidence": 0.92,
      "recommendation": "APPROVE",
      "reasoning": "All policy rules satisfied",
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
        }
      ],
      "llm_used": false
    },
    
    "routing": {
      "routed_to": "MANAGER",
      "auto_approved": false,
      "routed_at": "2024-12-15T10:30:05Z"
    }
  }
}
```

---

## 8. Error Handling

### 8.1 Agent Error Recovery

```python
class OrchestratorAgent(BaseAgent):
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Execute workflow
            result = await self._run_workflow(context)
            return result
            
        except Exception as e:
            self.logger.error(f"Orchestration failed: {e}")
            
            # Update claim status to indicate failure
            self._update_claim_status(claim_id, "REJECTED")
            
            # Log execution with error
            self.log_execution(
                claim_id=claim_id,
                status="FAILURE",
                result_data={},
                execution_time_ms=int(execution_time),
                error_message=str(e)
            )
            
            # Re-raise for Celery retry mechanism
            raise
```

### 8.2 Celery Retry Configuration

```python
@celery_app.task(
    name="agents.document_agent.process_documents",
    bind=True,
    max_retries=3,
    default_retry_delay=60,  # 1 minute
    autoretry_for=(Exception,),
    retry_backoff=True
)
def process_documents_task(self, claim_id: str):
    """Process documents with automatic retry on failure."""
    try:
        agent = DocumentAgent()
        return agent.execute({"claim_id": claim_id})
    except Exception as e:
        self.retry(exc=e)
```

---

## 9. Performance Optimization

### 9.1 Agent Execution Metrics

| Agent | Avg. Time | Max Time | LLM Calls |
|-------|-----------|----------|-----------|
| Orchestrator | 50ms | 200ms | 0 |
| Document | 3-5s | 10s | 0-1 |
| Validation | 100ms-2s | 5s | 0-1 |
| Approval | 50ms | 200ms | 0 |

### 9.2 Optimization Strategies

1. **Parallel processing:** Process multiple documents concurrently
2. **Caching:** Cache policy lookups and LLM responses
3. **Early exit:** Skip unnecessary steps when possible
4. **Batch operations:** Group database writes

```python
class DocumentAgent(BaseAgent):
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        documents = self._get_claim_documents(claim_id)
        
        if not documents:
            # Early exit - no documents to process
            return {"success": True, "documents_processed": 0}
        
        # Process documents in parallel
        tasks = [self._process_document(doc) for doc in documents]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            "success": True,
            "documents_processed": len(results)
        }
```

---

## 10. Monitoring & Debugging

### 10.1 Agent Execution Dashboard

```sql
-- Query agent performance metrics
SELECT 
    agent_name,
    status,
    COUNT(*) as executions,
    AVG(execution_time_ms) as avg_time_ms,
    MAX(execution_time_ms) as max_time_ms,
    SUM(CASE WHEN status = 'FAILURE' THEN 1 ELSE 0 END) as failures
FROM agent_executions
WHERE executed_at >= NOW() - INTERVAL '24 hours'
GROUP BY agent_name, status
ORDER BY agent_name;
```

### 10.2 Debugging Agent Flows

```python
# Enable verbose agent logging
logging.getLogger("agent").setLevel(logging.DEBUG)

# View claim processing history
executions = db.query(AgentExecution).filter(
    AgentExecution.claim_id == claim_id
).order_by(AgentExecution.executed_at).all()

for exec in executions:
    print(f"{exec.executed_at}: {exec.agent_name} - {exec.status}")
    print(f"  Result: {exec.result_data}")
    if exec.error_message:
        print(f"  Error: {exec.error_message}")
```

---

*Document Version: 1.0 | Last Updated: December 2025*
