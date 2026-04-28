import { FastifyInstance } from 'fastify';
import {
  createManagedKey,
  deleteManagedKey,
  listManagedKeys,
  updateManagedKey,
} from '../lib/apiKeys.js';

interface CreateKeyBody {
  name?: string;
  rateLimitPerMin?: number;
}

interface UpdateKeyBody {
  name?: string;
  rateLimitPerMin?: number;
  isActive?: boolean;
}

export async function adminRoutes(
  app: FastifyInstance,
  opts: { adminAuthMiddleware?: (req: any, reply: any) => Promise<void> }
) {
  const adminAuth = opts?.adminAuthMiddleware;
  const mustAuth = async (request: any, reply: any) => {
    if (adminAuth) await adminAuth(request, reply);
  };

  app.get('/api/v1/admin/keys', async (request, reply) => {
    await mustAuth(request, reply);
    if (reply.sent) return;
    return reply.send({ keys: listManagedKeys() });
  });

  app.post<{ Body: CreateKeyBody }>('/api/v1/admin/keys', async (request, reply) => {
    await mustAuth(request, reply);
    if (reply.sent) return;
    const name = request.body?.name?.trim();
    if (!name) {
      return reply.status(400).send({ code: 'INVALID_NAME', message: 'name is required' });
    }
    const rateLimitPerMin = request.body?.rateLimitPerMin;
    if (rateLimitPerMin != null && (!Number.isFinite(rateLimitPerMin) || rateLimitPerMin < 1)) {
      return reply
        .status(400)
        .send({ code: 'INVALID_RATE_LIMIT', message: 'rateLimitPerMin must be >= 1' });
    }
    const created = createManagedKey({ name, rateLimitPerMin });
    return reply.status(201).send(created);
  });

  app.patch<{ Params: { id: string }; Body: UpdateKeyBody }>(
    '/api/v1/admin/keys/:id',
    async (request, reply) => {
      await mustAuth(request, reply);
      if (reply.sent) return;
      const { id } = request.params;
      const patch = request.body || {};
      if (
        patch.rateLimitPerMin != null &&
        (!Number.isFinite(patch.rateLimitPerMin) || patch.rateLimitPerMin < 1)
      ) {
        return reply
          .status(400)
          .send({ code: 'INVALID_RATE_LIMIT', message: 'rateLimitPerMin must be >= 1' });
      }
      const updated = updateManagedKey(id, patch);
      if (!updated) return reply.status(404).send({ code: 'NOT_FOUND', message: 'key not found' });
      return reply.send({ key: updated });
    }
  );

  app.delete<{ Params: { id: string } }>('/api/v1/admin/keys/:id', async (request, reply) => {
    await mustAuth(request, reply);
    if (reply.sent) return;
    const ok = deleteManagedKey(request.params.id);
    if (!ok) return reply.status(404).send({ code: 'NOT_FOUND', message: 'key not found' });
    return reply.status(204).send();
  });
}
