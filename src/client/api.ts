/**
 * TimeTree API Client
 * Handles all API calls to TimeTree with rate limiting and pagination.
 */

import { TIMETREE_CONFIG } from '../config/config.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';
import { TimeTreeAuthManager } from './auth.js';
import type {
  Calendar,
  CalendarsResponse,
  Event,
  EventsSyncResponse,
  CreateEventInput,
  CreateEventResponse,
  UpdateEventInput,
  UpdateEventResponse,
} from '../types/timetree.js';
import {
  CalendarsResponseSchema,
  EventsSyncResponseSchema,
  CreateEventResponseSchema,
  UpdateEventResponseSchema,
} from '../types/timetree.js';

export class TimeTreeAPIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'TimeTreeAPIError';
  }
}

export class InvalidCalendarError extends TimeTreeAPIError {
  constructor(calendarId: string) {
    super(`Invalid calendar ID: ${calendarId}`, 404);
    this.name = 'InvalidCalendarError';
  }
}

export class TimeTreeAPIClient {
  private authManager: TimeTreeAuthManager;
  private rateLimiter: RateLimiter;

  constructor(authManager: TimeTreeAuthManager) {
    this.authManager = authManager;
    this.rateLimiter = new RateLimiter(
      TIMETREE_CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_SECOND
    );
  }

  /**
   * Ensure we're authenticated before making API calls
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authManager.isAuthenticated()) {
      await this.authManager.authenticate();
    }
  }

  /**
   * Get list of all calendars for the authenticated user
   */
  async getCalendars(): Promise<Calendar[]> {
    await this.ensureAuthenticated();

    logger.info('Fetching calendars');

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.CALENDARS}?since=0`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .get<CalendarsResponse>(url);
      });

      // Validate response
      const validated = CalendarsResponseSchema.parse(response);

      // Filter out deactivated calendars
      const activeCalendars = validated.calendars.filter(
        (cal) => !cal.deactivated_at
      );

      logger.info('Calendars fetched successfully', {
        total: validated.calendars.length,
        active: activeCalendars.length,
      });

      return activeCalendars;
    } catch (error) {
      logger.error('Failed to fetch calendars', { error });
      throw new TimeTreeAPIError(
        `Failed to fetch calendars: ${(error as Error).message}`
      );
    }
  }

  /**
   * Recursively sync events from a calendar with automatic pagination
   */
  private async syncEvents(
    calendarId: string,
    since: number = 0,
    accumulated: Event[] = []
  ): Promise<Event[]> {
    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.EVENTS_SYNC(
      calendarId
    )}?since=${since}`;

    logger.debug('Syncing events', { calendarId, since, accumulated: accumulated.length });

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .get<EventsSyncResponse>(url);
      });

      // Validate response
      const validated = EventsSyncResponseSchema.parse(response);

      // Accumulate events
      accumulated.push(...validated.events);

      // Check if there are more chunks to fetch
      if (validated.chunk && validated.since > since) {
        logger.debug('More events to fetch', {
          nextSince: validated.since,
          fetchedSoFar: accumulated.length,
        });
        return this.syncEvents(calendarId, validated.since, accumulated);
      }

      logger.debug('Event sync complete', {
        total: accumulated.length,
      });

      return accumulated;
    } catch (error) {
      // Check for 404 - invalid calendar
      if ((error as any).statusCode === 404) {
        throw new InvalidCalendarError(calendarId);
      }

      logger.error('Failed to sync events', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to sync events: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get all events from a calendar (handles pagination automatically)
   */
  async getEventsByCalendar(
    calendarId: string,
    since: number = 0
  ): Promise<Event[]> {
    await this.ensureAuthenticated();

    logger.info('Fetching events for calendar', { calendarId, since });

    const events = await this.syncEvents(calendarId, since);

    logger.info('Events fetched successfully', {
      calendarId,
      total: events.length,
    });

    return events;
  }

  /**
   * Get events updated after a specific timestamp
   * This is more efficient than getEventsByCalendar when checking for recent changes.
   *
   * @param calendarId - The calendar ID to fetch events from
   * @param updatedAfter - Unix timestamp in milliseconds. Only return events updated after this time.
   * @returns Array of events that were updated after the specified timestamp
   */
  async getUpdatedEvents(
    calendarId: string,
    updatedAfter: number
  ): Promise<Event[]> {
    await this.ensureAuthenticated();

    logger.info('Fetching updated events for calendar', { calendarId, updatedAfter });

    const url = `${TIMETREE_CONFIG.BASE_URL}/calendar/${calendarId}/events?since=${updatedAfter}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .get<EventsSyncResponse>(url);
      });

      // Validate response
      const validated = EventsSyncResponseSchema.parse(response);

      // Filter events by updated_at timestamp
      const updatedEvents = validated.events.filter(
        (event) => event.updated_at && event.updated_at > updatedAfter
      );

      logger.info('Updated events fetched successfully', {
        calendarId,
        total: updatedEvents.length,
      });

      return updatedEvents;
    } catch (error) {
      // Check for 404 - invalid calendar
      if ((error as any).statusCode === 404) {
        throw new InvalidCalendarError(calendarId);
      }

      logger.error('Failed to fetch updated events', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to fetch updated events: ${(error as Error).message}`
      );
    }
  }

  /**
   * Verify a calendar exists
   */
  async verifyCalendar(calendarId: string): Promise<boolean> {
    const calendars = await this.getCalendars();
    return calendars.some((cal) => cal.id.toString() === calendarId);
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create a new event in a calendar
   * Requires CSRF token for authentication
   */
  async createEvent(calendarId: string, eventData: CreateEventInput): Promise<Event> {
    await this.ensureAuthenticated();

    logger.info('Creating event', { calendarId, title: eventData.title });

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.CREATE_EVENT(calendarId)}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .post<CreateEventResponse>(url, eventData, undefined, true); // requiresCsrf=true
      });

      // Validate response
      const validated = CreateEventResponseSchema.parse(response);

      logger.info('Event created successfully', {
        calendarId,
        eventUuid: validated.event.uuid,
      });

      return validated.event;
    } catch (error) {
      // Check for specific error codes
      if ((error as any).statusCode === 404) {
        throw new InvalidCalendarError(calendarId);
      }

      if ((error as any).statusCode === 403) {
        logger.error('CSRF token missing or invalid', { error });
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }

      logger.error('Failed to create event', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to create event: ${(error as Error).message}`
      );
    }
  }

  /**
   * Update an existing event
   * Requires CSRF token for authentication
   */
  async updateEvent(
    calendarId: string,
    eventUuid: string,
    updateData: UpdateEventInput
  ): Promise<Event> {
    await this.ensureAuthenticated();

    logger.info('Updating event', { calendarId, eventUuid });

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.UPDATE_EVENT(
      calendarId,
      eventUuid
    )}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .put<UpdateEventResponse>(url, updateData, undefined, true); // requiresCsrf=true
      });

      // Validate response
      const validated = UpdateEventResponseSchema.parse(response);

      logger.info('Event updated successfully', {
        calendarId,
        eventUuid: validated.event.uuid,
      });

      return validated.event;
    } catch (error) {
      // Check for specific error codes
      if ((error as any).statusCode === 404) {
        throw new TimeTreeAPIError(`Event not found: ${eventUuid}`, 404);
      }

      if ((error as any).statusCode === 403) {
        logger.error('CSRF token missing or invalid', { error });
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }

      logger.error('Failed to update event', { calendarId, eventUuid, error });
      throw new TimeTreeAPIError(
        `Failed to update event: ${(error as Error).message}`
      );
    }
  }

  /**
   * Delete an event from a calendar
   *
   * NOTE: TimeTree's DELETE endpoint requires the full event data in the request body.
   * This is unusual for a DELETE operation, but required by TimeTree's API.
   *
   * Strategy: Fetch the event first, then delete with full event data.
   * Requires CSRF token for authentication.
   */
  async deleteEvent(calendarId: string, eventUuid: string): Promise<void> {
    await this.ensureAuthenticated();

    logger.info('Deleting event', { calendarId, eventUuid });

    try {
      // Step 1: Fetch all events to find the target event
      // (TimeTree requires full event data in DELETE body)
      const events = await this.getEventsByCalendar(calendarId, 0);
      const targetEvent = events.find((e) => e.uuid === eventUuid);

      if (!targetEvent) {
        throw new TimeTreeAPIError(`Event not found: ${eventUuid}`, 404);
      }

      // Step 2: Delete with full event data
      const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.DELETE_EVENT(
        calendarId,
        eventUuid
      )}`;

      await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .delete(url, targetEvent, undefined, true); // requiresCsrf=true
      });

      logger.info('Event deleted successfully', { calendarId, eventUuid });
    } catch (error) {
      // Check for specific error codes
      if ((error as any).statusCode === 404) {
        throw new InvalidCalendarError(calendarId);
      }

      if ((error as any).statusCode === 403) {
        logger.error('CSRF token missing or invalid', { error });
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }

      logger.error('Failed to delete event', { calendarId, eventUuid, error });
      throw new TimeTreeAPIError(
        `Failed to delete event: ${(error as Error).message}`
      );
    }
  }
}
