import { z } from 'zod';

// TimeTree Calendar User Type
export const CalendarUserSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  role: z.number().optional(), // 1 = owner, 0 = member
  deactivated_at: z.number().nullable().optional(),
  birth_day: z.number().optional().nullable(),
  birthday: z.number().optional().nullable(),
  // Allow additional fields but ignore them
}).passthrough();

export type CalendarUser = z.infer<typeof CalendarUserSchema>;

// TimeTree Calendar Type
export const CalendarSchema = z.object({
  id: z.number(),
  name: z.string(),
  alias_code: z.string().optional(),
  type: z.number().optional(),
  color: z.number().optional(),
  purpose: z.string().optional(),
  deactivated_at: z.number().nullable().optional(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
  calendar_users: z.array(CalendarUserSchema).optional(),
  // Allow additional fields but ignore them
}).passthrough();

export type Calendar = z.infer<typeof CalendarSchema>;

// TimeTree Event Type
export const EventSchema = z.object({
  id: z.string(),
  uuid: z.string(),
  calendar_id: z.number(),
  title: z.string(),
  all_day: z.boolean(),
  start_at: z.number(), // Unix timestamp in milliseconds
  start_timezone: z.string().optional(),
  end_at: z.number(), // Unix timestamp in milliseconds
  end_timezone: z.string().optional(),
  category: z.number().optional(),
  type: z.number().optional(),
  author_id: z.number().optional(),
  label_id: z.number().optional(),
  location: z.string().optional().nullable(),
  location_lat: z.union([z.number(), z.string()]).optional().nullable(),
  location_lon: z.union([z.number(), z.string()]).optional().nullable(),
  url: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  attendees: z.array(z.number()).optional(),
  recurrences: z.array(z.any()).optional(),
  alerts: z.array(z.any()).optional(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
  // Allow additional fields but ignore them
}).passthrough();

export type Event = z.infer<typeof EventSchema>;

// API Responses
export const CalendarsResponseSchema = z.object({
  calendars: z.array(CalendarSchema),
});

export type CalendarsResponse = z.infer<typeof CalendarsResponseSchema>;

export const EventsSyncResponseSchema = z.object({
  events: z.array(EventSchema),
  chunk: z.boolean(),
  since: z.number(),
});

export type EventsSyncResponse = z.infer<typeof EventsSyncResponseSchema>;

// Auth Request/Response
export const AuthRequestSchema = z.object({
  uid: z.string().email(),
  password: z.string(),
  uuid: z.string(),
});

export type AuthRequest = z.infer<typeof AuthRequestSchema>;

// ============================================================================
// CRUD Operation Schemas
// ============================================================================

/**
 * Input schema for creating a new event
 * Based on TimeTree API POST /calendar/{id}/event
 */
export const CreateEventInputSchema = z.object({
  title: z.string().min(1),
  all_day: z.boolean().default(false),
  start_at: z.number(), // Unix timestamp in milliseconds
  start_timezone: z.string().default('UTC'),
  end_at: z.number(), // Unix timestamp in milliseconds
  end_timezone: z.string().default('UTC'),
  label_id: z.number().min(1).max(10).optional(), // 1-10 for color mapping
  category: z.number().default(1),
  note: z.string().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
  attendees: z.array(z.number()).optional(),
  recurrences: z.array(z.any()).default([]),
  alerts: z.array(z.any()).default([]),
  file_uuids: z.array(z.string()).default([]),
  attachment: z.object({
    url: z.string().url(),
    virtual_user_attendees: z.array(z.any()).default([]),
  }).optional(),
}).passthrough();

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

/**
 * Input schema for updating an existing event
 * All fields are optional - only provide fields you want to change
 */
export const UpdateEventInputSchema = z.object({
  title: z.string().min(1).optional(),
  all_day: z.boolean().optional(),
  start_at: z.number().optional(),
  start_timezone: z.string().optional(),
  end_at: z.number().optional(),
  end_timezone: z.string().optional(),
  label_id: z.number().min(1).max(10).optional(),
  category: z.number().optional(),
  note: z.string().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
  attendees: z.array(z.number()).optional(),
  recurrences: z.array(z.any()).optional(),
  alerts: z.array(z.any()).optional(),
  file_uuids: z.array(z.string()).optional(),
  attachment: z.object({
    url: z.string().url(),
    virtual_user_attendees: z.array(z.any()).optional(),
  }).optional(),
}).passthrough();

export type UpdateEventInput = z.infer<typeof UpdateEventInputSchema>;

/**
 * Response schema for create event operation
 */
export const CreateEventResponseSchema = z.object({
  event: EventSchema,
}).passthrough();

export type CreateEventResponse = z.infer<typeof CreateEventResponseSchema>;

/**
 * Response schema for update event operation
 */
export const UpdateEventResponseSchema = z.object({
  event: EventSchema,
}).passthrough();

export type UpdateEventResponse = z.infer<typeof UpdateEventResponseSchema>;

// ============================================================================
// MCP Tool Input Schemas (for validation in tools)
// ============================================================================

/**
 * MCP tool input for create_event
 */
export const CreateEventToolInputSchema = z.object({
  calendar_id: z.number(),
  title: z.string().min(1),
  all_day: z.boolean().default(false),
  start_at: z.number(),
  start_timezone: z.string().default('UTC'),
  end_at: z.number(),
  end_timezone: z.string().default('UTC'),
  label_id: z.number().min(1).max(10).optional(),
  category: z.number().default(1),
  note: z.string().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
}).passthrough();

export type CreateEventToolInput = z.infer<typeof CreateEventToolInputSchema>;

/**
 * MCP tool input for update_event
 */
export const UpdateEventToolInputSchema = z.object({
  calendar_id: z.number(),
  event_uuid: z.string(),
  title: z.string().min(1).optional(),
  all_day: z.boolean().optional(),
  start_at: z.number().optional(),
  start_timezone: z.string().optional(),
  end_at: z.number().optional(),
  end_timezone: z.string().optional(),
  label_id: z.number().min(1).max(10).optional(),
  category: z.number().optional(),
  note: z.string().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
}).passthrough();

export type UpdateEventToolInput = z.infer<typeof UpdateEventToolInputSchema>;

/**
 * MCP tool input for delete_event
 */
export const DeleteEventToolInputSchema = z.object({
  calendar_id: z.number(),
  event_uuid: z.string(),
}).passthrough();

export type DeleteEventToolInput = z.infer<typeof DeleteEventToolInputSchema>;
