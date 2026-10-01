/**
 * Event CRUD Tools for MCP
 * Provides event creation, update, and deletion functionality.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError, TimeTreeAPIError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import { CALENDAR_ID_JSON_SCHEMA, CalendarIdSchema } from './shared-schemas.js';
import { getLabelColorName } from '../types/label-colors.js';
import type { ChecklistItem, Event } from '../types/timetree.js';

const ChecklistSchema = z.array(z.object({
  checked: z.boolean().default(false).describe('Whether the checklist item is checked'),
  title: z.string().min(1).describe('Checklist item title'),
}));

const VirtualUserAttendeesSchema = z.array(z.union([z.string(), z.number()]));

function buildAttachment(
  checklist?: ChecklistItem[],
  virtualUserAttendees?: Array<string | number>
) {
  if (checklist === undefined && virtualUserAttendees === undefined) {
    return undefined;
  }

  return {
    ...(checklist !== undefined && { checklist }),
    ...(virtualUserAttendees !== undefined && { virtual_user_attendees: virtualUserAttendees }),
  };
}

function formatEvent(event: Event) {
  return {
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
    attendees: event.attendees || [],
    alerts: event.alerts || [],
    recurrences: event.recurrences || [],
    checklist: event.attachment?.checklist || null,
    virtual_user_attendees: event.attachment?.virtual_user_attendees || [],
    created_at: event.created_at ? new Date(event.created_at).toISOString() : null,
    updated_at: event.updated_at ? new Date(event.updated_at).toISOString() : null,
  };
}

function errorContent(error: string, message: string, details?: unknown) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            error,
            message,
            ...(details !== undefined && { details }),
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

function commonWriteError(error: unknown, action: string) {
  if (error instanceof InvalidCalendarError) {
    return errorContent(
      'Invalid calendar',
      'Calendar not found. Please use list_calendars to get valid calendar IDs.'
    );
  }

  if (error instanceof TimeTreeAPIError && error.statusCode === 404) {
    return errorContent(
      'Event not found',
      'The specified event UUID does not exist. Please use get_events to find valid event UUIDs.'
    );
  }

  if (error instanceof TimeTreeAPIError && error.statusCode === 403) {
    return errorContent(
      'Authentication failed',
      'CSRF token missing or invalid. Please try again.'
    );
  }

  if ((error as { name?: string }).name === 'ZodError') {
    return errorContent(
      'Invalid input',
      `Please provide valid data to ${action}`,
      (error as { errors?: unknown }).errors
    );
  }

  return errorContent(`Failed to ${action}`, (error as Error).message);
}

// ============================================================================
// Create Event Tool
// ============================================================================

export const CreateEventInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID to create the event in'),
  title: z.string().min(1).describe('Event title'),
  all_day: z.boolean().default(false).describe('Whether this is an all-day event'),
  start_at: z.number().describe('Event start time as Unix timestamp in milliseconds'),
  start_timezone: z.string().default('UTC').describe('Start timezone (e.g., "Asia/Seoul", "America/New_York")'),
  end_at: z.number().describe('Event end time as Unix timestamp in milliseconds'),
  end_timezone: z.string().default('UTC').describe('End timezone (e.g., "Asia/Seoul", "America/New_York")'),
  label_id: z.number().min(1).max(10).optional().describe('Color label ID (1-10). See description for color mapping.'),
  category: z.number().default(1).describe('Event category (default: 1; memos use category=2)'),
  note: z.string().optional().describe('Event notes/description'),
  location: z.string().optional().describe('Event location'),
  url: z.string().optional().describe('Related URL'),
  attendees: z.array(z.number()).optional().describe('Calendar user IDs attending this event'),
  recurrences: z.array(z.string()).optional().describe('RRULE strings, e.g. ["RRULE:FREQ=DAILY;COUNT=2"]'),
  alerts: z.array(z.number()).optional().describe('Notification offsets in minutes, e.g. [5, 30]'),
  file_uuids: z.array(z.string()).optional().describe('Attached file UUIDs if already uploaded'),
  checklist: ChecklistSchema.optional().describe('Checklist items to attach to the event'),
  virtual_user_attendees: VirtualUserAttendeesSchema.optional().describe('Virtual member IDs/names attending this event'),
});

export function createCreateEventTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'create_event',
    description:
      'Create a new event in a TimeTree calendar. Requires CSRF token (automatically managed). ' +
      'Returns the created event with UUID. ' +
      'Label colors (label_id 1-10): 1=Emerald green, 2=Modern cyan, 3=Deep sky blue, 4=Pastel brown, ' +
      '5=Midnight black, 6=Apple red, 7=French rose, 8=Coral pink, 9=Bright orange, 10=Soft violet. ' +
      'Supports checklist, attendees, virtual attendees, alerts, RRULE recurrence strings, and category override.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        title: { type: 'string', description: 'Event title (required)' },
        all_day: {
          type: 'boolean',
          description: 'Whether this is an all-day event (default: false). TimeTree uses inclusive end dates for all-day events.',
        },
        start_at: {
          type: 'number',
          description: 'Event start time as Unix timestamp in milliseconds. For all-day events, use midnight of the start date.',
        },
        start_timezone: {
          type: 'string',
          description: 'Start timezone (default: UTC). Examples: "Asia/Seoul", "America/New_York"',
        },
        end_at: {
          type: 'number',
          description: 'Event end time as Unix timestamp in milliseconds. For all-day events, TimeTree uses an inclusive end date.',
        },
        end_timezone: { type: 'string', description: 'End timezone (default: UTC)' },
        label_id: {
          type: 'number',
          description: 'Color label ID (1-10). 1=Emerald, 2=Cyan, 3=Blue, 4=Brown, 5=Black, 6=Red, 7=Rose, 8=Pink, 9=Orange, 10=Violet',
        },
        category: { type: 'number', description: 'Event category (default: 1; memos use category=2)' },
        note: { type: 'string', description: 'Event notes/description' },
        location: { type: 'string', description: 'Event location' },
        url: { type: 'string', description: 'Related URL' },
        attendees: {
          type: 'array',
          description: 'Calendar user IDs attending this event',
          items: { type: 'number' },
        },
        recurrences: {
          type: 'array',
          description: 'RRULE strings, e.g. ["RRULE:FREQ=DAILY;COUNT=2"]',
          items: { type: 'string' },
        },
        alerts: {
          type: 'array',
          description: 'Notification offsets in minutes before the event, e.g. [5, 30]',
          items: { type: 'number' },
        },
        file_uuids: {
          type: 'array',
          description: 'Attached file UUIDs if already uploaded',
          items: { type: 'string' },
        },
        checklist: {
          type: 'array',
          description: 'Checklist items to attach to the event',
          items: {
            type: 'object',
            properties: {
              checked: { type: 'boolean', description: 'Whether the item is checked' },
              title: { type: 'string', description: 'Checklist item title' },
            },
            required: ['title'],
          },
        },
        virtual_user_attendees: {
          type: 'array',
          description: 'Virtual member IDs/names attending this event',
          items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
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
          attendees: input.attendees ?? [],
          recurrences: input.recurrences ?? [],
          alerts: input.alerts ?? [],
          file_uuids: input.file_uuids ?? [],
          attachment: buildAttachment(input.checklist, input.virtual_user_attendees),
        });

        logger.info('Tool: create_event completed', { uuid: event.uuid });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Event created successfully',
                  event: formatEvent(event),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: create_event failed', { error });
        return commonWriteError(error, 'create event');
      }
    },
  };
}

// ============================================================================
// Update Event Tool
// ============================================================================

export const UpdateEventInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
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
  url: z.string().optional().describe('New related URL; use an empty string to remove it'),
  attendees: z.array(z.number()).optional().describe('Replace calendar user attendee IDs'),
  recurrences: z.array(z.string()).optional().describe('Replace recurrence RRULE strings'),
  alerts: z.array(z.number()).optional().describe('Replace notification offsets in minutes'),
  file_uuids: z.array(z.string()).optional().describe('Replace attached file UUIDs'),
  checklist: ChecklistSchema.optional().describe('Replace event checklist items; use [] to clear checklist'),
  virtual_user_attendees: VirtualUserAttendeesSchema.optional().describe('Replace virtual member attendees; use [] to clear'),
});

export function createUpdateEventTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'update_event',
    description:
      'Update an existing event in a TimeTree calendar. Only provide the fields you want to change. ' +
      'Requires CSRF token (automatically managed). Returns the updated event. ' +
      'Supports checklist, attendees, virtual attendees, alerts, RRULE recurrence strings, and category override.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        event_uuid: { type: 'string', description: 'The UUID of the event to update (from get_events)' },
        title: { type: 'string', description: 'New event title' },
        all_day: { type: 'boolean', description: 'Whether this is an all-day event' },
        start_at: { type: 'number', description: 'New start time as Unix timestamp in milliseconds' },
        start_timezone: { type: 'string', description: 'New start timezone (e.g., "Asia/Seoul")' },
        end_at: { type: 'number', description: 'New end time as Unix timestamp in milliseconds' },
        end_timezone: { type: 'string', description: 'New end timezone' },
        label_id: { type: 'number', description: 'New color label ID (1-10)' },
        category: { type: 'number', description: 'New event category' },
        note: { type: 'string', description: 'New event notes' },
        location: { type: 'string', description: 'New event location' },
        url: { type: 'string', description: 'New related URL; use an empty string to remove it' },
        attendees: {
          type: 'array',
          description: 'Replace calendar user attendee IDs',
          items: { type: 'number' },
        },
        recurrences: {
          type: 'array',
          description: 'Replace recurrence RRULE strings',
          items: { type: 'string' },
        },
        alerts: {
          type: 'array',
          description: 'Replace notification offsets in minutes; use [] to clear',
          items: { type: 'number' },
        },
        file_uuids: {
          type: 'array',
          description: 'Replace attached file UUIDs',
          items: { type: 'string' },
        },
        checklist: {
          type: 'array',
          description: 'Replace event checklist items. Use [] to clear checklist.',
          items: {
            type: 'object',
            properties: {
              checked: { type: 'boolean', description: 'Whether the item is checked' },
              title: { type: 'string', description: 'Checklist item title' },
            },
            required: ['title'],
          },
        },
        virtual_user_attendees: {
          type: 'array',
          description: 'Replace virtual member attendees. Use [] to clear.',
          items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
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
            attendees: input.attendees,
            recurrences: input.recurrences,
            alerts: input.alerts,
            file_uuids: input.file_uuids,
            attachment: buildAttachment(input.checklist, input.virtual_user_attendees),
          }
        );

        logger.info('Tool: update_event completed', { uuid: event.uuid });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Event updated successfully',
                  event: formatEvent(event),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: update_event failed', { error });
        return commonWriteError(error, 'update event');
      }
    },
  };
}

// ============================================================================
// Delete Event Tool
// ============================================================================

export const DeleteEventInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
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
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        event_uuid: { type: 'string', description: 'The UUID of the event to delete (from get_events)' },
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
        return commonWriteError(error, 'delete event');
      }
    },
  };
}
