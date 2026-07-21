# Cloud server deployment

## Server layout

- Nginx runs on the host and accepts ports 80 and 443.
- The backend and Redis run in Docker Compose.
- Redis has no public port.
- The backend is bound to `127.0.0.1:3000` and is reachable through Nginx.

## First setup

1. Install Docker, Docker Compose, and Nginx on the server.
2. Clone the repository.
3. Create `apps/backend-api/.env.production` from `.env.example`.
4. Add production Supabase, JWT, storage, admin bootstrap, and banner values.
5. Copy `nginx-newnextmarket.conf` to `/etc/nginx/sites-available/newnextmarket`.
6. Enable it, test Nginx, and reload Nginx.
7. Start the stack:

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

8. Apply schema migrations inside the backend container:

```bash
docker compose -f deploy/docker-compose.yml exec backend npx prisma migrate deploy --schema apps/backend-api/prisma/schema.prisma
```

9. Run the production bootstrap only after the environment variables are filled:

```bash
docker compose -f deploy/docker-compose.yml exec backend npm run prisma:seed:production
```
