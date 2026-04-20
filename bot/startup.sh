#!/bin/bash

# ScaleWise AI - Startup Script

# 1. Pull metadata for environment variables
BOT_TOKEN=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/BOT_TOKEN)
MONGODB_URI=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/MONGODB_URI)

# 2. Configure Docker to use Google Artifact Registry
# Modern way using gcloud instead of the legacy docker-credential-gcr
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet

# 3. Pull the image
# Note: [PROJECT_ID] will be replaced during the gcloud command
IMAGE_NAME="us-central1-docker.pkg.dev/project-ed393033-4d39-4f83-820/scalewise-repo/bot:latest"

# 4. Stop and remove existing container if any
docker stop bot-container || true
docker rm bot-container || true

# 5. Run the container
docker run -d \
    --name bot-container \
    --restart always \
    -e BOT_TOKEN="$BOT_TOKEN" \
    -e MONGODB_URI="$MONGODB_URI" \
    -e NODE_ENV="production" \
    "$IMAGE_NAME"

echo "🚀 ScaleWise AI Bot is running!"
