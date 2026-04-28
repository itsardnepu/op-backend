import { FastifyReply, FastifyRequest } from 'fastify';

export async function adminAuthMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const adminToken = process.env.ADMIN_TOKEN?.trim();
  if (!adminToken) {
    return reply.status(503).send({
      code: 'ADMIN_NOT_CONFIGURED',
      message: 'ADMIN_TOKEN is not configured on server',
    });
  }
  const incoming = (request.headers['x-admin-token'] as string | undefined)?.trim();
  if (!incoming || incoming !== adminToken) {
    return reply.status(401).send({
      code: 'INVALID_ADMIN_TOKEN',
      message: 'Valid x-admin-token header required',
    });
  }
}
