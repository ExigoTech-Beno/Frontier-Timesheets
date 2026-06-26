import type { BrowserVisit } from './browser.js';
import { GitHubEvent } from './github-events.js';
import { CopilotSession } from './sessions.js';
import type { CalendarEvent, EmailSummary, TeamsChat, TodoTask, PlannerTask, OneNotePage, OneDriveFile } from './graph.js';
import { classifyUrl, classifyRepo, classifySession, CATEGORY_META, type ActivityCategory } from './classifier.js';

type Source = 'web' | 'github' | 'copilot' | 'calendar' | 'email' | 'teams' | 'todo' | 'planner' | 'onenote' | 'onedrive';

interface TimelineEntry {
  time:     string; // HH:MM
  date:     string; // YYYY-MM-DD
  project:  string;
  color:    string;
  category: ActivityCategory;
  detail:   string;
  source:   Source;
}

interface ProjectTally {
  name:     string;
  color:    string;
  category: ActivityCategory;
  visits:   number;
  weight:   number; // composite score
}

function hhmm(iso: string): string {
  return iso.substring(11, 16);
}

function yyyymmdd(iso: string): string {
  return iso.substring(0, 10);
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildReport(
  startDate:      string,
  endDate:        string,
  userName:       string,
  visits:         BrowserVisit[],
  ghEvents:       GitHubEvent[],
  sessions:       CopilotSession[],
  calEvents?:     CalendarEvent[],
  emails?:        EmailSummary[],
  teamsChats?:    TeamsChat[],
  todoTasks?:     TodoTask[],
  plannerTasks?:  PlannerTask[],
  oneNotePages?:  OneNotePage[],
  oneDriveFiles?: OneDriveFile[],
): string {
  // ── Build timeline ─────────────────────────────────────────────────────────
  const timeline: TimelineEntry[] = [];

  for (const v of visits) {
    const proj = classifyUrl(v.url, v.title);
    timeline.push({ time: hhmm(v.visitTime), date: yyyymmdd(v.visitTime), project: proj.name, color: proj.color, category: proj.category, detail: v.title || v.url, source: 'web' });
  }

  for (const e of ghEvents) {
    const proj = classifyRepo(e.repo);
    timeline.push({ time: hhmm(e.timestamp), date: yyyymmdd(e.timestamp), project: proj.name, color: proj.color, category: proj.category, detail: e.description, source: 'github' });
  }

  for (const s of sessions) {
    const proj = classifySession(s.project, s.title);
    const label = `${s.title} (${s.turns} turns)`;
    timeline.push({ time: hhmm(s.started), date: yyyymmdd(s.started), project: proj.name, color: proj.color, category: proj.category, detail: label, source: 'copilot' });
  }

  for (const ev of (calEvents ?? [])) {
    if (ev.isCancelled) continue;
    const mins = ev.durationMinutes < 60
      ? `${ev.durationMinutes}m`
      : `${Math.floor(ev.durationMinutes / 60)}h${ev.durationMinutes % 60 ? (ev.durationMinutes % 60) + 'm' : ''}`;
    const type = ev.isTeamsMeeting ? 'Teams Meeting' : ev.isAllDay ? 'All-day Event' : 'Meeting';
    const detail = `[${type}] ${ev.subject} (${mins}${ev.attendeeCount > 1 ? `, ${ev.attendeeCount} attendees` : ''})`;
    timeline.push({ time: ev.isAllDay ? '00:00' : hhmm(ev.start), date: yyyymmdd(ev.start), project: 'Meetings', color: '#7c3aed', category: 'microsoft', detail, source: 'calendar' });
  }

  for (const em of (emails ?? [])) {
    const detail = `[Email from ${em.from}] ${em.subject}`;
    timeline.push({ time: hhmm(em.receivedAt), date: yyyymmdd(em.receivedAt), project: 'Outlook', color: '#0078d4', category: 'microsoft', detail, source: 'email' });
  }

  for (const chat of (teamsChats ?? [])) {
    const detail = `[Teams${chat.chatType === 'group' ? ' Group' : ''}] ${chat.lastMessageFrom}: ${chat.lastMessage.substring(0, 80)}`;
    timeline.push({ time: hhmm(chat.lastMessageAt), date: yyyymmdd(chat.lastMessageAt), project: 'Microsoft Teams', color: '#6264a7', category: 'microsoft', detail, source: 'teams' });
  }

  for (const task of (todoTasks ?? [])) {
    const ts     = task.completedDateTime ?? task.createdDateTime;
    if (!ts) continue;
    const status = task.status === 'completed' ? '✅' : task.status === 'inProgress' ? '🔄' : '⏳';
    const detail = `${status} [To Do · ${task.listName}] ${task.title}`;
    timeline.push({ time: hhmm(ts), date: yyyymmdd(ts), project: task.listName || 'To Do', color: '#2563eb', category: 'project', detail, source: 'todo' });
  }

  for (const task of (plannerTasks ?? [])) {
    const ts = task.completedDateTime ?? task.dueDateTime ?? task.startDateTime;
    if (!ts) continue;
    const pct    = task.percentComplete === 100 ? '✅' : `${task.percentComplete}%`;
    const detail = `[Planner ${pct}] ${task.title}`;
    timeline.push({ time: hhmm(ts), date: yyyymmdd(ts), project: 'Planner', color: '#0f766e', category: 'project', detail, source: 'planner' });
  }

  for (const page of (oneNotePages ?? [])) {
    const ts = page.lastModified;
    if (!ts) continue;
    const detail = `[OneNote] ${page.notebookName} › ${page.sectionName} › ${page.title}`;
    timeline.push({ time: hhmm(ts), date: yyyymmdd(ts), project: 'OneNote', color: '#7719aa', category: 'research', detail, source: 'onenote' });
  }

  for (const file of (oneDriveFiles ?? [])) {
    const ts = file.lastModified;
    if (!ts) continue;
    const detail = `[OneDrive ${file.fileType.toUpperCase()}] ${file.name}`;
    timeline.push({ time: hhmm(ts), date: yyyymmdd(ts), project: 'OneDrive', color: '#0078d4', category: 'microsoft', detail, source: 'onedrive' });
  }

  timeline.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  // ── Tally by project ───────────────────────────────────────────────────────
  const tally = new Map<string, ProjectTally>();

  const bump = (name: string, color: string, category: ActivityCategory, weight: number) => {
    const t = tally.get(name) ?? { name, color, category, visits: 0, weight: 0 };
    t.visits += 1;
    t.weight += weight;
    tally.set(name, t);
  };

  for (const v of visits)   { const p = classifyUrl(v.url, v.title); bump(p.name, p.color, p.category, 1); }
  for (const e of ghEvents) { const p = classifyRepo(e.repo);         bump(p.name, p.color, p.category, 5); }
  for (const s of sessions) { const p = classifySession(s.project, s.title); bump(p.name, p.color, p.category, 10 + s.turns); }
  for (const ev of (calEvents ?? [])) { if (!ev.isCancelled) bump('Meetings', '#7c3aed', 'microsoft', Math.max(1, Math.round(ev.durationMinutes / 15))); }
  for (const _em of (emails ?? []))   { bump('Outlook', '#0078d4', 'microsoft', 2); }
  for (const _ch of (teamsChats ?? [])) { bump('Microsoft Teams', '#6264a7', 'microsoft', 3); }
  for (const t of (todoTasks ?? []))  { if (t.status === 'completed') bump(t.listName || 'To Do', '#2563eb', 'project', 8); }
  for (const t of (plannerTasks ?? [])) { bump('Planner', '#0f766e', 'project', t.percentComplete === 100 ? 8 : 3); }
  for (const _p of (oneNotePages ?? [])) { bump('OneNote', '#7719aa', 'research', 4); }
  for (const _f of (oneDriveFiles ?? [])) { bump('OneDrive', '#0078d4', 'microsoft', 2); }

  const ranked = [...tally.values()].sort((a, b) => b.weight - a.weight);
  const totalWeight = ranked.reduce((s, r) => s + r.weight, 0) || 1;
  const totalVisits = ranked.reduce((s, r) => s + r.visits, 0);

  // ── Category tally ────────────────────────────────────────────────────────
  const catTally = new Map<ActivityCategory, number>();
  for (const r of ranked) {
    catTally.set(r.category, (catTally.get(r.category) ?? 0) + r.weight);
  }
  const totalCatWeight = [...catTally.values()].reduce((s, w) => s + w, 0) || 1;
  const catRanked = [...catTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, weight]) => ({
      cat,
      weight,
      pct: Math.round((weight / totalCatWeight) * 100),
      ...CATEGORY_META[cat],
    }));

  // Group timeline by date
  const byDate = new Map<string, TimelineEntry[]>();
  for (const e of timeline) {
    (byDate.get(e.date) ?? (byDate.set(e.date, []), byDate.get(e.date)!)).push(e);
  }

  const dateRange = startDate === endDate ? startDate : `${startDate} – ${endDate}`;
  const sourceParts = ['Browser History', 'GitHub', 'Copilot CLI Sessions'];
  if ((calEvents?.length ?? 0) > 0)     sourceParts.push('Outlook Calendar');
  if ((emails?.length ?? 0) > 0)        sourceParts.push('Outlook Mail');
  if ((teamsChats?.length ?? 0) > 0)    sourceParts.push('Teams');
  if ((todoTasks?.length ?? 0) > 0)     sourceParts.push('To Do');
  if ((plannerTasks?.length ?? 0) > 0)  sourceParts.push('Planner');
  if ((oneNotePages?.length ?? 0) > 0)  sourceParts.push('OneNote');
  if ((oneDriveFiles?.length ?? 0) > 0) sourceParts.push('OneDrive');
  const sourceLabel = sourceParts.join(' · ');

  // ── Render HTML ────────────────────────────────────────────────────────────
  const categoryRows = catRanked.map(r => `
    <div class="stat-row">
      <span class="cat-icon">${r.icon}</span>
      <div class="stat-name">${escHtml(r.label)}</div>
      <div class="stat-bar-wrap"><div class="stat-bar" style="width:${r.pct}%;background:${r.color}"></div></div>
      <div class="stat-count">${r.pct}%</div>
    </div>`).join('');

  const projectWeightRows = ranked.map(r => {
    const pct = Math.round((r.weight / totalWeight) * 100);
    const meta = CATEGORY_META[r.category];
    return `<div class="stat-row">
      <div class="dot" style="background:${r.color}"></div>
      <div class="stat-name">${escHtml(r.name)} <span class="cat-tag" style="background:${meta.color}20;color:${meta.color}">${meta.icon} ${meta.label}</span></div>
      <div class="stat-bar-wrap"><div class="stat-bar" style="width:${pct}%;background:${r.color}"></div></div>
      <div class="stat-count">${pct}%</div>
    </div>`;
  }).join('');

  const visitRows = [...tally.values()]
    .filter(r => r.visits > 0 && r.name !== 'GitHub')
    .sort((a, b) => b.visits - a.visits)
    .map(r => {
      const pct  = Math.round((r.visits / (totalVisits || 1)) * 100);
      const meta = CATEGORY_META[r.category];
      return `<div class="stat-row">
        <div class="dot" style="background:${r.color}"></div>
        <div class="stat-name">${escHtml(r.name)} <span class="cat-tag" style="background:${meta.color}20;color:${meta.color}">${meta.icon}</span></div>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${pct}%;background:${r.color}"></div></div>
        <div class="stat-count">${r.visits}</div>
      </div>`;
    }).join('');

  const dayBlocks = [...byDate.entries()].map(([date, entries]) => {
    const rows = entries.map(e => {
      const badge = e.source === 'web'      ? '🌐 web'
                  : e.source === 'github'   ? '💻 github'
                  : e.source === 'calendar' ? '📅 calendar'
                  : e.source === 'email'    ? '✉️ email'
                  : e.source === 'teams'    ? '💬 teams'
                  : e.source === 'todo'     ? '✅ to do'
                  : e.source === 'planner'  ? '📋 planner'
                  : e.source === 'onenote'  ? '📓 onenote'
                  : e.source === 'onedrive' ? '📁 onedrive'
                  : '🤖 copilot';
      const catMeta = CATEGORY_META[e.category];
      return `<div class="event">
          <span class="event-time">${e.time}</span>
          <span class="event-project" style="color:${e.color}">${escHtml(e.project)}</span>
          <span class="event-cat" style="background:${catMeta.color}20;color:${catMeta.color}">${catMeta.icon}</span>
          <span class="event-detail">${escHtml(e.detail)}</span>
          <span class="source-badge">${badge}</span>
        </div>`;
    }).join('');
    return `<div class="day-block">
      <div class="day-header">${dayLabel(date + 'T00:00:00')}</div>
      ${rows}
    </div>`;
  }).join('');

  const pills = [
    `<div class="pill" style="background:#1e293b">📅 ${byDate.size} Day${byDate.size !== 1 ? 's' : ''}</div>`,
    ghEvents.length                       ? `<div class="pill" style="background:#4c48e3">💻 ${ghEvents.length} GitHub Events</div>` : '',
    sessions.length                       ? `<div class="pill" style="background:#ec4899">🤖 ${sessions.length} Copilot Sessions</div>` : '',
    visits.length                         ? `<div class="pill" style="background:#0ea5e9">🌐 ${visits.length} Browser Visits</div>` : '',
    (calEvents?.length ?? 0) > 0          ? `<div class="pill" style="background:#7c3aed">📅 ${calEvents!.length} Calendar Events</div>` : '',
    (emails?.length ?? 0) > 0             ? `<div class="pill" style="background:#0078d4">✉️ ${emails!.length} Emails</div>` : '',
    (teamsChats?.length ?? 0) > 0         ? `<div class="pill" style="background:#6264a7">💬 ${teamsChats!.length} Teams Chats</div>` : '',
    (todoTasks?.length ?? 0) > 0          ? `<div class="pill" style="background:#2563eb">✅ ${todoTasks!.length} To Do Tasks</div>` : '',
    (plannerTasks?.length ?? 0) > 0       ? `<div class="pill" style="background:#0f766e">📋 ${plannerTasks!.length} Planner Tasks</div>` : '',
    (oneNotePages?.length ?? 0) > 0       ? `<div class="pill" style="background:#7719aa">📓 ${oneNotePages!.length} OneNote Pages</div>` : '',
    (oneDriveFiles?.length ?? 0) > 0      ? `<div class="pill" style="background:#0078d4">📁 ${oneDriveFiles!.length} OneDrive Files</div>` : '',
    ranked.length                         ? `<div class="pill" style="background:#10b981">📁 ${ranked.length} Activities</div>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(userName)} — Work Activity Report: ${escHtml(dateRange)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #1e293b; }
  .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 32px 40px; }
  .header h1 { font-size: 24px; font-weight: 700; }
  .header p { color: #94a3b8; margin-top: 4px; font-size: 14px; }
  .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-bottom: 32px; }
  .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .card h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin-bottom: 16px; }
  .stat-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom: none; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .cat-icon { font-size: 16px; flex-shrink: 0; }
  .stat-name { flex: 1; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .cat-tag { font-size: 10px; padding: 1px 6px; border-radius: 8px; font-weight: 600; white-space: nowrap; }
  .stat-bar-wrap { width: 120px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
  .stat-bar { height: 100%; border-radius: 3px; }
  .stat-count { font-size: 13px; color: #64748b; min-width: 40px; text-align: right; }
  .section-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; margin-top: 32px; }
  .day-block { margin-bottom: 32px; }
  .day-header { font-size: 15px; font-weight: 700; color: #475569; padding: 8px 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 12px; }
  .event { display: flex; gap: 10px; padding: 6px 8px; border-radius: 8px; font-size: 13px; margin-bottom: 3px; align-items: center; }
  .event:hover { background: #f8fafc; }
  .event-time { color: #94a3b8; font-size: 12px; min-width: 42px; }
  .event-project { font-weight: 600; min-width: 140px; font-size: 12px; }
  .event-cat { font-size: 14px; flex-shrink: 0; padding: 1px 5px; border-radius: 6px; }
  .event-detail { color: #475569; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .source-badge { font-size: 10px; padding: 1px 6px; border-radius: 10px; background: #f1f5f9; color: #64748b; margin-left: 4px; flex-shrink: 0; }
  .summary-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
  .pill { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; color: white; }
  @media(max-width:900px){ .grid { grid-template-columns: 1fr; } .grid-3 { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="header">
  <h1>📊 Work Activity Report</h1>
  <p>${escHtml(userName)} &nbsp;·&nbsp; ${escHtml(dateRange)} &nbsp;·&nbsp; Sources: ${sourceLabel}</p>
</div>
<div class="container">
<div class="summary-pills">${pills}</div>
<div class="grid-3">
  <div class="card">
    <h2>🗂 Time Category Breakdown</h2>
    ${categoryRows}
  </div>
  <div class="card">
    <h2>🏗 Activity by Project / Tool (weighted)</h2>
    ${projectWeightRows}
  </div>
  <div class="card">
    <h2>🌐 Browser Visits by Activity</h2>
    ${visitRows}
  </div>
</div>
<div class="section-title">📅 Full Timeline</div>
${dayBlocks}
</div>
</body>
</html>`;
}
