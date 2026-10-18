# Feature Candidates

TimeTree web app features that this server does not expose as tools yet, with what was observed and why each one is waiting or not planned. Use it when deciding what to build next.

How these were observed: reading the web app's JavaScript bundle (its generated API client and the in-app AI assistant's tool definitions) and calling the endpoints from a signed-in browser session against a test calendar with made-up data, then deleting the test data. Paths are relative to `https://timetreeapp.com/api`. Behavior can change without notice.

## Waiting for a decision

These work, but each needs a decision before it becomes a tool.

| Feature | What it does | Observed request | Status | Open question |
|---|---|---|---|---|
| Comment and activity reactions | Add or remove an emoji reaction on a comment or an event activity | `POST /v1/calendars/{cid}/events/{eid}/activities/{activity_id}/reactions` with `{"content": "<name>"}`; `DELETE .../reactions/{reaction id_string}` | Verified | `content` is a name, not an emoji character: `white_check_mark`, `thumbsup`, `pray`, `laughing`, `heart`, `rage`. Other values return error `-403`. For comments, `activity_id` is the comment id; for other activities it is `activity_id` from `/v1/event_activities/latest?calendar_ids[]=`. Reactions are visible to other members, so the assistant would be reacting on the user's behalf. |
| Event like | Like or unlike an event | `POST` / `DELETE /v1/calendar/{cid}/event/{eid}/like` (no body) | Verified | Same social-signal concern as reactions; small value on its own. |
| Join or leave an event | Add or remove yourself as an attendee | `POST` / `DELETE /v1/calendar/{cid}/event/{eid}/attendees` (no body) | Verified | `update_event` with `attendees` already covers this; a separate tool is only a convenience. |
| Rename a calendar | Change a calendar's name (and badge image, and whether album photos keep their location) | `PUT /v1/calendar/{cid}` with `{"name": "..."}` | Verified (name) | Changes the name for every member of a shared calendar. `{"media_content_attach_location": null}` returned `-403`; badge needs an image upload first (see below). |
| Calendar album | List, upload, and delete photos in a calendar's album | List: `GET /v1/calendars/{cid}/media_contents`. Upload: `POST .../media_contents/presigned_urls` with `{"files": [{"filename", "taken_at", "location_lat", "location_lon", "request_id"}]}`, then a form POST of the file to the returned S3 `presigned_post`, then poll `GET .../media_contents/{uuid}/status` until `complete`. Delete: `DELETE .../media_contents` with `{"media_content_uuids": [...]}` | Verified end to end | Upload needs a local file path as tool input, and there is a monthly upload limit (error `-607`). Listing alone could ship first. |
| Image in a comment | Attach a photo to an event comment | `POST /v1/attachments` as multipart with `type=calendar`, `id={cid}`, `files[]=<image>` returns `{"attachments": [{"object_key", "filename", "width", "height"}]}`; then `POST /v1/calendar/{cid}/event/{eid}/activity` with `{"id", "attachment": {"images": <attachments>}, "silent": true}` | Verified | Same local-file input question as the album. |
| Batch create, update, delete | Several events in one call | No dedicated endpoint; the web app's assistant loops over the single-event endpoints | Not built | A wrong call affects many events at once; needs confirmation behavior. |
| Find free time | Free slots for one or more members in a range | No endpoint; computed from events | Not built | Needs a definition of working hours and of which events block time. |

## Not planned

| Feature | Observed request | Why not |
|---|---|---|
| Event file attachments | `POST /v1/events/files/presigned_urls` with `{"original_file_name", "media_upload"}`, upload to S3, then `file_uuids` on the event; `POST /v1/calendar/{cid}/event/{eid}/files` returns download links | TimeTree Premium only. Without a subscription the first request fails with `-462`, and the app shows "Only Premium users can add files". `create_event` already passes `file_uuids` through for files uploaded elsewhere. |
| Label suggestion | `GET /v1/calendars/{cid}/label_suggestion` (no parameters), returns `{"label_id": number or null}` | Pre-selects a label in the app's new-event form; no use to an assistant. |
| Invite link, accepting invites | `POST /v1/calendar/{cid}/invite/signature`, `POST /v1/calendar/invite/{signature}/accept` | Widens who can see a calendar. Leave it to the app. |
| Leaving a calendar, removing members | `DELETE /v1/calendar/{cid}/user`, `DELETE /v1/calendar/{cid}/user/{user_id}` | Hard to reverse and affects other people. |
| Account changes | `DELETE /v1/user`, `PUT /v1/user`, email and password endpoints | Out of scope and dangerous. |
| Read markers, calendar order, per-calendar preferences | `PUT .../read_markers`, `POST /v1/calendars/orders`, `PUT .../users/me/calendar_preferences` | App screen state; no value to an assistant. |
| In-app AI chat | `POST /v1/ai/chat/completions` | TimeTree's own assistant; the MCP client is the assistant here. |
| Public calendars | `/v2/public_calendars/...`, `/v2/managed_public_calendars/...` | A separate product area (published and subscribed calendars). Revisit only on request. |
