#!/bin/bash
set -e

echo "🗑️  Uninstalling TimeTree MCP Server..."
echo ""

# Unlink from npm
echo "🔗 Unlinking global package..."
npm unlink -g timetree-mcp 2>/dev/null || true

# Remove installation directory
INSTALL_DIR="$HOME/.timetree-mcp"
if [ -d "$INSTALL_DIR" ]; then
  echo "📁 Removing installation directory..."
  rm -rf "$INSTALL_DIR"
fi

echo ""
echo "✅ Uninstallation complete!"
echo ""
echo "📝 Don't forget to remove the 'timetree' entry from:"
echo "   ~/Library/Application Support/Claude/claude_desktop_config.json"
echo ""
