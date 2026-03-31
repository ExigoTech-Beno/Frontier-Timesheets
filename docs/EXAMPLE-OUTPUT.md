# Frontier Timesheets — Example Output

> A realistic demonstration of what a consultant sees when running the `timesheet-drafter` skill.
> 
> **Scenario:** Sarah (Exigo Tech consultant) asks Copilot to draft her timesheets for the week of 30 Mar – 3 Apr 2026.

---

## The Conversation

---

**Sarah:**
> Draft my timesheets for this week

---

**Copilot:**

I'll draft your timesheets for **Mon 30 Mar – Fri 3 Apr 2026**. Let me check what's already logged and pull your M365 activity.

🔍 Checking existing D365 entries for this week...

> *No entries logged yet for this period. ✅*

📅 Pulling your calendar, Teams messages, and emails for the week...

---

**Copilot (after querying M365 and D365):**

Here's what I found this week. I've matched your meetings and work to your active D365 projects — please review before I create anything.

---

### 📋 DRAFT TIMESHEETS — Week of 30 Mar – 3 Apr 2026

| Date | Hours | Project | Task | Type | Description |
|------|-------|---------|------|------|-------------|
| Mon 30 Mar | 2.0h | Frontier Digital Transformation | Discovery & Workshops | Work | Requirements workshop with client stakeholders |
| Mon 30 Mar | 1.5h | Frontier Digital Transformation | Stakeholder Engagement | Work | Follow-up call with Ben and client team re: scope |
| Mon 30 Mar | 0.5h | Exigo Tech — Internal | Operational Excellence | Work | Weekly ops standup |
| Tue 31 Mar | 3.0h | Frontier Digital Transformation | Solution Design | Work | Architecture session — D365 integration approach |
| Tue 31 Mar | 1.0h | Frontier Digital Transformation | Stakeholder Engagement | Work | Email correspondence re: change request |
| Tue 31 Mar | 1.0h | Exigo Tech — Internal | Practice Development | Work | Lunch & learn prep — AI tools session |
| Wed 1 Apr | 4.0h | Beta Platform Upgrade | Data Migration | Work | ETL mapping and testing in UAT environment |
| Wed 1 Apr | 2.0h | Beta Platform Upgrade | Project Management | Work | Sprint planning and backlog review |
| Thu 2 Apr | 3.5h | Frontier Digital Transformation | Solution Design | Work | Power Platform solution build |
| Thu 2 Apr | 2.0h | Beta Platform Upgrade | Data Migration | Work | UAT defect triage with client |
| Thu 2 Apr | 0.5h | Exigo Tech — Internal | Operational Excellence | Work | 1:1 with Alpesh — project status update |
| Fri 3 Apr | 4.0h | Frontier Digital Transformation | Documentation | Work | Technical design document — first draft |
| Fri 3 Apr | 2.0h | Beta Platform Upgrade | UAT Support | Work | Client UAT support session |

**Total: 27.0 hours across 5 days**

---

⚠️ **I couldn't confidently map these — can you help?**

| Date | Duration | Event | Options |
|------|----------|-------|---------|
| Tue 31 Mar | 1.0h | "Catch-up — James" | Frontier Digital Transformation / Stakeholder Engagement? Or Beta Platform Upgrade / Project Management? |
| Wed 1 Apr | 0.5h | Teams chat activity — "infra pricing thread" | Not sure which project this relates to |

---

**Does this look right?**  
Reply with:
- **"yes"** to create all entries as shown
- **"yes, and log the catch-up to Frontier Digital"** to confirm with a correction
- **"change row 3 to Beta Platform Upgrade"** to adjust a line
- **"skip Thursday"** to exclude a day

---

**Sarah:**
> yes, and log the catch-up to James against Frontier Digital / Stakeholder Engagement. Skip the infra pricing thread — that was internal.

---

**Copilot:**

Got it. Creating 14 entries in D365 now...

```
✅ Mon 30 Mar — 2.0h  Frontier Digital / Discovery & Workshops
✅ Mon 30 Mar — 1.5h  Frontier Digital / Stakeholder Engagement
✅ Mon 30 Mar — 0.5h  Exigo Internal / Operational Excellence
✅ Tue 31 Mar — 3.0h  Frontier Digital / Solution Design
✅ Tue 31 Mar — 1.0h  Frontier Digital / Stakeholder Engagement (email)
✅ Tue 31 Mar — 1.0h  Exigo Internal / Practice Development
✅ Tue 31 Mar — 1.0h  Frontier Digital / Stakeholder Engagement (catch-up James)
✅ Wed 1 Apr  — 4.0h  Beta Platform / Data Migration
✅ Wed 1 Apr  — 2.0h  Beta Platform / Project Management
✅ Thu 2 Apr  — 3.5h  Frontier Digital / Solution Design
✅ Thu 2 Apr  — 2.0h  Beta Platform / Data Migration
✅ Thu 2 Apr  — 0.5h  Exigo Internal / Operational Excellence
✅ Fri 3 Apr  — 4.0h  Frontier Digital / Documentation
✅ Fri 3 Apr  — 2.0h  Beta Platform / UAT Support
```

**🎉 Done! 14 entries created — 27.5h total logged for the week of 30 Mar – 3 Apr.**

All entries are in **Draft** status in D365. Your Project Manager can now review and approve them.

---

## What this looks like in D365

After the above, the consultant's D365 timesheet grid shows:

```
Week of 30 Mar 2026

PROJECT                          | MON  | TUE  | WED  | THU  | FRI  | TOTAL
---------------------------------|------|------|------|------|------|------
Frontier Digital Transformation  | 3.5h | 5.0h |  -   | 3.5h | 4.0h | 16.0h
Beta Platform Upgrade            |  -   |  -   | 6.0h | 2.0h | 2.0h | 10.0h
Exigo Tech — Internal            | 0.5h | 1.0h |  -   | 0.5h |  -   |  2.0h
---------------------------------|------|------|------|------|------|------
TOTAL                            | 4.0h | 6.0h | 6.0h | 6.0h | 6.0h | 28.0h
```

---

## Key Points for Alpesh

1. **The consultant never opened D365** — all entries were created via Copilot CLI
2. **The AI showed its work** — a full draft table was presented for review before anything was written
3. **Corrections are natural language** — no form fields, no lookups, no GUIDs
4. **Ambiguous items are flagged** — Copilot doesn't guess silently; it asks
5. **Total time: ~60 seconds** for a full week of timesheets vs. 10–15 minutes manually

---

## Variants

**Quick single-day entry:**
```
You: Log today — 3 hours on Frontier Digital discovery, 2 hours on Beta Platform UAT support
```

**Checking what's already logged:**
```
You: What have I logged this week?
```

**Fixing a mistake:**
```
You: Delete today's entry for Beta Platform — it should be Frontier Digital
```
