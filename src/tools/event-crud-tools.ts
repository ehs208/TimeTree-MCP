/**
 * Event CRUD Tools for MCP
 * Provides event creation, update, and deletion functionality.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError, TimeTreeAPIError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import { stringRecurrences } from '../utils/recurrence.js';
import {
  ADDITIVE,
  CALENDAR_ID_JSON_SCHEMA,
  CalendarIdSchema,
  deletionOutputSchema,
  DESTRUCTIVE_IDEMPOTENT,
  EVENT_RESULT_OUTPUT_SCHEMA,
  LABEL_ID_DESCRIPTION,
} from './shared-schemas.js';
import { getLabelColorName } from '../types/label-colors.js';
import type { ChecklistItem, Event } from '../types/timetree.js';

export const ChecklistSchema = z.array(z.object({
  checked: z.boolean().default(false).describe('Whether the checklist item is checked'),
  title: z.string().min(1).describe('Checklist item title'),
}));

export const VirtualUserAttendeesSchema = z.array(z.union([z.string(), z.number()]));

export function buildAttachment(
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

export function formatEvent(event: Event) {
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
    url: event.attachment?.url || event.url || null,
    category: event.category || null,
    attendees: event.attendees || [],
    alerts: event.alerts || [],
    recurrences: stringRecurrences(event.recurrences),
    checklist: event.attachment?.checklist || null,
    virtual_user_attendees: event.attachment?.virtual_user_attendees || [],
    parent_id: event.parent_id || null,
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

export function commonWriteError(error: unknown, action: string) {
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
      (error as { issues?: unknown }).issues
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
  label_id: z.number().min(1).max(10).optional().describe('Color label ID (1-10)'),
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
      'Create an event in a TimeTree calendar and return it with its uuid. Other calendar members see it, ' +
      'and attendees may be notified. Supports all-day events, reminders, RRULE recurrence, attendees ' +
      '(user IDs from get_calendar_members), virtual member attendees, and a checklist. ' +
      'For a memo without a date use create_memo; to duplicate an existing event use copy_event.',
    annotations: ADDITIVE,
    outputSchema: EVENT_RESULT_OUTPUT_SCHEMA,
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
        label_id: { type: 'number', description: LABEL_ID_DESCRIPTION },
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
      'Change an event and return the updated event. Only provide the fields to change; array fields ' +
      '(attendees, alerts, recurrences, checklist, virtual attendees) replace the current values. ' +
      'For a recurring event this changes every occurrence; to change one occurrence or the ones after it, ' +
      'use update_event_occurrence. For memos use update_memo.',
    annotations: DESTRUCTIVE_IDEMPOTENT,
    outputSchema: EVENT_RESULT_OUTPUT_SCHEMA,
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
        label_id: { type: 'number', description: LABEL_ID_DESCRIPTION },
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
      'Delete an event, including every occurrence of a recurring event. Cannot be undone. ' +
      'To delete one occurrence or the ones after it, use delete_event_occurrence. For memos use delete_memo.',
    annotations: DESTRUCTIVE_IDEMPOTENT,
    outputSchema: deletionOutputSchema('deleted_event_uuid'),
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

// ============================================================================
// Copy Event Tool
// ============================================================================

export const CopyEventInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar the event is in'),
  event_uuid: z.string().describe('The UUID of the event to copy'),
  start_at: z.number().describe('Start time of the copy as Unix timestamp in milliseconds'),
  end_at: z.number().optional().describe('End time of the copy; defaults to the same length as the original'),
  title: z.string().min(1).optional().describe('Title of the copy; defaults to the original title'),
  target_calendar_id: CalendarIdSchema.optional().describe('Calendar to copy into; defaults to the same calendar'),
});

/**
 * Copy an event the way the web app's Copy action does: a new event with copy=true and no
 * parent_id. Recurrence is not copied. Attendees, virtual attendees, and files belong to
 * the source calendar, so they are kept only when copying within it.
 */
export function createCopyEventTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'copy_event',
    description:
      'Copy an existing event to a new date and time, optionally into another calendar, and return the new event. ' +
      'Keeps the title, note, location, URL, label, reminders, and checklist; recurrence is not copied, so the copy ' +
      'is a single event. Attendees and virtual attendees are kept only within the same calendar. ' +
      'The original is unchanged.',
    annotations: ADDITIVE,
    outputSchema: EVENT_RESULT_OUTPUT_SCHEMA,
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        event_uuid: { type: 'string', description: 'The UUID of the event to copy (from get_events)' },
        start_at: { type: 'number', description: 'Start time of the copy as Unix timestamp in milliseconds' },
        end_at: {
          type: 'number',
          description: 'End time of the copy as Unix timestamp in milliseconds (default: same length as the original)',
        },
        title: { type: 'string', description: 'Title of the copy (default: the original title)' },
        target_calendar_id: {
          type: 'string',
          description: 'Calendar ID from list_calendars to copy into (default: the same calendar)',
        },
      },
      required: ['calendar_id', 'event_uuid', 'start_at'],
    },
    handler: async (args: unknown) => {
      try {
        const input = CopyEventInputSchema.parse(args);
        const sourceCalendarId = input.calendar_id.toString();
        const targetCalendarId = (input.target_calendar_id ?? input.calendar_id).toString();
        const sameCalendar = targetCalendarId === sourceCalendarId;
        logger.info('Tool: copy_event called', {
          calendar_id: sourceCalendarId,
          event_uuid: input.event_uuid,
          target_calendar_id: targetCalendarId,
        });

        const source = await apiClient.getEvent(sourceCalendarId, input.event_uuid);
        const event = await apiClient.createEvent(targetCalendarId, {
          title: input.title ?? source.title,
          all_day: source.all_day,
          start_at: input.start_at,
          end_at: input.end_at ?? input.start_at + (source.end_at - source.start_at),
          start_timezone: source.start_timezone ?? 'UTC',
          end_timezone: source.end_timezone ?? 'UTC',
          label_id: source.label_id,
          category: source.category ?? 1,
          note: source.note ?? undefined,
          location: source.location ?? undefined,
          location_lat: source.location_lat ?? undefined,
          location_lon: source.location_lon ?? undefined,
          url: source.attachment?.url ?? source.url ?? undefined,
          attendees: sameCalendar ? source.attendees ?? [] : [],
          recurrences: [],
          alerts: source.alerts ?? [],
          file_uuids: sameCalendar ? (source.files ?? []).map((file) => file.uuid) : [],
          attachment: buildAttachment(
            source.attachment?.checklist?.length ? source.attachment.checklist : undefined,
            sameCalendar && source.attachment?.virtual_user_attendees?.length
              ? source.attachment.virtual_user_attendees
              : undefined
          ),
          copy: true,
        });

        logger.info('Tool: copy_event completed', { uuid: event.uuid });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: 'Event copied successfully', event: formatEvent(event) },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: copy_event failed', { error });
        return commonWriteError(error, 'copy event');
      }
    },
  };
}
