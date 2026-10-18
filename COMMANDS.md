# TimeTree MCP Commands

Quick reference for using TimeTree MCP Server with AI assistants.

## Available Tools

| Tool | Description |
|------|-------------|
| **list_calendars** | List all active calendars with participating users |
| **create_calendar** | Create an empty calendar without inviting anyone |
| **get_current_user** | Show your user ID and name |
| **get_events** | Get events from a calendar (with date filtering) |
| **get_updated_events** | Get recently modified or deleted events |
| **create_event** | Create a new event |
| **update_event** | Update an existing event (every occurrence of a recurring event) |
| **delete_event** | Delete an event (every occurrence of a recurring event) |
| **update_event_occurrence** | Change one occurrence of a recurring event, or it and the ones after it |
| **delete_event_occurrence** | Delete one occurrence of a recurring event, or it and the ones after it |
| **copy_event** | Copy an event to another date or calendar |
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
| **create_virtual_member** | Add a virtual member (child, pet, car, ...) |
| **update_virtual_member** | Change a virtual member |
| **delete_virtual_member** | Remove a virtual member |
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

### update_event_occurrence and delete_event_occurrence

Change or delete one occurrence of a recurring event, or that occurrence and every later one, the way the TimeTree app does. Earlier occurrences are not touched. Find the occurrence with `get_events` (set `start_before` so recurring events are expanded) and pass its series `uuid` and `start_at`.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `calendar_id` | Yes | Calendar ID |
| `event_uuid` | Yes | Series UUID (every occurrence from `get_events` has it) |
| `occurrence_start_at` | Yes | The occurrence's `start_at` from `get_events` (ISO 8601), or Unix ms |
| `scope` | No | `this` (default) or `this_and_following` |
| fields to change | `update_event_occurrence` only | `title`, `start_at`, `end_at`, timezones, `label_id`, `note`, `location`, `url`, `attendees`, `alerts`, `checklist`, `virtual_user_attendees`; `recurrences` only with `this_and_following` |

What happens in TimeTree:

| Tool and scope | Result |
|----------------|--------|
| delete, `this` | The occurrence is excluded from the series (EXDATE). |
| delete, `this_and_following` | The series ends on the day of the previous occurrence. From the first occurrence, the whole series is deleted. |
| update, `this` | A separate event linked to the series (`parent_id`) replaces the occurrence. |
| update, `this_and_following` | The series ends before the occurrence and a new series (new `uuid`) starts there with the changes. From the first occurrence, the whole series is changed. Moving to another day (by `start_at` or `start_timezone`) when the rule repeats on set days (`BYDAY`, `BYMONTHDAY`, `BYMONTH`) needs a new `recurrences`; its remaining `COUNT` or `UNTIL` and deleted later occurrences carry over unless the new rule sets them. |

Moving an occurrence with `start_at` keeps its length unless `end_at` is given. If the second step of an update fails, the event created in the first step is removed, unless TimeTree applied the step anyway. When the outcome cannot be confirmed, or removing the event also fails, the error says so and names the event, so it can be checked with `get_events`. Rules this server cannot expand (for example `BYSETPOS`) are rejected; change those in the TimeTree app.

**Example prompts:**
- "Move only this week's standup to 11 am"
- "From next month, make the weekly review biweekly"
- "Cancel the yoga class on the 15th, but keep the rest"
- "Stop the daily standup after this Friday"

---

### copy_event

Copies an event to a new start time, optionally into another calendar, as the app's Copy action does. Title, note, location, URL, label, reminders, and checklist are kept. Recurrence is not copied. Attendees, virtual attendees, and files are kept only within the same calendar.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `calendar_id` | Yes | Calendar ID of the original |
| `event_uuid` | Yes | Event UUID of the original |
| `start_at` | Yes | Start of the copy (Unix ms) |
| `end_at` | No | End of the copy (default: same length as the original) |
| `title` | No | Title of the copy (default: the original title) |
| `target_calendar_id` | No | Calendar to copy into (default: the same calendar) |

**Example prompts:**
- "Copy last week's team dinner to next Friday"
- "Copy the dentist appointment into the Family calendar"

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

Comments are visible to everyone in the calendar. TimeTree lets only a comment's author edit or delete it. Get `comment_id` from `list_event_comments`.

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
| `create_virtual_member` | `calendar_id`, `name`, optional `type`, `one_word`, `birthday`, `shows_birthday` |
| `update_virtual_member` | `calendar_id`, `virtual_member_uuid`, fields to change |
| `delete_virtual_member` | `calendar_id`, `virtual_member_uuid` |
| `get_current_user` | *(none)* |

Virtual members are people or things without a TimeTree account, such as a child, pet, or car. `type` is one of `child`, `pet`, `car`, `grandfather`, `grandmother`, `other` (default). `birthday` is `YYYY-MM-DD`, and `update_virtual_member` with `birthday: null` removes it; `shows_birthday` needs a birthday. A calendar can have at most 10 virtual members.

`get_calendar_virtual_members` returns two identifiers: put `id` in an event's `virtual_user_attendees`, and use `uuid` as `virtual_member_uuid` to update or delete. Updating resends the member's current fields with the changes, because TimeTree clears the short description and birthday when they are left out.

`get_current_user` returns only your `user_id` and name. `user_id` matches `user_id` in `get_calendar_members`, event `attendees`, and comment authors.

**Example prompts:**
- "Add our dog Coco to the Family calendar as a pet"
- "Assign Saturday's vet visit to Coco"
- "Which of these events am I attending?"

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
- **Write operations** are visible to everyone who shares the calendar.
- **Structured output**: every tool declares an output schema and returns the same JSON as `structuredContent`, and declares MCP annotations (read-only, destructive, idempotent).

### Create a calendar

Call `create_calendar` with both `name` (1–20 characters) and an explicit `purpose`:

```json
{"name": "Project calendar", "purpose": "work"}
```

Supported purposes: `family`, `private`, `lover`, `work`, `friend`, `work_schedule`, `lesson`, `school_event`, `circle`, `hobby`, `other`.
Creation does not invite members. Requests use rate limiting and retry HTTP 429 rejections or rejected authentication through the shared client. Timeouts and server errors are not retried.
Invalid input returns field-level reasons without input values. Authentication errors return `Authentication failed`.
Persistent TimeTree session or CSRF rejections are reported as authentication failures after one sign-in recovery attempt.
After an uncertain creation failure (such as a timeout or an unexpected success response), check existing calendars before retrying. Response validation failures are not reported as invalid input. HTTP 5xx responses are never retried, even if their bodies contain authentication error codes.
