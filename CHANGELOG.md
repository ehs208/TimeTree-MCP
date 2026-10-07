# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added `create_calendar` without member invitations, requiring an explicit name and purpose. Uses existing rate limiting and authentication recovery without retrying timeouts or server errors.
- Calendar creation distinguishes invalid fields and authentication failures without forwarding upstream details.

### Fixed
- Calendar creation treats invalid success responses as uncertain outcomes instead of invalid user input, and reports persistent TimeTree session or CSRF rejections as authentication failures.
- Authentication recovery no longer retries HTTP 5xx responses, even when their bodies contain session or CSRF error codes.

### Security
- Updated locked MCP SDK and proxy-addr dependencies to resolve high and critical audit findings.

## [0.4.0] - 2026-10-03

### Added
- Claude Desktop extension (`.mcpb`) for macOS and Windows: download it from GitHub releases and open it to install. Claude Desktop asks for the TimeTree email and password, so no clone, build, or config file is needed. Nothing is published to npm.
- GitHub releases: each version tag gets a release with the extension attached and the changelog section as release notes.
- The update notice tells extension users to download the latest release instead of running `git pull`.
- Added `get_holidays` for public holidays and memorial days by country and date range.
- Added `start_before`, `query`, `label_id`, and `include_memos` filters to `get_events`.
- `get_events` expands recurring events into their occurrences when `start_before` is set (`expand_recurring`, default on). EXDATE exceptions are honored.
- Added `get_recent_activity` for the calendar's recent change feed with member names.
- The server checks `main` for a newer version on startup and adds a one-time update notice to the next tool response. Set `TIMETREE_UPDATE_CHECK=false` to disable.
- `get_updated_events` marks deleted events with `deleted` and `deleted_at`.

### Changed
- README rewritten in English, Korean, and Japanese: example prompts, a demo image, user-facing features, and the one-click extension as the first install option for Claude Desktop.
- Node.js 22 or later is now required. Node.js 18 and 20 are past end-of-life; CI tests Node.js 22 and 24.
- `get_events` now returns events sorted by start time, so `limit` keeps the earliest matches.
- Every tool now accepts `calendar_id` as a string or a number, matching the string IDs returned by `list_calendars`.

### Fixed
- Event and memo URLs are now saved. TimeTree stores them in the attachment, so the top-level `url` was previously ignored.
- Clearing a checklist with `checklist: []` no longer fails with HTTP 400.
- Updating only the URL or only the checklist no longer drops the other attachment field.
- The server signs in again when TimeTree rejects an expired session or CSRF token, instead of failing every call until restart. Concurrent first calls share one sign-in, and sign-in requests go through the rate limiter.
- Unknown calendars, missing events, and rejected CSRF tokens now return the matching error messages. TimeTree reports these as HTTP 400/422 with error codes, which were previously shown as generic failures.
- Event and memo responses now include the saved URL instead of `null`.
- `get_updated_events` now reads every page of the event feed and filters by `updated_at`, instead of passing `updated_after` as the `since` sync cursor and reading only the first page.
- `delete_event` and `delete_memo` report a missing event as not found; TimeTree answers such deletes with success. A delete is no longer sent twice after a timeout or server error.
- Event, memo, comment, and calendar IDs are validated before they are used in request paths, so a crafted ID cannot redirect a request to another endpoint.
- `update_memo` and `delete_memo` refuse regular events instead of converting them into memos or deleting them.
- Fixed the Codex `config.toml` example in the docs and installer output (`[mcp_servers.timetree]`).
- Added a Japanese section to DISCLAIMER.md.

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
