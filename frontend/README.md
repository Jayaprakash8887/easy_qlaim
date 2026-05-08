# Reinvo-Dash 🚀

**AI-Powered Expense Reimbursement & Allowance Management System**

[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)]()

A modern, intelligent dashboard for managing employee expense claims, allowances, and reimbursements with AI-powered validation, OCR document processing, and multi-role approval workflows.

### 🎥 Quick Demo

```bash
# Clone, install, and run in 3 commands
git clone <repository-url>
cd reinvo-dash
npm install && npm run dev
```

Open [http://localhost:8080](http://localhost:8080) to see the app!

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Key Features Deep Dive](#key-features-deep-dive)
- [User Roles & Permissions](#user-roles--permissions)
- [Development Guide](#development-guide)
- [System Architecture](#system-architecture)
- [API Integration](#api-integration)
- [Contributing](#contributing)

---

## 🎯 Overview

Reinvo-Dash is a comprehensive expense management solution built with React, TypeScript, and modern UI components. It streamlines the entire reimbursement lifecycle from claim submission to settlement, powered by AI agents for intelligent validation and processing.

### Current State vs Future Vision

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT (v1.0)                            │
│  ✅ Fully functional React frontend                         │
│  ✅ Complete UI/UX with 50+ components                      │
│  ✅ Role-based access control                               │
│  ✅ Mock data layer for development                         │
│  ✅ Production-ready design system                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   CURRENT (Backend)                          │
│  ✅ FastAPI backend with REST API                           │
│  ✅ Google Gemini AI integration                            │
│  ✅ Multi-provider OCR (Google Vision, Tesseract)           │
│  ✅ PostgreSQL/MongoDB for data persistence                 │
│  🚧 Real-time notifications & WebSockets                    │
└─────────────────────────────────────────────────────────────┘
```

### Key Highlights

- 🤖 **AI-Powered Processing** - Automated claim validation with confidence scoring
- 📄 **OCR Integration** - Automatic data extraction from receipts and documents
- 🔄 **Smart Workflows** - Multi-level approval system with role-based routing
- 📊 **Real-time Analytics** - Comprehensive dashboards and reporting
- 💰 **Allowance Management** - Handle fixed allowances alongside reimbursements
- ✅ **Policy Compliance** - Automated policy checks and validation
- 🔐 **Role-Based Access** - Fine-grained permissions for Employee, Manager, HR, Finance, and Admin roles

### 📸 Key Screens

1. **Dashboard** - Overview with summary cards, AI suggestions, and recent activity
2. **New Claim** - Unified submission for both reimbursements and allowances with smart form
3. **My Claims** - View all claims (reimbursements and allowances) with filtering and search
4. **Approval Queue** - Swipeable interface for quick claim review
5. **Reports** - Analytics and insights with export capabilities
6. **Employee Management** - HR tools for user and project management

---

## ✨ Features

### For Employees
- ✅ Submit claims for both reimbursements and allowances in one place
- ✅ Choose between reimbursement categories (Travel, Meals, etc.) or allowance types (On-Call, Shift, etc.)
- ✅ Upload documents for reimbursements with document scanning
- ✅ Smart form with AI-powered auto-fill from OCR
- ✅ Track claim status in real-time
- ✅ View allowance balances and policies
- ✅ Mobile-friendly responsive design

### For Managers
- ✅ Review and approve team claims
- ✅ Quick approval queue with AI confidence indicators
- ✅ Comment on claims and request clarifications
- ✅ Bulk actions for efficient processing

### For HR
- ✅ Edit claim details (type, amount, category)
- ✅ Manage employee allowances
- ✅ Access to employee and project management
- ✅ Policy compliance monitoring

### For Finance
- ✅ Final approval and settlement processing
- ✅ Financial reports and analytics
- ✅ Settlement tracking and disbursement
- ✅ Export capabilities for payroll integration

### For Admins
- ✅ Full system access and configuration
- ✅ User management and role assignment
- ✅ System settings and policy configuration

---

## 🛠 Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **TypeScript** | 5.8.3 | Type safety |
| **Vite** | 5.4.19 | Build tool & dev server |
| **React Router** | 6.30.1 | Client-side routing |
| **TanStack Query** | 5.83.0 | Data fetching & caching |
| **React Hook Form** | 7.61.1 | Form management |
| **Zod** | 3.25.76 | Schema validation |

### UI Components
| Technology | Purpose |
|------------|---------|
| **Radix UI** | Accessible headless components |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Pre-built component library |
| **Lucide React** | Icon library |
| **Recharts** | Data visualization |
| **Sonner** | Toast notifications |

### Why These Technologies?

| Technology | Reason |
|------------|--------|
| **React 18** | Virtual DOM, component reusability, large ecosystem |
| **TypeScript** | Type safety reduces bugs, better IDE support |
| **Vite** | 10x faster than Webpack, HMR, optimized builds |
| **Tailwind CSS** | Rapid UI development, small bundle size, customizable |
| **shadcn/ui** | Accessible components, copy-paste friendly, customizable |
| **TanStack Query** | Best-in-class data fetching, caching, and synchronization |
| **React Hook Form** | Performant form handling with minimal re-renders |
| **Zod** | Runtime type validation, great DX with TypeScript |

### Backend Stack (See [System Architecture](#system-architecture))
- **Python + FastAPI** - Fast, modern, async API framework
- **Google Gemini 2.0** - Advanced AI reasoning and multimodal support
- **Multi-provider LLM Support** - OpenAI, Anthropic, AWS Bedrock, Ollama
- **PostgreSQL + MongoDB** - Relational and document storage
- **Multi-provider OCR** - Google Vision, Azure, Tesseract
- **Celery + Redis** - Distributed task processing at scale

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ or **Bun** runtime
- **npm**, **yarn**, or **bun** package manager
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd reinvo-dash
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

4. **Open your browser**
   ```
   http://localhost:8080
   ```

### Available Scripts

```bash
# Development
npm run dev          # Start dev server (port 8080)

# Build
npm run build        # Production build
npm run build:dev    # Development build

# Code Quality
npm run lint         # Run ESLint

# Preview
npm run preview      # Preview production build
```

---

## 📁 Project Structure

```
reinvo-dash/
├── public/                 # Static assets
│   ├── favicon.ico
│   └── placeholder.svg
│
├── src/
│   ├── components/        # React components
│   │   ├── claims/       # Claim-related components
│   │   │   ├── AIConfidenceBadge.tsx
│   │   │   ├── CategoryCard.tsx
│   │   │   ├── ClaimReview.tsx
│   │   │   ├── ClaimStatusBadge.tsx
│   │   │   ├── ClaimSubmissionForm.tsx
│   │   │   ├── ComplianceScore.tsx
│   │   │   ├── DocumentUpload.tsx
│   │   │   ├── PolicyChecks.tsx
│   │   │   ├── SmartClaimForm.tsx
│   │   │   └── SmartFormField.tsx
│   │   │
│   │   ├── dashboard/    # Dashboard widgets
│   │   │   ├── AISuggestionsCard.tsx
│   │   │   ├── AllowanceWidgets.tsx
│   │   │   ├── DashboardHeader.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   ├── RecentActivity.tsx
│   │   │   └── SummaryCard.tsx
│   │   │
│   │   ├── forms/        # Form components
│   │   │   ├── EmployeeForm.tsx
│   │   │   └── ProjectForm.tsx
│   │   │
│   │   ├── layout/       # Layout components
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Breadcrumbs.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── Sidebar.tsx
│   │   │
│   │   └── ui/           # Reusable UI components (shadcn)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── form.tsx
│   │       └── ... (40+ components)
│   │
│   ├── config/           # Configuration files
│   │   └── navigation.ts # Navigation structure & role-based routes
│   │
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx # Authentication & user state
│   │
│   ├── data/             # Mock data (for development)
│   │   ├── mockAllowances.ts
│   │   ├── mockClaims.ts
│   │   └── mockEmployees.ts
│   │
│   ├── hooks/            # Custom React hooks
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── useClaims.ts
│   │   ├── useEmployees.ts
│   │   └── useProjects.ts
│   │
│   ├── lib/              # Utility libraries
│   │   ├── export-utils.ts  # Data export functionality
│   │   ├── utils.ts         # Common utilities
│   │   └── validations.ts   # Zod schemas & validators
│   │
│   ├── pages/            # Page components (routes)
│   │   ├── Dashboard.tsx
│   │   ├── ClaimsList.tsx
│   │   ├── ClaimDetails.tsx
│   │   ├── NewClaim.tsx
│   │   ├── ApprovalQueue.tsx
│   │   ├── AllowancesList.tsx
│   │   ├── AllowanceDetails.tsx
│   │   ├── NewAllowance.tsx
│   │   ├── Employees.tsx
│   │   ├── Projects.tsx
│   │   ├── Settlements.tsx
│   │   ├── Reports.tsx
│   │   ├── Profile.tsx
│   │   ├── Settings.tsx
│   │   └── NotFound.tsx
│   │
│   ├── types/            # TypeScript type definitions
│   │   ├── allowance.ts  # Allowance types
│   │   └── index.ts      # Core types (User, Claim, etc.)
│   │
│   ├── App.tsx           # Root app component
│   ├── main.tsx          # App entry point
│   └── index.css         # Global styles
│
├── components.json       # shadcn/ui configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies & scripts
```

---

## 🔑 Key Features Deep Dive

### 1. Smart Claim Submission

The claim submission workflow includes:

- **Category Selection**: Visual category cards with policy information
- **AI-Powered Form**: Smart fields that auto-populate from OCR
- **Document Upload**: Drag-and-drop with instant OCR processing
- **Real-time Validation**: Policy checks and compliance scoring
- **Data Source Tracking**: Labels fields as OCR/Manual/Edited

```typescript
// Example: Claim data structure
interface Claim {
  id: string;
  claimNumber: string;
  type: 'reimbursement' | 'allowance';
  category: ExpenseCategory;
  amount: number;
  status: ClaimStatus;
  aiConfidenceScore?: number;
  dataSource: Record<string, 'ocr' | 'manual' | 'edited'>;
  // ... more fields
}
```

### 2. AI Confidence Scoring

Every claim receives an AI confidence score:
- **90-100%**: High confidence (auto-approval candidate)
- **70-89%**: Medium confidence (manager review)
- **Below 70%**: Low confidence (detailed review required)

### 3. Approval Workflows

Multi-level approval with role-based routing:

```
Employee Submit → Manager Review → HR Review → Finance Approval → Settlement
```

Features:
- **Return to Employee**: Non-destructive rejection with comments
- **Escalation**: Automatic routing based on amount thresholds
- **Bulk Actions**: Approve/reject multiple claims at once

### 4. Allowance Management

Fixed-amount allowances with policy-based validation:

- **Types**: On-call, Shift, Work Incentive, Food allowances
- **Auto-calculation**: Based on timesheet data
- **Policy enforcement**: Eligibility rules and limits
- **Payroll integration**: Ready for export

### 5. Document Management

- OCR processing with confidence scores
- Support for images, PDFs, and other documents
- Document verification and validation
- Secure storage with access controls

### 6. Data Models

Core data structures used throughout the application:

```typescript
// User
interface User {
  id: string;
  email: string;
  name: string;
  role: 'employee' | 'manager' | 'hr' | 'finance' | 'admin';
  department: string;
  avatar?: string;
}

// Claim
interface Claim {
  id: string;
  claimNumber: string;
  type: 'reimbursement' | 'allowance';
  category: ExpenseCategory;
  amount: number;
  status: ClaimStatus;
  submittedBy: User;
  documents: ClaimDocument[];
  aiConfidenceScore?: number;
  dataSource: Record<string, 'ocr' | 'manual' | 'edited'>;
}

// Allowance
interface Allowance {
  id: string;
  type: 'on_call' | 'shift' | 'work_incentive' | 'food';
  amount: number;
  period: { startDate: Date; endDate: Date };
  status: AllowanceStatus;
  taxable: boolean;
  aiEligibilityScore?: number;
}
```

See `src/types/` for complete type definitions.

---

## 👥 User Roles & Permissions

### Role Hierarchy

| Role | Access Level | Key Permissions |
|------|--------------|-----------------|
| **Employee** | Basic | Submit claims, view own claims, track status |
| **Manager** | Team | Approve team claims, view team reports |
| **HR** | Department | Edit claims, manage allowances, employee management |
| **Finance** | Organization | Final approval, settlements, financial reports |
| **Admin** | System | Full access, configuration, user management |

### Role-Based Navigation

The navigation menu dynamically adjusts based on user role:

```typescript
// Example from navigation.ts
export function getNavigationForRole(role: UserRole): NavItem[] {
  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || item.roles.includes(role));
  
  return [...filterByRole(mainNavigation), ...filterByRole(adminNavigation)];
}
```

---

## 🎨 Component Showcase

### Pre-built Components

The application includes 50+ reusable components:

**UI Components (shadcn/ui)**
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

// Usage
<Button variant="default" size="lg">Submit Claim</Button>
```

**Domain Components**
```typescript
// AI Confidence Badge
<AIConfidenceBadge score={95} showIcon />

// Claim Status Badge
<ClaimStatusBadge status="approved" />

// Document Upload
<DocumentUpload 
  requiredDocs={['Receipt', 'Invoice']} 
  onFilesChange={handleFiles} 
/>

// Compliance Score
<ComplianceScore score={85} checks={policyChecks} />
```

**Layout Components**
```typescript
// App Layout with Sidebar
<AppLayout>
  <YourPageComponent />
</AppLayout>

// Breadcrumbs
<Breadcrumbs items={[
  { label: 'Claims', href: '/claims' },
  { label: 'Details', href: '/claims/123' }
]} />
```

### Creating Custom Components

```typescript
// 1. Create component file
// src/components/custom/MyComponent.tsx
import { cn } from '@/lib/utils';

interface MyComponentProps {
  className?: string;
  title: string;
}

export function MyComponent({ className, title }: MyComponentProps) {
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      <h3>{title}</h3>
    </div>
  );
}

// 2. Use in pages
import { MyComponent } from '@/components/custom/MyComponent';

<MyComponent title="Hello" className="bg-primary" />
```

---

## 💻 Development Guide

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured with React and TypeScript rules
- **Components**: Functional components with hooks
- **Styling**: Tailwind utility classes + CSS variables

### Key Patterns

**1. Form Management with React Hook Form + Zod**
```typescript
const form = useForm<ClaimFormData>({
  resolver: zodResolver(claimSchema),
  defaultValues: { ... }
});
```

**2. Data Fetching with TanStack Query**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['claims'],
  queryFn: fetchClaims,
});
```

**3. Type Safety**
```typescript
// All data structures are strongly typed
type ClaimStatus = 'draft' | 'submitted' | 'pending_manager' | ...;
```

### Adding New Features

1. **Add Type Definitions** in `src/types/`
2. **Create Components** in appropriate `src/components/` subdirectory
3. **Add Pages** in `src/pages/`
4. **Update Routes** in `src/App.tsx`
5. **Add Navigation** in `src/config/navigation.ts`

### Component Development

Using shadcn/ui components:

```bash
# Add new components
npx shadcn@latest add <component-name>
```

### Performance Optimizations

The application implements several performance optimizations:

1. **Code Splitting**
   - Lazy loading of route components
   - Reduced initial bundle size
   ```typescript
   const Dashboard = lazy(() => import('./pages/Dashboard'));
   ```

2. **Query Caching**
   - TanStack Query with 5-minute stale time
   - Automatic background refetching
   - Optimistic updates

3. **Build Optimization**
   - Vite with SWC for fast builds
   - Tree-shaking unused code
   - CSS purging with Tailwind

4. **Image Optimization**
   - SVG icons from Lucide
   - Lazy loading images
   - Responsive images

### Best Practices

- ✅ **Accessibility** - ARIA labels, keyboard navigation, screen reader support
- ✅ **Type Safety** - Comprehensive TypeScript coverage
- ✅ **Error Handling** - Graceful error boundaries and fallbacks
- ✅ **Mobile-First** - Responsive design for all screen sizes
- ✅ **Dark Mode Ready** - Theme system with next-themes
- ✅ **SEO Friendly** - Proper meta tags and semantic HTML

---

## 🏗 System Architecture

### Current Implementation (Frontend)

The application is currently built as a **React SPA (Single Page Application)** with:

- **Client-side routing** via React Router
- **Mock data** for development and prototyping
- **Component library** built with shadcn/ui and Radix UI
- **Responsive design** optimized for desktop and mobile
- **Type-safe** with comprehensive TypeScript definitions

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER                           │
│  ┌───────────────────────────────────────────────┐  │
│  │         React Application (SPA)               │  │
│  │                                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │  Pages   │  │Components│  │  Hooks   │   │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘   │  │
│  │       │             │              │          │  │
│  │  ┌────▼─────────────▼──────────────▼───────┐ │  │
│  │  │    React Router + TanStack Query       │ │  │
│  │  └────────────────┬─────────────────────────┘ │  │
│  │                   │                           │  │
│  │  ┌────────────────▼─────────────────────────┐ │  │
│  │  │        Mock Data Layer                   │ │  │
│  │  │  (Ready for API integration)             │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        │ (Future API Integration)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND                                │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         FastAPI REST API                    │   │
│  └──────────────┬──────────────────────────────┘   │
│                 │                                   │
│  ┌──────────────▼──────────────┐                   │
│  │    AI Services Layer        │                   │
│  │  ┌────────────────────────┐ │                   │
│  │  │  OCR Service (Vision)  │ │                   │
│  │  │  Validation Service    │ │                   │
│  │  │  Gemini AI Integration │ │                   │
│  │  └────────────────────────┘ │                   │
│  └─────────────────────────────┘                   │
│                 │                                   │
│  ┌──────────────▼──────────────┐                   │
│  │      PostgreSQL / MongoDB   │                   │
│  └─────────────────────────────┘                   │
└─────────────────────────────────────────────────────┘
```

### Testing

Currently, the application uses:
- **ESLint** for code quality
- **TypeScript** for type checking
- Manual testing with mock data

**Future Testing Strategy:**
```bash
# Unit tests (Vitest)
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Type checking
npm run type-check
```

---

## 🚀 Deployment

### Build for Production

```bash
# Create optimized production build
npm run build

# Output directory: dist/
# Serve with any static file server
```

### Deployment Options

**1. Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**2. Netlify**
```bash
# Build command: npm run build
# Publish directory: dist
```

**3. Docker**
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**4. Static Server**
```bash
# Using serve
npx serve dist -p 3000

# Using http-server
npx http-server dist -p 3000
```

### Environment Configuration

For production, update environment variables:

```env
VITE_API_URL=https://api.yourcompany.com
VITE_ENABLE_ANALYTICS=true
```

---

## 🔌 API Integration

The application is designed to easily integrate with a backend API. All data fetching is abstracted through:

### Custom Hooks (Ready for API)

```typescript
// src/hooks/useClaims.ts
export function useClaims() {
  return useQuery({
    queryKey: ['claims'],
    queryFn: async () => {
      // Currently returns mock data
      // Replace with: return fetch('/api/claims').then(r => r.json())
      return mockClaims;
    },
  });
}
```

### Mock Data Structure

All mock data follows the same structure as planned API responses:

- `src/data/mockClaims.ts` - Claim data
- `src/data/mockAllowances.ts` - Allowance data
- `src/data/mockEmployees.ts` - Employee data

**To integrate with a real backend:**
1. Replace mock data imports with API calls
2. Update base URLs in a config file
3. Add authentication headers
4. No component changes required!

---

## 🚧 Planned Backend Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **LLM** | Google Gemini 2.0 | AI reasoning and validation |
| **AI Providers** | OpenAI, Anthropic, Ollama | Multi-provider support |
| **Database** | PostgreSQL + MongoDB | Relational and document storage |
| **Backend** | Python + FastAPI | REST API server |
| **Task Queue** | Celery + Redis | Async job processing |
| **OCR** | Google Vision, Tesseract | Document text extraction |
| **Storage** | GCP / Azure / S3 | Document storage |
| **Auth** | Keycloak | SSO and RBAC |

### AI Services Architecture

The backend uses **Google Gemini API** with custom AI services:

#### Agent Types

1. **Document Agent**
   - OCR processing with Tesseract + Google Vision
   - Data extraction and validation
   - Confidence scoring

2. **Validation Agent**
   - Policy compliance checking
   - Amount verification
   - Duplicate detection
   - AI-powered decision making

3. **Approval Agent**
   - Route claims based on rules
   - Auto-approve high-confidence claims
   - Escalation management

4. **Learning Agent**
   - Track approval patterns
   - Improve confidence scoring
   - Policy optimization

5. **Integration Agent** (Future)
   - HRMS data sync
   - Timesheet integration
   - Payroll export

---

## 🌍 Environment Variables

Create a `.env` file in the root directory:

```env
# App Configuration
VITE_APP_NAME=Reinvo-Dash
VITE_API_URL=http://localhost:8000/api
VITE_APP_VERSION=1.0.0

# Feature Flags
VITE_ENABLE_OCR=true
VITE_ENABLE_AI_SUGGESTIONS=true

# Storage (Future)
VITE_STORAGE_URL=https://storage.googleapis.com/your-bucket
```

---

## ❓ FAQ

**Q: Is this a complete application?**  
A: Yes, the frontend is fully functional with mock data. The backend AI system is planned for future implementation.

**Q: Can I use this in production?**  
A: The frontend is production-ready. You'll need to integrate it with a backend API and database.

**Q: How do I change the user role?**  
A: Use the role switcher in the header (demo feature) or modify `AuthContext.tsx`.

**Q: Does it support multiple languages?**  
A: Currently English only. i18n support can be added using react-i18next.

**Q: Is there a mobile app?**  
A: Not yet, but the web app is fully responsive and works great on mobile browsers.

**Q: How do I customize the theme?**  
A: Edit CSS variables in `src/index.css` and colors in `tailwind.config.ts`.

---

## 🐛 Troubleshooting

### Common Issues

**Port already in use**
```bash
# Change port in vite.config.ts or use different port
npm run dev -- --port 3000
```

**Build fails**
```bash
# Clear node_modules and reinstall
rm -rf node_modules bun.lockb
npm install
```

**Type errors**
```bash
# Regenerate TypeScript definitions
npm run build
```

---

## 🗺️ Roadmap

### ✅ Completed (Current Version)
- [x] Core UI components library
- [x] Dashboard with analytics
- [x] Claims management interface
- [x] Allowance tracking
- [x] Approval queue
- [x] Role-based navigation
- [x] Document upload interface
- [x] Form validation
- [x] Responsive design
- [x] Mock data layer

### 🚧 In Progress
- [ ] Backend API integration
- [ ] Authentication system
- [ ] Real-time notifications
- [ ] File upload to cloud storage

### 📅 Planned Features

**Phase 1: Backend Integration (Q1 2026)**
- [ ] FastAPI backend setup
- [ ] Database integration (DocumentDB)
- [ ] User authentication & authorization
- [ ] API endpoints for all CRUD operations
- [ ] WebSocket for real-time updates

**Phase 2: AI Enhancement (Q2 2026)**
- [x] Gemini AI integration
- [x] Multi-provider OCR (Google Vision, Tesseract)
- [x] AI-powered validation
- [ ] Auto-approval engine
- [ ] Enhanced confidence scoring system

**Phase 3: Advanced Features (Q3 2026)**
- [ ] Mobile apps (iOS/Android)
- [ ] Advanced analytics
- [ ] Multi-currency support
- [ ] Bulk import/export
- [ ] Email notifications
- [ ] Slack/Teams integration

**Phase 4: Enterprise Features (Q4 2026)**
- [ ] HRMS integration (Workday, SAP)
- [ ] Payroll integration
- [ ] Advanced reporting
- [ ] Multi-tenant support
- [ ] Compliance reports
- [ ] Audit logging

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
   - Follow existing code style
   - Add TypeScript types
   - Update documentation
4. **Test your changes**
   ```bash
   npm run lint
   npm run build
   ```
5. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
6. **Push and create a Pull Request**

### Commit Convention

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

---

## 📝 License

This project is proprietary and confidential.

---

## 📚 Quick Reference

### Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview build locally
npm run lint             # Check code quality

# Dependencies
npm install              # Install dependencies
npm update               # Update dependencies
npx shadcn@latest add <component>  # Add UI component
```

### Important Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app component & routing |
| `src/types/index.ts` | Core TypeScript types |
| `src/config/navigation.ts` | Navigation configuration |
| `src/contexts/AuthContext.tsx` | Authentication state |
| `vite.config.ts` | Vite configuration |
| `tailwind.config.ts` | Theme & styling |

### Key Directories

| Directory | Contains |
|-----------|----------|
| `src/components/ui/` | Base UI components (shadcn) |
| `src/components/claims/` | Claim-specific components |
| `src/pages/` | Route pages |
| `src/hooks/` | Custom React hooks |
| `src/lib/` | Utility functions |
| `src/data/` | Mock data |

---

## 📞 Support

### Getting Help

- 📖 **Documentation**: Read this README and inline code comments
- 🐛 **Bug Reports**: Create an issue with reproduction steps
- 💡 **Feature Requests**: Submit an issue with detailed description
- 💬 **Questions**: Use GitHub Discussions or contact the team

### Reporting Issues

When reporting bugs, please include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Screenshots (if applicable)
5. Browser/OS information
6. Console errors

---

## 🙏 Acknowledgments

- **shadcn/ui** - For the amazing component library
- **Radix UI** - For accessible primitives
- **Lucide** - For beautiful icons
- **Tailwind CSS** - For utility-first styling

---

## 🎓 Learning Resources

### Understanding the Codebase

**New to the project?** Start here:
1. Read [Getting Started](#getting-started) to run the app
2. Explore [Project Structure](#project-structure) to understand organization
3. Check [Component Showcase](#component-showcase) for reusable components
4. Review [Key Features Deep Dive](#key-features-deep-dive) for functionality
5. See [Development Guide](#development-guide) for coding patterns

### Key Concepts

- **React Router**: All pages are lazy-loaded routes in `App.tsx`
- **TanStack Query**: Data fetching with automatic caching
- **Form Management**: React Hook Form + Zod for validation
- **Styling**: Tailwind CSS utility classes + CSS variables for theming
- **Type Safety**: Everything is strongly typed with TypeScript
- **Component Library**: shadcn/ui provides accessible, customizable components

### Useful Links

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TanStack Query](https://tanstack.com/query/latest)
- [React Hook Form](https://react-hook-form.com)

---

## 📊 Project Status

| Area | Status | Notes |
|------|--------|-------|
| **Frontend** | ✅ Complete | Production-ready with mock data |
| **UI/UX** | ✅ Complete | 50+ components, responsive design |
| **Type Definitions** | ✅ Complete | Full TypeScript coverage |
| **Navigation** | ✅ Complete | Role-based routing implemented |
| **Forms & Validation** | ✅ Complete | All forms with Zod validation |
| **Backend API** | 🚧 Planned | FastAPI + agents (see architecture below) |
| **Database** | 🚧 Planned | DocumentDB.io integration |
| **Authentication** | 🚧 Planned | Keycloak SSO |
| **OCR Processing** | ✅ Complete | Tesseract + Google Vision |
| **AI Services** | ✅ Complete | Gemini API + Multi-provider LLM |

---

## 📝 Summary

**Reinvo-Dash** is a modern, production-ready expense management frontend built with React and TypeScript. The application demonstrates best practices in:

- ✅ Component architecture and code organization
- ✅ Type-safe development with TypeScript
- ✅ Modern UI/UX with accessible components
- ✅ Performance optimization and lazy loading
- ✅ Scalable state management
- ✅ Form handling and validation
- ✅ Responsive design

The frontend is **fully functional** with mock data and ready for backend integration. The architecture below describes the planned AI-powered backend system.

---

# 📐 Detailed System Architecture & Design

> **Note**: The following sections contain detailed technical specifications for the **planned backend implementation** and multi-agent AI system. The frontend (described above) is already complete.

## 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      USER INTERFACES (React)                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │Employee │  │ Manager │  │   HR    │  │ Finance │            │
│  │ Portal  │  │ Portal  │  │ Portal  │  │ Portal  │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
└───────┼───────────┼────────────┼────────────┼──────────────────┘
        │           │            │            │
        └───────────┴────────────┴────────────┘
                    │
┌───────────────────▼──────────────────────────────────────────────┐
│                  FASTAPI BACKEND LAYER                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints                                        │  │
│  │  • /claims         • /comments       • /settlements        │  │
│  │  • /documents      • /hr-corrections • /employees          │  │
│  │  • /approvals      • /projects       • /timesheets         │  │
│  │  • Queues tasks to Celery via Redis                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
┌────▼────┐  ┌──────▼──────┐  ┌───▼────────┐
│Document │  │    Redis    │  │  Flower    │
│  DB.io  │  │(Broker+Cache)│ │ (Monitor)  │
│         │  │             │  │            │
│• Claims │  │• Task Queue │  │• Task UI   │
│• Users  │  │• Results    │  │• Stats     │
│• Docs   │  │• Cache      │  │• Workers   │
└────┬────┘  └──────┬──────┘  └────────────┘
     │              │
     │              ▼
     │      ┌────────────────────────────────────────────────┐
     │      │         CELERY WORKERS (3-5 instances)         │
     │      │  ┌──────────────────────────────────────────┐  │
     │      │  │    AI SERVICES LAYER (Gemini API)        │  │
     │      │  │                                          │  │
     │      │  │  ┌────────────────────────────────────┐ │  │
     │      │  │  │  AI SERVICE COORDINATOR            │ │  │
     │      │  │  │  • Claim routing                   │ │  │
     │      │  │  │  • Workflow coordination           │ │  │
     │      │  │  │  • Task delegation                 │ │  │
     │      │  │  └────┬───────────┬───────────────────┘ │  │
     │      │  │       │           │                     │  │
     │      │  │  ┌────▼────┐  ┌───▼────┐  ┌──────────┐ │  │
     │      │  │  │DOCUMENT │  │VALIDTN │  │INTEGRATN │ │  │
     │      │  │  │ SERVICE │  │ SERVICE│  │  SERVICE │ │  │
     │      │  │  │• OCR    │  │• Policy│  │• Employee│ │  │
     │      │  │  │• Verify │  │• Rules │  │• Project │ │  │
     │      │  │  │• Track  │  │• AI    │  │• Timesheet│ │  │
     │      │  │  └─────────┘  └────────┘  └──────────┘ │  │
     │      │  │       │           │            │        │  │
     │      │  │  ┌────▼────┐  ┌───▼────┐               │  │
     │      │  │  │APPROVAL │  │LEARNING│               │  │
     │      │  │  │ AGENT   │  │ AGENT  │               │  │
     │      │  │  │• Route  │  │• Learn │               │  │
     │      │  │  │• Return │  │• Track │               │  │
     │      │  │  │• Settle │  │• Improve│              │  │
     │      │  │  └─────────┘  └────────┘               │  │
     │      │  │                                          │  │
     │      │  │  Agents run as Celery tasks              │  │
     │      │  └──────────────────────────────────────────┘  │
     │      └────────────────────┬───────────────────────────┘
     │                           │
     └───────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│  External Services & Storage                                     │
│  • Tesseract + Google Vision (OCR)                               │
│  • GCP Storage (Documents)                                       │
│  • SMTP/SendGrid (Notifications)                                 │
│  • [Future] Kronos API (Timesheet)                               │
│  • [Future] HRMS API (Employee Master)                           │
│  • [Future] Payroll API (Disbursement)                           │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
Employee → Upload Doc → FastAPI → Save to DB → Queue Celery Task
                                                       ↓
                                            Celery Worker picks up task
                                                       ↓
                                            Document Agent → OCR Extract
                                                       ↓
                                            Integration Agent → Get Employee/Project Data
                                                       ↓
                                            Validation Agent → Check Policies
                                                       ↓
                                            Approval Agent → Route to Approver
                                                       ↓
                                            Update DB with results
                                                       ↓
Manager/HR/Finance → Review → Approve/Return/Reject → Update Status
                                                       ↓
                     Finance → Settle → Payment → Mark SETTLED ✅
```

### 2.3 Async Task Processing Flow

```
User Action
    ↓
FastAPI receives request
    ↓
1. Save to DocumentDB (immediate)
2. Queue Celery task to Redis
3. Return 202 Accepted to user
    ↓
Celery Worker (background)
    ↓
Orchestrator Agent starts
    ↓
Delegates to specialized agents:
  • Document Agent (OCR)
  • Integration Agent (Data fetch)
  • Validation Agent (Policy check)
    ↓
Results stored in Redis
    ↓
Approval Agent processes
    ↓
Update DocumentDB
    ↓
Send notification to user
```

---

## 3. Multi-Agent System

### 3.1 Agent Overview

| Agent | Role | Responsibilities |
|-------|------|------------------|
| **Orchestrator** | Master Coordinator | Workflow routing, agent delegation, state management |
| **Validation** | Policy Enforcement | Rule validation, confidence scoring, AI reasoning |
| **Document** | OCR & Verification | Text extraction, field tracking, fraud detection |
| **Integration** | Data Fetching | Employee/project/timesheet data, future API integration |
| **Approval** | Routing & Status | Approval routing, return workflow, settlement tracking |
| **Learning** | Improvement | Pattern learning, accuracy tracking, system optimization |

### 3.2 Agent Details

#### **Orchestrator Agent**

**Purpose:** Central coordinator for all claim processing

**Key Responsibilities:**
- Receive claim submission from API
- Determine claim type (Reimbursement vs Allowance)
- Create appropriate workflow path
- Delegate tasks to specialized agents
- Handle exceptions and failures
- Update claim status in database
- Send notifications to stakeholders

**Decision Logic:**
- Allowance claims: Skip Document Agent (no docs)
- Reimbursement claims: Full workflow with OCR
- High confidence (≥95%): Auto-approve
- Medium confidence (80-95%): Manager review
- Policy exceptions: HR review
- Low confidence: Reject

**Tools Available:**
- `update_claim_status()` - Database updates
- `send_notification()` - Email/SMS alerts
- `delegate_to_agent()` - Agent communication
- `log_decision()` - Audit logging

---

#### **Document Agent**

**Purpose:** Extract and verify claim data from documents

**Key Responsibilities:**
- Perform OCR using Tesseract + Google Vision (multi-provider)
- Extract structured data (amount, date, vendor, category)
- Generate field-level confidence scores
- Track data source (OCR/Manual/Edited)
- Detect fraud and document tampering
- Manage edit history when employee modifies OCR data

**OCR Field Tracking:**

Each field extracted has metadata:
- **value**: The actual extracted value
- **source**: OCR, OCR_EDITED, or MANUAL
- **confidence**: 0.0 to 1.0 score
- **ocr_timestamp**: When extracted
- **edited**: Boolean flag
- **edit_history**: Array of changes
- **original_ocr_value**: Preserved original

**Fraud Detection Checks:**
1. Image quality analysis
2. Metadata consistency
3. Amount reasonableness patterns
4. Vendor legitimacy verification
5. Date validity checks

**Tools Available:**
- `tesseract_ocr.extract_text()` - Tesseract OCR
- `google_vision.extract_text()` - Google Cloud Vision
- `gemini.structure_data()` - LLM parsing
- `detect_manipulation()` - Fraud detection
- `verify_vendor()` - External validation

---

#### **Integration Agent**

**Purpose:** Fetch employee, project, and external system data

**Current Capabilities:**

**1. Employee Data Management**
- Fetch from internal DocumentDB
- Validate tenure, department, eligibility
- Check claim history
- Support for future HRMS sync

**2. Project Data Management**
- Fetch from internal DocumentDB
- Validate project codes
- Check budget availability
- Track project-specific policies

**3. Timesheet Management**
- Manual entry support (current)
- Future: Kronos API integration
- Validate on-call claims
- Cross-verify attendance

**Future Integration Ready:**

**When Kronos/HRMS Enabled:**
- Primary source: External API
- Fallback: Local database
- Automatic sync to cache
- Configurable sync frequency

**Integration Decision Logic:**
```
If HRMS_ENABLED:
    Try fetch from HRMS API
    If fails and fallback_enabled:
        Fetch from local DB
    Else:
        Return error
Else:
    Fetch from local DB
```

**Configuration Structure:**
- Enable/disable flags per integration
- API endpoints and credentials
- Timeout and retry settings
- Fallback behavior
- Sync frequency

**Tools Available:**
- `fetch_employee_data()` - Employee info
- `fetch_project_data()` - Project details
- `fetch_timesheet_data()` - Work hours
- `validate_oncall_claim()` - On-call verification
- `sync_to_local()` - Cache external data

---

#### **Validation Agent**

**Purpose:** Intelligent policy validation using AI reasoning

**Key Responsibilities:**
- Load applicable policies for claim category
- Validate all policy rules
- Use Gemini for intelligent edge case handling
- Calculate confidence score (0-1)
- Generate human-readable reasoning
- Flag exceptions for human review

**Validation Checks:**

**Standard Checks:**
1. Amount within policy limits
2. Employee tenure requirements
3. Budget availability
4. Category eligibility
5. Date validity
6. Documentation completeness

**AI-Powered Checks:**
1. Reasonableness assessment
2. Fraud risk evaluation
3. Pattern matching against history
4. Context-aware exceptions

**Confidence Scoring:**
- 0.95+: High confidence → Auto-approve
- 0.80-0.95: Medium → Manager review
- <0.80: Low → HR review or reject

**Output:**
- Valid/Invalid boolean
- Confidence score
- Recommendation (APPROVE/REVIEW/REJECT)
- Detailed reasoning in natural language
- List of passed/failed checks
- Flags for exceptions

**Tools Available:**
- `load_policies()` - Policy database
- `gemini.reason_about()` - AI reasoning
- `check_amount_limit()` - Rule validation
- `check_tenure()` - Eligibility
- `check_budget()` - Financial validation

---

#### **Approval Agent**

**Purpose:** Route claims and manage approval lifecycle

**Key Responsibilities:**

**1. Routing Logic:**
- Auto-approve high-confidence claims
- Route to appropriate approver
- Handle escalations
- Manage approval chains

**2. Return to Employee:**
- Process return requests
- Update status to RETURNED_TO_EMPLOYEE
- Enable editing for employee
- Track return count
- Auto-generate comment
- Send notification

**3. Comments Management:**
- Add comments from any role
- Maintain comment history
- Notify stakeholders
- Visible to all relevant parties

**4. Settlement Tracking:**
- Mark individual claims as settled
- Bulk settlement processing
- Capture payment details
- Update final status
- Notify employees

**Status Workflow:**
```
DRAFT → SUBMITTED → AI_PROCESSING
    ↓
PENDING_MANAGER
    ↓ ↓ ↓
    ↓ RETURNED_TO_EMPLOYEE (editable, resubmit)
    ↓ MANAGER_APPROVED
    ↓ PENDING_HR (if exception)
    ↓ HR_APPROVED
    ↓ PENDING_FINANCE
    ↓ FINANCE_APPROVED
    ↓ SETTLED ✅ (final)
    ↓
REJECTED ❌
```

**Return vs Reject:**
- **Return**: Temporary, allows edits, can resubmit
- **Reject**: Permanent, no further edits allowed

**Tools Available:**
- `route_claim()` - Routing logic
- `return_to_employee()` - Return workflow
- `add_comment()` - Comment creation
- `mark_as_settled()` - Settlement
- `bulk_settle()` - Batch settlement
- `send_notification()` - Alerts

---

#### **Learning Agent**

**Purpose:** Continuous system improvement

**Key Responsibilities:**
- Track agent decision accuracy
- Identify policy gaps
- Learn approval patterns
- Suggest policy updates
- Improve OCR accuracy
- Detect emerging fraud patterns

**Learning Activities:**

**1. Accuracy Tracking:**
- Compare AI predictions vs actual outcomes
- Calculate precision/recall metrics
- Identify low-confidence patterns

**2. OCR Improvement:**
- Track fields frequently edited by employees
- Identify document types with low accuracy
- Suggest OCR model fine-tuning

**3. Policy Analysis:**
- Detect claims frequently returned
- Identify unclear policy areas
- Suggest policy clarifications

**4. Pattern Recognition:**
- Learn seasonal claim patterns
- Detect department-specific trends
- Identify high-risk behaviors

**Outputs:**
- Weekly learning reports
- Policy improvement suggestions
- OCR accuracy metrics
- Fraud pattern alerts

**Tools Available:**
- `analyze_outcome()` - Compare predictions
- `identify_patterns()` - Pattern detection
- `suggest_improvements()` - Recommendations
- `update_models()` - Model retraining

---

### 3.3 Celery + Redis Task Queue Architecture


#### Task Queue Flow

```
FastAPI Endpoint
    ↓
Save claim to DocumentDB
    ↓
Queue Celery task:
    celery_app.send_task('process_claim', args=[claim_id])
    ↓
Redis receives task (broker)
    ↓
Celery Worker picks up task
    ↓
Orchestrator Agent executes
    ↓
Delegates to specialized agents:
  - document_agent.delay(claim_id)
  - validation_agent.delay(claim_id)
  - approval_agent.delay(claim_id)
    ↓
Results stored in Redis (result backend)
    ↓
Update DocumentDB with results
    ↓
Send notification to user
```

#### Celery Task Definitions

**Task Types:**

1. **process_claim** (Orchestrator)
    - Entry point for claim processing
    - Delegates to specialized agents
    - Manages workflow state

2. **document_agent_task** (Document Agent)
    - OCR extraction via Tesseract/Google Vision
    - Field tracking and verification
    - Fraud detection

3. **validation_agent_task** (Validation Agent)
    - Policy rule validation
    - AI reasoning for edge cases
    - Confidence scoring

4. **integration_agent_task** (Integration Agent)
    - Fetch employee/project data
    - Timesheet verification
    - External API calls (future)

5. **approval_agent_task** (Approval Agent)
    - Routing logic
    - Status updates
    - Notification triggers

6. **learning_agent_task** (Learning Agent)
    - Background analytics
    - Model improvement
    - Pattern detection

#### Celery Configuration

**Broker:** Redis (Task Queue)
```python
broker_url = 'redis://localhost:6379/0'
```

**Backend:** Redis (Result Storage)
```python
result_backend = 'redis://localhost:6379/1'
```

**Task Settings:**
```python
task_serializer = 'json'
result_serializer = 'json'
accept_content = ['json']
timezone = 'Asia/Kolkata'
enable_utc = True

# Retry configuration
task_acks_late = True
task_reject_on_worker_lost = True
task_default_retry_delay = 60  # 60 seconds
task_max_retries = 3
```

**Worker Configuration:**
```python
worker_concurrency = 4  # 4 concurrent tasks per worker
worker_prefetch_multiplier = 1
worker_max_tasks_per_child = 1000
```

#### Monitoring with Flower

**Flower UI provides:**
- Real-time task monitoring
- Worker status and health
- Task history and results
- Queue depth monitoring
- Performance metrics
- Task retry visualization

**Access:** `http://localhost:5555`

**Key Metrics:**
- Tasks processed per second
- Average task duration
- Success vs failure rate
- Worker CPU/memory usage
- Queue depth

#### Scaling Strategy

**Horizontal Scaling:**
```bash
# Start multiple workers
celery -A tasks worker --hostname=worker1@%h
celery -A tasks worker --hostname=worker2@%h
celery -A tasks worker --hostname=worker3@%h
```

**Auto-scaling:**
- Monitor queue depth in Redis
- Scale workers based on pending tasks
- Kubernetes HPA based on Redis metrics

**Load Distribution:**
- Tasks automatically distributed across workers
- No manual partitioning required
- Redis handles queuing and distribution

#### Reliability Features

**Task Retry:**
```python
@celery_app.task(bind=True, max_retries=3)
def process_claim(self, claim_id):
    try:
        # Process claim
        result = orchestrator.process(claim_id)
        return result
    except Exception as e:
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=2 ** self.request.retries)
```

**Task Result Expiry:**
```python
result_expires = 3600  # Results expire after 1 hour
```

**Dead Letter Queue:**
- Failed tasks after max retries moved to `celery.dead_letter`
- Manual review and reprocessing possible

#### Comparison: Celery vs Kafka

| Feature | Celery + Redis | Kafka | Verdict |
|---------|----------------|-------|---------|
| **Setup Complexity** | Low | High | Celery ✓ |
| **Monthly Cost** | $80 | $800 | Celery ✓ |
| **Throughput** | 10K/min | 100K/min | Celery ✓ (sufficient) |
| **Reliability** | Good | Excellent | Kafka ✓ (overkill) |
| **Monitoring** | Built-in (Flower) | Complex setup | Celery ✓ |
| **Learning Curve** | Easy | Steep | Celery ✓ |
| **Event Replay** | No | Yes | Kafka ✓ (rarely needed) |
| **Best For** | <10K claims/month | >50K claims/month | Celery for us |

**Decision:** Celery + Redis is perfect for reimbursement system scale (1,000 claims/month).

---

## 4. Agent Workflows

### 4.1 Complete Claim Processing Flow

```
STEP 1: Employee Submission
├─ Choose: Reimbursement or Allowance
├─ Upload documents (if reimbursement)
├─ Fill form (manual or OCR-extracted)
└─ Submit

STEP 2: Orchestrator Receives
├─ Create workflow based on type
├─ Initiate agent sequence
└─ Log submission

STEP 3: Document Agent (if docs)
├─ Perform OCR extraction
├─ Generate confidence scores
├─ Track field sources
└─ Detect fraud

STEP 4: Integration Agent
├─ Fetch employee data
├─ Fetch project data
├─ Fetch timesheet (if allowance)
└─ Validate availability

STEP 5: Validation Agent
├─ Load policies
├─ Run all checks
├─ Use AI reasoning
├─ Calculate confidence
└─ Generate recommendation

STEP 6: Approval Agent Routes
├─ High confidence (≥95%) → Auto-approve → Finance
├─ Medium (80-95%) → Manager review
├─ Policy exception → HR review
└─ Low confidence → Reject

STEP 7: Human Review
├─ Option A: APPROVE → Next stage
├─ Option B: RETURN → Employee edits → Resubmit
├─ Option C: REJECT → Final rejection
└─ Option D: COMMENT → Add feedback

STEP 8: HR Review (if exception)
├─ View complete transparency
├─ Edit claim type (if wrong)
├─ Adjust amount (if needed)
├─ Add comment explaining changes
└─ Approve/Return/Reject

STEP 9: Finance Review
├─ Verify budget
├─ Check payment details
├─ Review audit trail
└─ Approve for payment

STEP 10: Settlement
├─ Finance processes offline payment
├─ Capture payment reference
├─ Mark as SETTLED
├─ Notify employee
└─ Complete lifecycle ✅
```

### 4.2 Return to Employee Workflow

```
Manager/HR sees issue
    ↓
Click "Return to Employee"
    ↓
Enter reason (mandatory)
    ↓
Approval Agent processes:
    • Status: RETURNED_TO_EMPLOYEE
    • can_edit: true
    • return_count: +1
    • Auto-comment created
    ↓
Employee notified
    ↓
Employee views reason
    ↓
Employee edits claim
    ↓
Employee resubmits
    ↓
Status: RESUBMITTED → PENDING_MANAGER
    ↓
Goes back through AI workflow
    ↓
Returns to same approver
    ↓
Approver sees edit history
```

### 4.3 HR Correction Workflow

```
HR reviews claim
    ↓
Identifies correction needed
    ↓
Option A: Fix Claim Type
    • Original: Travel
    • Corrected: Certification
    • Reason: "Employee uploaded cert"
    • Auto-comment added
    ↓
Option B: Adjust Amount
    • Original: ₹26,500
    • Approved: ₹25,000
    • Reason: "Policy max enforced"
    • Auto-comment added
    ↓
HR approves with corrections
    ↓
Claim proceeds to Finance
    ↓
Finance sees corrected values
    ↓
Employee notified of changes
```

### 4.4 Settlement Workflow

```
Finance approves claim
    ↓
Status: FINANCE_APPROVED
    ↓
Finance processes offline payment
    • Bank transfer (NEFT/RTGS)
    • Get payment reference
    ↓
Finance marks as settled:
    
Individual:
    • Click "Mark as Settled"
    • Enter payment reference
    • Select method
    • Add notes
    
Bulk:
    • Select multiple claims
    • Enter batch details
    • Settle all at once
    ↓
Status: SETTLED ✅
    ↓
Employee notified:
    • "Payment processed: ₹15,000"
    • Payment reference included
```

---

## 5. Database Schema

### 5.1 DocumentDB.io Architecture

**Technology:** DocumentDB.io (PostgreSQL-based with MongoDB-compatible API)

**Key Capabilities:**
- ✅ PostgreSQL backbone with ACID transactions
- ✅ MongoDB-compatible API for flexible documents
- ✅ **Vector embeddings** (pgvector) for semantic search
- ✅ **Full-text search** (tsvector) for OCR and documents
- ✅ Hybrid queries using both SQL and MongoDB syntax
- ✅ JSONB for flexible document modeling

**Extensions Required:**
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Trigram similarity
CREATE EXTENSION IF NOT EXISTS "vector";       -- Vector embeddings
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- JSONB indexes
```

### 5.2 Collections/Tables Overview

```
reimbursement_db/
├── claims               (Main claim records with JSONB)
├── comments            (Multi-role comments)
├── employees           (Employee master)
├── projects            (Project master)
├── timesheets          (Timesheet entries)
├── policies            (Company policies)
├── documents           (File metadata)
├── approvals           (Approval history)
├── settlements         (Payment tracking)
├── notifications       (Notification queue)
├── policy_embeddings   (Vector search for RAG)
├── claim_embeddings    (Semantic claim similarity)
├── agent_traces        (Agent execution logs)
├── audit_logs          (Append-only audit trail)
└── learnings           (System improvements)
```

### 5.3 Claims Table (PostgreSQL + JSONB)

**Hybrid Structure:** PostgreSQL columns for indexed queries + JSONB for flexibility

```sql
CREATE TABLE claims (
  -- Identity & indexing
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  claim_number TEXT UNIQUE NOT NULL,
  
  -- Employee & Claim
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  claim_type TEXT NOT NULL,  -- REIMBURSEMENT or ALLOWANCE
  category TEXT NOT NULL,
  
  -- Financial
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  
  -- Status
  status TEXT NOT NULL,
  
  -- Dates
  submission_date TIMESTAMPTZ,
  claim_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Complete payload (JSONB for flexibility)
  claim_payload JSONB NOT NULL DEFAULT '{}',
  
  -- OCR full-text search
  ocr_text TEXT,
  ocr_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(ocr_text, '') || ' ' || 
      coalesce(employee_name, '') || ' ' || 
      coalesce(description, '')
    )
  ) STORED,
  
  -- Return workflow (v3.0)
  returned_by UUID,
  returned_at TIMESTAMPTZ,
  return_reason TEXT,
  return_count INT DEFAULT 0,
  can_edit BOOLEAN DEFAULT false,
  
  -- Settlement (v3.0)
  settled BOOLEAN DEFAULT false,
  settled_date TIMESTAMPTZ,
  settled_by UUID,
  payment_reference TEXT,
  payment_method TEXT,
  amount_paid NUMERIC(12,2)
);

-- Indexes
CREATE INDEX idx_claims_status_employee ON claims (status, employee_id);
CREATE INDEX idx_claims_payload_gin ON claims USING gin (claim_payload jsonb_path_ops);
CREATE INDEX idx_claims_ocr_tsv ON claims USING gin (ocr_tsv);  -- Full-text search
```

**JSONB Payload Structure:**

```json
{
  "fields": {
    "amount": {
      "value": 15000,
      "source": "OCR",
      "confidence": 0.97,
      "edited": false,
      "edit_history": [],
      "original_ocr_value": 15000
    },
    "date": {
      "value": "2024-12-05",
      "source": "OCR_EDITED",
      "confidence": 0.89,
      "edited": true,
      "edit_history": [
        {
          "timestamp": "2024-12-10T10:30:00Z",
          "old_value": "2024-12-04",
          "new_value": "2024-12-05",
          "user_id": "emp_123"
        }
      ],
      "original_ocr_value": "2024-12-04"
    }
  },
  "validation": {
    "agent_name": "validation_agent",
    "confidence": 0.95,
    "recommendation": "AUTO_APPROVE",
    "reasoning": "All policy rules satisfied",
    "rules_checked": [
      {"rule_id": "CERT_AMOUNT", "result": "pass"},
      {"rule_id": "CERT_TENURE", "result": "pass"}
    ],
    "llm_used": false
  },
  "hr_corrections": {
    "claim_type_changed": true,
    "original_claim_type": "TRAVEL",
    "corrected_claim_type": "CERTIFICATION",
    "type_change_reason": "Employee uploaded cert docs",
    "amount_adjusted": true,
    "original_amount": 26500,
    "approved_amount": 25000,
    "amount_adjustment_reason": "Policy maximum enforced"
  },
  "return_tracking": {
    "return_history": [
      {
        "returned_by": "mgr_789",
        "returned_at": "2024-12-10T11:00:00Z",
        "return_reason": "Please verify attendee count",
        "resubmitted_at": "2024-12-10T15:00:00Z",
        "changes_made": "Updated attendee count"
      }
    ]
  },
  "settlement": {
    "settled": true,
    "payment_reference": "NEFT2024121100123456",
    "bank_transaction_id": "TXN789012"
  }
}
```

### 5.4 Vector Embeddings for AI (NEW)

#### Policy Embeddings Table

**Purpose:** Semantic search for policy retrieval (RAG - Retrieval-Augmented Generation)

```sql
CREATE TABLE policy_embeddings (
  id UUID PRIMARY KEY,
  policy_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  text TEXT NOT NULL,
  
  -- 1536-dim vector for Gemini/OpenAI embeddings
  embedding vector(1536),
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity index (IVFFlat algorithm)
CREATE INDEX idx_policy_embedding_vec ON policy_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Full-text search index
CREATE INDEX idx_policy_text_fts ON policy_embeddings 
USING gin (to_tsvector('english', text));
```

**Usage - Find Relevant Policy Sections:**
```sql
-- Vector similarity search (returns top 5 most relevant sections)
SELECT 
  policy_id,
  section_id,
  text,
  embedding <-> :query_embedding AS distance
FROM policy_embeddings
ORDER BY embedding <-> :query_embedding
LIMIT 5;
```

**How It Works:**
1. Policy document chunked into sections (500-word chunks)
2. Each section embedded using Gemini (1536-dim vector)
3. When validating claim, embed claim description
4. Vector similarity search finds relevant policy sections
5. Pass only relevant sections to LLM (reduces cost by 90%)

#### Claim Embeddings Table

**Purpose:** Detect similar claims for fraud detection and pattern analysis

```sql
CREATE TABLE claim_embeddings (
  claim_id UUID PRIMARY KEY REFERENCES claims(id),
  
  -- Embedding generated from claim description + category + amount
  embedding vector(1536),
  
  embedding_model TEXT DEFAULT 'gemini-1.5-pro',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity index
CREATE INDEX idx_claim_embeddings_vec ON claim_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Usage - Find Similar Claims:**
```sql
-- Detect potentially duplicate or fraudulent claims
SELECT 
  c.id,
  c.claim_number,
  c.employee_name,
  c.amount,
  ce.embedding <-> :current_claim_embedding AS similarity
FROM claims c
JOIN claim_embeddings ce ON c.id = ce.claim_id
WHERE c.id != :current_claim_id
ORDER BY similarity ASC
LIMIT 10;
```

### 5.5 Full-Text Search Capabilities

**OCR Text Search:**
```sql
-- Search across all OCR-extracted text
SELECT 
  id,
  claim_number,
  employee_name,
  ts_rank(ocr_tsv, plainto_tsquery('travel invoice')) AS rank
FROM claims
WHERE ocr_tsv @@ plainto_tsquery('travel invoice')
ORDER BY rank DESC;
```

**Document Text Search:**
```sql
-- Search within uploaded documents
SELECT 
  d.id,
  d.file_name,
  c.claim_number,
  ts_rank(d.text_tsv, plainto_tsquery('hotel receipt')) AS rank
FROM documents d
JOIN claims c ON d.claim_id = c.id
WHERE d.text_tsv @@ plainto_tsquery('hotel receipt')
ORDER BY rank DESC;
```

**Policy Text Search:**
```sql
-- Search policy documentation
SELECT 
  policy_id,
  section_id,
  text,
  ts_rank(to_tsvector('english', text), plainto_tsquery('certification limit')) AS rank
FROM policy_embeddings
WHERE to_tsvector('english', text) @@ plainto_tsquery('certification limit')
ORDER BY rank DESC;
```

### 5.6 Agent Traces Table

**Purpose:** Detailed agent execution logs with provenance

```sql
CREATE TABLE agent_traces (
  id UUID PRIMARY KEY,
  claim_id UUID REFERENCES claims(id),
  
  -- Agent info
  agent_name TEXT NOT NULL,
  run_id UUID NOT NULL,
  
  -- Execution
  start_ts TIMESTAMPTZ NOT NULL,
  end_ts TIMESTAMPTZ,
  duration_ms INT,
  
  -- Detailed steps (JSONB)
  steps JSONB DEFAULT '[]',
  
  -- Verdict
  verdict JSONB DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'SUCCESS',
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_traces_claim ON agent_traces (claim_id);
CREATE INDEX idx_agent_traces_agent ON agent_traces (agent_name);
```

**Steps JSONB Structure:**
```json
[
  {
    "step": 1,
    "tool": "ocr_service",
    "input_refs": ["doc:uuid"],
    "output": {"amount": 15000, "date": "2024-12-05"},
    "confidence": 0.92,
    "duration_ms": 1250
  },
  {
    "step": 2,
    "tool": "rules_engine",
    "input": {"amount": 15000, "tenure": 18},
    "output": {"rules_passed": 3, "rules_failed": 0},
    "confidence": 0.99,
    "duration_ms": 45
  },
  {
    "step": 3,
    "tool": "gemini_reasoning",
    "input": "edge_case_analysis",
    "output": {"recommendation": "AUTO_APPROVE"},
    "confidence": 0.95,
    "duration_ms": 850,
    "llm_used": true,
    "tokens_used": 500
  }
]
```

### 5.7 Other Collections (Summary)

**Comments, Employees, Projects, Timesheets, Policies, Documents, Approvals, Settlements, Notifications** - Same structure as documented in Section 5.1 overview.

**Audit Logs** - Append-only table with no-update/no-delete rules:
```sql
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
```

### 5.8 Query Examples

**Hybrid Query (SQL + JSONB):**
```sql
-- Find pending claims with AI confidence < 90%
SELECT 
  id,
  claim_number,
  employee_name,
  amount,
  claim_payload->'validation'->>'confidence' as ai_confidence
FROM claims
WHERE status = 'PENDING_MANAGER'
  AND (claim_payload->'validation'->>'confidence')::numeric < 0.90
ORDER BY submission_date ASC;
```

**MongoDB API Query (Same Data):**
```javascript
db.claims.find({
  status: "PENDING_MANAGER",
  "claim_payload.validation.confidence": { $lt: 0.90 }
}).sort({ submission_date: 1 });
```

### 5.9 Performance Optimizations

**Indexes Summary:**
- B-tree indexes: Fast lookups on status, employee_id, dates
- GIN indexes: JSONB path operations, full-text search
- IVFFlat indexes: Vector similarity search (sub-100ms)

**Caching Strategy:**
- Redis: Hot data, agent state, policy cache
- DocumentDB: Write-through cache for frequently accessed claims
- Vector embeddings: Cached after first computation

**Partitioning (Optional):**
```sql
-- Partition claims by month for high volume
CREATE TABLE claims_2024_12 PARTITION OF claims
FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
```

### 5.10 Status Workflow

```
DRAFT → SUBMITTED → AI_PROCESSING
  ↓
PENDING_MANAGER
  ↓ ↓ ↓
  ↓ RETURNED_TO_EMPLOYEE → (edit) → RESUBMITTED
  ↓ MANAGER_APPROVED
  ↓ PENDING_HR
  ↓ HR_APPROVED
  ↓ PENDING_FINANCE
  ↓ FINANCE_APPROVED
  ↓ SETTLED ✅
  ↓
REJECTED ❌
```

---

**For complete SQL schema with all table definitions, indexes, and triggers, see:** `DocumentDB_Schema_Design_v3.0_Complete.md`

---

## 6. Integration Architecture

### 6.1 Current State (Self-Contained)

**Employee Management:**
- ✅ Manual add via admin UI
- ✅ CSV bulk import
- ✅ REST API creation
- ✅ Stored in DocumentDB

**Project Management:**
- ✅ Manual add via admin UI
- ✅ CSV bulk import
- ✅ REST API creation
- ✅ Stored in DocumentDB

**Timesheet Management:**
- ✅ Manual entry via web form
- ✅ REST API creation
- ✅ Stored in DocumentDB
- ✅ Validation against policy

### 6.2 Future State (Pluggable Integrations)

**Integration Configuration File:**

```yaml
integrations:
  
  kronos:
    enabled: false  # Set true when ready
    api_url: https://kronos.company.com/api/v1
    auth_type: oauth2
    client_id: ${KRONOS_CLIENT_ID}
    client_secret: ${KRONOS_CLIENT_SECRET}
    timeout_seconds: 10
    retry_attempts: 3
    fallback_to_local: true
    
  hrms:
    enabled: false  # Set true when ready
    api_url: https://hrms.company.com/api/v1
    auth_type: api_key
    api_key: ${HRMS_API_KEY}
    timeout_seconds: 10
    retry_attempts: 3
    fallback_to_local: true
    sync_frequency_hours: 24
    
  payroll:
    enabled: false  # Future
    api_url: https://payroll.company.com/api/v1
    auth_type: oauth2

data_sources:
  employee_data:
    primary: hrms      # When enabled
    fallback: local_db
  timesheet_data:
    primary: kronos    # When enabled
    fallback: local_db
  project_data:
    primary: local_db  # Always local
```

### 6.3 Integration Logic

**Integration Agent Decision Flow:**

```
Function: fetch_employee_data(employee_id)
    ↓
If HRMS_ENABLED:
    Try:
        data = fetch_from_hrms_api(employee_id)
        sync_to_local_cache(data)
        return data
    Catch Exception:
        If fallback_to_local:
            return fetch_from_local_db(employee_id)
        Else:
            raise error
Else:
    return fetch_from_local_db(employee_id)
```

**Benefits:**
- **Zero Code Changes** when integrations enabled
- **Graceful Fallback** if external API fails
- **Local Caching** for performance
- **Config-Driven** enable/disable

### 6.4 Admin Integration UI

**Settings Screen:**

```
┌─────────────────────────────────────────────────┐
│ System Integration Settings                      │
│                                                  │
│ Kronos Timesheet System                         │
│ Status: ❌ Disabled (using local DB)            │
│ ┌─────────────────────────────────────────────┐ │
│ │ [✓] Enable Kronos Integration               │ │
│ │ API URL: [___________________________]      │ │
│ │ Client ID: [___________________________]    │ │
│ │ Client Secret: [••••••••••••••••]          │ │
│ │ [Test Connection] [Save]                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ HRMS Employee System                             │
│ Status: ❌ Disabled (using local DB)            │
│ ┌─────────────────────────────────────────────┐ │
│ │ [✓] Enable HRMS Integration                 │ │
│ │ API URL: [___________________________]      │ │
│ │ API Key: [••••••••••••••••]                │ │
│ │ Sync Frequency: [24] hours                  │ │
│ │ [Test Connection] [Save]                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Apply All Changes]                             │
└─────────────────────────────────────────────────┘
```

---

## 7. API Specifications

### 7.1 Core Claim APIs

**Submit Claim:**
```
POST /api/v1/claims
Body: {claim details, documents}
Response: {claim_id, status}
```

**Get Claim:**
```
GET /api/v1/claims/{claim_id}
Response: {complete claim object}
```

**Update Claim:**
```
PATCH /api/v1/claims/{claim_id}
Body: {updated fields}
Response: {success, updated_claim}
```

### 7.2 Return to Employee API

**Return Claim:**
```
POST /api/v1/claims/{claim_id}/return
Authorization: Bearer <token>

Body:
{
  "returned_by": "user_id",
  "return_reason": "Please verify attendee count"
}

Response 200:
{
  "success": true,
  "claim_id": "claim_uuid",
  "status": "RETURNED_TO_EMPLOYEE",
  "notification_sent": true
}
```

### 7.3 Comments API

**Add Comment:**
```
POST /api/v1/claims/{claim_id}/comments
Authorization: Bearer <token>

Body:
{
  "user_id": "user_uuid",
  "user_role": "MANAGER",
  "comment_text": "Please clarify the discrepancy"
}

Response 201:
{
  "comment_id": "comment_uuid",
  "created_at": "2024-12-10T11:00:00Z"
}
```

**Get Comments:**
```
GET /api/v1/claims/{claim_id}/comments?sort=desc

Response 200:
{
  "claim_id": "claim_uuid",
  "comments": [array of comments],
  "total": 5
}
```

### 7.4 HR Corrections API

**Update Claim Type:**
```
PATCH /api/v1/claims/{claim_id}/hr-corrections/claim-type

Body:
{
  "corrected_by": "hr_user_id",
  "original_claim_type": "TRAVEL",
  "corrected_claim_type": "CERTIFICATION",
  "reason": "Employee uploaded cert but selected travel"
}

Response 200:
{
  "success": true,
  "claim_type_updated": true,
  "comment_added": true
}
```

**Adjust Amount:**
```
PATCH /api/v1/claims/{claim_id}/hr-corrections/amount

Body:
{
  "adjusted_by": "hr_user_id",
  "original_amount": 26500,
  "approved_amount": 25000,
  "reason": "Policy maximum enforced"
}

Response 200:
{
  "success": true,
  "amount_updated": true
}
```

### 7.5 Settlement API

**Mark as Settled (Individual):**
```
POST /api/v1/claims/{claim_id}/settle

Body:
{
  "settled_by": "finance_user_id",
  "settlement_details": {
    "settled_date": "2024-12-11",
    "payment_reference": "NEFT2024121100123456",
    "payment_method": "NEFT",
    "notes": "Regular disbursement"
  }
}

Response 200:
{
  "success": true,
  "status": "SETTLED",
  "settlement_id": "settlement_uuid"
}
```

**Bulk Settlement:**
```
POST /api/v1/claims/bulk-settle

Body:
{
  "settled_by": "finance_user_id",
  "claim_ids": ["claim_1", "claim_2", "claim_3"],
  "batch_details": {
    "batch_name": "December 2024 Batch 1",
    "settled_date": "2024-12-11",
    "batch_reference": "BATCH-2024-12-001",
    "payment_method": "NEFT"
  }
}

Response 200:
{
  "success": true,
  "total_claims": 3,
  "successful": ["claim_1", "claim_2"],
  "failed": [{"claim_id": "claim_3", "error": "..."}]
}
```

### 7.6 Employee/Project Management APIs

**Create Employee:**
```
POST /api/v1/employees
Authorization: Bearer <admin_token>

Body: {employee details}
Response: {employee_id, created: true}
```

**Bulk Import Employees:**
```
POST /api/v1/employees/import
Content-Type: multipart/form-data

file: employees.csv
Response: {imported: 48, failed: 2, errors: [...]}
```

**Create Project:**
```
POST /api/v1/projects
Authorization: Bearer <admin_token>

Body: {project details}
Response: {project_code, created: true}
```

**Add Timesheet:**
```
POST /api/v1/timesheets

Body:
{
  "employee_id": "EMP12345",
  "date": "2024-12-07",
  "hours_worked": 6.0,
  "is_oncall": true
}

Response: {timesheet_id, created: true}
```

---

## 8. User Workflows

### 8.1 Employee Portal

**Submit Reimbursement:**
1. Login → Dashboard
2. Click "Submit New Claim"
3. Select "Reimbursement"
4. Upload documents
5. Wait for OCR (5-10 sec)
6. Review extracted data
7. Edit if OCR incorrect
8. Submit

**Submit Allowance:**
1. Login → Dashboard
2. Click "Submit New Claim"
3. Select "Allowance"
4. Fill form manually
5. Submit

**View Status:**
- Track claim progress
- View comments from approvers
- See AI confidence score
- Check settlement status

**Handle Return:**
1. Notification: "Claim returned"
2. View return reason
3. Click "Edit Claim"
4. Make corrections
5. Resubmit

### 8.2 Manager Portal

**Approve Claims:**
1. Login → Approval Queue
2. See pending claims with:
    - Data source indicators
    - AI confidence
    - Priority
3. Click claim to review
4. Navigate: Previous | Back | Next
5. Review details:
    - OCR vs manual fields
    - Edit history
    - AI recommendation
    - Comments
6. Make decision:
    - **Approve** → Next stage
    - **Return** → Employee edits
    - **Reject** → Final
7. Add comment (optional)
8. Next claim

### 8.3 HR Portal

**Handle Exceptions:**
1. Login → Exception Queue
2. See claims requiring HR:
    - Policy exceptions
    - Data integrity flags
    - High-value claims
3. Review claim details
4. Navigate between claims
5. HR powers:
    - **Fix claim type** if wrong
    - **Adjust amount** if needed
    - Provide reasoning
6. Make decision
7. Add comment
8. Claim proceeds

### 8.4 Finance Portal

**Process Payments:**
1. Login → Payment Queue
2. See approved claims
3. Review claim:
    - Complete audit trail
    - All approvals
    - Bank details
4. Approve for payment
5. Process offline payment
6. Get payment reference
7. Mark as settled:
    - **Individual**: One claim
    - **Bulk**: Multiple claims
8. Enter payment details
9. Status: SETTLED ✅
10. Employee notified

---

## 9. Security & Compliance

### 9.1 Role-Based Access Control

**Roles:**
- EMPLOYEE
- MANAGER
- HR
- FINANCE
- ADMIN

**Permissions Matrix:**

| Action | Employee | Manager | HR | Finance | Admin |
|--------|----------|---------|----|---------| ------|
| Create claim | ✅ | ❌ | ❌ | ❌ | ✅ |
| Edit own claim | ✅* | ❌ | ❌ | ❌ | ✅ |
| View own claims | ✅ | ❌ | ❌ | ❌ | ✅ |
| View team claims | ❌ | ✅ | ❌ | ❌ | ✅ |
| View all claims | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve team | ❌ | ✅ | ❌ | ❌ | ✅ |
| Approve exception | ❌ | ❌ | ✅ | ❌ | ✅ |
| Approve payment | ❌ | ❌ | ❌ | ✅ | ✅ |
| Return claim | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit claim type | ❌ | ❌ | ✅ | ❌ | ✅ |
| Edit amount | ❌ | ❌ | ✅ | ❌ | ✅ |
| Settle payment | ❌ | ❌ | ❌ | ✅ | ✅ |
| Add comment | ✅ | ✅ | ✅ | ✅ | ✅ |

*Employee can only edit when status = RETURNED_TO_EMPLOYEE

### 9.2 Audit Logging

**All Actions Logged:**
- claim.created
- claim.submitted
- claim.approved
- claim.rejected
- claim.returned
- claim.settled
- comment.added
- hr.corrected_claim_type
- hr.adjusted_amount
- document.uploaded
- user.login

**Audit Log Structure:**
```
{
  event_type: "claim.returned",
  timestamp: "2024-12-10T11:00:00Z",
  actor_id: "MGR001",
  actor_role: "MANAGER",
  claim_id: "claim_uuid",
  action_details: {details},
  ip_address: "192.168.1.100"
}
```

### 9.3 Data Security

**Encryption:**
- At rest: AES-256
- In transit: TLS 1.3
- Database: Encrypted volumes

**Authentication:**
- SSO via Auth0/Keycloak
- MFA optional/required
- JWT tokens (15 min expiry)
- Refresh tokens (7 days)

**Compliance:**
- GDPR compliant
- SOC 2 ready
- Audit trails complete
- Data retention policies

---

## 10. Deployment Architecture

### 10.1 Production Setup

**Infrastructure:**

```
┌────────────────────────────────────────┐
│      Load Balancer (AWS ALB/Azure)     │
└────────────────┬───────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐   ┌───▼───┐   ┌───▼───┐
│React  │   │React  │   │React  │
│Pod 1  │   │Pod 2  │   │Pod 3  │
└───────┘   └───────┘   └───────┘
    │            │            │
    └────────────┼────────────┘
                 │
┌────────────────▼───────────────────────┐
│      API Gateway (Kong/AWS API GW)     │
└────────────────┬───────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼────┐  ┌───▼────┐  ┌───▼────┐
│FastAPI │  │FastAPI │  │FastAPI │
│Pod 1   │  │Pod 2   │  │Pod 3   │
└───┬────┘  └───┬────┘  └───┬────┘
    │           │           │
    └───────────┼───────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼────┐  ┌───▼────┐  ┌──▼─────┐
│Document│  │ Redis  │  │ Flower │
│DB.io   │  │Cluster │  │(Monitor)│
└────────┘  └────┬───┘  └────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼────┐  ┌───▼────┐  ┌───▼────┐
│Celery  │  │Celery  │  │Celery  │
│Worker 1│  │Worker 2│  │Worker 3│
│(Agents)│  │(Agents)│  │(Agents)│
└────────┘  └────────┘  └────────┘
```

**Scalability:**
- Frontend: 3-10 pods (auto-scale)
- Backend: 3-10 pods (auto-scale)
- Celery Workers: 3-10 instances (auto-scale based on queue depth)
- Database: Cluster with replicas
- Redis: Cluster mode (6 nodes: 3 master, 3 replica)
- Flower: 1 instance (monitoring UI)

**Monitoring:**
- Prometheus metrics
- Grafana dashboards
- Alert manager
- Flower UI (Celery task monitoring)
- Log aggregation (ELK)

### 10.2 Deployment Checklist

**Pre-Deployment:**
- [ ] Configure environment variables
- [ ] Set up DocumentDB cluster
- [ ] Set up Redis cluster
- [ ] Configure GCP storage
- [x] Configure OCR service (Tesseract)
- [ ] Configure Keycloak authentication
- [ ] Set up SSL certificates

**Deployment Steps:**
1. Deploy DocumentDB cluster
2. Deploy Redis cluster (broker + result backend)
3. Configure OCR service (Tesseract + Google Vision)
4. Deploy FastAPI backend services
5. Deploy Celery workers (3-5 instances)
6. Deploy Flower monitoring UI
7. Deploy React frontend
8. Configure load balancer
9. Set up monitoring (Prometheus + Grafana)
10. Run health checks
11. Enable traffic

**Post-Deployment:**
- [ ] Verify all services healthy
- [ ] Test claim submission
- [x] Test OCR extraction (Tesseract + Google Vision)
- [ ] Verify Celery tasks executing
- [ ] Monitor Flower UI for task status
- [ ] Test approval workflow
- [ ] Test settlement
- [ ] Verify notifications
- [ ] Check audit logs
- [ ] Monitor performance

---

## 11. Success Metrics

### 11.1 Performance KPIs

**Processing Speed:**
- Auto-approved claims: < 1 minute
- Manager review: < 2 hours
- HR review: < 4 hours
- Finance approval: < 1 hour
- Total cycle time: < 1 day (vs 3+ days manual)

**Accuracy:**
- OCR accuracy: > 95%
- AI validation accuracy: > 98%
- Auto-approval rate: > 88%
- Return rate: < 5%
- Rejection rate: < 7%

**User Satisfaction:**
- Employee NPS: > 70
- Manager satisfaction: > 85%
- HR satisfaction: > 90%
- System uptime: 99.9%

### 11.2 Business Impact

**Cost Savings:**
- 70% reduction in manual processing time
- 60% reduction in approval delays
- 50% reduction in data entry errors
- 40% reduction in fraud losses

**Process Improvements:**
- 88% claims auto-approved
- 95% data accuracy
- 100% audit trail
- Real-time status tracking

---

## 12. Future Roadmap

### Phase 1 (Current)
✅ Core reimbursement processing
✅ OCR data extraction
✅ Multi-agent AI system
✅ Return to employee workflow
✅ Comments system
✅ HR corrections
✅ Settlement tracking
✅ Self-contained data management

### Phase 2 (Q1)
- Kronos integration (timesheet)
- HRMS integration (employee master)
- Advanced analytics dashboard
- Mobile app (iOS/Android)

### Phase 3 (Q2)
- Payroll integration (auto-disbursement)
- Multi-currency support
- International tax handling
- Advanced fraud detection

### Phase 4 (Q3)
- AI policy recommendations
- Predictive budgeting
- Chatbot interface
- Voice claim submission

---

## Glossary


**Allowance** - Fixed amount claim without supporting documents  
**BSON** - Binary JSON (MongoDB document format)  
**DocumentDB.io** - PostgreSQL-based MongoDB-compatible database  
**Gemini** - Google's advanced LLM  
**OCR** - Optical Character Recognition  
**Reimbursement** - Variable amount claim with supporting documents  
**SPA** - Single Page Application  
**RBAC** - Role-Based Access Control  
**API** - Application Programming Interface  
**UI/UX** - User Interface / User Experience  

---

## 🌟 Final Notes

**Reinvo-Dash** represents the future of expense management - combining modern web technologies with AI-powered automation. The current implementation provides a solid foundation with a complete, production-ready frontend. The planned backend integration will unlock the full potential of automated claim processing, OCR document extraction, and intelligent validation.

### Quick Stats

- 📦 **50+ Components** - Fully reusable and type-safe
- 🎨 **15+ Pages** - Complete user workflows
- 🔧 **Custom Hooks** - Abstracted data fetching
- 📊 **Mock Data** - Comprehensive testing scenarios
- 🎯 **100% TypeScript** - Type-safe throughout
- 📱 **Fully Responsive** - Works on all devices

### Get Started Now

```bash
git clone <repository-url>
cd reinvo-dash
npm install && npm run dev
```

**Happy Coding!** 🚀

---

*Last Updated: December 2025*  
*Version: 1.0.0 (Frontend Complete)*

