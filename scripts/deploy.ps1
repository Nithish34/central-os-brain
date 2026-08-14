# ==============================================================================
# Company Brain OS - Windows / Local Docker Deployment Script
# ==============================================================================

param (
    [switch]$Rebuild,
    [switch]$Detach = $true,
    [switch]$Down
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Company Brain OS - Production Deployment       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Handle teardown if requested
if ($Down) {
    Write-Host "`nStopping Company Brain OS containers..." -ForegroundColor Yellow
    docker compose down
    Write-Host "Containers stopped." -ForegroundColor Green
    Exit 0
}

# 2. Check Docker availability
Write-Host "`n[1/4] Checking Docker daemon status..." -ForegroundColor Gray
try {
    $dockerVersion = docker --version
    Write-Host "  Found $dockerVersion" -ForegroundColor DarkGray
} catch {
    Write-Error "Docker is not running or not installed. Please start Docker Desktop and retry."
    Exit 1
}

# 3. Build & Launch Containers
$composeArgs = @("up")
if ($Detach) { $composeArgs += "-d" }
if ($Rebuild) { $composeArgs += "--build" } else { $composeArgs += "--build" }

Write-Host "`n[2/4] Building and launching stack (PostgreSQL + pgvector, Neo4j, Redis, FastAPI + Frontend)..." -ForegroundColor Yellow
docker compose @composeArgs

# 4. Wait for Health Check
Write-Host "`n[3/4] Waiting for services to become healthy..." -ForegroundColor Gray
$maxAttempts = 30
$attempt = 0
$url = "http://localhost:8000/api/v1/health"
$healthy = $false

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempt++
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($response.status -eq "ok") {
            $healthy = $true
            break
        }
    } catch {
        Write-Host -NoNewline "." -ForegroundColor DarkGray
    }
}

Write-Host ""

# 5. Report Deployment Status
if ($healthy) {
    Write-Host "`n[4/4] SUCCESS! Company Brain OS is deployed and live:" -ForegroundColor Green
    Write-Host "  --------------------------------------------------" -ForegroundColor Cyan
    Write-Host "  Web Dashboard:     http://localhost:8000" -ForegroundColor White
    Write-Host "  Swagger API Docs:  http://localhost:8000/docs" -ForegroundColor White
    Write-Host "  ReDoc API Docs:    http://localhost:8000/redoc" -ForegroundColor White
    Write-Host "  Neo4j Browser:     http://localhost:7474 (neo4j / companybrain123)" -ForegroundColor White
    Write-Host "  PostgreSQL Port:   5432" -ForegroundColor White
    Write-Host "  Redis Port:        6379" -ForegroundColor White
    Write-Host "  --------------------------------------------------" -ForegroundColor Cyan
} else {
    Write-Host "`n[!] Warning: Health check timed out. Checking container logs:" -ForegroundColor Yellow
    docker compose logs --tail=20 app
}
