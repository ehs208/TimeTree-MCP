import test from 'node:test';
import assert from 'node:assert/strict';
import { expandRecurrence, parseRecurrence } from '../.test-dist/utils/recurrence.js';

const iso = (ms) => new Date(ms).toISOString();

function expand(lines, start, timeZone, windowStart, windowEnd, maxOccurrences = 100) {
  const parsed = parseRecurrence(lines);
  assert.ok(parsed, `expected ${lines.join(' ')} to parse`);
  return expandRecurrence(parsed, {
    start: Date.parse(start),
    timeZone,
    windowStart: Date.parse(windowStart),
    windowEnd: Date.parse(windowEnd),
    maxOccurrences,
  }).occurrences.map(iso);
}

test('weekly BYDAY with COUNT and EXDATE matches the TimeTree web app', () => {
  // Observed: "Weekly Tuesday, Thursday, 4 times" starting Tue 2026-10-13 10:00 KST,
  // with the Thursday occurrence edited separately (EXDATE in UTC basic format).
  const occurrences = expand(
    ['RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4', 'EXDATE:20261015T010000Z'],
    '2026-10-13T01:00:00Z',
    'Asia/Seoul',
    '2026-10-01T00:00:00Z',
    '2026-12-01T00:00:00Z'
  );

  // EXDATE removes an occurrence but still counts toward COUNT.
  assert.deepEqual(occurrences, ['2026-10-13T01:00:00.000Z', '2026-10-20T01:00:00.000Z', '2026-10-22T01:00:00.000Z']);
});

test('all-day daily series honors date EXDATE', () => {
  const occurrences = expand(
    ['RRULE:FREQ=DAILY;COUNT=2', 'EXDATE:20261014T000000Z'],
    '2026-10-13T00:00:00Z',
    'UTC',
    '2026-10-01T00:00:00Z',
    '2026-11-01T00:00:00Z'
  );

  assert.deepEqual(occurrences, ['2026-10-13T00:00:00.000Z']);
});

test('weekly series keeps local weekday across the date line', () => {
  // Monday 08:00 in Seoul is Sunday 23:00 UTC.
  const occurrences = expand(
    ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
    '2026-10-11T23:00:00Z',
    'Asia/Seoul',
    '2026-10-01T00:00:00Z',
    '2026-10-27T00:00:00Z'
  );

  assert.deepEqual(occurrences, ['2026-10-11T23:00:00.000Z', '2026-10-18T23:00:00.000Z', '2026-10-25T23:00:00.000Z']);
});

test('local wall-clock time is preserved across a DST change', () => {
  // 09:00 in New York: EDT (UTC-4) until Nov 1 2026, then EST (UTC-5).
  const occurrences = expand(
    ['RRULE:FREQ=WEEKLY;COUNT=3'],
    '2026-10-26T13:00:00Z',
    'America/New_York',
    '2026-10-01T00:00:00Z',
    '2026-12-01T00:00:00Z'
  );

  assert.deepEqual(occurrences, ['2026-10-26T13:00:00.000Z', '2026-11-02T14:00:00.000Z', '2026-11-09T14:00:00.000Z']);
});

test('monthly rules support last weekday and skip months without the start day', () => {
  assert.deepEqual(
    expand(['RRULE:FREQ=MONTHLY;BYDAY=-1FR;COUNT=3'], '2026-10-30T00:00:00Z', 'UTC', '2026-10-01T00:00:00Z', '2027-06-01T00:00:00Z'),
    ['2026-10-30T00:00:00.000Z', '2026-11-27T00:00:00.000Z', '2026-12-25T00:00:00.000Z']
  );
  assert.deepEqual(
    expand(['RRULE:FREQ=MONTHLY'], '2026-10-31T00:00:00Z', 'UTC', '2026-10-01T00:00:00Z', '2027-02-01T00:00:00Z'),
    ['2026-10-31T00:00:00.000Z', '2026-12-31T00:00:00.000Z', '2027-01-31T00:00:00.000Z']
  );
});

test('INTERVAL, UNTIL (inclusive), and yearly rules', () => {
  assert.deepEqual(
    expand(['RRULE:FREQ=DAILY;INTERVAL=2;UNTIL=20261005T000000Z'], '2026-10-01T00:00:00Z', 'UTC', '2026-09-01T00:00:00Z', '2026-12-01T00:00:00Z'),
    ['2026-10-01T00:00:00.000Z', '2026-10-03T00:00:00.000Z', '2026-10-05T00:00:00.000Z']
  );
  assert.deepEqual(
    expand(['RRULE:FREQ=YEARLY'], '2024-02-29T00:00:00Z', 'UTC', '2024-01-01T00:00:00Z', '2029-01-01T00:00:00Z'),
    ['2024-02-29T00:00:00.000Z', '2028-02-29T00:00:00.000Z']
  );
});

test('window bounds and the occurrence cap are applied', () => {
  assert.deepEqual(
    expand(['RRULE:FREQ=DAILY'], '2026-01-01T00:00:00Z', 'UTC', '2026-10-10T00:00:00Z', '2026-10-13T00:00:00Z'),
    ['2026-10-10T00:00:00.000Z', '2026-10-11T00:00:00.000Z', '2026-10-12T00:00:00.000Z']
  );
  const capped = expandRecurrence(parseRecurrence(['RRULE:FREQ=DAILY']), {
    start: Date.parse('2026-01-01T00:00:00Z'),
    timeZone: 'UTC',
    windowStart: Date.parse('2026-01-01T00:00:00Z'),
    windowEnd: Date.parse('2027-01-01T00:00:00Z'),
    maxOccurrences: 5,
  });
  assert.equal(capped.occurrences.length, 5);
  assert.equal(capped.truncated, true);
  const exact = expandRecurrence(parseRecurrence(['RRULE:FREQ=DAILY;COUNT=5']), {
    start: Date.parse('2026-01-01T00:00:00Z'),
    timeZone: 'UTC',
    windowStart: Date.parse('2026-01-01T00:00:00Z'),
    windowEnd: Date.parse('2027-01-01T00:00:00Z'),
    maxOccurrences: 5,
  });
  assert.equal(exact.truncated, false);
});

test('daily rules honor BYDAY and BYMONTHDAY filters', () => {
  // Weekdays only, starting Friday 2026-10-02: weekends are skipped and do not consume COUNT.
  assert.deepEqual(
    expand(['RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=3'], '2026-10-02T00:00:00Z', 'UTC', '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z'),
    ['2026-10-02T00:00:00.000Z', '2026-10-05T00:00:00.000Z', '2026-10-06T00:00:00.000Z']
  );
  assert.deepEqual(
    expand(['RRULE:FREQ=DAILY;BYMONTHDAY=1,-1;COUNT=3'], '2026-10-01T00:00:00Z', 'UTC', '2026-10-01T00:00:00Z', '2027-01-01T00:00:00Z'),
    ['2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z', '2026-11-01T00:00:00.000Z']
  );
});

test('yearly BYDAY or BYMONTHDAY without BYMONTH spans the whole year', () => {
  assert.deepEqual(
    expand(['RRULE:FREQ=YEARLY;BYMONTHDAY=15;COUNT=3'], '2026-10-15T00:00:00Z', 'UTC', '2026-01-01T00:00:00Z', '2028-01-01T00:00:00Z'),
    ['2026-10-15T00:00:00.000Z', '2026-11-15T00:00:00.000Z', '2026-12-15T00:00:00.000Z']
  );
  // Year-scoped ordinals are not supported, so the event falls back to unexpanded.
  assert.equal(parseRecurrence(['RRULE:FREQ=YEARLY;BYDAY=1MO']), null);
  assert.ok(parseRecurrence(['RRULE:FREQ=YEARLY;BYMONTH=5;BYDAY=2SU']));
});

test('DST gaps shift forward and ambiguous times use the first occurrence', () => {
  // 02:30 does not exist in New York on 2026-03-08; RFC 5545 interprets it with the
  // pre-gap offset (EST), which is 03:30 EDT.
  assert.deepEqual(
    expand(['RRULE:FREQ=WEEKLY;COUNT=3'], '2026-03-01T07:30:00Z', 'America/New_York', '2026-02-01T00:00:00Z', '2026-04-01T00:00:00Z'),
    ['2026-03-01T07:30:00.000Z', '2026-03-08T07:30:00.000Z', '2026-03-15T06:30:00.000Z']
  );
  // 01:30 happens twice in New York on 2026-11-01; use the first (EDT).
  assert.deepEqual(
    expand(['RRULE:FREQ=WEEKLY;COUNT=2'], '2026-10-25T05:30:00Z', 'America/New_York', '2026-10-01T00:00:00Z', '2026-12-01T00:00:00Z'),
    ['2026-10-25T05:30:00.000Z', '2026-11-01T05:30:00.000Z']
  );
});

test('unsupported rules are not expanded', () => {
  assert.equal(parseRecurrence(['RRULE:FREQ=MONTHLY;BYDAY=MO,TU;BYSETPOS=-1']), null);
  assert.equal(parseRecurrence(['RRULE:FREQ=HOURLY']), null);
  assert.equal(parseRecurrence(['RRULE:FREQ=WEEKLY;BYMONTHDAY=1']), null);
  assert.equal(parseRecurrence(['RRULE:FREQ=DAILY', 'RDATE:20261020T000000Z']), null);
  assert.equal(parseRecurrence([]), null);
  assert.equal(parseRecurrence(undefined), null);
});
