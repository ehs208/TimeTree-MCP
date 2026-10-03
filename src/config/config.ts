/**
 * TimeTree API Configuration
 * These endpoints are discovered through reverse engineering the TimeTree web app.
 */

/**
 * Validate an identifier before it is placed in a URL path. Values such as `..` or
 * `a/../b` would otherwise let a crafted ID send the request to a different endpoint.
 */
function pathSegment(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid identifier "${value}": only letters, numbers, "-" and "_" are allowed`);
  }
  return value;
}

/** Keep in sync with package.json (checked by tests). */
export const SERVER_VERSION = '0.4.0';

/** Latest published version: package.json on the default branch, which users install from. */
export const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/ehs208/TimeTree-MCP/main/package.json';
export const CHANGELOG_URL = 'https://github.com/ehs208/TimeTree-MCP/blob/main/CHANGELOG.md';
/** Claude Desktop extension (.mcpb) downloads. */
export const RELEASES_URL = 'https://github.com/ehs208/TimeTree-MCP/releases/latest';

export const TIMETREE_CONFIG = {
  // Base URLs for TimeTree APIs.
  BASE_URL: 'https://timetreeapp.com/api/v1',
  V2_BASE_URL: 'https://timetreeapp.com/api/v2',

  // API Endpoints.
  ENDPOINTS: {
    AUTH: '/auth/email/signin',
    CALENDARS: '/calendars',
    CALENDAR_LABELS: (calendarId: string) => `/calendar/${pathSegment(calendarId)}/labels`,
    CALENDAR_MEMBERS_V2: (calendarId: string) => `/calendars/${pathSegment(calendarId)}/users`,
    MEMORIAL_DAYS: '/memorialdays',
    LATEST_EVENT_ACTIVITIES: '/event_activities/latest',
    CALENDAR_VIRTUAL_USERS: (calendarId: string) => `/calendars/${pathSegment(calendarId)}/virtual_users`,
    EVENTS_SYNC: (calendarId: string) => `/calendar/${pathSegment(calendarId)}/events/sync`,
    EVENTS: (calendarId: string) => `/calendar/${pathSegment(calendarId)}/events`,
    CREATE_EVENT: (calendarId: string) => `/calendar/${pathSegment(calendarId)}/event`,
    EVENT: (calendarId: string, eventUuid: string) =>
      `/calendar/${pathSegment(calendarId)}/event/${pathSegment(eventUuid)}`,
    UPDATE_EVENT: (calendarId: string, eventUuid: string) =>
      `/calendar/${pathSegment(calendarId)}/event/${pathSegment(eventUuid)}`,
    DELETE_EVENT: (calendarId: string, eventUuid: string) =>
      `/calendar/${pathSegment(calendarId)}/event/${pathSegment(eventUuid)}`,
    EVENT_ACTIVITIES: (calendarId: string, eventUuid: string) =>
      `/calendar/${pathSegment(calendarId)}/event/${pathSegment(eventUuid)}/activities`,
    EVENT_ACTIVITY: (calendarId: string, eventUuid: string) =>
      `/calendar/${pathSegment(calendarId)}/event/${pathSegment(eventUuid)}/activity`,
    EVENT_ACTIVITY_BY_ID: (calendarId: string, eventUuid: string, activityId: string) =>
      `/calendar/${pathSegment(calendarId)}/event/${pathSegment(eventUuid)}/activity/${pathSegment(activityId)}`,
  },

  // Headers.
  HEADERS: {
    'Content-Type': 'application/json',
    'X-Timetreea': 'web/2.1.0/en',
  },

  // Rate Limiting.
  RATE_LIMIT: {
    MAX_REQUESTS_PER_SECOND: 10,
    TIMEOUT_MS: 60000,
  },

  // Session Cookie Name.
  SESSION_COOKIE_NAME: '_session_id',
} as const;
