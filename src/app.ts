import crypto from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import { panchangRoutes } from './routes/panchang.js';
import { adminRoutes } from './routes/admin.js';
import { apiKeyMiddleware } from './middleware/apiKey.js';
import { adminAuthMiddleware } from './middleware/adminAuth.js';
import { hasAnyKeys } from './lib/apiKeys.js';
import { getRateLimitMax } from './lib/apiKeys.js';

const REDIS_URL = process.env.REDIS_URL;

export async function buildApp() {
  const app = Fastify({
    logger: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  app.addHook('onRequest', async (request, reply) => {
    const reqId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    (request as any).requestId = reqId;
    reply.header('x-request-id', reqId);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, reqId: (request as any).requestId }, (error as Error).message);
    const statusCode = (error as any).statusCode ?? 500;
    reply.status(statusCode).send({
      code: (error as any).code ?? 'INTERNAL_ERROR',
      message: statusCode >= 500 ? 'An error occurred' : (error as Error).message,
    });
  });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: (request) => {
      const key = request.headers['x-api-key'] as string | undefined;
      return hasAnyKeys() ? getRateLimitMax(key) : 100;
    },
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      const key = (request.headers['x-api-key'] as string) || request.ip;
      return key;
    },
  });

  let redis: Redis | null = null;
  if (REDIS_URL) {
    try {
      redis = new Redis(REDIS_URL);
      redis.on('connect', () => app.log.info('Redis connected'));
      redis.on('error', (err) => app.log.warn({ err }, 'Redis error'));
    } catch (err) {
      app.log.warn({ err }, 'Redis not available, running without cache');
    }
  }

  await app.register(panchangRoutes, {
    redis,
    apiKeyMiddleware: hasAnyKeys() ? apiKeyMiddleware : undefined,
  });

  await app.register(adminRoutes, {
    adminAuthMiddleware,
  });

  app.get<{ Querystring: { q: string; lang?: string } }>('/api/v1/meta/geocode', async (request, reply) => {
    const { q, lang: langRaw } = request.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return reply.status(400).send({ code: 'INVALID_QUERY', message: 'q must be at least 2 characters' });
    }
    const lang = langRaw === 'te' ? 'te' : 'en';
    // Nominatim uses Accept-Language for display_name; without it, names follow the region default (Arabic, Japanese, etc.).
    const acceptLanguage = lang === 'te' ? 'te,en;q=0.9' : 'en';
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', q.trim());
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '5');
      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'One-Panchang/1.0',
          'Accept-Language': acceptLanguage,
        },
      });
      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) {
        return reply.send({ results: [] });
      }
      const items = results.map((r: { lat: string; lon: string; display_name: string }) => ({
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        displayName: r.display_name,
      }));
      return reply.send({ results: items });
    } catch (err) {
      request.log.warn({ err }, 'Geocode failed');
      return reply.status(502).send({ code: 'GEOCODE_FAILED', message: 'Could not look up location' });
    }
  });

  app.get<{ Querystring: { lat: string; lon: string } }>('/api/v1/meta/timezone', async (request, reply) => {
    const { lat, lon } = request.query;
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      return reply.status(400).send({ code: 'INVALID_LAT', message: 'lat must be between -90 and 90' });
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      return reply.status(400).send({ code: 'INVALID_LON', message: 'lon must be between -180 and 180' });
    }
    try {
      const { find } = await import('geo-tz');
      const zones = find(latNum, lonNum);
      const tz = Array.isArray(zones) ? zones[0] : zones;
      return reply.send({ timezone: tz || 'UTC' });
    } catch (err) {
      request.log.warn({ err }, 'Timezone lookup failed');
      return reply.send({ timezone: 'UTC' });
    }
  });

  app.get('/api/v1/meta/ayanamsa', async (_request, reply) => {
    return reply.send({ options: [{ id: 'lahiri', name: 'Lahiri' }] });
  });

  app.get('/api/v1/meta/languages', async (_request, reply) => {
    return reply.send({ options: [{ id: 'te', name: 'తెలుగు' }, { id: 'en', name: 'English' }] });
  });

  app.get('/api/v1/health', async (_request, reply) => {
    let redisStatus: 'connected' | 'disabled' | 'error' = 'disabled';
    if (redis) {
      try {
        const pong = await redis.ping();
        redisStatus = pong === 'PONG' ? 'connected' : 'error';
      } catch {
        redisStatus = 'error';
      }
    }
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      redis: redisStatus,
    });
  });

  return { app, redis };
}
