/**
 * Memo Tools for MCP
 * TimeTree represents memos as category=2 all-day events.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { InvalidCalendarError, TimeTreeAPIError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import { CALENDAR_ID_JSON_SCHEMA, CalendarIdSchema } from './shared-schemas.js';
import { getLabelColorName } from '../types/label-colors.js';
import type { Event } from '../types/timetree.js';

const ChecklistSchema = z.array(z.object({
  checked: z.boolean().default(false).describe('Whether the checklist item is checked'),
  title: z.string().min(1).describe('Checklist item title'),
}));

const VirtualUserAttendeesSchema = z.array(z.union([z.string(), z.number()]));

export const ListMemosInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID to list memos from'),
  updated_after: z.number().optional().describe('Only return memos updated after this Unix timestamp in milliseconds'),
  limit: z.number().positive().optional().describe('Optional limit on number of memos returned'),
});

export const CreateMemoInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID to create the memo in'),
  title: z.string().min(1).describe('Memo title'),
  note: z.string().optional().describe('Memo body text'),
  label_id: z.number().min(1).max(10).optional().describe('Color label ID (1-10)'),
  location: z.string().optional().describe('Optional memo location'),
  url: z.string().optional().describe('Optional related URL'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Optional memo date in YYYY-MM-DD; defaults to today UTC'),
  checklist: ChecklistSchema.optional().describe('Checklist items for the memo'),
  virtual_user_attendees: VirtualUserAttendeesSchema.optional().describe('Virtual member IDs/names related to the memo'),
});

export const UpdateMemoInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
  memo_uuid: z.string().describe('The memo UUID (same as event UUID)'),
  title: z.string().min(1).optional().describe('New memo title'),
  note: z.string().optional().describe('New memo body text'),
  label_id: z.number().min(1).max(10).optional().describe('New color label ID (1-10)'),
  location: z.string().optional().describe('New memo location'),
  url: z.string().optional().describe('New related URL; use an empty string to remove it'),
  checklist: ChecklistSchema.optional().describe('Replace checklist items; use [] to clear'),
  virtual_user_attendees: VirtualUserAttendeesSchema.optional().describe('Replace virtual member attendees; use [] to clear'),
});

export const DeleteMemoInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
  memo_uuid: z.string().describe('The memo UUID (same as event UUID)'),
});

function dateToUtcMidnight(date?: string): number | undefined {
  if (!date) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatMemo(memo: Event) {
  return {
    uuid: memo.uuid,
    calendar_id: memo.calendar_id,
    title: memo.title,
    memo_date: new Date(memo.start_at).toISOString().slice(0, 10),
    label_id: memo.label_id || null,
    label_color: memo.label_id ? getLabelColorName(memo.label_id) : null,
    note: memo.note || null,
    location: memo.location || null,
    url: memo.url || null,
    checklist: memo.attachment?.checklist || [],
    virtual_user_attendees: memo.attachment?.virtual_user_attendees || [],
    created_at: memo.created_at ? new Date(memo.created_at).toISOString() : null,
    updated_at: memo.updated_at ? new Date(memo.updated_at).toISOString() : null,
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

function memoError(error: unknown, action: string) {
  if (error instanceof InvalidCalendarError) {
    return errorContent('Invalid calendar', 'Calendar not found. Please use list_calendars to get valid calendar IDs.');
  }

  if (error instanceof TimeTreeAPIError && error.statusCode === 404) {
    return errorContent('Memo not found', 'The specified memo UUID does not exist or has already been deleted.');
  }

  if (error instanceof TimeTreeAPIError && error.statusCode === 403) {
    return errorContent('Authentication failed', 'CSRF token missing or invalid. Please try again.');
  }

  if ((error as { name?: string }).name === 'ZodError') {
    return errorContent('Invalid input', `Please provide valid data to ${action}`, (error as { errors?: unknown }).errors);
  }

  return errorContent(`Failed to ${action}`, (error as Error).message);
}

export function createListMemosTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'list_memos',
    description: 'List TimeTree memos in a calendar. Memos are category=2 all-day events.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        updated_after: { type: 'number', description: 'Only return memos updated after this Unix timestamp in milliseconds' },
        limit: { type: 'number', description: 'Optional limit on number of memos returned' },
      },
      required: ['calendar_id'],
    },
    handler: async (args: unknown) => {
      try {
        const input = ListMemosInputSchema.parse(args);
        logger.info('Tool: list_memos called', { calendar_id: input.calendar_id });

        let memos = await apiClient.getMemosByCalendar(input.calendar_id.toString());
        if (input.updated_after !== undefined) {
          memos = memos.filter((memo) => memo.updated_at && memo.updated_at > input.updated_after!);
        }
        if (input.limit !== undefined) {
          memos = memos.slice(0, input.limit);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  calendar_id: input.calendar_id,
                  memos: memos.map(formatMemo),
                  total: memos.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: list_memos failed', { error });
        return memoError(error, 'list memos');
      }
    },
  };
}

export function createCreateMemoTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'create_memo',
    description: 'Create a TimeTree memo in a calendar using the verified category=2 event payload.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        title: { type: 'string', description: 'Memo title' },
        note: { type: 'string', description: 'Memo body text' },
        label_id: { type: 'number', description: 'Color label ID (1-10)' },
        location: { type: 'string', description: 'Optional memo location' },
        url: { type: 'string', description: 'Optional related URL' },
        date: { type: 'string', description: 'Optional memo date in YYYY-MM-DD; defaults to today UTC' },
        checklist: {
          type: 'array',
          description: 'Checklist items for the memo',
          items: {
            type: 'object',
            properties: {
              checked: { type: 'boolean' },
              title: { type: 'string' },
            },
            required: ['title'],
          },
        },
        virtual_user_attendees: {
          type: 'array',
          description: 'Virtual member IDs/names related to the memo',
          items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        },
      },
      required: ['calendar_id', 'title'],
    },
    handler: async (args: unknown) => {
      try {
        const input = CreateMemoInputSchema.parse(args);
        logger.info('Tool: create_memo called', { calendar_id: input.calendar_id, title: input.title });

        const memo = await apiClient.createMemo(input.calendar_id.toString(), {
          title: input.title,
          note: input.note,
          label_id: input.label_id,
          location: input.location,
          url: input.url,
          start_at: dateToUtcMidnight(input.date),
          checklist: input.checklist,
          virtual_user_attendees: input.virtual_user_attendees,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Memo created successfully',
                  memo: formatMemo(memo),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: create_memo failed', { error });
        return memoError(error, 'create memo');
      }
    },
  };
}

export function createUpdateMemoTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'update_memo',
    description: 'Update a TimeTree memo. Only provide the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        memo_uuid: { type: 'string', description: 'The memo UUID (same as event UUID)' },
        title: { type: 'string', description: 'New memo title' },
        note: { type: 'string', description: 'New memo body text' },
        label_id: { type: 'number', description: 'New color label ID (1-10)' },
        location: { type: 'string', description: 'New memo location' },
        url: { type: 'string', description: 'New related URL; use an empty string to remove it' },
        checklist: {
          type: 'array',
          description: 'Replace checklist items; use [] to clear',
          items: {
            type: 'object',
            properties: {
              checked: { type: 'boolean' },
              title: { type: 'string' },
            },
            required: ['title'],
          },
        },
        virtual_user_attendees: {
          type: 'array',
          description: 'Replace virtual member attendees; use [] to clear',
          items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        },
      },
      required: ['calendar_id', 'memo_uuid'],
    },
    handler: async (args: unknown) => {
      try {
        const input = UpdateMemoInputSchema.parse(args);
        logger.info('Tool: update_memo called', { calendar_id: input.calendar_id, memo_uuid: input.memo_uuid });

        const memo = await apiClient.updateMemo(input.calendar_id.toString(), input.memo_uuid, {
          title: input.title,
          note: input.note,
          label_id: input.label_id,
          location: input.location,
          url: input.url,
          checklist: input.checklist,
          virtual_user_attendees: input.virtual_user_attendees,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Memo updated successfully',
                  memo: formatMemo(memo),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: update_memo failed', { error });
        return memoError(error, 'update memo');
      }
    },
  };
}

export function createDeleteMemoTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'delete_memo',
    description: 'Delete a TimeTree memo. This action cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        memo_uuid: { type: 'string', description: 'The memo UUID (same as event UUID)' },
      },
      required: ['calendar_id', 'memo_uuid'],
    },
    handler: async (args: unknown) => {
      try {
        const input = DeleteMemoInputSchema.parse(args);
        logger.info('Tool: delete_memo called', { calendar_id: input.calendar_id, memo_uuid: input.memo_uuid });

        await apiClient.deleteMemo(input.calendar_id.toString(), input.memo_uuid);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Memo deleted successfully',
                  deleted_memo_uuid: input.memo_uuid,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: delete_memo failed', { error });
        return memoError(error, 'delete memo');
      }
    },
  };
}
