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
