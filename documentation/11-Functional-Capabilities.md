# Functional Capabilities

## Easy Qlaim - Complete Feature Guide

### 1. Overview

Easy Qlaim provides comprehensive expense reimbursement and allowance management capabilities for organizations of all sizes. This document covers all functional features available to different user roles.

---

## 2. User Roles & Capabilities

### 2.1 Role Matrix

| Role | Submit Claims | Approve Claims | View Reports | Manage Users | Configure System |
|------|--------------|----------------|--------------|--------------|------------------|
| Employee | ✅ Own | ❌ | ✅ Own | ❌ | ❌ |
| Manager | ✅ Own | ✅ Team | ✅ Team | ❌ | ❌ |
| HR | ✅ Own | ✅ All | ✅ All | ✅ Limited | ✅ Policies |
| Finance | ✅ Own | ✅ Final | ✅ Financial | ❌ | ❌ |
| Admin | ✅ Own | ✅ All | ✅ All | ✅ Full | ✅ Full |

---

## 3. Claim Submission

### 3.1 Reimbursement Claims

Claims for expenses paid by employees that require receipt verification.

**Supported Categories:**
| Category | Description | Max Limit | Docs Required |
|----------|-------------|-----------|---------------|
| CERTIFICATION | Professional exams, courses | ₹25,000 | Yes |
| TRAVEL | Business travel expenses | ₹50,000 | Yes |
| TEAM_LUNCH | Team meals | ₹500/person | Yes |
| EQUIPMENT | Work equipment | ₹20,000 | Yes |
| TRAINING | Training programs | ₹30,000 | Yes |

**Submission Flow:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Select Type    │───▶│  Fill Details   │───▶│  Upload Docs    │
│  & Category     │    │  & Amount       │    │  (Receipts)     │
└─────────────────┘    └─────────────────┘    └────────┬────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  AI Processing  │
                                              │  (OCR + Valid.) │
                                              └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │   Submitted     │
                                              └─────────────────┘
```

### 3.2 Allowance Claims

Fixed-amount claims that don't require receipts.

**Supported Categories:**
| Category | Description | Amount | Frequency |
|----------|-------------|--------|-----------|
| ONCALL | On-call duty allowance | ₹2,000/day | Per occurrence |
| OVERTIME | Overtime allowance | ₹3,000/day | Per occurrence |
| WFH | Work from home allowance | ₹500/day | Monthly |
| PHONE | Mobile recharge | ₹500/month | Monthly |

**Submission Flow:**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Select         │───▶│  Fill Details   │───▶│   Submitted     │
│  Allowance Type │    │  & Dates        │    │   (No Docs)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 3.3 Document Upload

**Supported Formats:**
- PDF (up to 10MB)
- JPEG/JPG (up to 10MB)
- PNG (up to 10MB)
- GIF (up to 5MB)

**Document Processing:**
1. Upload validation (size, format, content-type)
2. Virus scanning (if enabled)
3. Cloud storage sync
4. OCR text extraction
5. AI data parsing

---

## 4. Approval Workflow

### 4.1 Workflow States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLAIM LIFECYCLE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SUBMITTED ──▶ AI_PROCESSING ──┬─────▶ AUTO_APPROVED (High Confidence)      │
│                                │                                             │
│                                ├─────▶ PENDING_MANAGER                      │
│                                │              │                              │
│                                │       ┌──────┴──────┐                      │
│                                │       ▼             ▼                      │
│                                │   APPROVED     RETURNED                    │
│                                │       │             │                      │
│                                │       ▼             ▼                      │
│                                │   PENDING_HR   EDIT_MODE                   │
│                                │       │             │                      │
│                                │       ▼             ▼                      │
│                                │   HR_APPROVED  RE-SUBMIT                   │
│                                │       │                                    │
│                                │       ▼                                    │
│                                │   PENDING_FINANCE                          │
│                                │       │                                    │
│                                │       ▼                                    │
│                                └─────▶ SETTLED                              │
│                                                                              │
│  Any Stage ───▶ REJECTED                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Manager Actions

| Action | Description | Result |
|--------|-------------|--------|
| **Approve** | Accept claim | Advances to HR/Finance |
| **Reject** | Decline claim | Claim rejected |
| **Return** | Request changes | Returns to employee |
| **Comment** | Add notes | Visible in history |

### 4.3 HR Actions

| Action | Description | Result |
|--------|-------------|--------|
| **Approve** | Policy exception approved | Advances to Finance |
| **Reject** | Policy violation | Claim rejected |
| **Correct** | Fix employee data | Updates claim details |
| **Return** | Request changes | Returns to employee |

### 4.4 Finance Actions

| Action | Description | Result |
|--------|-------------|--------|
| **Approve** | Ready for payment | Mark as FINANCE_APPROVED |
| **Settle** | Process payment | Mark as SETTLED |
| **Reject** | Financial issues | Claim rejected |

---

## 5. AI-Powered Features

### 5.1 Intelligent Document Processing

**OCR Extraction:**
- Automatic text extraction from receipts
- Multi-page PDF support
- Handwritten text recognition
- Multiple language support

**Data Parsing:**
- Amount detection and validation
- Date extraction
- Vendor identification
- Category suggestion

### 5.2 Smart Validation

**Rule-Based Checks:**
- Amount limits by category
- Tenure requirements
- Document completeness
- Date validity

**AI Reasoning:**
- Policy exception analysis
- Business justification review
- Fraud pattern detection
- Duplicate claim detection

### 5.3 Auto-Approval

**Criteria:**
- Confidence score ≥ 95%
- All rules passed
- Auto-approval enabled
- Within amount limits

**Benefits:**
- Instant processing (<1 minute)
- Reduced manager workload
- Faster reimbursements

---

## 6. Dashboard & Reports

### 6.1 Employee Dashboard

**Widgets:**
- Claims summary (pending, approved, rejected)
- Recent claim status
- Quick actions
- Notification center

**Views:**
- My Claims list
- Claim details
- Document viewer
- Comment history

### 6.2 Manager Dashboard

**Widgets:**
- Team claims pending
- Approval queue
- Team analytics
- Recent activity

**Views:**
- Pending approvals
- Team member claims
- Approval history

### 6.3 HR Dashboard

**Widgets:**
- Organization-wide metrics
- Policy exception queue
- Employee corrections needed
- Compliance alerts

**Views:**
- All claims
- Policy violations
- Employee management
- Policy management

### 6.4 Finance Dashboard

**Widgets:**
- Settlement queue
- Payment processing
- Budget tracking
- Financial reports

**Views:**
- Pending settlements
- Payment history
- Export reports
- Budget analysis

### 6.5 Analytics & Reports

| Report | Description | Roles |
|--------|-------------|-------|
| Claims Summary | Claims by status, category | All |
| Financial Summary | Amount by category, period | Finance, Admin |
| Processing Time | Average approval duration | HR, Admin |
| Rejection Analysis | Rejection reasons breakdown | HR, Admin |
| Employee Trends | Individual spending patterns | HR, Admin |

---

## 7. Policy Management

### 7.1 Policy Configuration

**Configurable Elements:**
- Amount limits per category
- Tenure requirements
- Required documents
- Approval hierarchy
- Auto-approval thresholds

### 7.2 Policy Categories

```python
# Example policy structure
{
    "category": "CERTIFICATION",
    "amount_limit": 25000,
    "tenure_requirement_months": 6,
    "required_documents": 1,
    "approval_levels": ["MANAGER", "HR", "FINANCE"],
    "auto_approval_enabled": True,
    "description": "Professional certification reimbursement"
}
```

### 7.3 Policy Exceptions

HR can handle policy exceptions:
- Amount limit overrides
- Tenure waivers
- Document exemptions
- Special approvals

---

## 8. User Management

### 8.1 User Administration

**Capabilities:**
- Create/edit/deactivate users
- Assign roles
- Set manager relationships
- Map designations to roles

### 8.2 Designation Mapping

Each tenant can define their own designation-to-role mappings:

```
┌─────────────────────────────────────────────────────────────┐
│  HR Title (from HRMS)     │  Application Roles             │
├───────────────────────────┼─────────────────────────────────┤
│  Junior Engineer          │  EMPLOYEE                      │
│  Senior Engineer          │  EMPLOYEE                      │
│  Tech Lead                │  EMPLOYEE, MANAGER             │
│  HR Executive             │  EMPLOYEE, HR                  │
│  Finance Controller       │  EMPLOYEE, FINANCE             │
│  Department Head          │  EMPLOYEE, MANAGER, ADMIN      │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Manager Hierarchy

- Employees are assigned to managers
- Managers see only their team's claims
- Claims auto-route to assigned manager
- Bulk reassignment supported

---

## 9. Notifications

### 9.1 In-App Notifications

**Types:**
- Claim status changes
- Approval requests
- Return notifications
- Settlement confirmations

### 9.2 Email Notifications

**Triggers:**
- New claim submission
- Pending approval reminder
- Claim approved/rejected
- Settlement processed

### 9.3 Notification Preferences

Users can configure:
- Email notifications on/off
- Real-time vs digest
- Notification types

---

## 10. Settlement Processing

### 10.1 Payment Methods

| Method | Description |
|--------|-------------|
| NEFT | Bank transfer (standard) |
| RTGS | Bank transfer (urgent) |
| UPI | UPI payment |
| CHEQUE | Physical cheque |
| CASH | Cash disbursement |

### 10.2 Settlement Workflow

```
FINANCE_APPROVED ──▶ Process Payment ──▶ Enter Reference ──▶ SETTLED
```

### 10.3 Settlement Records

- Payment reference number
- Payment date
- Payment method
- Amount paid
- Settled by (user)

---

## 11. Search & Filters

### 11.1 Search Capabilities

**Full-Text Search:**
- Claim number
- Employee name
- Description
- OCR text content

### 11.2 Filter Options

| Filter | Options |
|--------|---------|
| Status | All statuses |
| Category | All categories |
| Date Range | Custom range |
| Amount Range | Min-Max |
| Employee | Dropdown |
| Department | Dropdown |

### 11.3 Bulk Operations

- Bulk approve (Managers/HR)
- Bulk export (All roles)
- Bulk status update (Admin)

---

## 12. Data Export

### 12.1 Export Formats

- CSV (for spreadsheets)
- Excel (XLSX)
- PDF (for reports)

### 12.2 Export Options

| Export | Data Included |
|--------|---------------|
| Claims List | All claim fields |
| Financial Report | Amounts, categories, dates |
| Audit Report | Actions, timestamps, users |

---

## 13. Integration Features

### 13.1 HRMS Integration

- Employee data sync
- Department hierarchy
- Manager relationships
- Designation mappings

### 13.2 Payroll Integration

- Settlement export
- Payment reference import
- Reconciliation reports

### 13.3 SSO Integration

- Keycloak SSO support
- SAML/OIDC protocols
- Automatic user provisioning

---

## 14. Mobile Responsiveness

### 14.1 Mobile-Optimized Features

- Responsive dashboard
- Touch-friendly forms
- Mobile document upload
- Camera integration for receipts
- Push notifications

### 14.2 PWA Capabilities

- Installable on mobile
- Offline form caching
- Background sync

---

## 15. Audit & Compliance

### 15.1 Audit Trail

All actions are logged:
- Who performed the action
- When it was performed
- What was changed
- IP address and device

### 15.2 Compliance Features

- Data retention policies
- GDPR data export
- Role-based access logs
- Sensitive data masking

---

*Document Version: 1.0 | Last Updated: December 2024*
