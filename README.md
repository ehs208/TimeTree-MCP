# TimeTree MCP Server

[English](#english) | [한국어](README.ko.md)

## English

> ⚠️ **DISCLAIMER**: This is an **UNOFFICIAL** TimeTree MCP server for **PERSONAL USE ONLY**. Not affiliated with TimeTree, Inc. May break at any time. See [DISCLAIMER.md](DISCLAIMER.md) for full details.

An unofficial MCP (Model Context Protocol) server that allows MCP clients (Claude Desktop, Claude Code, Codex, Antigravity, Cline, Cursor, Windsurf, etc.) to access your TimeTree calendar data.

> **Credits**: This project was inspired by and uses API insights from [TimeTree-Exporter](https://github.com/eoleedi/TimeTree-Exporter) by [@eoleedi](https://github.com/eoleedi).

### Features

- 📅 **List Calendars** - Get all your TimeTree calendars
- 📆 **Get Events** - Retrieve events from any calendar with automatic pagination
- ➕ **Create Events** - Add new events to your calendars
- ✏️ **Update Events** - Modify existing events
- 🗑️ **Delete Events** - Remove events from your calendars
- 🔐 **Secure Authentication** - Email/password authentication (stored only in MCP config)
- ⚡ **Rate Limiting** - Token bucket algorithm to prevent API overload
- 🔄 **Auto Pagination** - Automatically fetches all events across multiple pages
- 🛡️ **Error Handling** - Comprehensive error handling with user-friendly messages
- 📝 **Structured Logging** - Detailed logs with sensitive data masking

### Requirements

- Node.js >= 18.0.0
- Git (for installation)
- A TimeTree account
- An MCP-compatible client (Claude Desktop, Claude Code, Codex, Antigravity, Cline, etc.)

### Installation

#### Quick Install (Recommended)

**One-line installation** - Automatically clones, builds, and configures:

```bash
curl -fsSL https://raw.githubusercontent.com/ehs208/TimeTree-MCP/main/TimeTree-MCP-install.sh | bash
```

The script will show configuration instructions for all supported MCP clients. Just copy the config for your client and add your TimeTree credentials.

**Uninstall:**
```bash
curl -fsSL https://raw.githubusercontent.com/ehs208/TimeTree-MCP/main/TimeTree-MCP-uninstall.sh | bash
```

#### Manual Install

<details>
<summary>Click to expand manual installation steps</summary>

1. **Clone and build:**

```bash
git clone https://github.com/ehs208/TimeTree-MCP.git
cd TimeTree-MCP
npm install
npm run build
```

2. **Link the package:**

```bash
npm link
```

3. **Configure your MCP client:**

See the [Configuration](#configuration) section below to set up your MCP client.

</details>

### Configuration

**Quick Example (Claude Desktop - macOS):**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "timetree": {
      "command": "npx",
      "args": ["timetree-mcp"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}
```

Then restart Claude Desktop (Cmd+Q and reopen).

📖 **For all MCP clients (Claude Desktop Windows, Claude Code CLI, Codex, Antigravity, VS Code editors, etc.):**
→ See **[docs/MCP_CLIENTS.md](docs/MCP_CLIENTS.md)** for detailed configuration instructions

### Updating

To update to the latest version:

```bash
cd ~/timetree-mcp  # or your installation path
git pull origin main
npm install
npm run build
```

Then restart your MCP client.

📖 **For detailed update instructions and troubleshooting:**
→ See **[docs/UPDATING.md](docs/UPDATING.md)**

### Usage

📖 **See [COMMANDS.md](COMMANDS.md) for detailed usage examples and workflows**

### MCP Tools

- **list_calendars** - List all calendars with participating users
- **get_events** - Get events from a calendar with auto-pagination
- **get_updated_events** - Get events updated after a specific timestamp (efficient incremental sync)
- **create_event** - Create a new event in a calendar
- **update_event** - Update an existing event
- **delete_event** - Delete an event from a calendar

📖 See [COMMANDS.md](COMMANDS.md) for parameters and usage details.

### Development

```bash
# Build the project
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev
```

### Limitations

- **Unofficial API**: May break if TimeTree changes their internal API
- **Rate Limited**: 10 requests/second (with automatic retry for 429 errors)
- **No Official Support**: TimeTree does not officially support this tool
- **CSRF Token Required**: Write operations require CSRF token (automatically extracted from TimeTree web page)

### Security

- Credentials are stored **only** in your local MCP configuration
- Session cookies are stored in memory only (never persisted to disk)
- Passwords and session IDs are automatically masked in logs
- All communication uses HTTPS

### Troubleshooting

#### "Missing required environment variables" error

Make sure `TIMETREE_EMAIL` and `TIMETREE_PASSWORD` are set in your MCP configuration.

#### Authentication fails

- Verify your email and password are correct
- Check if you can log in to TimeTree web app
- TimeTree might have changed their authentication API

#### No calendars or events returned

- Verify you have calendars/events in your TimeTree account
- Check the logs for detailed error messages
- The API might have changed

### Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### License

MIT License - see [LICENSE](LICENSE) file for details.

### Disclaimer

See [DISCLAIMER.md](DISCLAIMER.md) for important legal and usage information.

---

**NOT AFFILIATED WITH TIMETREE, INC.**

This is an independent, community-maintained project.
