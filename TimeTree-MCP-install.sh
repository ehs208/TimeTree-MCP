#!/bin/bash
set -e

echo "🚀 Installing TimeTree MCP Server..."
echo ""

# Pre-flight checks
if ! command -v git &> /dev/null; then
  echo "❌ ERROR: git is not installed."
  echo "   Please install git first: https://git-scm.com/downloads"
  exit 1
fi

if ! command -v node &> /dev/null; then
  echo "❌ ERROR: Node.js is not installed."
  echo "   Please install Node.js 22 or later: https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "❌ ERROR: Node.js 22+ is required (found $(node -v))"
  echo "   Please upgrade: https://nodejs.org"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "❌ ERROR: npm is not installed."
  echo "   Please install Node.js which includes npm: https://nodejs.org"
  exit 1
fi

echo "✓ git $(git --version | cut -d' ' -f3)"
echo "✓ node $(node -v)"
echo "✓ npm $(npm -v)"
echo ""

# Check if TimeTree-MCP directory exists in current location
if [ -d "TimeTree-MCP" ]; then
  echo "📁 Existing installation found"
  echo "🔄 Updating..."
  cd TimeTree-MCP
  git pull
else
  echo "📥 Cloning repository..."
  git clone https://github.com/ehs208/TimeTree-MCP.git
  cd TimeTree-MCP
fi

# Set installation directory to current location
INSTALL_DIR="$(pwd)"
DIST_PATH="$INSTALL_DIR/dist/index.js"
NODE_BIN="$(command -v node)"

echo "📁 Installation directory: $INSTALL_DIR"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --silent

# Build
echo "🔨 Building..."
npm run build --silent

# Verify build output
if [ ! -f "$DIST_PATH" ]; then
  echo "❌ Build failed: $DIST_PATH not found"
  exit 1
fi

# Link globally as an optional convenience command.
echo "🔗 Linking globally with npm link (optional convenience)..."
if ! npm link 2>&1; then
  echo ""
  echo "⚠️  npm link failed. This is usually a permissions issue."
  echo "   Try one of:"
  echo "   • Run with sudo: sudo npm link"
  echo "   • Fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors"
  echo ""
  echo "   This installer prints absolute node/dist paths below, so MCP config still works without npm link."
  echo "   Optional manual fallback if needed:"
  echo "   \"command\": \"$NODE_BIN\","
  echo "   \"args\": [\"$DIST_PATH\"]"
  echo ""
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Next Steps: Configure your MCP client"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Choose your MCP client:"
echo ""
echo "Tip: for Claude Desktop on macOS or Windows, the one-click extension needs no config file:"
echo "     https://github.com/ehs208/TimeTree-MCP/releases/latest (download the .mcpb file and open it)"
echo ""
echo "1️⃣  Claude Desktop (macOS)"
echo "2️⃣  Claude Desktop (Windows)"
echo "3️⃣  Claude Code (CLI)"
echo "4️⃣  Codex"
echo "5️⃣  Google Antigravity"
echo "6️⃣  VS Code-based Editors (Cline, etc.)"
echo "7️⃣  Other MCP Clients"
echo ""

# Read choice from /dev/tty for piped execution compatibility
if [ -t 0 ]; then
  read -p "Enter your choice (1-7): " CHOICE
else
  read -p "Enter your choice (1-7): " CHOICE </dev/tty
fi

echo ""

case "${CHOICE}" in
  1)
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣  Claude Desktop (macOS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: ~/Library/Application Support/Claude/claude_desktop_config.json

{
  "mcpServers": {
    "timetree": {
      "command": "$NODE_BIN",
      "args": ["$DIST_PATH"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}

Then: Restart Claude Desktop (Cmd+Q and reopen)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    ;;
  2)
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2️⃣  Claude Desktop (Windows)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: %APPDATA%\\Claude\\claude_desktop_config.json

{
  "mcpServers": {
    "timetree": {
      "command": "$NODE_BIN",
      "args": ["$DIST_PATH"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}

Then: Restart Claude Desktop
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    ;;
  3)
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3️⃣  Claude Code (CLI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run this command:

claude mcp add timetree \\
  --env TIMETREE_EMAIL=your-email@example.com \\
  --env TIMETREE_PASSWORD=your-password \\
  -- "$NODE_BIN" "$DIST_PATH"

Then: Restart your terminal or run 'claude mcp refresh'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    ;;
  4)
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4️⃣  Codex (OpenAI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: ~/.codex/config.toml

[mcp_servers.timetree]
command = "$NODE_BIN"
args = ["$DIST_PATH"]

[mcp_servers.timetree.env]
TIMETREE_EMAIL = "your-email@example.com"
TIMETREE_PASSWORD = "your-password"

Then: Restart Codex CLI or reload IDE extension
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    ;;
  5)
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5️⃣  Google Antigravity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File (Windows): C:\\Users\\<USER_NAME>\\.gemini\\antigravity\\mcp_config.json
File (macOS/Linux): ~/.gemini/antigravity/mcp_config.json

Or via UI: Click ⋮ (top right) → MCP Servers → Manage MCP Servers → View raw config

{
  "mcpServers": {
    "timetree": {
      "command": "$NODE_BIN",
      "args": ["$DIST_PATH"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}

Then: Restart Antigravity
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    ;;
  6)
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6️⃣  VS Code-based Editors (Cline, Cursor, Windsurf, etc.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configuration varies by editor. Most use similar MCP config format.

Example for Cline (VS Code Extension):
File: cline_mcp_settings.json

{
  "mcpServers": {
    "timetree": {
      "command": "$NODE_BIN",
      "args": ["$DIST_PATH"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}

Then: Reload your editor window
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    ;;
  7)
    cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7️⃣  Other MCP Clients (Generic Configuration)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Most MCP clients support this standard format:

{
  "command": "$NODE_BIN",
  "args": ["$DIST_PATH"],
  "env": {
    "TIMETREE_EMAIL": "your-email@example.com",
    "TIMETREE_PASSWORD": "your-password"
  }
}

With environment variables:

export TIMETREE_EMAIL=your-email@example.com
export TIMETREE_PASSWORD=your-password
"$NODE_BIN" "$DIST_PATH"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
    ;;
  *)
    echo "❌ Invalid choice. Please run the script again and select 1-7."
    exit 1
    ;;
esac

echo ""
echo "⚠️  IMPORTANT:"
echo "   • Replace 'your-email@example.com' with your TimeTree email"
echo "   • Replace 'your-password' with your TimeTree password"
echo "   • Keep your credentials secure!"
echo ""
echo "🎉 Installation complete! Follow the configuration steps above."
echo "⭐ If this saved you time, please star the repo:"
echo "   https://github.com/ehs208/TimeTree-MCP"
echo ""
