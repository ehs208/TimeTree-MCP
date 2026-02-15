# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-15

### Added
- Initial release of TimeTree MCP Server
- `list_calendars` tool - List all active TimeTree calendars
- `get_events` tool - Get events from a specific calendar with automatic pagination
- TimeTree authentication via email/password
- Rate limiting (10 requests/second with token bucket algorithm)
- Exponential backoff for 429 (rate limit) errors
- Automatic pagination for event sync API
- Structured logging with sensitive data masking
- Comprehensive error handling
- TypeScript support with full type definitions
- Zod schema validation for API responses

### Security
- Session cookie management (memory only, never persisted)
- Password and session ID masking in logs
- Environment variable validation
