/**
 * Tool Registration
 * Exports all MCP tools for the TimeTree server.
 */

import type { TimeTreeAPIClient } from '../client/api.js';
import { createCreateCalendarTool, createGetCurrentUserTool, createListCalendarsTool } from './calendar-tools.js';
import {
  createCreateVirtualMemberTool,
  createDeleteVirtualMemberTool,
  createGetCalendarLabelsTool,
  createGetCalendarMembersTool,
  createGetCalendarVirtualMembersTool,
  createUpdateCalendarLabelsTool,
  createUpdateVirtualMemberTool,
} from './calendar-metadata-tools.js';
import {
  createAddEventCommentTool,
  createDeleteEventCommentTool,
  createGetEventCommentImageTool,
  createListEventCommentsTool,
  createUpdateEventCommentTool,
} from './comment-tools.js';
import {
  createCopyEventTool,
  createCreateEventTool,
  createUpdateEventTool,
  createDeleteEventTool,
} from './event-crud-tools.js';
import { createDeleteEventOccurrenceTool, createUpdateEventOccurrenceTool } from './recurring-event-tools.js';
import { createGetEventsTool, createGetUpdatedEventsTool } from './event-tools.js';
import { createGetHolidaysTool } from './holiday-tools.js';
import { createGetRecentActivityTool } from './activity-tools.js';
import {
  createCreateMemoTool,
  createDeleteMemoTool,
  createListMemosTool,
  createUpdateMemoTool,
} from './memo-tools.js';

export function registerTools(apiClient: TimeTreeAPIClient) {
  return [
    createListCalendarsTool(apiClient),
    createCreateCalendarTool(apiClient),
    createGetCurrentUserTool(apiClient),
    createGetEventsTool(apiClient),
    createGetUpdatedEventsTool(apiClient),
    createCreateEventTool(apiClient),
    createUpdateEventTool(apiClient),
    createDeleteEventTool(apiClient),
    createUpdateEventOccurrenceTool(apiClient),
    createDeleteEventOccurrenceTool(apiClient),
    createCopyEventTool(apiClient),
    createListMemosTool(apiClient),
    createCreateMemoTool(apiClient),
    createUpdateMemoTool(apiClient),
    createDeleteMemoTool(apiClient),
    createAddEventCommentTool(apiClient),
    createListEventCommentsTool(apiClient),
    createGetEventCommentImageTool(apiClient),
    createUpdateEventCommentTool(apiClient),
    createDeleteEventCommentTool(apiClient),
    createGetCalendarLabelsTool(apiClient),
    createUpdateCalendarLabelsTool(apiClient),
    createGetCalendarMembersTool(apiClient),
    createGetCalendarVirtualMembersTool(apiClient),
    createCreateVirtualMemberTool(apiClient),
    createUpdateVirtualMemberTool(apiClient),
    createDeleteVirtualMemberTool(apiClient),
    createGetHolidaysTool(apiClient),
    createGetRecentActivityTool(apiClient),
  ];
}

/**
 * Tools that declare an outputSchema also return their JSON as structuredContent, which
 * MCP requires to match that schema. Error results carry no structured content.
 */
export function toolResult<T extends { content: Array<{ type: string; text?: string }>; isError?: boolean }>(
  tool: { outputSchema?: unknown },
  result: T
): T & { structuredContent?: Record<string, unknown> } {
  if (!tool.outputSchema || result.isError || result.content[0]?.type !== 'text' || typeof result.content[0].text !== 'string') {
    return result;
  }
  return { ...result, structuredContent: JSON.parse(result.content[0].text) };
}
