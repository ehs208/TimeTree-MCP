/**
 * Event Tools for MCP
 * Provides event querying functionality with automatic pagination.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import { getLabelColorName } from '../types/label-colors.js';
import {
  CALENDAR_ID_JSON_SCHEMA,
  CalendarIdSchema,
  ISO_DATE_TIME,
  LABEL_ID_DESCRIPTION,
  READ_ONLY,
} from './shared-schemas.js';
import { expandRecurrence, parseRecurrence } from '../utils/recurrence.js';
import type { Event } from '../types/timetree.js';

const MAX_OCCURRENCES_PER_EVENT = 500;

const nullable = (type: string) => ({ type: [type, 'null'] });

/** One row of get_events / get_updated_events output. */
const LISTED_EVENT_PROPERTIES = {
  uuid: { type: 'string' },
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
  has_recurrence: { type: 'boolean' },
  checklist: { type: ['array', 'null'] },
  virtual_user_attendees: { type: 'array' },
  created_at: nullable('string'),
  updated_at: nullable('string'),
} as const;

export const GetEventsInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID to fetch events from'),
  start_after: z
    .number()
    .optional()
    .describe(
      'Optional Unix timestamp in milliseconds. Only return events starting after this time.'
    ),
  start_before: z
    .number()
    .optional()
    .describe('Optional Unix timestamp in milliseconds. Only return events starting before this time.'),
  query: z
    .string()
    .min(1)
    .optional()
    .describe('Optional case-insensitive keyword matched against title, note, and location.'),
  label_id: z.number().int().min(1).max(10).optional().describe('Optional label ID (1-10) filter.'),
  include_memos: z
    .boolean()
    .default(true)
    .describe('Whether to include memos (category=2). Defaults to true.'),
  expand_recurring: z
    .boolean()
    .default(true)
    .describe('When start_before is set, return each recurring occurrence in the range. Defaults to true.'),
  limit: z
    .number()
    .optional()
    .describe('Optional limit on number of events to return. Defaults to all events.'),
});

export const GetUpdatedEventsInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID to fetch updated events from'),
  updated_after: z
    .number()
    .describe('Unix timestamp in milliseconds. Only return events updated after this time.'),
  limit: z
    .number()
    .optional()
    .describe('Optional limit on number of events to return. Defaults to all events.'),
});

export function createGetEventsTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_events',
    description:
      'Find events in a calendar by start time range, keyword, or label, sorted by start time. ' +
      'Use this to answer "what is on my schedule"; use get_updated_events or get_recent_activity for "what changed". ' +
      'Reads every page of the calendar, then filters; limit applies after sorting. Memos are included unless ' +
      'include_memos is false (list_memos returns only memos). When start_before is set, recurring events are ' +
      'expanded into each occurrence in the range. Occurrences share the series uuid, so update_event changes the ' +
      'whole series; use update_event_occurrence or delete_event_occurrence with the occurrence start_at to change one.',
    annotations: READ_ONLY,
    outputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string' },
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...LISTED_EVENT_PROPERTIES,
              is_recurring_occurrence: { type: 'boolean', description: 'Present on expanded occurrences of a series' },
              series_start_at: ISO_DATE_TIME,
            },
            required: ['uuid', 'title', 'start_at', 'end_at', 'all_day'],
          },
        },
        total: { type: 'number' },
        total_fetched: { type: 'number' },
        truncated_series: { type: 'array', items: { type: 'string' } },
        truncation_note: { type: 'string' },
      },
      required: ['calendar_id', 'events', 'total'],
    },
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        start_after: {
          type: 'number',
          description:
            'Optional Unix timestamp in milliseconds. Only return events starting after this time. ' +
            'If user provides a date like "2026-02-01", convert it to Unix timestamp (e.g., 1769904000000).',
        },
        start_before: {
          type: 'number',
          description: 'Optional Unix timestamp in milliseconds. Only return events starting before this time.',
        },
        query: {
          type: 'string',
          description: 'Optional case-insensitive keyword matched against title, note, and location.',
        },
        label_id: {
          type: 'number',
          description: `Optional label filter. ${LABEL_ID_DESCRIPTION}`,
        },
        include_memos: {
          type: 'boolean',
          description: 'Whether to include memos (category=2). Defaults to true.',
        },
        expand_recurring: {
          type: 'boolean',
          description:
            'When start_before is set, return each recurring occurrence in the range instead of only the series start. Defaults to true.',
        },
        limit: {
          type: 'number',
          description: 'Optional maximum number of events to return, counted after filtering and sorting.',
        },
      },
      required: ['calendar_id'],
    },
    handler: async (args: unknown) => {
      try {
        const input = GetEventsInputSchema.parse(args);
        const { start_after, start_before, query, label_id, include_memos, expand_recurring, limit } = input;
        const calendar_id = String(input.calendar_id);

        logger.info('Tool: get_events called', { calendar_id, start_after, start_before, limit });

        const events = await apiClient.getEventsByCalendar(calendar_id, 0);

        const keyword = query?.toLowerCase();
        const matchingEvents = events
          .filter((event) => label_id === undefined || event.label_id === label_id)
          .filter((event) => include_memos || event.category !== 2)
          .filter(
            (event) =>
              keyword === undefined ||
              [event.title, event.note, event.location].some((field) =>
                field?.toLowerCase().includes(keyword)
              )
          );

        const inRange = (startAt: number) =>
          (start_after === undefined || startAt > start_after) &&
          (start_before === undefined || startAt < start_before);

        // Each entry is one row in the result: a single event or one occurrence of a series.
        let filteredEvents: Array<{ event: Event; start_at: number; end_at: number; occurrence: boolean }> = [];
        const truncatedSeries: string[] = [];
        for (const event of matchingEvents) {
          const recurrence =
            expand_recurring && start_before !== undefined ? parseRecurrence(event.recurrences) : null;

          if (!recurrence || start_before === undefined) {
            if (inRange(event.start_at)) {
              filteredEvents.push({ event, start_at: event.start_at, end_at: event.end_at, occurrence: false });
            }
            continue;
          }

          const duration = event.end_at - event.start_at;
          const { occurrences, truncated } = expandRecurrence(recurrence, {
            start: event.start_at,
            timeZone: event.start_timezone,
            windowStart: start_after === undefined ? Number.NEGATIVE_INFINITY : start_after + 1,
            windowEnd: start_before,
            maxOccurrences: MAX_OCCURRENCES_PER_EVENT,
          });
          for (const startAt of occurrences) {
            filteredEvents.push({ event, start_at: startAt, end_at: startAt + duration, occurrence: true });
          }
          if (truncated) truncatedSeries.push(event.uuid);
        }
        filteredEvents.sort((a, b) => a.start_at - b.start_at);

        // Limit results if provided
        if (limit) {
          filteredEvents = filteredEvents.slice(0, limit);
        }

        // Format events for better readability
        const formattedEvents = filteredEvents.map(({ event, start_at, end_at, occurrence }) => ({
          uuid: event.uuid,
          title: event.title,
          start_at: new Date(start_at).toISOString(),
          start_timezone: event.start_timezone || null,
          end_at: new Date(end_at).toISOString(),
          end_timezone: event.end_timezone || null,
          all_day: event.all_day,
          label_id: event.label_id || null,
          label_color: event.label_id ? getLabelColorName(event.label_id) : null,
          location: event.location || null,
          location_lat: event.location_lat || null,
          location_lon: event.location_lon || null,
          note: event.note || null,
          url: event.attachment?.url || event.url || null,
          category: event.category || null,
          type: event.type || null,
          created_at: event.created_at ? new Date(event.created_at).toISOString() : null,
          updated_at: event.updated_at ? new Date(event.updated_at).toISOString() : null,
          attendees: event.attendees || [],
          alerts: event.alerts || [],
          recurrences: event.recurrences || [],
          has_alerts: event.alerts && event.alerts.length > 0,
          has_recurrence: event.recurrences && event.recurrences.length > 0,
          checklist: event.attachment?.checklist || null,
          virtual_user_attendees: event.attachment?.virtual_user_attendees || [],
          ...(occurrence && { is_recurring_occurrence: true, series_start_at: new Date(event.start_at).toISOString() }),
        }));

        const result = {
          calendar_id,
          events: formattedEvents,
          total: formattedEvents.length,
          total_fetched: events.length,
          ...(truncatedSeries.length && {
            truncated_series: truncatedSeries,
            truncation_note: `Each recurring series is limited to ${MAX_OCCURRENCES_PER_EVENT} occurrences; narrow start_after/start_before to see the rest.`,
          }),
        };

        logger.info('Tool: get_events completed', {
          calendar_id,
          total: result.total,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: get_events failed', { error });

        // Handle specific error types
        if (error instanceof InvalidCalendarError) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Invalid calendar',
                    message: `Calendar not found. Please use list_calendars to get valid calendar IDs.`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if ((error as any).name === 'ZodError') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Invalid input',
                    message: 'Please provide a valid calendar_id',
                    details: (error as any).errors,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'Failed to fetch events',
                  message: (error as Error).message,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    },
  };
}

export function createGetUpdatedEventsTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_updated_events',
    description:
      'List events and memos changed after a point in time, with their current content. Deleted ones are ' +
      'included with deleted: true. Use this to sync or review changes since a time; use get_recent_activity to ' +
      'see who changed what, and get_events to look up a schedule. Recurring events are returned once, not expanded.',
    annotations: READ_ONLY,
    outputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'string' },
        updated_after: ISO_DATE_TIME,
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...LISTED_EVENT_PROPERTIES,
              deleted: { type: 'boolean' },
              deleted_at: nullable('string'),
            },
            required: ['uuid', 'title', 'start_at', 'end_at', 'all_day', 'deleted'],
          },
        },
        total: { type: 'number' },
        total_fetched: { type: 'number' },
      },
      required: ['calendar_id', 'updated_after', 'events', 'total'],
    },
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        updated_after: {
          type: 'number',
          description:
            'Unix timestamp in milliseconds. Only return events updated after this time. ' +
            'If user provides a date like "2026-02-01", convert it to Unix timestamp (e.g., 1769904000000).',
        },
        limit: {
          type: 'number',
          description: 'Optional limit on number of events to return.',
        },
      },
      required: ['calendar_id', 'updated_after'],
    },
    handler: async (args: unknown) => {
      try {
        const input = GetUpdatedEventsInputSchema.parse(args);
        const { updated_after, limit } = input;
        const calendar_id = String(input.calendar_id);

        logger.info('Tool: get_updated_events called', { calendar_id, updated_after, limit });

        const events = await apiClient.getUpdatedEvents(calendar_id, updated_after);

        // Limit results if provided
        let filteredEvents = events;
        if (limit) {
          filteredEvents = filteredEvents.slice(0, limit);
        }

        // Format events for better readability
        const formattedEvents = filteredEvents.map((event) => ({
          uuid: event.uuid,
          title: event.title,
          start_at: new Date(event.start_at).toISOString(),
          start_timezone: event.start_timezone || null,
          end_at: new Date(event.end_at).toISOString(),
          end_timezone: event.end_timezone || null,
          all_day: event.all_day,
          label_id: event.label_id || null,
          label_color: event.label_id ? getLabelColorName(event.label_id) : null,
          location: event.location || null,
          location_lat: event.location_lat || null,
          location_lon: event.location_lon || null,
          note: event.note || null,
          url: event.attachment?.url || event.url || null,
          category: event.category || null,
          type: event.type || null,
          created_at: event.created_at ? new Date(event.created_at).toISOString() : null,
          updated_at: event.updated_at ? new Date(event.updated_at).toISOString() : null,
          attendees: event.attendees || [],
          alerts: event.alerts || [],
          recurrences: event.recurrences || [],
          has_alerts: event.alerts && event.alerts.length > 0,
          has_recurrence: event.recurrences && event.recurrences.length > 0,
          checklist: event.attachment?.checklist || null,
          virtual_user_attendees: event.attachment?.virtual_user_attendees || [],
          deleted: !!event.deactivated_at,
          deleted_at: event.deactivated_at ? new Date(event.deactivated_at).toISOString() : null,
        }));

        const result = {
          calendar_id,
          updated_after: new Date(updated_after).toISOString(),
          events: formattedEvents,
          total: formattedEvents.length,
          total_fetched: events.length,
        };

        logger.info('Tool: get_updated_events completed', {
          calendar_id,
          total: result.total,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: get_updated_events failed', { error });

        // Handle specific error types
        if (error instanceof InvalidCalendarError) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Invalid calendar',
                    message: `Calendar not found. Please use list_calendars to get valid calendar IDs.`,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if ((error as any).name === 'ZodError') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Invalid input',
                    message: 'Please provide valid calendar_id and updated_after (number) parameters',
                    details: (error as any).errors,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'Failed to fetch updated events',
                  message: (error as Error).message,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    },
  };
}
