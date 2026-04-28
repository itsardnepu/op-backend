# Deployment Guide

## Backend

### Docker

```bash
cd backend
npm run build
docker build -t onepanchang-backend .
```

Run:
```bash
docker run -p 3000:3000 \
  -e REDIS_URL=redis://your-redis-host:6379 \
  -e PUBLIC_API_KEY=your_key \
  -e API_KEYS=key1,key2 \
  onepanchang-backend
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | no | Default 3000 |
| REDIS_URL | no | Redis for caching (e.g. redis://localhost:6379) |
| PUBLIC_API_KEY | no | Public key for PWA (30 req/min) |
| API_KEYS | no | Comma-separated keys (60 req/min each) |
| FRONTEND_PUBLIC_ORIGIN | no | Comma-separated allowed origins for keyless first-party browser access (full URL or hostname per entry) |
| BROWSER_ORIGIN_ALLOWLIST | no | Same purpose as FRONTEND_PUBLIC_ORIGIN (alias) |
| INTERNAL_APP_ORIGINS | no | When set, replaces the default dev origin list for keyless access |

Set origin allowlist variables on the **backend** deployment (not only the static frontend project). For the
live site use both apex and `www`, for example:
`FRONTEND_PUBLIC_ORIGIN=https://www.onepanchang.com,https://onepanchang.com`
If the browser cannot use keyless access, set the frontend build variable for the public API key so requests send
`x-api-key` (see frontend env table below).

### Recommended: Deploy near India

For lowest latency, use a region such as:
- AWS: ap-south-1 (Mumbai)
- GCP: asia-south1 (Mumbai)
- Azure: Central India

### Health Check

Use `GET /api/v1/health` for load balancer or container health checks.

---

## Frontend (PWA)

### Static Hosting

Build:
```bash
cd frontend
npm run build
```

Deploy the `dist/` folder to:
- **Cloudflare Pages:** Connect repo, build command `npm run build`, output `dist`
- **Vercel:** Same
- **Netlify:** Same

### Environment Variables (build-time)

| Variable | Description |
|----------|-------------|
| VITE_API_URL | Backend API URL (e.g. https://api.onepanchang.com) |
| VITE_API_KEY | Public API key (when backend requires auth) |

### HTTPS

Ensure HTTPS is enabled. PWA and service workers require secure context.

### Cache Headers

For `index.html`: `Cache-Control: no-cache` (for updates)
For assets: `Cache-Control: max-age=31536000, immutable`

---

## Monitoring

- **Request ID:** Every response includes `x-request-id` header for tracing
- **Health endpoint:** Poll `/api/v1/health` for uptime
- **Logs:** Request IDs and IPs are logged (no stack traces in 500 responses)
- **Redis:** Health response includes `redis` status
