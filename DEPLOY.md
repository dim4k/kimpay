# Deployment Guide (Docker Hub & Unraid)

This guide explains how to package your Kimpay application and deploy it to your Unraid server.

## 1. Prerequisites (On your Computer)

You need to have a Docker Hub account. If not, create one at [hub.docker.com](https://hub.docker.com/).

Login to Docker Hub from your terminal:
```bash
docker login
```

## 2. Build and Push the App Image

Since `pocketbase` uses a public image, you only need to build and push the `app` (frontend/backend) image.

Replace `<your-dockerhub-username>` with your actual Docker Hub username.

```bash
# 1. Build the image
docker build -t <your-dockerhub-username>/kimpay-app:latest ./app

# 2. Push to Docker Hub
docker push <your-dockerhub-username>/kimpay-app:latest
```

## 3. Deploy on Unraid

Run the following commands via terminal on your Unraid server:

**1. PocketBase**
```bash
docker run -d \
  --name kimpay-pb \
  -p 8090:8090 \
  -v /mnt/user/appdata/kimpay/pb_data:/pb_data \
  -v /mnt/user/appdata/kimpay/pb_public:/pb_public \
  -v /mnt/user/appdata/kimpay/pb_migrations:/pb_migrations \
  --restart unless-stopped \
  ghcr.io/muchobien/pocketbase:latest
```

**2. App**
```bash
docker run -d \
  --name kimpay-app \
  -p 3000:3000 \
  -e PUBLIC_POCKETBASE_URL=http://<unraid-ip>:8090 \
  -e ORIGIN=http://<unraid-ip>:3000 \
  --restart unless-stopped \
  <your-dockerhub-username>/kimpay-app:latest
```

*> Note: Ensure the App can talk to PocketBase (use Unraid IP instead of `pocketbase` hostname).*

## 4. Automate with GitHub Actions

I have included a GitHub Action workflow in `.github/workflows/deploy.yml` that automatically builds and pushes your image whenever you push to the `main` branch.

**To enable this:**

1.  Go to your GitHub Repository **Settings**.
2.  Navigate to **Secrets and variables** > **Actions**.
3.  Click **"New repository secret"**.
4.  Add the following secrets:
    *   `DOCKER_USERNAME`: Your Docker Hub username.
    *   `DOCKER_PASSWORD`: Your Docker Hub password (or Access Token).

## 5. Database Migrations

PocketBase automatically applies migrations found in the `pb_migrations` directory when it starts.

Since you are using the official PocketBase image, it does not contain your schema by default. You must copy your local migration files to your Unraid server.

1.  Locate the folder you mapped to `/pb_migrations` in your Docker configuration (e.g., `/mnt/user/appdata/kimpay/pb_migrations`).
2.  Copy all files from your local project's `pb_migrations/` folder into that folder on Unraid.
3.  Restart the PocketBase container:
    ```bash
    docker restart kimpay-pb
    ```

