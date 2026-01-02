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
| System Admin | ❌ | ❌ | ✅ Platform | ✅ Tenants | ✅ Platform |

### 2.2 System Admin Capabilities

System Admin is a platform-level role with access to:

**Dashboard:**
- Platform administration overview
- Tenant organizations list with status
- System health monitoring (API, Database, Security)
- Quick actions for tenant and designation management

**Navigation:**
- Dashboard (Platform overview)
- Tenants (Manage tenant organizations)
- Designations (Manage role designations)
- Settings (Platform-wide configuration)

**Platform Settings:**
- Maintenance mode with custom message
- Platform session timeout (maximum for all tenants)
- Maximum login attempts
- Email/SMTP configuration
- Database status monitoring
- Cache management (platform and tenant-level)

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

### 4.5 Approval Skip Rules (CXO/Executive Fast-Track)

This feature allows administrators to configure rules that automatically skip certain approval levels for designated employees (e.g., CXOs, executives, VPs). This enables faster reimbursement processing for senior leadership.

**Use Cases:**
- Skip manager approval for C-suite executives (CEO, CTO, CFO, etc.)
- Skip all approvals for board members with pre-approved expense budgets
- Fast-track specific individuals by email address

**Configuration Location:**
- Admin Dashboard → Approval Rules → Skip Rules tab

**Rule Types:**

| Match Type | Description | Example |
|------------|-------------|---------|
| **Designation** | Match by job title/designation code | `['CEO', 'CTO', 'CFO', 'VP']` |
| **Email** | Match by specific email addresses | `['ceo@company.com', 'cto@company.com']` |

**Skip Options:**

| Option | Description | Default |
|--------|-------------|---------|
| Skip Manager Approval | Bypass manager review | `false` |
| Skip HR Approval | Bypass HR review | `false` |
| Skip Finance Approval | Bypass finance review | `false` |

**Optional Constraints:**

| Constraint | Description |
|------------|-------------|
| Max Amount Threshold | Rule only applies to claims below this amount (NULL = no limit) |
| Category Codes | Specific categories this rule applies to (empty = all categories) |
| Priority | Lower number = higher priority, checked first (1-100 recommended) |

**Workflow with Skip Rules:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               CLAIM WITH APPROVAL SKIP RULES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SUBMITTED ──▶ AI_PROCESSING ──▶ Check Skip Rules                           │
│                                         │                                    │
│                      ┌──────────────────┴──────────────────┐                │
│                      ▼                                      ▼                │
│              Rule Matches                            No Rule Match           │
│              (e.g., CEO)                            (Normal Flow)            │
│                      │                                      │                │
│           ┌──────────┼──────────┐                          │                │
│           ▼          ▼          ▼                          ▼                │
│      Skip Mgr   Skip HR   Skip Fin           PENDING_MANAGER                │
│           │          │          │                          │                │
│           ▼          ▼          ▼                          ▼                │
│      Goes directly to next non-skipped level        Normal workflow         │
│                      │                                                       │
│                      ▼                                                       │
│              FINANCE_APPROVED (if all skipped)                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Example Configurations:**

1. **CEO Full Skip:**
   - Rule Name: `CEO Fast Track`
   - Match Type: `designation`
   - Designations: `['CEO']`
   - Skip Manager: ✅
   - Skip HR: ✅
   - Skip Finance: ✅

2. **VPs Skip Manager Only:**
   - Rule Name: `VP Manager Skip`
   - Match Type: `designation`
   - Designations: `['VP', 'SVP', 'EVP']`
   - Skip Manager: ✅
   - Skip HR: ❌
   - Skip Finance: ❌
   - Max Amount: `50000`

3. **Specific Executive:**
   - Rule Name: `Board Member Express`
   - Match Type: `email`
   - Emails: `['board.member@company.com']`
   - Skip Manager: ✅
   - Skip HR: ✅
   - Skip Finance: ❌

4. **Project-Based Skip:**
   - Rule Name: `High Priority Projects`
   - Match Type: `project`
   - Project Codes: `['PROJ-001', 'PROJ-002']`
   - Skip Manager: ✅
   - Skip HR: ❌
   - Skip Finance: ❌
   - Description: Skip manager approval for high-priority projects

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/approval-skip-rules/` | List all rules for tenant |
| POST | `/api/v1/approval-skip-rules/` | Create new rule |
| GET | `/api/v1/approval-skip-rules/{id}` | Get specific rule |
| PUT | `/api/v1/approval-skip-rules/{id}` | Update rule |
| DELETE | `/api/v1/approval-skip-rules/{id}` | Delete rule |
| GET | `/api/v1/approval-skip-rules/check/{user_id}` | Check applicable rules for user |

**Database Table:**
- Table name: `approval_skip_rules`
- Migration: `003_create_approval_skip_rules.sql`

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

**Admin Control:**
- **Enable Auto-Approval (Admin Setting)**: Master switch to enable/disable all auto-approval functionality
- When disabled, all claims go through manual approval workflow regardless of confidence

**Initial Auto-Approval Criteria:**
- Auto-approval enabled by admin
- Confidence score ≥ configured threshold (default 95%)
- Claim amount ≤ max auto-approval amount
- AI recommendation is APPROVE or AUTO_APPROVE
- All policy rules passed

**Auto-Skip After Manager Approval:**
When enabled, claims that meet the following criteria will skip HR and Finance review after manager approval:
- Confidence score ≥ auto-approval threshold
- No policy exceptions (failed rules)
- Claim amount within limits

**Routing Logic:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTELLIGENT CLAIM ROUTING                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  confidence ≥ 95% + amount ≤ max + APPROVE ──▶ FINANCE_APPROVED (auto)     │
│                                                                              │
│  policy exceptions exist ──▶ PENDING_HR                                     │
│                                                                              │
│  confidence ≥ policy_threshold ──▶ PENDING_MANAGER                          │
│                                                                              │
│  confidence < 60% ──▶ REJECTED                                              │
│                                                                              │
│  After Manager Approval (if auto-skip enabled):                             │
│    high confidence + no exceptions ──▶ FINANCE_APPROVED                     │
│    policy exceptions ──▶ PENDING_HR                                         │
│    default ──▶ PENDING_FINANCE                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Instant processing (<1 minute) for high-confidence claims
- Reduced manager workload
- Faster reimbursements
- Configurable thresholds per tenant

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

### 8.4 Department Management

Departments are now tenant-specific and managed via API. Admins can:

**CRUD Operations:**
- Create new departments with code, name, description
- Update department details
- Activate/deactivate departments
- Delete departments (only if no employees assigned)

**Department Properties:**
| Field | Description |
|-------|-------------|
| Code | Unique short code (e.g., ENG, HR, FIN) |
| Name | Full department name |
| Description | Optional description |
| Head | Optional department head (employee) |
| Display Order | Ordering for dropdowns |
| Active Status | Enable/disable without deleting |

**Access Control:**
- Only Admin users can access Department Management
- Departments are isolated per tenant
- Employee counts shown for each department

**Navigation:**
Admin sidebar → Departments

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

### 13.4 Communication Integrations (Slack/Teams)

Real-time notifications to team communication channels when claim events occur.

**Supported Providers:**
| Provider | Webhook Types | Notes |
|----------|---------------|-------|
| Slack | Incoming Webhooks | Standard Slack webhook URL |
| Microsoft Teams | Office 365 Connector, Power Automate | Supports both direct webhooks and Power Automate workflows |

**Notification Events:**
| Event | Description | Notification Content |
|-------|-------------|---------------------|
| Claim Submitted | New claim submitted | Claim #, employee, amount, category |
| Claim Approved | Claim approved by approver | Claim #, employee, amount, approved by |
| Claim Rejected | Claim rejected | Claim #, employee, amount, rejected by, reason |
| Claim Settled | Payment processed | Claim #, employee, amount, payment date |

**Configuration:**

**Navigation:** Admin Dashboard → Settings → Communication Integrations tab

| Field | Description |
|-------|-------------|
| Provider | Select Slack or Microsoft Teams |
| Webhook URL | Incoming webhook URL from your chat platform |
| Channel Name | Display name for the channel (reference only) |
| Notify on Submitted | Enable notifications when claims are submitted |
| Notify on Approved | Enable notifications when claims are approved |
| Notify on Rejected | Enable notifications when claims are rejected |
| Enable Integration | Master toggle to activate/deactivate notifications |

**Teams Power Automate Support:**
The system automatically detects Microsoft Power Automate webhook URLs and sends notifications in Adaptive Card format, which provides rich formatting in Teams channels.

**Example Teams Notification:**
```
🟢 Claim Approved
━━━━━━━━━━━━━━━━━━━━━━
Claim #: CLM-2025-0042
Employee: John Doe
Amount: ₹5,000.00
Category: Certification
Approved by: Jane Manager
```

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

## 15. System Settings (Admin)

### 15.1 General Settings

**Navigation:** Admin Dashboard → Settings → General tab

Admin users can configure basic tenant-wide settings:

| Setting | Description | Options |
|---------|-------------|---------|
| Default Currency | Default currency for claims | USD, EUR, GBP, INR, AED, SGD, JPY |
| Fiscal Year Start | When fiscal year begins | January, April, July, October |

### 15.2 Approval Rules

**Navigation:** Admin Dashboard → Approval Rules

All approval-related settings are consolidated in a dedicated menu:

#### Auto-Approval Tab

| Setting | Description | Options |
|---------|-------------|---------|
| Auto-Approval | Automatically approve high-confidence claims | On/Off |
| **Enable Auto-Approval (Admin)** | Master switch to enable/disable all auto-approval | On/Off |
| **Auto-Skip After Manager** | Skip HR/Finance after manager approval if thresholds met | On/Off |
| AI Confidence Threshold | Minimum AI confidence for auto-approval | 50% - 100% |
| Max Auto-Approval Amount | Maximum claim amount for auto-approval | Currency amount |
| Policy Compliance Threshold | Minimum AI confidence for policy compliance | 50% - 100% |

**Enable Auto-Approval (Admin):**
Master control for the auto-approval feature:
- **Enabled (default)**: Claims meeting criteria are auto-approved
- **Disabled**: All claims require manual approval workflow
- Affects initial routing and post-manager approval behavior

**Auto-Skip After Manager Approval:**
When enabled and thresholds are met after manager approval:
- High confidence + no policy exceptions → Skip directly to FINANCE_APPROVED
- Policy exceptions exist → Route to HR
- Otherwise → Route to Finance

**Policy Compliance Threshold:**
This setting controls when claims are flagged for review vs considered compliant:
- **Above threshold**: Claim is considered policy-compliant
- **Below threshold**: Claim is flagged for manual policy review
- **Default**: 80%
- **Use case**: Lower thresholds (e.g., 60%) allow more claims to pass; higher thresholds (e.g., 90%) require stricter compliance

#### Skip Rules Tab

Configure rules to automatically skip approval levels for designated employees. See section 4.5 for details.

### 15.3 Regional Settings

Each tenant can configure regional preferences:

**Timezone Configuration:**
| Code | Timezone | UTC Offset |
|------|----------|------------|
| IST | India Standard Time | UTC+5:30 |
| UTC | Coordinated Universal Time | UTC+0:00 |
| EST | Eastern Standard Time | UTC-5:00 |
| PST | Pacific Standard Time | UTC-8:00 |
| GMT | Greenwich Mean Time | UTC+0:00 |
| CET | Central European Time | UTC+1:00 |
| JST | Japan Standard Time | UTC+9:00 |
| AEST | Australian Eastern Standard Time | UTC+10:00 |
| SGT | Singapore Time | UTC+8:00 |
| GST | Gulf Standard Time | UTC+4:00 |

**Date Format Options:**
| Format | Example | Common Usage |
|--------|---------|--------------|
| DD/MM/YYYY | 19/12/2025 | India, UK, Europe |
| MM/DD/YYYY | 12/19/2025 | USA |
| YYYY-MM-DD | 2025-12-19 | ISO/International |
| DD-MM-YYYY | 19-12-2025 | Alternative |
| DD.MM.YYYY | 19.12.2025 | Germany |

**Number Format Options:**
| Locale | Example | Description |
|--------|---------|-------------|
| en-IN | 1,00,000.00 | Indian format |
| en-US | 100,000.00 | US/UK format |
| de-DE | 100.000,00 | German format |
| fr-FR | 100 000,00 | French format |
| es-ES | 100.000,00 | Spanish format |

**Impact of Regional Settings:**
- All claim timestamps displayed in tenant timezone
- Dashboard "this month" calculations use tenant timezone
- Report date ranges respect tenant timezone
- Notifications show times in tenant timezone
- Currency amounts formatted per locale

### 15.4 Working Days Configuration

Configure work week preferences:

**Working Days Options:**
| Option | Days | Common Usage |
|--------|------|--------------|
| Monday - Friday | Mon-Fri | Standard Western |
| Monday - Saturday | Mon-Sat | Many Asian countries |
| Sunday - Thursday | Sun-Thu | Middle East |
| Saturday - Wednesday | Sat-Wed | Alternative Middle East |

**Week Start Day:**
| Option | Common Usage |
|--------|--------------|
| Sunday | USA, Israel |
| Monday | Europe, India |
| Saturday | Middle East |

### 15.5 Security Settings

Configure session and security preferences:

**Session Timeout Options:**
| Duration | Use Case |
|----------|----------|
| 30 minutes | High security environments |
| 1 hour | Standard security |
| 2 hours | Moderate use |
| 4 hours | Extended sessions |
| 8 hours | Full workday (default) |

> **Note:** Tenant session timeout is constrained by the Platform Session Timeout set by the System Admin. Tenants can only configure session timeouts that are less than or equal to the platform maximum.

**Platform vs Tenant Session Timeout:**
- **Platform Level (System Admin):** Sets the maximum allowed session timeout for all tenants
- **Tenant Level (Admin):** Can set tenant-specific timeout up to the platform maximum
- Users will be logged out after inactivity based on their tenant's configured timeout

### 15.6 Notification Settings

Manage notification preferences:
- Email notifications enable/disable
- System notification email address
- Reminder frequency

### 15.7 Communication Integrations

**Navigation:** Admin Dashboard → Settings → Communication Integrations tab

Configure Slack or Microsoft Teams to receive real-time claim notifications:

| Setting | Description |
|---------|-------------|
| Provider | Slack or Microsoft Teams |
| Webhook URL | Your platform's incoming webhook URL |
| Channel Name | Channel identifier (for display) |
| Notification Events | Select which events trigger notifications |
| Enable Integration | Toggle to activate/deactivate |

**Setup Steps:**
1. Create an incoming webhook in Slack or Teams (or Power Automate workflow)
2. Copy the webhook URL
3. Navigate to Settings → Communication Integrations
4. Select your provider and paste the webhook URL
5. Enable desired notification events
6. Toggle "Enable Integration" ON
7. Click Save, then Test to verify

**Note:** Test button sends a sample notification to verify the webhook is working correctly.

### 15.8 Branding Settings

Admin users can customize the application appearance for their tenant:

**Access Control:**
| Role | Access Level |
|------|--------------|
| System Admin | Can modify any tenant's branding |
| Admin | Can only modify their own tenant's branding |
| Other roles | View only (branded elements visible) |

**Customizable Elements:**

| Element | Description | Recommendations |
|---------|-------------|-----------------|
| Company Logo | Main navigation logo | PNG, transparent background, 200x60px |
| Favicon | Browser tab icon | ICO/PNG, 32x32px |
| Email Logo | Logo for email templates | PNG, 400x120px |
| Primary Color | Main brand color | Hex code (e.g., #1a73e8) |
| Secondary Color | Accent color | Hex code (e.g., #34a853) |
| Tagline | Company tagline/slogan | Text (max 100 chars) |

**Branding Preview:**
- Live preview available before saving
- All changes apply across the tenant's application instance
- Users within the tenant see consistent branded experience

**File Upload Specifications:**
| File Type | Max Size | Accepted Formats |
|-----------|----------|------------------|
| Logo | 2MB | PNG, JPG, SVG |
| Favicon | 100KB | ICO, PNG |
| Email Logo | 1MB | PNG, JPG |

---

## 16. Audit & Compliance

### 16.1 Audit Trail

All actions are logged:
- Who performed the action
- When it was performed
- What was changed
- IP address and device

### 16.2 Compliance Features

- Data retention policies
- GDPR data export
- Role-based access logs
- Sensitive data masking

---

*Document Version: 1.2 | Last Updated: December 2025*
