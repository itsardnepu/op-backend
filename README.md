# One Panchang — Backend

Node.js API for One Panchang that composes Panchang core data from Auspico Engine and adds One Panchang formatting/festival layers.

**Production:** PWA at [https://www.onepanchang.com](https://www.onepanchang.com); set backend `FRONTEND_PUBLIC_ORIGIN` to `https://www.onepanchang.com,https://onepanchang.com`. API is commonly deployed at `https://api.onepanchang.com` (set the frontend `VITE_API_URL` / `BACKEND_API_ORIGIN` accordingly).

## Setup

```bash
npm install
cp .env.example .env   # optional: set REDIS_URL for caching
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (tsx watch) |
| `npm run start` | Start production server |
| `npm run build` | Compile TypeScript |
| `npm run verify` | Test Swiss Ephemeris |

## API Documentation

See [API.md](./API.md) for full documentation with curl examples.

## Endpoints

- `GET /api/v1/health` — Health check (Redis status if configured)
- `GET /api/v1/panchang/today?lat=&lon=&tz=&lang=te` — Today's Panchang
- `GET /api/v1/panchang/date?date=YYYY-MM-DD&lat=&lon=&tz=&lang=te` — Panchang for date
- `GET /api/v1/panchang/range?start=&end=&lat=&lon=&tz=&lang=te` — Panchang for date range (max 31 days)
- `GET /api/v1/meta/ayanamsa` — Ayanamsa options
- `GET /api/v1/meta/languages` — Language options

## Licensing

Swiss Ephemeris attribution/licensing is maintained in `Auspico/backend` (the upstream service that performs core astronomical calculations).

## Docker

```bash
npm run build
docker build -t onepanchang-backend .
docker run -p 3000:3000 -e REDIS_URL=redis://host.docker.internal:6379 onepanchang-backend
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment guide.
