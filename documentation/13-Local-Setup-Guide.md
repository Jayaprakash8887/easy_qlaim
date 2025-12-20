# Local Development Setup Guide

## Easy Qlaim - Developer Setup

### 1. Prerequisites

#### 1.1 Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend build |
| PostgreSQL | 15+ | Primary database |
| Redis | 7.2+ | Cache & queue |
| Docker | 24+ | Optional containerization |
| Tesseract | 4.0+ | OCR engine |

#### 1.2 Optional Software

| Software | Purpose |
|----------|---------|
| Docker Compose | Container orchestration |
| Keycloak | Enterprise SSO |
| VS Code | Recommended IDE |

---

### 2. Quick Start (Docker)

The fastest way to get started is using Docker Compose:

```bash
# Clone repository
git clone https://github.com/your-org/easy-qlaim.git
cd easy-qlaim

# Start all services
./start.sh

# Or manually:
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
./stop.sh
```

**Services started:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Keycloak (optional): http://localhost:8180

---

### 3. Manual Setup (Development)

#### 3.1 Clone Repository

```bash
git clone https://github.com/your-org/easy-qlaim.git
cd easy-qlaim
```

#### 3.2 Backend Setup

**Create Python virtual environment:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
.\venv\Scripts\activate   # Windows
```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Install Tesseract OCR:**
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract

# Windows
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
```

**Create environment file:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

**Initialize database:**
```bash
# Create PostgreSQL database
createdb easy_qlaim

# Run migrations
python -c "from database import init_db_sync; init_db_sync()"
```

**Start backend server:**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Start Celery worker:**
```bash
# In a new terminal
source venv/bin/activate
celery -A celery_app worker --loglevel=info
```

#### 3.3 Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun dev
```

**Access frontend:** http://localhost:5173

---

### 4. Environment Configuration

#### 4.1 Backend .env File

```bash
# Application
APP_NAME="Easy Qlaim"
APP_ENV=development
DEBUG=True
SECRET_KEY=your-secret-key-change-in-production

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/easy_qlaim
MONGODB_URI=mongodb://localhost:27017/easy_qlaim

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_URL=redis://localhost:6379/1

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# LLM Provider (choose one)
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your-google-api-key

# Alternative LLM providers
# OPENAI_API_KEY=your-openai-key
# ANTHROPIC_API_KEY=your-anthropic-key

# Storage
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./uploads

# For cloud storage:
# STORAGE_PROVIDER=gcs
# GCP_PROJECT_ID=your-project
# GCP_BUCKET_NAME=your-bucket
# GCP_CREDENTIALS_PATH=./credentials.json

# OCR
ENABLE_OCR=True
OCR_ENGINE=tesseract
OCR_USE_LLM_FALLBACK=True

# Authentication
JWT_SECRET_KEY=your-jwt-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Keycloak (optional)
KEYCLOAK_ENABLED=False
# KEYCLOAK_SERVER_URL=http://localhost:8180
# KEYCLOAK_REALM=easy-qlaim
# KEYCLOAK_CLIENT_ID=easy-qlaim-app

# Features
ENABLE_AUTO_APPROVAL=True
AUTO_APPROVAL_CONFIDENCE_THRESHOLD=0.95
ENABLE_AI_VALIDATION=True
```

#### 4.2 Frontend .env File

```bash
# API Configuration
VITE_API_URL=http://localhost:8000
VITE_API_VERSION=v1

# Features
VITE_ENABLE_MOCK=false
VITE_DEBUG=true
```

---

### 5. Database Setup

#### 5.1 PostgreSQL Installation

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

#### 5.2 Create Database

```bash
# Connect as postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE easy_qlaim;
CREATE USER easy_qlaim_user WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE easy_qlaim TO easy_qlaim_user;

# Enable pg_trgm extension (for full-text search)
\c easy_qlaim
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\q
```

#### 5.3 Run Migrations

```bash
cd backend
source venv/bin/activate

# Initialize tables
python -c "from database import init_db_sync; init_db_sync()"

# Run SQL migrations (if any)
psql -U easy_qlaim_user -d easy_qlaim -f migrations/001_initial.sql
psql -U easy_qlaim_user -d easy_qlaim -f migrations/002_add_composite_indexes.sql
```

---

### 6. Redis Setup

#### 6.1 Installation

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**macOS:**
```bash
brew install redis
brew services start redis
```

#### 6.2 Verify Connection

```bash
redis-cli ping
# Should respond: PONG
```

---

### 7. Initial Data Setup

#### 7.1 Create System Admin

```bash
cd backend
source venv/bin/activate

python -c "
from database import get_sync_db
from models import User, Tenant
from passlib.context import CryptContext
import uuid

pwd_context = CryptContext(schemes=['bcrypt'])

db = next(get_sync_db())

# Create default tenant
tenant = Tenant(
    id=uuid.uuid4(),
    name='Default Organization',
    code='DEFAULT',
    is_active=True
)
db.add(tenant)
db.commit()

# Create admin user
admin = User(
    id=uuid.uuid4(),
    tenant_id=tenant.id,
    username='admin',
    email='admin@example.com',
    hashed_password=pwd_context.hash('admin123'),
    roles=['EMPLOYEE', 'ADMIN'],
    is_active=True
)
db.add(admin)
db.commit()

print('Admin created: admin / admin123')
"
```

#### 7.2 Create Test Data

```bash
python scripts/seed_test_data.py
```

---

### 8. Running the Application

#### 8.1 Start All Services

**Terminal 1 - Backend API:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Celery Worker:**
```bash
cd backend
source venv/bin/activate
celery -A celery_app worker --loglevel=info
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

#### 8.2 Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/api/docs |
| API Docs (ReDoc) | http://localhost:8000/api/redoc |

---

### 9. Development Tools

#### 9.1 VS Code Extensions

Recommended extensions:
- Python (ms-python.python)
- Pylance (ms-python.vscode-pylance)
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)
- Docker (ms-azuretools.vscode-docker)

#### 9.2 VS Code Settings

`.vscode/settings.json`:
```json
{
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "python.formatting.provider": "black",
    "editor.formatOnSave": true,
    "[python]": {
        "editor.defaultFormatter": "ms-python.black-formatter"
    },
    "[typescript]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    },
    "[typescriptreact]": {
        "editor.defaultFormatter": "esbenp.prettier-vscode"
    }
}
```

---

### 10. Testing

#### 10.1 Backend Tests

```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_claims.py -v
```

#### 10.2 Frontend Tests

```bash
cd frontend

# Run tests
npm run test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

---

### 11. Troubleshooting

#### 11.1 Common Issues

**Database connection error:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U postgres -h localhost -d easy_qlaim
```

**Redis connection error:**
```bash
# Check Redis is running
redis-cli ping

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

**Celery tasks not processing:**
```bash
# Check Celery worker is running
celery -A celery_app inspect active

# Check Redis broker
redis-cli llen celery
```

**OCR not working:**
```bash
# Verify Tesseract installation
tesseract --version

# Test OCR
tesseract test-image.png output
```

#### 11.2 Reset Database

```bash
# Drop and recreate database
dropdb easy_qlaim
createdb easy_qlaim

# Reinitialize
cd backend
python -c "from database import init_db_sync; init_db_sync()"
```

#### 11.3 Clear Cache

```bash
redis-cli FLUSHALL
```

---

### 12. Development Workflow

#### 12.1 Code Style

- **Python:** Black formatter, isort for imports
- **TypeScript:** Prettier, ESLint
- **Commits:** Conventional commits format

#### 12.2 Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/your-feature
```

#### 12.3 Pre-commit Hooks

```bash
# Install pre-commit
pip install pre-commit
pre-commit install

# Run manually
pre-commit run --all-files
```

---

*Document Version: 1.0 | Last Updated: December 2025*
