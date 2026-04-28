"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.panchangRoutes = panchangRoutes;
const festivalEngine_js_1 = require("../lib/festivalEngine.js");
const names = __importStar(require("../lib/names.js"));
const validation_js_1 = require("../lib/validation.js");
const AUSPICO_BASE_URL = (process.env.AUSPICO_BASE_URL || 'http://localhost:3010').replace(/\/$/, '');
function roundToMinute(d) {
    return new Date(Math.round(d.getTime() / 60000) * 60000);
}
function formatTime(d) {
    return roundToMinute(d).toISOString();
}
function addCalendarDaysIso(dateStr, deltaDays) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
    return dt.toISOString().slice(0, 10);
}
function getNames(lang) {
    return {
        tithi: lang === 'te' ? names.TITHI_NAMES_TE : names.TITHI_NAMES_EN,
        nakshatra: lang === 'te' ? names.NAKSHATRA_NAMES_TE : names.NAKSHATRA_NAMES_EN,
        yoga: lang === 'te' ? names.YOGA_NAMES_TE : names.YOGA_NAMES_EN,
        karana: lang === 'te' ? names.KARANA_NAMES_TE : names.KARANA_NAMES_EN,
        vara: lang === 'te' ? names.VARA_NAMES_TE : names.VARA_NAMES_EN,
        rashi: lang === 'te' ? names.RASHI_NAMES_TE : names.RASHI_NAMES_EN,
        paksha: lang === 'te' ? names.PAKSHA_NAMES_TE : names.PAKSHA_NAMES_EN,
        ruthuvu: lang === 'te' ? names.RUTHUVU_NAMES_TE : names.RUTHUVU_NAMES_EN,
    };
}
async function panchangRoutes(app, opts) {
    const redis = opts?.redis ?? null;
    const apiKeyMiddleware = opts?.apiKeyMiddleware;
    const maybeAuth = async (request, reply) => {
        if (apiKeyMiddleware) {
            await apiKeyMiddleware(request, reply);
        }
    };
    app.get('/api/v1/panchang/today', async (request, reply) => {
        await maybeAuth(request, reply);
        if (reply.sent)
            return;
        const { lat, lon, tz, ayanamsa = 'lahiri', lang = 'te' } = request.query;
        const today = new Date().toISOString().slice(0, 10);
        return panchangHandler(request, reply, today, lat, lon, tz, ayanamsa, lang, redis);
    });
    app.get('/api/v1/panchang/date', async (request, reply) => {
        await maybeAuth(request, reply);
        if (reply.sent)
            return;
        const { date, lat, lon, tz, ayanamsa = 'lahiri', lang = 'te' } = request.query;
        if (!date)
            return reply.status(400).send({ code: 'MISSING_DATE', message: 'date is required (YYYY-MM-DD)' });
        return panchangHandler(request, reply, date, lat, lon, tz, ayanamsa, lang, redis);
    });
    app.get('/api/v1/panchang/range', async (request, reply) => {
        await maybeAuth(request, reply);
        if (reply.sent)
            return;
        const { start, end, lat, lon, tz, ayanamsa = 'lahiri', lang = 'te' } = request.query;
        if (!start || !end) {
            return reply.status(400).send({ code: 'MISSING_RANGE', message: 'start and end are required (YYYY-MM-DD)' });
        }
        const startDate = new Date(start);
        const endDate = new Date(end);
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 3600 * 1000)) + 1;
        if (days > 31) {
            return reply.status(400).send({ code: 'RANGE_TOO_LARGE', message: 'Maximum 31 days' });
        }
        const results = [];
        let d = new Date(start);
        while (d <= endDate) {
            const dateStr = d.toISOString().slice(0, 10);
            const payload = await computePanchangForDate(dateStr, lat, lon, tz, ayanamsa, lang, redis);
            if ('code' in payload)
                return reply.status(400).send(payload);
            results.push(payload);
            d.setDate(d.getDate() + 1);
        }
        return reply.send({ days: results });
    });
}
async function computePanchangForDate(dateStr, lat, lon, tz, ayanamsa, lang, redis) {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        return { code: 'INVALID_LAT', message: 'lat must be between -90 and 90' };
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
        return { code: 'INVALID_LON', message: 'lon must be between -180 and 180' };
    }
    if (!(0, validation_js_1.isValidTimezone)(tz)) {
        return { code: 'INVALID_TZ', message: 'tz must be a valid IANA timezone (e.g. Asia/Kolkata)' };
    }
    const [auspicoCurrent, auspicoPrev, auspicoNext] = await Promise.all([
        fetchAuspicoCore(dateStr, latNum, lonNum, tz, ayanamsa),
        fetchAuspicoCore(addCalendarDaysIso(dateStr, -1), latNum, lonNum, tz, ayanamsa),
        fetchAuspicoCore(addCalendarDaysIso(dateStr, 1), latNum, lonNum, tz, ayanamsa),
    ]);
    if (!auspicoCurrent.ok) {
        return { code: 'AUSPICO_ERROR', message: auspicoCurrent.message };
    }
    if (!auspicoPrev.ok) {
        return { code: 'AUSPICO_ERROR', message: auspicoPrev.message };
    }
    if (!auspicoNext.ok) {
        return { code: 'AUSPICO_ERROR', message: auspicoNext.message };
    }
    const result = auspicoCurrent.core;
    const previousSunsign = auspicoPrev.core.sunsign;
    const n = getNames(lang);
    const festivals = (0, festivalEngine_js_1.buildFestivalsForDay)({
        dateStr,
        timeZone: tz,
        lang,
        result: result,
        previousSunsign,
        prevResult: auspicoPrev.core,
        prevDateStr: addCalendarDaysIso(dateStr, -1),
        previousSunsignForPrevDay: null,
        nextResult: auspicoNext.core,
    });
    return {
        request: { date: dateStr, lat: latNum, lon: lonNum, tz, ayanamsa, lang },
        meta: { version: '1.0.0' },
        day: {
            date: dateStr,
            sunrise: formatTime(new Date(result.sunrise)),
            sunset: formatTime(new Date(result.sunset)),
            moonrise: result.moonrise ? formatTime(new Date(result.moonrise)) : null,
            moonset: result.moonset ? formatTime(new Date(result.moonset)) : null,
            vara: n.vara[result.vara] ?? result.vara,
            varaIndex: result.vara,
            paksham: result.paksham,
            pakshamName: n.paksha[result.paksham],
            moonsign: result.moonsign,
            moonsignName: n.rashi[result.moonsign],
            sunsign: result.sunsign,
            sunsignName: n.rashi[result.sunsign],
            lunarMonthIndex: result.lunarMonthIndex,
            ruthuvuIndex: result.ruthuvuIndex,
            ruthuvuName: n.ruthuvu[result.ruthuvuIndex] ?? result.ruthuvuIndex,
        },
        panchang: [
            {
                type: 'tithi',
                index: result.tithi.index,
                name: n.tithi[result.tithi.index],
                startTime: formatTime(new Date(result.tithi.startTime)),
                endTime: result.tithi.endTime ? formatTime(new Date(result.tithi.endTime)) : null,
            },
            {
                type: 'nakshatra',
                index: result.nakshatra.index,
                name: n.nakshatra[result.nakshatra.index],
                startTime: formatTime(new Date(result.nakshatra.startTime)),
                endTime: result.nakshatra.endTime ? formatTime(new Date(result.nakshatra.endTime)) : null,
            },
            {
                type: 'yoga',
                index: result.yoga.index,
                name: n.yoga[result.yoga.index],
                startTime: formatTime(new Date(result.yoga.startTime)),
                endTime: result.yoga.endTime ? formatTime(new Date(result.yoga.endTime)) : null,
            },
            ...result.karanas.map((k) => ({
                type: 'karana',
                index: k.index,
                name: n.karana[k.index],
                startTime: formatTime(new Date(k.startTime)),
                endTime: k.endTime ? formatTime(new Date(k.endTime)) : null,
            })),
        ],
        kaalams: result.kaalams.map((k) => ({ name: k.name, start: formatTime(new Date(k.start)), end: formatTime(new Date(k.end)) })),
        abhijit: { start: formatTime(new Date(result.abhijit.start)), end: formatTime(new Date(result.abhijit.end)) },
        brahmaMuhurtam: {
            start: formatTime(new Date(result.brahmaMuhurtam.start)),
            end: formatTime(new Date(result.brahmaMuhurtam.end)),
        },
        amrutaGhadiyalu: result.amrutaGhadiyalu.map((r) => ({ start: formatTime(new Date(r.start)), end: formatTime(new Date(r.end)) })),
        varjam: result.varjam ? { start: formatTime(new Date(result.varjam.start)), end: formatTime(new Date(result.varjam.end)) } : null,
        durmuhurtham: result.durmuhurtham.map((r) => ({ start: formatTime(new Date(r.start)), end: formatTime(new Date(r.end)) })),
        festivals,
    };
}
async function panchangHandler(request, reply, dateStr, lat, lon, tz, ayanamsa, lang, redis) {
    if (!tz || typeof tz !== 'string') {
        return reply.status(400).send({ code: 'MISSING_TZ', message: 'tz (IANA timezone) is required' });
    }
    if (!(0, validation_js_1.isValidTimezone)(tz)) {
        return reply.status(400).send({ code: 'INVALID_TZ', message: 'tz must be a valid IANA timezone (e.g. Asia/Kolkata)' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return reply.status(400).send({ code: 'INVALID_DATE', message: 'date must be YYYY-MM-DD' });
    }
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        return reply.status(400).send({ code: 'INVALID_LAT', message: 'lat must be between -90 and 90' });
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
        return reply.status(400).send({ code: 'INVALID_LON', message: 'lon must be between -180 and 180' });
    }
    const cacheKey = redis
        ? `panchang:${dateStr}:${latNum.toFixed(2)}:${lonNum.toFixed(2)}:${tz}:${ayanamsa}:${lang}`
        : null;
    if (redis && cacheKey) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached)
                return reply.send(JSON.parse(cached));
        }
        catch { }
    }
    try {
        const payload = await computePanchangForDate(dateStr, lat, lon, tz, ayanamsa, lang, null);
        if ('code' in payload)
            return reply.status(400).send(payload);
        if (redis && cacheKey) {
            const ttl = isToday(dateStr) ? 6 * 3600 : isPast(dateStr) ? 30 * 24 * 3600 : 7 * 24 * 3600;
            await redis.setex(cacheKey, ttl, JSON.stringify(payload));
        }
        return reply.send(payload);
    }
    catch (err) {
        request.log.error({ err }, 'Panchang calculation error');
        return reply.status(500).send({ code: 'CALC_ERROR', message: 'Calculation failed' });
    }
}
function isToday(dateStr) {
    return dateStr === new Date().toISOString().slice(0, 10);
}
function isPast(dateStr) {
    return dateStr < new Date().toISOString().slice(0, 10);
}
async function fetchAuspicoCore(date, lat, lon, tz, ayanamsa) {
    const url = new URL('/api/v1/panchang/date', AUSPICO_BASE_URL);
    url.searchParams.set('date', date);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('tz', tz);
    url.searchParams.set('ayanamsa', ayanamsa);
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            return { ok: false, message: `Auspico upstream error ${response.status}: ${text}` };
        }
        const body = (await response.json());
        if (!body?.core) {
            return { ok: false, message: 'Auspico response missing core payload' };
        }
        return { ok: true, core: body.core };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unknown upstream failure';
        return { ok: false, message };
    }
}
