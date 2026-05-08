# Production Deployment Guide

## Easy Qlaim - Cloud Deployment & Scaling

### 1. Overview

This guide covers deploying Easy Qlaim to production environments with high availability, security, and scalability in mind.

---

## 2. Architecture Options

### 2.1 Deployment Models

| Model | Best For | Complexity | Cost |
|-------|----------|------------|------|
| Single Server | POC/Small teams | Low | $ |
| Docker Compose | Small-Medium orgs | Medium | $$ |
| Kubernetes | Enterprise/Scale | High | $$$ |
| Managed Services | Focus on business | Medium | $$$$ |

### 2.2 Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRODUCTION ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         LOAD BALANCER                                │    │
│  │                    (Cloud LB / Nginx / Traefik)                     │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                            │
│            ┌────────────────────┴────────────────────┐                      │
│            │                                         │                      │
│            ▼                                         ▼                      │
│  ┌─────────────────────────┐           ┌─────────────────────────┐         │
│  │   FRONTEND CLUSTER      │           │    API CLUSTER          │         │
│  │   (CDN + Static)        │           │    (Auto-scaling)       │         │
│  │                         │           │                         │         │
│  │  ┌─────┐ ┌─────┐       │           │  ┌─────┐ ┌─────┐       │         │
│  │  │ FE1 │ │ FE2 │       │           │  │API1 │ │API2 │ ...   │         │
│  │  └─────┘ └─────┘       │           │  └─────┘ └─────┘       │         │
│  └─────────────────────────┘           └──────────┬──────────────┘         │
│                                                    │                        │
│                                                    │                        │
│  ┌─────────────────────────┐           ┌──────────┴──────────────┐         │
│  │   CELERY WORKERS        │           │    DATA LAYER            │         │
│  │   (Auto-scaling)        │           │                         │         │
│  │                         │           │  ┌─────────────────────┐│         │
│  │  ┌─────┐ ┌─────┐       │           │  │  PostgreSQL (HA)    ││         │
│  │  │ W1  │ │ W2  │ ...   │◀─────────▶│  │  Primary + Replica  ││         │
│  │  └─────┘ └─────┘       │           │  └─────────────────────┘│         │
│  └─────────────────────────┘           │                         │         │
│                                        │  ┌─────────────────────┐│         │
│                                        │  │  Redis Cluster      ││         │
│                                        │  │  + Sentinel         ││         │
│                                        │  └─────────────────────┘│         │
│                                        │                         │         │
│                                        │  ┌─────────────────────┐│         │
│                                        │  │  Cloud Storage      ││         │
│                                        │  │  (GCS/S3/Azure)     ││         │
│                                        │  └─────────────────────┘│         │
│                                        └─────────────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cloud Platform Deployment

### 3.1 Google Cloud Platform (GCP)

**Services Used:**
| Service | Purpose |
|---------|---------|
| Cloud Run | API & Worker containers |
| Cloud SQL | PostgreSQL database |
| Memorystore | Redis cache |
| Cloud Storage | Document storage |
| Cloud CDN | Frontend hosting |
| Secret Manager | Secrets management |

**Deployment Steps:**

```bash
# 1. Set up GCP project
gcloud projects create easy-qlaim-prod
gcloud config set project easy-qlaim-prod

# 2. Enable APIs
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com

# 3. Create Cloud SQL instance
gcloud sql instances create easy-qlaim-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-4096 \
  --region=us-central1 \
  --availability-type=REGIONAL

# 4. Create Redis instance
gcloud redis instances create easy-qlaim-cache \
  --size=2 \
  --region=us-central1

# 5. Create Cloud Storage bucket
gsutil mb -l us-central1 gs://easy-qlaim-documents

# 6. Build and deploy backend
gcloud builds submit --tag gcr.io/easy-qlaim-prod/backend
gcloud run deploy easy-qlaim-api \
  --image gcr.io/easy-qlaim-prod/backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=..." \
  --min-instances=1 \
  --max-instances=10

# 7. Deploy frontend to Cloud CDN
gcloud storage cp -r frontend/dist/* gs://easy-qlaim-frontend/
```

### 3.2 Amazon Web Services (AWS)

**Services Used:**
| Service | Purpose |
|---------|---------|
| ECS/EKS | Container orchestration |
| RDS | PostgreSQL database |
| ElastiCache | Redis cache |
| S3 | Document storage |
| CloudFront | CDN |
| Secrets Manager | Secrets |

**Deployment with ECS:**

```bash
# 1. Create ECR repositories
aws ecr create-repository --repository-name easy-qlaim-backend
aws ecr create-repository --repository-name easy-qlaim-frontend

# 2. Build and push images
docker build -t easy-qlaim-backend ./backend
docker tag easy-qlaim-backend:latest $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/easy-qlaim-backend:latest
docker push $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/easy-qlaim-backend:latest

# 3. Create ECS cluster
aws ecs create-cluster --cluster-name easy-qlaim-cluster

# 4. Create task definition (see task-definition.json)
aws ecs register-task-definition --cli-input-json file://task-definition.json

# 5. Create service
aws ecs create-service \
  --cluster easy-qlaim-cluster \
  --service-name easy-qlaim-api \
  --task-definition easy-qlaim-api:1 \
  --desired-count 2 \
  --launch-type FARGATE
```

### 3.3 Microsoft Azure

**Services Used:**
| Service | Purpose |
|---------|---------|
| Container Apps | API containers |
| Azure Database | PostgreSQL |
| Azure Cache | Redis |
| Blob Storage | Documents |
| Azure CDN | Frontend |
| Key Vault | Secrets |

---

## 4. Kubernetes Deployment

### 4.1 Helm Chart Structure

```
helm/easy-qlaim/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment-api.yaml
│   ├── deployment-worker.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   └── pdb.yaml
```

### 4.2 Kubernetes Manifests

**API Deployment:**
```yaml
# deployment-api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: easy-qlaim-api
  labels:
    app: easy-qlaim
    component: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: easy-qlaim
      component: api
  template:
    metadata:
      labels:
        app: easy-qlaim
        component: api
    spec:
      containers:
      - name: api
        image: easy-qlaim/backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: easy-qlaim-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: easy-qlaim-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Celery Worker Deployment:**
```yaml
# deployment-worker.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: easy-qlaim-worker
  labels:
    app: easy-qlaim
    component: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: easy-qlaim
      component: worker
  template:
    metadata:
      labels:
        app: easy-qlaim
        component: worker
    spec:
      containers:
      - name: worker
        image: easy-qlaim/backend:latest
        command: ["celery", "-A", "celery_app", "worker", "--loglevel=info"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: easy-qlaim-secrets
              key: database-url
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

**Horizontal Pod Autoscaler:**
```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: easy-qlaim-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: easy-qlaim-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 4.3 Deploy with Helm

```bash
# Add custom values
cat > values-prod.yaml << EOF
replicaCount:
  api: 3
  worker: 2

image:
  repository: your-registry/easy-qlaim
  tag: v1.0.0

postgresql:
  host: your-db-host
  database: easy_qlaim

redis:
  host: your-redis-host

ingress:
  enabled: true
  hosts:
    - host: easyqlaim.example.com
      paths:
        - path: /api
          pathType: Prefix

resources:
  api:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "1Gi"
      cpu: "500m"
EOF

# Deploy
helm upgrade --install easy-qlaim ./helm/easy-qlaim \
  -f values-prod.yaml \
  --namespace easy-qlaim \
  --create-namespace
```

---

## 5. Environment Configuration

### 5.1 Production Environment Variables

```bash
# Application
APP_NAME=Easy Qlaim
APP_ENV=production
DEBUG=False
SECRET_KEY=${GENERATED_SECRET_KEY}

# Database (use connection pooling)
DATABASE_URL=postgresql+asyncpg://user:pass@db-host:5432/easy_qlaim?ssl=require
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10

# Redis (with TLS in production)
REDIS_URL=rediss://user:pass@redis-host:6380/0?ssl_cert_reqs=required
REDIS_CACHE_URL=rediss://user:pass@redis-host:6380/1?ssl_cert_reqs=required

# Celery
CELERY_BROKER_URL=${REDIS_URL}
CELERY_RESULT_BACKEND=${REDIS_URL}

# LLM
LLM_PROVIDER=gemini
GOOGLE_API_KEY=${GOOGLE_API_KEY}

# Storage
STORAGE_PROVIDER=gcs
GCP_PROJECT_ID=your-project
GCP_BUCKET_NAME=easy-qlaim-documents
GCP_CREDENTIALS_PATH=/secrets/gcp-credentials.json

# Security
JWT_SECRET_KEY=${JWT_SECRET_KEY}
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Keycloak (if using)
KEYCLOAK_ENABLED=True
KEYCLOAK_SERVER_URL=https://keycloak.example.com
KEYCLOAK_REALM=easy-qlaim
KEYCLOAK_CLIENT_ID=easy-qlaim-app
KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET}

# Logging
LOG_LEVEL=INFO
```

### 5.2 Secrets Management

**Using Kubernetes Secrets:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: easy-qlaim-secrets
type: Opaque
stringData:
  database-url: postgresql+asyncpg://user:pass@host:5432/db
  redis-url: rediss://user:pass@host:6380/0
  jwt-secret: your-jwt-secret
  google-api-key: your-google-api-key
```

**Using External Secrets (GCP Secret Manager):**
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: easy-qlaim-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: gcp-secret-store
  target:
    name: easy-qlaim-secrets
  data:
  - secretKey: database-url
    remoteRef:
      key: easy-qlaim-database-url
  - secretKey: jwt-secret
    remoteRef:
      key: easy-qlaim-jwt-secret
```

---

## 6. Database Configuration

### 6.1 PostgreSQL Production Settings

```sql
-- postgresql.conf adjustments for production
max_connections = 200
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
max_parallel_maintenance_workers = 2
```

### 6.2 Connection Pooling with PgBouncer

PgBouncer is included in the Docker Compose setup for connection pooling. All backend services connect through PgBouncer (port 6432) instead of directly to PostgreSQL.

**Docker Compose Integration:**
```yaml
# PgBouncer service in docker-compose.yml
pgbouncer:
  image: edoburu/pgbouncer:1.21.0
  ports:
    - "6432:6432"
  volumes:
    - ./pgbouncer/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro
    - ./pgbouncer/userlist.txt:/etc/pgbouncer/userlist.txt:ro
  depends_on:
    postgres:
      condition: service_healthy
```

**PgBouncer Configuration (`pgbouncer/pgbouncer.ini`):**
```ini
[databases]
reimbursement_db = host=postgres port=5432 dbname=reimbursement_db

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool modes:
; - session: dedicated connection (safest, lowest performance)
; - transaction: connection returned after each transaction (recommended)
; - statement: connection returned after each statement (not safe for complex queries)
pool_mode = transaction

; Pool sizing
default_pool_size = 20
min_pool_size = 5
max_client_conn = 100
reserve_pool_size = 5

; Connection settings
server_idle_timeout = 600
query_wait_timeout = 120
```

**Benefits of Transaction Pooling:**
- Reduced connection overhead
- Better resource utilization
- Handles connection spikes gracefully
- Compatible with most web application patterns

### 6.3 High Availability

**PostgreSQL Replication:**
- Primary + Replica configuration
- Automatic failover with Patroni
- Read replicas for reporting queries

---

## 7. Redis Configuration

### 7.1 Redis Cluster

```yaml
# redis-cluster.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  redis.conf: |
    maxmemory 2gb
    maxmemory-policy allkeys-lru
    appendonly yes
    cluster-enabled yes
    cluster-config-file nodes.conf
    cluster-node-timeout 5000
```

### 7.2 Redis Sentinel (HA)

```yaml
sentinel monitor mymaster redis-0.redis 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
```

---

## 8. SSL/TLS Configuration

### 8.1 Certificate Management

**Using cert-manager:**
```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: easy-qlaim-tls
spec:
  secretName: easy-qlaim-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - easyqlaim.example.com
  - api.easyqlaim.example.com
```

### 8.2 Ingress with TLS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: easy-qlaim-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - easyqlaim.example.com
    secretName: easy-qlaim-tls-secret
  rules:
  - host: easyqlaim.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: easy-qlaim-api
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: easy-qlaim-frontend
            port:
              number: 80
```

---

## 9. Monitoring & Observability

### 9.1 Prometheus Metrics

```python
# Add to main.py
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

### 9.2 Grafana Dashboards

Import dashboards for:
- FastAPI performance
- PostgreSQL metrics
- Redis metrics
- Celery task monitoring

### 9.3 Logging (ELK/Loki)

```yaml
# Fluentd config for log shipping
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/easy-qlaim*.log
      tag kubernetes.*
      <parse>
        @type json
      </parse>
    </source>
    
    <match kubernetes.**>
      @type elasticsearch
      host elasticsearch
      port 9200
      logstash_format true
    </match>
```

---

## 10. Backup & Disaster Recovery

### 10.1 Database Backups

**Automated Backups (GCP Cloud SQL):**
```bash
gcloud sql backups create \
  --instance=easy-qlaim-db \
  --description="Daily backup"
```

**Manual Backup:**
```bash
pg_dump -h $DB_HOST -U $DB_USER -d easy_qlaim | gzip > backup-$(date +%Y%m%d).sql.gz
gsutil cp backup-*.sql.gz gs://easy-qlaim-backups/
```

### 10.2 Point-in-Time Recovery

Enable WAL archiving for PITR:
```sql
archive_mode = on
archive_command = 'gsutil cp %p gs://easy-qlaim-wal/%f'
```

### 10.3 Document Backup

Cloud storage objects are versioned:
```bash
gsutil versioning set on gs://easy-qlaim-documents
```

---

## 11. Security Hardening

### 11.1 Network Security

- VPC with private subnets
- Security groups/firewall rules
- No public database access
- WAF for API protection

### 11.2 Container Security

```yaml
# Pod security context
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault
```

### 11.3 Image Scanning

```bash
# Scan images before deployment
trivy image easy-qlaim/backend:latest
```

---

## 12. Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Secrets in secret manager
- [ ] Database created and migrated
- [ ] SSL certificates ready
- [ ] DNS configured
- [ ] Backups configured

### Deployment
- [ ] Images built and pushed
- [ ] Kubernetes manifests applied
- [ ] Health checks passing
- [ ] Load balancer configured
- [ ] Ingress working

### Post-Deployment
- [ ] Smoke tests passing
- [ ] Monitoring dashboards working
- [ ] Alerting configured
- [ ] Documentation updated
- [ ] Runbook created

---

*Document Version: 1.0 | Last Updated: December 2025*
