# Frontier Timesheets — AGENTS.md

This repository is a GitHub Copilot CLI plugin marketplace for automating D365 Project Operations timesheet creation.

## Repository Structure

```
Frontier-Timesheets/
├── .github/
│   └── plugin/
│       └── marketplace.json      # Plugin registry
├── plugins/
│   └── frontier-timesheets/      # The main plugin
│       ├── .mcp.json             # MCP server config (node ./dist/index.js)
│       ├── package.json          # npm package for MCP server
│       ├── tsconfig.json
│       ├── .env.example          # Required environment variables
│       ├── README.md
│       ├── src/
│       │   ├── index.ts          # MCP server entry — registers all tools
│       │   ├── auth.ts           # MSAL device code auth with token caching
│       │   ├── config.ts         # Env var config loader
│       │   └── dataverse.ts      # Dataverse Web API client
│       └── skills/
│           └── timesheet-drafter/
│               ├── SKILL.md      # Step-by-step skill instructions for Copilot
│               └── references/
│                   └── D365-TIME-ENTRY-FIELDS.md
├── server.json                   # Marketplace manifest
├── README.md
└── AGENTS.md                     # This file
```

## MCP Tools (frontier-timesheets server)

### D365 Project Operations
| Tool | Purpose |
|------|---------|
| `d365_list_projects` | List active D365 projects |
| `d365_list_project_tasks` | List tasks for a project |
| `d365_list_roles` | List resource categories (roles) |
| `d365_get_time_entry_types` | Fetch option set values for msdyn_type |
| `d365_get_time_entries` | Get time entries for a date range |
| `d365_create_time_entry` | Create a new msdyn_timeentry record |
| `d365_delete_time_entry` | Delete a draft time entry |

### Microsoft Graph (productivity intelligence)
| Tool | Purpose |
|------|---------|
| `graph_get_activity_stats` | Hours in Email/Meeting/Focus/Chat/Call — last week (Viva Insights, `Analytics.Read`) |
| `graph_get_recent_activities` | Windows Activity Timeline — recently used apps/docs (`UserActivity.ReadWrite.CreatedByApp`) |
| `graph_get_used_documents` | Recently accessed SharePoint/OneDrive documents (`Sites.Read.All`) |
| `graph_get_calendar_events` | Outlook Calendar events for a date range — subject, duration, Teams flag, attendees (`Calendars.Read`) |
| `graph_get_emails` | Received email summary for a date range — sender, subject, preview (`Mail.Read`) |
| `graph_get_teams_chats` | Teams chats active during a date range — topic, last message preview (`Chat.Read`) |

### Work Activity Report
| Tool | Purpose |
|------|---------|
| `browser_get_history` | Read Edge/Chrome browser history for a date range (reads local SQLite) |
| `github_get_events` | Fetch GitHub pushes, PRs, issues for a user over a date range |
| `activity_build_report` | Generate a full HTML work activity report combining all sources; set `include_graph=true` to also pull Outlook/Teams data |

**Env vars for activity report:**
| Variable | Description |
|----------|-------------|
| `GITHUB_USERNAME` | GitHub handle (e.g. `ExigoTech-Beno`) for fetching events |
| `GITHUB_TOKEN` | Optional PAT for private repo events |
| `REPORT_USER_NAME` | Display name in the report header (e.g. `Ben Opit`) |

**Graph permissions required for full report** (device-code consent on first run):
- `Analytics.Read` — Viva Insights activity stats
- `Sites.Read.All` — SharePoint/OneDrive used documents
- `UserActivity.ReadWrite.CreatedByApp` — Windows Activity Timeline
- `Calendars.Read` — Outlook calendar events
- `Mail.Read` — Outlook received emails
- `Chat.Read` — Teams chat threads

## Authentication

The MCP server uses MSAL `PublicClientApplication` with device code flow (delegated permissions).  
Token cache: `~/.frontier-timesheets/token-cache.json`  
Required scope: `{DATAVERSE_URL}/user_impersonation`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATAVERSE_URL` | Dataverse org URL, e.g. `https://yourorg.crm6.dynamics.com` |
| `D365_TENANT_ID` | Azure AD tenant ID |
| `D365_CLIENT_ID` | App registration client ID |

## Self-Maintenance Instructions

When making changes:
- Update this AGENTS.md to reflect new tools, skills, or structure changes
- After editing `src/*.ts`, rebuild: `cd plugins/frontier-timesheets && npm run build`
- After editing a skill, reinstall: `copilot plugin uninstall frontier-timesheets && copilot plugin install ./plugins/frontier-timesheets`
- Keep skill descriptions under 1024 characters (Copilot CLI silently drops longer ones)
