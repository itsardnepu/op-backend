import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../src/app.js';

let readyApp: Awaited<ReturnType<typeof buildApp>>['app'] | null = null;

async function getApp() {
  if (!readyApp) {
    const { app } = await buildApp();
    await app.ready();
    readyApp = app;
  }
  return readyApp;
}

/**
 * Vercel rewrites `/api/(.*)` → `/api/index?__otp=$1`. The Node request URL is then
 * `/api/index?__otp=v1%2F...&...` — Fastify must see `/api/v1/...?...` instead.
 */
function firstQuery(q: VercelRequest['query'], key: string): string | null {
  const v = q?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return null;
}

function restoreClientPath(req: VercelRequest): string {
  const raw = req.url || '/';
  try {
    const u = new URL(raw, 'https://placeholder.local');
    const otp = u.searchParams.get('__otp') ?? firstQuery(req.query, '__otp');
    if (otp != null && (u.pathname === '/api/index' || u.pathname === '/api')) {
      u.searchParams.delete('__otp');
      const qs = u.searchParams.toString();
      const suffix = (() => {
        try {
          return decodeURIComponent(otp).replace(/^\//, '');
        } catch {
          return otp.replace(/^\//, '');
        }
      })();
      return `/api/${suffix}${qs ? `?${qs}` : ''}`;
    }
  } catch {
    /* keep raw */
  }
  return raw;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  const url = restoreClientPath(req);
  (req as { url: string }).url = url;

  await new Promise<void>((resolve, reject) => {
    const done = () => resolve();
    res.once('finish', done);
    res.once('close', done);
    res.once('error', reject);
    app.server.emit('request', req, res);
  });
}
