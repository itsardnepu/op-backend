import assert from 'node:assert/strict';
import { computePanchang, ruthuvuIndexFromPanchang, ruthuvuIndexFromSunsign } from '../lib/panchang.js';

/** Hyderabad-ish; Amanta Chaitra after Ugadi 2026-03-19 */
const lat = 17.385;
const lon = 78.4867;
const tz = 'Asia/Kolkata';

function run() {
  assert.equal(ruthuvuIndexFromSunsign(0), 0, 'Mesha → Vasanta');
  assert.equal(ruthuvuIndexFromSunsign(1), 0, 'Vrishabha → Vasanta');
  assert.equal(ruthuvuIndexFromSunsign(3), 1, 'Karka → Grishma');
  assert.equal(ruthuvuIndexFromSunsign(11), 5, 'Meena alone → Shishira (rāśi-only rule)');
  assert.equal(ruthuvuIndexFromPanchang(11, 0), 0, 'Chaitra + Meena Sun → Vasanta');
  assert.equal(ruthuvuIndexFromPanchang(11, 11), 5, 'Phalguna + Meena Sun → Shishira');

  const chaitra = computePanchang('2026-03-29', lat, lon, tz);
  assert.equal(chaitra.lunarMonthIndex, 0, 'late March 2026 should be Chaitra');
  assert.equal(chaitra.ruthuvuIndex, 0, 'Chaitra with Sun in Meena should be Vasanta');

  const phalgunaPurnima = computePanchang('2026-03-03', lat, lon, tz);
  assert.equal(phalgunaPurnima.lunarMonthIndex, 11, 'Phalguna Purnima (this ephemeris) stays Phalguna');
  assert.equal(phalgunaPurnima.ruthuvuIndex, 5, 'Phalguna + Kumbha/Meena Sun stays Shishira');

  const chaitraKrishnaMeena = computePanchang('2026-04-05', lat, lon, tz);
  assert.equal(
    chaitraKrishnaMeena.lunarMonthIndex,
    0,
    'Chaitra Krishna with Sun still in Meena must not become Phalguna'
  );
  assert.equal(chaitraKrishnaMeena.ruthuvuIndex, 0, 'Chaitra Krishna + Meena Sun is Vasanta');

  // eslint-disable-next-line no-console
  console.log('panchangLunarMonth tests passed');
}

run();
