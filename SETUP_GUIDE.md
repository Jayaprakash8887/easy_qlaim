# Reimbursement & Allowance Management System

## Complete Setup Guide

This guide will help you set up and run the complete Claims Automation System for your hackathon.

## 🏗️ System Architecture

```
┌─────────────┐
│   React UI  │ ← User Interface (Port 5173)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  FastAPI    │ ← REST API (Port 8000)
└──────┬──────┘
       │
       ├──→ PostgreSQL (Database)
       ├──→ Redis (Task Queue)
       └──→ Celery Workers (AI Agents)
                ↓
         Google Gemini AI
```

## 📋 Prerequisites

### Required Software
- **Python** 3.11 or higher
- **Node.js** 18 or higher
- **PostgreSQL** 15 or higher
- **Redis** 7.2 or higher
- **Git**

### Required Accounts
- **Google Cloud Account** (for Gemini API access)

## 🚀 Step-by-Step Setup

### Step 1: Clone and Navigate

```bash
cd /home/jayaprakashnarayanaswamy/agents_007
```

### Step 2: Set Up Backend

#### 2.1 Install Python Dependencies

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

#### 2.2 Set Up PostgreSQL

```bash
# Install PostgreSQL (if not installed)
sudo apt-get install postgresql postgresql-contrib  # Ubuntu/Debian
# or
brew install postgresql@15  # macOS

# Start PostgreSQL
sudo systemctl start postgresql  # Linux
# or
brew services start postgresql@15  # macOS

# Create database
sudo -u postgres psql
```

In PostgreSQL shell:
```sql
CREATE DATABASE reimbursement_db;
CREATE USER reimbursement_user WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE reimbursement_db TO reimbursement_user;
\q
```

#### 2.3 Set Up Redis

```bash
# Install Redis
sudo apt-get install redis-server  # Ubuntu/Debian
# or
brew install redis  # macOS

# Start Redis
sudo systemctl start redis-server  # Linux
# or
brew services start redis  # macOS

# Test Redis
redis-cli ping  # Should return PONG
```

#### 2.4 Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
```

**Update these critical settings in .env:**
```bash
# Database
DATABASE_URL=postgresql://reimbursement_user:your_password_here@localhost:5432/reimbursement_db
MONGODB_URI=postgresql://reimbursement_user:your_password_here@localhost:5432/reimbursement_db

# Security
SECRET_KEY=<generate with: openssl rand -hex 32>
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>

# Google AI
GOOGLE_API_KEY=<your_gemini_api_key>

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

#### 2.5 Initialize Database

```bash
# Initialize database tables
python -c "from database import init_db; init_db()"
```

### Step 3: Set Up Frontend

```bash
# Navigate to frontend
cd ../artifacts/ui-design

# Install dependencies
npm install
# or
bun install

# Configure environment
cp .env.example .env

# Edit .env
nano .env
```

Update `.env`:
```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Step 4: Get Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and add it to `backend/.env` as `GOOGLE_API_KEY`

## ▶️ Running the Application

You'll need **5 terminal windows**:

### Terminal 1: Backend API Server

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

✅ API running at: http://localhost:8000
✅ API Docs at: http://localhost:8000/api/docs

### Terminal 2: Celery Worker (AI Agents)

```bash
cd backend
source venv/bin/activate
celery -A celery_app worker --loglevel=info
```

### Terminal 3: Celery Beat (Scheduled Tasks)

```bash
cd backend
source venv/bin/activate
celery -A celery_app beat --loglevel=info
```

### Terminal 4: Flower (Task Monitor - Optional)

```bash
cd backend
source venv/bin/activate
celery -A celery_app flower --port=5555
```

✅ Flower UI at: http://localhost:5555

### Terminal 5: Frontend

```bash
cd artifacts/ui-design
npm run dev
# or
bun run dev
```

✅ Frontend at: http://localhost:5173

## 🎯 Verify Installation

### 1. Check API Health

```bash
curl http://localhost:8000/health
```

Should return: `{"status":"healthy"}`

### 2. Check API Documentation

Open: http://localhost:8000/api/docs

### 3. Check Frontend

Open: http://localhost:5173

### 4. Check Celery Workers

Open: http://localhost:5555 (Flower)

## 📝 Creating Test Data

### Option 1: Via API Docs

1. Open http://localhost:8000/api/docs
2. Expand "Employees" → POST /employees
3. Click "Try it out"
4. Add employee data
5. Execute

### Option 2: Via Python Script

```python
# Create test_data.py in backend folder
from database import get_sync_db
from models import Employee, Project
from uuid import uuid4
from datetime import date

db = next(get_sync_db())

# Create test employee
employee = Employee(
    tenant_id=uuid4(),
    employee_id="EMP001",
    first_name="John",
    last_name="Doe",
    email="john.doe@company.com",
    department="Engineering",
    designation="Senior Developer",
    date_of_joining=date(2022, 1, 1),
    employment_status="ACTIVE"
)

db.add(employee)
db.commit()

print("Test data created!")
```

Run:
```bash
python test_data.py
```

## 🎨 Using the Application

### Create a Claim

1. Open http://localhost:5173
2. Navigate to "New Claim"
3. Select claim type (Reimbursement or Allowance)
4. Fill in details
5. Upload documents (for reimbursement)
6. Submit

### Track Claim Processing

1. Check Flower dashboard: http://localhost:5555
2. See AI agents processing the claim
3. View validation results in claim details

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check if port 8000 is in use
lsof -i :8000
# Kill if needed
kill -9 <PID>

# Check database connection
psql -U reimbursement_user -d reimbursement_db -h localhost
```

### Celery workers not starting

```bash
# Check Redis
redis-cli ping

# Check if Redis is running
sudo systemctl status redis-server

# Restart Redis
sudo systemctl restart redis-server
```

### Frontend build errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# or
rm -rf node_modules
bun install
```

### Database connection errors

Check:
1. PostgreSQL is running
2. Database exists
3. User has permissions
4. DATABASE_URL in .env is correct

## 📊 Demo Workflow

### Complete End-to-End Test

1. **Create Employee** (API Docs)
2. **Create Project** (API Docs)
3. **Submit Certification Claim**
   - Amount: ₹15,000
   - Upload certificate + invoice
4. **Watch AI Processing**
   - Document Agent: OCR extraction
   - Integration Agent: Employee data fetch
   - Validation Agent: Policy check
   - Approval Agent: Auto-approve (if rules pass)
5. **View Results** in UI

## 🎯 Key Features to Demo

1. ✅ **Auto-Approval**: High confidence claims
2. ✅ **OCR Extraction**: Document processing
3. ✅ **AI Validation**: Policy compliance check
4. ✅ **Return to Employee**: Correction workflow
5. ✅ **Multi-Role Comments**: Stakeholder feedback
6. ✅ **Settlement Tracking**: Payment management

## 📱 Access Points

- **Frontend UI**: http://localhost:5173
- **API Docs**: http://localhost:8000/api/docs
- **Flower (Tasks)**: http://localhost:5555
- **Health Check**: http://localhost:8000/health

## 🔐 Default Credentials

(To be implemented - currently no auth)

## 💡 Tips for Hackathon

1. **Pre-load test data** before demo
2. **Keep all 5 terminals running**
3. **Show Flower dashboard** for AI processing
4. **Demo OCR** with real documents
5. **Highlight auto-approval** feature
6. **Show validation reasoning** from AI

## 🆘 Quick Commands Reference

```bash
# Start everything (use tmux or multiple terminals)

# Terminal 1: API
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Terminal 2: Worker
cd backend && source venv/bin/activate && celery -A celery_app worker -l info

# Terminal 3: Beat
cd backend && source venv/bin/activate && celery -A celery_app beat -l info

# Terminal 4: Flower
cd backend && source venv/bin/activate && celery -A celery_app flower

# Terminal 5: Frontend
cd artifacts/ui-design && npm run dev
```

## 📞 Support

If you encounter issues:
1. Check logs in each terminal
2. Verify all services are running
3. Check `.env` configuration
4. Ensure API keys are valid

Good luck with your hackathon! 🚀
