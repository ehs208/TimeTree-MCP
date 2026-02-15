# Contributing to TimeTree MCP Server

Thank you for your interest in contributing!

## ⚠️ Important Notice

This is an **UNOFFICIAL** project using reverse-engineered APIs:
- TimeTree may change their API at any time
- Focus on **read-only** functionality only
- Be respectful and constructive

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report:
1. Check if the bug has already been reported in [Issues](https://github.com/ehs208/TimeTree-MCP/issues)
2. Verify you're using the latest version
3. Test with different credentials/calendars to isolate the issue

When reporting a bug, include:
- MCP server version (`npm run build` output)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant log output (with sensitive data removed)

**Security Note**: Never include your TimeTree credentials in bug reports!

### Suggesting Features

Feature suggestions are welcome, but keep in mind:
- Focus on **read-only** operations (calendars, events)
- Avoid features that could overload TimeTree's servers
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
4. **Test your changes**:
   ```bash
   npm run build
   npm run dev  # for watch mode
   ```
5. **Commit** with a clear message:
   ```bash
   git commit -m "feat: add support for event categories"
   ```
6. **Push** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** against `main`

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- A TimeTree account (for testing)

### Installation

```bash
git clone https://github.com/ehs208/TimeTree-MCP.git
cd TimeTree-MCP
npm install
npm run build
```

### Project Structure

```
TimeTree-MCP/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── config/
│   │   └── config.ts         # API endpoints and constants
│   ├── utils/
│   │   ├── logger.ts         # Structured logging
│   │   ├── http-client.ts    # HTTP wrapper
│   │   └── rate-limiter.ts   # Token bucket rate limiter
│   ├── client/
│   │   ├── auth.ts           # Authentication manager
│   │   └── api.ts            # TimeTree API client
│   ├── tools/
│   │   ├── index.ts          # Tool registration
│   │   ├── calendar-tools.ts # Calendar operations
│   │   └── event-tools.ts    # Event operations
│   └── types/
│       └── timetree.ts       # TypeScript/Zod types
└── dist/                     # Build output
```

### Testing

Currently, testing is manual via MCP Inspector:

```bash
npx @modelcontextprotocol/inspector dist/index.js
```

Set environment variables:
```
TIMETREE_EMAIL=your-email@example.com
TIMETREE_PASSWORD=your-password
```

**Future**: We plan to add automated tests with mocked APIs.

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
- Update README.md and README.ko.md (both English and Korean)
- Add JSDoc comments to public functions
- Update CHANGELOG.md under `[Unreleased]`

## Release Process

Maintainers will:
1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create a git tag (`v0.x.x`)
4. Create a GitHub release

## Questions?

Open an [Issue](https://github.com/ehs208/TimeTree-MCP/issues) for questions or bugs.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
