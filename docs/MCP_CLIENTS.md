# MCP Client Configuration Guide

This guide provides detailed configuration instructions for all supported MCP clients.

## Quick Reference

All clients use the same basic configuration format:
```json
{
  "command": "node",
  "args": ["/absolute/path/to/TimeTree-MCP/dist/index.js"],
  "env": {
    "TIMETREE_EMAIL": "your-email@example.com",
    "TIMETREE_PASSWORD": "your-password"
  }
}
```

> Replace `/absolute/path/to/TimeTree-MCP` with your cloned repository path. If your GUI client cannot find `node`, use the absolute path from `command -v node` as `command`. `npm link` is optional convenience, not required for this configuration.

### Optional settings

| Variable | Default | Description |
|----------|---------|-------------|
| `TIMETREE_UPDATE_CHECK` | `true` | Set to `false` to skip the startup check for a newer version (see [UPDATING.md](UPDATING.md#update-notifications)) |

## Supported Clients

<details>
<summary><b>1️⃣ Claude Desktop (macOS)</b></summary>

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

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

```bash
claude mcp add timetree \
  --env TIMETREE_EMAIL=your@email.com \
  --env TIMETREE_PASSWORD=yourpass \
  -- node /absolute/path/to/TimeTree-MCP/dist/index.js
```

</details>

<details>
<summary><b>4️⃣ Codex (OpenAI)</b></summary>

**File:** `~/.codex/config.toml` (or `.codex/config.toml` for project-specific)

```toml
[mcp_servers.timetree]
command = "node"
args = ["/absolute/path/to/TimeTree-MCP/dist/index.js"]

[mcp_servers.timetree.env]
TIMETREE_EMAIL = "your-email@example.com"
TIMETREE_PASSWORD = "your-password"
```

**Then:** Restart Codex CLI or reload IDE extension

</details>

<details>
<summary><b>5️⃣ Google Antigravity</b></summary>

**File (Windows):** `C:\Users\<USER_NAME>\.gemini\antigravity\mcp_config.json`

**File (macOS/Linux):** `~/.gemini/antigravity/mcp_config.json`

**Or via UI:** Click ⋮ (top right) → MCP Servers → Manage MCP Servers → View raw config

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

</details>

<details>
<summary><b>6️⃣ VS Code-based Editors (Cline, Cursor, Windsurf, etc.)</b></summary>

Configuration varies by editor. Most use similar MCP config format.

**Example for Cline (VS Code Extension):**

**File:** `cline_mcp_settings.json`

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

**Then:** Reload your editor window

</details>

<details>
<summary><b>7️⃣ Other MCP Clients</b></summary>

Most MCP clients support this standard format:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/TimeTree-MCP/dist/index.js"],
  "env": {
    "TIMETREE_EMAIL": "your-email@example.com",
    "TIMETREE_PASSWORD": "your-password"
  }
}
```

</details>

## Security Note

⚠️ **Never commit your credentials to version control!**

- Store credentials only in MCP client config files
- These config files should be in your gitignore
- Consider using environment variables for added security
- Prefer `node /absolute/path/to/TimeTree-MCP/dist/index.js` to avoid PATH/npm-link issues. If you choose the optional `timetree-mcp` command and it is not found, run `npm link` again from your cloned `TimeTree-MCP` directory or switch back to the absolute node/dist path.

## Need Help?

- Check the [Troubleshooting](../README.md#troubleshooting) section of the README for common issues
- See [README.md](../README.md) for general documentation
- Report issues at https://github.com/ehs208/TimeTree-MCP/issues
