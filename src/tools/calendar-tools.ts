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
