# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added `get_holidays` for public holidays and memorial days by country and date range.
- Added `start_before`, `query`, `label_id`, and `include_memos` filters to `get_events`.

### Changed
- `get_events` now returns events sorted by start time, so `limit` keeps the earliest matches.
- Every tool now accepts `calendar_id` as a string or a number, matching the string IDs returned by `list_calendars`.

### Fixed
- Event and memo URLs are now saved. TimeTree stores them in the attachment, so the top-level `url` was previously ignored.
- Clearing a checklist with `checklist: []` no longer fails with HTTP 400.
- Updating only the URL or only the checklist no longer drops the other attachment field.

## [0.3.0] - 2026-05-25

### Added
- Added memo tools: `list_memos`, `create_memo`, `update_memo`, and `delete_memo`.
- Added event comment tools: `add_event_comment`, `list_event_comments`, `update_event_comment`, and `delete_event_comment`.
- Added calendar metadata tools: `get_calendar_labels`, `update_calendar_labels`, `get_calendar_members`, and `get_calendar_virtual_members`.
- Added Node test coverage for API endpoint contracts, tool registration/pass-through behavior, memo wrappers, and logger sanitization.

### Changed
- Expanded `create_event` and `update_event` to expose attendees, virtual attendees, alerts, RRULE recurrences, attached file UUIDs, and category overrides.
- Updated event deletion to use the verified no-body DELETE path first, with a full-event-body fallback for older API behavior.
- Updated CI to run typecheck, unit tests, and high-severity audit checks.
- Updated installation docs to emphasize local clone/link usage instead of implying npm registry publication.
- Added shared ignores for generated test/runtime artifacts.

### Security
- Hardened structured logging with recursive masking for credentials, sessions, CSRF tokens, request/response bodies, event titles, notes, locations, URLs, comments, and attachments.
- Removed raw MCP tool argument logging; logs now include argument shape only.
- Updated transitive dependencies with `npm audit fix`; audit reports 0 known vulnerabilities.

## [0.2.1] - 2026-05-10

### Added
- Event checklist support in create/update/get operations (@seisyo58)

## [0.2.0] - 2026-05-10

### Added
- CI workflow for automated build verification on PRs
- CODEOWNERS for auto-reviewer assignment
- Pre-flight checks in install script (git, Node.js 18+, npm)

### Changed
- Replaced `node-fetch` with native `fetch` (Node.js 18+)
- Improved `deleteEvent` error handling
- Updated all documentation (COMMANDS.md, CONTRIBUTING.md) for current state

### Removed
- `node-fetch` dependency

## [0.1.0] - 2026-02-15

### Added
- `list_calendars` tool - List all active TimeTree calendars
- `get_events` tool - Get events with automatic pagination and date filtering
- `get_updated_events` tool - Efficient incremental sync
- `create_event` / `update_event` / `delete_event` tools - Full CRUD
- Label color support (label_id 1-10)
- TimeTree authentication via email/password with CSRF token management
- Rate limiting (10 req/sec) with exponential backoff
- Structured logging with sensitive data masking
- Interactive install script with multi-client configuration guide

### Security
- Session cookies in memory only, never persisted
- Password and session ID masking in logs
