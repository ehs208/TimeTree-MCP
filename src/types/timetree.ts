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
