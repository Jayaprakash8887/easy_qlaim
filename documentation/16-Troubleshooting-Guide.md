# Troubleshooting Guide

## Easy Qlaim - Common Issues and Solutions

### 1. Startup Issues

#### 1.1 Backend Won't Start

**Symptom:** `uvicorn main:app` fails to start

**Common Causes and Solutions:**

```bash
# Issue: Port already in use
# Error: "[ERROR] Address already in use"
# Solution: Kill the process using port 8000
lsof -ti:8000 | xargs kill -9

# Issue: Database connection failed
# Error: "could not connect to server"
# Solution: Verify PostgreSQL is running
sudo systemctl status postgresql
sudo systemctl start postgresql

# Issue: Missing environment variables
# Error: "KeyError: 'DATABASE_URL'"
# Solution: Ensure .env file exists and is properly configured
cp .env.example .env
# Edit .env with your configuration
```

#### 1.2 Database Connection Errors

**Symptom:** `psycopg2.OperationalError: could not connect`

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check if database exists
psql -U postgres -c "\l" | grep claims_db

# Create database if missing
psql -U postgres -c "CREATE DATABASE claims_db;"

# Check connection string format
# Correct: postgresql://user:password@localhost:5432/claims_db
# Common errors: missing port, wrong password, typos
```

#### 1.3 Redis Connection Issues

**Symptom:** Celery workers can't connect

```bash
# Check Redis is running
sudo systemctl status redis-server

# Test Redis connection
redis-cli ping
# Expected output: PONG

# Check Redis URL in .env
# Format: redis://localhost:6379/0
```

---

### 2. Celery Worker Issues

#### 2.1 Workers Not Processing Tasks

**Symptom:** Claims stuck in "SUBMITTED" status

```bash
# Check if workers are running
celery -A celery_app inspect active

# Check for errors in worker logs
celery -A celery_app worker -l DEBUG

# Verify Redis broker connection
celery -A celery_app inspect ping

# Restart workers
pkill -f "celery worker"
celery -A celery_app worker -l info
```

#### 2.2 Flower Dashboard Not Accessible

```bash
# Default URL: http://localhost:5555
# If not accessible:

# Check if Flower is running
ps aux | grep flower

# Start Flower with explicit port
celery -A celery_app flower --port=5555

# Allow through firewall
sudo ufw allow 5555
```

---

### 3. OCR/Document Processing Issues

#### 3.1 OCR Returning Low Confidence

**Symptom:** OCR confidence below threshold

**Solutions:**

1. **Check image quality**
   - Minimum resolution: 300 DPI
   - Clear, unrotated images
   - Good lighting, no shadows

2. **Configure fallback to LLM Vision**
   ```env
   # In .env
   OCR_CONFIDENCE_THRESHOLD=0.70
   OCR_USE_LLM_FALLBACK=true
   LLM_VISION_PROVIDER=google
   ```

3. **Verify Tesseract installation**
   ```bash
   tesseract --version
   # Should show: tesseract 4.x or 5.x
   
   # Install if missing (Ubuntu)
   sudo apt install tesseract-ocr tesseract-ocr-eng
   ```

#### 3.2 Document Upload Failures

**Symptom:** "Upload failed" errors

```bash
# Check upload directory exists and has permissions
mkdir -p backend/uploads
chmod 755 backend/uploads

# Check file size limits (default 10MB)
# Increase in .env if needed:
MAX_UPLOAD_SIZE_MB=20

# Verify supported file types
# Supported: PDF, JPEG, PNG, WEBP
```

---

### 4. AI/LLM Issues

#### 4.1 Gemini API Errors

**Symptom:** "API quota exceeded" or "Invalid API key"

```bash
# Verify API key
echo $GOOGLE_API_KEY

# Check quota at Google Cloud Console
# https://console.cloud.google.com/apis/dashboard

# Solutions:
# 1. Verify API key is correct in .env
# 2. Enable Gemini API in Google Cloud Console
# 3. Check billing is enabled
# 4. Wait for quota reset (usually hourly)
```

#### 4.2 Slow AI Response Times

**Solutions:**

1. **Use caching**
   ```env
   ENABLE_AI_CACHE=true
   AI_CACHE_TTL_SECONDS=3600
   ```

2. **Reduce prompt size**
   - Keep documents under 5 pages
   - Use summarization for large documents

3. **Switch to faster model**
   ```env
   LLM_MODEL=gemini-2.0-flash-lite
   ```

---

### 5. Frontend Issues

#### 5.1 API Connection Errors

**Symptom:** "Network Error" in browser console

```bash
# Check backend is running
curl http://localhost:8000/health

# Verify CORS configuration
# In backend/main.py, ensure frontend origin is allowed

# Check API_URL in frontend
# frontend/src/config.ts or .env
VITE_API_URL=http://localhost:8000
```

#### 5.2 Build Failures

**Symptom:** `npm run build` fails

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node version (18+ required)
node --version

# Use correct Node version
nvm use 18

# Type errors
npm run type-check
```

---

### 6. Authentication Issues

#### 6.1 Login Failures

**Symptom:** "Invalid credentials" with correct password

```bash
# Check if user exists in database
psql -d claims_db -c "SELECT email, is_active FROM users WHERE email='user@example.com';"

# Verify password hash
# Passwords should be hashed with bcrypt

# Reset password (development only)
psql -d claims_db -c "UPDATE users SET password_hash='\$2b\$12\$...' WHERE email='user@example.com';"
```

#### 6.2 Token Expiry Issues

**Symptom:** "Token expired" errors

```bash
# Increase token lifetime in .env
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# Clear browser cache and cookies
# Re-login to get fresh tokens
```

---

### 7. Multi-Tenant Issues

#### 7.1 Data Leakage Between Tenants

**Symptom:** Seeing data from other tenants

**Solutions:**

1. **Verify middleware is active**
   ```python
   # Check TenantMiddleware in main.py startup
   app.add_middleware(TenantMiddleware)
   ```

2. **Check query filtering**
   ```python
   # All queries must filter by tenant_id
   claims = db.query(Claim).filter(
       Claim.tenant_id == current_tenant_id
   ).all()
   ```

3. **Review indexes**
   ```sql
   -- Ensure tenant_id is first in composite indexes
   CREATE INDEX idx_claims_tenant_status 
       ON claims(tenant_id, status);
   ```

#### 7.2 "Organization Access Suspended" Error

**Symptom:** Users get "Your organization's access has been suspended" error during login

**Cause:** The tenant has been deactivated (is_active = false)

**Solutions:**

1. **Check tenant status**
   ```sql
   -- Check if tenant is active
   SELECT id, name, code, is_active 
   FROM tenants 
   WHERE id = 'tenant-uuid-here';
   ```

2. **Reactivate tenant (if authorized)**
   ```sql
   -- Reactivate tenant
   UPDATE tenants 
   SET is_active = true, 
       updated_at = NOW()
   WHERE id = 'tenant-uuid-here';
   ```

3. **Check deactivation reason (in settings)**
   ```sql
   SELECT settings->>'deactivation_reason' as reason,
          settings->>'deactivated_at' as deactivated_at
   FROM tenants 
   WHERE id = 'tenant-uuid-here';
   ```

> **Note:** Only System Admin can reactivate a tenant. Contact the platform administrator if tenant reactivation is needed.

---

### 8. Performance Issues

#### 8.1 Slow API Responses

**Diagnosis:**

```bash
# Check database query times
# Enable query logging in PostgreSQL
log_min_duration_statement = 100  # Log queries > 100ms

# Check for missing indexes
EXPLAIN ANALYZE SELECT * FROM claims WHERE status = 'PENDING';
```

**Solutions:**

1. **Add missing indexes**
   ```sql
   CREATE INDEX idx_claims_status ON claims(tenant_id, status);
   ```

2. **Enable query result caching**
   ```env
   ENABLE_QUERY_CACHE=true
   QUERY_CACHE_TTL=300
   ```

3. **Optimize N+1 queries**
   ```python
   # Use eager loading
   claims = db.query(Claim).options(
       joinedload(Claim.documents),
       joinedload(Claim.approvals)
   ).all()
   ```

#### 8.2 High Memory Usage

```bash
# Check process memory
ps aux --sort=-%mem | head -10

# Solutions:
# 1. Limit Celery worker concurrency
celery -A celery_app worker -c 2

# 2. Add memory limits in Docker
deploy:
  resources:
    limits:
      memory: 512M
```

---

### 9. Docker Issues

#### 9.1 Container Won't Start

```bash
# Check container logs
docker logs easyqlaim-backend

# Common fixes:
# 1. Rebuild without cache
docker-compose build --no-cache

# 2. Remove orphan containers
docker-compose down --remove-orphans

# 3. Reset volumes (WARNING: destroys data)
docker-compose down -v
docker-compose up -d
```

#### 9.2 Network Issues Between Containers

```bash
# Check network
docker network ls
docker network inspect easyqlaim_default

# Verify container can reach database
docker exec easyqlaim-backend ping postgres

# Use service names, not localhost
# DATABASE_URL=postgresql://user:pass@postgres:5432/db
```

---

### 10. Logging and Debugging

#### 10.1 Enable Debug Logging

```env
# Backend
LOG_LEVEL=DEBUG
SQLALCHEMY_ECHO=true

# Celery
celery -A celery_app worker -l DEBUG
```

#### 10.2 Check Log Files

```bash
# Backend logs
tail -f backend/logs/app.log

# Celery logs
tail -f backend/logs/celery.log

# System logs
journalctl -u postgresql -f
journalctl -u redis -f
```

---

### 11. Quick Diagnostic Script

```bash
#!/bin/bash
# Save as diagnose.sh and run: bash diagnose.sh

echo "=== Easy Qlaim Diagnostic ==="

echo -e "\n1. Checking services..."
systemctl is-active postgresql && echo "PostgreSQL: OK" || echo "PostgreSQL: FAILED"
systemctl is-active redis && echo "Redis: OK" || echo "Redis: FAILED"

echo -e "\n2. Checking ports..."
nc -zv localhost 8000 2>&1 | grep -q succeeded && echo "API (8000): OK" || echo "API (8000): FAILED"
nc -zv localhost 5432 2>&1 | grep -q succeeded && echo "PostgreSQL (5432): OK" || echo "PostgreSQL (5432): FAILED"
nc -zv localhost 6379 2>&1 | grep -q succeeded && echo "Redis (6379): OK" || echo "Redis (6379): FAILED"

echo -e "\n3. Checking API health..."
curl -s http://localhost:8000/health | jq . || echo "API health check failed"

echo -e "\n4. Checking Celery workers..."
celery -A celery_app inspect ping 2>/dev/null | head -5 || echo "No Celery workers responding"

echo -e "\n5. Checking disk space..."
df -h / | tail -1

echo -e "\n6. Checking memory..."
free -h | grep Mem

echo -e "\n=== Diagnostic complete ==="
```

---

### 12. Getting Help

If issues persist:

1. **Check logs** for specific error messages
2. **Review documentation** in `/documentation` folder
3. **Search error messages** online
4. **Contact support** with:
   - Error messages
   - Steps to reproduce
   - Environment details (OS, versions)
   - Relevant log excerpts

---

*Document Version: 1.0 | Last Updated: December 2025*
