# D365 Project Operations — Time Entry Field Reference

## Entity: `msdyn_timeentry`

| Field | Internal Name | Type | Notes |
|-------|--------------|------|-------|
| Date | `msdyn_date` | Date | ISO 8601 date (YYYY-MM-DD) |
| Duration | `msdyn_duration` | Integer | **Minutes** (480 = 8h, 60 = 1h) |
| Type | `msdyn_type` | OptionSet | See type values below |
| Project | `msdyn_project` | Lookup → msdyn_project | Use `@odata.bind` |
| Project Task | `msdyn_projecttask` | Lookup → msdyn_projecttask | Use `@odata.bind` |
| Role | `msdyn_resourcecategory` | Lookup → msdyn_resourcecategory | Optional |
| Description | `msdyn_description` / `exg_description` | String | Both set when description provided |
| Entry Status | `msdyn_entrystatus` | OptionSet | Read-only after submission |
| Estimated Hours | `exg_estimatedhours` | Decimal | Read-only computed |
| Logged Hours | `exg_loggedhours` | Decimal | Read-only computed |
| Remaining Hours | `exg_remaininghours` | Decimal | Read-only computed |

## Standard Time Entry Type Values

Use `d365_get_time_entry_types` to fetch live values from your org. Common Project Operations defaults:

| Label | Value |
|-------|-------|
| Work | 192350000 |
| Absence | 192350001 |
| Vacation | 192350002 |
| Overtime | 192350003 |
| On Leave | 192350004 |
| Holiday | 192350005 |

> ⚠️ Values may differ per org. Always use `d365_get_time_entry_types` to confirm.

## Dataverse Web API Base

```
{DATAVERSE_URL}/api/data/v9.2/
```

## OData Bind Pattern for Lookups

```json
{
  "msdyn_project@odata.bind": "/msdyn_projects({projectId})",
  "msdyn_projecttask@odata.bind": "/msdyn_projecttasks({taskId})",
  "msdyn_resourcecategory@odata.bind": "/msdyn_resourcecategories({roleId})"
}
```
