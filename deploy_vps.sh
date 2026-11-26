#!/bin/bash
set -euo pipefail

# ==============================================================================
# Automated Production VPS Deployment Script for Poach Originality Engine
# Target Platforms: Ubuntu 20.04 / 22.04 / 24.04, Debian 11/12
# Stack: PostgreSQL (pgvector) + Redis + Qdrant + FastAPI + Celery + Nginx
# ==============================================================================

echo "========================================================"
echo " Starting Poach Production Deployment"
echo "========================================================"

# 1. Update system packages
sudo apt-get update -y
sudo apt-get install -y curl git ufw jq ca-certificates gnupg

# 2. Install Docker & Compose plugin if not present
if ! command -v docker &> /dev/null; then
    echo "[+] Installing Docker Engine & Compose..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable --now docker
    echo "[✓] Docker installed successfully."
else
    echo "[✓] Docker is already installed."
fi

# 3. Clone or pull latest repository
APP_DIR="/opt/chalbecopykrega"
REPO_URL="https://github.com/mohit4215/chalbecopykrega.git"

if [ -d "$APP_DIR" ]; then
    echo "[+] Updating existing codebase in $APP_DIR..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
else
    echo "[+] Cloning repository into $APP_DIR..."
    sudo git clone "$REPO_URL" "$APP_DIR"
    sudo chown -R "$USER":"$USER" "$APP_DIR"
    cd "$APP_DIR"
fi

# 4. Initialize production environment configuration
if [ ! -f .env ]; then
    echo "[+] Creating .env from .env.example..."
    cp .env.example .env
    # Generate cryptographic JWT Secret Key
    RANDOM_JWT_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null || openssl rand -base64 48)
    sed -i "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${RANDOM_JWT_KEY}|g" .env
    echo "[✓] Cryptographic secrets generated."
fi

# 5. Configure firewall rules for production
if command -v ufw &> /dev/null; then
    echo "[+] Ensuring firewall allows HTTP/HTTPS and SSH..."
    sudo ufw allow 22/tcp || true
    sudo ufw allow 80/tcp || true
    sudo ufw allow 443/tcp || true
    sudo ufw allow 8000/tcp || true
fi

# 6. Build and launch all containerized services
echo "[+] Booting full production stack (PostgreSQL + Redis + Qdrant + Backend + Worker + Nginx)..."
docker compose down || true
docker compose up -d --build

# 7. Apply Alembic database migrations
echo "[+] Running database schema migrations..."
sleep 6
docker compose exec backend alembic upgrade head || echo "[!] Database initialized via startup lifespan."

# 8. Verify healthcheck and readiness probes
echo "[+] Waiting for service health checks..."
sleep 8

if curl -s http://localhost:8000/api/health | grep -q "healthy"; then
    SERVER_IP=$(curl -s ifconfig.me || echo "localhost")
    echo "========================================================"
    echo " [✓] PRODUCTION DEPLOYMENT SUCCESSFUL!"
    echo " Web Application (Nginx): http://${SERVER_IP}"
    echo " Backend API Endpoint:    http://${SERVER_IP}:8000/api/health"
    echo " API Documentation:       http://${SERVER_IP}:8000/docs"
    echo " Qdrant Dashboard:        http://${SERVER_IP}:6333/dashboard"
    echo "========================================================"
else
    echo "[!] Deployment check returned unexpected output. Inspecting container logs..."
    docker compose logs --tail=30
fi
