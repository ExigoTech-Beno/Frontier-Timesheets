# Skill: Work Activity Reporter

Generate a visual HTML work activity report for any date range by combining browser history,
GitHub events, and Copilot CLI session data — then map everything to named projects.

---

## When to use this skill

- "Generate my work report for this week"
- "What did I work on last Monday and Tuesday?"
- "Build an activity report for 19–20 May"
- "Show me a breakdown of my projects last week"

---

## Step 1: Confirm the date range

Ask the user which dates to cover if not provided. Default to the current week (Mon–today).

Format: `YYYY-MM-DD`

---

## Step 2: Ask for GitHub username (first time only)

If `GITHUB_USERNAME` env var is not set, ask the user for their GitHub handle (e.g. `ExigoTech-Beno`).

---

## Step 3: Generate the report

Call the report tool with the confirmed parameters:

```
frontier-timesheets-activity_build_report (
  start_date: "YYYY-MM-DD",
  end_date:   "YYYY-MM-DD",
  username:   "Ben Opit",
  github_username: "ExigoTech-Beno",
  output_path: "C:/Users/<username>/Desktop/work-report-YYYY-MM-DD.html"
)
```

Set `output_path` to a sensible desktop path so the user can open it immediately.
Use today's date in the filename.

---

## Step 4: Tell the user what was captured

After the tool returns, summarise:

- How many browser visits were found
- How many GitHub events were found  
- How many Copilot sessions were found
- Top 3 projects by activity weight
- Path to the saved HTML file

Example:

> ✅ Report saved to `C:/Users/BenOpit/Desktop/work-report-2026-05-19.html`
>
> **19–20 May 2026 — what was captured:**
> - 🌐 413 browser visits
> - 💻 16 GitHub events (BC SmartStart SoW, CCC FabricIQ)
> - 🤖 9 Copilot sessions
>
> **Top projects:** BC SmartStart SoW (28%) · Research/Other (21%) · AI Research (6%)
>
> Open the HTML file in your browser for the full timeline.

---

## Step 5: Offer to draft timesheets

Ask if the user wants to use this activity as the basis for drafting D365 timesheets:

> Want me to use this activity breakdown to draft your timesheets for the same period?

If yes, run the `timesheet-drafter` skill next.

---

## Tool reference

| Server | Tool | Purpose |
|--------|------|---------|
| frontier-timesheets | `browser_get_history` | Raw browser visits for a date range |
| frontier-timesheets | `github_get_events` | GitHub pushes, PRs, issues for a date range |
| frontier-timesheets | `activity_build_report` | Full HTML report combining all sources |
