/**
 * TimeTree API Client
 * Handles all API calls to TimeTree with rate limiting and pagination.
 */

import { randomUUID } from 'crypto';
import { TIMETREE_CONFIG } from '../config/config.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';
import { TimeTreeAuthManager } from './auth.js';
import type {
  Calendar,
  CalendarLabel,
  CalendarLabelUpdateInput,
  CalendarLabelsResponse,
  CalendarUser,
  CalendarUsersResponse,
  CalendarVirtualUser,
  CalendarVirtualUsersResponse,
  CalendarsResponse,
  CreateEventInput,
  CreateEventResponse,
  CreateMemoInput,
  Event,
  EventActivitiesResponse,
  EventActivity,
  EventActivityResponse,
  EventsSyncResponse,
  LatestActivitiesResponse,
  LatestActivityEvent,
  MemorialDay,
  MemorialDaysResponse,
  UpdateEventInput,
  UpdateEventResponse,
  UpdateMemoInput,
} from '../types/timetree.js';
import {
  CalendarLabelsResponseSchema,
  CalendarUsersResponseSchema,
  CalendarVirtualUsersResponseSchema,
  CalendarsResponseSchema,
  CreateEventResponseSchema,
  EventActivitiesResponseSchema,
  EventActivityResponseSchema,
  EventsSyncResponseSchema,
  LatestActivitiesResponseSchema,
  MemorialDaysResponseSchema,
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

function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : undefined;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function todayUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function createClientUuid(): string {
  return randomUUID().replace(/-/g, '');
}

type EventAttachmentInput = NonNullable<CreateEventInput['attachment']>;

/**
 * Shape an attachment for TimeTree writes.
 * The event URL is stored as attachment.url (a top-level url is ignored), and an
 * empty checklist must be sent as null because TimeTree rejects [].
 */
export function toAttachmentPayload(
  attachment: EventAttachmentInput | null | undefined,
  url: string | undefined
): EventAttachmentInput | null | undefined {
  if (url === undefined && attachment == null) {
    return attachment;
  }

  const payload: EventAttachmentInput = { ...(attachment ?? {}) };
  if (url !== undefined) {
    payload.url = url || null;
  }
  if (Array.isArray(payload.checklist) && payload.checklist.length === 0) {
    payload.checklist = null;
  }
  return payload;
}

/** Keep the attachment fields TimeTree drops when an update omits them. */
function existingAttachmentFields(event: Event): EventAttachmentInput {
  const attachment = event.attachment;
  return {
    ...(attachment?.url && { url: attachment.url }),
    ...(attachment?.checklist?.length && { checklist: attachment.checklist }),
    ...(attachment?.virtual_user_attendees?.length && {
      virtual_user_attendees: attachment.virtual_user_attendees,
    }),
  };
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

  /** Ensure we're authenticated before making API calls. */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.authManager.isAuthenticated()) {
      await this.authManager.authenticate();
    }
  }

  /** Get list of all calendars for the authenticated user. */
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

      const validated = CalendarsResponseSchema.parse(response);
      const activeCalendars = validated.calendars.filter(
        (calendar) => !calendar.deactivated_at
      );

      logger.info('Calendars fetched successfully', {
        total: validated.calendars.length,
        active: activeCalendars.length,
      });

      return activeCalendars;
    } catch (error) {
      logger.error('Failed to fetch calendars', { error });
      throw new TimeTreeAPIError(
        `Failed to fetch calendars: ${getErrorMessage(error)}`
      );
    }
  }

  /** Recursively sync events from a calendar with automatic pagination. */
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

      const validated = EventsSyncResponseSchema.parse(response);
      accumulated.push(...validated.events);

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
      if (getStatusCode(error) === 404) {
        throw new InvalidCalendarError(calendarId);
      }

      logger.error('Failed to sync events', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to sync events: ${getErrorMessage(error)}`
      );
    }
  }

  /** Get all events from a calendar (handles pagination automatically). */
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
   * Get events updated after a specific timestamp.
   * This is more efficient than getEventsByCalendar when checking for recent changes.
   */
  async getUpdatedEvents(
    calendarId: string,
    updatedAfter: number
  ): Promise<Event[]> {
    await this.ensureAuthenticated();

    logger.info('Fetching updated events for calendar', { calendarId, updatedAfter });

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.EVENTS(calendarId)}?since=${updatedAfter}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .get<EventsSyncResponse>(url);
      });

      const validated = EventsSyncResponseSchema.parse(response);
      const updatedEvents = validated.events.filter(
        (event) => event.updated_at && event.updated_at > updatedAfter
      );

      logger.info('Updated events fetched successfully', {
        calendarId,
        total: updatedEvents.length,
      });

      return updatedEvents;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new InvalidCalendarError(calendarId);
      }

      logger.error('Failed to fetch updated events', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to fetch updated events: ${getErrorMessage(error)}`
      );
    }
  }

  /** Verify a calendar exists. */
  async verifyCalendar(calendarId: string): Promise<boolean> {
    const calendars = await this.getCalendars();
    return calendars.some((calendar) => calendar.id.toString() === calendarId);
  }

  // ============================================================================
  // Calendar metadata operations
  // ============================================================================

  async getCalendarLabels(calendarId: string): Promise<CalendarLabel[]> {
    await this.ensureAuthenticated();

    logger.info('Fetching calendar labels', { calendarId });
    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.CALENDAR_LABELS(calendarId)}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .get<CalendarLabelsResponse>(url);
      });

      const validated = CalendarLabelsResponseSchema.parse(response);
      return validated.calendar_labels;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new InvalidCalendarError(calendarId);
      }
      logger.error('Failed to fetch calendar labels', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to fetch calendar labels: ${getErrorMessage(error)}`
      );
    }
  }

  /**
   * Get recently changed events with their latest activities (newest first).
   * TimeTree returns at most a few recent activities per event, including deleted events.
   */
  async getLatestEventActivities(calendarIds: string[]): Promise<LatestActivityEvent[]> {
    await this.ensureAuthenticated();

    const params = new URLSearchParams();
    for (const calendarId of calendarIds) params.append('calendar_ids[]', calendarId);
    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.LATEST_EVENT_ACTIVITIES}?${params}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager.getHttpClient().get<LatestActivitiesResponse>(url);
      });
      return LatestActivitiesResponseSchema.parse(response).events;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new InvalidCalendarError(calendarIds.join(','));
      }
      logger.error('Failed to fetch latest event activities', { calendarIds, error });
      throw new TimeTreeAPIError(
        `Failed to fetch recent activity: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }

  /** Get public holidays and memorial days for countries within [from, to). */
  async getMemorialDays(countryIsos: string[], from: Date, to: Date): Promise<MemorialDay[]> {
    await this.ensureAuthenticated();

    const params = new URLSearchParams();
    for (const country of countryIsos) params.append('country_iso[]', country);
    params.set('from', from.toISOString());
    params.set('to', to.toISOString());
    const url = `${TIMETREE_CONFIG.V2_BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.MEMORIAL_DAYS}?${params}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager.getHttpClient().get<MemorialDaysResponse>(url);
      });
      return MemorialDaysResponseSchema.parse(response).memorialdays.filter((day) => !day.deactivated_at);
    } catch (error) {
      logger.error('Failed to fetch memorial days', { countryIsos, error });
      throw new TimeTreeAPIError(
        `Failed to fetch holidays: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }

  async updateCalendarLabels(
    calendarId: string,
    labelUpdates: CalendarLabelUpdateInput[]
  ): Promise<CalendarLabel[]> {
    await this.ensureAuthenticated();

    logger.info('Updating calendar labels', {
      calendarId,
      update_count: labelUpdates.length,
      label_ids: labelUpdates.map((label) => label.id),
    });

    const currentLabels = await this.getCalendarLabels(calendarId);
    const updatesById = new Map(labelUpdates.map((label) => [label.id, label]));
    const currentIds = new Set(currentLabels.map((label) => label.id));

    const mergedLabels = currentLabels.map((label) => {
      const update = updatesById.get(label.id);
      return {
        id: label.id,
        name: update?.name ?? label.name ?? '',
        color: update?.color ?? label.color ?? label.default_color,
      };
    });

    for (const update of labelUpdates) {
      if (currentIds.has(update.id)) continue;
      if (update.color === undefined) {
        throw new TimeTreeAPIError(
          `Cannot add unknown label ${update.id} without color`,
          400
        );
      }
      mergedLabels.push({
        id: update.id,
        name: update.name ?? '',
        color: update.color,
      });
    }

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.CALENDAR_LABELS(calendarId)}`;
    const body = { calendar_labels: mergedLabels };

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .put<CalendarLabelsResponse>(url, body, undefined, true);
      });

      const parsed = CalendarLabelsResponseSchema.safeParse(response);
      return parsed.success ? parsed.data.calendar_labels : this.getCalendarLabels(calendarId);
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new InvalidCalendarError(calendarId);
      }
      if (getStatusCode(error) === 403) {
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }
      logger.error('Failed to update calendar labels', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to update calendar labels: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }

  async getCalendarMembers(calendarId: string): Promise<CalendarUser[]> {
    await this.ensureAuthenticated();

    logger.info('Fetching calendar members', { calendarId });
    const url = `${TIMETREE_CONFIG.V2_BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.CALENDAR_MEMBERS_V2(calendarId)}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .get<CalendarUsersResponse>(url);
      });

      const validated = CalendarUsersResponseSchema.parse(response);
      return validated.calendar_users;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new InvalidCalendarError(calendarId);
      }
      logger.error('Failed to fetch calendar members', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to fetch calendar members: ${getErrorMessage(error)}`
      );
    }
  }

  async getCalendarVirtualUsers(calendarId: string): Promise<CalendarVirtualUser[]> {
    await this.ensureAuthenticated();

    logger.info('Fetching calendar virtual users', { calendarId });
    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.CALENDAR_VIRTUAL_USERS(calendarId)}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .get<CalendarVirtualUsersResponse>(url);
      });

      const validated = CalendarVirtualUsersResponseSchema.parse(response);
      return validated.calendar_virtual_users;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new InvalidCalendarError(calendarId);
      }
      logger.error('Failed to fetch calendar virtual users', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to fetch calendar virtual users: ${getErrorMessage(error)}`
      );
    }
  }

  // ============================================================================
  // Event CRUD operations
  // ============================================================================

  /** Create a new event in a calendar. Requires CSRF token for authentication. */
  async createEvent(calendarId: string, eventData: CreateEventInput): Promise<Event> {
    await this.ensureAuthenticated();

    logger.info('Creating event', { calendarId, title: eventData.title });

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.CREATE_EVENT(calendarId)}`;
    const { url: eventUrl, ...rest } = eventData;
    const body = { ...rest, attachment: toAttachmentPayload(rest.attachment, eventUrl) };

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .post<CreateEventResponse>(url, body, undefined, true);
      });

      const validated = CreateEventResponseSchema.parse(response);

      logger.info('Event created successfully', {
        calendarId,
        eventUuid: validated.event.uuid,
      });

      return validated.event;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new InvalidCalendarError(calendarId);
      }

      if (getStatusCode(error) === 403) {
        logger.error('CSRF token missing or invalid', { error });
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }

      logger.error('Failed to create event', { calendarId, error });
      throw new TimeTreeAPIError(
        `Failed to create event: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }

  /** Update an existing event. Requires CSRF token for authentication. */
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
      const { url: eventUrl, ...body } = updateData;
      if (eventUrl !== undefined || body.attachment != null) {
        // TimeTree replaces attachment fields inconsistently on partial updates, so send
        // the current url/checklist/virtual attendees together with the changes.
        const current = await this.getEvent(calendarId, eventUuid);
        body.attachment = toAttachmentPayload(
          { ...existingAttachmentFields(current), ...(body.attachment ?? {}) },
          eventUrl
        );
      }

      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .put<UpdateEventResponse>(url, body, undefined, true);
      });

      const validated = UpdateEventResponseSchema.parse(response);

      logger.info('Event updated successfully', {
        calendarId,
        eventUuid: validated.event.uuid,
      });

      return validated.event;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new TimeTreeAPIError(`Event not found: ${eventUuid}`, 404);
      }

      if (getStatusCode(error) === 403) {
        logger.error('CSRF token missing or invalid', { error });
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }

      logger.error('Failed to update event', { calendarId, eventUuid, error });
      throw new TimeTreeAPIError(
        `Failed to update event: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }

  /** Fetch a single event by UUID. */
  async getEvent(calendarId: string, eventUuid: string): Promise<Event> {
    await this.ensureAuthenticated();

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.EVENT(calendarId, eventUuid)}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager.getHttpClient().get<CreateEventResponse>(url);
      });
      return CreateEventResponseSchema.parse(response).event;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new TimeTreeAPIError(`Event not found: ${eventUuid}`, 404);
      }
      throw error;
    }
  }

  /** Fetch a single event by UUID, or null when it does not exist. */
  private async getEventByUuid(calendarId: string, eventUuid: string): Promise<Event | null> {
    try {
      return await this.getEvent(calendarId, eventUuid);
    } catch (error) {
      if (getStatusCode(error) === 404) return null;
      throw error;
    }
  }

  /**
   * Delete an event from a calendar.
   *
   * The current web API accepts a no-body DELETE. If an older/variant endpoint rejects
   * that shape, fall back to the previously observed full-event-body DELETE.
   */
  async deleteEvent(calendarId: string, eventUuid: string): Promise<void> {
    await this.ensureAuthenticated();

    logger.info('Deleting event', { calendarId, eventUuid });

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.DELETE_EVENT(
      calendarId,
      eventUuid
    )}`;

    try {
      await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .delete(url, undefined, undefined, true);
      });

      logger.info('Event deleted successfully', { calendarId, eventUuid });
      return;
    } catch (error) {
      const statusCode = getStatusCode(error);

      if (statusCode === 404) {
        throw new TimeTreeAPIError(`Event not found: ${eventUuid}`, 404);
      }

      if (statusCode === 403) {
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }

      logger.debug('No-body event delete failed; retrying with full event body', {
        calendarId,
        eventUuid,
        statusCode,
      });
    }

    try {
      const targetEvent = await this.getEventByUuid(calendarId, eventUuid);

      if (!targetEvent) {
        throw new TimeTreeAPIError(`Event not found: ${eventUuid}`, 404);
      }

      await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .delete(url, targetEvent, undefined, true);
      });

      logger.info('Event deleted successfully after fallback', { calendarId, eventUuid });
    } catch (error) {
      if (error instanceof TimeTreeAPIError) {
        throw error;
      }

      if (getStatusCode(error) === 404) {
        throw new TimeTreeAPIError(`Event not found: ${eventUuid}`, 404);
      }

      if (getStatusCode(error) === 403) {
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }

      logger.error('Failed to delete event', { calendarId, eventUuid, error });
      throw new TimeTreeAPIError(
        `Failed to delete event: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }

  // ============================================================================
  // Memo wrappers (TimeTree stores memos as category=2 events)
  // ============================================================================

  async getMemosByCalendar(calendarId: string): Promise<Event[]> {
    const events = await this.getEventsByCalendar(calendarId, 0);
    return events.filter((event) => event.category === 2 && !event.deactivated_at);
  }

  async createMemo(calendarId: string, memoData: CreateMemoInput): Promise<Event> {
    const startAt = memoData.start_at ?? todayUtcMidnight();
    const attachment = memoData.checklist !== undefined || memoData.virtual_user_attendees !== undefined
      ? {
          ...(memoData.checklist !== undefined && { checklist: memoData.checklist }),
          ...(memoData.virtual_user_attendees !== undefined && {
            virtual_user_attendees: memoData.virtual_user_attendees,
          }),
        }
      : undefined;

    return this.createEvent(calendarId, {
      title: memoData.title,
      all_day: true,
      start_at: startAt,
      start_timezone: 'UTC',
      end_at: startAt,
      end_timezone: 'UTC',
      label_id: memoData.label_id,
      category: 2,
      note: memoData.note,
      location: memoData.location,
      url: memoData.url,
      attendees: [],
      recurrences: [],
      alerts: [],
      file_uuids: [],
      attachment,
    });
  }

  async updateMemo(
    calendarId: string,
    memoUuid: string,
    memoData: UpdateMemoInput
  ): Promise<Event> {
    const attachment = memoData.checklist !== undefined || memoData.virtual_user_attendees !== undefined
      ? {
          ...(memoData.checklist !== undefined && { checklist: memoData.checklist }),
          ...(memoData.virtual_user_attendees !== undefined && {
            virtual_user_attendees: memoData.virtual_user_attendees,
          }),
        }
      : undefined;

    return this.updateEvent(calendarId, memoUuid, {
      title: memoData.title,
      label_id: memoData.label_id,
      category: 2,
      note: memoData.note,
      location: memoData.location,
      url: memoData.url,
      attachment,
    });
  }

  async deleteMemo(calendarId: string, memoUuid: string): Promise<void> {
    await this.deleteEvent(calendarId, memoUuid);
  }

  // ============================================================================
  // Event comments/activities
  // ============================================================================

  async addEventComment(
    calendarId: string,
    eventUuid: string,
    content: string,
    silent: boolean = true
  ): Promise<EventActivity> {
    await this.ensureAuthenticated();

    logger.info('Adding event comment', { calendarId, eventUuid });

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.EVENT_ACTIVITY(calendarId, eventUuid)}`;
    const body = {
      id: createClientUuid(),
      attachment: { content },
      silent,
    };

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .post<EventActivityResponse>(url, body, undefined, true);
      });

      const validated = EventActivityResponseSchema.parse(response);
      return validated.event_activity;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new TimeTreeAPIError(`Event not found: ${eventUuid}`, 404);
      }
      if (getStatusCode(error) === 403) {
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }
      logger.error('Failed to add event comment', { calendarId, eventUuid, error });
      throw new TimeTreeAPIError(
        `Failed to add event comment: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }

  async listEventComments(calendarId: string, eventUuid: string): Promise<EventActivity[]> {
    await this.ensureAuthenticated();

    logger.info('Listing event comments', { calendarId, eventUuid });

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.EVENT_ACTIVITIES(calendarId, eventUuid)}`;

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .get<EventActivitiesResponse>(url);
      });

      const validated = EventActivitiesResponseSchema.parse(response);
      return validated.event_activities.filter(
        (activity) => activity.type === 0 && !activity.deactivated_at
      );
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new TimeTreeAPIError(`Event not found: ${eventUuid}`, 404);
      }
      logger.error('Failed to list event comments', { calendarId, eventUuid, error });
      throw new TimeTreeAPIError(
        `Failed to list event comments: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }

  async updateEventComment(
    calendarId: string,
    eventUuid: string,
    commentId: string,
    content: string
  ): Promise<EventActivity> {
    await this.ensureAuthenticated();

    logger.info('Updating event comment', { calendarId, eventUuid, commentId });

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.EVENT_ACTIVITY_BY_ID(
      calendarId,
      eventUuid,
      commentId
    )}`;
    const body = { attachment: { content } };

    try {
      const response = await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .put<EventActivityResponse>(url, body, undefined, true);
      });

      const validated = EventActivityResponseSchema.parse(response);
      return validated.event_activity;
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new TimeTreeAPIError(`Comment not found: ${commentId}`, 404);
      }
      if (getStatusCode(error) === 403) {
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }
      logger.error('Failed to update event comment', { calendarId, eventUuid, commentId, error });
      throw new TimeTreeAPIError(
        `Failed to update event comment: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }

  async deleteEventComment(
    calendarId: string,
    eventUuid: string,
    commentId: string
  ): Promise<void> {
    await this.ensureAuthenticated();

    logger.info('Deleting event comment', { calendarId, eventUuid, commentId });

    const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.EVENT_ACTIVITY_BY_ID(
      calendarId,
      eventUuid,
      commentId
    )}`;

    try {
      await this.rateLimiter.executeWithRetry(async () => {
        return await this.authManager
          .getHttpClient()
          .delete(url, undefined, undefined, true);
      });
    } catch (error) {
      if (getStatusCode(error) === 404) {
        throw new TimeTreeAPIError(`Comment not found: ${commentId}`, 404);
      }
      if (getStatusCode(error) === 403) {
        throw new TimeTreeAPIError('CSRF token missing or invalid - re-authentication required', 403);
      }
      logger.error('Failed to delete event comment', { calendarId, eventUuid, commentId, error });
      throw new TimeTreeAPIError(
        `Failed to delete event comment: ${getErrorMessage(error)}`,
        getStatusCode(error)
      );
    }
  }
}
