# Contributing to TimeTree MCP Server

Thank you for your interest in contributing!

## ⚠️ Important Notice

This is an **UNOFFICIAL** project using reverse-engineered APIs:
- TimeTree may change their API at any time
- Keep API usage conservative and respectful
- Be respectful and constructive

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report:
1. Check if the bug has already been reported in [Issues](https://github.com/ehs208/TimeTree-MCP/issues)
2. Verify you're using the latest version
3. Test with different credentials/calendars to isolate the issue

When reporting a bug, include:
- MCP server version (`version` in `package.json`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant log output (with sensitive data removed)

**Security Note**: Never include your TimeTree credentials in bug reports!

### Suggesting Features

Feature suggestions are welcome, but keep in mind:
- Avoid features that could overload TimeTree's servers
- Prefer features that keep the MCP surface understandable and maintainable
- Consider if the feature benefits most users

### Pull Requests

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**:
   - Follow the existing code style
   - Add/update tests if applicable
   - Update documentation
4. **Test your changes** (the same checks CI runs):
   ```bash
   npm run verify  # typecheck, tests, and audit
   ```
5. **Commit** with a clear message:
   ```bash
   git commit -m "feat: add support for event categories"
   ```
6. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** against `main`, and keep **Allow edits by maintainers** checked so maintainers can push small fixes such as docs or merge updates to your branch

## Development Setup

### Prerequisites

- Node.js >= 22
- npm or yarn
- A TimeTree account (for testing)

### Installation

```bash
git clone https://github.com/ehs208/TimeTree-MCP.git
cd TimeTree-MCP
npm ci
npm run build
```

If you want to test through MCP clients using `npx timetree-mcp`, run:

```bash
npm link
```

### Project Structure

```
TimeTree-MCP/
├── src/
│   ├── index.ts                  # MCP server entry point
│   ├── config/
│   │   └── config.ts             # API endpoints and constants
│   ├── utils/
│   │   ├── logger.ts             # Structured logging (stderr only)
│   │   ├── http-client.ts        # HTTP wrapper (native fetch)
│   │   ├── rate-limiter.ts       # Token bucket rate limiter
│   │   ├── recurrence.ts         # RRULE/EXDATE expansion for get_events
│   │   └── update-check.ts       # Startup check for a newer version
│   ├── client/
│   │   ├── auth.ts               # Authentication + CSRF token manager
│   │   └── api.ts                # TimeTree API client (read + CRUD)
│   ├── tools/
│   │   ├── index.ts                   # Tool registration
│   │   ├── shared-schemas.ts          # Shared input schemas (calendar_id)
│   │   ├── calendar-tools.ts          # list_calendars
│   │   ├── calendar-metadata-tools.ts # labels, members, virtual members
│   │   ├── event-tools.ts             # get_events, get_updated_events
│   │   ├── event-crud-tools.ts        # create_event, update_event, delete_event
│   │   ├── memo-tools.ts              # list/create/update/delete memos
│   │   ├── comment-tools.ts           # event comments
│   │   ├── holiday-tools.ts           # get_holidays
│   │   └── activity-tools.ts          # get_recent_activity
│   └── types/
│       ├── timetree.ts           # TypeScript/Zod schemas
│       └── label-colors.ts       # Event color mapping (label_id 1-10)
└── dist/                         # Build output
```

### Testing

Automated tests use mocked HTTP clients and never call TimeTree:

```bash
npm test         # build + node:test suites in tests/
npm run verify   # typecheck + tests + npm audit, as CI runs them
```

Add regression tests in `tests/` for parsing, request shape, and tool output changes.

For manual checks against a real account, use MCP Inspector:

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

Set environment variables in your shell only:
```
TIMETREE_EMAIL=your-email@example.com
TIMETREE_PASSWORD=your-password
```

Use a dedicated test calendar, and never commit real responses, calendar content, or credentials.

## Code Style

- **TypeScript**: Use strict mode
- **Formatting**: Follow existing style (consider adding Prettier/ESLint)
- **Naming**:
  - Functions: `camelCase`
  - Classes: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
- **Comments**: Use JSDoc for public APIs
- **Imports**: Use explicit `.js` extensions for ESM

## Commit Message Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

Examples:
```
feat: add calendar filtering by name
fix: handle network timeout errors
docs: update installation instructions
refactor: simplify pagination logic
```

## API Changes

If TimeTree changes their API:

1. Document the change in an issue
2. Update the affected code
3. Update `src/config/config.ts` with new endpoints
4. Update type definitions in `src/types/timetree.ts`
5. Test thoroughly
6. Update CHANGELOG.md

## Documentation

When adding features:
- Update README.md, README.ko.md, and README.ja.md together, plus COMMANDS.md for tool parameters
- Add JSDoc comments to public functions
- Update CHANGELOG.md under `[Unreleased]`

## Release Process

Nothing is published to npm, and `package.json` keeps `"private": true`. Users install in one of two ways:

- **Git clone of `main`.** A version bump on `main` reaches them: running servers compare their version with `package.json` on `main` and show an update notice when it is newer.
- **Claude Desktop extension (`.mcpb`).** Attached to a GitHub release. The same update notice points these users at the latest release.

Maintainers will:
1. Update `version` in `package.json`, `package-lock.json`, `mcpb/manifest.json`, and `SERVER_VERSION` in `src/config/config.ts` (tests check they match)
2. Move the `[Unreleased]` entries in CHANGELOG.md under the new version with the date
3. Merge to `main`
4. Right after the merge, tag the merge commit and push the tag:
   ```bash
   git tag v0.4.0
   git push origin v0.4.0
   ```
   The Release workflow (`.github/workflows/release.yml`) runs the tests, builds `build/timetree-mcp-<version>.mcpb`, and creates a GitHub release with the CHANGELOG section as release notes. It fails if the tag does not match `package.json` or the CHANGELOG has no section for that version.

Tag soon after merging: extension users see the update notice as soon as `main` has the new version.

To build the extension locally: `npm run build:mcpb`. Install the result in Claude Desktop to test it before tagging when the change touches startup, authentication, or bundling.

## Questions?

Open an [Issue](https://github.com/ehs208/TimeTree-MCP/issues) for questions or bugs.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
