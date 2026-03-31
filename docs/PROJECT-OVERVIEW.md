# Frontier Timesheets — Project Overview

**Prepared for:** Alpesh, Operational Excellence Manager — Exigo Tech  
**Initiative:** AI-Assisted Timesheet Automation for D365 Project Operations  

---

## Executive Summary

Consultants at Exigo Tech currently log timesheets manually through the D365 Project Operations "Quick Create Time Entry" form. This is a repetitive, end-of-day (or end-of-week) task that suffers from:

- **Recall errors** — people forget what they worked on or how long it took
- **Incomplete entries** — timesheets submitted late or in bulk without detail
- **No connection to actual work** — entries are typed from memory, not from evidence

**Frontier Timesheets** solves this by connecting GitHub Copilot CLI to a consultant's Microsoft 365 activity (calendar, Teams, emails) and their D365 project data — so Copilot can *draft* timesheets for them, based on what they actually did, ready for a single confirmation before submitting.

---

## The Problem

```
End of week. Consultant opens D365.
Stares at blank Quick Create form.
Tries to remember what happened Monday.
Guesses. Types. Submits.
Project data is inaccurate.
```

This is the current state. The form requires:
- **Date**, **Duration**, **Project** (lookup), **Task** (lookup), **Type**, **Role**, **Description**

Every field must be entered manually, for every entry, for every day. A typical consultant logs 5–10 entries per week.

---

## The Solution

Frontier Timesheets is a **GitHub Copilot CLI plugin** that combines:

| Source | What it provides |
|--------|-----------------|
| **Microsoft 365 Calendar** | Which meetings did I attend? How long? What project? |
| **Microsoft Teams** | What did I discuss? Which project channels? |
| **Emails** | What work conversations happened? |
| **D365 Project Operations** | What projects and tasks am I billable against? |

Copilot reads all of this, proposes a complete timesheet week, and — with a single "yes" from the consultant — creates every entry in D365 automatically.

---

## How It Works (Step by Step)

```
Consultant:  "Draft my timesheets for this week"
                         │
                         ▼
             Copilot checks D365 for existing entries
                         │
                         ▼
             Copilot reads M365 calendar (Mon–Fri)
             + Teams messages + Emails
                         │
                         ▼
             Copilot fetches active D365 projects & tasks
                         │
                         ▼
             Copilot maps each meeting/work block
             to the correct project and task
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  📋 DRAFT TIMESHEETS — Week of 30 Mar – 3 Apr 2026  │
│                                                     │
│  Mon  | 2.0h | Frontier Digital | Discovery         │
│  Mon  | 1.5h | Frontier Digital | Stakeholder Eng.  │
│  Tue  | 4.0h | Exigo Internal   | Ops Excellence    │
│  ...                                                │
│                                                     │
│  Does this look right? [yes / make changes]         │
└─────────────────────────────────────────────────────┘
                         │ Consultant says "yes"
                         ▼
             All entries created in D365 automatically
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   GitHub Copilot CLI                    │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐  │
│  │  workiq plugin   │    │  frontier-timesheets      │  │
│  │  (Microsoft)     │    │  plugin (Exigo Tech)      │  │
│  │                  │    │                           │  │
│  │  M365 Calendar   │    │  D365 Project Operations  │  │
│  │  Teams Messages  │    │  (Dataverse Web API)      │  │
│  │  Emails          │    │  – list projects/tasks    │  │
│  │  Documents       │    │  – get logged entries     │  │
│  └──────────────────┘    │  – create entries         │  │
│                          └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- `workiq` — Microsoft's published plugin; queries M365 via Microsoft Graph
- `frontier-timesheets` — Exigo Tech's custom plugin; talks to D365 via Dataverse Web API
- Authentication — Azure AD / MSAL (device code flow, same tenant as M365 + D365)

---

## Benefits

| Stakeholder | Benefit |
|-------------|---------|
| **Consultants** | Timesheets drafted in seconds, not minutes. Less end-of-week dread. |
| **Project Managers** | More accurate, more timely time data against tasks. |
| **Operations (Alpesh)** | Consistent timesheet compliance; richer project actuals. |
| **Finance** | Fewer corrections; billing data reflects real effort. |

---

## What Was Built

This repository (`Frontier-Timesheets`) contains a fully working, installable Copilot CLI plugin:

```
plugins/frontier-timesheets/
├── MCP Server (Node.js/TypeScript)   — talks to Dataverse Web API
│   ├── d365_list_projects            — find active projects
│   ├── d365_list_project_tasks       — find tasks per project
│   ├── d365_list_roles               — resource categories
│   ├── d365_get_time_entry_types     — Work / Absence / Vacation etc.
│   ├── d365_get_time_entries         — see what's already logged
│   ├── d365_create_time_entry        — create an entry in D365
│   └── d365_delete_time_entry        — remove a draft entry
│
└── Skill (timesheet-drafter)         — Copilot's step-by-step instructions
    ├── Query M365 activity
    ├── Map to D365 projects
    ├── Show draft for review
    └── Submit on approval
```

**Authentication:** Azure AD / MSAL device code flow. Each consultant authenticates once; tokens are cached locally. The app registration requires a single `Dynamics CRM / user_impersonation` delegated permission.

---

## Setup Requirements

| Item | Detail |
|------|--------|
| GitHub Copilot CLI | Licensed for each consultant using the tool |
| Node.js 18+ | On each consultant's machine |
| Azure App Registration | One per tenant — 30 min setup by IT admin |
| D365 Permissions | Existing D365 user access (no extra permissions needed) |
| workiq Plugin | `microsoft/work-iq` marketplace (Microsoft-provided) |

---

## Rollout Recommendation

1. **Pilot** — 2–3 consultants for one sprint (2 weeks)
2. **Validate** — compare D365 timesheet data quality before/after
3. **Refine** — add org-specific project name aliases or defaults if needed
4. **Expand** — roll out to all consultants; add to onboarding docs

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI maps meeting to wrong project | Copilot always shows a draft for human review before creating entries |
| Token/auth issues | MSAL caches tokens; re-auth is a simple device code flow |
| D365 API changes | Plugin uses stable Dataverse v9.2 OData API |
| Consultant forgets to run it | Can be prompted via a daily Teams reminder or calendar event |

---

## Next Steps

- [ ] IT Admin creates Azure App Registration (`D365_CLIENT_ID`)
- [ ] Push repo to GitHub (`github.com/exigotech/frontier-timesheets` or similar)
- [ ] Pilot with 2–3 willing consultants
- [ ] Gather feedback and iterate on project/task mapping quality

---

*Built with GitHub Copilot CLI + Microsoft work-iq plugin + Dataverse Web API*
