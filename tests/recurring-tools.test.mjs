import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeleteEventOccurrenceTool,
  createUpdateEventOccurrenceTool,
} from '../.test-dist/tools/recurring-event-tools.js';
import { createCopyEventTool } from '../.test-dist/tools/event-crud-tools.js';
import {
  createCreateVirtualMemberTool,
  createUpdateVirtualMemberTool,
} from '../.test-dist/tools/calendar-metadata-tools.js';
import { TimeTreeAPIClient } from '../.test-dist/client/api.js';

const HOUR = 60 * 60 * 1000;
const OCT20 = Date.parse('2026-10-20T01:00:00Z'); // 10:00 in Seoul

/** Daily 10:00-11:00 KST series, 4 times from Oct 20, as created in the web app. */
function series(overrides = {}) {
  return {
    id: 'series',
    uuid: 'series',
    calendar_id: 123,
    title: 'Standup',
    all_day: false,
    start_at: OCT20,
    end_at: OCT20 + HOUR,
    start_timezone: 'Asia/Seoul',
    end_timezone: 'Asia/Seoul',
    category: 1,
    label_id: 1,
    note: 'daily',
    attendees: [7],
    alerts: [10],
    recurrences: ['RRULE:FREQ=DAILY;COUNT=4'],
    attachment: { checklist: [{ title: 'agenda', checked: false }], virtual_user_attendees: ['42'] },
    ...overrides,
  };
}

/** Records calls; individual methods can be overridden. */
function fakeClient(overrides = {}) {
  const calls = [];
  const client = {
    calls,
    getEvent: async (calendarId, uuid) => {
      calls.push(['getEvent', calendarId, uuid]);
      return series();
    },
    createEvent: async (calendarId, data) => {
      calls.push(['createEvent', calendarId, data]);
      return { ...series(), ...data, id: 'created', uuid: 'created' };
    },
    updateEvent: async (calendarId, uuid, data) => {
      calls.push(['updateEvent', calendarId, uuid, data]);
      return { ...series(), ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) };
    },
    deleteEvent: async (calendarId, uuid) => {
      calls.push(['deleteEvent', calendarId, uuid]);
    },
    ...overrides,
  };
  return client;
}

const parse = (result) => JSON.parse(result.content[0].text);

test('delete_event_occurrence "this" adds the occurrence to EXDATE without notifying', async () => {
  const client = fakeClient();
  const result = parse(await createDeleteEventOccurrenceTool(client).handler({
    calendar_id: '123', event_uuid: 'series', occurrence_start_at: '2026-10-21T01:00:00.000Z',
  }));

  assert.deepEqual(client.calls[1], ['updateEvent', '123', 'series', {
    recurrences: ['RRULE:FREQ=DAILY;COUNT=4', 'EXDATE:20261021T010000Z'],
    silent: true,
  }]);
  assert.equal(result.series_deleted, false);
});

test('delete_event_occurrence "this_and_following" ends the series on the previous day', async () => {
  const client = fakeClient();
  await createDeleteEventOccurrenceTool(client).handler({
    calendar_id: 123, event_uuid: 'series', occurrence_start_at: Date.parse('2026-10-22T01:00:00Z'), scope: 'this_and_following',
  });

  assert.deepEqual(client.calls[1][3].recurrences, ['RRULE:FREQ=DAILY;UNTIL=20261021']);
});

test('delete_event_occurrence from the first occurrence deletes the whole series', async () => {
  const client = fakeClient();
  const result = parse(await createDeleteEventOccurrenceTool(client).handler({
    calendar_id: 123, event_uuid: 'series', occurrence_start_at: OCT20, scope: 'this_and_following',
  }));

  assert.deepEqual(client.calls[1], ['deleteEvent', '123', 'series']);
  assert.equal(result.series_deleted, true);
});

test('occurrence tools reject times that are not occurrences and non-recurring events', async () => {
  const offRule = await createDeleteEventOccurrenceTool(fakeClient()).handler({
    calendar_id: 123, event_uuid: 'series', occurrence_start_at: '2026-10-21T02:00:00Z',
  });
  assert.equal(offRule.isError, true);
  assert.match(parse(offRule).message, /not an occurrence/);

  const single = await createUpdateEventOccurrenceTool(fakeClient({
    getEvent: async () => series({ recurrences: [] }),
  })).handler({ calendar_id: 123, event_uuid: 'series', occurrence_start_at: OCT20, title: 'x' });
  assert.equal(single.isError, true);
  assert.match(parse(single).message, /not a recurring event/);

  const noChange = await createUpdateEventOccurrenceTool(fakeClient()).handler({
    calendar_id: 123, event_uuid: 'series', occurrence_start_at: OCT20,
  });
  assert.equal(noChange.isError, true);
});

test('update_event_occurrence "this" creates a linked event with the series fields, then excludes the occurrence', async () => {
  const client = fakeClient();
  const at = Date.parse('2026-10-21T01:00:00Z');
  const result = parse(await createUpdateEventOccurrenceTool(client).handler({
    calendar_id: '123', event_uuid: 'series', occurrence_start_at: at, start_at: at + 2 * HOUR, title: 'Moved',
  }));

  const [, , created] = client.calls[1];
  assert.equal(created.parent_id, 'series');
  assert.equal(created.title, 'Moved');
  assert.equal(created.start_at, at + 2 * HOUR);
  assert.equal(created.end_at, at + 3 * HOUR);
  assert.equal(created.note, 'daily');
  assert.deepEqual(created.attendees, [7]);
  assert.deepEqual(created.recurrences, []);
  assert.deepEqual(created.attachment.checklist, [{ title: 'agenda', checked: false }]);
  assert.deepEqual(client.calls[2][3].recurrences, ['RRULE:FREQ=DAILY;COUNT=4', 'EXDATE:20261021T010000Z']);
  assert.equal(result.result, 'occurrence_event_created');
});

test('update_event_occurrence removes the created event when excluding the occurrence fails', async () => {
  const client = fakeClient({
    updateEvent: async () => {
      throw new Error('server error');
    },
  });
  const result = await createUpdateEventOccurrenceTool(client).handler({
    calendar_id: 123, event_uuid: 'series', occurrence_start_at: '2026-10-21T01:00:00Z', title: 'Moved',
  });

  assert.equal(result.isError, true);
  assert.deepEqual(client.calls.at(-1), ['deleteEvent', '123', 'created']);
});

test('update_event_occurrence "this_and_following" starts a new series with the remaining count', async () => {
  const client = fakeClient();
  const at = Date.parse('2026-10-22T01:00:00Z');
  const result = parse(await createUpdateEventOccurrenceTool(client).handler({
    calendar_id: 123, event_uuid: 'series', occurrence_start_at: at, scope: 'this_and_following', label_id: 6,
  }));

  const [, , created] = client.calls[1];
  assert.equal(created.start_at, at);
  assert.equal(created.label_id, 6);
  assert.equal(created.parent_id, undefined);
  assert.deepEqual(created.recurrences, ['RRULE:FREQ=DAILY;COUNT=2']);
  assert.deepEqual(client.calls[2][3].recurrences, ['RRULE:FREQ=DAILY;UNTIL=20261021']);
  assert.equal(result.result, 'new_series_created');
});

test('update_event_occurrence "this_and_following" from the first occurrence updates the series', async () => {
  const client = fakeClient();
  const result = parse(await createUpdateEventOccurrenceTool(client).handler({
    calendar_id: 123, event_uuid: 'series', occurrence_start_at: OCT20, scope: 'this_and_following',
    start_at: OCT20 + HOUR,
  }));

  assert.equal(client.calls[1][0], 'updateEvent');
  assert.equal(client.calls[1][3].start_at, OCT20 + HOUR);
  assert.equal(client.calls[1][3].end_at, OCT20 + 2 * HOUR);
  assert.equal(result.result, 'whole_series_updated');
});

test('copy_event copies like the web app: copy=true, no parent, no recurrence', async () => {
  const client = fakeClient();
  const start = Date.parse('2026-11-02T01:00:00Z');
  await createCopyEventTool(client).handler({ calendar_id: 123, event_uuid: 'series', start_at: start });

  const [, calendarId, created] = client.calls[1];
  assert.equal(calendarId, '123');
  assert.equal(created.copy, true);
  assert.equal(created.parent_id, undefined);
  assert.deepEqual(created.recurrences, []);
  assert.equal(created.end_at, start + HOUR);
  assert.deepEqual(created.attendees, [7]);
  assert.deepEqual(created.attachment.virtual_user_attendees, ['42']);
});

test('copy_event into another calendar drops attendees that belong to the source calendar', async () => {
  const client = fakeClient();
  await createCopyEventTool(client).handler({
    calendar_id: 123, event_uuid: 'series', start_at: OCT20, target_calendar_id: '456',
  });

  const [, calendarId, created] = client.calls[1];
  assert.equal(calendarId, '456');
  assert.deepEqual(created.attendees, []);
  assert.equal(created.attachment.virtual_user_attendees, undefined);
  assert.deepEqual(created.attachment.checklist, [{ title: 'agenda', checked: false }]);
});

test('virtual member tools map type to account_type and address updates by uuid', async () => {
  const calls = [];
  const member = { id: '42', uuid: 'vm-uuid', name: 'Kid', account_type: 'child' };
  const client = {
    createVirtualUser: async (calendarId, input) => {
      calls.push(['create', calendarId, input]);
      return member;
    },
    updateVirtualUser: async (calendarId, uuid, input) => {
      calls.push(['update', calendarId, uuid, input]);
      return member;
    },
  };

  const created = parse(await createCreateVirtualMemberTool(client).handler({
    calendar_id: '123', name: 'Kid', type: 'child', birthday: '2020-05-01',
  }));
  assert.deepEqual(calls[0], ['create', '123', { name: 'Kid', account_type: 'child', birthday: '2020-05-01' }]);
  assert.equal(created.virtual_member.uuid, 'vm-uuid');
  assert.equal(created.virtual_member.type, 'child');

  await createUpdateVirtualMemberTool(client).handler({ calendar_id: 123, virtual_member_uuid: 'vm-uuid', one_word: 'eldest' });
  assert.deepEqual(calls[1], ['update', '123', 'vm-uuid', { one_word: 'eldest' }]);

  const badBirthday = await createCreateVirtualMemberTool(client).handler({ calendar_id: 123, name: 'Kid', birthday: '5/1/2020' });
  assert.equal(badBirthday.isError, true);
  const nothing = await createUpdateVirtualMemberTool(client).handler({ calendar_id: 123, virtual_member_uuid: 'vm-uuid' });
  assert.equal(nothing.isError, true);
});

function makeClient(http) {
  return new TimeTreeAPIClient({
    isAuthenticated: () => true,
    authenticate: async () => {
      throw new Error('authenticate should not be called in unit tests');
    },
    getHttpClient: () => http,
    getCsrfToken: () => 'test-token',
  });
}

test('createVirtualUser posts defaults and refuses an 11th member', async () => {
  const posts = [];
  let members = [{ id: 1, uuid: 'a' }];
  const client = makeClient({
    get: async () => ({ calendar_virtual_users: members }),
    post: async (url, body, _headers, requiresCsrf) => {
      posts.push({ url, body, requiresCsrf });
      return { calendar_virtual_user: { id: 2, uuid: 'b', ...body } };
    },
  });

  const created = await client.createVirtualUser('123', { name: 'Kid' });
  assert.equal(posts[0].url, 'https://timetreeapp.com/api/v1/calendars/123/virtual_users');
  assert.deepEqual(posts[0].body, { account_type: 'other', one_word: '', name: 'Kid' });
  assert.equal(posts[0].requiresCsrf, true);
  assert.equal(created.uuid, 'b');

  members = Array.from({ length: 10 }, (_, i) => ({ id: i, uuid: `m${i}` }));
  await assert.rejects(client.createVirtualUser('123', { name: 'Eleventh' }), /at most 10/);
  assert.equal(posts.length, 1);
});

test('updateVirtualUser resends current fields, since TimeTree clears omitted ones', async () => {
  // Observed: a PUT without one_word/birthday/shows_birthday clears them (name and type are kept).
  const puts = [];
  const client = makeClient({
    get: async () => ({
      calendar_virtual_users: [
        { id: '1', uuid: 'vm-uuid', name: 'Kid', account_type: 'child', one_word: 'eldest', birthday: '2020-05-01', shows_birthday: true },
      ],
    }),
    put: async (url, body) => {
      puts.push(body);
      return { calendar_virtual_user: { id: '1', uuid: 'vm-uuid', ...body } };
    },
  });

  await client.updateVirtualUser('123', 'vm-uuid', { name: 'Renamed' });
  assert.deepEqual(puts[0], {
    name: 'Renamed', account_type: 'child', one_word: 'eldest', birthday: '2020-05-01', shows_birthday: true,
  });

  await assert.rejects(client.updateVirtualUser('123', 'missing', { name: 'x' }), (error) => error.statusCode === 404);
});

test('virtual user update and delete use the uuid path and report a missing member', async () => {
  const requests = [];
  const notFound = Object.assign(new Error('bad request'), {
    statusCode: 400,
    response: JSON.stringify({ error: { code: -403 } }),
  });
  const client = makeClient({
    get: async () => ({ calendar_virtual_users: [{ id: '2', uuid: 'vm-uuid', name: 'Kid' }] }),
    put: async (url, body) => {
      requests.push(['PUT', url, body]);
      return { calendar_virtual_user: { id: 2, uuid: 'vm-uuid', name: body.name } };
    },
    delete: async (url) => {
      requests.push(['DELETE', url]);
      throw notFound;
    },
  });

  await client.updateVirtualUser('123', 'vm-uuid', { name: 'Renamed' });
  assert.deepEqual(requests[0][1], 'https://timetreeapp.com/api/v1/calendars/123/virtual_users/vm-uuid');
  assert.equal(requests[0][2].name, 'Renamed');

  await assert.rejects(client.deleteVirtualUser('123', 'vm-uuid'), (error) => error.statusCode === 404);
  assert.equal(requests[1][1], 'https://timetreeapp.com/api/v1/calendars/123/virtual_users/vm-uuid');
});
