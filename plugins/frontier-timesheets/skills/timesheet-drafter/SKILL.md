---
name: timesheet-drafter
description: >
  Draft and submit D365 Project Operations time entries based on your Microsoft 365 activity.
  Queries your calendar, Teams messages, and emails for a date range, maps meetings and work to
  D365 projects and tasks, proposes time entries for review, and creates them in D365 upon confirmation.
  Triggers: "draft my timesheets", "log my time", "create time entries", "fill in my timesheets",
  "what should I log today", "submit my timesheet", "log this week's time", "help me with timesheets",
  "what did I work on", "timesheet for this week", "log hours for"
---

# Timesheet Drafter

This skill automates D365 Project Operations timesheet creation by combining Microsoft 365 activity data with your available projects and tasks.

## What This Skill Does

1. Determines the date range to log (defaults to the current work week)
2. Queries Microsoft 365 calendar, Teams, and emails to understand what you worked on
3. Fetches available D365 projects and tasks
4. Proposes a timesheet table mapped to projects and tasks
5. On confirmation, creates all entries in D365 via the `frontier-timesheets` MCP tools

---

## Instructions

### Step 1: Determine Date Range

Ask the user which period to log if not specified. Default to the current Monday–Friday work week.

```
Example: "I'll draft your timesheets for Mon 30 Jun – Fri 4 Jul. Is that right?"
```

Dates should be in `YYYY-MM-DD` format for all API calls.

---

### Step 2: Check What's Already Logged

Before querying M365, check what has already been submitted to avoid duplicates:

```
frontier-timesheets-d365_get_time_entries (
  start_date: "<monday>",
  end_date: "<friday>"
)
```

Note any dates that are already fully covered (e.g., 8h logged). Skip those dates or flag them to the user.

---

### Step 3: Fetch Available Projects

Get the list of active projects:

```
frontier-timesheets-d365_list_projects ()
```

If the list is large, ask the user which projects are relevant for this period and filter using the `search` parameter.

---

### Step 4: Fetch Entry Types

Get the available time entry type values:

```
frontier-timesheets-d365_get_time_entry_types ()
```

Note the value for "Work" (the most common type) for use in Step 8.

---

### Step 5: Query Microsoft 365 Calendar

Pull the user's calendar for the period:

```
workiq-ask_work_iq (
  question: "List all my calendar events from <start_date> to <end_date>. For each event include: subject, date, start time, end time, duration in minutes, attendees, whether I organised it, and any notes or meeting purpose."
)
```

For each meeting extract:
- Subject / topic
- Date (YYYY-MM-DD)
- Duration (minutes)
- Likely project association (infer from subject/attendees)

---

### Step 6: Query Teams and Emails for Additional Context

Supplement calendar data with Teams and email activity:

```
workiq-ask_work_iq (
  question: "What work did I do from <start_date> to <end_date> based on Teams messages and emails? Summarise by project or topic, with approximate time spent on each."
)
```

Use this to:
- Fill in time for days with no calendar events
- Identify ad-hoc work not in meetings
- Confirm project associations

---

### Step 7: Map Activity to Projects and Tasks

For each project identified in Steps 5–6, fetch its tasks:

```
frontier-timesheets-d365_list_project_tasks (
  project_id: "<project_id>"
)
```

Map each calendar event or work block to the most appropriate project and task. If a meeting spans multiple projects, split the duration proportionally.

Present a draft timesheet table to the user for review:

```
📋 DRAFT TIMESHEETS — Week of <start_date>

Date       | Hours | Project              | Task                   | Type | Description
-----------|-------|----------------------|------------------------|------|-----------------------------
2025-06-30 | 2.0h  | Alpha Transformation | Discovery Workshop     | Work | Ran requirements session
2025-06-30 | 1.5h  | Alpha Transformation | Stakeholder Engagement | Work | Follow-up emails with client
2025-07-01 | 4.0h  | Beta Platform Build  | Backend Development    | Work | API integration work
...

⚠️  I couldn't confidently map the following — please tell me which project/task to use:
• Tue 1 Jul, 1h: "Misc Sync" with Sarah and Tom
```

Ask the user to:
1. Confirm or adjust project/task mappings
2. Correct any durations
3. Assign any unmapped items
4. Confirm total hours look reasonable for each day

**Do not proceed to Step 8 until the user explicitly approves the draft.**

---

### Step 8: Create Time Entries

For each approved entry, call:

```
frontier-timesheets-d365_create_time_entry (
  date: "<YYYY-MM-DD>",
  duration_minutes: <int>,
  project_id: "<project_guid>",
  project_task_id: "<task_guid>",
  type_value: <type_int>,
  description: "<brief description>"
)
```

Process entries one at a time. After each creation, note the returned ID.

---

### Step 9: Report Results

Summarise what was created:

```
✅ Created 8 time entries for the week of 30 Jun–4 Jul:

Mon 30 Jun: 2h Alpha Transformation / Discovery Workshop
Mon 30 Jun: 1.5h Alpha Transformation / Stakeholder Engagement
Tue 1 Jul:  4h Beta Platform Build / Backend Development
...

Total: 37.5h logged.

❌ Failed to create:
• Wed 2 Jul — Beta Platform Build (error: task not found). Please check the task is active.
```

If any entries failed, suggest remediation steps.

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| Date range | No | Current Mon–Fri | The work week to log timesheets for |
| Projects filter | No | All active | Restrict to specific projects |

## Example Prompts

```
"Draft my timesheets for this week"
"Log my time for last week"
"Help me submit my timesheets for 30 Jun to 4 Jul"
"What should I log today?"
"Fill in my timesheets — I worked on Project Alpha all week"
```

---

## Required MCP Tools

| MCP Server | Tool | Purpose |
|---|---|---|
| workiq | `ask_work_iq` | Query M365 calendar, Teams, emails for activity |
| frontier-timesheets | `d365_list_projects` | Fetch active D365 projects |
| frontier-timesheets | `d365_list_project_tasks` | Fetch tasks per project |
| frontier-timesheets | `d365_get_time_entry_types` | Get valid type option values |
| frontier-timesheets | `d365_get_time_entries` | Check already-logged entries |
| frontier-timesheets | `d365_create_time_entry` | Create approved entries in D365 |

---

## Error Handling

### Authentication Errors
- **Symptom**: `d365_*` tools fail with 401 or a login prompt appears in the terminal.
- **Resolution**: The MCP server uses device code flow. Follow the printed URL and code in the terminal to authenticate. Tokens are cached for future sessions.

### Project/Task Not Found
- **Symptom**: `d365_create_time_entry` fails with a 404 or reference error.
- **Resolution**: Re-run `d365_list_projects` and `d365_list_project_tasks` to confirm the correct GUIDs. The project or task may be inactive.

### Missing WorkIQ Data
- **Symptom**: `ask_work_iq` returns no calendar or Teams data.
- **Resolution**: Ensure the `workiq` plugin is installed and authenticated. Ask the user to describe their work manually and proceed with manual mapping.

### Duplicate Entries
- **Symptom**: Entries already exist for the date range.
- **Resolution**: Always run `d365_get_time_entries` first (Step 2) to detect existing entries and skip covered dates.
