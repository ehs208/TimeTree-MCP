import test from 'node:test';
import assert from 'node:assert/strict';
import { TimeTreeAPIClient } from '../.test-dist/client/api.js';

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
    alerts: [],
    recurrences: [],
    attendees: [],
    ...overrides,
  };
}

function makeClient(http, auth = {}) {
  return new TimeTreeAPIClient({
    isAuthenticated: () => true,
    authenticate: async () => {
      throw new Error('authenticate should not be called in unit tests');
    },
    getHttpClient: () => http,
    getCsrfToken: () => "test-token",
    ...auth,
  });
}

test('deleteEvent checks the event exists, then uses a no-body DELETE', async () => {
  const calls = [];
  const client = makeClient({
    delete: async (url, body, _headers, requiresCsrf) => {
      calls.push({ url, body, requiresCsrf });
      return {};
    },
    get: async () => ({ event: makeEvent({ uuid: 'event-1' }) }),
  });

  await client.deleteEvent('cal-1', 'event-1');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://timetreeapp.com/api/v1/calendar/cal-1/event/event-1');
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[0].requiresCsrf, true);
});

test('deleteEvent falls back to full-event-body DELETE when TimeTree rejects the no-body request', async () => {
  const calls = [];
  let deleteCount = 0;
  const targetEvent = makeEvent({ uuid: 'event-1', title: 'target' });
  const client = makeClient({
    delete: async (url, body, _headers, requiresCsrf) => {
      deleteCount += 1;
      calls.push({ url, body, requiresCsrf });
      if (deleteCount === 1) {
        const error = new Error('bad request');
        error.statusCode = 400;
        throw error;
      }
      return {};
    },
    get: async (url) => {
      calls.push({ url, method: 'GET' });
      return { event: targetEvent };
    },
  });

  await client.deleteEvent('cal-1', 'event-1');

  assert.equal(deleteCount, 2);
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[1].url, 'https://timetreeapp.com/api/v1/calendar/cal-1/event/event-1');
  assert.equal(calls[2].body.uuid, 'event-1');
  assert.equal(calls[2].requiresCsrf, true);
});

test('calendar metadata methods use verified endpoints and merge label updates', async () => {
  const calls = [];
  const client = makeClient({
    get: async (url) => {
      calls.push({ method: 'GET', url });
      if (url.endsWith('/labels')) {
        return {
          calendar_labels: [
            { id: 1, name: 'old', color: 111, default_color: 111 },
            { id: 2, name: 'keep', color: 222, default_color: 222 },
          ],
        };
      }
      if (url.endsWith('/users')) {
        return { calendar_users: [{ id: 10, user_id: 20, name: 'Member', role: 1, deactivated_at: null }] };
      }
      if (url.endsWith('/virtual_users')) {
        return { calendar_virtual_users: [{ id: 'v1', name: 'Virtual', calendar_id: 123, deactivated_at: null }] };
      }
      throw new Error(`unexpected GET ${url}`);
    },
    put: async (url, body, _headers, requiresCsrf) => {
      calls.push({ method: 'PUT', url, body, requiresCsrf });
      return { calendar_labels: body.calendar_labels };
    },
  });

  const labels = await client.getCalendarLabels('123');
  const updated = await client.updateCalendarLabels('123', [{ id: 1, name: 'new' }]);
  const members = await client.getCalendarMembers('123');
  const virtualUsers = await client.getCalendarVirtualUsers('123');

  assert.equal(labels.length, 2);
  assert.deepEqual(updated, [
    { id: 1, name: 'new', color: 111 },
    { id: 2, name: 'keep', color: 222 },
  ]);
  assert.equal(members[0].user_id, 20);
  assert.equal(virtualUsers[0].id, 'v1');
  assert.equal(calls.find((call) => call.method === 'PUT').requiresCsrf, true);
  assert.ok(calls.some((call) => call.url === 'https://timetreeapp.com/api/v2/calendars/123/users'));
  assert.ok(calls.some((call) => call.url === 'https://timetreeapp.com/api/v1/calendars/123/virtual_users'));
});

test('event comment methods use activity endpoints and filter comment activities', async () => {
  const calls = [];
  const client = makeClient({
    post: async (url, body, _headers, requiresCsrf) => {
      calls.push({ method: 'POST', url, body, requiresCsrf });
      return { event_activity: { id: body.id, type: 0, event_id: 'evt', calendar_id: 123, attachment: body.attachment } };
    },
    get: async (url) => {
      calls.push({ method: 'GET', url });
      return {
        event_activities: [
          { id: 'system', type: 1, attachment: { items: [1] } },
          { id: 'comment', type: 0, attachment: { content: 'hello' }, deactivated_at: null },
          { id: 'deleted', type: 0, attachment: { content: 'gone' }, deactivated_at: 1 },
        ],
        since: 1,
      };
    },
    put: async (url, body, _headers, requiresCsrf) => {
      calls.push({ method: 'PUT', url, body, requiresCsrf });
      return { event_activity: { id: 'comment', type: 0, event_id: 'evt', calendar_id: 123, attachment: body.attachment } };
    },
    delete: async (url, body, _headers, requiresCsrf) => {
      calls.push({ method: 'DELETE', url, body, requiresCsrf });
      return {};
    },
  });

  const added = await client.addEventComment('123', 'evt', 'hello');
  const comments = await client.listEventComments('123', 'evt');
  const updated = await client.updateEventComment('123', 'evt', 'comment', 'updated');
  await client.deleteEventComment('123', 'evt', 'comment');

  assert.equal(added.attachment.content, 'hello');
  assert.equal(comments.length, 1);
  assert.equal(comments[0].id, 'comment');
  assert.equal(updated.attachment.content, 'updated');
  assert.ok(calls.every((call) => call.method === 'GET' || call.requiresCsrf === true));
  assert.ok(calls.some((call) => call.url === 'https://timetreeapp.com/api/v1/calendar/123/event/evt/activities'));
  assert.ok(calls.some((call) => call.url === 'https://timetreeapp.com/api/v1/calendar/123/event/evt/activity/comment'));
});

test('createCalendar uses v2 CSRF-protected creation without invitations, with rate limiting', async () => {
  const calls = [];
  const client = makeClient({post: async (...args) => {
    calls.push(args);
    return { calendar: {id: 456, name: 'Private', alias_code: 'new-alias'} };
  }});
  let throttled = 0;
  const retry = client.rateLimiter.executeWithRetry.bind(client.rateLimiter);
  client.rateLimiter.executeWithRetry = (...args) => { throttled++; return retry(...args); };
  assert.equal((await client.createCalendar(' Private ', 'lover')).id, 456);
  assert.equal(throttled, 1);
  assert.deepEqual(calls, [['https://timetreeapp.com/api/v2/calendars',
    {name: 'Private', purpose: 'lover'}, undefined, true]]);
  let count = 0;
  const failing = makeClient({post: async () => {count++; throw new Error('timeout');}});
  await assert.rejects(failing.createCalendar('Private', 'private'));
  assert.equal(count, 1);
});

test('createEvent stores url in attachment and sends an empty checklist as null', async () => {
  const calls = [];
  const client = makeClient({
    post: async (url, body) => {
      calls.push({ url, body });
      return { event: makeEvent({ uuid: 'created' }) };
    },
  });

  await client.createEvent('cal-1', {
    title: 'event',
    all_day: false,
    start_at: 1,
    end_at: 2,
    url: 'https://example.com',
    attachment: { checklist: [] },
  });

  assert.equal('url' in calls[0].body, false);
  assert.deepEqual(calls[0].body.attachment, { checklist: null, url: 'https://example.com' });
});

test('updateEvent merges current attachment fields before sending attachment changes', async () => {
  const calls = [];
  const client = makeClient({
    get: async (url) => {
      calls.push({ method: 'GET', url });
      return {
        event: makeEvent({
          uuid: 'evt',
          attachment: { url: 'https://example.com/keep', checklist: [{ title: 'a', checked: false }] },
        }),
      };
    },
    put: async (url, body) => {
      calls.push({ method: 'PUT', url, body });
      return { event: makeEvent({ uuid: 'evt' }) };
    },
  });

  await client.updateEvent('cal-1', 'evt', { attachment: { checklist: [] } });

  assert.equal(calls[0].url, 'https://timetreeapp.com/api/v1/calendar/cal-1/event/evt');
  assert.deepEqual(calls[1].body.attachment, { url: 'https://example.com/keep', checklist: null });
});

test('updateEvent without attachment changes does not fetch the current event', async () => {
  const calls = [];
  const client = makeClient({
    get: async () => {
      throw new Error('current event should not be fetched');
    },
    put: async (url, body) => {
      calls.push({ url, body });
      return { event: makeEvent({ uuid: 'evt' }) };
    },
  });

  await client.updateEvent('cal-1', 'evt', { title: 'renamed' });

  assert.deepEqual(calls[0].body, { title: 'renamed' });
});

test('getMemorialDays queries v2 memorial days and drops deactivated entries', async () => {
  let requested;
  const client = makeClient({
    get: async (url) => {
      requested = url;
      return {
        memorialdays: [
          { id: 1, country_iso: 'KR', title: 'active', workday: false, start_at: 10, end_at: 10, deactivated_at: null },
          { id: 2, country_iso: 'KR', title: 'removed', workday: false, start_at: 20, end_at: 20, deactivated_at: 5 },
        ],
      };
    },
  });

  const days = await client.getMemorialDays(['KR', 'JP'], new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'));

  const url = new URL(requested);
  assert.equal(url.pathname, '/api/v2/memorialdays');
  assert.deepEqual(url.searchParams.getAll('country_iso[]'), ['KR', 'JP']);
  assert.equal(url.searchParams.get('from'), '2026-10-01T00:00:00.000Z');
  assert.deepEqual(days.map((day) => day.title), ['active']);
});

test('getLatestEventActivities queries the latest activity feed for calendars', async () => {
  let requested;
  const client = makeClient({
    get: async (url) => {
      requested = url;
      return { events: [{ id: 'evt', calendar_id: 123, title: 't', activities: [{ status: [1], user_id: 1, updated_at: 5 }] }] };
    },
  });

  const events = await client.getLatestEventActivities(['123']);

  const url = new URL(requested);
  assert.equal(url.pathname, '/api/v1/event_activities/latest');
  assert.deepEqual(url.searchParams.getAll('calendar_ids[]'), ['123']);
  assert.deepEqual(events[0].activities[0].status, [1]);
});

test('createCalendar retries a rejected 429 request but not timeouts or 5xx', async () => {
  let count = 0;
  const limited = makeClient({ post: async () => {
    if (++count === 1) throw Object.assign(new Error('rate limited'), {statusCode: 429});
    return {calendar: {id: 456, name: 'Sample', alias_code: 'sample'}};
  }});
  await limited.createCalendar('Sample', 'work');
  assert.equal(count, 2);
  for (const error of [new Error('timeout'), Object.assign(new Error('server failure'), {statusCode: 500})]) {
    let requests = 0;
    const client = makeClient({post: async () => {requests++; throw error;}});
    await assert.rejects(client.createCalendar('Sample', 'work'));
    assert.equal(requests, 1);
  }
});

test('createCalendar maps 403 without leaking the upstream error', async () => {
  const client = makeClient({post: async () => {throw Object.assign(new Error('upstream detail'), {statusCode: 403});}});
  await assert.rejects(client.createCalendar('Sample', 'work'), error =>
    error.name === 'TimeTreeAPIError' && error.statusCode === 403 && !error.message.includes('upstream detail'));
});

test('createCalendar never retries 5xx carrying session or CSRF error codes', async () => {
  for (const statusCode of [500, 502, 503, 504]) {
    for (const code of [-493, -1]) {
      let requests = 0;
      let signIns = 0;
      const error = Object.assign(new Error('synthetic server failure'), {
        statusCode, response: JSON.stringify({error: {code}}),
      });
      const client = makeClient({post: async () => {
        requests++;
        if (requests === 1) throw error;
        return {calendar: {id: 456, name: 'Sample'}};
      }}, {authenticate: async () => {signIns++;}});

      await assert.rejects(client.createCalendar('Sample', 'work'), thrown => thrown === error);
      assert.equal(requests, 1, `HTTP ${statusCode}, code ${code} was retried`);
      assert.equal(signIns, 0);
    }
  }
});

test('createCalendar still recovers rejected authentication once', async () => {
  for (const [statusCode, code] of [[401, undefined], [400, -493], [422, -1]]) {
    let requests = 0;
    let signIns = 0;
    const client = makeClient({post: async () => {
      requests++;
      if (requests === 1) throw Object.assign(new Error('synthetic auth rejection'), {
        statusCode, response: JSON.stringify({error: {code}}),
      });
      return {calendar: {id: 456, name: 'Sample'}};
    }}, {authenticate: async () => {signIns++;}});

    assert.equal((await client.createCalendar('Sample', 'work')).id, 456);
    assert.equal(requests, 2);
    assert.equal(signIns, 1);
  }
});
