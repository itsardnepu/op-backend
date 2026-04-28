"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyMiddleware = apiKeyMiddleware;
const apiKeys_js_1 = require("../lib/apiKeys.js");
/**
 * Parse comma-separated allowlist entries into normalized origins.
 * Accepts full URLs or bare hostnames (e.g. www.onepanchang.com → https://www.onepanchang.com).
 */
function parseOriginAllowlist(raw) {
    if (!raw?.trim())
        return [];
    const out = [];
    for (const part of raw.split(',')) {
        const s = part.trim();
        if (!s)
            continue;
        try {
            const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
            out.push(new URL(withScheme).origin);
        }
        catch {
            /* skip invalid */
        }
    }
    return out;
}
const DEFAULT_DEV_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173';
/** Origins that may call the API without x-api-key (first-party browser apps). Set on the BACKEND deployment. */
const INTERNAL_APP_ORIGINS = [
    ...new Set([
        ...parseOriginAllowlist(process.env.INTERNAL_APP_ORIGINS !== undefined ? process.env.INTERNAL_APP_ORIGINS : DEFAULT_DEV_ORIGINS),
        ...parseOriginAllowlist(process.env.FRONTEND_PUBLIC_ORIGIN),
        ...parseOriginAllowlist(process.env.BROWSER_ORIGIN_ALLOWLIST),
    ]),
];
const ALLOWED_ORIGIN_SET = new Set(INTERNAL_APP_ORIGINS);
function isAllowedInternalOrigin(value) {
    if (!value)
        return false;
    try {
        const normalized = new URL(value).origin;
        return ALLOWED_ORIGIN_SET.has(normalized);
    }
    catch {
        return false;
    }
}
async function apiKeyMiddleware(request, reply) {
    if (!(0, apiKeys_js_1.hasAnyKeys)()) {
        return;
    }
    // First-party web app calls can be allowed by Origin or Referer (must match allowlist).
    // Note: FRONTEND_PUBLIC_ORIGIN / BROWSER_ORIGIN_ALLOWLIST / INTERNAL_APP_ORIGINS must be set on this BACKEND
    // deployment (Vercel env for the API project), not only on the static frontend project.
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    if (isAllowedInternalOrigin(origin) || isAllowedInternalOrigin(referer)) {
        return;
    }
    const key = request.headers['x-api-key'];
    if (!(0, apiKeys_js_1.isValidKey)(key)) {
        return reply.status(401).send({
            code: 'INVALID_API_KEY',
            message: 'Valid x-api-key header required. Get an API key to use this service.',
        });
    }
    request.apiKey = key;
    (0, apiKeys_js_1.touchLastUsed)(key);
}
