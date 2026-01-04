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

### 3.3 Allowance Calculation Types

Allowance claims support three calculation methodologies based on policy configuration:

#### 3.3.1 Per Day Calculation

For time-based allowances (e.g., WFH, On-Call, Deputation).

**Input Fields:**
| Field | Description |
|-------|-------------|
| Period Start | Start date of the allowance period |
| Period End | End date of the allowance period |
| Per Day Rate | Rate per working day (from policy or manual) |
| Leave Days | Number of leaves/holidays to exclude |

**Calculation Formula:**
```
Working Days = Weekdays between Period Start and Period End
Net Working Days = Working Days - Leave Days
Total Amount = Net Working Days × Per Day Rate
```

**Example:**
- Period: Dec 1-31, 2025 (23 working days)
- Leave Days: 2
- Per Day Rate: ₹300
- **Total = (23 - 2) × 300 = ₹6,300**

#### 3.3.2 Per KM Calculation

For distance-based allowances (e.g., Conveyance, Travel Allowance).

**Input Fields:**
| Field | Description |
|-------|-------------|
| From Location | Starting point (map picker) |
| To Location | Destination point (map picker) |
| Number of Trips | Round trips made |
| Rate per KM | Rate from policy configuration |

**Calculation Formula:**
```
One-Way Distance = Haversine distance between From and To locations
Total Distance = One-Way Distance × Number of Trips × 2 (round trip)
Total Amount = Total Distance × Rate per KM
```

**Haversine Formula (for distance calculation):**
```
R = 6371 km (Earth's radius)
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlng/2)
c = 2 × atan2(√a, √(1-a))
Distance = R × c
```

**Example:**
- From: Chennai Office (13.0827°N, 80.2707°E)
- To: Client Site (12.9716°N, 77.5946°E)  
- Distance: ~290 km one-way
- Trips: 2 round trips
- Rate: ₹8/km
- **Total = 290 × 2 × 2 × 8 = ₹9,280**

#### 3.3.3 Fixed Amount

For fixed allowances where amount is entered directly.

**Input Fields:**
| Field | Description |
|-------|-------------|
| Amount | Fixed amount to claim |
| Description | Justification for the claim |

**Policy Configuration:**
```json
{
  "calculation_type": "per_day" | "per_km" | "fixed",
  "rate_per_unit": 300,  // Rate per day or per km
  "max_amount": 25000    // Maximum limit per claim/period
}
```

### 3.4 Location Picker with Dual Map Provider

For per-km calculations, the system provides an interactive map-based location picker with **Google Maps as the primary provider** and **OpenStreetMap as automatic fallback**.

**Provider Selection Logic:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    Map Provider Selection                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────┐                                      │
│  │ Google Maps API Key    │                                      │
│  │ Configured?            │                                      │
│  └───────────┬────────────┘                                      │
│              │                                                   │
│     ┌────────┴────────┐                                          │
│     │                 │                                          │
│   [YES]             [NO]                                         │
│     │                 │                                          │
│     ▼                 │                                          │
│  ┌──────────────┐     │                                          │
│  │ Load Google  │     │                                          │
│  │ Maps API     │     │                                          │
│  └───────┬──────┘     │                                          │
│          │            │                                          │
│    ┌─────┴─────┐      │                                          │
│    │           │      │                                          │
│ [SUCCESS]   [FAIL]    │                                          │
│    │           │      │                                          │
│    ▼           ▼      ▼                                          │
│ ┌──────────┐  ┌──────────────┐                                   │
│ │ Google   │  │ OpenStreetMap│                                   │
│ │ Maps     │  │ (Fallback)   │                                   │
│ └──────────┘  └──────────────┘                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
| Feature | Google Maps | OpenStreetMap (Fallback) |
|---------|-------------|-------------------------|
| Interactive Map | Google Maps JS API | Leaflet.js |
| Map Tiles | Google Maps Tiles | OpenStreetMap tiles |
| Search | Places Autocomplete | Nominatim API |
| Geocoding | Google Geocoding API | Nominatim API |
| Click to Select | ✓ | ✓ |
| Draggable Marker | ✓ | ✓ |
| Current Location | ✓ (GPS) | ✓ (GPS) |
| Reverse Geocoding | ✓ | ✓ |
| API Key Required | Yes | No |

**Google Maps (Primary):**
- **Requirement:** `VITE_GOOGLE_MAPS_API_KEY` environment variable
- **Features:** Places Autocomplete, Advanced Markers, rich geocoding
- **Accuracy:** Higher accuracy for addresses
- **Cost:** Pay-per-use (Google Cloud billing)

**OpenStreetMap (Fallback):**
- **Triggers:** No API key, API key invalid, Google Maps fails to load
- **Map Tiles:** Free, no API key required
- **Geocoding:** Nominatim API (free, 1 req/sec limit)
- **Indicator:** Shows "Using OpenStreetMap" message when active

**Configuration:**
```bash
# docker-compose.yml
environment:
  VITE_GOOGLE_MAPS_API_KEY: ${VITE_GOOGLE_MAPS_API_KEY}

# .env file
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

**Search Functionality:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Search for a place...                                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Chennai Central Railway Station                         │    │
│  │ Chennai, Tamil Nadu, India                              │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ Chennai Airport                                          │    │
│  │ Tirusulam, Chennai, Tamil Nadu, India                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      [MAP VIEW]                          │    │
│  │                         📍                               │    │
│  │                                                          │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Selected: 13.0827°N, 80.2707°E                                 │
│  Address: Chennai Central, Chennai, Tamil Nadu                  │
│  • Powered by Google Maps                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Usage Notes:**
- Google Maps: Enable Maps JavaScript API and Places API in Google Cloud Console
- OpenStreetMap: Nominatim usage policy max 1 request/second
- Search results limited to 5 suggestions
- Coordinates stored with full precision
- Addresses are display-only (coordinates used for calculation)

### 3.5 Document Upload

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
- **Cumulative limit validation per period**
- Fiscal year boundary checking

**AI Reasoning:**
- Policy exception analysis
- Business justification review
- Fraud pattern detection
- Duplicate claim detection

### 5.3 Cumulative Limit Validation

The system validates claims against cumulative limits based on the policy's frequency period and tenant's fiscal year settings.

**Frequency Periods:**
| Period | Description | Example |
|--------|-------------|---------|
| DAILY | Per day limit | Max 1 meal claim per day |
| WEEKLY | Per week limit | Max ₹5,000 per week |
| MONTHLY | Per month limit | Max ₹10,000 per month |
| QUARTERLY | Per fiscal quarter | Max ₹25,000 per quarter |
| YEARLY | Per fiscal year | Max ₹50,000 per fiscal year |
| ONCE | Lifetime limit | One-time joining bonus |
| UNLIMITED | No limit | No restrictions |

**Validation Flow:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CUMULATIVE LIMIT VALIDATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Get Policy Category (max_amount, frequency_limit)                       │
│                            │                                                 │
│                            ▼                                                 │
│  2. Calculate Period Boundaries (respects tenant fiscal_year_start)         │
│     YEARLY: Apr 1 - Mar 31 (Indian FY)                                      │
│     QUARTERLY: Based on fiscal quarters                                     │
│                            │                                                 │
│                            ▼                                                 │
│  3. Sum Existing Claims (same employee + category + period)                 │
│     Excludes: REJECTED, CANCELLED claims                                    │
│                            │                                                 │
│                            ▼                                                 │
│  4. Compare: (cumulative_used + new_claim) vs max_amount                    │
│                            │                                                 │
│                ┌───────────┴───────────┐                                    │
│                │                       │                                    │
│                ▼                       ▼                                    │
│          ✅ PASS                 ❌ FAIL                                    │
│       Within limit           Exceeds period limit                           │
│                                                                              │
│  5. Calculate Utilization: Shows remaining budget to user                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Policy Checks Display:**
- Real-time validation in claim submission form
- Utilization progress bar showing % used
- Remaining budget display
- Warning at 80%+ utilization
- Block submission when limit exceeded

**Configuration:**
- Set `max_amount` and `frequency_limit` per PolicyCategory
- Configure tenant's `fiscal_year_start` in System Settings (e.g., "apr" for April)

### 5.4 Auto-Approval

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

### 8.5 Client Management

Clients are tenant-specific customer/organization records that enable better expense tracking and project organization. Admins can manage client records and associate them with projects.

**CRUD Operations:**
- Create new clients with code, name, contact details
- Update client information
- Activate/deactivate clients
- Delete clients (only if no projects linked)

**Client Properties:**
| Field | Required | Description |
|-------|----------|-------------|
| Client Code | Yes | Unique short code within tenant (e.g., ACME, BETA) |
| Client Name | Yes | Full client/organization name |
| Description | No | Client description or notes |
| Contact Person | No | Primary contact name |
| Contact Email | No | Contact email address (validated format) |
| Contact Phone | No | Contact phone number |
| Address | No | Physical/billing address |
| Active Status | Yes | Enable/disable without deleting |
| Custom Data | No | Additional JSON data for flexibility |

**Features:**
- **Project Association**: Link multiple projects to a client for organized expense tracking
- **Bulk Project Linking**: Associate/unassociate multiple projects at once
- **Active/Inactive Toggle**: Soft-delete clients while preserving historical data
- **Client Dropdown in Projects**: When creating/editing projects, select associated client
- **Reports Filtering**: Filter claims by client in reports

**Access Control:**
| Role | Permissions |
|------|-------------|
| Admin | Full CRUD access |
| Manager | View only |
| Other roles | No access |

**Navigation:**
Admin sidebar → Clients

**Client-Project Workflow:**
```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT MANAGEMENT                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Create Client                                            │
│     └─▶ Code, Name, Contact details                         │
│                                                              │
│  2. Link Projects (Optional)                                │
│     └─▶ Select existing projects to associate               │
│                                                              │
│  3. New Project Creation                                    │
│     └─▶ Select client from dropdown (optional)              │
│                                                              │
│  4. Reports & Analytics                                     │
│     └─▶ Filter claims by client                             │
│     └─▶ View expenses per client                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Use Cases:**
- Track expenses for different customers/clients
- Bill-back client expenses
- Generate client-specific expense reports
- Organize projects by customer

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

### 13.2 Map Provider Integration (Google Maps + OpenStreetMap)

The system uses a **dual-provider architecture** for location-based features with Google Maps as primary and OpenStreetMap as automatic fallback.

**Provider Selection:**
| Scenario | Provider Used |
|----------|---------------|
| `VITE_GOOGLE_MAPS_API_KEY` set and valid | Google Maps |
| No API key configured | OpenStreetMap |
| Google Maps fails to load | OpenStreetMap (automatic fallback) |
| API key invalid/expired | OpenStreetMap (automatic fallback) |

**Google Maps Components:**
| Component | Purpose |
|-----------|----------|
| `@googlemaps/js-api-loader` | Dynamic API loading |
| Maps JavaScript API | Interactive map rendering |
| Places API | Autocomplete search |
| Geocoding API | Address lookup |
| AdvancedMarkerElement | Draggable map markers |

**OpenStreetMap Components (Fallback):**
| Component | Provider | Purpose |
|-----------|----------|----------|
| Map Tiles | OpenStreetMap | Interactive map display |
| Geocoding | Nominatim API | Address to coordinates |
| Reverse Geocoding | Nominatim API | Coordinates to address |
| Distance Calculation | Haversine Formula | Route-free distance |

**Frontend Libraries:**
- Google Maps: `@googlemaps/js-api-loader`
- OpenStreetMap: Leaflet.js

**API Endpoints:**
```
# Google Maps (Primary)
Maps JavaScript API: Loaded dynamically via js-api-loader
Places Autocomplete: Integrated with search input
Geocoder: google.maps.Geocoder service

# OpenStreetMap (Fallback)
Search: https://nominatim.openstreetmap.org/search?q={query}&format=json
Reverse: https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json
Tiles: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

**Rate Limiting:**
- Google Maps: Based on API quota and billing plan
- Nominatim: 1 request/second (enforced via debouncing)
- Search debounced to 300ms for both providers

**Configuration:**
```bash
# Enable Google Maps (recommended for production)
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# OpenStreetMap requires no configuration
# Simply omit the API key to use OSM only
```

### 13.3 Payroll Integration

- Settlement export
- Payment reference import
- Reconciliation reports

### 13.4 SSO Integration

- Keycloak SSO support
- SAML/OIDC protocols
- Automatic user provisioning

### 13.5 Communication Integrations (Slack/Teams)

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

*Document Version: 1.3 | Last Updated: January 2026*
