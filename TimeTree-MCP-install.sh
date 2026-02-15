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
read -p "Enter your choice (1-7): " CHOICE
echo ""

case "${CHOICE}" in
  1)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "1️⃣  Claude Desktop (macOS)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "File: ~/Library/Application Support/Claude/claude_desktop_config.json"
    echo ""
    echo "Add this configuration:"
    echo ""
    cat << EOF
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
EOF
    echo ""
    echo "Then: Restart Claude Desktop (Cmd+Q and reopen)"
    ;;
  2)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "2️⃣  Claude Desktop (Windows)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "File: %APPDATA%\\Claude\\claude_desktop_config.json"
    echo ""
    echo "Add this configuration:"
    echo ""
    cat << EOF
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
EOF
    echo ""
    echo "Then: Restart Claude Desktop"
    ;;
  3)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "3️⃣  Claude Code (CLI)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Run this command:"
    echo ""
    cat << EOF
claude mcp add timetree \\
  --env TIMETREE_EMAIL=your-email@example.com \\
  --env TIMETREE_PASSWORD=your-password \\
  -- node "$DIST_PATH"
EOF
    echo ""
    echo "Then: Restart your terminal or run 'claude mcp refresh'"
    ;;
  4)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "4️⃣  Codex"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "File: ~/.codex/mcp_settings.json"
    echo ""
    echo "Add this configuration:"
    echo ""
    cat << EOF
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
EOF
    echo ""
    echo "Then: Restart Codex"
    ;;
  5)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "5️⃣  Google Antigravity"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "File (Windows): C:\\Users\\<USER_NAME>\\.gemini\\antigravity\\mcp_config.json"
    echo "File (macOS/Linux): ~/.gemini/antigravity/mcp_config.json"
    echo ""
    echo "Or via UI: Click ⋮ (top right) → MCP Servers → Manage MCP Servers → View raw config"
    echo ""
    cat << EOF
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
EOF
    echo ""
    echo "Then: Restart Antigravity"
    ;;
  6)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "6️⃣  VS Code-based Editors (Cline, Cursor, Windsurf, etc.)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Configuration varies by editor. Most use similar MCP config format."
    echo ""
    echo "Example for Cline (VS Code Extension):"
    echo "File: cline_mcp_settings.json"
    echo ""
    cat << EOF
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
EOF
    echo ""
    echo "Then: Reload your editor window"
    ;;
  7)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "7️⃣  Other MCP Clients (Generic Configuration)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Most MCP clients support this standard format:"
    echo ""
    cat << EOF
{
  "command": "node",
  "args": ["$DIST_PATH"],
  "env": {
    "TIMETREE_EMAIL": "your-email@example.com",
    "TIMETREE_PASSWORD": "your-password"
  }
}
EOF
    echo ""
    echo "Or as command line:"
    echo ""
    echo "node $DIST_PATH"
    echo ""
    echo "With environment variables:"
    echo ""
    echo "export TIMETREE_EMAIL=your-email@example.com"
    echo "export TIMETREE_PASSWORD=your-password"
    ;;
  *)
    echo "❌ Invalid choice. Please run the script again and select 1-7."
    exit 1
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANT:"
echo "   • Replace 'your-email@example.com' with your TimeTree email"
echo "   • Replace 'your-password' with your TimeTree password"
echo "   • Keep your credentials secure!"
echo ""
echo "🎉 Installation complete! Follow the configuration steps above."
echo ""
