/**
 * Input schemas shared across MCP tools.
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
