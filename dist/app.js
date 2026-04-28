"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const node_crypto_1 = __importDefault(require("node:crypto"));
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const ioredis_1 = __importDefault(require("ioredis"));
const panchang_js_1 = require("./routes/panchang.js");
const admin_js_1 = require("./routes/admin.js");
const apiKey_js_1 = require("./middleware/apiKey.js");
const adminAuth_js_1 = require("./middleware/adminAuth.js");
const apiKeys_js_1 = require("./lib/apiKeys.js");
const apiKeys_js_2 = require("./lib/apiKeys.js");
const REDIS_URL = process.env.REDIS_URL;
async function buildApp() {
    const app = (0, fastify_1.default)({
        logger: true,
        requestIdHeader: 'x-request-id',
        requestIdLogLabel: 'reqId',
    });
    app.addHook('onRequest', async (request, reply) => {
        const reqId = request.headers['x-request-id'] || node_crypto_1.default.randomUUID();
        request.requestId = reqId;
        reply.header('x-request-id', reqId);
    });
    app.setErrorHandler((error, request, reply) => {
        request.log.error({ err: error, reqId: request.requestId }, error.message);
        const statusCode = error.statusCode ?? 500;
        reply.status(statusCode).send({
            code: error.code ?? 'INTERNAL_ERROR',
            message: statusCode >= 500 ? 'An error occurred' : error.message,
        });
    });
    await app.register(cors_1.default, { origin: true });
    await app.register(rate_limit_1.default, {
        max: (request) => {
            const key = request.headers['x-api-key'];
            return (0, apiKeys_js_1.hasAnyKeys)() ? (0, apiKeys_js_2.getRateLimitMax)(key) : 100;
        },
        timeWindow: '1 minute',
        keyGenerator: (request) => {
            const key = request.headers['x-api-key'] || request.ip;
            return key;
        },
    });
    let redis = null;
    if (REDIS_URL) {
        try {
            redis = new ioredis_1.default(REDIS_URL);
            redis.on('connect', () => app.log.info('Redis connected'));
            redis.on('error', (err) => app.log.warn({ err }, 'Redis error'));
        }
        catch (err) {
            app.log.warn({ err }, 'Redis not available, running without cache');
        }
    }
    await app.register(panchang_js_1.panchangRoutes, {
        redis,
        apiKeyMiddleware: (0, apiKeys_js_1.hasAnyKeys)() ? apiKey_js_1.apiKeyMiddleware : undefined,
    });
    await app.register(admin_js_1.adminRoutes, {
        adminAuthMiddleware: adminAuth_js_1.adminAuthMiddleware,
    });
    app.get('/api/v1/meta/geocode', async (request, reply) => {
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
            const items = results.map((r) => ({
                lat: parseFloat(r.lat),
                lon: parseFloat(r.lon),
                displayName: r.display_name,
            }));
            return reply.send({ results: items });
        }
        catch (err) {
            request.log.warn({ err }, 'Geocode failed');
            return reply.status(502).send({ code: 'GEOCODE_FAILED', message: 'Could not look up location' });
        }
    });
    app.get('/api/v1/meta/timezone', async (request, reply) => {
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
        }
        catch (err) {
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
        let redisStatus = 'disabled';
        if (redis) {
            try {
                const pong = await redis.ping();
                redisStatus = pong === 'PONG' ? 'connected' : 'error';
            }
            catch {
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
