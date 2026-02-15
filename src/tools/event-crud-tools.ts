/**
 * Event CRUD Tools for MCP
 * Provides event creation, update, and deletion functionality.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError, TimeTreeAPIError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import { getLabelColorName } from '../types/label-colors.js';

// ============================================================================
// Create Event Tool
// ============================================================================

export const CreateEventInputSchema = z.object({
  calendar_id: z.number().describe('The calendar ID to create the event in'),
  title: z.string().min(1).describe('Event title'),
  all_day: z.boolean().default(false).describe('Whether this is an all-day event'),
  start_at: z.number().describe('Event start time as Unix timestamp in milliseconds'),
  start_timezone: z.string().default('UTC').describe('Start timezone (e.g., "Asia/Seoul", "America/New_York")'),
  end_at: z.number().describe('Event end time as Unix timestamp in milliseconds'),
  end_timezone: z.string().default('UTC').describe('End timezone (e.g., "Asia/Seoul", "America/New_York")'),
  label_id: z.number().min(1).max(10).optional().describe('Color label ID (1-10). See description for color mapping.'),
  category: z.number().default(1).describe('Event category (default: 1)'),
  note: z.string().optional().describe('Event notes/description'),
  location: z.string().optional().describe('Event location'),
  url: z.string().optional().describe('Related URL'),
});

export function createCreateEventTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'create_event',
    description:
      'Create a new event in a TimeTree calendar. Requires CSRF token (automatically managed). ' +
      'Returns the created event with UUID. ' +
      'Label colors (label_id 1-10): 1=Emerald green, 2=Modern cyan, 3=Deep sky blue, 4=Pastel brown, ' +
      '5=Midnight black, 6=Apple red, 7=French rose, 8=Coral pink, 9=Bright orange, 10=Soft violet.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: {
          type: 'number',
          description: 'The calendar ID to create the event in (use list_calendars to get valid IDs)',
        },
        title: {
          type: 'string',
          description: 'Event title (required)',
        },
        all_day: {
          type: 'boolean',
          description: 'Whether this is an all-day event (default: false). ' +
            'IMPORTANT: For all-day events, TimeTree uses INCLUSIVE end dates. ' +
            'Example: Feb 15-16 event should have start_at=Feb 15 00:00 and end_at=Feb 16 00:00 (NOT Feb 17).',
        },
        start_at: {
          type: 'number',
          description: 'Event start time as Unix timestamp in milliseconds. ' +
            'For all-day events, use midnight (00:00:00) of the start date. ' +
            'Example: new Date("2026-02-15T00:00:00Z").getTime() = 1739577600000',
        },
        start_timezone: {
          type: 'string',
          description: 'Start timezone (default: UTC). Examples: "Asia/Seoul", "America/New_York"',
        },
        end_at: {
          type: 'number',
          description: 'Event end time as Unix timestamp in milliseconds. ' +
            'IMPORTANT: For all-day events, TimeTree uses INCLUSIVE end dates. ' +
            'To create Feb 15-16 event, set end_at to Feb 16 midnight (NOT Feb 17). ' +
            'Example: Feb 15-16 event → end_at=new Date("2026-02-16T00:00:00Z").getTime()',
        },
        end_timezone: {
          type: 'string',
          description: 'End timezone (default: UTC)',
        },
        label_id: {
          type: 'number',
          description: 'Color label ID (1-10). 1=Emerald, 2=Cyan, 3=Blue, 4=Brown, 5=Black, 6=Red, 7=Rose, 8=Pink, 9=Orange, 10=Violet',
        },
        category: {
          type: 'number',
          description: 'Event category (default: 1)',
        },
        note: {
          type: 'string',
          description: 'Event notes/description',
        },
        location: {
          type: 'string',
          description: 'Event location',
        },
        url: {
          type: 'string',
          description: 'Related URL',
        },
      },
      required: ['calendar_id', 'title', 'start_at', 'end_at'],
    },
    handler: async (args: unknown) => {
      try {
        const input = CreateEventInputSchema.parse(args);
        logger.info('Tool: create_event called', { calendar_id: input.calendar_id, title: input.title });

        const event = await apiClient.createEvent(input.calendar_id.toString(), {
          title: input.title,
          all_day: input.all_day,
          start_at: input.start_at,
          start_timezone: input.start_timezone,
          end_at: input.end_at,
          end_timezone: input.end_timezone,
          label_id: input.label_id,
          category: input.category,
          note: input.note,
          location: input.location,
          url: input.url,
          recurrences: [],
          alerts: [],
          file_uuids: [],
        });

        // Format event for output
        const formattedEvent = {
          uuid: event.uuid,
          calendar_id: event.calendar_id,
          title: event.title,
          start_at: new Date(event.start_at).toISOString(),
          start_timezone: event.start_timezone || null,
          end_at: new Date(event.end_at).toISOString(),
          end_timezone: event.end_timezone || null,
          all_day: event.all_day,
          label_id: event.label_id || null,
          label_color: event.label_id ? getLabelColorName(event.label_id) : null,
          location: event.location || null,
          note: event.note || null,
          url: event.url || null,
          category: event.category || null,
          created_at: event.created_at ? new Date(event.created_at).toISOString() : null,
          updated_at: event.updated_at ? new Date(event.updated_at).toISOString() : null,
        };

        logger.info('Tool: create_event completed', { uuid: event.uuid });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Event created successfully',
                  event: formattedEvent,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: create_event failed', { error });

        if (error instanceof InvalidCalendarError) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Invalid calendar',
                    message: 'Calendar not found. Please use list_calendars to get valid calendar IDs.',
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (error instanceof TimeTreeAPIError && error.statusCode === 403) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Authentication failed',
                    message: 'CSRF token missing or invalid. Please try again (token will be refreshed automatically).',
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
                    message: 'Please provide valid event data',
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
                  error: 'Failed to create event',
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

// ============================================================================
// Update Event Tool
// ============================================================================

export const UpdateEventInputSchema = z.object({
  calendar_id: z.number().describe('The calendar ID'),
  event_uuid: z.string().describe('The UUID of the event to update'),
  title: z.string().min(1).optional().describe('New event title'),
  all_day: z.boolean().optional().describe('Whether this is an all-day event'),
  start_at: z.number().optional().describe('New start time as Unix timestamp in milliseconds'),
  start_timezone: z.string().optional().describe('New start timezone'),
  end_at: z.number().optional().describe('New end time as Unix timestamp in milliseconds'),
  end_timezone: z.string().optional().describe('New end timezone'),
  label_id: z.number().min(1).max(10).optional().describe('New color label ID (1-10)'),
  category: z.number().optional().describe('New event category'),
  note: z.string().optional().describe('New event notes'),
  location: z.string().optional().describe('New event location'),
  url: z.string().optional().describe('New related URL'),
});

export function createUpdateEventTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'update_event',
    description:
      'Update an existing event in a TimeTree calendar. Only provide the fields you want to change. ' +
      'Requires CSRF token (automatically managed). Returns the updated event. ' +
      'Label colors (label_id 1-10): 1=Emerald green, 2=Modern cyan, 3=Deep sky blue, 4=Pastel brown, ' +
      '5=Midnight black, 6=Apple red, 7=French rose, 8=Coral pink, 9=Bright orange, 10=Soft violet.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: {
          type: 'number',
          description: 'The calendar ID',
        },
        event_uuid: {
          type: 'string',
          description: 'The UUID of the event to update (from get_events)',
        },
        title: {
          type: 'string',
          description: 'New event title',
        },
        all_day: {
          type: 'boolean',
          description: 'Whether this is an all-day event. ' +
            'NOTE: For all-day events, TimeTree uses INCLUSIVE end dates (see end_at description).',
        },
        start_at: {
          type: 'number',
          description: 'New start time as Unix timestamp in milliseconds. ' +
            'For all-day events, use midnight (00:00:00) of the start date.',
        },
        start_timezone: {
          type: 'string',
          description: 'New start timezone (e.g., "Asia/Seoul")',
        },
        end_at: {
          type: 'number',
          description: 'New end time as Unix timestamp in milliseconds. ' +
            'IMPORTANT: For all-day events, use INCLUSIVE end date. ' +
            'Example: Feb 15-16 event → end_at should be Feb 16 00:00 (NOT Feb 17).',
        },
        end_timezone: {
          type: 'string',
          description: 'New end timezone',
        },
        label_id: {
          type: 'number',
          description: 'New color label ID (1-10)',
        },
        category: {
          type: 'number',
          description: 'New event category',
        },
        note: {
          type: 'string',
          description: 'New event notes',
        },
        location: {
          type: 'string',
          description: 'New event location',
        },
        url: {
          type: 'string',
          description: 'New related URL',
        },
      },
      required: ['calendar_id', 'event_uuid'],
    },
    handler: async (args: unknown) => {
      try {
        const input = UpdateEventInputSchema.parse(args);
        logger.info('Tool: update_event called', {
          calendar_id: input.calendar_id,
          event_uuid: input.event_uuid,
        });

        const event = await apiClient.updateEvent(
          input.calendar_id.toString(),
          input.event_uuid,
          {
            title: input.title,
            all_day: input.all_day,
            start_at: input.start_at,
            start_timezone: input.start_timezone,
            end_at: input.end_at,
            end_timezone: input.end_timezone,
            label_id: input.label_id,
            category: input.category,
            note: input.note,
            location: input.location,
            url: input.url,
          }
        );

        // Format event for output
        const formattedEvent = {
          uuid: event.uuid,
          calendar_id: event.calendar_id,
          title: event.title,
          start_at: new Date(event.start_at).toISOString(),
          start_timezone: event.start_timezone || null,
          end_at: new Date(event.end_at).toISOString(),
          end_timezone: event.end_timezone || null,
          all_day: event.all_day,
          label_id: event.label_id || null,
          label_color: event.label_id ? getLabelColorName(event.label_id) : null,
          location: event.location || null,
          note: event.note || null,
          url: event.url || null,
          category: event.category || null,
          updated_at: event.updated_at ? new Date(event.updated_at).toISOString() : null,
        };

        logger.info('Tool: update_event completed', { uuid: event.uuid });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Event updated successfully',
                  event: formattedEvent,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: update_event failed', { error });

        if (error instanceof TimeTreeAPIError && error.statusCode === 404) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Event not found',
                    message: 'The specified event UUID does not exist. Please use get_events to find valid event UUIDs.',
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (error instanceof TimeTreeAPIError && error.statusCode === 403) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Authentication failed',
                    message: 'CSRF token missing or invalid. Please try again.',
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
                    message: 'Please provide valid update data',
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
                  error: 'Failed to update event',
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

// ============================================================================
// Delete Event Tool
// ============================================================================

export const DeleteEventInputSchema = z.object({
  calendar_id: z.number().describe('The calendar ID'),
  event_uuid: z.string().describe('The UUID of the event to delete'),
});

export function createDeleteEventTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'delete_event',
    description:
      'Delete an event from a TimeTree calendar. This action cannot be undone. ' +
      'Requires CSRF token (automatically managed).',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: {
          type: 'number',
          description: 'The calendar ID',
        },
        event_uuid: {
          type: 'string',
          description: 'The UUID of the event to delete (from get_events)',
        },
      },
      required: ['calendar_id', 'event_uuid'],
    },
    handler: async (args: unknown) => {
      try {
        const input = DeleteEventInputSchema.parse(args);
        logger.info('Tool: delete_event called', {
          calendar_id: input.calendar_id,
          event_uuid: input.event_uuid,
        });

        await apiClient.deleteEvent(input.calendar_id.toString(), input.event_uuid);

        logger.info('Tool: delete_event completed', { event_uuid: input.event_uuid });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Event deleted successfully',
                  deleted_event_uuid: input.event_uuid,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: delete_event failed', { error });

        if (error instanceof TimeTreeAPIError && error.statusCode === 404) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Event not found',
                    message: 'The specified event UUID does not exist or has already been deleted.',
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (error instanceof TimeTreeAPIError && error.statusCode === 403) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'Authentication failed',
                    message: 'CSRF token missing or invalid. Please try again.',
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
                    message: 'Please provide valid calendar_id and event_uuid',
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
                  error: 'Failed to delete event',
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
