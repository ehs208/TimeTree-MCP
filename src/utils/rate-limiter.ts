/**
 * Token Bucket Rate Limiter
 * Implements rate limiting to prevent overwhelming the TimeTree API.
 */

import { logger } from './logger.js';

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxRequestsPerSecond: number = 10) {
    this.maxTokens = maxRequestsPerSecond;
    this.refillRate = maxRequestsPerSecond;
    this.tokens = maxRequestsPerSecond;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async waitForToken(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Need to wait
    const tokensNeeded = 1 - this.tokens;
    const waitTime = (tokensNeeded / this.refillRate) * 1000; // milliseconds

    logger.debug('Rate limit: waiting for token', { waitTime });

    await new Promise((resolve) => setTimeout(resolve, waitTime));

    this.refill();
    this.tokens -= 1;
  }

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.waitForToken();
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a 429 (rate limit) error
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as any).statusCode;
          if (statusCode === 429) {
            const backoffTime = Math.pow(2, attempt) * 1000; // exponential backoff
            logger.warn('Rate limited by server, backing off', {
              attempt,
              backoffTime,
            });
            await new Promise((resolve) => setTimeout(resolve, backoffTime));
            continue;
          }
        }

        // Not a rate limit error, throw immediately
        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }
}
