"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidTimezone = isValidTimezone;
exports.isValidDate = isValidDate;
function isValidTimezone(tz) {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    }
    catch {
        return false;
    }
}
function isValidDate(dateStr) {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
}
