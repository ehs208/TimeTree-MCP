/**
 * Activity Tools for MCP
 * Reads the calendar's recent change feed (who created, edited, or deleted what).
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import { CALENDAR_ID_JSON_SCHEMA, CalendarIdSchema } from './shared-schemas.js';

/**
 * Activity status codes observed in the TimeTree web app's activity panel.
 * Unknown codes are reported as `other_<code>`.
 */
const ACTIVITY_NAMES: Record<number, string> = {
  1: 'created',
  2: 'title_updated',
  3: 'date_updated',
  4: 'label_updated',
  5: 'note_updated',
  6: 'location_updated',
  8: 'reminder_updated',
  11: 'url_updated',
  13: 'checklist_updated',
  15: 'deleted',
};

export const GetRecentActivityInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
  since: z
    .number()
    .optional()
    .describe('Only return activity after this Unix timestamp in milliseconds'),
  limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of events to return (default 20)'),
});

function activityName(code: number): string {
  return ACTIVITY_NAMES[code] ?? `other_${code}`;
}

function errorContent(error: string, message: string, details?: unknown) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error, message, ...(details !== undefined && { details }) }, null, 2),
      },
    ],
    isError: true,
  };
}

export function createGetRecentActivityTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_recent_activity',
    description:
      'Get recently changed events and memos in a calendar, newest first, with who changed what ' +
      '(created, title/date/label/note/location/reminder/URL/checklist updated, deleted). ' +
      'TimeTree keeps only the last few activities per event. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        since: {
          type: 'number',
          description: 'Only return activity after this Unix timestamp in milliseconds',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of events to return (1-100, default 20)',
        },
      },
      required: ['calendar_id'],
    },
    handler: async (args: unknown) => {
      try {
        const input = GetRecentActivityInputSchema.parse(args);
        const calendarId = String(input.calendar_id);
        logger.info('Tool: get_recent_activity called', { calendar_id: calendarId, since: input.since });

        const [events, members] = await Promise.all([
          apiClient.getLatestEventActivities([calendarId]),
          apiClient.getCalendarMembers(calendarId).catch(() => []),
        ]);
        const memberNames = new Map(members.map((member) => [member.user_id, member.name]));

        const items = events
          .map((event) => {
            const activities = event.activities
              .filter((activity) => input.since === undefined || activity.updated_at > input.since)
              .sort((a, b) => b.updated_at - a.updated_at)
              .map((activity) => ({
                actions: activity.status.map(activityName),
                user_id: activity.user_id ?? null,
                user_name: activity.user_id != null ? memberNames.get(activity.user_id) ?? null : null,
                at: new Date(activity.updated_at).toISOString(),
              }));
            return { event, activities };
          })
          .filter(({ activities }) => activities.length > 0)
          .slice(0, input.limit)
          .map(({ event, activities }) => ({
            uuid: event.id,
            title: event.title,
            kind: event.category === 2 ? 'memo' : 'event',
            start_at: event.start_at !== undefined ? new Date(event.start_at).toISOString() : null,
            all_day: event.all_day ?? null,
            deleted: event.deactivated_at != null,
            activities,
          }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ calendar_id: calendarId, events: items, total: items.length }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: get_recent_activity failed', { error });
        if (error instanceof InvalidCalendarError) {
          return errorContent('Invalid calendar', 'Calendar not found. Please use list_calendars to get valid calendar IDs.');
        }
        if ((error as { name?: string }).name === 'ZodError') {
          return errorContent('Invalid input', 'Please provide valid activity query parameters', (error as { errors?: unknown }).errors);
        }
        return errorContent('Failed to get recent activity', (error as Error).message);
      }
    },
  };
}
