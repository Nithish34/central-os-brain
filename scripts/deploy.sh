#!/usr/bin/env bash
# ==============================================================================
# Company Brain OS - Linux / macOS / VPS Docker Deployment Script
# ==============================================================================

set -e

echo -e "\033[1;36m==================================================\033[0m"
echo -e "\033[1;36m   Company Brain OS - Production Deployment       \033[0m"
echo -e "\033[1;36m==================================================\033[0m"

# Handle stop/down
if [ "$1" == "down" ]; then
    echo -e "\n\033[1;33mStopping Company Brain OS containers...\033[0m"
    docker compose down
    echo -e "\033[1;32mContainers stopped.\033[0m"
    exit 0
fi

# 1. Check Docker
echo -e "\n\033[1;30m[1/4] Checking Docker status...\033[0m"
if ! command -v docker &> /dev/null; then
    echo -e "\033[1;31mError: Docker is not installed. Please install Docker and retry.\033[0m"
    exit 1
fi

# 2. Build and run stack
echo -e "\n\033[1;33m[2/4] Building and launching stack (PostgreSQL + pgvector, Neo4j, Redis, FastAPI + Frontend)...\033[0m"
docker compose up -d --build

# 3. Health Check
echo -e "\n\033[1;30m[3/4] Waiting for services to become healthy...\033[0m"
max_attempts=30
attempt=0
healthy=false

while [ $attempt -lt $max_attempts ]; do
    sleep 2
    attempt=$((attempt+1))
    if curl -s -f http://localhost:8000/api/v1/health > /dev/null 2>&1; then
        healthy=true
        break
    else
        printf "."
    fi
done

echo ""

# 4. Status
if [ "$healthy" = true ]; then
    echo -e "\n\033[1;32m[4/4] SUCCESS! Company Brain OS is deployed and live:\033[0m"
    echo -e "\033[1;36m--------------------------------------------------\033[0m"
    echo -e "  Web Dashboard:     http://localhost:8000"
    echo -e "  Swagger API Docs:  http://localhost:8000/docs"
    echo -e "  ReDoc API Docs:    http://localhost:8000/redoc"
    echo -e "  Neo4j Browser:     http://localhost:7474 (neo4j / companybrain123)"
    echo -e "  PostgreSQL Port:   5432"
    echo -e "  Redis Port:        6379"
    echo -e "\033[1;36m--------------------------------------------------\033[0m"
else
    echo -e "\n\033[1;33m[!] Warning: Health check timed out. Checking container logs:\033[0m"
    docker compose logs --tail=20 app
fi
