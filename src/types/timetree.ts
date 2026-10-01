import { z } from 'zod';

// ============================================================================
// Shared embedded objects
// ============================================================================

export const ChecklistItemSchema = z.object({
  checked: z.boolean().default(false),
  title: z.string().min(1),
}).passthrough();

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const EventAttachmentSchema = z.object({
  url: z.string().optional().nullable(),
  content: z.string().optional(),
  checklist: z.array(ChecklistItemSchema).default([]),
  virtual_user_attendees: z.array(z.any()).default([]),
}).passthrough();

export const EventAttachmentInputSchema = z.object({
  url: z.string().optional().nullable(),
  content: z.string().optional(),
  // TimeTree rejects an empty checklist array; null clears it.
  checklist: z.array(ChecklistItemSchema).optional().nullable(),
  virtual_user_attendees: z.array(z.any()).optional(),
}).passthrough();

export type EventAttachment = z.infer<typeof EventAttachmentSchema>;
export type EventAttachmentInput = z.infer<typeof EventAttachmentInputSchema>;

// ============================================================================
// Calendar and user types
// ============================================================================

export const CalendarUserSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  role: z.number().optional(), // 1 = owner, 0 = member
  deactivated_at: z.number().nullable().optional(),
  birth_day: z.number().optional().nullable(),
  birthday: z.number().optional().nullable(),
}).passthrough();

export type CalendarUser = z.infer<typeof CalendarUserSchema>;

export const CalendarVirtualUserSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().optional().nullable(),
  calendar_id: z.number().optional(),
  deactivated_at: z.number().nullable().optional(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
}).passthrough();

export type CalendarVirtualUser = z.infer<typeof CalendarVirtualUserSchema>;

export const CalendarLabelSchema = z.object({
  id: z.number(),
  calendar_id: z.number().optional(),
  name: z.string().optional().nullable(),
  color: z.number().optional(),
  default_color: z.number().optional(),
  order: z.number().optional(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
}).passthrough();

export type CalendarLabel = z.infer<typeof CalendarLabelSchema>;

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
  calendar_labels: z.array(CalendarLabelSchema).optional(),
}).passthrough();

export type Calendar = z.infer<typeof CalendarSchema>;

// ============================================================================
// Event and activity types
// ============================================================================

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
  attachment: EventAttachmentInputSchema.optional().nullable(),
  deactivated_at: z.number().optional().nullable(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
}).passthrough();

export type Event = z.infer<typeof EventSchema>;

export const EventActivitySchema = z.object({
  id: z.string(),
  event_id: z.string().optional(),
  calendar_id: z.number().optional(),
  type: z.number().optional(),
  author_id: z.number().optional(),
  author_type: z.string().optional(),
  editor_id: z.number().optional(),
  attachment: z.object({
    content: z.string().optional(),
    items: z.array(z.any()).optional(),
  }).passthrough().optional().nullable(),
  deactivated_at: z.number().optional().nullable(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
}).passthrough();

export type EventActivity = z.infer<typeof EventActivitySchema>;

// ============================================================================
// API Responses
// ============================================================================

export const CalendarsResponseSchema = z.object({
  calendars: z.array(CalendarSchema),
}).passthrough();

export type CalendarsResponse = z.infer<typeof CalendarsResponseSchema>;

export const CalendarLabelsResponseSchema = z.object({
  calendar_labels: z.array(CalendarLabelSchema),
  since: z.number().optional(),
}).passthrough();

export type CalendarLabelsResponse = z.infer<typeof CalendarLabelsResponseSchema>;

export const MemorialDaySchema = z.object({
  id: z.union([z.number(), z.string()]),
  country_iso: z.string(),
  title: z.string(),
  workday: z.boolean().optional(),
  start_at: z.number(),
  end_at: z.number(),
  deactivated_at: z.number().nullable().optional(),
}).passthrough();

export const MemorialDaysResponseSchema = z.object({
  memorialdays: z.array(MemorialDaySchema),
}).passthrough();

export type MemorialDay = z.infer<typeof MemorialDaySchema>;
export type MemorialDaysResponse = z.infer<typeof MemorialDaysResponseSchema>;

export const CalendarUsersResponseSchema = z.object({
  calendar_users: z.array(CalendarUserSchema),
}).passthrough();

export type CalendarUsersResponse = z.infer<typeof CalendarUsersResponseSchema>;

export const CalendarVirtualUsersResponseSchema = z.object({
  calendar_virtual_users: z.array(CalendarVirtualUserSchema),
}).passthrough();

export type CalendarVirtualUsersResponse = z.infer<typeof CalendarVirtualUsersResponseSchema>;

export const EventsSyncResponseSchema = z.object({
  events: z.array(EventSchema),
  chunk: z.boolean(),
  since: z.number(),
}).passthrough();

export type EventsSyncResponse = z.infer<typeof EventsSyncResponseSchema>;

export const EventActivityResponseSchema = z.object({
  event_activity: EventActivitySchema,
}).passthrough();

export type EventActivityResponse = z.infer<typeof EventActivityResponseSchema>;

export const EventActivitiesResponseSchema = z.object({
  event_activities: z.array(EventActivitySchema),
  since: z.number().optional(),
}).passthrough();

export type EventActivitiesResponse = z.infer<typeof EventActivitiesResponseSchema>;

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
 * Input schema for creating a new event.
 * Based on TimeTree API POST /calendar/{id}/event.
 */
export const CreateEventInputSchema = z.object({
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
  attendees: z.array(z.number()).default([]),
  recurrences: z.array(z.any()).default([]),
  alerts: z.array(z.any()).default([]),
  file_uuids: z.array(z.string()).default([]),
  attachment: EventAttachmentInputSchema.optional(),
}).passthrough();

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

/**
 * Input schema for updating an existing event.
 * All fields are optional - only provide fields you want to change.
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
  attachment: EventAttachmentInputSchema.optional().nullable(),
}).passthrough();

export type UpdateEventInput = z.infer<typeof UpdateEventInputSchema>;

export interface CalendarLabelUpdateInput {
  id: number;
  name?: string;
  color?: number;
}

export interface CreateMemoInput {
  title: string;
  note?: string;
  label_id?: number;
  location?: string;
  url?: string;
  start_at?: number;
  checklist?: ChecklistItem[];
  virtual_user_attendees?: Array<string | number>;
}

export interface UpdateMemoInput {
  title?: string;
  note?: string;
  label_id?: number;
  location?: string;
  url?: string;
  checklist?: ChecklistItem[];
  virtual_user_attendees?: Array<string | number>;
}

/** Response schema for create event operation. */
export const CreateEventResponseSchema = z.object({
  event: EventSchema,
}).passthrough();

export type CreateEventResponse = z.infer<typeof CreateEventResponseSchema>;

/** Response schema for update event operation. */
export const UpdateEventResponseSchema = z.object({
  event: EventSchema,
}).passthrough();

export type UpdateEventResponse = z.infer<typeof UpdateEventResponseSchema>;

// ============================================================================
// MCP Tool Input Schemas (for validation in tools)
// ============================================================================

export const ToolChecklistSchema = z.array(ChecklistItemSchema);
export const ToolVirtualUserAttendeesSchema = z.array(z.union([z.string(), z.number()]));

/** MCP tool input for create_event. */
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
  attendees: z.array(z.number()).optional(),
  recurrences: z.array(z.any()).optional(),
  alerts: z.array(z.any()).optional(),
  file_uuids: z.array(z.string()).optional(),
  checklist: ToolChecklistSchema.optional(),
  virtual_user_attendees: ToolVirtualUserAttendeesSchema.optional(),
}).passthrough();

export type CreateEventToolInput = z.infer<typeof CreateEventToolInputSchema>;

/** MCP tool input for update_event. */
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
  attendees: z.array(z.number()).optional(),
  recurrences: z.array(z.any()).optional(),
  alerts: z.array(z.any()).optional(),
  file_uuids: z.array(z.string()).optional(),
  checklist: ToolChecklistSchema.optional(),
  virtual_user_attendees: ToolVirtualUserAttendeesSchema.optional(),
}).passthrough();

export type UpdateEventToolInput = z.infer<typeof UpdateEventToolInputSchema>;

/** MCP tool input for delete_event. */
export const DeleteEventToolInputSchema = z.object({
  calendar_id: z.number(),
  event_uuid: z.string(),
}).passthrough();

export type DeleteEventToolInput = z.infer<typeof DeleteEventToolInputSchema>;
