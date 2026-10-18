/**
 * Calendar Metadata Tools for MCP
 * Provides label and member reads and updates, and virtual member management.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError, TimeTreeAPIError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import {
  ADDITIVE,
  CALENDAR_ID_JSON_SCHEMA,
  CalendarIdSchema,
  DESTRUCTIVE_IDEMPOTENT,
  READ_ONLY,
} from './shared-schemas.js';
import { VIRTUAL_MEMBER_TYPES, type CalendarVirtualUser, type VirtualUserInput } from '../types/timetree.js';

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

const nullable = (type: string) => ({ type: [type, 'null'] });

const LABEL_LIST_OUTPUT = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
      color: nullable('number'),
      default_color: nullable('number'),
      order: nullable('number'),
    },
    required: ['id', 'name'],
  },
} as const;

const VIRTUAL_MEMBER_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: ['string', 'number'], description: 'Use in virtual_user_attendees of events' },
    uuid: { type: ['string', 'null'], description: 'Use as virtual_member_uuid to update or delete' },
    name: { type: 'string' },
    type: { type: ['string', 'null'], description: 'child, pet, car, grandfather, grandmother, or other' },
    one_word: nullable('string'),
    birthday: { type: ['string', 'number', 'null'] },
    shows_birthday: nullable('boolean'),
    calendar_id: { type: ['number', 'string'] },
    is_active: { type: 'boolean' },
    created_at: nullable('string'),
    updated_at: nullable('string'),
  },
  required: ['id', 'name', 'is_active'],
} as const;

function formatVirtualMember(member: CalendarVirtualUser, calendarId: number) {
  return {
    id: member.id,
    uuid: member.uuid ?? null,
    name: member.name ?? '',
    type: member.account_type ?? null,
    one_word: member.one_word || null,
    birthday: member.birthday ?? null,
    shows_birthday: member.shows_birthday ?? null,
    calendar_id: member.calendar_id ?? calendarId,
    is_active: !member.deactivated_at,
    created_at: member.created_at ? new Date(member.created_at).toISOString() : null,
    updated_at: member.updated_at ? new Date(member.updated_at).toISOString() : null,
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

function metadataError(error: unknown, action: string) {
  if (error instanceof InvalidCalendarError) {
    return errorContent('Invalid calendar', 'Calendar not found. Please use list_calendars to get valid calendar IDs.');
  }

  if (error instanceof TimeTreeAPIError && error.statusCode === 403) {
    return errorContent('Authentication failed', 'CSRF token missing or invalid. Please try again.');
  }

  if (error instanceof TimeTreeAPIError && error.statusCode === 404) {
    return errorContent('Not found', error.message);
  }

  if ((error as { name?: string }).name === 'ZodError') {
    return errorContent('Invalid input', `Please provide valid data to ${action}`, (error as { errors?: unknown }).errors);
  }

  return errorContent(`Failed to ${action}`, (error as Error).message);
}

export function createGetCalendarLabelsTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_calendar_labels',
    description:
      'List the 10 color labels of a calendar with their IDs, names, colors, and order. Use the IDs as label_id ' +
      'when creating or filtering events; rename or recolor them with update_calendar_labels.',
    annotations: READ_ONLY,
    outputSchema: {
      type: 'object',
      properties: { calendar_id: { type: 'number' }, labels: LABEL_LIST_OUTPUT, total: { type: 'number' } },
      required: ['calendar_id', 'labels', 'total'],
    },
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
      'Rename or recolor calendar labels for everyone in the calendar, and return all labels. Only the labels you ' +
      'pass change; the others are read first and kept. Label IDs come from get_calendar_labels.',
    annotations: DESTRUCTIVE_IDEMPOTENT,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        calendar_id: { type: 'number' },
        labels: LABEL_LIST_OUTPUT,
      },
      required: ['success', 'calendar_id', 'labels'],
    },
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
    description:
      'List the people who share a calendar (members with TimeTree accounts) with their user IDs, names, and roles. ' +
      'Use user_id for event attendees. For members without an account, such as children or pets, use ' +
      'get_calendar_virtual_members.',
    annotations: READ_ONLY,
    outputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'number' },
        members: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              user_id: { type: 'number', description: 'Use in event attendees' },
              name: { type: 'string' },
              role: { type: 'string', enum: ['owner', 'member'] },
              is_active: { type: 'boolean' },
            },
            required: ['user_id', 'name', 'role', 'is_active'],
          },
        },
        total: { type: 'number' },
      },
      required: ['calendar_id', 'members', 'total'],
    },
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
    description:
      'List the virtual members of a calendar: people or things without a TimeTree account, such as a child, pet, ' +
      'or car, that events can be assigned to. Returns id (for virtual_user_attendees on events) and uuid (to update ' +
      'or delete the member). For members with accounts use get_calendar_members.',
    annotations: READ_ONLY,
    outputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'number' },
        virtual_members: { type: 'array', items: VIRTUAL_MEMBER_OUTPUT_SCHEMA },
        total: { type: 'number' },
      },
      required: ['calendar_id', 'virtual_members', 'total'],
    },
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
                  virtual_members: virtualMembers.map((member) => formatVirtualMember(member, input.calendar_id)),
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

// ============================================================================
// Virtual member management
// ============================================================================

const BirthdaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'birthday must be YYYY-MM-DD');

const VirtualMemberFieldsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.enum(VIRTUAL_MEMBER_TYPES).optional(),
  one_word: z.string().optional(),
  birthday: BirthdaySchema.nullable().optional(),
  shows_birthday: z.boolean().optional(),
});

export const CreateVirtualMemberInputSchema = VirtualMemberFieldsSchema.extend({
  calendar_id: CalendarIdSchema,
  name: z.string().trim().min(1),
});

export const UpdateVirtualMemberInputSchema = VirtualMemberFieldsSchema.extend({
  calendar_id: CalendarIdSchema,
  virtual_member_uuid: z.string().min(1),
});

export const DeleteVirtualMemberInputSchema = z.object({
  calendar_id: CalendarIdSchema,
  virtual_member_uuid: z.string().min(1),
});

const VIRTUAL_MEMBER_FIELD_PROPERTIES = {
  name: { type: 'string', description: 'Display name' },
  type: { type: 'string', enum: [...VIRTUAL_MEMBER_TYPES], description: 'Kind of member (default: other)' },
  one_word: { type: 'string', description: 'Short description, e.g. "eldest son" or "toy poodle"' },
  birthday: { type: ['string', 'null'], description: 'Birthday as YYYY-MM-DD; null removes it' },
  shows_birthday: { type: 'boolean', description: 'Show the birthday on the calendar' },
} as const;

const VIRTUAL_MEMBER_RESULT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: { success: { type: 'boolean' }, message: { type: 'string' }, virtual_member: VIRTUAL_MEMBER_OUTPUT_SCHEMA },
  required: ['success', 'virtual_member'],
} as const;

function virtualUserInput(input: z.infer<typeof VirtualMemberFieldsSchema>): VirtualUserInput {
  return {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.type !== undefined && { account_type: input.type }),
    ...(input.one_word !== undefined && { one_word: input.one_word }),
    ...(input.birthday !== undefined && { birthday: input.birthday }),
    ...(input.shows_birthday !== undefined && { shows_birthday: input.shows_birthday }),
  };
}

function textResult(payload: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

export function createCreateVirtualMemberTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'create_virtual_member',
    description:
      'Add a virtual member to a calendar: someone or something without a TimeTree account, such as a child, pet, ' +
      'or car, so events can be assigned to it with virtual_user_attendees. Everyone in the calendar sees it. ' +
      'A calendar can have at most 10. Returns the new member with its id and uuid.',
    annotations: ADDITIVE,
    outputSchema: VIRTUAL_MEMBER_RESULT_OUTPUT_SCHEMA,
    inputSchema: {
      type: 'object',
      properties: { calendar_id: CALENDAR_ID_JSON_SCHEMA, ...VIRTUAL_MEMBER_FIELD_PROPERTIES },
      required: ['calendar_id', 'name'],
    },
    handler: async (args: unknown) => {
      try {
        const input = CreateVirtualMemberInputSchema.parse(args);
        logger.info('Tool: create_virtual_member called', { calendar_id: input.calendar_id });

        const member = await apiClient.createVirtualUser(input.calendar_id.toString(), virtualUserInput(input));
        return textResult({
          success: true,
          message: 'Virtual member added',
          virtual_member: formatVirtualMember(member, input.calendar_id),
        });
      } catch (error) {
        logger.error('Tool: create_virtual_member failed', { error });
        return metadataError(error, 'create virtual member');
      }
    },
  };
}

export function createUpdateVirtualMemberTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'update_virtual_member',
    description:
      'Change a virtual member\'s name, type, short description, or birthday, and return it. Only provide the fields ' +
      'to change. Get virtual_member_uuid from get_calendar_virtual_members (the uuid, not the id).',
    annotations: DESTRUCTIVE_IDEMPOTENT,
    outputSchema: VIRTUAL_MEMBER_RESULT_OUTPUT_SCHEMA,
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        virtual_member_uuid: { type: 'string', description: 'The uuid from get_calendar_virtual_members' },
        ...VIRTUAL_MEMBER_FIELD_PROPERTIES,
      },
      required: ['calendar_id', 'virtual_member_uuid'],
    },
    handler: async (args: unknown) => {
      try {
        const input = UpdateVirtualMemberInputSchema.parse(args);
        const changes = virtualUserInput(input);
        if (Object.keys(changes).length === 0) {
          return errorContent('Invalid input', 'Provide at least one field to change.');
        }
        logger.info('Tool: update_virtual_member called', { calendar_id: input.calendar_id });

        const member = await apiClient.updateVirtualUser(
          input.calendar_id.toString(),
          input.virtual_member_uuid,
          changes
        );
        return textResult({
          success: true,
          message: 'Virtual member updated',
          virtual_member: formatVirtualMember(member, input.calendar_id),
        });
      } catch (error) {
        logger.error('Tool: update_virtual_member failed', { error });
        return metadataError(error, 'update virtual member');
      }
    },
  };
}

export function createDeleteVirtualMemberTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'delete_virtual_member',
    description:
      'Remove a virtual member from a calendar. Cannot be undone. Get virtual_member_uuid from ' +
      'get_calendar_virtual_members (the uuid, not the id).',
    annotations: DESTRUCTIVE_IDEMPOTENT,
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        deleted_virtual_member_uuid: { type: 'string' },
      },
      required: ['success', 'deleted_virtual_member_uuid'],
    },
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        virtual_member_uuid: { type: 'string', description: 'The uuid from get_calendar_virtual_members' },
      },
      required: ['calendar_id', 'virtual_member_uuid'],
    },
    handler: async (args: unknown) => {
      try {
        const input = DeleteVirtualMemberInputSchema.parse(args);
        logger.info('Tool: delete_virtual_member called', { calendar_id: input.calendar_id });

        await apiClient.deleteVirtualUser(input.calendar_id.toString(), input.virtual_member_uuid);
        return textResult({
          success: true,
          message: 'Virtual member removed',
          deleted_virtual_member_uuid: input.virtual_member_uuid,
        });
      } catch (error) {
        logger.error('Tool: delete_virtual_member failed', { error });
        return metadataError(error, 'delete virtual member');
      }
    },
  };
}
