/**
 * Holiday Tools for MCP
 * Reads public holidays and memorial days that TimeTree shows on calendars.
 */

import { z } from 'zod';
import type { TimeTreeAPIClient } from '../client/api.js';
import { logger } from '../utils/logger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 731;

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const GetHolidaysInputSchema = z.object({
  country_iso: z
    .array(z.string().regex(/^[A-Za-z]{2}$/, 'Use ISO 3166-1 alpha-2 codes such as KR or JP'))
    .min(1)
    .max(5)
    .describe('Country codes, e.g. ["KR"] or ["KR", "JP"]'),
  start_date: DateSchema.describe('First date to include (YYYY-MM-DD, UTC)'),
  end_date: DateSchema.describe('Last date to include (YYYY-MM-DD, UTC)'),
  days_off_only: z
    .boolean()
    .default(false)
    .describe('Only return days off (exclude observances that are working days)'),
});

function toDateString(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function errorContent(error: string, message: string, details?: unknown) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error, message, ...(details !== undefined && { details }) }, null, 2),
      },
    ],
    isError: true,
  };
}

export function createGetHolidaysTool(apiClient: TimeTreeAPIClient) {
  return {
    name: 'get_holidays',
    description:
      'Get public holidays and memorial days for one or more countries in a date range (up to 2 years). ' +
      'Useful for scheduling around days off. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        country_iso: {
          type: 'array',
          items: { type: 'string' },
          description: 'ISO 3166-1 alpha-2 country codes, e.g. ["KR"] or ["KR", "JP"] (max 5)',
        },
        start_date: { type: 'string', description: 'First date to include (YYYY-MM-DD, UTC)' },
        end_date: { type: 'string', description: 'Last date to include (YYYY-MM-DD, UTC)' },
        days_off_only: {
          type: 'boolean',
          description: 'Only return days off, excluding observances that are working days (default: false)',
        },
      },
      required: ['country_iso', 'start_date', 'end_date'],
    },
    handler: async (args: unknown) => {
      try {
        const input = GetHolidaysInputSchema.parse(args);
        const from = new Date(`${input.start_date}T00:00:00Z`);
        const to = new Date(new Date(`${input.end_date}T00:00:00Z`).getTime() + DAY_MS);

        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
          return errorContent('Invalid input', 'start_date must be on or before end_date');
        }
        if ((to.getTime() - from.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
          return errorContent('Invalid input', 'Date range must be 2 years or less');
        }

        const countries = [...new Set(input.country_iso.map((code) => code.toUpperCase()))];
        logger.info('Tool: get_holidays called', { countries, start_date: input.start_date, end_date: input.end_date });

        const days = await apiClient.getMemorialDays(countries, from, to);
        const holidays = days
          .filter((day) => !input.days_off_only || day.workday !== true)
          .sort((a, b) => a.start_at - b.start_at)
          .map((day) => ({
            date: toDateString(day.start_at),
            end_date: toDateString(day.end_at),
            title: day.title,
            country_iso: day.country_iso,
            day_off: day.workday !== true,
          }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ holidays, total: holidays.length }, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool: get_holidays failed', { error });
        if ((error as { name?: string }).name === 'ZodError') {
          return errorContent('Invalid input', 'Please provide valid holiday query parameters', (error as { errors?: unknown }).errors);
        }
        return errorContent('Failed to get holidays', (error as Error).message);
      }
    },
  };
}
