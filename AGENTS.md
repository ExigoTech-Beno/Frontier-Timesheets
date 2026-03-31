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

| Tool | Purpose |
|------|---------|
| `d365_list_projects` | List active D365 projects |
| `d365_list_project_tasks` | List tasks for a project |
| `d365_list_roles` | List resource categories (roles) |
| `d365_get_time_entry_types` | Fetch option set values for msdyn_type |
| `d365_get_time_entries` | Get time entries for a date range |
| `d365_create_time_entry` | Create a new msdyn_timeentry record |
| `d365_delete_time_entry` | Delete a draft time entry |

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
