#!/bin/bash
set -e

echo "🚀 Installing TimeTree MCP Server..."
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

echo "📁 Installation directory: $INSTALL_DIR"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

# Build
echo "🔨 Building..."
npm run build --silent

# Verify build output
if [ ! -f "$DIST_PATH" ]; then
  echo "❌ Build failed: $DIST_PATH not found"
  exit 1
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
      "command": "node",
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
      "command": "node",
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
  -- node "$DIST_PATH"

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

[[mcp.servers]]
name = "timetree"
command = "node"
args = ["$DIST_PATH"]

[mcp.servers.env]
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
      "command": "node",
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
      "command": "node",
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
  "command": "node",
  "args": ["$DIST_PATH"],
  "env": {
    "TIMETREE_EMAIL": "your-email@example.com",
    "TIMETREE_PASSWORD": "your-password"
  }
}

Or as command line:

node $DIST_PATH

With environment variables:

export TIMETREE_EMAIL=your-email@example.com
export TIMETREE_PASSWORD=your-password
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
echo ""
echo "To uninstall, simply delete the TimeTree-MCP directory:"
echo "   rm -rf $INSTALL_DIR"
echo ""
