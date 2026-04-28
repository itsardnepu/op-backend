"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.midnightInTz = midnightInTz;
exports.calendarDateKeyInTz = calendarDateKeyInTz;
/**
 * UTC instant for local midnight (00:00:00) on `dateStr` (YYYY-MM-DD) in IANA `tz`.
 *
 * Avoids `timeZoneName: 'longOffset'`, which is missing or non-GMT-shaped in some engines
 * (then offset was treated as 0 and civil midnight was wrong for non-UTC zones).
 */
function midnightInTz(dateStr, tz) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        hourCycle: 'h23',
    });
    let guess = Date.UTC(y, m - 1, d, 12, 0, 0);
    for (let i = 0; i < 12; i++) {
        const parts = Object.fromEntries(formatter.formatToParts(guess).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
        const py = +parts.year;
        const pm = +parts.month;
        const pd = +parts.day;
        const ph = +parts.hour;
        const pmi = +parts.minute;
        const ps = +parts.second;
        if (py === y && pm === m && pd === d && ph === 0 && pmi === 0 && ps === 0) {
            return new Date(guess);
        }
        const localMsFromMidnight = ((ph * 60 + pmi) * 60 + ps) * 1000;
        const dayDiffMs = Date.UTC(y, m - 1, d) - Date.UTC(py, pm - 1, pd);
        guess -= dayDiffMs + localMsFromMidnight;
    }
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}
/** YYYY-MM-DD for `instant` in IANA `tz` (for filtering rise/set to a civil day). */
function calendarDateKeyInTz(instant, tz) {
    try {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(instant);
        const y = parts.find((p) => p.type === 'year')?.value;
        const m = parts.find((p) => p.type === 'month')?.value;
        const d = parts.find((p) => p.type === 'day')?.value;
        if (y == null || m == null || d == null)
            return '';
        return `${y}-${m}-${d}`;
    }
    catch {
        return '';
    }
}
