/**
 * Calendar Tools for MCP
 * Provides calendar listing functionality.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { AuthenticationError } from '../client/auth.js';
import { logger } from '../utils/logger.js';
import { ADDITIVE, READ_ONLY } from './shared-schemas.js';

export const ListCalendarsInputSchema = z.object({});

export function createListCalendarsTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'list_calendars',
    description:
      'List your active TimeTree calendars with their IDs, names, and members. Call this first: every other tool ' +
      'needs a calendar_id from here. Use the member names to pick a calendar when the user mentions a person ' +
      '(e.g., "events with [name]").',
    annotations: READ_ONLY,
    outputSchema: {
      type: 'object',
      properties: {
        calendars: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'calendar_id for the other tools' },
              name: { type: 'string' },
              alias_code: { type: ['string', 'null'] },
              is_active: { type: 'boolean' },
              users: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { name: { type: 'string' }, role: { type: 'string', enum: ['owner', 'member'] } },
                },
              },
            },
            required: ['id', 'name'],
          },
        },
        total: { type: 'number' },
      },
      required: ['calendars', 'total'],
    },
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
    description:
      'Create a new, empty calendar owned by you and return its ID. Does not invite anyone or change existing ' +
      'calendars. Name is 1-20 characters and purpose is required. After a timeout or server error, check ' +
      'list_calendars before retrying, since the calendar may already exist.',
    annotations: ADDITIVE,
    outputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' }, alias_code: { type: ['string', 'null'] } },
      required: ['id', 'name'],
    },
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
            : issue.code === 'invalid_value' ? 'Choose a supported calendar purpose'
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

export function createGetCurrentUserTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_current_user',
    description:
      'Return the signed-in TimeTree user\'s user ID and name. Use it to find "me" among calendar members ' +
      '(get_calendar_members), event attendees, comment authors, and activity.',
    annotations: READ_ONLY,
    outputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'number', description: 'Same as user_id in get_calendar_members and event attendees' },
        name: { type: ['string', 'null'] },
      },
      required: ['user_id'],
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      try {
        const user = await apiClient.getCurrentUser();
        return {
          content: [{ type: 'text', text: JSON.stringify({ user_id: user.id, name: user.name ?? null }, null, 2) }],
        };
      } catch (error) {
        logger.error('Tool: get_current_user failed', { error });
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Failed to fetch current user', message: (error as Error).message }, null, 2) }],
          isError: true,
        };
      }
    },
  };
}
