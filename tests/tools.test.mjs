import test from 'node:test';
import assert from 'node:assert/strict';
import { registerTools } from '../.test-dist/tools/index.js';
import { createCreateEventTool, createUpdateEventTool } from '../.test-dist/tools/event-crud-tools.js';
import { createCreateMemoTool } from '../.test-dist/tools/memo-tools.js';
import { createGetEventsTool } from '../.test-dist/tools/event-tools.js';
import { createGetHolidaysTool } from '../.test-dist/tools/holiday-tools.js';
import { createGetRecentActivityTool } from '../.test-dist/tools/activity-tools.js';
import { createGetCalendarLabelsTool } from '../.test-dist/tools/calendar-metadata-tools.js';

function makeEvent(overrides = {}) {
  return {
    id: overrides.uuid ?? 'event-1',
    uuid: overrides.uuid ?? 'event-1',
    calendar_id: 123,
    title: 'event',
    all_day: false,
    start_at: 1,
    end_at: 2,
    start_timezone: 'UTC',
    end_timezone: 'UTC',
    category: 1,
    label_id: 1,
    alerts: [],
    recurrences: [],
    attendees: [],
    attachment: null,
    created_at: 1,
    updated_at: 2,
    ...overrides,
  };
}

function parseToolText(result) {
  return JSON.parse(result.content[0].text);
}

test('registerTools exposes baseline plus Wave 1 tools', () => {
  const names = registerTools({}).map((tool) => tool.name).sort();

  assert.deepEqual(names, [
    'add_event_comment',
    'create_event',
    'create_memo',
    'delete_event',
    'delete_event_comment',
    'delete_memo',
    'get_calendar_labels',
    'get_calendar_members',
    'get_calendar_virtual_members',
    'get_events',
    'get_holidays',
    'get_recent_activity',
    'get_updated_events',
    'list_calendars',
    'list_event_comments',
    'list_memos',
    'update_calendar_labels',
    'update_event',
    'update_event_comment',
    'update_memo',
  ].sort());
});

test('create_event passes alerts, recurrences, attendees, files, and virtual attendees through', async () => {
  let captured;
  const tool = createCreateEventTool({
    createEvent: async (calendarId, data) => {
      captured = { calendarId, data };
      return makeEvent({
        uuid: 'created',
        calendar_id: Number(calendarId),
        title: data.title,
        all_day: data.all_day,
        start_at: data.start_at,
        end_at: data.end_at,
        alerts: data.alerts,
        recurrences: data.recurrences,
        attendees: data.attendees,
        attachment: data.attachment,
      });
    },
  });

  const result = await tool.handler({
    calendar_id: 123,
    title: 'private',
    start_at: 1000,
    end_at: 2000,
    alerts: [5, 30],
    recurrences: ['RRULE:FREQ=DAILY;COUNT=2'],
    attendees: [42],
    file_uuids: ['file-1'],
    checklist: [{ title: 'todo', checked: false }],
    virtual_user_attendees: ['virtual-1'],
  });

  assert.equal(captured.calendarId, '123');
  assert.deepEqual(captured.data.alerts, [5, 30]);
  assert.deepEqual(captured.data.recurrences, ['RRULE:FREQ=DAILY;COUNT=2']);
  assert.deepEqual(captured.data.attendees, [42]);
  assert.deepEqual(captured.data.file_uuids, ['file-1']);
  assert.deepEqual(captured.data.attachment.virtual_user_attendees, ['virtual-1']);
  assert.equal(parseToolText(result).event.virtual_user_attendees[0], 'virtual-1');
});

test('update_event passes partial scheduling and attachment fields through', async () => {
  let captured;
  const tool = createUpdateEventTool({
    updateEvent: async (calendarId, eventUuid, data) => {
      captured = { calendarId, eventUuid, data };
      return makeEvent({
        uuid: eventUuid,
        calendar_id: Number(calendarId),
        title: data.title ?? 'unchanged',
        alerts: data.alerts ?? [],
        recurrences: data.recurrences ?? [],
        attendees: data.attendees ?? [],
        attachment: data.attachment ?? null,
      });
    },
  });

  const result = await tool.handler({
    calendar_id: 123,
    event_uuid: 'evt',
    alerts: [],
    recurrences: ['RRULE:FREQ=WEEKLY;COUNT=2'],
    attendees: [1, 2],
    checklist: [],
    virtual_user_attendees: [],
  });

  assert.equal(captured.calendarId, '123');
  assert.equal(captured.eventUuid, 'evt');
  assert.deepEqual(captured.data.alerts, []);
  assert.deepEqual(captured.data.recurrences, ['RRULE:FREQ=WEEKLY;COUNT=2']);
  assert.deepEqual(captured.data.attendees, [1, 2]);
  assert.deepEqual(captured.data.attachment, { checklist: [], virtual_user_attendees: [] });
  assert.equal(parseToolText(result).success, true);
});

test('create_memo wraps input as category=2 memo data with UTC date', async () => {
  let captured;
  const tool = createCreateMemoTool({
    createMemo: async (calendarId, data) => {
      captured = { calendarId, data };
      return makeEvent({
        uuid: 'memo',
        calendar_id: Number(calendarId),
        title: data.title,
        all_day: true,
        category: 2,
        start_at: data.start_at,
        end_at: data.start_at,
        note: data.note,
        attachment: { checklist: data.checklist, virtual_user_attendees: data.virtual_user_attendees },
      });
    },
  });

  const result = await tool.handler({
    calendar_id: 123,
    title: 'memo',
    note: 'body',
    date: '2026-05-25',
    checklist: [{ title: 'memo item', checked: true }],
    virtual_user_attendees: ['v1'],
  });

  assert.equal(captured.calendarId, '123');
  assert.equal(captured.data.start_at, Date.UTC(2026, 4, 25));
  assert.deepEqual(captured.data.checklist, [{ title: 'memo item', checked: true }]);
  assert.equal(parseToolText(result).memo.memo_date, '2026-05-25');
});

test('get_events accepts numeric IDs, filters, and sorts by start time', async () => {
  let requestedId;
  const tool = createGetEventsTool({
    getEventsByCalendar: async (calendarId) => {
      requestedId = calendarId;
      return [
        makeEvent({ uuid: 'late', title: 'Team sync', start_at: 300, end_at: 301, label_id: 3 }),
        makeEvent({ uuid: 'memo', title: 'Team memo', start_at: 50, end_at: 50, category: 2, label_id: 3 }),
        makeEvent({ uuid: 'early', title: 'Lunch', note: 'team lunch', start_at: 100, end_at: 101, label_id: 3 }),
        makeEvent({ uuid: 'other-label', title: 'Team retro', start_at: 200, end_at: 201, label_id: 6 }),
        makeEvent({ uuid: 'too-late', title: 'Team party', start_at: 900, end_at: 901, label_id: 3 }),
      ];
    },
  });

  const result = parseToolText(await tool.handler({
    calendar_id: 123,
    query: 'TEAM',
    label_id: 3,
    include_memos: false,
    start_before: 500,
  }));

  assert.equal(requestedId, '123');
  assert.equal(result.calendar_id, '123');
  assert.deepEqual(result.events.map((event) => event.uuid), ['early', 'late']);
});

test('calendar tools accept string calendar IDs from list_calendars', async () => {
  let requestedId;
  const tool = createGetCalendarLabelsTool({
    getCalendarLabels: async (calendarId) => {
      requestedId = calendarId;
      return [];
    },
  });

  const result = await tool.handler({ calendar_id: '123' });

  assert.equal(result.isError, undefined);
  assert.equal(requestedId, '123');
  assert.equal((await tool.handler({ calendar_id: 'abc' })).isError, true);
});

test('get_holidays returns sorted days and can exclude working-day observances', async () => {
  let captured;
  const tool = createGetHolidaysTool({
    getMemorialDays: async (countries, from, to) => {
      captured = { countries, from: from.toISOString(), to: to.toISOString() };
      return [
        { id: 2, country_iso: 'KR', title: 'Hangul Day', workday: false, start_at: Date.UTC(2026, 9, 9), end_at: Date.UTC(2026, 9, 9) },
        { id: 3, country_iso: 'KR', title: 'Observance', workday: true, start_at: Date.UTC(2026, 9, 5), end_at: Date.UTC(2026, 9, 5) },
        { id: 1, country_iso: 'KR', title: 'Foundation Day', workday: false, start_at: Date.UTC(2026, 9, 3), end_at: Date.UTC(2026, 9, 3) },
      ];
    },
  });

  const result = parseToolText(await tool.handler({
    country_iso: ['kr', 'KR'],
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    days_off_only: true,
  }));

  assert.deepEqual(captured, { countries: ['KR'], from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' });
  assert.deepEqual(result.holidays.map((day) => [day.date, day.title]), [
    ['2026-10-03', 'Foundation Day'],
    ['2026-10-09', 'Hangul Day'],
  ]);
  const tooLong = await tool.handler({ country_iso: ['KR'], start_date: '2026-01-01', end_date: '2029-01-01' });
  assert.equal(tooLong.isError, true);
});

test('get_events expands recurring events within start_before and skips EXDATEs', async () => {
  const series = makeEvent({
    uuid: 'series',
    title: 'Standup',
    start_at: Date.parse('2026-10-13T01:00:00Z'),
    end_at: Date.parse('2026-10-13T01:30:00Z'),
    start_timezone: 'Asia/Seoul',
    recurrences: ['RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=4', 'EXDATE:20261015T010000Z'],
  });
  const exception = makeEvent({
    uuid: 'exception',
    title: 'Standup (moved)',
    start_at: Date.parse('2026-10-15T02:00:00Z'),
    end_at: Date.parse('2026-10-15T02:30:00Z'),
    parent_id: 'series',
  });
  const tool = createGetEventsTool({ getEventsByCalendar: async () => [series, exception] });

  const ranged = parseToolText(await tool.handler({
    calendar_id: '123',
    start_after: Date.parse('2026-10-14T00:00:00Z'),
    start_before: Date.parse('2026-10-23T00:00:00Z'),
  }));
  assert.deepEqual(ranged.events.map((event) => [event.uuid, event.start_at, event.end_at, event.is_recurring_occurrence ?? false]), [
    ['exception', '2026-10-15T02:00:00.000Z', '2026-10-15T02:30:00.000Z', false],
    ['series', '2026-10-20T01:00:00.000Z', '2026-10-20T01:30:00.000Z', true],
    ['series', '2026-10-22T01:00:00.000Z', '2026-10-22T01:30:00.000Z', true],
  ]);
  assert.equal(ranged.events[1].series_start_at, '2026-10-13T01:00:00.000Z');

  const unbounded = parseToolText(await tool.handler({ calendar_id: '123' }));
  assert.deepEqual(unbounded.events.map((event) => event.uuid), ['series', 'exception']);

  const optedOut = parseToolText(await tool.handler({
    calendar_id: '123',
    start_before: Date.parse('2026-10-23T00:00:00Z'),
    expand_recurring: false,
  }));
  assert.deepEqual(optedOut.events.map((event) => event.uuid), ['series', 'exception']);
});

test('get_recent_activity names status codes, joins member names, and filters by since', async () => {
  const tool = createGetRecentActivityTool({
    getLatestEventActivities: async (calendarIds) => {
      assert.deepEqual(calendarIds, ['123']);
      return [
        {
          id: 'evt-1', calendar_id: 123, title: 'Dentist', category: 1, all_day: false,
          start_at: Date.parse('2026-10-02T01:00:00Z'), deactivated_at: null,
          activities: [
            { status: [1], user_id: 7, updated_at: 1000 },
            { status: [2, 3], user_id: 7, updated_at: 3000 },
            { status: [99], user_id: 8, updated_at: 4000 },
          ],
        },
        {
          id: 'memo-1', calendar_id: 123, title: 'Old memo', category: 2, deactivated_at: 2500,
          activities: [{ status: [15], user_id: 8, updated_at: 1500 }],
        },
      ];
    },
    getCalendarMembers: async () => [{ id: 1, user_id: 7, name: 'Alex' }],
  });

  const result = parseToolText(await tool.handler({ calendar_id: 123, since: 2000 }));

  assert.equal(result.total, 1);
  assert.equal(result.events[0].kind, 'event');
  assert.deepEqual(result.events[0].activities.map((activity) => [activity.actions, activity.user_name]), [
    [['other_99'], null],
    [['title_updated', 'date_updated'], 'Alex'],
  ]);

  const all = parseToolText(await tool.handler({ calendar_id: '123' }));
  assert.deepEqual(all.events.map((event) => [event.uuid, event.kind, event.deleted]), [
    ['evt-1', 'event', false],
    ['memo-1', 'memo', true],
  ]);
});
