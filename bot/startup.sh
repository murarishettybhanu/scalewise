#!/bin/bash

# ScaleWise AI - Startup Script

# 1. Pull metadata for environment variables
BOT_TOKEN=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/BOT_TOKEN)
MONGODB_URI=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/MONGODB_URI)

# Load Local Secrets if they exist (to prevent leaks)
# We check the specific home dir because sudo runs as root
ENV_PATH="/home/bhanuteja/scalewise.env"
if [ -f "$ENV_PATH" ]; then
    export $(grep -v '^#' "$ENV_PATH" | xargs)
    echo "🔐 Loaded secrets from $ENV_PATH"
fi

# Fetch from metadata ONLY if not set locally AND if it exists
if [ -z "$GEMINI_API_KEY" ]; then
    echo "🔍 GEMINI_API_KEY not in .env, checking metadata..."
    METADATA_KEY=$(curl -s -f -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/GEMINI_API_KEY)
    if [ $? -eq 0 ]; then
        GEMINI_API_KEY=$METADATA_KEY
        echo "✅ Loaded GEMINI_API_KEY from Metadata"
    else
        echo "❌ GEMINI_API_KEY not found in Metadata"
    fi
fi

# Final check before running
if [ -z "$GEMINI_API_KEY" ]; then
    echo "🚨 ERROR: GEMINI_API_KEY is still missing! Please check $ENV_PATH"
    exit 1
fi

# 2. Configure Docker to use Google Artifact Registry
# Modern way using gcloud instead of the legacy docker-credential-gcr
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet

# 3. Pull the image
IMAGE_NAME="us-central1-docker.pkg.dev/project-ed393033-4d39-4f83-820/scalewise-repo/bot:latest"
docker pull "$IMAGE_NAME"

# 4. Stop and remove existing container if any
docker stop bot-container || true
docker rm bot-container || true

# 5. Run the container
docker run -d \
    --name bot-container \
    --restart always \
    -e BOT_TOKEN="$BOT_TOKEN" \
    -e MONGODB_URI="$MONGODB_URI" \
    -e GEMINI_API_KEY="$GEMINI_API_KEY" \
    -e NODE_ENV="production" \
    "$IMAGE_NAME"

echo "🚀 ScaleWise AI Bot is running!"
