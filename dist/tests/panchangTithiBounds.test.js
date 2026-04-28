"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const panchang_js_1 = require("../lib/panchang.js");
const timezone_js_1 = require("../lib/timezone.js");
/** Hyderabad; regression: civil-day timeline must align with true tithi boundaries (start + end). */
const lat = 17.385;
const lon = 78.4867;
const tz = 'Asia/Kolkata';
function wallHm(d) {
    const f = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
    });
    const parts = Object.fromEntries(f.formatToParts(d).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
    return { h: +parts.hour, m: +parts.minute };
}
function run() {
    const r = (0, panchang_js_1.computePanchang)('2026-04-13', lat, lon, tz, 'lahiri');
    strict_1.default.equal(r.tithi.index, 25, 'expect Krishna Ekadashi (index 25) at sunrise');
    strict_1.default.ok(r.tithi.startTime, 'tithi.startTime must be set');
    strict_1.default.ok(r.tithi.endTime, 'tithi.endTime must be set');
    strict_1.default.equal((0, timezone_js_1.calendarDateKeyInTz)(r.tithi.startTime, tz), '2026-04-13');
    strict_1.default.equal((0, timezone_js_1.calendarDateKeyInTz)(r.tithi.endTime, tz), '2026-04-14');
    const st = wallHm(r.tithi.startTime);
    const en = wallHm(r.tithi.endTime);
    strict_1.default.equal(st.h, 1, 'tithi start ~01:xx local');
    strict_1.default.ok(st.m >= 12 && st.m <= 25, `tithi start minute ${st.m} in plausible range`);
    strict_1.default.equal(en.h, 1, 'tithi end ~01:xx next day local');
    strict_1.default.ok(en.m >= 0 && en.m <= 20, `tithi end minute ${en.m} in plausible range`);
    // No spurious "end at next sunrise" when the tithi actually changes earlier
    const sunriseNext = (0, panchang_js_1.computePanchang)('2026-04-14', lat, lon, tz, 'lahiri').sunrise;
    strict_1.default.ok(r.tithi.endTime.getTime() < sunriseNext.getTime(), 'tithi end must be before next sunrise when transition falls pre-dawn');
    // eslint-disable-next-line no-console
    console.log('panchangTithiBounds tests passed');
}
run();
