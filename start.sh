#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Reimbursement System - Docker Setup${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    
    # Check if we have GOOGLE_API_KEY
    if [ -z "$GOOGLE_API_KEY" ]; then
        echo -e "${RED}❌ GOOGLE_API_KEY environment variable not set!${NC}"
        echo -e "${YELLOW}Please set it first:${NC}"
        echo -e "  export GOOGLE_API_KEY='your-api-key-here'"
        echo ""
        echo -e "${YELLOW}Or create .env file manually with:${NC}"
        echo -e "  GOOGLE_API_KEY=your-api-key-here"
        echo ""
        exit 1
    fi
    
    # Create .env with GOOGLE_API_KEY
    cat > .env << EOF
# Google Gemini API Key (REQUIRED)
GOOGLE_API_KEY=${GOOGLE_API_KEY}

# Security Keys (auto-generated for development)
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)
EOF
    
    echo -e "${GREEN}✅ Created .env file with your API key${NC}"
fi

# Ensure secrets directory exists for Docker volume mount
if [ ! -d "secrets" ]; then
    mkdir -p secrets
    echo -e "${YELLOW}📂 Created secrets/ directory for credential files${NC}"
fi

# Check for docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "${RED}❌ Docker Compose not found! Please install it first.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Building Docker images...${NC}"
$DOCKER_COMPOSE build

echo ""
echo -e "${BLUE}🚀 Starting services...${NC}"
$DOCKER_COMPOSE up -d postgres redis

echo ""
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
sleep 10  # Increased wait time for safety

echo ""
echo -e "${BLUE}🗄️  Initializing database...${NC}"
$DOCKER_COMPOSE run --rm backend python -c "from database import init_db; init_db()"

echo ""
echo -e "${BLUE}� Running database migrations...${NC}"
for migration in backend/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo -e "   Running $(basename $migration)..."
        docker exec -i reimbursement_db psql -U reimbursement_user -d reimbursement_db < "$migration" 2>/dev/null || true
    fi
done

echo ""
echo -e "${BLUE}�📊 Creating test data...${NC}"
$DOCKER_COMPOSE run --rm backend python create_test_data.py

echo ""
echo -e "${BLUE}🚀 Starting all services...${NC}"
$DOCKER_COMPOSE up -d

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   ✅ Application is starting!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${YELLOW}📍 Access points:${NC}"
echo -e "   ${GREEN}Nginx (Main):${NC}  http://localhost (port 80)"
echo -e "   ${GREEN}Frontend:${NC}      http://localhost:5173"
echo -e "   ${GREEN}API Docs:${NC}      http://localhost:8000/api/docs"
echo -e "   ${GREEN}Kong Proxy:${NC}    http://localhost:8080"
echo -e "   ${GREEN}Kong Admin:${NC}    http://localhost:8001"
echo -e "   ${GREEN}Kong Manager:${NC}  http://localhost:8002"
echo -e "   ${GREEN}Keycloak:${NC}      http://localhost:8180"
echo -e "   ${GREEN}Flower:${NC}        http://localhost:5555"
echo -e "   ${GREEN}Health:${NC}        http://localhost:8000/health"
echo ""
echo -e "${YELLOW}📋 Useful commands:${NC}"
echo -e "   ${BLUE}View logs:${NC}        docker-compose logs -f"
echo -e "   ${BLUE}View API logs:${NC}    docker-compose logs -f backend"
echo -e "   ${BLUE}View Kong logs:${NC}   docker-compose logs -f kong"
echo -e "   ${BLUE}View Nginx logs:${NC}  docker-compose logs -f nginx"
echo -e "   ${BLUE}Stop all:${NC}         docker-compose down"
echo -e "   ${BLUE}Restart:${NC}          docker-compose restart"
echo ""
echo -e "${YELLOW}⏳ Services are starting up (may take 30-60 seconds)...${NC}"
echo -e "   Run ${BLUE}docker-compose logs -f${NC} to watch the progress"
echo ""
