#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "${RED}❌ Docker Compose not found!${NC}"
    exit 1
fi

echo -e "${YELLOW}🛑 Stopping Reimbursement System...${NC}"
echo ""

$DOCKER_COMPOSE down

echo ""
echo -e "${GREEN}✅ All services stopped${NC}"
echo ""
echo -e "${YELLOW}To remove all data (database, redis), run:${NC}"
echo -e "  $DOCKER_COMPOSE down -v"
echo ""
