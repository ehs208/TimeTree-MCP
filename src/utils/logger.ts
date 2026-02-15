/**
 * Structured Logger Utility
 * Provides logging with different levels and automatic masking of sensitive data.
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'INFO') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      // Mask passwords, session IDs, and CSRF tokens
      return data
        .replace(/("password"\s*:\s*")[^"]+(")/gi, '$1***MASKED***$2')
        .replace(/(_session_id=)[^;]+/gi, '$1***MASKED***')
        .replace(/(x-csrf-token:\s*)[^\s,}]+/gi, '$1***MASKED***')
        .replace(/("x-csrf-token"\s*:\s*")[^"]+(")/gi, '$1***MASKED***$2');
    }
    if (typeof data === 'object' && data !== null) {
      const masked = { ...data };
      if ('password' in masked) {
        masked.password = '***MASKED***';
      }
      if ('_session_id' in masked) {
        masked._session_id = '***MASKED***';
      }
      if ('x-csrf-token' in masked) {
        masked['x-csrf-token'] = '***MASKED***';
      }
      return masked;
    }
    return data;
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const maskedMeta = meta ? this.maskSensitiveData(meta) : undefined;

    const logEntry = {
      timestamp,
      level,
      message,
      ...(maskedMeta && { meta: maskedMeta }),
    };

    const output = JSON.stringify(logEntry);

    // MCP uses stdout for JSON-RPC, so log to stderr
    console.error(output);
  }

  debug(message: string, meta?: any): void {
    this.log('DEBUG', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('WARN', message, meta);
  }

  error(message: string, meta?: any): void {
    this.log('ERROR', message, meta);
  }
}

// Export singleton instance
export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || 'INFO'
);
