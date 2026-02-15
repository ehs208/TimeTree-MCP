/**
 * Event Tools for MCP
 * Provides event querying functionality with automatic pagination.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError } from '../client/api.js';
import { logger } from '../utils/logger.js';

export const GetEventsInputSchema = z.object({
  calendar_id: z.string().describe('The calendar ID to fetch events from'),
  start_after: z
    .number()
    .optional()
    .describe(
      'Optional Unix timestamp in milliseconds. Only return events starting after this time.'
    ),
  limit: z
    .number()
    .optional()
    .describe('Optional limit on number of events to return. Defaults to all events.'),
});

export function createGetEventsTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_events',
    description:
      'Get all events from a specific TimeTree calendar. Automatically handles pagination to fetch all events. ' +
      'Returns event details including title, start/end times, location, notes, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: {
          type: 'string',
          description: 'The calendar ID to fetch events from',
        },
        start_after: {
          type: 'number',
          description:
            'Optional Unix timestamp in milliseconds. Only return events starting after this time. ' +
            'If user provides a date like "2026-02-01", convert it to Unix timestamp (e.g., 1769904000000).',
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
        const { calendar_id, start_after, limit } = input;

        logger.info('Tool: get_events called', { calendar_id, start_after, limit });

        const events = await apiClient.getEventsByCalendar(calendar_id, 0);

        // Filter by start_after if provided
        let filteredEvents = events;
        if (start_after) {
          filteredEvents = events.filter((event) => event.start_at > start_after);
        }

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
          location: event.location || null,
          location_lat: event.location_lat || null,
          location_lon: event.location_lon || null,
          note: event.note || null,
          url: event.url || null,
          category: event.category || null,
          type: event.type || null,
          created_at: event.created_at ? new Date(event.created_at).toISOString() : null,
          updated_at: event.updated_at ? new Date(event.updated_at).toISOString() : null,
          has_alerts: event.alerts && event.alerts.length > 0,
          has_recurrence: event.recurrences && event.recurrences.length > 0,
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
                    message: 'Please provide a valid calendar_id (string)',
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
