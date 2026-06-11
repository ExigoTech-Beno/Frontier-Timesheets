# frontier-timesheets

> Draft and submit D365 Project Operations time entries powered by your Microsoft 365 activity.

**Install:**
```bash
# From this repo root
copilot plugin install ./plugins/frontier-timesheets
```

**Prerequisite — build the MCP server first:**
```bash
cd plugins/frontier-timesheets
npm install
npm run build
cd ../..
```

**Required environment variables** (set before starting Copilot CLI):
```bash
export DATAVERSE_URL=https://yourorg.crm6.dynamics.com
export D365_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export D365_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```
Copy `.env.example` to `.env` for reference. See [Azure App Registration](#azure-app-registration) below.

---

## Skills

| Skill | Description |
|-------|-------------|
| **timesheet-drafter** | Queries your M365 calendar, Teams, and emails; maps activity to D365 projects and tasks; drafts a timesheet for review; creates entries in D365 on confirmation. |

## Example prompts

```
"Draft my timesheets for this week"
"Log my time for last week"
"What should I log today?"
"Help me submit timesheets for 30 Jun to 4 Jul"
```

---

## MCP Tools

### D365 Project Operations

| Tool | Description |
|------|-------------|
| `d365_list_projects` | List active projects (optional name search) |
| `d365_list_project_tasks` | List tasks for a project |
| `d365_list_roles` | List resource categories (roles) |
| `d365_get_time_entry_types` | Get available time entry type option values |
| `d365_get_time_entries` | Get logged entries for a date range |
| `d365_create_time_entry` | Create a new time entry in D365 |
| `d365_delete_time_entry` | Delete a draft time entry |

### Microsoft Graph (productivity intelligence)

| Tool | Description |
|------|-------------|
| `graph_get_activity_stats` | Hours spent in Email / Meeting / Focus / Chat / Call for the last week (Viva Insights) |
| `graph_get_recent_activities` | Recently used apps and documents from Windows Activity Timeline |
| `graph_get_used_documents` | Recently accessed SharePoint / OneDrive documents with timestamps |

---

## How It Works

1. **Copilot queries your M365 calendar** (via the `workiq` plugin) to see what meetings and work happened in the selected week.
2. **Copilot fetches your D365 projects and tasks** using the Dataverse tools.
3. **A draft timesheet table** is proposed — you review and correct any mappings.
4. **On your approval**, entries are created directly in D365 Project Operations.

---

## Azure App Registration

Create an app registration in [Entra ID](https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps):

1. **New registration** → any name (e.g. `Frontier Timesheets CLI`)
2. **Redirect URI** → `http://localhost` (Public client / native)
3. **API permissions** → Add the following Delegated permissions:
   - `Dynamics CRM` → `user_impersonation`
   - `Microsoft Graph` → `Analytics.Read` *(requires Viva Insights licence)*
   - `Microsoft Graph` → `Sites.Read.All`
   - `Microsoft Graph` → `UserActivity.ReadWrite.CreatedByApp`
4. **Authentication** → Enable "Allow public client flows"
5. Copy the **Application (client) ID** → `D365_CLIENT_ID`
6. Copy the **Directory (tenant) ID** → `D365_TENANT_ID`

> On first use, a device code authentication prompt will appear in the terminal. Tokens are cached at `~/.frontier-timesheets/token-cache.json`.

---

## Also requires

- Node.js 18+ (workiq is bundled via `npx @microsoft/workiq` — no separate install needed)
- A Microsoft 365 Copilot licence for the authenticated user (required by workiq)
