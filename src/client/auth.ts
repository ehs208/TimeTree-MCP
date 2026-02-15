/**
 * TimeTree Authentication Manager
 * Handles login and session management for TimeTree API.
 */

import { randomUUID } from 'crypto';
import { TIMETREE_CONFIG } from '../config/config.js';
import { HttpClient } from '../utils/http-client.js';
import { logger } from '../utils/logger.js';
import type { AuthRequest } from '../types/timetree.js';

export class AuthenticationError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export interface AuthConfig {
  email: string;
  password: string;
}

export class TimeTreeAuthManager {
  private httpClient: HttpClient;
  private email: string;
  private password: string;
  private authenticated: boolean = false;

  constructor(config: AuthConfig) {
    this.email = config.email;
    this.password = config.password;
    this.httpClient = new HttpClient({
      timeout: TIMETREE_CONFIG.RATE_LIMIT.TIMEOUT_MS,
    });
  }

  /**
   * Generate UUID without hyphens (as required by TimeTree API)
   */
  private generateUUID(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * Authenticate with TimeTree and obtain session cookie
   */
  async authenticate(): Promise<void> {
    logger.info('Authenticating with TimeTree', { email: this.email });

    const uuid = this.generateUUID();
    const authRequest: AuthRequest = {
      uid: this.email,
      password: this.password,
      uuid,
    };

    try {
      const url = `${TIMETREE_CONFIG.BASE_URL}${TIMETREE_CONFIG.ENDPOINTS.AUTH}`;

      // Make authentication request
      await this.httpClient.put(url, authRequest);

      // Check if we got a session cookie
      const sessionCookie = this.httpClient.getSessionCookie();
      if (!sessionCookie) {
        throw new AuthenticationError('No session cookie received from server');
      }

      this.authenticated = true;
      logger.info('Authentication successful');
    } catch (error) {
      this.authenticated = false;

      if ((error as any).statusCode === 401) {
        throw new AuthenticationError(
          'Invalid email or password',
          401
        );
      }

      if ((error as any).statusCode === 403) {
        throw new AuthenticationError(
          'Account access forbidden',
          403
        );
      }

      throw new AuthenticationError(
        `Authentication failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get the current session cookie
   */
  getSessionCookie(): string {
    const cookie = this.httpClient.getSessionCookie();
    if (!cookie) {
      throw new AuthenticationError('Not authenticated - no session cookie');
    }
    return cookie;
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.authenticated && !!this.httpClient.getSessionCookie();
  }

  /**
   * Get the HTTP client (for use by API client)
   */
  getHttpClient(): HttpClient {
    return this.httpClient;
  }

  /**
   * Clear authentication state
   */
  logout(): void {
    this.httpClient.clearSessionCookie();
    this.authenticated = false;
    logger.info('Logged out');
  }
}
