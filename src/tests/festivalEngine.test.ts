import assert from 'node:assert/strict';
import { advanceTithiAmanta, detectFestivals } from '../lib/festivalEngine.js';
import { FESTIVAL_FIXTURES, fixtureToResult } from './festivalEngine.fixtures.js';

function run() {
  assert.deepEqual(advanceTithiAmanta(14, 0, 3), { tithi: 15, paksham: 1, lunarMonthIndex: 3 });
  assert.deepEqual(advanceTithiAmanta(29, 1, 5), { tithi: 0, paksham: 0, lunarMonthIndex: 6 });

  for (const fx of FESTIVAL_FIXTURES) {
    const result = fixtureToResult(fx.input);
    const festivals = detectFestivals(fx.input.dateStr, result, 'en', fx.previousSunsign);
    const ids = festivals.map((f) => f.id);
    for (const expectedId of fx.expectedIds) {
      assert(
        ids.includes(expectedId),
        `[${fx.label}] Expected "${expectedId}" in ${JSON.stringify(ids)}`
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log(`festivalEngine fixtures passed: ${FESTIVAL_FIXTURES.length}`);
}

run();
