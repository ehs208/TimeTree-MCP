# TimeTree MCP Server

[English](#english) | [한국어](README.ko.md)

## English

> ⚠️ **DISCLAIMER**: This is an **UNOFFICIAL** TimeTree MCP server for **PERSONAL USE ONLY**. Not affiliated with TimeTree, Inc. May break at any time. See [DISCLAIMER.md](DISCLAIMER.md) for full details.

An unofficial MCP (Model Context Protocol) server that allows Claude AI to read your TimeTree calendar data.

> **Credits**: This project was inspired by and uses API insights from [TimeTree-Exporter](https://github.com/eoleedi/TimeTree-Exporter) by [@eoleedi](https://github.com/eoleedi).

### Features

- 📅 **List Calendars** - Get all your TimeTree calendars
- 📆 **Get Events** - Retrieve events from any calendar with automatic pagination
- 🔐 **Secure Authentication** - Email/password authentication (stored only in MCP config)
- ⚡ **Rate Limiting** - Token bucket algorithm to prevent API overload
- 🔄 **Auto Pagination** - Automatically fetches all events across multiple pages
- 🛡️ **Error Handling** - Comprehensive error handling with user-friendly messages
- 📝 **Structured Logging** - Detailed logs with sensitive data masking

### Requirements

- Node.js >= 18.0.0
- A TimeTree account
- An MCP-compatible client (Claude Desktop, Claude Code, Antigravity, Cline, etc.)

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

2. **Choose installation method:**

**Option A: Global link (cleaner)**
```bash
npm link
```

**Option B: Direct execution (simpler)**
```bash
# No additional steps needed
```

3. **Configure your MCP client:**

See the [Configuration](#configuration) section below to set up your MCP client.

</details>

### Configuration

#### Supported MCP Clients

<details>
<summary><b>1️⃣ Claude Desktop (macOS)</b></summary>

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**With npm link:**
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

**Without npm link:**
```json
{
  "mcpServers": {
    "timetree": {
      "command": "node",
      "args": ["/absolute/path/to/TimeTree-MCP/dist/index.js"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}
```

**Then:** Restart Claude Desktop (Cmd+Q and reopen)

</details>

<details>
<summary><b>2️⃣ Claude Desktop (Windows)</b></summary>

**File:** `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:** Same as macOS (see above)

**Then:** Restart Claude Desktop

</details>

<details>
<summary><b>3️⃣ Claude Code (CLI)</b></summary>

**With npm link:**
```bash
claude mcp add timetree \
  --env TIMETREE_EMAIL=your@email.com \
  --env TIMETREE_PASSWORD=yourpass \
  -- npx timetree-mcp
```

**Without npm link:**
```bash
claude mcp add timetree \
  --env TIMETREE_EMAIL=your@email.com \
  --env TIMETREE_PASSWORD=yourpass \
  -- node /absolute/path/to/TimeTree-MCP/dist/index.js
```

</details>

<details>
<summary><b>4️⃣ Google Antigravity</b></summary>

**File (Windows):** `C:\Users\<USER_NAME>\.gemini\antigravity\mcp_config.json`
**File (macOS/Linux):** `~/.gemini/antigravity/mcp_config.json`

**Or via UI:** Click ⋮ (top right) → MCP Servers → Manage MCP Servers → View raw config

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

</details>

<details>
<summary><b>5️⃣ VS Code-based Editors (Cline, Cursor, Windsurf, etc.)</b></summary>

Configuration varies by editor. Most use similar MCP config format.

**Example for Cline (VS Code Extension):**

**File:** `cline_mcp_settings.json`

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

</details>

<details>
<summary><b>6️⃣ Other MCP Clients</b></summary>

Most MCP clients support this standard format:

```json
{
  "command": "npx",
  "args": ["timetree-mcp"],
  "env": {
    "TIMETREE_EMAIL": "your-email@example.com",
    "TIMETREE_PASSWORD": "your-password"
  }
}
```

</details>

### Usage

📖 **See [COMMANDS.md](COMMANDS.md) for detailed usage examples and workflows**

Quick examples:

#### List all calendars

```
List my TimeTree calendars
```

**Response:**
```json
{
  "calendars": [
    {
      "id": "123456",
      "name": "Personal",
      "alias_code": "abc123",
      "is_active": true,
      "users": [
        {
          "name": "John",
          "role": "owner"
        }
      ]
    },
    {
      "id": "789012",
      "name": "Work",
      "alias_code": "def456",
      "is_active": true,
      "users": [
        {
          "name": "John",
          "role": "owner"
        },
        {
          "name": "Sarah",
          "role": "member"
        }
      ]
    }
  ],
  "total": 2
}
```

#### Get events from a calendar

```
Show me all events from my Personal calendar (ID: 123456)
```

**Response:**
```json
{
  "calendar_id": "123456",
  "events": [
    {
      "uuid": "evt-abc123",
      "title": "Team Meeting",
      "start_at": "2026-02-20T14:00:00Z",
      "end_at": "2026-02-20T15:00:00Z",
      "all_day": false,
      "location": "Conference Room A",
      "note": "Discuss Q1 goals",
      "url": null,
      "category": "meeting",
      "has_alerts": true,
      "has_recurrence": false
    }
  ],
  "total": 1
}
```

### MCP Tools

#### `list_calendars`

List all active TimeTree calendars for the authenticated user with participating users.

**Input**: None

**Output**:
- `calendars`: Array of calendar objects
  - `id`: Calendar ID (string)
  - `name`: Calendar name
  - `alias_code`: Short code for sharing
  - `is_active`: Always true (inactive calendars are filtered out)
  - `users`: Array of active users in this calendar
    - `name`: User's display name
    - `role`: User's role ("owner" or "member")
- `total`: Number of calendars

#### `get_events`

Get all events from a specific calendar with automatic pagination.

**Input**:
- `calendar_id` (string, required): The calendar ID
- `since` (number, optional): Unix timestamp in milliseconds. Fetches events modified after this time. Defaults to 0 (all events).

**Output**:
- `calendar_id`: The requested calendar ID
- `events`: Array of event objects
  - `uuid`: Event unique ID
  - `title`: Event title
  - `start_at`: Start time (ISO 8601)
  - `end_at`: End time (ISO 8601)
  - `all_day`: Boolean indicating all-day event
  - `location`: Location name (or null)
  - `location_lat`: Latitude (or null)
  - `location_lon`: Longitude (or null)
  - `note`: Event notes (or null)
  - `url`: Related URL (or null)
  - `category`: Event category
  - `type`: Event type
  - `created_at`: Creation timestamp
  - `updated_at`: Last update timestamp
  - `has_alerts`: Boolean indicating if alerts are set
  - `has_recurrence`: Boolean indicating if event repeats
- `total`: Total number of events
- `since`: The timestamp used for filtering

### Development

```bash
# Build the project
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev
```

### How It Works

This server uses reverse-engineered TimeTree internal APIs:

1. **Authentication**: Uses the web app's sign-in endpoint
2. **Calendars**: Fetches from `/api/v1/calendars`
3. **Events**: Uses the `/api/v1/calendar/{id}/events/sync` endpoint with automatic pagination

### Limitations

- **Read-only**: Currently only supports reading calendars and events
- **Unofficial API**: May break if TimeTree changes their internal API
- **Rate Limited**: 10 requests/second (with automatic retry for 429 errors)
- **No Official Support**: TimeTree does not officially support this tool

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
