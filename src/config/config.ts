/**
 * TimeTree API Configuration
 * These endpoints are discovered through reverse engineering the TimeTree web app.
 */

export const TIMETREE_CONFIG = {
  // Base URLs for TimeTree APIs.
  BASE_URL: 'https://timetreeapp.com/api/v1',
  V2_BASE_URL: 'https://timetreeapp.com/api/v2',

  // API Endpoints.
  ENDPOINTS: {
    AUTH: '/auth/email/signin',
    CALENDARS: '/calendars',
    CALENDAR_LABELS: (calendarId: string) => `/calendar/${calendarId}/labels`,
    CALENDAR_MEMBERS_V2: (calendarId: string) => `/calendars/${calendarId}/users`,
    MEMORIAL_DAYS: '/memorialdays',
    CALENDAR_VIRTUAL_USERS: (calendarId: string) => `/calendars/${calendarId}/virtual_users`,
    EVENTS_SYNC: (calendarId: string) => `/calendar/${calendarId}/events/sync`,
    EVENTS: (calendarId: string) => `/calendar/${calendarId}/events`,
    CREATE_EVENT: (calendarId: string) => `/calendar/${calendarId}/event`,
    EVENT: (calendarId: string, eventUuid: string) =>
      `/calendar/${calendarId}/event/${eventUuid}`,
    UPDATE_EVENT: (calendarId: string, eventUuid: string) =>
      `/calendar/${calendarId}/event/${eventUuid}`,
    DELETE_EVENT: (calendarId: string, eventUuid: string) =>
      `/calendar/${calendarId}/event/${eventUuid}`,
    EVENT_ACTIVITIES: (calendarId: string, eventUuid: string) =>
      `/calendar/${calendarId}/event/${eventUuid}/activities`,
    EVENT_ACTIVITY: (calendarId: string, eventUuid: string) =>
      `/calendar/${calendarId}/event/${eventUuid}/activity`,
    EVENT_ACTIVITY_BY_ID: (calendarId: string, eventUuid: string, activityId: string) =>
      `/calendar/${calendarId}/event/${eventUuid}/activity/${activityId}`,
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
