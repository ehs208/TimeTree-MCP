/**
 * Tool Registration
 * Exports all MCP tools for the TimeTree server.
 */

import type { TimeTreeAPIClient } from '../client/api.js';
import { createListCalendarsTool } from './calendar-tools.js';
import { createGetEventsTool } from './event-tools.js';
import {
  createCreateEventTool,
  createUpdateEventTool,
  createDeleteEventTool,
} from './event-crud-tools.js';

export function registerTools(apiClient: TimeTreeAPIClient) {
  return [
    createListCalendarsTool(apiClient),
    createGetEventsTool(apiClient),
    createCreateEventTool(apiClient),
    createUpdateEventTool(apiClient),
    createDeleteEventTool(apiClient),
  ];
}
