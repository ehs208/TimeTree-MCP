# TimeTree MCP Project Guide

This is the shared project guide for people and AI coding assistants working in this repository. Keep it safe to commit: add only project-level guidance, never personal preferences, local machine paths, private credentials, copied calendar data, or session artifacts.

## Project Purpose

TimeTree MCP is an unofficial Model Context Protocol (MCP) server for TimeTree. It connects MCP-compatible clients to TimeTree calendar data through TimeTree web APIs.

Important context:

- This project is not affiliated with, endorsed by, or supported by TimeTree.
- The API behavior is based on observed TimeTree web app behavior and may change without notice.
- `package.json` must keep `"private": true` unless maintainers explicitly decide to publish.
- Do not publish this package to npm or an MCP marketplace without maintainer approval.
- Distribution is limited to two channels: a git clone of `main`, and the Claude Desktop extension (`.mcpb`) attached to GitHub releases. See "Distribution" below.
- Treat upstream endpoints, cookies, CSRF tokens, and session identifiers as implementation details.

## Current Capabilities

The server currently exposes tools for:

- Listing calendars.
- Reading calendar events and updated events.
- Creating, updating, and deleting events.
- Managing event comments.
- Listing and managing memos.
- Reading and updating calendar labels.
- Reading calendar members and virtual members.
- Reading public holidays and recent calendar activity.

Write operations depend on TimeTree web authentication and CSRF handling. Keep error messages clear, but do not expose internal auth material.

## Architecture Map

- `src/index.ts` - MCP server entry point and request routing.
- `src/config/config.ts` - TimeTree constants, API paths, and client metadata.
- `src/client/auth.ts` - Email/password authentication, CSRF extraction, and session state coordination.
- `src/client/api.ts` - TimeTree HTTP client operations, pagination, and domain-specific API methods.
- `src/tools/` - MCP tool definitions and input/output shaping.
- `src/types/` - Zod schemas and shared TimeTree types.
- `src/utils/http-client.ts` - HTTP wrapper, headers, cookies, and CSRF token handling.
- `src/utils/logger.ts` - Structured logging and sensitive-data masking.
- `src/utils/rate-limiter.ts` - Token-bucket request throttling.
- `src/utils/update-check.ts` - Startup version check against `main` and the install-specific update notice.
- `mcpb/manifest.json`, `mcpb/icon.png` - Claude Desktop extension manifest and icon.
- `scripts/build-mcpb.mjs` - Bundles the server and all dependencies into one file and packs `build/timetree-mcp-<version>.mcpb`.
- `scripts/mcpb-packer/` - The MCPB packer locked with its own `package-lock.json`, installed only when building the extension. It is kept out of the main `package.json` so its dev-only advisories do not fail the server's `npm audit`. Update it on purpose, not through the main lockfile.
- `.github/workflows/release.yml` - On a `v*` tag, tests, builds the `.mcpb`, and creates the GitHub release.
- `docs/assets/` - Icon and GitHub social preview (SVG sources plus rendered PNGs), and the README demo GIFs (`demo-en.gif`, `demo-ko.gif`, `demo-ja.gif`).

Prefer small changes that follow these boundaries instead of adding new layers or dependencies.

## API Behavior Notes

- TimeTree event sync uses `since` as an incremental sync cursor, not as a date filter.
- Date filtering for general event reads should happen client-side with tool parameters such as `start_after`.
- Event timestamps are Unix timestamps in milliseconds; user-facing output should prefer ISO 8601 strings when helpful.
- The upstream API may return mixed types for the same field. Zod schemas should use flexible unions where observed and `.passthrough()` for unknown fields.
- Label IDs `1` through `10` map to the color metadata in `src/types/label-colors.ts`.

## Distribution

The project ships as a product, without npm. Keep both install paths working.

- **Git clone of `main`** (Claude Code, Codex, Cursor, and other clients). Requires Node.js 22+. Runs `dist/index.js` with credentials in the client's `env`.
- **Claude Desktop extension (`.mcpb`)** on macOS and Windows. Built by `npm run build:mcpb` and attached to a GitHub release by the Release workflow. Claude Desktop asks for the email and password through `user_config` (the password is marked `sensitive`) and passes them as `TIMETREE_EMAIL` and `TIMETREE_PASSWORD`.

Why not npm: the server handles a TimeTree password through undocumented endpoints. A registry package widens exposure and adds a supply-chain target (one compromised publish could leak every user's password), so it stays `"private": true`. Releases are built in CI from a tagged commit of this repository.

Extension rules:

- The bundle has no `node_modules`. Every runtime dependency is inlined by `scripts/build-mcpb.mjs`, so a new dependency must work when bundled. After dependency or startup changes, run `npm run build:mcpb` and smoke-test the bundle (initialize plus `tools/list` over stdio).
- The bundle runs on the Node.js that ships with Claude Desktop, not the user's Node. Claude Desktop 2.9939 (Electron 44) ships Node 24. The bundle targets Node 22 and the manifest requires `node >=22.0.0`, matching `engines` in `package.json`.
- The manifest sets `TIMETREE_INSTALL_SOURCE=mcpb`. `formatUpdateNotice` uses it to send extension users to the latest release instead of `git pull`.
- `mcpb/manifest.json` `tools` must list exactly the tools from `registerTools`, and its `version` must match `package.json`. Tests check both.
- `privacy_policies` lists every external service the extension sends data to (TimeTree for sign-in and calendar data, GitHub for the update check). Add an entry when a new service is contacted.
- Extension metadata must not use TimeTree's logo or brand assets, and `display_name` keeps "(Unofficial)".

## Security and Privacy Rules

- Never commit real `TIMETREE_EMAIL`, `TIMETREE_PASSWORD`, cookies, CSRF tokens, session IDs, request captures, or personal calendar content.
- Do not create or commit `.env` files. Credentials must come from MCP client environment configuration or the extension's `user_config`.
- Session cookies and CSRF tokens should remain in memory only.
- All logs must go to stderr. MCP uses stdout for JSON-RPC, so `console.log()` can break protocol output.
- Use the shared logger so sensitive fields are masked consistently.
- Do not expose upstream implementation details in normal MCP tool responses unless they are necessary for debugging and safe to share.

## Development Workflow

```bash
npm install
npm run typecheck
npm test
npm run build
# or run all CI checks at once:
npm run verify
```

Build the Claude Desktop extension (writes to the git-ignored `build/` folder):

```bash
npm run build:mcpb
```

For manual MCP inspection:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

When testing manually with a real account, keep credentials only in the shell or MCP client environment. Do not paste real responses into committed fixtures or documentation.

## Documentation Standards

- Keep `README.md`, `README.ko.md`, and `README.ja.md` aligned for user-facing changes.
- Keep client setup details in `docs/MCP_CLIENTS.md` and update the installer output when setup instructions change.
- README first screen order: title and one-line value, badges, language links, short unofficial notice, example prompts, demo image, then "What it does" in user terms. Implementation details (rate limiting, logging, CSRF) belong in "How it works", not in the feature list.
- Write user-facing copy plainly: no emoji section markers, no hype words, and only claims the project can back up. Example prompts and the demo image use made-up data.
- Edit images as SVG in `docs/assets/` and re-render the PNGs (`rsvg-convert`). The demo GIFs are screen recordings of Claude Desktop against a test calendar with made-up events; remove personal names from every frame (cover them, do not blur) and keep each GIF under a few MB. `mcpb/icon.png` is rendered from `docs/assets/icon.svg` at 512x512.
- Keep shell script output in English unless maintainers decide otherwise.
- Use generic placeholders such as `your-email@example.com`, `your-password`, and `/absolute/path/to/...`.
- Avoid contributor-facing text that depends on a maintainer's local environment.

## Tool Design Guidelines

- Tool descriptions should be short and task-oriented.
- Validate inputs with Zod and return clear errors through MCP content responses.
- Keep output useful but bounded; support limits and filters for potentially large calendars.
- Avoid returning raw upstream payloads. Shape responses into stable, documented fields.
- For write tools, clearly describe side effects and required identifiers.

## Testing Expectations

- Prefer fixture or mock tests over live API tests.
- Add regression tests for parsing, logging, masking, tool output shape, and sync/pagination behavior.
- Before claiming a code change is complete, run the smallest relevant validation first, then broader checks when appropriate.
- If a live TimeTree behavior was manually verified, summarize the behavior without committing private data.

## Release and Version Checklist

Before a release-oriented commit:

1. Confirm `package.json`, `package-lock.json`, `mcpb/manifest.json`, and `SERVER_VERSION` in `src/config/config.ts` versions match. Users get an update notice when `main` has a newer version, so bump the version only when the change should reach users.
2. Confirm `package.json` still has `"private": true`.
3. Run `npm run typecheck`, `npm test`, and `npm run build` when code changed, and `npm run build:mcpb` when dependencies, startup, or the manifest changed.
4. Check that docs do not contain personal paths, credentials, copied calendar data, or private session material.
5. Update `CHANGELOG.md` when behavior changes are user-visible. The release workflow uses the version's CHANGELOG section as release notes and fails if it is missing.
6. After merging the version bump, tag the merge commit `v<version>` and push the tag right away, so extension users who see the update notice can find the release. Pushing a tag publishes a release; do it only when a maintainer asks.

## Contribution Notes

This is primarily a project guide, not a full contribution handbook. For contributor-facing process details, use `CONTRIBUTING.md`. When changing this project:

- Keep diffs focused and reversible.
- Prefer existing helpers and patterns before adding abstractions.
- Do not add dependencies unless the benefit is clear and documented.
- Make privacy-preserving behavior the default.
- When uncertain about upstream behavior, document the observation method without storing sensitive captures.
- After opening a pull request, wait for the Codex review (`chatgpt-codex-connector`), which usually lands within a few minutes. Address or answer each finding, then comment `@codex review` after pushing fixes and check the new review before asking for a merge.

## Code Review Rules

Automated and human reviewers should flag these repository-specific issues. Leave formatting and lint-style nits to CI.

- Any write to stdout in `src/` (`console.log`, `process.stdout.write`). MCP uses stdout for JSON-RPC; logs must go through `src/utils/logger.ts`.
- Credentials, cookies, CSRF tokens, session IDs, or raw upstream response bodies reaching logs or tool responses without the shared logger's masking.
- Tool responses that forward raw upstream payloads instead of shaped, documented fields.
- TimeTree requests that bypass `rateLimiter.executeWithRetry`.
- Treating the `since` sync cursor as a date filter.
- User-visible tool changes without matching updates to `README.md`, `README.ko.md`, `README.ja.md`, `COMMANDS.md`, and `CHANGELOG.md` under `[Unreleased]`.
- Real account data in tests, fixtures, or docs: emails, calendar names, event content, or request captures.
- Removing `"private": true` from `package.json`, or `package.json`, `package-lock.json`, and `mcpb/manifest.json` versions drifting apart.
- Adding or renaming a tool without updating `mcpb/manifest.json` `tools`.
- Any step that publishes to npm or another package registry.
- New runtime dependencies without a stated reason.
