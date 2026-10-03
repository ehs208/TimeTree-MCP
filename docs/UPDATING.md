# Updating TimeTree MCP Server

Keep your TimeTree MCP server up-to-date with the latest features and fixes.

How you update depends on how you installed:

- **Claude Desktop extension (.mcpb):** see [Claude Desktop extension](#claude-desktop-extension).
- **Git clone or installer script:** follow the steps below.

## Claude Desktop extension

1. Download the new `timetree-mcp-<version>.mcpb` from the [latest release](https://github.com/ehs208/TimeTree-MCP/releases/latest).
2. Open the file. Claude Desktop replaces the installed extension.
3. If Claude Desktop asks for your TimeTree email and password again, enter them.

## Quick Update

```bash
cd /path/to/TimeTree-MCP  # or your installation path
git pull origin main
npm ci
npm run build
```

Then restart your MCP client.

## Step-by-Step Guide

### Step 1: Navigate to installation directory

```bash
cd /path/to/TimeTree-MCP  # or your installation path
```

### Step 2: Pull latest changes

```bash
git pull origin main
```

### Step 3: Reinstall dependencies

```bash
npm ci
```

### Step 4: Rebuild the project

```bash
npm run build
```

### Step 5: Restart your MCP client

**Claude Desktop (macOS):**
```bash
# Press Cmd+Q to quit, then reopen Claude Desktop
```

**Claude Desktop (Windows):**
```
# Use Ctrl+Q or close the window, then reopen Claude Desktop
```

**Claude Code CLI:**
```bash
# Restart the CLI
exit
claude # start again
```

**Other MCP Clients:**
Refer to your client's documentation for restarting. Most require closing and reopening the application.

## Troubleshooting Updates

### If `npm run build` fails:

```bash
rm -rf node_modules
npm ci
npm run build
```

### If MCP server doesn't update after restart:

1. Verify the config path is correct:
   - Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
   - Claude Desktop: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
   - Check that the installation path matches where you cloned the repository

2. For Claude Desktop, check the Developer Console for errors:
   - Click the three dots (⋮) in Claude Desktop
   - Select "Developer" or check the console output

3. Make sure the linked command still exists:
   ```bash
   which timetree-mcp
   ```
   If it is missing, run:
   ```bash
   npm link
   ```

### If you installed via install.sh:

You can re-run the update steps above from the installation directory, or reinstall:

```bash
curl -fsSL https://raw.githubusercontent.com/ehs208/TimeTree-MCP/main/TimeTree-MCP-install.sh | bash
```

## Update Notifications

On startup, the server compares its version with the `version` in `package.json` on the `main` branch. If a newer version exists, the next tool response includes a short notice asking your AI assistant to tell you about the update and how to install it. Claude Desktop extension installs are pointed at the latest release download; git installs are told to pull and rebuild.

- The check is one HTTPS request to `raw.githubusercontent.com`. It sends no credentials or calendar data.
- If the request fails or times out (3 seconds), the server starts normally without a notice.
- The notice appears once per server start.
- To turn it off, set `TIMETREE_UPDATE_CHECK` to `false` in your MCP client's `env` configuration.

## What's New?

See [CHANGELOG.md](../CHANGELOG.md) for changes in each version. Each version is also published as a [GitHub release](https://github.com/ehs208/TimeTree-MCP/releases) with the Claude Desktop extension attached. Nothing is published to npm.

## Need Help?

- Check [README.md](../README.md) for general documentation
- See [MCP_CLIENTS.md](MCP_CLIENTS.md) for client-specific configuration
- Report issues at https://github.com/ehs208/TimeTree-MCP/issues
