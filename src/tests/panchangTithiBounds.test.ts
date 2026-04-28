import assert from 'node:assert/strict';
import { computePanchang } from '../lib/panchang.js';
import { calendarDateKeyInTz } from '../lib/timezone.js';

/** Hyderabad; regression: civil-day timeline must align with true tithi boundaries (start + end). */
const lat = 17.385;
const lon = 78.4867;
const tz = 'Asia/Kolkata';

function wallHm(d: Date): { h: number; m: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    f.formatToParts(d).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value])
  ) as Record<string, string>;
  return { h: +parts.hour, m: +parts.minute };
}

function run() {
  const r = computePanchang('2026-04-13', lat, lon, tz, 'lahiri');
  assert.equal(r.tithi.index, 25, 'expect Krishna Ekadashi (index 25) at sunrise');
  assert.ok(r.tithi.startTime, 'tithi.startTime must be set');
  assert.ok(r.tithi.endTime, 'tithi.endTime must be set');

  assert.equal(calendarDateKeyInTz(r.tithi.startTime, tz), '2026-04-13');
  assert.equal(calendarDateKeyInTz(r.tithi.endTime, tz), '2026-04-14');

  const st = wallHm(r.tithi.startTime);
  const en = wallHm(r.tithi.endTime);
  assert.equal(st.h, 1, 'tithi start ~01:xx local');
  assert.ok(st.m >= 12 && st.m <= 25, `tithi start minute ${st.m} in plausible range`);
  assert.equal(en.h, 1, 'tithi end ~01:xx next day local');
  assert.ok(en.m >= 0 && en.m <= 20, `tithi end minute ${en.m} in plausible range`);

  // No spurious "end at next sunrise" when the tithi actually changes earlier
  const sunriseNext = computePanchang('2026-04-14', lat, lon, tz, 'lahiri').sunrise;
  assert.ok(
    r.tithi.endTime.getTime() < sunriseNext.getTime(),
    'tithi end must be before next sunrise when transition falls pre-dawn'
  );

  // eslint-disable-next-line no-console
  console.log('panchangTithiBounds tests passed');
}

run();
