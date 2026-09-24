# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A GitHub Copilot CLI plugin + MCP server that automates D365 Project Operations timesheet creation. It connects GitHub Copilot to Microsoft 365 activity (calendar, Teams, emails, browser history, GitHub events) and creates time entries in Dynamics 365 via natural language.

## Commands

All commands run from `plugins/frontier-timesheets/`:

```bash
npm run build   # tsc — compile TypeScript to dist/
npm run dev     # ts-node src/index.ts — run directly without building
npm run start   # node dist/index.js — run compiled server
```

**After any `src/*.ts` change:** rebuild before testing — `npm run build`

**After any skill change:** reinstall the Copilot plugin:
```bash
copilot plugin uninstall frontier-timesheets
copilot plugin install ./plugins/frontier-timesheets
```

No test framework or linter is configured.

## Architecture

The plugin has two layers:

1. **MCP Server** (`src/index.ts`) — registers ~21 tools that Copilot CLI calls. Tools are grouped into three categories:
   - **D365 tools** (`d365_*`) — CRUD on Dataverse `msdyn_timeentry` records via OData v9.2
   - **Graph tools** (`graph_get_*`) — Microsoft Graph API (calendar, email, Teams, Viva Insights, OneDrive)
   - **Activity report tools** (`browser_*`, `github_*`, `activity_*`) — local browser SQLite history, GitHub REST API events, HTML report generation

2. **Skills** (`skills/`) — step-by-step markdown instructions that tell Copilot *how* to orchestrate the MCP tools into workflows. Skills are user-facing; MCP tools are the underlying capabilities.

### Key source files

| File | Role |
|------|------|
| `src/index.ts` | MCP server entry — all tool definitions and Zod schemas |
| `src/dataverse.ts` | Dataverse Web API client (OData queries, time entry CRUD) |
| `src/graph.ts` | Microsoft Graph client (11 endpoints across M365 services) |
| `src/classifier.ts` | Maps URLs/repos/keywords → project categories (40+ project definitions) |
| `src/report.ts` | Generates HTML activity report combining all data sources |
| `src/auth.ts` | MSAL device code flow with token cache at `~/.frontier-timesheets/token-cache.json` |
| `src/browser.ts` | Reads Edge/Chrome browser history from local SQLite |
| `src/github-events.ts` | GitHub REST API event fetcher |
| `src/sessions.ts` | Parses Copilot CLI session JSON files |

### Authentication

Uses MSAL `PublicClientApplication` with device code flow (delegated permissions only — no client secret). Tokens are cached at `~/.frontier-timesheets/token-cache.json`. Each unique `(tenantId, clientId)` pair gets its own singleton PCA instance. Re-auth happens automatically on expiry.

## Required Environment Variables

```
DATAVERSE_URL=https://yourorg.crm6.dynamics.com
D365_TENANT_ID=<azure-tenant-id>
D365_CLIENT_ID=<app-registration-client-id>
```

Optional (for activity reports):
```
GITHUB_USERNAME=<github-handle>
GITHUB_TOKEN=<PAT-for-private-repos>
REPORT_USER_NAME=<Display Name>
```

Copy `.env.example` to `.env` to get started.

## Plugin Registry

`server.json` is the marketplace manifest. `.github/plugin/marketplace.json` is the plugin registry entry. Keep skill descriptions under 1024 characters — Copilot CLI silently drops longer ones.

## Self-Maintenance

When adding new MCP tools or skills, also update `AGENTS.md` to keep it in sync.
