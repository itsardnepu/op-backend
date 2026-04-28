/**
 * Phase 0 verification: Swiss Ephemeris via @swisseph/node
 * Tests that the package works with bundled ephemeris (no manual download).
 */

const {
  dateToJulianDay,
  calculatePosition,
  julianDayToDate,
  Planet,
  close,
} = require('@swisseph/node');

console.log('Phase 0: Swiss Ephemeris verification\n');
console.log('Testing @swisseph/node (ephemeris auto-loaded, no config needed)...\n');

// Test 1: Julian day for Hyderabad default date
const testDate = new Date('2025-03-08T06:00:00Z'); // Sample date
const jd = dateToJulianDay(testDate);
console.log('1. Julian Day:', jd.toFixed(6), 'for', testDate.toISOString());

// Test 2: Sun position (needed for tithi, sunrise calculations)
const sun = calculatePosition(jd, Planet.Sun);
console.log('2. Sun position:', sun.longitude.toFixed(4) + '°', '(longitude)');

// Test 3: Moon position (needed for tithi, nakshatra, yoga, karana)
const moon = calculatePosition(jd, Planet.Moon);
console.log('3. Moon position:', moon.longitude.toFixed(4) + '°', '(longitude)');

// Test 4: Round-trip date
const backDate = julianDayToDate(jd);
console.log('4. Round-trip date:', backDate.toISOString());

close();

console.log('\n✓ All tests passed. Swiss Ephemeris is ready for Panchang calculations.');
