# MCP Client Configuration Guide

This guide provides detailed configuration instructions for all supported MCP clients.

## Quick Reference

All clients use the same basic configuration format:
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

## Supported Clients

<details>
<summary><b>1️⃣ Claude Desktop (macOS)</b></summary>

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

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
  -- npx timetree-mcp
```

</details>

<details>
<summary><b>4️⃣ Codex (OpenAI)</b></summary>

**File:** `~/.codex/config.toml` (or `.codex/config.toml` for project-specific)

```toml
[[mcp.servers]]
name = "timetree"
command = "npx"
args = ["timetree-mcp"]

[mcp.servers.env]
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
<summary><b>6️⃣ VS Code-based Editors (Cline, Cursor, Windsurf, etc.)</b></summary>

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

**Then:** Reload your editor window

</details>

<details>
<summary><b>7️⃣ Other MCP Clients</b></summary>

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

## Security Note

⚠️ **Never commit your credentials to version control!**

- Store credentials only in MCP client config files
- These config files should be in your gitignore
- Consider using environment variables for added security

## Need Help?

- Check [TROUBLESHOOTING.md](../README.md#troubleshooting) for common issues
- See [README.md](../README.md) for general documentation
- Report issues at https://github.com/ehs208/TimeTree-MCP/issues
