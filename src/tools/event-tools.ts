/**
 * Event Tools for MCP
 * Provides event querying functionality with automatic pagination.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import { getLabelColorName } from '../types/label-colors.js';
import { CALENDAR_ID_JSON_SCHEMA, CalendarIdSchema } from './shared-schemas.js';

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
      'Get events from a specific TimeTree calendar, sorted by start time. Automatically handles pagination. ' +
      'Supports filtering by start time range, keyword, label, and whether to include memos. ' +
      'Recurring events are returned once with their RRULE; occurrences are not expanded. ' +
      'Returns event details including title, start/end times, location, notes, label color, and more. ' +
      'Label colors (label_id 1-10): 1=Emerald green, 2=Modern cyan, 3=Deep sky blue, 4=Pastel brown, ' +
      '5=Midnight black, 6=Apple red, 7=French rose, 8=Coral pink, 9=Bright orange, 10=Soft violet.',
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
          description: 'Optional label ID (1-10) filter.',
        },
        include_memos: {
          type: 'boolean',
          description: 'Whether to include memos (category=2). Defaults to true.',
        },
        limit: {
          type: 'number',
          description: 'Optional limit on number of events to return.',
        },
      },
      required: ['calendar_id'],
    },
    handler: async (args: unknown) => {
      try {
        const input = GetEventsInputSchema.parse(args);
        const { start_after, start_before, query, label_id, include_memos, limit } = input;
        const calendar_id = String(input.calendar_id);

        logger.info('Tool: get_events called', { calendar_id, start_after, start_before, limit });

        const events = await apiClient.getEventsByCalendar(calendar_id, 0);

        const keyword = query?.toLowerCase();
        let filteredEvents = events
          .filter((event) => start_after === undefined || event.start_at > start_after)
          .filter((event) => start_before === undefined || event.start_at < start_before)
          .filter((event) => label_id === undefined || event.label_id === label_id)
          .filter((event) => include_memos || event.category !== 2)
          .filter(
            (event) =>
              keyword === undefined ||
              [event.title, event.note, event.location].some((field) =>
                field?.toLowerCase().includes(keyword)
              )
          )
          .sort((a, b) => a.start_at - b.start_at);

        // Limit results if provided
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
          url: event.url || null,
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
        }));

        const result = {
          calendar_id,
          events: formattedEvents,
          total: formattedEvents.length,
          total_fetched: events.length,
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
      'Get events from a specific TimeTree calendar that were updated after a specified time. ' +
      'Useful for finding recently modified events. Returns event details including title, start/end times, ' +
      'location, notes, label color, and more. ' +
      'Label colors (label_id 1-10): 1=Emerald green, 2=Modern cyan, 3=Deep sky blue, 4=Pastel brown, ' +
      '5=Midnight black, 6=Apple red, 7=French rose, 8=Coral pink, 9=Bright orange, 10=Soft violet.',
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
          url: event.url || null,
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
