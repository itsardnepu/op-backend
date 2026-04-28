"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const PORT = Number(process.env.PORT) || 3000;
async function start() {
    const { app } = await (0, app_js_1.buildApp)();
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Health: http://localhost:${PORT}/api/v1/health`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
// On Vercel, HTTP is handled by `api/index.ts`; avoid binding a port here.
if (process.env.VERCEL !== '1') {
    start();
}
