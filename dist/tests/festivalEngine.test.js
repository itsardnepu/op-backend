"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const festivalEngine_js_1 = require("../lib/festivalEngine.js");
const festivalEngine_fixtures_js_1 = require("./festivalEngine.fixtures.js");
function run() {
    strict_1.default.deepEqual((0, festivalEngine_js_1.advanceTithiAmanta)(14, 0, 3), { tithi: 15, paksham: 1, lunarMonthIndex: 3 });
    strict_1.default.deepEqual((0, festivalEngine_js_1.advanceTithiAmanta)(29, 1, 5), { tithi: 0, paksham: 0, lunarMonthIndex: 6 });
    for (const fx of festivalEngine_fixtures_js_1.FESTIVAL_FIXTURES) {
        const result = (0, festivalEngine_fixtures_js_1.fixtureToResult)(fx.input);
        const festivals = (0, festivalEngine_js_1.detectFestivals)(fx.input.dateStr, result, 'en', fx.previousSunsign);
        const ids = festivals.map((f) => f.id);
        for (const expectedId of fx.expectedIds) {
            (0, strict_1.default)(ids.includes(expectedId), `[${fx.label}] Expected "${expectedId}" in ${JSON.stringify(ids)}`);
        }
    }
    // eslint-disable-next-line no-console
    console.log(`festivalEngine fixtures passed: ${festivalEngine_fixtures_js_1.FESTIVAL_FIXTURES.length}`);
}
run();
