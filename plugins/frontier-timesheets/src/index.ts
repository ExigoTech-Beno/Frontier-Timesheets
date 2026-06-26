#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { DataverseClient } from './dataverse.js';
import { GraphClient } from './graph.js';
import { getBrowserHistory } from './browser.js';
import { getGitHubEvents } from './github-events.js';
import { getSessionsForRange } from './sessions.js';
import { buildReport } from './report.js';

const config = loadConfig();
const client = new DataverseClient(config);
const graph  = new GraphClient(config);

const server = new Server(
  { name: 'frontier-timesheets', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'd365_list_projects',
    description: 'List active projects from D365 Project Operations. Optionally filter by name.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Optional partial project name to filter by' },
      },
    },
  },
  {
    name: 'd365_list_project_tasks',
    description: 'List tasks for a given project in D365 Project Operations.',
    inputSchema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id: { type: 'string', description: 'Project GUID from d365_list_projects' },
      },
    },
  },
  {
    name: 'd365_list_roles',
    description: 'List available resource categories (roles) in D365 Project Operations.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'd365_get_time_entry_types',
    description: 'Get available time entry type option values from D365 (e.g. Work, Absence, Vacation).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'd365_get_time_entries',
    description: 'Get time entries already logged in D365 for a given date range.',
    inputSchema: {
      type: 'object',
      required: ['start_date', 'end_date'],
      properties: {
        start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        end_date: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      },
    },
  },
  {
    name: 'd365_create_time_entry',
    description:
      'Create a new time entry in D365 Project Operations. Always confirm with the user before calling.',
    inputSchema: {
      type: 'object',
      required: ['date', 'duration_minutes', 'project_id', 'project_task_id', 'type_value'],
      properties: {
        date: { type: 'string', description: 'Entry date in YYYY-MM-DD format' },
        duration_minutes: {
          type: 'integer',
          minimum: 1,
          description: 'Duration in minutes (e.g. 480 = 8h, 60 = 1h)',
        },
        project_id: { type: 'string', description: 'Project GUID from d365_list_projects' },
        project_task_id: { type: 'string', description: 'Task GUID from d365_list_project_tasks' },
        type_value: {
          type: 'integer',
          description: 'Time entry type value from d365_get_time_entry_types',
        },
        role_id: { type: 'string', description: 'Optional role GUID from d365_list_roles' },
        description: { type: 'string', maxLength: 2000, description: 'Optional notes' },
      },
    },
  },
  {
    name: 'd365_delete_time_entry',
    description: 'Delete a draft (unsubmitted) time entry from D365.',
    inputSchema: {
      type: 'object',
      required: ['time_entry_id'],
      properties: {
        time_entry_id: { type: 'string', description: 'Time entry GUID to delete' },
      },
    },
  },

  // ── Microsoft Graph tools ─────────────────────────────────────────────────
  {
    name: 'graph_get_activity_stats',
    description:
      'Get time spent per activity type (Email, Meeting, Focus, Chat, Call) for the last complete week ' +
      'from Microsoft Viva Insights via Graph API. Use this to understand how the user split their work time ' +
      'before drafting timesheets. Requires Analytics.Read permission and a Viva Insights licence.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'graph_get_recent_activities',
    description:
      'Get recently used apps and documents from the Windows Activity Timeline via Microsoft Graph. ' +
      'Returns app name, document title, URL, and active duration in seconds. ' +
      'Useful for identifying what the user worked on across devices.',
    inputSchema: {
      type: 'object',
      properties: {
        top: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Number of recent activities to return (default 25)',
        },
      },
    },
  },
  {
    name: 'graph_get_used_documents',
    description:
      'Get documents and SharePoint/OneDrive sites recently accessed by the user via Microsoft Graph insights. ' +
      'Returns document name, URL, resource type, and last-accessed timestamp. ' +
      'Useful for mapping work to D365 projects when calendar context is limited.',
    inputSchema: {
      type: 'object',
      properties: {
        top: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Number of documents to return (default 25)',
        },
      },
    },
  },

  {
    name: 'graph_get_calendar_events',
    description:
      'Get Outlook calendar events for a date range via Microsoft Graph. ' +
      'Returns subject, start/end times, duration, Teams meeting flag, organizer, and attendee count. ' +
      'Useful for mapping meetings to D365 project time entries. Requires Calendars.Read permission.',
    inputSchema: {
      type: 'object',
      required: ['start_date', 'end_date'],
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date:   { type: 'string', description: 'End date inclusive (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'graph_get_emails',
    description:
      'Get a summary of received emails for a date range via Microsoft Graph. ' +
      'Returns subject, sender, received time, preview, and attachment flag. ' +
      'Requires Mail.Read permission.',
    inputSchema: {
      type: 'object',
      required: ['start_date', 'end_date'],
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date:   { type: 'string', description: 'End date inclusive (YYYY-MM-DD)' },
        top: { type: 'integer', minimum: 1, maximum: 200, description: 'Max emails to return (default 50)' },
      },
    },
  },
  {
    name: 'graph_get_teams_chats',
    description:
      'Get Teams chat threads active during a date range via Microsoft Graph. ' +
      'Returns chat type (1:1, group, meeting), topic, last message preview, sender, and timestamp. ' +
      'Requires Chat.Read permission.',
    inputSchema: {
      type: 'object',
      required: ['start_date', 'end_date'],
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date:   { type: 'string', description: 'End date inclusive (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'graph_get_todo_tasks',
    description:
      'Get Microsoft To Do tasks for a date range (created or completed within the window) via Microsoft Graph. ' +
      'Returns task title, list name, status (notStarted/inProgress/completed), importance, and dates. ' +
      'Excellent signal for "what did I actually finish today". Requires Tasks.Read permission.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD), optional' },
        end_date:   { type: 'string', description: 'End date inclusive (YYYY-MM-DD), optional' },
      },
    },
  },
  {
    name: 'graph_get_planner_tasks',
    description:
      'Get Microsoft Planner tasks assigned to the current user for a date range via Microsoft Graph. ' +
      'Returns task title, plan, bucket, completion percentage, and due/completed dates. ' +
      'Useful for mapping project-tagged work to D365 time entries. Requires Tasks.Read permission.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD), optional' },
        end_date:   { type: 'string', description: 'End date inclusive (YYYY-MM-DD), optional' },
      },
    },
  },
  {
    name: 'graph_get_onenote_pages',
    description:
      'Get recently modified OneNote pages via Microsoft Graph. ' +
      'Returns page title, notebook/section names, last modified date, and web URL. ' +
      'Strong signal for research and learning activities. Requires Notes.Read permission.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date filter (YYYY-MM-DD), optional' },
        end_date:   { type: 'string', description: 'End date filter (YYYY-MM-DD), optional' },
        top:        { type: 'integer', minimum: 1, maximum: 100, description: 'Max pages to return (default 50)' },
      },
    },
  },
  {
    name: 'graph_get_onedrive_files',
    description:
      'Get recently accessed OneDrive files via Microsoft Graph. ' +
      'Returns file name, type, web URL, last modified date, and size. ' +
      'Shows what documents were actively worked on. Requires Files.Read permission.',
    inputSchema: {
      type: 'object',
      properties: {
        top: { type: 'integer', minimum: 1, maximum: 100, description: 'Number of recent files to return (default 30)' },
      },
    },
  },
  {
    name: 'graph_get_joined_teams',
    description:
      'List Microsoft Teams that the current user has joined via Microsoft Graph. ' +
      'Returns team name and description. Useful for mapping Teams activity to projects. ' +
      'Requires Team.ReadBasic.All permission.',
    inputSchema: { type: 'object', properties: {} },
  },

  // ── Activity report tools ─────────────────────────────────────────────────
  {
    name: 'browser_get_history',
    description:
      'Read browser history from Edge or Chrome for a date range. ' +
      'Returns URL, page title, and visit timestamp for every page visited. ' +
      'Use this as a primary signal for the work activity report.',
    inputSchema: {
      type: 'object',
      required: ['start_date', 'end_date'],
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date:   { type: 'string', description: 'End date inclusive (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'github_get_events',
    description:
      'Fetch GitHub activity (pushes, pull requests, issues, branches) for a user over a date range. ' +
      'Set the GITHUB_TOKEN env var for private repos. ' +
      'Use this to capture all code and PR activity for the work activity report.',
    inputSchema: {
      type: 'object',
      required: ['username', 'start_date', 'end_date'],
      properties: {
        username:   { type: 'string', description: 'GitHub username (e.g. ExigoTech-Beno)' },
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date:   { type: 'string', description: 'End date inclusive (YYYY-MM-DD)' },
      },
    },
  },
  {
    name: 'activity_build_report',
    description:
      'Generate a full HTML work activity report for a date range by combining browser history, ' +
      'GitHub events, Copilot/Claude CLI sessions, and optionally Outlook calendar/email, Teams chats, ' +
      'To Do tasks, Planner tasks, OneNote pages, and OneDrive files. ' +
      'Returns a complete self-contained HTML file with a category breakdown (Project/Microsoft/Learning/Research/Personal). ' +
      'Set include_graph=true to pull all Microsoft Graph sources (requires Graph authentication).',
    inputSchema: {
      type: 'object',
      required: ['start_date', 'end_date'],
      properties: {
        start_date:      { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date:        { type: 'string', description: 'End date inclusive (YYYY-MM-DD)' },
        username:        { type: 'string', description: 'Your name for the report header (default: from REPORT_USER_NAME env)' },
        github_username: { type: 'string', description: 'GitHub username for fetching events (default: GITHUB_USERNAME env var)' },
        include_graph:   { type: 'boolean', description: 'Also pull Outlook Calendar, Email, Teams, To Do, Planner, OneNote, and OneDrive data via Microsoft Graph (default false)' },
        output_path:     { type: 'string', description: 'File path to save the HTML report (optional)' },
      },
    },
  },
];

// ── List tools handler ───────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// ── Call tool handler ────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const a = args as Record<string, unknown>;

  try {
    switch (name) {
      case 'd365_list_projects': {
        const projects = await client.listProjects(a.search as string | undefined);
        if (projects.length === 0) return text('No active projects found.');
        return text(`Found ${projects.length} project(s):\n` + projects.map((p) => `• ${p.name} (id: ${p.id})`).join('\n'));
      }

      case 'd365_list_project_tasks': {
        const tasks = await client.listProjectTasks(a.project_id as string);
        if (tasks.length === 0) return text('No tasks found for this project.');
        return text(`Found ${tasks.length} task(s):\n` + tasks.map((t) => `• ${t.name} (id: ${t.id})`).join('\n'));
      }

      case 'd365_list_roles': {
        const roles = await client.listRoles();
        if (roles.length === 0) return text('No roles found.');
        return text(`Found ${roles.length} role(s):\n` + roles.map((r) => `• ${r.name} (id: ${r.id})`).join('\n'));
      }

      case 'd365_get_time_entry_types': {
        const types = await client.getTimeEntryTypes();
        return text('Time entry types:\n' + types.map((t) => `• ${t.label} (value: ${t.value})`).join('\n'));
      }

      case 'd365_get_time_entries': {
        const entries = await client.getTimeEntries(a.start_date as string, a.end_date as string);
        if (entries.length === 0) return text(`No time entries found between ${a.start_date} and ${a.end_date}.`);
        const lines = entries.map((e) =>
          [
            `📅 ${e.date} | ⏱ ${Math.round((e.durationMinutes / 60) * 10) / 10}h (${e.durationMinutes} min)`,
            `   Project: ${e.projectName || e.projectId}`,
            `   Task: ${e.taskName || e.taskId}`,
            `   Type: ${e.typeName || e.type} | Status: ${e.status}`,
            e.description ? `   Description: ${e.description}` : '',
            `   ID: ${e.id}`,
          ]
            .filter(Boolean)
            .join('\n')
        );
        return text(`Found ${entries.length} time entr${entries.length === 1 ? 'y' : 'ies'}:\n\n${lines.join('\n\n')}`);
      }

      case 'd365_create_time_entry': {
        const durationMinutes = a.duration_minutes as number;
        const result = await client.createTimeEntry({
          date: a.date as string,
          durationMinutes,
          projectId: a.project_id as string,
          projectTaskId: a.project_task_id as string,
          typeValue: a.type_value as number,
          roleId: a.role_id as string | undefined,
          description: a.description as string | undefined,
        });
        return text(
          `✅ Time entry created successfully.\nID: ${result.id}\nDate: ${a.date} | Duration: ${durationMinutes} min (${Math.round((durationMinutes / 60) * 10) / 10}h)`
        );
      }

      case 'd365_delete_time_entry': {
        await client.deleteTimeEntry(a.time_entry_id as string);
        return text(`🗑️ Time entry ${a.time_entry_id} deleted.`);
      }

      // ── Microsoft Graph ──────────────────────────────────────────────────

      case 'graph_get_activity_stats': {
        const stats = await graph.getActivityStatistics();
        if (!stats.length) return text('No activity statistics returned.');

        const grouped: Record<string, typeof stats> = {};
        for (const s of stats) {
          (grouped[s.activity] ??= []).push(s);
        }

        const lines: string[] = ['📊 Activity Statistics — last complete week\n'];
        for (const [activity, days] of Object.entries(grouped)) {
          const total = days.reduce((sum, d) => sum + d.durationHours, 0);
          const afterHours = days.reduce((sum, d) => sum + (d.afterHoursHours ?? 0), 0);
          lines.push(`**${activity}** — ${total.toFixed(1)}h total (${afterHours.toFixed(1)}h after hours)`);

          for (const d of days) {
            let detail = `  ${d.startDate}: ${d.durationHours.toFixed(1)}h`;
            if (activity === 'Meeting' && d.conflictingHours) detail += ` | ${d.conflictingHours.toFixed(1)}h conflicting`;
            if (activity === 'Meeting' && d.multitaskingHours) detail += ` | ${d.multitaskingHours.toFixed(1)}h multitasking`;
            if (activity === 'Email' && d.readHours != null) detail += ` | read ${d.readHours.toFixed(1)}h, sent ${(d.sentHours ?? 0).toFixed(1)}h`;
            lines.push(detail);
          }
          lines.push('');
        }
        return text(lines.join('\n'));
      }

      case 'graph_get_recent_activities': {
        const top = (a.top as number | undefined) ?? 25;
        const activities = await graph.getRecentActivities(top);
        if (!activities.length) return text('No recent activities found.');

        const lines = activities.map((act) => {
          const duration = act.activeDurationSeconds
            ? ` (${Math.round(act.activeDurationSeconds / 60)} min active)`
            : '';
          const url = act.contentUrl ? `\n   URL: ${act.contentUrl}` : '';
          return `• [${act.lastModified?.substring(0, 10)}] ${act.appDisplayName} — ${act.displayText}${duration}${url}`;
        });
        return text(`🕐 Recent Activities (${activities.length}):\n\n` + lines.join('\n'));
      }

      case 'graph_get_used_documents': {
        const top = (a.top as number | undefined) ?? 25;
        const docs = await graph.getUsedDocuments(top);
        if (!docs.length) return text('No recently used documents found.');

        const lines = docs.map((d) =>
          `• [${d.lastUsed?.substring(0, 10)}] ${d.resourceType} — ${d.name}\n   ${d.webUrl}`
        );
        return text(`📄 Recently Used Documents (${docs.length}):\n\n` + lines.join('\n'));
      }

      case 'graph_get_calendar_events': {
        const events = await graph.getCalendarEvents(a.start_date as string, a.end_date as string);
        if (!events.length) return text('No calendar events found for that date range.');
        const lines = events
          .filter(ev => !ev.isCancelled)
          .map(ev => {
            const tag = ev.isTeamsMeeting ? '📹 Teams' : ev.isAllDay ? '🗓 All-day' : '📅';
            const dur = ev.durationMinutes < 60
              ? `${ev.durationMinutes}m`
              : `${Math.floor(ev.durationMinutes / 60)}h${ev.durationMinutes % 60 ? (ev.durationMinutes % 60) + 'm' : ''}`;
            return `• ${tag} [${ev.start.substring(0, 16).replace('T', ' ')}] ${ev.subject} (${dur}${ev.attendeeCount > 1 ? `, ${ev.attendeeCount} attendees` : ''})`;
          });
        return text(`📅 Calendar Events — ${lines.length} event(s):\n\n` + lines.join('\n'));
      }

      case 'graph_get_emails': {
        const top = (a.top as number | undefined) ?? 50;
        const msgs = await graph.getEmails(a.start_date as string, a.end_date as string, top);
        if (!msgs.length) return text('No emails found for that date range.');
        const lines = msgs.map(m => {
          const tag = m.isRead ? '✉️' : '📬';
          const att = m.hasAttachments ? ' 📎' : '';
          return `• ${tag} [${m.receivedAt.substring(0, 16).replace('T', ' ')}] From: ${m.from}${att}\n  ${m.subject}`;
        });
        return text(`✉️ Emails — ${msgs.length} message(s):\n\n` + lines.join('\n'));
      }

      case 'graph_get_teams_chats': {
        const chats = await graph.getTeamsChats(a.start_date as string, a.end_date as string);
        if (!chats.length) return text('No Teams chats found active in that date range.');
        const lines = chats.map(c => {
          const tag = c.chatType === 'group' ? '👥' : c.chatType === 'meeting' ? '📹' : '💬';
          const topic = c.topic || '(No topic)';
          return `• ${tag} [${c.lastMessageAt.substring(0, 16).replace('T', ' ')}] ${topic}\n  ${c.lastMessageFrom}: ${c.lastMessage.substring(0, 100)}`;
        });
        return text(`💬 Teams Chats — ${chats.length} thread(s):\n\n` + lines.join('\n'));
      }

      case 'graph_get_todo_tasks': {
        const tasks = await graph.getTodoTasks(a.start_date as string | undefined, a.end_date as string | undefined);
        if (!tasks.length) return text('No To Do tasks found for that period.');
        const lines = tasks.map(t => {
          const statusIcon = t.status === 'completed' ? '✅' : t.status === 'inProgress' ? '🔄' : '⏳';
          const due  = t.dueDateTime       ? ` | due ${t.dueDateTime.substring(0, 10)}`       : '';
          const done = t.completedDateTime ? ` | done ${t.completedDateTime.substring(0, 10)}` : '';
          const imp  = t.importance === 'high' ? ' ⭐' : '';
          return `• ${statusIcon}${imp} [${t.listName}] ${t.title}${due}${done}`;
        });
        return text(`✅ To Do Tasks — ${tasks.length} task(s):\n\n` + lines.join('\n'));
      }

      case 'graph_get_planner_tasks': {
        const tasks = await graph.getPlannerTasks(a.start_date as string | undefined, a.end_date as string | undefined);
        if (!tasks.length) return text('No Planner tasks found for that period.');
        const lines = tasks.map(t => {
          const pct  = t.percentComplete === 100 ? '✅' : t.percentComplete > 0 ? `🔄 ${t.percentComplete}%` : '⏳';
          const due  = t.dueDateTime       ? ` | due ${t.dueDateTime.substring(0, 10)}`       : '';
          const done = t.completedDateTime ? ` | done ${t.completedDateTime.substring(0, 10)}` : '';
          return `• ${pct} ${t.title}${due}${done}`;
        });
        return text(`📋 Planner Tasks — ${tasks.length} task(s):\n\n` + lines.join('\n'));
      }

      case 'graph_get_onenote_pages': {
        const top   = (a.top as number | undefined) ?? 50;
        const pages = await graph.getOneNotePages(a.start_date as string | undefined, a.end_date as string | undefined, top);
        if (!pages.length) return text('No OneNote pages found for that period.');
        const lines = pages.map(p =>
          `• [${p.lastModified.substring(0, 10)}] ${p.notebookName} › ${p.sectionName} › ${p.title}`
        );
        return text(`📓 OneNote Pages — ${pages.length} page(s):\n\n` + lines.join('\n'));
      }

      case 'graph_get_onedrive_files': {
        const top   = (a.top as number | undefined) ?? 30;
        const files = await graph.getOneDriveRecentFiles(top);
        if (!files.length) return text('No recent OneDrive files found.');
        const lines = files.map(f => {
          const size = f.sizeBytes ? ` (${(f.sizeBytes / 1024).toFixed(0)} KB)` : '';
          return `• [${f.lastModified.substring(0, 10)}] ${f.fileType.toUpperCase()} — ${f.name}${size}\n   ${f.webUrl}`;
        });
        return text(`📁 OneDrive Recent Files — ${files.length} file(s):\n\n` + lines.join('\n'));
      }

      case 'graph_get_joined_teams': {
        const teams = await graph.getJoinedTeams();
        if (!teams.length) return text('No joined Teams found.');
        const lines = teams.map(t => `• ${t.displayName}${t.description ? ` — ${t.description.substring(0, 80)}` : ''}`);
        return text(`👥 Joined Teams — ${teams.length} team(s):\n\n` + lines.join('\n'));
      }

      // ── Activity report ──────────────────────────────────────────────────

      case 'browser_get_history': {
        const visits = await getBrowserHistory(a.start_date as string, a.end_date as string);
        if (!visits.length) return text('No browser history found for that date range.');
        const lines = visits.map(v =>
          `• [${v.visitTime.substring(0, 16).replace('T', ' ')}] ${v.title || v.url}`
        );
        return text(`🌐 Browser History — ${visits.length} visits:\n\n` + lines.join('\n'));
      }

      case 'github_get_events': {
        const ghUser = a.username as string;
        const events = await getGitHubEvents(ghUser, a.start_date as string, a.end_date as string);
        if (!events.length) return text(`No GitHub events found for @${ghUser} in that date range.`);
        const lines = events.map(e =>
          `• [${e.timestamp.substring(0, 16).replace('T', ' ')}] ${e.repo} — ${e.description}`
        );
        return text(`💻 GitHub Events — ${events.length} events:\n\n` + lines.join('\n'));
      }

      case 'activity_build_report': {
        const startDate    = a.start_date as string;
        const endDate      = a.end_date   as string;
        const userName     = (a.username as string | undefined) ?? process.env.REPORT_USER_NAME ?? 'User';
        const ghUsername   = (a.github_username as string | undefined) ?? process.env.GITHUB_USERNAME ?? '';
        const includeGraph = (a.include_graph as boolean | undefined) ?? false;

        // Gather all signals (non-fatal on individual failures)
        let visits:        Awaited<ReturnType<typeof getBrowserHistory>>      = [];
        let ghEvents:      Awaited<ReturnType<typeof getGitHubEvents>>        = [];
        let sessions:      ReturnType<typeof getSessionsForRange>             = [];
        let calEvents:     Awaited<ReturnType<typeof graph.getCalendarEvents>>   | undefined;
        let emails:        Awaited<ReturnType<typeof graph.getEmails>>           | undefined;
        let teams:         Awaited<ReturnType<typeof graph.getTeamsChats>>       | undefined;
        let todoTasks:     Awaited<ReturnType<typeof graph.getTodoTasks>>        | undefined;
        let plannerTasks:  Awaited<ReturnType<typeof graph.getPlannerTasks>>     | undefined;
        let oneNotePages:  Awaited<ReturnType<typeof graph.getOneNotePages>>     | undefined;
        let oneDriveFiles: Awaited<ReturnType<typeof graph.getOneDriveRecentFiles>> | undefined;

        try { visits   = await getBrowserHistory(startDate, endDate); } catch (e) { process.stderr.write(`browser: ${e}\n`); }
        if (ghUsername) {
          try { ghEvents = await getGitHubEvents(ghUsername, startDate, endDate); } catch (e) { process.stderr.write(`github: ${e}\n`); }
        }
        try { sessions = getSessionsForRange(startDate, endDate); } catch (e) { process.stderr.write(`sessions: ${e}\n`); }
        if (includeGraph) {
          try { calEvents     = await graph.getCalendarEvents(startDate, endDate);  } catch (e) { process.stderr.write(`calendar: ${e}\n`); }
          try { emails        = await graph.getEmails(startDate, endDate);           } catch (e) { process.stderr.write(`email: ${e}\n`); }
          try { teams         = await graph.getTeamsChats(startDate, endDate);       } catch (e) { process.stderr.write(`teams: ${e}\n`); }
          try { todoTasks     = await graph.getTodoTasks(startDate, endDate);        } catch (e) { process.stderr.write(`todo: ${e}\n`); }
          try { plannerTasks  = await graph.getPlannerTasks(startDate, endDate);     } catch (e) { process.stderr.write(`planner: ${e}\n`); }
          try { oneNotePages  = await graph.getOneNotePages(startDate, endDate);     } catch (e) { process.stderr.write(`onenote: ${e}\n`); }
          try { oneDriveFiles = await graph.getOneDriveRecentFiles(30);              } catch (e) { process.stderr.write(`onedrive: ${e}\n`); }
        }

        const html = buildReport(startDate, endDate, userName, visits, ghEvents, sessions, calEvents, emails, teams, todoTasks, plannerTasks, oneNotePages, oneDriveFiles);

        // Optionally save to disk
        const outputPath = a.output_path as string | undefined;
        if (outputPath) {
          const fs = await import('fs');
          fs.writeFileSync(outputPath, html, 'utf-8');
          const sources = [
            `${visits.length} browser visits`,
            `${ghEvents.length} GitHub events`,
            `${sessions.length} Copilot sessions`,
            ...(calEvents     ? [`${calEvents.length} calendar events`]         : []),
            ...(emails        ? [`${emails.length} emails`]                     : []),
            ...(teams         ? [`${teams.length} Teams chats`]                 : []),
            ...(todoTasks     ? [`${todoTasks.length} To Do tasks`]             : []),
            ...(plannerTasks  ? [`${plannerTasks.length} Planner tasks`]        : []),
            ...(oneNotePages  ? [`${oneNotePages.length} OneNote pages`]        : []),
            ...(oneDriveFiles ? [`${oneDriveFiles.length} OneDrive files`]      : []),
          ].join(' · ');
          return text(`✅ Work activity report generated and saved to: ${outputPath}\n\nSources: ${sources}`);
        }

        // Return HTML inline (LLM can display or save it)
        return { content: [{ type: 'text' as const, text: html }] };
      }

      default:
        return { content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
  }
});

function text(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}

// ── Start server ─────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
server.connect(transport).catch((err: Error) => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
