/**
 * Calendar Tools for MCP
 * Provides calendar listing functionality.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
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
    'lesson', 'school_event', 'circle', 'hobby', 'other']).default('lover'),
}).strict();

export function createCreateCalendarTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'create_calendar',
    description: 'Create a calendar owned by the authenticated user. Does not invite members or change existing calendars. Creation is not automatically retried.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 20 },
        purpose: { type: 'string', enum: ['family', 'private', 'lover', 'work', 'friend',
          'work_schedule', 'lesson', 'school_event', 'circle', 'hobby', 'other'], default: 'lover' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    handler: async (args: unknown) => {
      try {
        const input = CreateCalendarInputSchema.parse(args);
        const calendar = await apiClient.createCalendar(input.name, input.purpose);
        return { content: [{ type: 'text', text: JSON.stringify({
          id: String(calendar.id), name: calendar.name, alias_code: calendar.alias_code ?? null,
        }) }] };
      } catch {
        // Avoid forwarding response bodies or submitted private data to MCP logs.
        return { content: [{ type: 'text', text: JSON.stringify({
          error: 'Calendar creation failed. Check existing calendars before retrying.',
        }) }], isError: true };
      }
    },
  };
}
