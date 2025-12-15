# Reimbursement Validation & Disbursement Agent System

## Backend - AI-Powered Claims Processing System

This is the backend implementation of the Agentic AI Reimbursement System using FastAPI, Celery, and multi-agent architecture.

## 🏗️ Architecture

- **Framework**: FastAPI (async REST API)
- **Database**: PostgreSQL with DocumentDB.io (MongoDB-compatible API)
- **Task Queue**: Celery + Redis
- **AI Engine**: Google Gemini 2.0 (with multi-vendor support: OpenAI, Azure OpenAI, Anthropic Claude, AWS Bedrock)
- **OCR**: Tesseract (with Vision AI API fallback)
- **Multi-Agent System**: Custom agent orchestration

## 📋 Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7.2+
- Google Cloud Account (for Gemini API)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configurations
nano .env
```

**Required configurations:**
- `DATABASE_URL`: PostgreSQL connection string
- `MONGODB_URI`: DocumentDB.io connection string
- `GOOGLE_API_KEY`: Your Gemini API key
- `REDIS_URL`: Redis connection string
- `SECRET_KEY`: Generate with `openssl rand -hex 32`
- `JWT_SECRET_KEY`: Generate with `openssl rand -hex 32`

### 3. Initialize Database

```bash
# Run database migrations (create tables)
python -c "from database import init_db; init_db()"
```

### 4. Start Services

#### Terminal 1: FastAPI Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Terminal 2: Celery Worker
```bash
celery -A celery_app worker --loglevel=info --queues=orchestrator,document,validation,integration,approval,learning
```

#### Terminal 3: Celery Beat (Periodic Tasks)
```bash
celery -A celery_app beat --loglevel=info
```

#### Terminal 4: Flower (Optional - Task Monitoring)
```bash
celery -A celery_app flower --port=5555
```

## 📚 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **Flower Dashboard**: http://localhost:5555

## 🤖 Agent System

### Available Agents

1. **Orchestrator Agent**: Master coordinator for claim processing
2. **Document Agent**: OCR processing and document verification
3. **Validation Agent**: Policy validation with AI reasoning
4. **Integration Agent**: External data fetching (Employee/Project/Timesheet)
5. **Approval Agent**: Routing and approval workflow management
6. **Learning Agent**: Continuous improvement and pattern analysis

### Agent Workflow

```
Claim Submission → Orchestrator → Document Agent (OCR)
                                → Integration Agent (Data Fetch)
                                → Validation Agent (Policy Check)
                                → Approval Agent (Routing)
                                → Learning Agent (Analysis)
```

## 🔧 Configuration

### Feature Flags

Enable/disable features in `.env`:

```bash
ENABLE_AUTO_APPROVAL=True
ENABLE_OCR=True
ENABLE_AI_VALIDATION=True
ENABLE_LEARNING_AGENT=True
```

### External Integrations

Configure future integrations:

```bash
# HRMS Integration
HRMS_ENABLED=False
HRMS_API_URL=
HRMS_FALLBACK_TO_LOCAL=True

# Kronos Timesheet
KRONOS_ENABLED=False
KRONOS_API_URL=
```

## 🧪 Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=. --cov-report=html
```

## 📦 Project Structure

```
backend/
├── agents/              # AI Agents
│   ├── base_agent.py   # Base agent class
│   ├── orchestrator.py # Master coordinator
│   ├── document_agent.py
│   ├── validation_agent.py
│   ├── integration_agent.py
│   ├── approval_agent.py
│   └── learning_agent.py
├── api/                 # API endpoints
│   └── v1/
│       ├── claims.py
│       ├── employees.py
│       └── ...
├── models.py            # Database models
├── schemas.py           # Pydantic schemas
├── database.py          # DB connection
├── config.py            # Configuration
├── celery_app.py        # Celery setup
├── main.py              # FastAPI app
└── requirements.txt
```

## 🔐 Security

- JWT-based authentication (to be implemented)
- Role-based access control (EMPLOYEE, MANAGER, HR, FINANCE, ADMIN)
- API rate limiting
- CORS configuration
- Input validation with Pydantic

## 📊 Monitoring

- **Flower**: Celery task monitoring at http://localhost:5555
- **Logs**: Check logs in `/var/log/reimbursement/app.log`
- **Health Check**: GET http://localhost:8000/health

## 🐛 Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check PostgreSQL is running
   - Verify DATABASE_URL in .env

2. **Celery workers not processing tasks**
   - Check Redis is running
   - Verify CELERY_BROKER_URL in .env

3. **OCR not working**
   - Install Tesseract: `apt-get install tesseract-ocr`
   - Check Tesseract is in PATH

4. **Gemini API errors**
   - Verify GOOGLE_API_KEY is valid
   - Check API quota

## 🔄 Development Workflow

1. Create feature branch
2. Make changes
3. Run tests: `pytest`
4. Format code: `black .`
5. Lint: `flake8 .`
6. Type check: `mypy .`
7. Commit and push

## 📝 Environment Variables Reference

See `.env.example` for complete list of configuration options.

## 🚢 Deployment

### Using Docker (Coming Soon)

```bash
docker-compose up -d
```

### Manual Deployment

1. Set up PostgreSQL and Redis
2. Configure production `.env`
3. Run migrations
4. Start services with supervisor/systemd

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📞 Support

For issues and questions, please create an issue in the repository.
