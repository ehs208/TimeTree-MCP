/**
 * Event Comment Tools for MCP
 * TimeTree comments are event activities with type=0 and attachment.content.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { TimeTreeAPIError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import {
  ADDITIVE,
  CALENDAR_ID_JSON_SCHEMA,
  CalendarIdSchema,
  deletionOutputSchema,
  DESTRUCTIVE_IDEMPOTENT,
  READ_ONLY,
} from './shared-schemas.js';
import type { EventActivity } from '../types/timetree.js';

export const AddEventCommentInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
  event_uuid: z.string().describe('The event UUID to comment on'),
  content: z.string().min(1).describe('Comment content'),
  silent: z.boolean().default(true).describe('Whether to avoid push notifications when supported'),
});

export const ListEventCommentsInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
  event_uuid: z.string().describe('The event UUID'),
});

export const UpdateEventCommentInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
  event_uuid: z.string().describe('The event UUID'),
  comment_id: z.string().describe('The comment/activity ID'),
  content: z.string().min(1).describe('New comment content'),
});

export const DeleteEventCommentInputSchema = z.object({
  calendar_id: CalendarIdSchema.describe('The calendar ID'),
  event_uuid: z.string().describe('The event UUID'),
  comment_id: z.string().describe('The comment/activity ID'),
});

const nullable = (type: string) => ({ type: [type, 'null'] });

const COMMENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'comment_id for update_event_comment and delete_event_comment' },
    event_id: nullable('string'),
    calendar_id: nullable('number'),
    content: { type: 'string' },
    author_id: { type: ['number', 'null'], description: 'User ID of the author' },
    author_type: nullable('string'),
    editor_id: nullable('number'),
    created_at: nullable('string'),
    updated_at: nullable('string'),
  },
  required: ['id', 'content'],
} as const;

const COMMENT_RESULT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: { success: { type: 'boolean' }, message: { type: 'string' }, comment: COMMENT_OUTPUT_SCHEMA },
  required: ['success', 'comment'],
} as const;

function formatComment(comment: EventActivity) {
  return {
    id: comment.id,
    event_id: comment.event_id || null,
    calendar_id: comment.calendar_id || null,
    content: comment.attachment?.content || '',
    author_id: comment.author_id || null,
    author_type: comment.author_type || null,
    editor_id: comment.editor_id || null,
    created_at: comment.created_at ? new Date(comment.created_at).toISOString() : null,
    updated_at: comment.updated_at ? new Date(comment.updated_at).toISOString() : null,
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

function commentError(error: unknown, action: string) {
  if (error instanceof TimeTreeAPIError && error.statusCode === 404) {
    return errorContent('Not found', 'The specified event or comment could not be found.');
  }

  if (error instanceof TimeTreeAPIError && error.statusCode === 403) {
    return errorContent('Authentication failed', 'CSRF token missing or invalid. Please try again.');
  }

  if ((error as { name?: string }).name === 'ZodError') {
    return errorContent('Invalid input', `Please provide valid data to ${action}`, (error as { errors?: unknown }).errors);
  }

  return errorContent(`Failed to ${action}`, (error as Error).message);
}

export function createAddEventCommentTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'add_event_comment',
    description:
      'Post a comment on an event and return it with its id. Comments are visible to everyone in the calendar; ' +
      'by default no push notification is sent (silent). Get event_uuid from get_events. To change the event\'s own ' +
      'note use update_event; to edit or remove a comment later use update_event_comment or delete_event_comment.',
    annotations: ADDITIVE,
    outputSchema: COMMENT_RESULT_OUTPUT_SCHEMA,
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        event_uuid: { type: 'string', description: 'The event UUID to comment on' },
        content: { type: 'string', description: 'Comment content' },
        silent: { type: 'boolean', description: 'Whether to avoid push notifications when supported (default: true)' },
      },
      required: ['calendar_id', 'event_uuid', 'content'],
    },
    handler: async (args: unknown) => {
      try {
        const input = AddEventCommentInputSchema.parse(args);
        logger.info('Tool: add_event_comment called', { calendar_id: input.calendar_id, event_uuid: input.event_uuid });

        const comment = await apiClient.addEventComment(
          input.calendar_id.toString(),
          input.event_uuid,
          input.content,
          input.silent
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Event comment added successfully',
                  comment: formatComment(comment),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: add_event_comment failed', { error });
        return commentError(error, 'add event comment');
      }
    },
  };
}

export function createListEventCommentsTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'list_event_comments',
    description:
      'List the comments on an event with their ids and author user IDs. Only comments are returned, ' +
      'not change history; use get_recent_activity for who changed what.',
    annotations: READ_ONLY,
    outputSchema: {
      type: 'object',
      properties: {
        calendar_id: { type: 'number' },
        event_uuid: { type: 'string' },
        comments: { type: 'array', items: COMMENT_OUTPUT_SCHEMA },
        total: { type: 'number' },
      },
      required: ['calendar_id', 'event_uuid', 'comments', 'total'],
    },
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        event_uuid: { type: 'string', description: 'The event UUID' },
      },
      required: ['calendar_id', 'event_uuid'],
    },
    handler: async (args: unknown) => {
      try {
        const input = ListEventCommentsInputSchema.parse(args);
        logger.info('Tool: list_event_comments called', { calendar_id: input.calendar_id, event_uuid: input.event_uuid });

        const comments = await apiClient.listEventComments(input.calendar_id.toString(), input.event_uuid);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  calendar_id: input.calendar_id,
                  event_uuid: input.event_uuid,
                  comments: comments.map(formatComment),
                  total: comments.length,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: list_event_comments failed', { error });
        return commentError(error, 'list event comments');
      }
    },
  };
}

export function createUpdateEventCommentTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'update_event_comment',
    description:
      'Replace the text of an existing comment and return it. TimeTree lets only the comment\'s author edit it. ' +
      'Get comment_id from list_event_comments; use add_event_comment to post a new comment instead.',
    annotations: DESTRUCTIVE_IDEMPOTENT,
    outputSchema: COMMENT_RESULT_OUTPUT_SCHEMA,
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        event_uuid: { type: 'string', description: 'The event UUID' },
        comment_id: { type: 'string', description: 'The comment id from list_event_comments' },
        content: { type: 'string', description: 'New comment content' },
      },
      required: ['calendar_id', 'event_uuid', 'comment_id', 'content'],
    },
    handler: async (args: unknown) => {
      try {
        const input = UpdateEventCommentInputSchema.parse(args);
        logger.info('Tool: update_event_comment called', {
          calendar_id: input.calendar_id,
          event_uuid: input.event_uuid,
          comment_id: input.comment_id,
        });

        const comment = await apiClient.updateEventComment(
          input.calendar_id.toString(),
          input.event_uuid,
          input.comment_id,
          input.content
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Event comment updated successfully',
                  comment: formatComment(comment),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: update_event_comment failed', { error });
        return commentError(error, 'update event comment');
      }
    },
  };
}

export function createDeleteEventCommentTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'delete_event_comment',
    description:
      'Delete a comment from an event. Cannot be undone, and TimeTree lets only the comment\'s author delete it. ' +
      'Get comment_id from list_event_comments.',
    annotations: DESTRUCTIVE_IDEMPOTENT,
    outputSchema: deletionOutputSchema('deleted_comment_id'),
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        event_uuid: { type: 'string', description: 'The event UUID' },
        comment_id: { type: 'string', description: 'The comment id from list_event_comments' },
      },
      required: ['calendar_id', 'event_uuid', 'comment_id'],
    },
    handler: async (args: unknown) => {
      try {
        const input = DeleteEventCommentInputSchema.parse(args);
        logger.info('Tool: delete_event_comment called', {
          calendar_id: input.calendar_id,
          event_uuid: input.event_uuid,
          comment_id: input.comment_id,
        });

        await apiClient.deleteEventComment(input.calendar_id.toString(), input.event_uuid, input.comment_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Event comment deleted successfully',
                  deleted_comment_id: input.comment_id,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: delete_event_comment failed', { error });
        return commentError(error, 'delete event comment');
      }
    },
  };
}
