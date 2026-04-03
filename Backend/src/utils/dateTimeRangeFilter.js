/**
 * Date range filters: calendar dates and optional times are interpreted in the organization's IANA time zone.
 * Stored timestamps (createdAt, etc.) remain UTC in the database; boundaries are converted to UTC for queries.
 */
const { DateTime } = require('luxon');

const DEFAULT_TZ = 'America/New_York';

function resolveZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return DEFAULT_TZ;
  const z = timeZone.trim();
  if (!z) return DEFAULT_TZ;
  return DateTime.now().setZone(z).isValid ? z : DEFAULT_TZ;
}

function parseClockParts(t) {
  if (t == null || !String(t).trim()) return null;
  const s = String(t).trim();
  if (/^\d{2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    return { hour: h, minute: m, second: 0 };
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) {
    const [h, m, sec] = s.split(':').map(Number);
    return { hour: h, minute: m, second: sec };
  }
  return null;
}

function buildCreatedAtRange({ fromDate, toDate, fromTime, toTime, timeZone }) {
  const zone = resolveZone(timeZone);
  const createdAt = {};
  const fd = fromDate && String(fromDate).trim();
  const td = toDate && String(toDate).trim();

  if (fd) {
    const [y, mo, d] = fd.split('-').map(Number);
    const fp = parseClockParts(fromTime);
    let dt;
    if (fp) {
      dt = DateTime.fromObject(
        { year: y, month: mo, day: d, hour: fp.hour, minute: fp.minute, second: fp.second },
        { zone }
      );
    } else {
      dt = DateTime.fromObject({ year: y, month: mo, day: d }, { zone }).startOf('day');
    }
    if (dt.isValid) createdAt.gte = dt.toUTC().toISO();
  }

  if (td) {
    const [y, mo, d] = td.split('-').map(Number);
    const tp = parseClockParts(toTime);
    let dt;
    if (tp) {
      const base = DateTime.fromObject(
        { year: y, month: mo, day: d, hour: tp.hour, minute: tp.minute, second: tp.second },
        { zone }
      );
      if (base.isValid) {
        const raw = String(toTime).trim();
        if (/^\d{2}:\d{2}$/.test(raw)) {
          dt = base.endOf('minute');
        } else {
          dt = base.endOf('second');
        }
      }
    } else {
      dt = DateTime.fromObject({ year: y, month: mo, day: d }, { zone }).endOf('day');
    }
    if (dt && dt.isValid) createdAt.lte = dt.toUTC().toISO();
  }

  return Object.keys(createdAt).length ? createdAt : null;
}

module.exports = { buildCreatedAtRange, resolveZone, DEFAULT_TZ };
