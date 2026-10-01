/**
 * Event Comment Tools for MCP
 * TimeTree comments are event activities with type=0 and attachment.content.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { TimeTreeAPIError } from '../client/api.js';
import { logger } from '../utils/logger.js';
import { CALENDAR_ID_JSON_SCHEMA, CalendarIdSchema } from './shared-schemas.js';
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
    description: 'Add a comment to a TimeTree event using the verified event activity endpoint.',
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
    description: 'List comments for a TimeTree event. Filters activity feed entries to comment activities only.',
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
    description: 'Update a TimeTree event comment by comment/activity ID.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        event_uuid: { type: 'string', description: 'The event UUID' },
        comment_id: { type: 'string', description: 'The comment/activity ID' },
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
    description: 'Delete a TimeTree event comment by comment/activity ID.',
    inputSchema: {
      type: 'object',
      properties: {
        calendar_id: CALENDAR_ID_JSON_SCHEMA,
        event_uuid: { type: 'string', description: 'The event UUID' },
        comment_id: { type: 'string', description: 'The comment/activity ID' },
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
