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
  }).map(iso);
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
  assert.equal(expand(['RRULE:FREQ=DAILY'], '2026-01-01T00:00:00Z', 'UTC', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 5).length, 5);
});

test('unsupported rules are not expanded', () => {
  assert.equal(parseRecurrence(['RRULE:FREQ=MONTHLY;BYDAY=MO,TU;BYSETPOS=-1']), null);
  assert.equal(parseRecurrence(['RRULE:FREQ=HOURLY']), null);
  assert.equal(parseRecurrence(['RRULE:FREQ=DAILY', 'RDATE:20261020T000000Z']), null);
  assert.equal(parseRecurrence([]), null);
  assert.equal(parseRecurrence(undefined), null);
});
