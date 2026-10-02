/**
 * Tool Registration
 * Exports all MCP tools for the TimeTree server.
 */

import type { TimeTreeAPIClient } from '../client/api.js';
import { createCreateCalendarTool, createListCalendarsTool } from './calendar-tools.js';
import {
  createGetCalendarLabelsTool,
  createGetCalendarMembersTool,
  createGetCalendarVirtualMembersTool,
  createUpdateCalendarLabelsTool,
} from './calendar-metadata-tools.js';
import {
  createAddEventCommentTool,
  createDeleteEventCommentTool,
  createListEventCommentsTool,
  createUpdateEventCommentTool,
} from './comment-tools.js';
import {
  createCreateEventTool,
  createUpdateEventTool,
  createDeleteEventTool,
} from './event-crud-tools.js';
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
    createGetEventsTool(apiClient),
    createGetUpdatedEventsTool(apiClient),
    createCreateEventTool(apiClient),
    createUpdateEventTool(apiClient),
    createDeleteEventTool(apiClient),
    createListMemosTool(apiClient),
    createCreateMemoTool(apiClient),
    createUpdateMemoTool(apiClient),
    createDeleteMemoTool(apiClient),
    createAddEventCommentTool(apiClient),
    createListEventCommentsTool(apiClient),
    createUpdateEventCommentTool(apiClient),
    createDeleteEventCommentTool(apiClient),
    createGetCalendarLabelsTool(apiClient),
    createUpdateCalendarLabelsTool(apiClient),
    createGetCalendarMembersTool(apiClient),
    createGetCalendarVirtualMembersTool(apiClient),
    createGetHolidaysTool(apiClient),
    createGetRecentActivityTool(apiClient),
  ];
}
