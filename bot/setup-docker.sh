#!/bin/bash

# ScaleWise AI - Docker Setup Script

# Update package lists
sudo apt-get update

# Install Docker
sudo apt-get install -y docker.io

# Start Docker and enable it to run on boot
sudo systemctl start docker
sudo systemctl enable docker

# Create a group for Docker if it doesn't exist
sudo groupadd docker || true

# Add current user to docker group (will take effect on next login)
# For now, we'll use sudo in the deployment phase to be safe
sudo usermod -aG docker $USER

echo "🐳 Docker has been installed and started!"
