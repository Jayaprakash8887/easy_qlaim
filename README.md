# Easy Qlaim 🤖

## AI-Powered Expense Reimbursement Platform

An intelligent, multi-agent AI system for automating reimbursement and allowance claim processing using Google Gemini, FastAPI, and React.

---

## 🌟 Key Features

### ✨ Core Capabilities
- **Auto-Approval**: AI validates and auto-approves high-confidence claims (95%+)
- **Smart OCR**: PaddleOCR extracts data from receipts, invoices, and certificates
- **AI Validation**: Gemini 2.0 performs intelligent policy compliance checks
- **Return Workflow**: Non-destructive claim return for employee corrections
- **Multi-Role Access**: Employee, Manager, HR, Finance portals
- **Real-time Processing**: Celery-based async task queue with live monitoring
- **Complete Audit Trail**: Track every action, comment, and edit

### 🤖 Multi-Agent Architecture
1. **Orchestrator Agent**: Master workflow coordinator
2. **Document Agent**: OCR processing and fraud detection
3. **Validation Agent**: Hybrid rule-based + AI policy validation
4. **Integration Agent**: Employee/Project/Timesheet data fetching
5. **Approval Agent**: Intelligent routing and settlement
6. **Learning Agent**: Continuous improvement and pattern analysis

---

## 🏗️ Tech Stack

### Backend
- **Framework**: FastAPI (async REST API)
- **Database**: PostgreSQL + DocumentDB.io (MongoDB-compatible API)
- **Task Queue**: Celery + Redis
- **AI**: Google Gemini 2.0 Flash
- **OCR**: PaddleOCR (self-hosted, 95%+ accuracy)
- **Language**: Python 3.11+

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui + Tailwind CSS
- **State Management**: React Query
- **Routing**: React Router v6

---

## 📊 System Architecture

```
┌────────────────────────────────────────────────────┐
│               React Frontend (Port 5173)            │
│  • Employee Portal  • Manager Portal  • HR Portal   │
└────────────────────┬───────────────────────────────┘
                     │ REST API
                     ▼
┌────────────────────────────────────────────────────┐
│           FastAPI Backend (Port 8000)               │
│  • JWT Auth  • CORS  • Validation  • File Upload   │
└────────────────────┬───────────────────────────────┘
                     │
         ┌───────────┼──────────────┐
         ▼           ▼              ▼
   ┌──────────┐ ┌─────────┐  ┌───────────┐
   │PostgreSQL│ │  Redis  │  │  Celery   │
   │   +      │ │ Message │  │  Workers  │
   │DocumentDB│ │  Broker │  │ (5 queues)│
   └──────────┘ └─────────┘  └─────┬─────┘
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
              ┌──────────┐    ┌──────────┐   ┌──────────┐
              │Document  │    │Validation│   │Integration│
              │  Agent   │    │  Agent   │   │   Agent   │
              │(OCR+AI)  │    │(Rules+AI)│   │(Data Fetch)│
              └──────────┘    └──────────┘   └──────────┘
                         ▼
                   Google Gemini 2.0
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7.2+
- Google Cloud Account (Gemini API)

### 1. Clone Repository
```bash
cd /home/jayaprakashnarayanaswamy/agents_007
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings (DB, Redis, Gemini API key)

# Initialize database
python -c "from database import init_db; init_db()"

# Create test data
python create_test_data.py
```

### 3. Frontend Setup
```bash
cd ../artifacts/ui-design

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

### 4. Start Services (5 Terminals)

**Terminal 1: API Server**
```bash
cd backend && source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2: Celery Worker**
```bash
cd backend && source venv/bin/activate
celery -A celery_app worker --loglevel=info
```

**Terminal 3: Celery Beat**
```bash
cd backend && source venv/bin/activate
celery -A celery_app beat --loglevel=info
```

**Terminal 4: Flower (Task Monitor)**
```bash
cd backend && source venv/bin/activate
celery -A celery_app flower --port=5555
```

**Terminal 5: Frontend**
```bash
cd artifacts/ui-design
npm run dev
```

### 5. Access Application

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/api/docs
- **Flower**: http://localhost:5555
- **Health**: http://localhost:8000/health

---

## 📖 Complete Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**: Detailed step-by-step setup instructions
- **[backend/README.md](./backend/README.md)**: Backend architecture and API docs
- **[System Design](./artifacts/tech_design_docs/System_Design.md)**: Complete system architecture
- **[Database Schema](./artifacts/tech_design_docs/DocumentDB_Schema_Design_v3.0_Complete.md)**: Database design
- **[Validation Strategy](./artifacts/tech_design_docs/Validation_Optimization_Strategy.md)**: AI validation approach

---

## 🎯 Demo Workflow

### End-to-End Claim Processing

1. **Employee Submits Claim**
   - Select category (Certification, Travel, On-Call, etc.)
   - Upload documents (invoice, certificate)
   - Fill details or use OCR-extracted data

2. **AI Processing (Automatic)**
   - Document Agent: OCR extracts amount, date, vendor
   - Integration Agent: Fetches employee tenure, project data
   - Validation Agent: Checks policy compliance
   - Approval Agent: Routes based on confidence

3. **Auto-Approval or Review**
   - High confidence (≥95%): Auto-approved → Finance
   - Medium (80-95%): Manager review required
   - Low or exceptions: HR review

4. **Settlement**
   - Finance approves payment
   - Marks as settled with payment reference
   - Employee notified

---

## 🎨 Key Features for Demo

### 1. Smart Document Processing
- Upload receipt/invoice PDF or image
- OCR automatically extracts:
  - Amount
  - Date
  - Vendor name
  - Category
- Employee can verify/edit extracted data
- Complete edit history tracked

### 2. AI-Powered Validation
- Hybrid approach:
  - **80% rule-based** (fast, deterministic)
  - **20% AI reasoning** (edge cases)
- Policy compliance check
- Confidence scoring
- Human-readable reasoning

### 3. Flexible Workflows
- **Return to Employee**: Manager/HR can return claim for corrections
- **Multi-stakeholder Comments**: All roles can comment
- **HR Corrections**: HR can adjust amount or category
- **Settlement Tracking**: Complete payment lifecycle

### 4. Real-time Monitoring
- Flower dashboard shows live task processing
- See AI agents in action
- Track execution times and confidence scores

---

## 📁 Project Structure

```
agents_007/
├── backend/                    # Python FastAPI backend
│   ├── agents/                 # Multi-agent system
│   │   ├── base_agent.py
│   │   ├── orchestrator.py
│   │   ├── document_agent.py
│   │   ├── validation_agent.py
│   │   ├── integration_agent.py
│   │   ├── approval_agent.py
│   │   └── learning_agent.py
│   ├── api/                    # REST API endpoints
│   │   └── v1/
│   │       ├── claims.py
│   │       ├── employees.py
│   │       └── ...
│   ├── models.py               # Database models
│   ├── schemas.py              # Pydantic schemas
│   ├── database.py             # DB connection
│   ├── celery_app.py          # Celery configuration
│   ├── config.py              # Settings
│   ├── main.py                # FastAPI app
│   └── requirements.txt
│
├── artifacts/
│   ├── ui-design/             # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── lib/
│   │   │   │   └── api-client.ts
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   ├── tech_design_docs/      # Design documentation
│   │   ├── System_Design.md
│   │   ├── DocumentDB_Schema_Design_v3.0_Complete.md
│   │   └── Validation_Optimization_Strategy.md
│   │
│   └── policies/               # Company policies (PDFs)
│
├── SETUP_GUIDE.md             # Detailed setup instructions
└── README.md                  # This file
```

---

## 🔧 Configuration

### Environment Variables

**Backend (.env)**
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/reimbursement_db
MONGODB_URI=postgresql://user:pass@localhost:5432/reimbursement_db

# Security
SECRET_KEY=<generate-with-openssl>
JWT_SECRET_KEY=<generate-with-openssl>

# AI
GOOGLE_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-2.0-flash-exp

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0

# Features
ENABLE_AUTO_APPROVAL=True
AUTO_APPROVAL_CONFIDENCE_THRESHOLD=0.95
ENABLE_OCR=True
ENABLE_AI_VALIDATION=True
```

**Frontend (.env)**
```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 🧪 Testing

### Manual Testing via API Docs
1. Open http://localhost:8000/api/docs
2. Use interactive Swagger UI
3. Test all endpoints

### Create Test Data
```bash
cd backend
python create_test_data.py
```

This creates:
- 3 test employees
- 3 test users (credentials in output)
- 2 test projects
- 3 policy documents
- 2 sample claims

---

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U your_user -d reimbursement_db -h localhost
```

**Celery Workers Not Processing**
```bash
# Check Redis
redis-cli ping  # Should return PONG

# Check Celery logs
celery -A celery_app worker --loglevel=debug
```

**Frontend Build Errors**
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Gemini API Errors**
- Verify API key is correct
- Check quota at https://makersuite.google.com
- Ensure billing is enabled

---

## 📞 Support & Contact

For setup issues or questions:
- Check SETUP_GUIDE.md for detailed instructions
- Check documentation/ folder for comprehensive guides
- Review API docs at http://localhost:8000/api/docs
- Check logs in terminal outputs

---

## 📄 License

MIT License

---

## 🙏 Acknowledgments

- **Google Gemini**: AI reasoning engine
- **FastAPI**: Lightning-fast Python framework
- **shadcn/ui**: Beautiful React components
- **Tesseract OCR**: Open-source OCR engine

---

**Easy Qlaim - AI-Powered Expense Management**
