# TimeTree MCP Commands

Quick reference for using TimeTree MCP Server with Claude.

## Available Tools

| Tool | Description | Example Prompts |
|------|-------------|-----------------|
| **list_calendars** | List all active calendars with participating users | • "List my TimeTree calendars"<br>• "Show me all my calendars"<br>• "What calendars do I have?" |
| **get_events** | Get events from a specific calendar | • "Show events from calendar 123456"<br>• "Get my Personal calendar events"<br>• "What's on my schedule?" |

## Parameters

### list_calendars
- **Input**: None
- **Output**: Calendar list with users

### get_events
- **calendar_id** (required): Calendar ID from `list_calendars`
- **start_after** (optional): Unix timestamp - show events starting after this time
- **limit** (optional): Maximum number of events to return

## Common Usage Patterns

```
# Basic workflow
"List my calendars" → Get calendar IDs
"Show events from calendar 123456" → View events

# Find events with someone
"What do I have with Sarah?" → Claude finds the calendar with Sarah and shows events

# Filter by date
"Show my events after February 1st from calendar 123456"

# Daily check
"What's on my schedule today?"
```
