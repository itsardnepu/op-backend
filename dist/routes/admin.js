"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = adminRoutes;
const apiKeys_js_1 = require("../lib/apiKeys.js");
async function adminRoutes(app, opts) {
    const adminAuth = opts?.adminAuthMiddleware;
    const mustAuth = async (request, reply) => {
        if (adminAuth)
            await adminAuth(request, reply);
    };
    app.get('/api/v1/admin/keys', async (request, reply) => {
        await mustAuth(request, reply);
        if (reply.sent)
            return;
        return reply.send({ keys: (0, apiKeys_js_1.listManagedKeys)() });
    });
    app.post('/api/v1/admin/keys', async (request, reply) => {
        await mustAuth(request, reply);
        if (reply.sent)
            return;
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
        const created = (0, apiKeys_js_1.createManagedKey)({ name, rateLimitPerMin });
        return reply.status(201).send(created);
    });
    app.patch('/api/v1/admin/keys/:id', async (request, reply) => {
        await mustAuth(request, reply);
        if (reply.sent)
            return;
        const { id } = request.params;
        const patch = request.body || {};
        if (patch.rateLimitPerMin != null &&
            (!Number.isFinite(patch.rateLimitPerMin) || patch.rateLimitPerMin < 1)) {
            return reply
                .status(400)
                .send({ code: 'INVALID_RATE_LIMIT', message: 'rateLimitPerMin must be >= 1' });
        }
        const updated = (0, apiKeys_js_1.updateManagedKey)(id, patch);
        if (!updated)
            return reply.status(404).send({ code: 'NOT_FOUND', message: 'key not found' });
        return reply.send({ key: updated });
    });
    app.delete('/api/v1/admin/keys/:id', async (request, reply) => {
        await mustAuth(request, reply);
        if (reply.sent)
            return;
        const ok = (0, apiKeys_js_1.deleteManagedKey)(request.params.id);
        if (!ok)
            return reply.status(404).send({ code: 'NOT_FOUND', message: 'key not found' });
        return reply.status(204).send();
    });
}
