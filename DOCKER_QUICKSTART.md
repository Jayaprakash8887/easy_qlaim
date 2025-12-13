# Docker Quickstart Guide 🐳

## Prerequisites
- Docker installed and running
- Docker Compose installed
- Google Gemini API key

## 🚀 Quick Start (3 Simple Steps)

### Step 1: Set Your API Key
```bash
export GOOGLE_API_KEY='your-gemini-api-key-here'
```

Or create a `.env` file in the project root:
```bash
echo "GOOGLE_API_KEY=your-api-key-here" > .env
```

### Step 2: Run the Setup Script
```bash
chmod +x start.sh
./start.sh
```

### Step 3: Access the Application
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/api/docs
- **Flower (Task Monitor)**: http://localhost:5555
- **Health Check**: http://localhost:8000/health

That's it! The application is now running. 🎉

## 📋 Container Services

The application runs 7 Docker containers:
1. **postgres** - PostgreSQL database (port 5432)
2. **redis** - Redis for task queue (port 6379)
3. **backend** - FastAPI server (port 8000)
4. **celery_worker** - AI agents processing
5. **celery_beat** - Scheduled tasks
6. **flower** - Task monitoring UI (port 5555)
7. **frontend** - React UI (port 5173)

## 🛠️ Common Commands

### View All Logs
```bash
docker-compose logs -f
```

### View Specific Service Logs
```bash
docker-compose logs -f backend
docker-compose logs -f celery_worker
docker-compose logs -f frontend
```

### Stop All Services
```bash
./stop.sh
# or
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild After Code Changes
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### Access Container Shell
```bash
# Backend
docker exec -it reimbursement_api bash

# Database
docker exec -it reimbursement_db psql -U reimbursement_user -d reimbursement_db
```

### Reset Everything (Including Data)
```bash
docker-compose down -v
./start.sh
```

## 🧪 Test Credentials

After running `start.sh`, use these test accounts:
- **Username**: john.doe | **Password**: password123 | **Role**: EMPLOYEE
- **Username**: jane.smith | **Password**: password123 | **Role**: EMPLOYEE, MANAGER
- **Username**: alice.johnson | **Password**: password123 | **Role**: HR

## 🐛 Troubleshooting

### Services Won't Start
```bash
# Check Docker is running
docker ps

# Check logs
docker-compose logs
```

### Port Already in Use
```bash
# Find and kill process using port 8000
lsof -ti:8000 | xargs kill -9

# Or change ports in docker-compose.yml
```

### Database Connection Issues
```bash
# Restart database
docker-compose restart postgres

# Check database is healthy
docker-compose ps
```

### Frontend Build Issues
```bash
# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

### Clear All Docker Data
```bash
# WARNING: This removes ALL Docker data
docker system prune -a --volumes
```

## 📊 Check System Status

```bash
# View running containers
docker-compose ps

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check resource usage
docker stats
```

## 🔄 Development Workflow

1. **Make code changes** in `backend/` or `artifacts/ui-design/`
2. **Changes auto-reload** (volume mounted, no rebuild needed)
3. **For new dependencies**: 
   ```bash
   docker-compose build <service-name>
   docker-compose up -d <service-name>
   ```

## 🚢 Production Deployment

For production, update `docker-compose.yml`:
- Change environment to `production`
- Set strong `SECRET_KEY` and `JWT_SECRET_KEY`
- Configure proper CORS origins
- Use environment secrets management
- Set up reverse proxy (nginx)
- Enable HTTPS

## 💡 Tips

- **First time setup** takes 2-3 minutes (downloading images, building)
- **Subsequent starts** take ~30 seconds
- **Code changes** auto-reload in development mode
- **Database data** persists between restarts (volume)
- **Logs** are your friend - check them if something fails

---

**Need more help?** Check `SETUP_GUIDE.md` for detailed documentation.
