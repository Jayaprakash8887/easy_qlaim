#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Stopping Reimbursement System...${NC}"
echo ""

docker-compose down

echo ""
echo -e "${GREEN}✅ All services stopped${NC}"
echo ""
echo -e "${YELLOW}To remove all data (database, redis), run:${NC}"
echo -e "  docker-compose down -v"
echo ""
