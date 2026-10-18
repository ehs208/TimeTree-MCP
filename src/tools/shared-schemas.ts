/**
 * Input schemas, output schemas, and annotations shared across MCP tools.
 */

import { z } from 'zod';

/**
 * Calendar IDs are numeric, but list_calendars returns them as strings.
 * Accept both forms so an ID can be passed through unchanged, and normalize to a number.
 */
export const CalendarIdSchema = z
  .union([z.number().int().positive(), z.string().regex(/^\d+$/, 'calendar_id must be numeric')])
  .transform((value) => Number(value));

export const CALENDAR_ID_JSON_SCHEMA = {
  type: 'string',
  description: 'The calendar ID from list_calendars (numeric string; numbers are also accepted)',
} as const;

export const LABEL_ID_DESCRIPTION =
  'Color label ID (1-10): 1=Emerald green, 2=Modern cyan, 3=Deep sky blue, 4=Pastel brown, ' +
  '5=Midnight black, 6=Apple red, 7=French rose, 8=Coral pink, 9=Bright orange, 10=Soft violet';

// ============================================================================
// Tool annotations (MCP hints; every tool talks to TimeTree, an external service)
// ============================================================================

export const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;
/** Adds something new; repeating the call adds it again. */
export const ADDITIVE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const;
/** Overwrites or removes data; repeating the same call has no further effect. */
export const DESTRUCTIVE_IDEMPOTENT = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const;
/** Overwrites or removes data, and may create new data each time it is called. */
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;

// ============================================================================
// Output schemas (JSON Schema for structuredContent)
// ============================================================================

const nullable = (type: string) => ({ type: [type, 'null'] });

export const ISO_DATE_TIME = { type: 'string', description: 'ISO 8601 date-time (UTC)' } as const;

/** An event as returned by the write tools. */
export const EVENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    uuid: { type: 'string' },
    calendar_id: { type: 'number' },
    title: { type: 'string' },
    start_at: ISO_DATE_TIME,
    start_timezone: nullable('string'),
    end_at: ISO_DATE_TIME,
    end_timezone: nullable('string'),
    all_day: { type: 'boolean' },
    label_id: nullable('number'),
    label_color: nullable('string'),
    location: nullable('string'),
    note: nullable('string'),
    url: nullable('string'),
    category: { type: ['number', 'null'], description: '1 = event, 2 = memo' },
    attendees: { type: 'array', items: { type: 'number' } },
    alerts: { type: 'array' },
    recurrences: { type: 'array', items: { type: 'string' } },
    checklist: { type: ['array', 'null'] },
    virtual_user_attendees: { type: 'array' },
    parent_id: { type: ['string', 'null'], description: 'Series uuid when this event is an edited occurrence' },
    created_at: nullable('string'),
    updated_at: nullable('string'),
  },
  required: ['uuid', 'title', 'start_at', 'end_at', 'all_day'],
} as const;

/** Result of a write that returns one event. */
export const EVENT_RESULT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    event: EVENT_OUTPUT_SCHEMA,
  },
  required: ['success', 'event'],
} as const;

/** Result of a delete that returns only identifiers. */
export function deletionOutputSchema(idField: string) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      [idField]: { type: 'string' },
    },
    required: ['success', idField],
  } as const;
}
