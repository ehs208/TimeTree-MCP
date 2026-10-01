/**
 * Minimal RFC 5545 recurrence expansion for TimeTree events.
 *
 * TimeTree stores recurrence as RRULE/EXDATE lines on the series event. Deleting one
 * occurrence adds an EXDATE; editing one occurrence adds an EXDATE and creates a separate
 * event whose parent_id is the series UUID, so exceptions need no special handling here.
 *
 * Supported: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY with INTERVAL, COUNT, UNTIL, BYDAY
 * (including ordinals such as 2MO or -1FR for MONTHLY/YEARLY), BYMONTHDAY, BYMONTH, WKST.
 * Rules using other parts return null so callers can fall back to the unexpanded event.
 */

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PERIODS = 20000;

type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

interface ByDay {
  weekday: number;
  ordinal?: number;
}

interface Rule {
  freq: Freq;
  interval: number;
  count?: number;
  until?: number;
  byDay: ByDay[];
  byMonthDay: number[];
  byMonth: number[];
  weekStart: number;
}

interface LocalDate {
  year: number;
  month: number; // 1-12
  day: number;
}

interface LocalTime {
  hour: number;
  minute: number;
  second: number;
}

const SUPPORTED_PARTS = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'WKST']);

/** Parse an RFC 5545 date or date-time value (UTC or floating) into epoch milliseconds. */
function parseDateValue(value: string): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

function parseRule(value: string): Rule | null {
  const parts = new Map<string, string>();
  for (const pair of value.split(';')) {
    const [key, val] = pair.split('=');
    if (!key || val === undefined) continue;
    parts.set(key.toUpperCase(), val.toUpperCase());
  }

  for (const key of parts.keys()) {
    if (!SUPPORTED_PARTS.has(key)) return null;
  }

  const freq = parts.get('FREQ');
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;

  const byDay: ByDay[] = [];
  for (const token of (parts.get('BYDAY') ?? '').split(',').filter(Boolean)) {
    const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token);
    if (!match) return null;
    const ordinal = match[1] ? Number(match[1]) : undefined;
    if (ordinal !== undefined && (freq === 'DAILY' || freq === 'WEEKLY')) return null;
    byDay.push({ weekday: WEEKDAYS.indexOf(match[2] as (typeof WEEKDAYS)[number]), ordinal });
  }

  const numbers = (key: string) =>
    (parts.get(key) ?? '').split(',').filter(Boolean).map(Number);
  const byMonthDay = numbers('BYMONTHDAY');
  const byMonth = numbers('BYMONTH');
  if ([...byMonthDay, ...byMonth].some((n) => !Number.isInteger(n) || n === 0)) return null;

  const until = parts.has('UNTIL') ? parseDateValue(parts.get('UNTIL')!) : undefined;
  if (until === null) return null;

  const interval = parts.has('INTERVAL') ? Number(parts.get('INTERVAL')) : 1;
  const count = parts.has('COUNT') ? Number(parts.get('COUNT')) : undefined;
  if (!Number.isInteger(interval) || interval < 1) return null;
  if (count !== undefined && (!Number.isInteger(count) || count < 1)) return null;

  const weekStart = WEEKDAYS.indexOf((parts.get('WKST') ?? 'MO') as (typeof WEEKDAYS)[number]);
  if (weekStart < 0) return null;

  return { freq, interval, count, until, byDay, byMonthDay, byMonth, weekStart };
}

export interface ParsedRecurrence {
  rule: Rule;
  exdates: Set<number>;
}

/** Parse TimeTree recurrence lines. Returns null when there is no supported RRULE. */
export function parseRecurrence(lines: unknown[] | undefined): ParsedRecurrence | null {
  if (!lines?.length) return null;

  let rule: Rule | null = null;
  const exdates = new Set<number>();

  for (const line of lines) {
    if (typeof line !== 'string') continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const name = line.slice(0, separator).split(';')[0].toUpperCase();
    const value = line.slice(separator + 1);

    if (name === 'RRULE') {
      if (rule) return null; // Multiple RRULEs are not supported.
      rule = parseRule(value);
      if (!rule) return null;
    } else if (name === 'EXDATE') {
      for (const item of value.split(',')) {
        const parsed = parseDateValue(item);
        if (parsed !== null) exdates.add(parsed);
      }
    } else if (name === 'RDATE') {
      return null;
    }
  }

  return rule ? { rule, exdates } : null;
}

function timeZoneFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
}

function toLocal(instant: number, formatter: Intl.DateTimeFormat): LocalDate & LocalTime {
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/** Convert a wall-clock time in the formatter's time zone to epoch milliseconds. */
function fromLocal(date: LocalDate, time: LocalTime, formatter: Intl.DateTimeFormat): number {
  const wallAsUtc = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second);
  let guess = wallAsUtc;
  for (let i = 0; i < 2; i++) {
    const local = toLocal(guess, formatter);
    const offset =
      Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - guess;
    guess = wallAsUtc - offset;
  }
  return guess;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayOf(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function compareDates(a: LocalDate, b: LocalDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** Candidate days within one month for MONTHLY/YEARLY rules. */
function daysInMonthMatching(year: number, month: number, rule: Rule, start: LocalDate): LocalDate[] {
  const length = daysInMonth(year, month);
  const days = new Set<number>();

  if (rule.byMonthDay.length) {
    for (const n of rule.byMonthDay) {
      const day = n > 0 ? n : length + n + 1;
      if (day >= 1 && day <= length) days.add(day);
    }
  }

  if (rule.byDay.length) {
    const byDayMatches = new Set<number>();
    for (const { weekday, ordinal } of rule.byDay) {
      const matching: number[] = [];
      for (let day = 1; day <= length; day++) {
        if (weekdayOf({ year, month, day }) === weekday) matching.push(day);
      }
      if (ordinal === undefined) {
        matching.forEach((day) => byDayMatches.add(day));
      } else {
        const day = ordinal > 0 ? matching[ordinal - 1] : matching[matching.length + ordinal];
        if (day !== undefined) byDayMatches.add(day);
      }
    }
    if (rule.byMonthDay.length) {
      // Both parts present: keep the intersection.
      for (const day of [...days]) if (!byDayMatches.has(day)) days.delete(day);
    } else {
      byDayMatches.forEach((day) => days.add(day));
    }
  }

  if (!rule.byMonthDay.length && !rule.byDay.length && start.day <= length) {
    days.add(start.day);
  }

  return [...days].sort((a, b) => a - b).map((day) => ({ year, month, day }));
}

/** Candidate days for one rule period, in ascending order. */
function periodDates(rule: Rule, start: LocalDate, period: number): LocalDate[] {
  switch (rule.freq) {
    case 'DAILY': {
      const date = addDays(start, period * rule.interval);
      return rule.byMonth.length && !rule.byMonth.includes(date.month) ? [] : [date];
    }
    case 'WEEKLY': {
      const offsetToWeekStart = (weekdayOf(start) - rule.weekStart + 7) % 7;
      const weekStartDate = addDays(start, -offsetToWeekStart + period * rule.interval * 7);
      const weekdays = rule.byDay.length ? rule.byDay.map((d) => d.weekday) : [weekdayOf(start)];
      return [0, 1, 2, 3, 4, 5, 6]
        .map((i) => addDays(weekStartDate, i))
        .filter((date) => weekdays.includes(weekdayOf(date)))
        .filter((date) => !rule.byMonth.length || rule.byMonth.includes(date.month));
    }
    case 'MONTHLY': {
      const monthIndex = start.year * 12 + (start.month - 1) + period * rule.interval;
      const year = Math.floor(monthIndex / 12);
      const month = (monthIndex % 12) + 1;
      if (rule.byMonth.length && !rule.byMonth.includes(month)) return [];
      return daysInMonthMatching(year, month, rule, start);
    }
    case 'YEARLY': {
      const year = start.year + period * rule.interval;
      const months = rule.byMonth.length ? [...rule.byMonth].sort((a, b) => a - b) : [start.month];
      return months.flatMap((month) => daysInMonthMatching(year, month, rule, start));
    }
  }
}

export interface ExpandOptions {
  /** Series start (epoch ms) and its time zone. */
  start: number;
  timeZone?: string;
  /** Only occurrences starting in [windowStart, windowEnd) are returned. */
  windowStart: number;
  windowEnd: number;
  /** Hard cap on returned occurrences. */
  maxOccurrences: number;
}

/** Expand a parsed recurrence into occurrence start times (epoch ms) within a window. */
export function expandRecurrence(recurrence: ParsedRecurrence, options: ExpandOptions): number[] {
  const { rule, exdates } = recurrence;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = timeZoneFormatter(options.timeZone || 'UTC');
  } catch {
    formatter = timeZoneFormatter('UTC');
  }

  const startLocal = toLocal(options.start, formatter);
  const startDate: LocalDate = { year: startLocal.year, month: startLocal.month, day: startLocal.day };
  const startTime: LocalTime = { hour: startLocal.hour, minute: startLocal.minute, second: startLocal.second };

  const occurrences: number[] = [];
  let generated = 0;

  for (let period = 0; period < MAX_PERIODS; period++) {
    const dates = periodDates(rule, startDate, period);
    let passedEnd = false;

    for (const date of dates) {
      if (compareDates(date, startDate) < 0) continue;
      const instant = compareDates(date, startDate) === 0 ? options.start : fromLocal(date, startTime, formatter);

      if (rule.until !== undefined && instant > rule.until) return occurrences;
      if (rule.count !== undefined && generated >= rule.count) return occurrences;
      generated += 1;

      if (instant >= options.windowEnd) {
        passedEnd = true;
        break;
      }
      if (instant >= options.windowStart && !exdates.has(instant)) {
        occurrences.push(instant);
        if (occurrences.length >= options.maxOccurrences) return occurrences;
      }
    }

    if (passedEnd) break;
  }

  return occurrences;
}
