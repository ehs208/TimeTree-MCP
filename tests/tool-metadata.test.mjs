import test from 'node:test';
import assert from 'node:assert/strict';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { registerTools, toolResult } from '../.test-dist/tools/index.js';

const validator = new AjvJsonSchemaValidator();

const event = (overrides = {}) => ({
  id: 'evt-1',
  uuid: 'evt-1',
  calendar_id: 123,
  title: 'Standup',
  all_day: false,
  start_at: Date.parse('2026-10-20T01:00:00Z'),
  end_at: Date.parse('2026-10-20T02:00:00Z'),
  start_timezone: 'Asia/Seoul',
  end_timezone: 'Asia/Seoul',
  category: 1,
  label_id: 1,
  attendees: [7],
  alerts: [10],
  recurrences: ['RRULE:FREQ=DAILY;COUNT=3'],
  attachment: { checklist: [{ title: 'agenda', checked: false }], virtual_user_attendees: [] },
  created_at: 1,
  updated_at: 2,
  ...overrides,
});
const memo = event({ uuid: 'memo-1', id: 'memo-1', category: 2, all_day: true, recurrences: [] });
const comment = {
  id: 'c-1', event_id: 'evt-1', calendar_id: 123, type: 0, author_id: 7, author_type: 'user',
  attachment: { content: 'hello' }, created_at: 1, updated_at: 2,
};
const virtualMember = {
  id: '42', uuid: 'vm-uuid', name: 'Kid', account_type: 'child', one_word: '', birthday: null,
  shows_birthday: false, calendar_id: 123, created_at: 1, updated_at: 2,
};
const label = { id: 1, name: 'Work', color: 1, default_color: 1, order: 1 };

const defined = (data) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

/** A fake client answering every method with data shaped like TimeTree's responses. */
const fakeClient = {
  getCalendars: async () => [{ id: 123, name: 'Work', alias_code: 'abc', calendar_users: [{ id: 1, user_id: 7, name: 'Alex', role: 1 }] }],
  createCalendar: async (name) => ({ id: 124, name, alias_code: 'new' }),
  getCurrentUser: async () => ({ id: 7, name: 'Alex', birthday: 0, gender: 'x' }),
  getEventsByCalendar: async () => [event(), memo],
  getUpdatedEvents: async () => [event({ deactivated_at: 3 })],
  getEvent: async () => event(),
  createEvent: async (_calendarId, data) => event({ uuid: 'new', id: 'new', ...defined(data), recurrences: data.recurrences ?? [] }),
  updateEvent: async (_calendarId, uuid, data) => event({ uuid, id: uuid, ...defined(data) }),
  deleteEvent: async () => {},
  getMemosByCalendar: async () => [memo],
  createMemo: async () => memo,
  updateMemo: async () => memo,
  deleteMemo: async () => {},
  addEventComment: async () => comment,
  listEventComments: async () => [comment],
  updateEventComment: async () => comment,
  deleteEventComment: async () => {},
  getCalendarLabels: async () => [label],
  updateCalendarLabels: async () => [label],
  getCalendarMembers: async () => [{ id: 1, user_id: 7, name: 'Alex', role: 1 }],
  getCalendarVirtualUsers: async () => [virtualMember],
  createVirtualUser: async () => virtualMember,
  updateVirtualUser: async () => virtualMember,
  deleteVirtualUser: async () => {},
  getMemorialDays: async () => [{ id: 1, country_iso: 'KR', title: 'Hangul Day', workday: false, start_at: Date.UTC(2026, 9, 9), end_at: Date.UTC(2026, 9, 9) }],
  getLatestEventActivities: async () => [{
    id: 'evt-1', calendar_id: 123, title: 'Standup', category: 1, all_day: false, start_at: 1, deactivated_at: null,
    activities: [{ status: [1], user_id: 7, updated_at: 1000 }],
  }],
};

const sampleArgs = {
  list_calendars: {},
  create_calendar: { name: 'Team', purpose: 'work' },
  get_current_user: {},
  get_events: { calendar_id: '123', start_before: Date.parse('2026-11-01T00:00:00Z') },
  get_updated_events: { calendar_id: '123', updated_after: 0 },
  create_event: { calendar_id: '123', title: 'Lunch', start_at: 1000, end_at: 2000 },
  update_event: { calendar_id: '123', event_uuid: 'evt-1', title: 'Renamed' },
  delete_event: { calendar_id: '123', event_uuid: 'evt-1' },
  update_event_occurrence: { calendar_id: '123', event_uuid: 'evt-1', occurrence_start_at: '2026-10-21T01:00:00.000Z', title: 'Moved' },
  delete_event_occurrence: { calendar_id: '123', event_uuid: 'evt-1', occurrence_start_at: '2026-10-21T01:00:00.000Z' },
  copy_event: { calendar_id: '123', event_uuid: 'evt-1', start_at: Date.parse('2026-11-02T01:00:00Z') },
  list_memos: { calendar_id: '123' },
  create_memo: { calendar_id: '123', title: 'Groceries' },
  update_memo: { calendar_id: '123', memo_uuid: 'memo-1', title: 'Groceries 2' },
  delete_memo: { calendar_id: '123', memo_uuid: 'memo-1' },
  add_event_comment: { calendar_id: '123', event_uuid: 'evt-1', content: 'hello' },
  list_event_comments: { calendar_id: '123', event_uuid: 'evt-1' },
  update_event_comment: { calendar_id: '123', event_uuid: 'evt-1', comment_id: 'c-1', content: 'edited' },
  delete_event_comment: { calendar_id: '123', event_uuid: 'evt-1', comment_id: 'c-1' },
  get_calendar_labels: { calendar_id: '123' },
  update_calendar_labels: { calendar_id: '123', labels: [{ id: 1, name: 'Work' }] },
  get_calendar_members: { calendar_id: '123' },
  get_calendar_virtual_members: { calendar_id: '123' },
  create_virtual_member: { calendar_id: '123', name: 'Kid', type: 'child' },
  update_virtual_member: { calendar_id: '123', virtual_member_uuid: 'vm-uuid', one_word: 'eldest' },
  delete_virtual_member: { calendar_id: '123', virtual_member_uuid: 'vm-uuid' },
  get_holidays: { country_iso: ['KR'], start_date: '2026-10-01', end_date: '2026-10-31' },
  get_recent_activity: { calendar_id: '123' },
};

test('every tool declares annotations and an output schema', () => {
  for (const tool of registerTools(fakeClient)) {
    assert.ok(tool.annotations, `${tool.name} has annotations`);
    assert.equal(tool.annotations.openWorldHint, true, `${tool.name} talks to TimeTree`);
    const readOnly = /^(get|list)_/.test(tool.name);
    assert.equal(tool.annotations.readOnlyHint, readOnly, `${tool.name} readOnlyHint`);
    if (/^delete_/.test(tool.name)) assert.equal(tool.annotations.destructiveHint, true, `${tool.name} is destructive`);
    assert.equal(tool.outputSchema?.type, 'object', `${tool.name} has an object outputSchema`);
    assert.ok(!/verified|CSRF/i.test(tool.description), `${tool.name} description avoids implementation details`);
  }
});

test('every tool returns structured content that matches its output schema', async () => {
  const tools = registerTools(fakeClient);
  assert.deepEqual(Object.keys(sampleArgs).sort(), tools.map((tool) => tool.name).sort());

  for (const tool of tools) {
    const result = toolResult(tool, await tool.handler(sampleArgs[tool.name]));
    assert.notEqual(result.isError, true, `${tool.name} failed: ${result.content[0].text}`);
    const check = validator.getValidator(tool.outputSchema)(result.structuredContent);
    assert.ok(check.valid, `${tool.name}: ${check.errorMessage}`);
  }
});

test('error results carry no structured content', async () => {
  const tool = registerTools(fakeClient).find((candidate) => candidate.name === 'get_events');
  const result = toolResult(tool, await tool.handler({}));
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
});

test('get_current_user returns only the user ID and name', async () => {
  const tool = registerTools(fakeClient).find((candidate) => candidate.name === 'get_current_user');
  const result = JSON.parse((await tool.handler({})).content[0].text);
  assert.deepEqual(result, { user_id: 7, name: 'Alex' });
});
