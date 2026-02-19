# Updating TimeTree MCP Server

Keep your TimeTree MCP server up-to-date with the latest features and fixes.

## Quick Update

```bash
cd ~/timetree-mcp  # or your installation path
git pull origin main
npm install
npm run build
```

Then restart your MCP client.

## Step-by-Step Guide

### Step 1: Navigate to installation directory

```bash
cd ~/timetree-mcp  # or your installation path
```

### Step 2: Pull latest changes

```bash
git pull origin main
```

### Step 3: Reinstall dependencies

```bash
npm install
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
rm -rf node_modules package-lock.json
npm install
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

3. Make sure `npm link` was run during initial installation:
   ```bash
   npm link
   ```

### If you installed via install.sh:

You can re-run the update steps above from the installation directory, or reinstall:

```bash
curl -fsSL https://raw.githubusercontent.com/ehs208/TimeTree-MCP/main/TimeTree-MCP-install.sh | bash
```

## What's New?

Check the [GitHub releases](https://github.com/ehs208/TimeTree-MCP/releases) page for changelogs and new features.

## Need Help?

- Check [README.md](../README.md) for general documentation
- See [MCP_CLIENTS.md](MCP_CLIENTS.md) for client-specific configuration
- Report issues at https://github.com/ehs208/TimeTree-MCP/issues
