# Quick Start Checklist ✅

## Pre-Hackathon Setup (Do this BEFORE the demo)

### 1. Install System Dependencies ⚙️
- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed  
- [ ] PostgreSQL 15+ installed and running
- [ ] Redis 7.2+ installed and running

### 2. Get API Keys 🔑
- [ ] Google Gemini API key from https://makersuite.google.com/app/apikey
- [ ] Save API key securely

### 3. Backend Setup 🐍
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env - Add your database URL, Redis URL, and Gemini API key
python -c "from database import init_db; init_db()"
python create_test_data.py
```

- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] .env configured with all keys
- [ ] Database tables created
- [ ] Test data loaded

### 4. Frontend Setup ⚛️
```bash
cd artifacts/ui-design
npm install
cp .env.example .env
# Edit .env if needed (default should work)
```

- [ ] Dependencies installed
- [ ] .env file created

### 5. Test Run 🧪
Start all 5 terminals:

**Terminal 1: API**
```bash
cd backend && source venv/bin/activate
uvicorn main:app --reload
```
- [ ] API running on http://localhost:8000

**Terminal 2: Celery Worker**
```bash
cd backend && source venv/bin/activate
celery -A celery_app worker --loglevel=info
```
- [ ] Celery worker running

**Terminal 3: Celery Beat**
```bash
cd backend && source venv/bin/activate
celery -A celery_app beat --loglevel=info
```
- [ ] Celery beat running

**Terminal 4: Flower**
```bash
cd backend && source venv/bin/activate
celery -A celery_app flower --port=5555
```
- [ ] Flower UI at http://localhost:5555

**Terminal 5: Frontend**
```bash
cd artifacts/ui-design
npm run dev
```
- [ ] Frontend running on http://localhost:5173

### 6. Verify Everything Works ✓
- [ ] Open http://localhost:8000/health → Should return `{"status":"healthy"}`
- [ ] Open http://localhost:8000/api/docs → Should show Swagger UI
- [ ] Open http://localhost:5173 → Should show your React app
- [ ] Open http://localhost:5555 → Should show Flower dashboard

### 7. Test E2E Flow 🔄
- [ ] Create a test claim via frontend or API docs
- [ ] Submit the claim
- [ ] Watch Flower dashboard for task processing
- [ ] Verify claim status updates

---

## Hackathon Demo Day Checklist 🎤

### Morning Setup (2 hours before)
- [ ] Start PostgreSQL
- [ ] Start Redis  
- [ ] Start all 5 terminals
- [ ] Verify all services are healthy
- [ ] Pre-load 2-3 demo claims
- [ ] Prepare 1-2 sample documents (PDF invoices)

### Demo Preparation
- [ ] Open tabs:
  - Frontend UI
  - API Swagger docs
  - Flower dashboard
- [ ] Have sample documents ready to upload
- [ ] Know your test user credentials
- [ ] Rehearse the demo flow once

### Demo Flow (5-10 minutes)
1. **Introduction** (1 min)
   - "AI-powered claims processing system"
   - "Reduces approval time by 90%"
   
2. **Show Existing Claims** (1 min)
   - Dashboard overview
   - Status tracking
   
3. **Create New Claim** (2 min)
   - Upload document
   - Show OCR extraction
   - Submit claim
   
4. **Show AI Processing** (2 min)
   - Switch to Flower dashboard
   - Point out agents running
   - Show validation results
   
5. **Show Auto-Approval** (1 min)
   - Claim status updated
   - AI confidence score
   - Reasoning displayed
   
6. **Highlight Key Features** (2 min)
   - Multi-agent architecture
   - Return workflow
   - Complete audit trail
   
7. **Q&A** (remaining time)

### Key Points to Emphasize
- ✅ **Fully functional** - not just a prototype
- ✅ **Production-ready architecture** - FastAPI, PostgreSQL, Celery
- ✅ **Latest AI** - Google Gemini 2.0
- ✅ **Cost-optimized** - Hybrid validation (95% cost reduction)
- ✅ **Scalable** - Multi-agent, async task processing
- ✅ **Complete solution** - Frontend + Backend + AI

### Backup Plans
- [ ] If internet fails: Demo offline (already installed)
- [ ] If API fails: Show architecture diagrams
- [ ] If demo fails: Have screenshots/video ready

---

## Troubleshooting Quick Fixes 🔧

### API won't start
```bash
# Check if port 8000 is in use
lsof -i :8000
# Kill process if needed
kill -9 <PID>
```

### Celery won't connect to Redis
```bash
# Restart Redis
sudo systemctl restart redis-server
# Or on Mac
brew services restart redis
```

### Database errors
```bash
# Recreate database
python -c "from database import drop_db, init_db; drop_db(); init_db()"
python create_test_data.py
```

### Frontend won't start
```bash
# Clear and reinstall
rm -rf node_modules
npm install
```

---

## Emergency Contacts 📞

- **Setup Guide**: See SETUP_GUIDE.md
- **Architecture**: See artifacts/tech_design_docs/System_Design.md
- **API Docs**: http://localhost:8000/api/docs (when running)

---

## Post-Hackathon 🎉

- [ ] Get feedback from judges
- [ ] Document any issues encountered
- [ ] Plan next features
- [ ] Consider open-sourcing

---

**Good luck! You've got this! 🚀**
