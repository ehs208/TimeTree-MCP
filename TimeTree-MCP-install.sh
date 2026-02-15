#!/bin/bash
set -e

echo "🚀 Installing TimeTree MCP Server..."
echo ""

# Installation directory
INSTALL_DIR="$HOME/.timetree-mcp"

# Check if directory exists
if [ -d "$INSTALL_DIR" ]; then
  echo "📁 Existing installation found, updating..."
  cd "$INSTALL_DIR"
  git pull
else
  echo "📥 Cloning repository..."
  git clone https://github.com/ehs208/TimeTree-MCP.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent

# Build
echo "🔨 Building..."
npm run build --silent

# Link globally
echo "🔗 Linking globally..."
npm link

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
echo "4️⃣  Google Antigravity"
echo "5️⃣  VS Code-based Editors (Cline, etc.)"
echo "6️⃣  Other MCP Clients"
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
  Darwin*)
    DEFAULT=1
    CONFIG_PATH="~/Library/Application Support/Claude/claude_desktop_config.json"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    DEFAULT=2
    CONFIG_PATH="%APPDATA%\\Claude\\claude_desktop_config.json"
    ;;
  *)
    DEFAULT=3
    ;;
esac

echo "Detected OS: ${OS} (Default: Option ${DEFAULT})"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Claude Desktop (macOS)
cat << 'EOF'
1️⃣  Claude Desktop (macOS)

   File: ~/Library/Application Support/Claude/claude_desktop_config.json

   Add this configuration:

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

   Then: Restart Claude Desktop (Cmd+Q and reopen)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2️⃣  Claude Desktop (Windows)

   File: %APPDATA%\Claude\claude_desktop_config.json

   Add this configuration:

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

   Then: Restart Claude Desktop

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3️⃣  Claude Code (CLI)

   Run this command:

   claude mcp add timetree \
     --env TIMETREE_EMAIL=your-email@example.com \
     --env TIMETREE_PASSWORD=your-password \
     -- npx timetree-mcp

   Then: Restart your terminal or run 'claude mcp refresh'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4️⃣  Google Antigravity

   File (Windows): C:\Users\<USER_NAME>\.gemini\antigravity\mcp_config.json
   File (macOS/Linux): ~/.gemini/antigravity/mcp_config.json

   Or via UI: Click ⋮ (top right) → MCP Servers → Manage MCP Servers → View raw config

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

   Then: Restart Antigravity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5️⃣  VS Code-based Editors (Cline, Cursor, Windsurf, etc.)

   Configuration varies by editor. Most use similar MCP config format.

   Example for Cline (VS Code Extension):
   File: cline_mcp_settings.json

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

   Then: Reload your editor window

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6️⃣  Other MCP Clients (Generic Configuration)

   Most MCP clients support this standard format:

   {
     "command": "npx",
     "args": ["timetree-mcp"],
     "env": {
       "TIMETREE_EMAIL": "your-email@example.com",
       "TIMETREE_PASSWORD": "your-password"
     }
   }

   Or as command line:

   npx timetree-mcp

   With environment variables:

   export TIMETREE_EMAIL=your-email@example.com
   export TIMETREE_PASSWORD=your-password

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo ""
echo "⚠️  IMPORTANT:"
echo "   • Replace 'your-email@example.com' with your TimeTree email"
echo "   • Replace 'your-password' with your TimeTree password"
echo "   • Keep your credentials secure!"
echo ""
echo "🎉 Installation complete! Choose your client and follow the steps above."
echo ""
