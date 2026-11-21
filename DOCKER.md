docker --# Docker setup

This setup runs the Next.js application in a production Node.js container. Supabase, Upstash, Resend, Razorpay, and optional OpenAI services remain external.

## 1. Prerequisites

- Docker Engine or Docker Desktop
- A Supabase project
- Your environment credentials

## 2. Create the Docker environment file

```powershell
Copy-Item .env.docker.example .env.docker
```

Edit `.env.docker` and replace every placeholder. Never commit this file.

For browser-visible variables, Docker Compose passes these values as build arguments:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`

Changing a `NEXT_PUBLIC_*` value requires rebuilding the image.

## 3. Configure Supabase

Apply the repository migrations to your Supabase project:

```powershell
npx supabase db push
```

In the Supabase Auth URL Configuration, set:

- Site URL: `NEXT_PUBLIC_APP_URL`
- Redirect URL: `${NEXT_PUBLIC_APP_URL}/auth/callback`
- Redirect URL: `${NEXT_PUBLIC_APP_URL}/reset-password`

For local Docker use, `NEXT_PUBLIC_APP_URL=http://localhost:3000`.

## 4. Build and run

```powershell
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
```

Open `http://localhost:3000`.

Use a different host port if 3000 is occupied:

```powershell
$env:APP_PORT="8080"
docker compose --env-file .env.docker up -d --build
```

## 5. Verify

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f app
curl.exe http://localhost:3000/api/health
```

The container health check uses `/api/health`.

## 6. Update the application

```powershell
docker compose --env-file .env.docker up -d --build
```

## 7. Stop and remove

```powershell
docker compose --env-file .env.docker down
```

To remove the built image:

```powershell
docker compose --env-file .env.docker down --rmi local
```

## 8. Production

Use a reverse proxy or load balancer for HTTPS. Set `NEXT_PUBLIC_APP_URL` to the public HTTPS origin, then rebuild. Configure Razorpay, payment, OAuth, and Supabase webhook URLs using that origin.

Before production, run:

```powershell
docker compose --env-file .env.docker run --rm app npm run deploy:check
```

Do not enable `LOCAL_DEV_SKIP_AUTH` in production.
