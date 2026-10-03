# TimeTree MCP Commands

Quick reference for using TimeTree MCP Server with AI assistants.

## Available Tools

| Tool | Description |
|------|-------------|
| **list_calendars** | List all active calendars with participating users |
| **get_events** | Get events from a calendar (with date filtering) |
| **get_updated_events** | Get recently modified or deleted events |
| **create_event** | Create a new event |
| **update_event** | Update an existing event |
| **delete_event** | Delete an event |
| **list_memos** | List memos (category=2 all-day events) |
| **create_memo** | Create a memo |
| **update_memo** | Update a memo |
| **delete_memo** | Delete a memo |
| **add_event_comment** | Add an event comment |
| **list_event_comments** | List event comments |
| **update_event_comment** | Update an event comment |
| **delete_event_comment** | Delete an event comment |
| **get_calendar_labels** | Get calendar labels |
| **update_calendar_labels** | Merge-update calendar label names/colors |
| **get_calendar_members** | Get calendar members |
| **get_calendar_virtual_members** | Get virtual members |
| **get_holidays** | Get public holidays and memorial days for a date range |
| **get_recent_activity** | See who recently created, changed, or deleted events and memos |

## Tool Details

### list_calendars

Returns all active calendars with IDs, names, and participant info.

| Parameter | Required | Description |
|-----------|----------|-------------|
| *(none)* | — | No input needed |

**Example prompts:**
- "List my TimeTree calendars"
- "Who's in my Work calendar?"

---

### get_events

Fetches all events from a calendar, sorted by start time, with optional client-side filtering.
Results include memos (`category=2`) unless `include_memos` is `false`.

When `start_before` is set, recurring events are expanded into each occurrence in the range, so "next week" queries include weekly meetings. Occurrences share the series `uuid` and are marked `is_recurring_occurrence: true`; updating or deleting that `uuid` changes the whole series. Supported rules: daily, weekly, monthly, and yearly with interval, count, until, weekdays (including "last Friday" in a month), month days, and months; deleted occurrences (EXDATE) are skipped. Other rules, such as "20th Monday of the year", are returned once, unexpanded. Each series is capped at 500 occurrences per call; capped series are listed in `truncated_series`.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `calendar_id` | Yes | Calendar ID (from `list_calendars`; string or number) |
| `start_after` | No | Unix timestamp (ms) — only return events starting after this time |
| `start_before` | No | Unix timestamp (ms) — only return events starting before this time |
| `query` | No | Case-insensitive keyword matched against title, note, and location |
| `label_id` | No | Only return events with this label (1-10) |
| `include_memos` | No | Include memos (default: true) |
| `expand_recurring` | No | Expand recurring events when `start_before` is set (default: true) |
| `limit` | No | Maximum number of events to return |

**Example prompts:**
- "Show events from my Personal calendar"
- "What's on my schedule after June 1st?"
- "Show me the next 5 events"
- "Find events about the dentist this month"

---

### get_updated_events

Returns only events modified after a timestamp, which suits "what changed?" questions better than `get_events`. The whole event feed is read and filtered by `updated_at`, since TimeTree's `since` parameter is a sync cursor rather than a date.
Deleted events are included with `deleted: true` and `deleted_at`, so a deletion is not mistaken for an edit.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `calendar_id` | Yes | Calendar ID |
| `updated_after` | Yes | Unix timestamp (ms) — only return events updated after this time |
| `limit` | No | Maximum number of events to return |

**Example prompts:**
- "What changed in my calendar this week?"
- "Show events updated in the last 24 hours"

---

### create_event

Creates a new event in a calendar.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `calendar_id` | Yes | Calendar ID |
| `title` | Yes | Event title |
| `start_at` | Yes | Start time (Unix timestamp in ms) |
| `end_at` | Yes | End time (Unix timestamp in ms) |
| `all_day` | No | All-day event (default: false) |
| `start_timezone` | No | e.g., "Asia/Seoul" (default: UTC) |
| `end_timezone` | No | e.g., "Asia/Seoul" (default: UTC) |
| `label_id` | No | Color 1-10 (see [Label Colors](#label-colors)) |
| `category` | No | Event category (default: 1, regular event; memos use `create_memo`) |
| `note` | No | Event description |
| `location` | No | Event location |
| `url` | No | Related URL |
| `attendees` | No | Calendar user IDs attending the event |
| `alerts` | No | Notification offsets in minutes, e.g. `[5, 30]` |
| `recurrences` | No | RRULE strings, e.g. `["RRULE:FREQ=DAILY;COUNT=2"]` |
| `file_uuids` | No | Attached file UUIDs if already uploaded |
| `checklist` | No | Array of `{title, checked}` items |
| `virtual_user_attendees` | No | Virtual member IDs/names |

**Example prompts:**
- "Create a meeting tomorrow at 2pm called 'Team Sync'"
- "Add an all-day event on March 15 called 'Holiday'"
- "Schedule a red-colored event for dentist appointment next Monday 10am-11am"
- "Create a 'Packing' event with a checklist: passport, charger, clothes"

---

### update_event

Updates an existing event. Only provide fields you want to change.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `calendar_id` | Yes | Calendar ID |
| `event_uuid` | Yes | Event UUID (from `get_events`) |
| `title` | No | New title |
| `start_at` | No | New start time |
| `start_timezone` | No | New start timezone |
| `end_at` | No | New end time |
| `end_timezone` | No | New end timezone |
| `all_day` | No | Change all-day status |
| `label_id` | No | New color |
| `category` | No | Override the event category |
| `note` | No | New description |
| `location` | No | New location |
| `url` | No | New URL; empty string removes it |
| `attendees` | No | Replace calendar user attendee IDs |
| `alerts` | No | Replace notification offsets in minutes; use `[]` to clear |
| `recurrences` | No | Replace RRULE strings |
| `file_uuids` | No | Replace attached file UUIDs |
| `checklist` | No | Replace checklist items (use `[]` to clear) |
| `virtual_user_attendees` | No | Replace virtual member attendees; use `[]` to clear |

**Example prompts:**
- "Move my dentist appointment to 3pm"
- "Change the Team Sync title to 'Sprint Planning'"
- "Add a checklist to tomorrow's event: buy cake, book venue"
- "Add a location to tomorrow's meeting"

---

### delete_event

Permanently deletes an event. Cannot be undone. Returns a "not found" error if the event does not exist or was already deleted.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `calendar_id` | Yes | Calendar ID |
| `event_uuid` | Yes | Event UUID (from `get_events`) |

**Example prompts:**
- "Delete the cancelled meeting on Friday"
- "Remove the 'Dentist' event"


---

### memo tools

Manage TimeTree memos, which are stored by TimeTree as `category=2` all-day events.

| Tool | Key parameters |
|------|----------------|
| `list_memos` | `calendar_id`, optional `updated_after`, `limit` |
| `create_memo` | `calendar_id`, `title`, optional `note`, `label_id`, `location`, `url`, `date`, `checklist`, `virtual_user_attendees` |
| `update_memo` | `calendar_id`, `memo_uuid`, fields to change |
| `delete_memo` | `calendar_id`, `memo_uuid` |

`update_memo` and `delete_memo` only work on memos. Passing a regular event UUID returns an error instead of converting or deleting the event; use `update_event` or `delete_event` for those.

**Example prompts:**
- "Create a memo called Shopping List with checklist milk and eggs"
- "List memos in my Work calendar"

---

### event comment tools

Manage comments using TimeTree event activity endpoints.

| Tool | Key parameters |
|------|----------------|
| `add_event_comment` | `calendar_id`, `event_uuid`, `content`, optional `silent` |
| `list_event_comments` | `calendar_id`, `event_uuid` |
| `update_event_comment` | `calendar_id`, `event_uuid`, `comment_id`, `content` |
| `delete_event_comment` | `calendar_id`, `event_uuid`, `comment_id` |

---

### calendar metadata tools

| Tool | Key parameters |
|------|----------------|
| `get_calendar_labels` | `calendar_id` |
| `update_calendar_labels` | `calendar_id`, `labels: [{id, name?, color?}]` (omitted labels are preserved) |
| `get_calendar_members` | `calendar_id`, optional `include_deactivated` |
| `get_calendar_virtual_members` | `calendar_id`, optional `include_deactivated` |

---

### get_holidays

Returns public holidays and memorial days that TimeTree shows on calendars. Read-only.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `country_iso` | Yes | ISO 3166-1 alpha-2 codes, e.g. `["KR"]` or `["KR", "JP"]` (max 5) |
| `start_date` | Yes | First date to include (`YYYY-MM-DD`, UTC) |
| `end_date` | Yes | Last date to include (`YYYY-MM-DD`, UTC); range up to 2 years |
| `days_off_only` | No | Exclude observances that are working days (default: false) |

**Example prompts:**
- "Which Korean public holidays are in October?"
- "Schedule the team offsite on a weekday that isn't a holiday in Korea or Japan"

---

### get_recent_activity

Lists recently changed events and memos, newest first, with who did what. TimeTree keeps only the last few activities per event. Read-only.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `calendar_id` | Yes | Calendar ID |
| `since` | No | Unix timestamp (ms) — only return activity after this time |
| `limit` | No | Maximum number of events to return (1-100, default 20) |

Each activity lists `actions` such as `created`, `title_updated`, `date_updated`, `label_updated`, `note_updated`, `location_updated`, `reminder_updated`, `url_updated`, `checklist_updated`, or `deleted`, plus the member who made the change.

**Example prompts:**
- "What changed in our family calendar this week?"
- "Who moved the dentist appointment?"

---

## Label Colors

Events can be color-coded with `label_id` 1-10:

| ID | Color | Hex |
|----|-------|-----|
| 1 | Emerald green | #2ecc87 |
| 2 | Modern cyan | #3dc2c8 |
| 3 | Deep sky blue | #47b2f7 |
| 4 | Pastel brown | #948078 |
| 5 | Midnight black | #212121 |
| 6 | Apple red | #e73b3b |
| 7 | French rose | #f35f8c |
| 8 | Coral pink | #fb7f77 |
| 9 | Bright orange | #fdc02d |
| 10 | Soft violet | #b38bdc |

## Common Workflows

```
# Daily check
"What's on my schedule today?"

# Weekly planning
"Show me all events for next week"

# Find events with someone
"What do I have with Sarah?" → AI finds the shared calendar and shows events

# Quick event creation
"Add lunch with Tom on Thursday at noon, mark it orange"

# Reschedule
"Move the Friday standup to Monday same time"

# Sync check
"What changed in my Work calendar since yesterday?"
```

## Notes

- **All-day events**: TimeTree uses inclusive end dates. A Feb 15-16 event sets `end_at` to Feb 16 00:00, not Feb 17.
- **Timezones**: Default is UTC. Specify timezone for accurate local times.
- **Write operations** (create/update/delete) require a CSRF token, which is managed automatically.
