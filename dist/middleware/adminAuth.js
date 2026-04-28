"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuthMiddleware = adminAuthMiddleware;
async function adminAuthMiddleware(request, reply) {
    const adminToken = process.env.ADMIN_TOKEN?.trim();
    if (!adminToken) {
        return reply.status(503).send({
            code: 'ADMIN_NOT_CONFIGURED',
            message: 'ADMIN_TOKEN is not configured on server',
        });
    }
    const incoming = request.headers['x-admin-token']?.trim();
    if (!incoming || incoming !== adminToken) {
        return reply.status(401).send({
            code: 'INVALID_ADMIN_TOKEN',
            message: 'Valid x-admin-token header required',
        });
    }
}
