#!/bin/bash
set -e

# ==============================================================================
# Automated Production VPS Deployment Script for Turnitin Plagiarism Engine
# Supports Ubuntu 20.04 / 22.04 / 24.04, Debian 11/12
# ==============================================================================

echo "========================================================"
echo " Starting Turnitin Plagiarism System Production Deployment"
echo "========================================================"

# 1. Update system packages
sudo apt-get update -y
sudo apt-get install -y curl git ufw jq ca-certificates gnupg

# 2. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "[+] Installing Docker Engine..."
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
    sudo chown -R $USER:$USER "$APP_DIR"
    cd "$APP_DIR"
fi

# 4. Configure firewall rules for production
if command -v ufw &> /dev/null; then
    echo "[+] Ensuring firewall allows HTTP/HTTPS and SSH..."
    sudo ufw allow 22/tcp || true
    sudo ufw allow 80/tcp || true
    sudo ufw allow 443/tcp || true
    sudo ufw allow 8000/tcp || true
    sudo ufw allow 3000/tcp || true
fi

# 5. Build and launch with Docker Compose
echo "[+] Booting PostgreSQL (pgvector) and FastAPI backend containers..."
docker compose down || true
docker compose up -d --build

# 6. Verify healthcheck
echo "[+] Waiting for service health checks..."
sleep 8

if curl -s http://localhost:8000/api/health | grep -q "healthy"; then
    echo "========================================================"
    echo " [✓] PRODUCTION DEPLOYMENT SUCCESSFUL!"
    echo " Backend API: http://$(curl -s ifconfig.me):8000"
    echo " API Documentation: http://$(curl -s ifconfig.me):8000/docs"
    echo "========================================================"
else
    echo "[!] Containers started. Checking logs..."
    docker compose logs --tail=20
fi
