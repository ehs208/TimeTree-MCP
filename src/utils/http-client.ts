/**
 * HTTP Client Wrapper
 * Provides a wrapper around node-fetch with common headers, timeout, and error handling.
 */

import fetch from 'node-fetch';
import { TIMETREE_CONFIG } from '../config/config.js';
import { logger } from './logger.js';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public response?: any
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface HttpClientOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

export class HttpClient {
  private defaultTimeout: number;
  private sessionCookie?: string;
  private csrfToken?: string;

  constructor(options: HttpClientOptions = {}) {
    this.defaultTimeout = options.timeout || 30000;
  }

  setSessionCookie(cookie: string): void {
    this.sessionCookie = cookie;
  }

  getSessionCookie(): string | undefined {
    return this.sessionCookie;
  }

  clearSessionCookie(): void {
    this.sessionCookie = undefined;
  }

  setCsrfToken(token: string): void {
    this.csrfToken = token;
  }

  getCsrfToken(): string | undefined {
    return this.csrfToken;
  }

  clearCsrfToken(): void {
    this.csrfToken = undefined;
  }

  private buildHeaders(
    additionalHeaders?: Record<string, string>,
    requiresCsrf: boolean = false
  ): Record<string, string> {
    const headers: Record<string, string> = {
      ...TIMETREE_CONFIG.HEADERS,
      ...additionalHeaders,
    };

    if (this.sessionCookie) {
      headers['Cookie'] = `${TIMETREE_CONFIG.SESSION_COOKIE_NAME}=${this.sessionCookie}`;
    }

    if (requiresCsrf && this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }

    return headers;
  }

  async request<T>(
    url: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      timeout?: number;
      requiresCsrf?: boolean;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, headers, timeout = this.defaultTimeout, requiresCsrf = false } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      logger.debug(`HTTP ${method} ${url}`);

      const response = await fetch(url, {
        method,
        headers: this.buildHeaders(headers, requiresCsrf),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Extract session cookie from Set-Cookie header if present
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const sessionMatch = setCookie.match(/_session_id=([^;]+)/);
        if (sessionMatch) {
          this.sessionCookie = sessionMatch[1];
          logger.debug('Session cookie updated');
        }
      }

      // Extract CSRF token from response headers if present
      const csrfTokenHeader = response.headers.get('x-csrf-token');
      if (csrfTokenHeader) {
        this.csrfToken = csrfTokenHeader;
        logger.debug('CSRF token updated from response header');
      }

      // Handle non-2xx responses
      if (!response.ok) {
        const errorBody = await response.text();
        logger.error(`HTTP ${response.status} ${response.statusText}`, {
          url,
          status: response.status,
          body: errorBody,
        });

        throw new HttpError(
          response.status,
          `HTTP ${response.status}: ${response.statusText}`,
          errorBody
        );
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      return (await response.text()) as any;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof HttpError) {
        throw error;
      }

      if ((error as any).name === 'AbortError') {
        logger.error('Request timeout', { url, timeout });
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      logger.error('Network error', { url, error });
      throw new Error(`Network error: ${(error as Error).message}`);
    }
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(url, { method: 'GET', headers });
  }

  async post<T>(
    url: string,
    body: any,
    headers?: Record<string, string>,
    requiresCsrf: boolean = true
  ): Promise<T> {
    return this.request<T>(url, { method: 'POST', body, headers, requiresCsrf });
  }

  async put<T>(
    url: string,
    body: any,
    headers?: Record<string, string>,
    requiresCsrf: boolean = false
  ): Promise<T> {
    return this.request<T>(url, { method: 'PUT', body, headers, requiresCsrf });
  }

  async delete<T>(
    url: string,
    body?: any,
    headers?: Record<string, string>,
    requiresCsrf: boolean = true
  ): Promise<T> {
    return this.request<T>(url, { method: 'DELETE', body, headers, requiresCsrf });
  }
}
