/**
 * Calendar Tools for MCP
 * Provides calendar listing functionality.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { AuthenticationError } from '../client/auth.js';
import { logger } from '../utils/logger.js';

export const ListCalendarsInputSchema = z.object({});

export function createListCalendarsTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'list_calendars',
    description:
      'List all active TimeTree calendars for the authenticated user. Returns calendar ID, name, alias code, and participating users. Use this to identify which calendar to query when the user mentions a specific person (e.g., "events with [name]").',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      try {
        logger.info('Tool: list_calendars called');

        const calendars = await apiClient.getCalendars();

        const formattedCalendars = calendars.map((cal) => {
          // Filter active users only (deactivated_at is null)
          const activeUsers = cal.calendar_users
            ?.filter((user) => !user.deactivated_at)
            .map((user) => ({
              name: user.name,
              role: user.role === 1 ? 'owner' : 'member',
            })) || [];

          return {
            id: cal.id.toString(),
            name: cal.name,
            alias_code: cal.alias_code || null,
            is_active: true,
            users: activeUsers,
          };
        });

        const result = {
          calendars: formattedCalendars,
          total: formattedCalendars.length,
        };

        logger.info('Tool: list_calendars completed', { total: result.total });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: list_calendars failed', { error });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'Failed to fetch calendars',
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

export const CreateCalendarInputSchema = z.object({
  name: z.string().trim().min(1).max(20),
  purpose: z.enum(['family', 'private', 'lover', 'work', 'friend', 'work_schedule',
    'lesson', 'school_event', 'circle', 'hobby', 'other']),
}).strict();

export function createCreateCalendarTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'create_calendar',
    description: 'Create a calendar owned by the authenticated user. Does not invite members or change existing calendars. Purpose is required. Requests are rate-limited; timeouts and server errors are not retried.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 20 },
        purpose: { type: 'string', enum: ['family', 'private', 'lover', 'work', 'friend',
          'work_schedule', 'lesson', 'school_event', 'circle', 'hobby', 'other'] },
      },
      required: ['name', 'purpose'],
      additionalProperties: false,
    },
    handler: async (args: unknown) => {
      const parsed = CreateCalendarInputSchema.safeParse(args);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => ({
          field: issue.path[0] === 'name' || issue.path[0] === 'purpose' ? issue.path[0] : 'input',
          reason: issue.code === 'too_small' ? 'Must contain at least 1 character'
            : issue.code === 'too_big' ? 'Must contain at most 20 characters'
            : issue.code === 'invalid_enum_value' ? 'Choose a supported calendar purpose'
            : issue.code === 'unrecognized_keys' ? 'Only name and purpose are allowed'
            : 'Required field with a supported type and value',
        }));
        return { content: [{ type: 'text', text: JSON.stringify({
          error: 'Invalid calendar input', issues,
        }) }], isError: true };
      }
      // Response validation can fail after the calendar was created; keep it out of input errors.
      try {
        const calendar = await apiClient.createCalendar(parsed.data.name, parsed.data.purpose);
        return { content: [{ type: 'text', text: JSON.stringify({
          id: String(calendar.id), name: calendar.name, alias_code: calendar.alias_code ?? null,
        }) }] };
      } catch (error) {
        const statusCode = error && typeof error === 'object' && 'statusCode' in error
          ? error.statusCode : undefined;
        if (error instanceof AuthenticationError || statusCode === 401 || statusCode === 403) {
          return { content: [{ type: 'text', text: JSON.stringify({
            error: 'Authentication failed',
          }) }], isError: true };
        }
        logger.error('Tool: create_calendar failed', { error });
        return { content: [{ type: 'text', text: JSON.stringify({
          error: 'Calendar creation failed. Check existing calendars before retrying.',
        }) }], isError: true };
      }
    },
  };
}
