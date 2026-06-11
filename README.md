# Frontier Timesheets — Plugin Marketplace

> Automate D365 Project Operations timesheets using GitHub Copilot CLI and your Microsoft 365 activity.

---

## Quick Start

```bash
# 1. Build the MCP server
cd plugins/frontier-timesheets
npm install && npm run build
cd ../..

# 2. Set environment variables
export DATAVERSE_URL=https://yourorg.crm6.dynamics.com
export D365_TENANT_ID=your-tenant-id
export D365_CLIENT_ID=your-client-id

# 3. Register this marketplace in Copilot CLI (one-time)
# Inside Copilot CLI:
/plugin marketplace add <your-github-org>/Frontier-Timesheets

# 4. Install the plugin
/plugin install frontier-timesheets@Frontier-Timesheets

# workiq (M365 calendar/email/Teams access) is bundled — no separate install needed
```

**Then just ask:**
```
You: Draft my timesheets for this week
You: Log my time for last Monday to Friday
You: What should I log today?
```

---

## How It Works

```
Your M365 Calendar ──┐
Your Teams Messages ──┤  workiq plugin  ──► Copilot drafts
Your Emails ──────────┘                     timesheet table
                                                    │
                                                    ▼ (you approve)
                                      frontier-timesheets MCP
                                                    │
                                                    ▼
                                    D365 Project Operations
                                    (msdyn_timeentries created)
```

---

## Plugins

| Plugin | Description |
|--------|-------------|
| [**frontier-timesheets**](./plugins/frontier-timesheets/) | Draft and submit D365 time entries from M365 activity |

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| Node.js 18+ | [nodejs.org](https://nodejs.org) |
| GitHub Copilot CLI | [Getting started](https://docs.github.com/en/copilot/how-tos/copilot-cli) |
| workiq plugin | `microsoft/work-iq` marketplace |
| Azure App Registration | See [plugin README](./plugins/frontier-timesheets/README.md#azure-app-registration) |

---

## Platform Support

Windows, macOS, Linux (wherever Node.js 18+ runs).
