/**
 * Calendar Metadata Tools for MCP
 * Provides label, member, and virtual member read/update operations.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError, TimeTreeAPIError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import { CALENDAR_ID_JSON_SCHEMA, CalendarIdSchema } from './shared-schemas.js';

export const GetCalendarMetadataInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
  include_deactivated: z.boolean().default(false).optional().describe('Include deactivated users when supported'),
});

export const UpdateCalendarLabelsInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
  labels: z.array(z.object({
    id: z.number().min(1).max(10).describe('Label ID 1-10'),
    name: z.string().optional().describe('New label name'),
    color: z.number().optional().describe('New label color integer'),
  })).min(1).describe('Labels to merge into the existing 10-label array'),
});

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

function metadataError(error: unknown, action: string) {
  if (error instanceof InvalidCalendarError) {
    return errorContent('Invalid calendar', 'Calendar not found. Please use list_calendars to get valid calendar IDs.');
  }

  if (error instanceof TimeTreeAPIError && error.statusCode === 403) {
    return errorContent('Authentication failed', 'CSRF token missing or invalid. Please try again.');
  }

  if ((error as { name?: string }).name === 'ZodError') {
    return errorContent('Invalid input', `Please provide valid data to ${action}`, (error as { errors?: unknown }).errors);
  }

  return errorContent(`Failed to ${action}`, (error as Error).message);
}

export function createGetCalendarLabelsTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_calendar_labels',
    description: 'Get TimeTree calendar labels (IDs, names, colors, ordering).',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
      },
      required: ['calendar_id'],
    },
    handler: async (args: unknown) => {
      try {
        const input = GetCalendarMetadataInputSchema.parse(args);
        logger.info('Tool: get_calendar_labels called', { calendar_id: input.calendar_id });

        const labels = await apiClient.getCalendarLabels(input.calendar_id.toString());

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  calendar_id: input.calendar_id,
                  labels: labels.map((label) => ({
                    id: label.id,
                    name: label.name ?? '',
                    color: label.color ?? null,
                    default_color: label.default_color ?? null,
                    order: label.order ?? null,
                  })),
                  total: labels.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: get_calendar_labels failed', { error });
        return metadataError(error, 'get calendar labels');
      }
    },
  };
}

export function createUpdateCalendarLabelsTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'update_calendar_labels',
    description:
      'Update TimeTree calendar label names/colors. The tool first reads existing labels and merges supplied labels so omitted labels are preserved.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        labels: {
          type: 'array',
          description: 'Labels to update/merge. Omitted labels are preserved.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Label ID 1-10' },
              name: { type: 'string', description: 'New label name' },
              color: { type: 'number', description: 'New label color integer' },
            },
            required: ['id'],
          },
        },
      },
      required: ['calendar_id', 'labels'],
    },
    handler: async (args: unknown) => {
      try {
        const input = UpdateCalendarLabelsInputSchema.parse(args);
        logger.info('Tool: update_calendar_labels called', {
          calendar_id: input.calendar_id,
          label_ids: input.labels.map((label) => label.id),
        });

        const labels = await apiClient.updateCalendarLabels(input.calendar_id.toString(), input.labels);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Calendar labels updated successfully',
                  calendar_id: input.calendar_id,
                  labels: labels.map((label) => ({
                    id: label.id,
                    name: label.name ?? '',
                    color: label.color ?? null,
                    default_color: label.default_color ?? null,
                    order: label.order ?? null,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: update_calendar_labels failed', { error });
        return metadataError(error, 'update calendar labels');
      }
    },
  };
}

export function createGetCalendarMembersTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_calendar_members',
    description: 'Get TimeTree calendar members from the verified v2 users endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        include_deactivated: { type: 'boolean', description: 'Include deactivated members (default: false)' },
      },
      required: ['calendar_id'],
    },
    handler: async (args: unknown) => {
      try {
        const input = GetCalendarMetadataInputSchema.parse(args);
        logger.info('Tool: get_calendar_members called', { calendar_id: input.calendar_id });

        let members = await apiClient.getCalendarMembers(input.calendar_id.toString());
        if (!input.include_deactivated) {
          members = members.filter((member) => !member.deactivated_at);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  calendar_id: input.calendar_id,
                  members: members.map((member) => ({
                    id: member.id,
                    user_id: member.user_id,
                    name: member.name,
                    role: member.role === 1 ? 'owner' : 'member',
                    is_active: !member.deactivated_at,
                  })),
                  total: members.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: get_calendar_members failed', { error });
        return metadataError(error, 'get calendar members');
      }
    },
  };
}

export function createGetCalendarVirtualMembersTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_calendar_virtual_members',
    description: 'Get TimeTree virtual members for a calendar from the verified virtual_users endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        include_deactivated: { type: 'boolean', description: 'Include deactivated virtual members (default: false)' },
      },
      required: ['calendar_id'],
    },
    handler: async (args: unknown) => {
      try {
        const input = GetCalendarMetadataInputSchema.parse(args);
        logger.info('Tool: get_calendar_virtual_members called', { calendar_id: input.calendar_id });

        let virtualMembers = await apiClient.getCalendarVirtualUsers(input.calendar_id.toString());
        if (!input.include_deactivated) {
          virtualMembers = virtualMembers.filter((member) => !member.deactivated_at);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  calendar_id: input.calendar_id,
                  virtual_members: virtualMembers.map((member) => ({
                    id: member.id,
                    name: member.name ?? '',
                    calendar_id: member.calendar_id ?? input.calendar_id,
                    is_active: !member.deactivated_at,
                    created_at: member.created_at ? new Date(member.created_at).toISOString() : null,
                    updated_at: member.updated_at ? new Date(member.updated_at).toISOString() : null,
                  })),
                  total: virtualMembers.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: get_calendar_virtual_members failed', { error });
        return metadataError(error, 'get calendar virtual members');
      }
    },
  };
}
