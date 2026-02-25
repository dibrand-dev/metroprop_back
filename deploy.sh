#!/bin/bash
set -e
cd ~/metroprop_back
git pull origin main
docker build -t metroprop-backend:latest .
docker stop metroprop-app 2>/dev/null || true
docker rm metroprop-app 2>/dev/null || true
docker run -d --name metroprop-app --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -p 80:3000 \
  --env-file .env \
  metroprop-backend:latest
echo "Deployed!"