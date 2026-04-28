# One Panchang API

REST API for daily Panchang calculations (Tithi, Nakshatra, Yoga, Karana, Kaalams) using Swiss Ephemeris.

## Base URL

```
http://localhost:3000/api/v1
```

In production, the API is typically hosted on its own host, for example `https://api.onepanchang.com/api/v1`, with the public PWA at `https://www.onepanchang.com`.

## Authentication

When API keys are configured (`PUBLIC_API_KEY`, `API_KEYS`, or managed keys), include:

```
x-api-key: <your-api-key>
```

- **PWA / public key:** Use `PUBLIC_API_KEY` (30 req/min)
- **Third-party:** Use keys from `API_KEYS` or Admin-generated managed keys
- **Admin API:** Uses separate header:
  - `x-admin-token: <ADMIN_TOKEN>`

Without keys configured, panchang endpoints work without authentication (development mode).

### First-party browser access

The backend can be configured so that approved first-party web origins may call panchang endpoints without an
`x-api-key`. Environment variable names, formats, and deployment notes for operators are documented in
[DEPLOYMENT.md](./DEPLOYMENT.md). If the browser must always send a key, configure the frontend build to
include the public key (see the same guide).

## Rate Limiting

- Per-key rate limit:
  - Public key: 30 req/min
  - Static API_KEYS: 60 req/min
  - Managed keys: `rateLimitPerMin` per key
- If no key present (dev/internal origin bypass), default bucket is used
- Range endpoint: max 31 days per request

## Endpoints

### Health Check

```bash
curl http://localhost:3000/api/v1/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-03-08T12:00:00.000Z",
  "version": "1.0.0",
  "redis": "connected"
}
```

### Today's Panchang

```bash
curl "http://localhost:3000/api/v1/panchang/today?lat=17.385&lon=78.4867&tz=Asia/Kolkata&lang=te" \
  -H "x-api-key: YOUR_KEY"
```

| Param | Required | Description |
|-------|----------|-------------|
| lat | yes | Latitude (-90 to 90) |
| lon | yes | Longitude (-180 to 180) |
| tz | yes | IANA timezone (e.g. Asia/Kolkata) |
| ayanamsa | no | Default: lahiri |
| lang | no | te \| en, default: te |

### Panchang for Date

```bash
curl "http://localhost:3000/api/v1/panchang/date?date=2025-03-08&lat=17.385&lon=78.4867&tz=Asia/Kolkata&lang=te" \
  -H "x-api-key: YOUR_KEY"
```

| Param | Required | Description |
|-------|----------|-------------|
| date | yes | YYYY-MM-DD |
| lat | yes | Latitude |
| lon | yes | Longitude |
| tz | yes | IANA timezone |
| ayanamsa | no | Default: lahiri |
| lang | no | te \| en |

### Panchang Range (max 31 days)

```bash
curl "http://localhost:3000/api/v1/panchang/range?start=2025-03-01&end=2025-03-15&lat=17.385&lon=78.4867&tz=Asia/Kolkata&lang=te" \
  -H "x-api-key: YOUR_KEY"
```

### Meta: Ayanamsa Options

```bash
curl http://localhost:3000/api/v1/meta/ayanamsa
```

### Meta: Languages

```bash
curl http://localhost:3000/api/v1/meta/languages
```

### Admin: List API Keys

```bash
curl http://localhost:3000/api/v1/admin/keys \
  -H "x-admin-token: YOUR_ADMIN_TOKEN"
```

### Admin: Create API Key

```bash
curl -X POST http://localhost:3000/api/v1/admin/keys \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"name":"my-other-app","rateLimitPerMin":120}'
```

### Admin: Update API Key (enable/disable/rate/name)

```bash
curl -X PATCH http://localhost:3000/api/v1/admin/keys/<id> \
  -H "Content-Type: application/json" \
  -H "x-admin-token: YOUR_ADMIN_TOKEN" \
  -d '{"isActive":false,"rateLimitPerMin":60}'
```

### Admin: Delete API Key

```bash
curl -X DELETE http://localhost:3000/api/v1/admin/keys/<id> \
  -H "x-admin-token: YOUR_ADMIN_TOKEN"
```

## Response Format

```json
{
  "request": {
    "date": "2025-03-08",
    "lat": 17.385,
    "lon": 78.4867,
    "tz": "Asia/Kolkata",
    "ayanamsa": "lahiri",
    "lang": "te"
  },
  "meta": { "version": "1.0.0" },
  "day": {
    "date": "2025-03-08",
    "sunrise": "2025-03-08T01:23:45.000Z",
    "sunset": "2025-03-08T12:54:19.000Z",
    "vara": "శనివారం"
  },
  "panchang": [
    { "type": "tithi", "index": 8, "name": "నవమీ", "endTime": "2025-03-08T02:15:00.000Z" },
    { "type": "nakshatra", "index": 14, "name": "స్వాతి", "endTime": "..." },
    { "type": "yoga", "index": 11, "name": "ధృవ", "endTime": "..." },
    { "type": "karana", "index": 2, "name": "కౌలవ", "endTime": "..." },
    { "type": "karana", "index": 3, "name": "తైతిల", "endTime": "..." }
  ],
  "kaalams": [
    {
      "name": "rahu",
      "start": "2025-03-08T...",
      "end": "2025-03-08T..."
    },
    ...
  ],
  "amrutaGhadiyalu": [{ "start": "2025-03-08T...", "end": "2025-03-08T..." }],
  "varjam": { "start": "2025-03-08T...", "end": "2025-03-08T..." },
  "durmuhurtham": [{ "start": "2025-03-08T...", "end": "2025-03-08T..." }],
  "festivals": [
    {
      "id": "ugadi",
      "name": "ఉగాది",
      "category": "important",
      "tithiStart": "2026-03-19T18:32:00.000Z",
      "tithiEnd": "2026-03-20T20:10:00.000Z",
      "tithiStartedPriorCivilDay": true
    },
    {
      "id": "pradosha",
      "name": "ప్రదోష వ్రతం",
      "category": "auspicious",
      "tithiStart": "2026-03-20T08:15:00.000Z",
      "tithiEnd": "2026-03-21T07:40:00.000Z",
      "tithiStartsLaterSameCivilDay": true
    }
  ]
}
```

## Error Format

```json
{
  "code": "INVALID_LAT",
  "message": "lat must be between -90 and 90"
}
```

| Code | HTTP | Description |
|------|------|-------------|
| INVALID_API_KEY | 401 | Missing or invalid x-api-key |
| INVALID_ADMIN_TOKEN | 401 | Missing/invalid x-admin-token |
| ADMIN_NOT_CONFIGURED | 503 | ADMIN_TOKEN not configured |
| MISSING_DATE | 400 | date param required |
| MISSING_RANGE | 400 | start and end required |
| INVALID_DATE | 400 | date must be YYYY-MM-DD |
| INVALID_LAT | 400 | lat -90 to 90 |
| INVALID_LON | 400 | lon -180 to 180 |
| INVALID_TZ | 400 | Invalid IANA timezone |
| RANGE_TOO_LARGE | 400 | Max 31 days |
| CALC_ERROR | 500 | Calculation failed |

## Licensing

This API uses Swiss Ephemeris under AGPL. API consumers do not inherit AGPL obligations solely by calling this API. If you embed Swiss Ephemeris in your own software, you must comply with its licensing. See the backend source repository (NOTICE, LICENSE) for full attribution.
