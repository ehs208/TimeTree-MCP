/**
 * Recurring Event Tools for MCP
 * Change or delete one occurrence of a recurring event, or that occurrence and the ones
 * after it, the way the TimeTree web app does:
 *
 * - Delete one: add the occurrence to the series' EXDATE line.
 * - Edit one: create a separate event with parent_id = series uuid, then exclude the
 *   occurrence from the series.
 * - Delete this and following: end the series on the day of the previous occurrence
 *   (UNTIL=YYYYMMDD), or delete the series when this is its first occurrence.
 * - Edit this and following: end the series the same way and start a new series at the
 *   occurrence with the changes.
 *
 * Two-step changes undo the first step when the second fails, so a failure leaves no
 * duplicate occurrence behind. When the failed step may still have been applied, the series
 * is read again first, so the undo never removes occurrences the series no longer has.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { TimeTreeAPIError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import {
  addExdate,
  isOccurrence,
  parseRecurrence,
  shiftNeedsNewRule,
  splitRecurrence,
  type ParsedRecurrence,
  type SeriesTiming,
} from '../utils/recurrence.js';
import type { CreateEventInput, Event } from '../types/timetree.js';
import { buildAttachment, ChecklistSchema, commonWriteError, formatEvent, VirtualUserAttendeesSchema } from './event-crud-tools.js';
import {
  CALENDAR_ID_JSON_SCHEMA,
  CalendarIdSchema,
  DESTRUCTIVE,
  DESTRUCTIVE_IDEMPOTENT,
  EVENT_OUTPUT_SCHEMA,
  ISO_DATE_TIME,
  LABEL_ID_DESCRIPTION,
} from './shared-schemas.js';

/** get_events returns occurrence times as ISO strings; numbers (ms) are accepted too. */
const OccurrenceStartSchema = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const instant = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(instant)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'occurrence_start_at must be an ISO 8601 time or Unix ms' });
    return z.NEVER;
  }
  return instant;
});

const ScopeSchema = z.enum(['this', 'this_and_following']).default('this');

const OCCURRENCE_INPUT_PROPERTIES = {
  calendar_id: CALENDAR_ID_JSON_SCHEMA,
  event_uuid: { type: 'string', description: 'The recurring series uuid (the uuid get_events returns for every occurrence)' },
  occurrence_start_at: {
    type: ['string', 'number'],
    description: 'Start of the occurrence, exactly as get_events returned it (ISO 8601), or Unix ms',
  },
  scope: {
    type: 'string',
    enum: ['this', 'this_and_following'],
    description: '"this" (default) changes only this occurrence; "this_and_following" also changes every later one',
  },
} as const;

class OccurrenceError extends TimeTreeAPIError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'OccurrenceError';
  }
}

interface Series {
  event: Event;
  lines: string[];
  recurrence: ParsedRecurrence;
  timing: SeriesTiming;
}

async function loadSeries(
  apiClient: TimeTreeAPIClient,
  calendarId: string,
  eventUuid: string,
  occurrenceStart: number
): Promise<Series> {
  const event = await apiClient.getEvent(calendarId, eventUuid);
  const lines = (event.recurrences ?? []).filter((line): line is string => typeof line === 'string');
  if (!lines.some((line) => line.toUpperCase().startsWith('RRULE:'))) {
    throw new OccurrenceError(`${eventUuid} is not a recurring event. Use update_event or delete_event instead.`);
  }
  const recurrence = parseRecurrence(lines);
  if (!recurrence) {
    throw new OccurrenceError(
      `This series uses a recurrence rule this server cannot expand (${lines.join(' ')}). ` +
        'Change it in the TimeTree app, or use update_event to change the whole series.'
    );
  }
  // All-day events are stored at midnight UTC, so their dates are UTC dates.
  const timing = { start: event.start_at, timeZone: event.all_day ? 'UTC' : event.start_timezone };
  if (!isOccurrence(recurrence, timing, occurrenceStart)) {
    throw new OccurrenceError(
      'occurrence_start_at is not an occurrence of this series. Use the start_at of an occurrence from ' +
        'get_events with start_before set. An occurrence edited separately is its own event; change it with update_event.'
    );
  }
  return { event, lines, recurrence, timing };
}

function sameRecurrences(actual: unknown[] | undefined, expected: string[]): boolean {
  const normalize = (lines: unknown[]) =>
    lines.filter((line): line is string => typeof line === 'string').map((line) => line.trim().toUpperCase()).sort();
  const a = normalize(actual ?? []);
  const b = normalize(expected);
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/**
 * Second step of a two-step change: rewrite the series' recurrences. A failed request may
 * still have been applied (a lost response or a timeout), and then `created` holds the
 * occurrences the series gave up, so the series is read again before `created` is deleted.
 */
async function finishSeriesUpdate(
  apiClient: TimeTreeAPIClient,
  calendarId: string,
  seriesUuid: string,
  recurrences: string[],
  created: Event
) {
  try {
    await apiClient.updateEvent(calendarId, seriesUuid, { recurrences, silent: true });
    return;
  } catch (error) {
    let current: Event;
    try {
      current = await apiClient.getEvent(calendarId, seriesUuid);
    } catch (readError) {
      logger.error('Could not read the series after a failed update', { calendarId, seriesUuid, error: readError });
      throw new OccurrenceError(
        `The series update failed and its result could not be checked, so event ${created.uuid} was kept to avoid ` +
          'losing occurrences. Check the series with get_events; if that event duplicates an occurrence, delete it with delete_event.'
      );
    }
    if (sameRecurrences(current.recurrences, recurrences)) {
      logger.warn('Series update reported an error but was applied', { calendarId, seriesUuid });
      return;
    }
    await rollback(apiClient, calendarId, created);
    throw error;
  }
}

/**
 * First step of a two-step change. A create that fails without a clear answer (a timeout or
 * a server error) may still have been saved, so the caller is told to look before retrying.
 */
async function createStep(apiClient: TimeTreeAPIClient, calendarId: string, data: CreateEventInput): Promise<Event> {
  try {
    return await apiClient.createEvent(calendarId, data);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === undefined || status >= 500) {
      logger.error('Event create failed without a clear answer', { calendarId, error });
      throw new OccurrenceError(
        'Creating the event failed without a clear answer from TimeTree, so it may have been created anyway. ' +
          'The series was not changed. Check with get_events before retrying, and delete a duplicate with delete_event.'
      );
    }
    throw error;
  }
}

/** Undo the first step of a two-step change; the original error is what the caller sees. */
async function rollback(apiClient: TimeTreeAPIClient, calendarId: string, created: Event) {
  try {
    await apiClient.deleteEvent(calendarId, created.uuid);
  } catch (error) {
    logger.error('Rollback failed; an extra event may remain', { calendarId, eventUuid: created.uuid, error });
    throw new OccurrenceError(
      `The series update failed, and removing event ${created.uuid} created for it failed too. ` +
        'Delete that event with delete_event; the series is unchanged.'
    );
  }
}

function resultContent(payload: Record<string, unknown>) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

// ============================================================================
// Delete occurrence
// ============================================================================

export const DeleteEventOccurrenceInputSchema = z.object({
  calendar_id: CalendarIdSchema,
  event_uuid: z.string(),
  occurrence_start_at: OccurrenceStartSchema,
  scope: ScopeSchema,
});

export function createDeleteEventOccurrenceTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'delete_event_occurrence',
    description:
      'Delete one occurrence of a recurring event, or that occurrence and all later ones (scope "this_and_following"), ' +
      'keeping the rest of the series. Use delete_event to delete the whole series. ' +
      'Get the series uuid and occurrence_start_at from get_events with start_before set. ' +
      'Deleting from the first occurrence onward deletes the whole series. Cannot be undone.',
    annotations: DESTRUCTIVE_IDEMPOTENT,
    inputSchema: {
      type: 'object',
      properties: OCCURRENCE_INPUT_PROPERTIES,
      required: ['calendar_id', 'event_uuid', 'occurrence_start_at'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        series_uuid: { type: 'string' },
        occurrence_start_at: ISO_DATE_TIME,
        scope: { type: 'string', enum: ['this', 'this_and_following'] },
        series_deleted: { type: 'boolean', description: 'True when the whole series was deleted' },
      },
      required: ['success', 'series_uuid', 'occurrence_start_at', 'scope', 'series_deleted'],
    },
    handler: async (args: unknown) => {
      try {
        const input = DeleteEventOccurrenceInputSchema.parse(args);
        const calendarId = input.calendar_id.toString();
        const at = input.occurrence_start_at;
        logger.info('Tool: delete_event_occurrence called', { calendar_id: calendarId, event_uuid: input.event_uuid, scope: input.scope });

        const series = await loadSeries(apiClient, calendarId, input.event_uuid, at);

        let seriesDeleted = false;
        if (input.scope === 'this') {
          await apiClient.updateEvent(calendarId, input.event_uuid, { recurrences: addExdate(series.lines, at), silent: true });
        } else {
          const { before } = splitRecurrence(series.lines, series.recurrence, series.timing, at);
          if (before) {
            await apiClient.updateEvent(calendarId, input.event_uuid, { recurrences: before, silent: true });
          } else {
            await apiClient.deleteEvent(calendarId, input.event_uuid);
            seriesDeleted = true;
          }
        }

        return resultContent({
          success: true,
          message: seriesDeleted
            ? 'This was the first occurrence, so the whole series was deleted'
            : input.scope === 'this'
              ? 'Occurrence deleted; the rest of the series is unchanged'
              : 'This and later occurrences deleted; earlier occurrences are unchanged',
          series_uuid: input.event_uuid,
          occurrence_start_at: new Date(at).toISOString(),
          scope: input.scope,
          series_deleted: seriesDeleted,
        });
      } catch (error) {
        logger.error('Tool: delete_event_occurrence failed', { error });
        return commonWriteError(error, 'delete event occurrence');
      }
    },
  };
}

// ============================================================================
// Update occurrence
// ============================================================================

export const UpdateEventOccurrenceInputSchema = z.object({
  calendar_id: CalendarIdSchema,
  event_uuid: z.string(),
  occurrence_start_at: OccurrenceStartSchema,
  scope: ScopeSchema,
  title: z.string().min(1).optional(),
  start_at: z.number().optional(),
  end_at: z.number().optional(),
  start_timezone: z.string().optional(),
  end_timezone: z.string().optional(),
  label_id: z.number().int().min(1).max(10).optional(),
  note: z.string().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
  attendees: z.array(z.number()).optional(),
  alerts: z.array(z.number()).optional(),
  checklist: ChecklistSchema.optional(),
  virtual_user_attendees: VirtualUserAttendeesSchema.optional(),
  recurrences: z.array(z.string()).optional(),
});

type UpdateOccurrenceInput = z.infer<typeof UpdateEventOccurrenceInputSchema>;

const CHANGE_FIELDS = [
  'title', 'start_at', 'end_at', 'start_timezone', 'end_timezone', 'label_id', 'note', 'location', 'url',
  'attendees', 'alerts', 'checklist', 'virtual_user_attendees', 'recurrences',
] as const;

/** The series' fields with the requested changes, starting at the occurrence (or the new start). */
function occurrenceEvent(series: Event, at: number, input: UpdateOccurrenceInput): CreateEventInput {
  const startAt = input.start_at ?? at;
  const fileUuids = (series.files ?? []).map((file) => file.uuid);
  return {
    title: input.title ?? series.title,
    all_day: series.all_day,
    start_at: startAt,
    end_at: input.end_at ?? startAt + (series.end_at - series.start_at),
    start_timezone: input.start_timezone ?? series.start_timezone ?? 'UTC',
    end_timezone: input.end_timezone ?? series.end_timezone ?? 'UTC',
    label_id: input.label_id ?? series.label_id,
    category: series.category ?? 1,
    note: input.note ?? series.note ?? undefined,
    location: input.location ?? series.location ?? undefined,
    url: input.url ?? series.attachment?.url ?? series.url ?? undefined,
    attendees: input.attendees ?? series.attendees ?? [],
    alerts: input.alerts ?? series.alerts ?? [],
    recurrences: [],
    file_uuids: fileUuids,
    attachment: buildAttachment(
      input.checklist ?? series.attachment?.checklist ?? undefined,
      input.virtual_user_attendees ?? series.attachment?.virtual_user_attendees ?? undefined
    ),
    silent: true,
  };
}

export function createUpdateEventOccurrenceTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'update_event_occurrence',
    description:
      'Change one occurrence of a recurring event ("only this week"), or that occurrence and all later ones ' +
      '(scope "this_and_following", e.g. "from next month on"), keeping earlier occurrences as they are. ' +
      'Use update_event to change the whole series. Get the series uuid and occurrence_start_at from get_events ' +
      'with start_before set. Only provide the fields to change; start_at moves the occurrence and keeps its length ' +
      'unless end_at is given. scope "this" creates a separate event linked to the series (parent_id); ' +
      '"this_and_following" ends the series before the occurrence and starts a new series with a new uuid, ' +
      'or changes the whole series when it is the first occurrence.',
    annotations: DESTRUCTIVE,
    inputSchema: {
      type: 'object',
      properties: {
        ...OCCURRENCE_INPUT_PROPERTIES,
        title: { type: 'string', description: 'New title' },
        start_at: { type: 'number', description: 'New start time as Unix timestamp in milliseconds' },
        end_at: { type: 'number', description: 'New end time as Unix timestamp in milliseconds' },
        start_timezone: { type: 'string', description: 'New start timezone (e.g., "Asia/Seoul")' },
        end_timezone: { type: 'string', description: 'New end timezone' },
        label_id: { type: 'number', description: LABEL_ID_DESCRIPTION },
        note: { type: 'string', description: 'New note' },
        location: { type: 'string', description: 'New location' },
        url: { type: 'string', description: 'New related URL' },
        attendees: { type: 'array', items: { type: 'number' }, description: 'Replace attendee user IDs' },
        alerts: { type: 'array', items: { type: 'number' }, description: 'Replace notification offsets in minutes' },
        checklist: {
          type: 'array',
          description: 'Replace checklist items',
          items: {
            type: 'object',
            properties: { checked: { type: 'boolean' }, title: { type: 'string' } },
            required: ['title'],
          },
        },
        virtual_user_attendees: {
          type: 'array',
          description: 'Replace virtual member attendees',
          items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        },
        recurrences: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Only with scope "this_and_following": a new RRULE for the new series, e.g. ["RRULE:FREQ=WEEKLY;INTERVAL=2"]. ' +
            'Required when start_at moves the occurrences to another day and the rule uses BYDAY, BYMONTHDAY, or BYMONTH.',
        },
      },
      required: ['calendar_id', 'event_uuid', 'occurrence_start_at'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        series_uuid: { type: 'string', description: 'The series the occurrence belonged to' },
        occurrence_start_at: ISO_DATE_TIME,
        scope: { type: 'string', enum: ['this', 'this_and_following'] },
        result: {
          type: 'string',
          enum: ['occurrence_event_created', 'new_series_created', 'whole_series_updated'],
        },
        event: EVENT_OUTPUT_SCHEMA,
      },
      required: ['success', 'series_uuid', 'occurrence_start_at', 'scope', 'result', 'event'],
    },
    handler: async (args: unknown) => {
      try {
        const input = UpdateEventOccurrenceInputSchema.parse(args);
        if (!CHANGE_FIELDS.some((field) => input[field] !== undefined)) {
          throw new OccurrenceError('Provide at least one field to change.');
        }
        if (input.recurrences !== undefined && input.scope !== 'this_and_following') {
          throw new OccurrenceError('recurrences can only change with scope "this_and_following".');
        }
        const calendarId = input.calendar_id.toString();
        const at = input.occurrence_start_at;
        logger.info('Tool: update_event_occurrence called', { calendar_id: calendarId, event_uuid: input.event_uuid, scope: input.scope });

        const series = await loadSeries(apiClient, calendarId, input.event_uuid, at);
        const changed = occurrenceEvent(series.event, at, input);

        let result: 'occurrence_event_created' | 'new_series_created' | 'whole_series_updated';
        let event: Event;
        if (input.scope === 'this') {
          event = await createStep(apiClient, calendarId, { ...changed, parent_id: input.event_uuid });
          await finishSeriesUpdate(apiClient, calendarId, input.event_uuid, addExdate(series.lines, at), event);
          result = 'occurrence_event_created';
        } else {
          const shift = changed.start_at - at;
          if (input.recurrences === undefined && shiftNeedsNewRule(series.recurrence, series.timing, at, shift)) {
            throw new OccurrenceError(
              'This moves the occurrences to another day, but the series repeats on set days ' +
                `(${series.lines.find((line) => line.toUpperCase().startsWith('RRULE:'))}). ` +
                'Pass recurrences with the new rule, e.g. ["RRULE:FREQ=WEEKLY;BYDAY=TU"].'
            );
          }
          const split = splitRecurrence(series.lines, series.recurrence, series.timing, at, shift);
          if (!split.before) {
            // Earlier occurrences may all be deleted; a moved start then needs the reduced COUNT.
            const recurrences = input.recurrences ?? (input.start_at === undefined ? undefined : split.after);
            const { title, start_at, end_at, start_timezone, end_timezone, label_id, note, location, url, attendees,
              alerts } = input;
            event = await apiClient.updateEvent(calendarId, input.event_uuid, {
              title, start_at, end_at: end_at ?? (start_at === undefined ? undefined : changed.end_at),
              start_timezone, end_timezone, label_id, note, location, url, attendees, alerts, recurrences,
              attachment: buildAttachment(input.checklist, input.virtual_user_attendees),
            });
            result = 'whole_series_updated';
          } else {
            event = await createStep(apiClient, calendarId, { ...changed, recurrences: input.recurrences ?? split.after });
            await finishSeriesUpdate(apiClient, calendarId, input.event_uuid, split.before, event);
            result = 'new_series_created';
          }
        }

        return resultContent({
          success: true,
          message: {
            occurrence_event_created: 'Occurrence changed; it is now a separate event and the rest of the series is unchanged',
            new_series_created: 'Earlier occurrences are unchanged; this and later occurrences are now a new series',
            whole_series_updated: 'This was the first occurrence, so the whole series was changed',
          }[result],
          series_uuid: input.event_uuid,
          occurrence_start_at: new Date(at).toISOString(),
          scope: input.scope,
          result,
          event: formatEvent(event),
        });
      } catch (error) {
        logger.error('Tool: update_event_occurrence failed', { error });
        return commonWriteError(error, 'update event occurrence');
      }
    },
  };
}
