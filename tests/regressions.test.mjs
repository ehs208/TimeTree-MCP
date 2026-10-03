// Regression tests for session recovery, path-safe IDs, memo/event separation,
// deleted events in get_updated_events, and the update notice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TimeTreeAPIClient } from '../.test-dist/client/api.js';
import { createDeleteEventTool } from '../.test-dist/tools/event-crud-tools.js';
import { createUpdateMemoTool, createDeleteMemoTool } from '../.test-dist/tools/memo-tools.js';
import { createGetEventsTool, createGetUpdatedEventsTool } from '../.test-dist/tools/event-tools.js';
import { createGetCalendarLabelsTool } from '../.test-dist/tools/calendar-metadata-tools.js';
import { SERVER_VERSION } from '../.test-dist/config/config.js';
import { isNewerVersion, fetchNewerVersion } from '../.test-dist/utils/update-check.js';
import { readFileSync } from 'node:fs';

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

function httpError(status) {
  const error = new Error(`HTTP ${status}`);
  error.statusCode = status;
  return error;
}

function timeTreeError(status, code) {
  const error = httpError(status);
  error.response = JSON.stringify({ error: { code, message: 'failed to api request', params: {} } });
  return error;
}

function makeClient(http, auth = {}) {
  return new TimeTreeAPIClient({
    isAuthenticated: () => true,
    authenticate: async () => {},
    getHttpClient: () => http,
    ...auth,
  });
}

test('rejected session (400, code -493) triggers re-authentication and the call succeeds', async () => {
  let authCount = 0;
  let getCount = 0;
  const client = makeClient(
    {
      get: async () => {
        getCount += 1;
        // Server dropped the session: first call 401, after re-login it works.
        // TimeTree reports this as HTTP 400 with error code -493.
        if (authCount === 0) {
          const error = httpError(400);
          error.response = JSON.stringify({ error: { code: -493, message: 'failed to api request' } });
          throw error;
        }
        return { calendars: [{ id: 1, name: 'cal', deactivated_at: null }], chunk: false, since: 0 };
      },
    },
    {
      // Cookie is still in memory, so the local check keeps saying "authenticated".
      isAuthenticated: () => true,
      authenticate: async () => {
        authCount += 1;
      },
    }
  );

  const calendars = await client.getCalendars();
  assert.equal(calendars.length, 1);
  assert.ok(authCount >= 1, 'should have re-authenticated after 401');
  assert.ok(getCount >= 2);
});

test('other 400 errors do not trigger re-authentication', async () => {
  let authCount = 0;
  const client = makeClient(
    {
      get: async () => {
        const error = httpError(400);
        error.response = JSON.stringify({ error: { code: -425 } });
        throw error;
      },
    },
    { authenticate: async () => { authCount += 1; } }
  );

  await assert.rejects(client.getCalendars());
  assert.equal(authCount, 0);
});

// The events endpoint returns deleted events with deactivated_at (verified live);
// the full sync used by get_events omits them.
test('get_updated_events marks deleted events instead of showing them as live', async () => {
  const tool = createGetUpdatedEventsTool({
    getUpdatedEvents: async () => [
      makeEvent({ uuid: 'deleted', title: 'deleted', updated_at: 10, deactivated_at: 10 }),
    ],
  });

  const result = await tool.handler({ calendar_id: '123', updated_after: 1 });
  const [event] = JSON.parse(result.content[0].text).events;
  assert.equal(event.deleted, true);
  assert.equal(event.deleted_at, new Date(10).toISOString());
});

test('delete_event rejects path-traversal event_uuid', async () => {
  const requested = [];
  const client = makeClient({
    delete: async (url) => {
      requested.push(new URL(url).pathname);
      return {};
    },
    get: async () => ({}),
  });
  const tool = createDeleteEventTool(client);

  const result = await tool.handler({
    calendar_id: '123',
    event_uuid: '../../../v2/calendars/999/users/1',
  });

  assert.deepEqual(requested, [], `request escaped to: ${requested.join(', ')}`);
  assert.equal(result.isError, true);
  assert.match(JSON.parse(result.content[0].text).message, /Invalid identifier/);
});

test('update_memo refuses to convert a regular event into a memo', async () => {
  const puts = [];
  const regularEvent = makeEvent({ uuid: 'evt-1', category: 1 });
  const client = makeClient({
    get: async () => ({ event: regularEvent }),
    put: async (url, body) => {
      puts.push(body);
      return { event: { ...regularEvent, ...body } };
    },
  });
  const tool = createUpdateMemoTool(client);

  const result = await tool.handler({ calendar_id: '123', memo_uuid: 'evt-1', title: 'renamed' });

  assert.deepEqual(puts, [], `sent PUT with category=${puts[0]?.category}`);
  assert.match(JSON.parse(result.content[0].text).message, /not a memo/);
});

test('delete_memo refuses to delete a regular event', async () => {
  const deletes = [];
  const regularEvent = makeEvent({ uuid: 'evt-1', category: 1 });
  const client = makeClient({
    get: async () => ({ event: regularEvent }),
    delete: async (url) => {
      deletes.push(url);
      return {};
    },
  });
  const tool = createDeleteMemoTool(client);

  await tool.handler({ calendar_id: '123', memo_uuid: 'evt-1' });

  assert.deepEqual(deletes, [], 'regular event was deleted through delete_memo');
});

test('update_memo still updates real memos', async () => {
  const puts = [];
  const memo = makeEvent({ uuid: 'memo-1', category: 2 });
  const client = makeClient({
    get: async () => ({ event: memo }),
    put: async (url, body) => {
      puts.push(body);
      return { event: { ...memo, ...body } };
    },
  });

  const result = await createUpdateMemoTool(client).handler({ calendar_id: '123', memo_uuid: 'memo-1', title: 'renamed' });

  assert.equal(puts.length, 1);
  assert.equal(JSON.parse(result.content[0].text).success, true);
});

test('concurrent first calls share a single sign-in', async () => {
  let signedIn = false;
  let authCount = 0;
  const client = makeClient(
    { get: async () => ({ calendars: [], chunk: false, since: 0 }) },
    {
      isAuthenticated: () => signedIn,
      authenticate: async () => {
        authCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        signedIn = true;
      },
    }
  );

  await Promise.all([client.getCalendars(), client.getCalendars()]);
  assert.equal(authCount, 1);
});

test('SERVER_VERSION matches package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(SERVER_VERSION, pkg.version);
});

test('isNewerVersion compares x.y.z numerically', () => {
  assert.equal(isNewerVersion('0.10.0', '0.9.9'), true);
  assert.equal(isNewerVersion('0.3.0', '0.3.0'), false);
  assert.equal(isNewerVersion('0.2.9', '0.3.0'), false);
  assert.equal(isNewerVersion('1.0.0', '0.9.0'), true);
});

test('fetchNewerVersion returns the newer version and ignores failures', async () => {
  const respond = (body, ok = true) => async () => ({ ok, json: async () => body });

  assert.equal(await fetchNewerVersion('0.3.0', respond({ version: '0.4.0' })), '0.4.0');
  assert.equal(await fetchNewerVersion('0.3.0', respond({ version: '0.3.0' })), null);
  assert.equal(await fetchNewerVersion('0.3.0', respond({}, false)), null);
  assert.equal(
    await fetchNewerVersion('0.3.0', async () => {
      throw new Error('offline');
    }),
    null
  );
});

test('rejected CSRF token (422, code -1) triggers re-authentication and a retry', async () => {
  let authCount = 0;
  const posts = [];
  const client = makeClient(
    {
      post: async (url, body) => {
        posts.push(body);
        if (authCount === 0) throw timeTreeError(422, -1);
        return { event: makeEvent({ uuid: 'created', title: body.title }) };
      },
    },
    { authenticate: async () => { authCount += 1; } }
  );

  const event = await client.createEvent('123', {
    title: 'retry me', all_day: false, start_at: 1, end_at: 2, start_timezone: 'UTC', end_timezone: 'UTC',
  });
  assert.equal(event.uuid, 'created');
  assert.equal(authCount, 1);
  assert.equal(posts.length, 2);
});

test('unknown calendar (400, code -425) is reported as an invalid calendar', async () => {
  const client = makeClient({ get: async () => { throw timeTreeError(400, -425); } });
  const result = await createGetCalendarLabelsTool(client).handler({ calendar_id: '1' });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Invalid calendar|Calendar not found/);
});

test('delete_event reports a missing event (400, code -403) without sending DELETE', async () => {
  const deletes = [];
  const client = makeClient({
    get: async () => { throw timeTreeError(400, -403); },
    delete: async (url) => { deletes.push(url); return {}; },
  });

  const result = await createDeleteEventTool(client).handler({ calendar_id: '123', event_uuid: 'gone' });
  assert.equal(result.isError, true);
  assert.deepEqual(deletes, []);
  assert.match(result.content[0].text, /not found/i);
});

for (const [label, failure] of [
  ['server error', () => httpError(500)],
  ['timeout', () => new Error('Request timeout after 60000ms')],
  ['unknown calendar', () => timeTreeError(400, -425)],
]) {
  test(`deleteEvent does not resend the DELETE after a ${label}`, async () => {
    let deleteCount = 0;
    const client = makeClient({
      get: async () => ({ event: makeEvent({ uuid: 'event-1' }) }),
      delete: async () => { deleteCount += 1; throw failure(); },
    });

    await assert.rejects(client.deleteEvent('123', 'event-1'));
    assert.equal(deleteCount, 1);
  });
}

test('getUpdatedEvents follows chunked pages', async () => {
  const urls = [];
  const client = makeClient({
    get: async (url) => {
      urls.push(url);
      if (url.endsWith('since=100')) {
        return { chunk: true, since: 200, events: [makeEvent({ uuid: 'a', updated_at: 150 })] };
      }
      return { chunk: false, since: 300, events: [makeEvent({ uuid: 'b', updated_at: 250 })] };
    },
  });

  const events = await client.getUpdatedEvents('123', 100);
  assert.deepEqual(events.map((event) => event.uuid), ['a', 'b']);
  assert.ok(urls[1].endsWith('/calendar/123/events?since=200'));
});

test('event output reads the URL TimeTree stores in the attachment', async () => {
  const tool = createGetEventsTool({
    getEventsByCalendar: async () => [makeEvent({ attachment: { url: 'https://example.com/doc', checklist: [] } })],
  });
  const [event] = JSON.parse((await tool.handler({ calendar_id: '123' })).content[0].text).events;
  assert.equal(event.url, 'https://example.com/doc');
});
