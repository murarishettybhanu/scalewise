# ScaleWise AI — GCP Setup Summary

This document provides a clinical, verified summary of the Google Cloud Platform configuration for the ScaleWise AI project as of Phase 1.

## 1. Project Identity
- **Project Name**: `My First Project`
- **Project ID**: `project-ed393033-4d39-4f83-820`
- **Project Number**: `324342494314`
- **Region/Zone**: `us-central1` / `us-central1-a`

## 2. Verified APIs & Services
The following services are active and verified:
- ✅ **Artifact Registry API** (`artifactregistry.googleapis.com`)
- ✅ **Compute Engine API** (`compute.googleapis.com`)
- ✅ **IAM Service Account Credentials API** (`iamcredentials.googleapis.com`)

## 3. Workload Identity Federation (WIF)
The secure, keyless authentication pipeline for GitHub Actions is fully active.
- **WIF Pool**: `projects/324342494314/locations/global/workloadIdentityPools/scalewise-pool`
- **WIF Provider**: `projects/324342494314/locations/global/workloadIdentityPools/scalewise-pool/providers/scalewise-provider`
- **State**: `ACTIVE`

## 4. Deployment Service Account
- **Display Name**: `GitHub Deployer`
- **Email**: `github-deployer@project-ed393033-4d39-4f83-820.iam.gserviceaccount.com`
- **Status**: Enabled
- **Verified Roles**:
    - `roles/artifactregistry.writer`
    - `roles/compute.admin`
    - `roles/iam.serviceAccountUser`

## 5. Artifact Registry
- **Repository**: `scalewise-repo`
- **Full Path**: `projects/project-ed393033-4d39-4f83-820/locations/us-central1/repositories/scalewise-repo`
- **Format**: `DOCKER` (Standard Repository)
- **Current Size**: `61.458 MB`

## 6. Infrastructure (GCE)
- **VM Name**: `scalewise-bot-vm`
- **Machine Type**: `e2-micro` (Verified)
- **External IP**: `136.115.37.126`
- **Status**: `RUNNING`

---

## 7. Instance Metadata (Runtime Secrets)
The following secrets are stored in the GCE Instance Metadata for the bot to fetch at startup. These should **not** be stored in GitHub Secrets for production.

| Metadata Key | Description |
|---|---|
| `BOT_TOKEN` | Telegram Bot API Token |
| `MONGODB_URI` | MongoDB Atlas Connection String |
| `GEMINI_API_KEY` | Google AI Studio Key (Gemini) |

## 8. GitHub Actions Secrets Checklist
Ensure these variables are set in your GitHub Repository Secrets (`Settings > Secrets > Actions`):

| Secret Name | Exact Value to Use |
|---|---|
| `WIF_PROVIDER` | `projects/324342494314/locations/global/workloadIdentityPools/scalewise-pool/providers/scalewise-provider` |
| `GCE_INSTANCE_NAME` | `scalewise-bot-vm` |
| `GCE_INSTANCE_ZONE` | `us-central1-a` |
| `PROJECT_ID` | `project-ed393033-4d39-4f83-820` |

## 9. Access & Operations

### GCP Configuration
Before running commands, ensure you are authenticated and using the correct project:
```bash
# Set your active GCP account
gcloud config set account bhanu.teja@gmail.com 

# Set the active project for ScaleWise
gcloud config set project project-ed393033-4d39-4f83-820
```

### Common Commands
| Operation | Command |
|---|---|
| **SSH to VM** | `gcloud compute ssh bhanuteja@scalewise-bot-vm --zone=us-central1-a` |
| **View Bot Logs** | `gcloud compute ssh bhanuteja@scalewise-bot-vm --command="sudo docker logs -f bot-container" --quiet` |
| **Restart Bot** | `gcloud compute ssh bhanuteja@scalewise-bot-vm --command="sudo bash ~/startup.sh" --quiet` |
| **Update Metadata** | `gcloud compute instances add-metadata scalewise-bot-vm --metadata KEY="VALUE"` |

---
**Document Status**: Verified and Updated on 2026-04-20.
