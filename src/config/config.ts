/**
 * TimeTree API Configuration
 * These endpoints are discovered through reverse engineering the TimeTree web app.
 */

export const TIMETREE_CONFIG = {
  // Base URL for TimeTree API
  BASE_URL: 'https://timetreeapp.com/api/v1',

  // API Endpoints
  ENDPOINTS: {
    AUTH: '/auth/email/signin',
    CALENDARS: '/calendars',
    EVENTS_SYNC: (calendarId: string) => `/calendar/${calendarId}/events/sync`,
    EVENTS: (calendarId: string) => `/calendar/${calendarId}/events`,
    CREATE_EVENT: (calendarId: string) => `/calendar/${calendarId}/event`,
    UPDATE_EVENT: (calendarId: string, eventUuid: string) =>
      `/calendar/${calendarId}/event/${eventUuid}`,
    DELETE_EVENT: (calendarId: string, eventUuid: string) =>
      `/calendar/${calendarId}/event/${eventUuid}`,
  },

  // Headers
  HEADERS: {
    'Content-Type': 'application/json',
    'X-Timetreea': 'web/2.1.0/en',
  },

  // Rate Limiting
  RATE_LIMIT: {
    MAX_REQUESTS_PER_SECOND: 10,
    TIMEOUT_MS: 60000,
  },

  // Session Cookie Name
  SESSION_COOKIE_NAME: '_session_id',
} as const;
