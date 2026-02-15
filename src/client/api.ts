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
} from '../types/timetree.js';
import { CalendarsResponseSchema, EventsSyncResponseSchema } from '../types/timetree.js';

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
   * Verify a calendar exists
   */
  async verifyCalendar(calendarId: string): Promise<boolean> {
    const calendars = await this.getCalendars();
    return calendars.some((cal) => cal.id.toString() === calendarId);
  }
}
