/**
 * TimeTree MCP Server
 * Unofficial MCP server for accessing TimeTree calendar data.
 *
 * DISCLAIMER: This is an unofficial tool for PERSONAL USE ONLY.
 * Not affiliated with TimeTree, Inc. May break at any time.
 * Use at your own risk.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TimeTreeAuthManager } from './client/auth.js';
import { TimeTreeAPIClient } from './client/api.js';
import { registerTools } from './tools/index.js';
import { logger } from './utils/logger.js';

// Version
const VERSION = '0.1.0';

/**
 * Validate required environment variables
 */
function validateEnvironment(): { email: string; password: string } {
  const email = process.env.TIMETREE_EMAIL;
  const password = process.env.TIMETREE_PASSWORD;

  if (!email || !password) {
    console.error('❌ ERROR: Missing required environment variables');
    console.error('');
    console.error('TIMETREE_EMAIL and TIMETREE_PASSWORD must be set in your MCP server configuration.');
    console.error('');
    console.error('For Claude Desktop, add to ~/Library/Application Support/Claude/claude_desktop_config.json:');
    console.error(JSON.stringify({
      mcpServers: {
        timetree: {
          command: 'node',
          args: ['/path/to/TimeTree-MCP/dist/index.js'],
          env: {
            TIMETREE_EMAIL: 'your-email@example.com',
            TIMETREE_PASSWORD: 'your-password',
          },
        },
      },
    }, null, 2));
    console.error('');
    process.exit(1);
  }

  return { email, password };
}

/**
 * Main function to start the MCP server
 */
async function main() {
  logger.info('Starting TimeTree MCP Server', { version: VERSION });

  // Validate environment
  const { email, password } = validateEnvironment();

  // Initialize auth manager
  const authManager = new TimeTreeAuthManager({ email, password });

  // Initialize API client
  const apiClient = new TimeTreeAPIClient(authManager);

  // Create MCP server
  const server = new Server(
    {
      name: 'timetree-mcp',
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools
  const tools = registerTools(apiClient);

  // Handle list_tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handle call_tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info('Tool called', { name, args });

    const tool = tools.find((t) => t.name === name);

    if (!tool) {
      logger.error('Unknown tool', { name });
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      return await tool.handler(args);
    } catch (error) {
      logger.error('Tool execution failed', { name, error });
      throw error;
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('TimeTree MCP Server is running');
  logger.info('Available tools: list_calendars, get_events, create_event, update_event, delete_event');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down TimeTree MCP Server');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down TimeTree MCP Server');
    await server.close();
    process.exit(0);
  });
}

// Start the server
main().catch((error) => {
  logger.error('Fatal error', { error });
  console.error('Fatal error:', error);
  process.exit(1);
});
