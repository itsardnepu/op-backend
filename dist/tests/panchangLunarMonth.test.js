"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const panchang_js_1 = require("../lib/panchang.js");
/** Hyderabad-ish; Amanta Chaitra after Ugadi 2026-03-19 */
const lat = 17.385;
const lon = 78.4867;
const tz = 'Asia/Kolkata';
function run() {
    strict_1.default.equal((0, panchang_js_1.ruthuvuIndexFromSunsign)(0), 0, 'Mesha → Vasanta');
    strict_1.default.equal((0, panchang_js_1.ruthuvuIndexFromSunsign)(1), 0, 'Vrishabha → Vasanta');
    strict_1.default.equal((0, panchang_js_1.ruthuvuIndexFromSunsign)(3), 1, 'Karka → Grishma');
    strict_1.default.equal((0, panchang_js_1.ruthuvuIndexFromSunsign)(11), 5, 'Meena alone → Shishira (rāśi-only rule)');
    strict_1.default.equal((0, panchang_js_1.ruthuvuIndexFromPanchang)(11, 0), 0, 'Chaitra + Meena Sun → Vasanta');
    strict_1.default.equal((0, panchang_js_1.ruthuvuIndexFromPanchang)(11, 11), 5, 'Phalguna + Meena Sun → Shishira');
    const chaitra = (0, panchang_js_1.computePanchang)('2026-03-29', lat, lon, tz);
    strict_1.default.equal(chaitra.lunarMonthIndex, 0, 'late March 2026 should be Chaitra');
    strict_1.default.equal(chaitra.ruthuvuIndex, 0, 'Chaitra with Sun in Meena should be Vasanta');
    const phalgunaPurnima = (0, panchang_js_1.computePanchang)('2026-03-03', lat, lon, tz);
    strict_1.default.equal(phalgunaPurnima.lunarMonthIndex, 11, 'Phalguna Purnima (this ephemeris) stays Phalguna');
    strict_1.default.equal(phalgunaPurnima.ruthuvuIndex, 5, 'Phalguna + Kumbha/Meena Sun stays Shishira');
    const chaitraKrishnaMeena = (0, panchang_js_1.computePanchang)('2026-04-05', lat, lon, tz);
    strict_1.default.equal(chaitraKrishnaMeena.lunarMonthIndex, 0, 'Chaitra Krishna with Sun still in Meena must not become Phalguna');
    strict_1.default.equal(chaitraKrishnaMeena.ruthuvuIndex, 0, 'Chaitra Krishna + Meena Sun is Vasanta');
    // eslint-disable-next-line no-console
    console.log('panchangLunarMonth tests passed');
}
run();
