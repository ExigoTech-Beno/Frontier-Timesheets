import { getAccessToken } from './auth.js';
import { Config } from './config.js';

const GRAPH_V1   = 'https://graph.microsoft.com/v1.0';
const GRAPH_BETA = 'https://graph.microsoft.com/beta';

// Scopes requested together so the user only sees one device-code prompt.
const GRAPH_SCOPES = [
  'https://graph.microsoft.com/Analytics.Read',
  'https://graph.microsoft.com/Sites.Read.All',
  'https://graph.microsoft.com/UserActivity.ReadWrite.CreatedByApp',
  'https://graph.microsoft.com/Calendars.Read',
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/Chat.Read',
  'https://graph.microsoft.com/Tasks.Read',
  'https://graph.microsoft.com/Notes.Read',
  'https://graph.microsoft.com/Files.Read',
  'https://graph.microsoft.com/Team.ReadBasic.All',
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityStat {
  activity: 'Email' | 'Meeting' | 'Focus' | 'Chat' | 'Call';
  startDate: string;
  endDate: string;
  durationHours: number;
  afterHoursHours?: number;
  // Meeting-specific
  organizedHours?: number;
  recurringHours?: number;
  conflictingHours?: number;
  multitaskingHours?: number;
  // Email-specific
  readHours?: number;
  sentHours?: number;
}

export interface RecentActivity {
  id: string;
  appDisplayName: string;
  activitySourceHost: string;
  displayText: string;
  contentUrl?: string;
  lastModified: string;
  startedDateTime?: string;
  activeDurationSeconds?: number;
}

export interface UsedDocument {
  id: string;
  name: string;
  webUrl: string;
  lastUsed: string;
  resourceType: string;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  start: string;           // ISO 8601
  end: string;             // ISO 8601
  durationMinutes: number;
  isTeamsMeeting: boolean;
  organizer: string;
  attendeeCount: number;
  location?: string;
  isAllDay: boolean;
  isCancelled: boolean;
}

export interface EmailSummary {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;      // ISO 8601
  preview: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export interface TeamsChat {
  id: string;
  chatType: string;        // 'oneOnOne' | 'group' | 'meeting'
  topic: string;
  lastMessage: string;
  lastMessageAt: string;   // ISO 8601
  lastMessageFrom: string;
}

export interface TodoTask {
  id: string;
  title: string;
  status: string;          // 'notStarted' | 'inProgress' | 'completed'
  listName: string;
  createdDateTime: string;
  completedDateTime?: string;
  dueDateTime?: string;
  importance: string;
}

export interface PlannerTask {
  id: string;
  title: string;
  planTitle: string;
  bucketName: string;
  percentComplete: number;
  startDateTime?: string;
  dueDateTime?: string;
  completedDateTime?: string;
}

export interface OneNotePage {
  id: string;
  title: string;
  notebookName: string;
  sectionName: string;
  lastModified: string;
  createdDateTime: string;
  webUrl: string;
}

export interface OneDriveFile {
  id: string;
  name: string;
  webUrl: string;
  lastModified: string;
  fileType: string;
  sizeBytes?: number;
}

export interface JoinedTeam {
  id: string;
  displayName: string;
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse an ISO 8601 duration string (PT2H30M) into decimal hours. */
function isoDurationToHours(duration: string | undefined): number {
  if (!duration) return 0;
  const h = parseFloat(duration.match(/(\d+(?:\.\d+)?)H/)?.[1] ?? '0');
  const m = parseFloat(duration.match(/(\d+(?:\.\d+)?)M/)?.[1] ?? '0');
  const s = parseFloat(duration.match(/(\d+(?:\.\d+)?)S/)?.[1] ?? '0');
  return Math.round((h + m / 60 + s / 3600) * 100) / 100;
}

function round2(n: number) { return Math.round(n * 100) / 100; }

// ── Client ────────────────────────────────────────────────────────────────────

export class GraphClient {
  private config: Config;
  private tokenPromise: Promise<string> | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  private async getToken(): Promise<string> {
    if (!this.tokenPromise) {
      this.tokenPromise = getAccessToken(
        this.config.tenantId,
        this.config.clientId,
        GRAPH_SCOPES,
      );
    }
    return this.tokenPromise;
  }

  private async fetch<T>(baseUrl: string, path: string): Promise<T> {
    const token = await this.getToken();
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ConsistencyLevel: 'eventual',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      // Provide a helpful message for the common licence-missing case
      if (res.status === 403 && path.includes('activitystatistics')) {
        throw new Error(
          `Graph API returned 403 for activitystatistics. ` +
          `This endpoint requires a Microsoft Viva Insights / MyAnalytics licence. ` +
          `Raw: ${body}`,
        );
      }
      throw new Error(`Graph API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Returns daily activity-time breakdown for the last complete week.
   * Requires Analytics.Read + Viva Insights licence.
   */
  async getActivityStatistics(): Promise<ActivityStat[]> {
    const data = await this.fetch<{ value: Array<Record<string, string>> }>(
      GRAPH_BETA,
      '/me/analytics/activitystatistics',
    );

    return data.value.map((item) => {
      const base: ActivityStat = {
        activity:        item.activity as ActivityStat['activity'],
        startDate:       item.startDate,
        endDate:         item.endDate,
        durationHours:   isoDurationToHours(item.duration),
        afterHoursHours: isoDurationToHours(item.afterHours),
      };
      // Meeting extras
      if (item.activity === 'Meeting') {
        base.organizedHours   = isoDurationToHours(item.organized);
        base.recurringHours   = isoDurationToHours(item.recurring);
        base.conflictingHours = isoDurationToHours(item.conflicting);
        base.multitaskingHours = isoDurationToHours(item.multitasking);
      }
      // Email extras
      if (item.activity === 'Email') {
        base.readHours = isoDurationToHours(item.readEmail);
        base.sentHours = isoDurationToHours(item.sentEmail);
      }
      return base;
    });
  }

  /**
   * Returns the most recently used cross-device activities (Windows Timeline).
   * Requires UserActivity.ReadWrite.CreatedByApp.
   */
  async getRecentActivities(top = 25): Promise<RecentActivity[]> {
    const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(
      GRAPH_V1,
      `/me/activities/recent?$top=${top}&$expand=historyItems($top=1)`,
    );

    return data.value.map((a) => {
      const contentInfo = (a.contentInfo ?? {}) as Record<string, string>;
      const history = (a.historyItems as Array<Record<string, string>> | undefined)?.[0];
      return {
        id:                    a.id as string,
        appDisplayName:        a.appDisplayName as string ?? '',
        activitySourceHost:    a.activitySourceHost as string ?? '',
        displayText:           contentInfo['schema:name'] ?? contentInfo.name ?? (a.visualElements as Record<string, string>)?.displayText ?? '',
        contentUrl:            a.contentUrl as string | undefined,
        lastModified:          a.lastModifiedDateTime as string ?? '',
        startedDateTime:       history?.startedDateTime,
        activeDurationSeconds: history?.activeDurationSeconds
          ? parseInt(String(history.activeDurationSeconds), 10)
          : undefined,
      };
    });
  }

  /**
   * Returns documents and sites recently used by the signed-in user.
   * Requires Sites.Read.All.
   */
  async getUsedDocuments(top = 25): Promise<UsedDocument[]> {
    const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(
      GRAPH_V1,
      `/me/insights/used?$top=${top}&$orderby=lastUsed/lastAccessedDateTime desc`,
    );

    return data.value.map((item) => {
      const res  = (item.resourceReference ?? {}) as Record<string, string>;
      const used = (item.lastUsed ?? {}) as Record<string, string>;
      return {
        id:           item.id as string,
        name:         res.webUrl?.split('/').pop()?.split('?')[0] ?? res.id ?? '',
        webUrl:       res.webUrl ?? '',
        lastUsed:     used.lastAccessedDateTime ?? used.lastModifiedDateTime ?? '',
        resourceType: res.type ?? '',
      };
    });
  }

  /**
   * Returns calendar events for a date range.
   * Requires Calendars.Read.
   */
  async getCalendarEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const startDT = `${startDate}T00:00:00`;
    const endDT   = `${endDate}T23:59:59`;
    const select  = 'id,subject,start,end,isAllDay,isCancelled,isOnlineMeeting,onlineMeetingProvider,organizer,attendees,location';
    const path    = `/me/calendarView?startDateTime=${encodeURIComponent(startDT)}&endDateTime=${encodeURIComponent(endDT)}&$select=${select}&$top=100&$orderby=start/dateTime`;

    const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(GRAPH_V1, path);

    return data.value.map((ev) => {
      const startStr = ((ev.start as Record<string, string>)?.dateTime ?? '') + 'Z';
      const endStr   = ((ev.end   as Record<string, string>)?.dateTime ?? '') + 'Z';
      const startMs  = new Date(startStr).getTime();
      const endMs    = new Date(endStr).getTime();
      const durationMinutes = isNaN(startMs) || isNaN(endMs) ? 0 : Math.round((endMs - startMs) / 60000);
      const attendees = (ev.attendees as Array<Record<string, unknown>> | undefined) ?? [];
      const organizer = ((ev.organizer as Record<string, unknown>)?.emailAddress as Record<string, string>)?.name ?? '';
      const location  = ((ev.location  as Record<string, unknown>)?.displayName  as string) ?? undefined;
      const isTeams   = ev.isOnlineMeeting === true && (ev.onlineMeetingProvider as string) === 'teamsForBusiness';

      return {
        id:              ev.id as string,
        subject:         (ev.subject as string) ?? '(No subject)',
        start:           startStr.replace('Z', ''),
        end:             endStr.replace('Z', ''),
        durationMinutes,
        isTeamsMeeting:  isTeams,
        organizer,
        attendeeCount:   attendees.length,
        location:        location || undefined,
        isAllDay:        ev.isAllDay === true,
        isCancelled:     ev.isCancelled === true,
      };
    });
  }

  /**
   * Returns a summary of received emails for a date range.
   * Requires Mail.Read.
   */
  async getEmails(startDate: string, endDate: string, top = 50): Promise<EmailSummary[]> {
    const start  = `${startDate}T00:00:00Z`;
    const end    = `${endDate}T23:59:59Z`;
    const filter = `receivedDateTime ge ${start} and receivedDateTime le ${end}`;
    const select = 'id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments';
    const path   = `/me/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${top}&$orderby=receivedDateTime asc`;

    const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(GRAPH_V1, path);

    return data.value.map((msg) => {
      const fromAddr = ((msg.from as Record<string, unknown>)?.emailAddress as Record<string, string>);
      return {
        id:             msg.id as string,
        subject:        (msg.subject as string) ?? '(No subject)',
        from:           fromAddr?.name ?? fromAddr?.address ?? '',
        receivedAt:     msg.receivedDateTime as string ?? '',
        preview:        (msg.bodyPreview as string ?? '').substring(0, 200),
        isRead:         msg.isRead === true,
        hasAttachments: msg.hasAttachments === true,
      };
    });
  }

  /**
   * Returns recent Teams chats with last-message preview.
   * Requires Chat.Read.
   */
  async getTeamsChats(startDate: string, endDate: string): Promise<TeamsChat[]> {
    const start = new Date(`${startDate}T00:00:00Z`).getTime();
    const end   = new Date(`${endDate}T23:59:59Z`).getTime();

    // Fetch recent chats with last message preview
    const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(
      GRAPH_V1,
      '/me/chats?$expand=lastMessagePreview&$top=50',
    );

    const results: TeamsChat[] = [];

    for (const chat of data.value) {
      const lastMsgPreview = (chat.lastMessagePreview ?? {}) as Record<string, unknown>;
      const lastMsgAt = lastMsgPreview.createdDateTime as string | undefined;
      if (!lastMsgAt) continue;

      const msgTime = new Date(lastMsgAt).getTime();
      if (msgTime < start || msgTime > end) continue;

      const fromUser = (lastMsgPreview.from as Record<string, unknown> | undefined);
      const fromDisplay = (fromUser?.user as Record<string, string> | undefined)?.displayName
                       ?? (fromUser?.application as Record<string, string> | undefined)?.displayName
                       ?? 'Unknown';
      const bodyContent = ((lastMsgPreview.body as Record<string, string> | undefined)?.content ?? '')
        .replace(/<[^>]+>/g, '')   // strip HTML tags from Teams messages
        .substring(0, 200);

      results.push({
        id:              chat.id as string,
        chatType:        (chat.chatType as string) ?? 'oneOnOne',
        topic:           (chat.topic as string) ?? '',
        lastMessage:     bodyContent,
        lastMessageAt:   lastMsgAt,
        lastMessageFrom: fromDisplay,
      });
    }

    return results.sort((a, b) => a.lastMessageAt.localeCompare(b.lastMessageAt));
  }

  /**
   * Returns Microsoft To Do tasks, optionally filtered to a date range.
   * Requires Tasks.Read permission.
   */
  async getTodoTasks(startDate?: string, endDate?: string): Promise<TodoTask[]> {
    // Fetch all task lists
    const listsData = await this.fetch<{ value: Array<Record<string, unknown>> }>(
      GRAPH_V1, '/me/todo/lists',
    );

    const results: TodoTask[] = [];

    for (const list of listsData.value) {
      const listId   = list.id as string;
      const listName = (list.displayName as string) ?? 'Tasks';

      // Fetch tasks in this list — filter completed ones if date range provided
      let path = `/me/todo/lists/${listId}/tasks?$top=100`;
      const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(GRAPH_V1, path);

      for (const task of data.value) {
        const completedRaw = (task.completedDateTime as Record<string, string> | undefined)?.dateTime;
        const createdRaw   = task.createdDateTime as string | undefined;
        const dueRaw       = (task.dueDateTime as Record<string, string> | undefined)?.dateTime;

        // Apply date filter if provided — include tasks created or completed within range
        if (startDate && endDate) {
          const start = new Date(startDate).getTime();
          const end   = new Date(endDate).getTime() + 86_400_000;
          const createdMs   = createdRaw   ? new Date(createdRaw).getTime()   : 0;
          const completedMs = completedRaw ? new Date(completedRaw).getTime() : 0;
          if (createdMs < start && completedMs < start) continue;
          if (createdMs > end   && completedMs > end)   continue;
        }

        results.push({
          id:                listId + ':' + (task.id as string),
          title:             (task.title as string) ?? '(Untitled)',
          status:            (task.status as string) ?? 'notStarted',
          listName,
          createdDateTime:   createdRaw ?? '',
          completedDateTime: completedRaw,
          dueDateTime:       dueRaw,
          importance:        (task.importance as string) ?? 'normal',
        });
      }
    }

    return results.sort((a, b) => (a.createdDateTime).localeCompare(b.createdDateTime));
  }

  /**
   * Returns Planner tasks assigned to the current user.
   * Requires Tasks.Read permission.
   */
  async getPlannerTasks(startDate?: string, endDate?: string): Promise<PlannerTask[]> {
    const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(
      GRAPH_V1, '/me/planner/tasks',
    );

    const start = startDate ? new Date(startDate).getTime() : 0;
    const end   = endDate   ? new Date(endDate).getTime() + 86_400_000 : Infinity;

    const results: PlannerTask[] = [];
    for (const task of data.value) {
      const details    = (task.details  ?? {}) as Record<string, unknown>;
      const createdRaw = task.createdDateTime as string | undefined;
      const dueRaw     = task.dueDateTime as string | undefined;
      const completedRaw = (task.completedDateTime as string | undefined);

      // Date filter — include if created or due in range
      const createdMs   = createdRaw   ? new Date(createdRaw).getTime()   : 0;
      const completedMs = completedRaw ? new Date(completedRaw).getTime() : 0;
      const dueMs       = dueRaw       ? new Date(dueRaw).getTime()       : 0;
      const relevantMs  = completedMs || dueMs || createdMs;
      if (startDate && endDate && (relevantMs < start || relevantMs > end)) continue;

      results.push({
        id:              task.id as string,
        title:           (task.title as string) ?? '(Untitled)',
        planTitle:       (task.planId as string) ?? '',   // ID — we don't expand plans here
        bucketName:      (details.bucketId as string) ?? '',
        percentComplete: (task.percentComplete as number) ?? 0,
        startDateTime:   task.startDateTime as string | undefined,
        dueDateTime:     dueRaw,
        completedDateTime: completedRaw,
      });
    }

    return results;
  }

  /**
   * Returns recently modified OneNote pages.
   * Requires Notes.Read permission.
   */
  async getOneNotePages(startDate?: string, endDate?: string, top = 50): Promise<OneNotePage[]> {
    let filter = '';
    if (startDate) {
      filter = `&$filter=lastModifiedDateTime ge ${startDate}T00:00:00Z`;
      if (endDate) filter += ` and lastModifiedDateTime le ${endDate}T23:59:59Z`;
    }

    const path = `/me/onenote/pages?$top=${top}&$orderby=lastModifiedDateTime desc&$select=id,title,lastModifiedDateTime,createdDateTime,webUrl,parentSection,parentNotebook${filter}`;

    const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(GRAPH_V1, path);

    return data.value.map((page) => {
      const section  = (page.parentSection  as Record<string, string> | undefined);
      const notebook = (page.parentNotebook as Record<string, string> | undefined);
      return {
        id:               page.id as string,
        title:            (page.title as string) ?? '(Untitled)',
        notebookName:     notebook?.displayName ?? '',
        sectionName:      section?.displayName  ?? '',
        lastModified:     (page.lastModifiedDateTime as string) ?? '',
        createdDateTime:  (page.createdDateTime     as string) ?? '',
        webUrl:           (page.webUrl as string) ?? '',
      };
    });
  }

  /**
   * Returns recently modified/accessed OneDrive files.
   * Requires Files.Read permission.
   */
  async getOneDriveRecentFiles(top = 30): Promise<OneDriveFile[]> {
    const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(
      GRAPH_V1,
      `/me/drive/recent?$top=${top}`,
    );

    return data.value.map((item) => {
      const fileInfo = (item.file as Record<string, unknown> | undefined);
      const mimeType = (fileInfo?.mimeType as string) ?? '';
      const ext      = (item.name as string ?? '').split('.').pop() ?? '';
      return {
        id:           item.id as string,
        name:         (item.name as string) ?? '',
        webUrl:       (item.webUrl as string) ?? '',
        lastModified: ((item.fileSystemInfo as Record<string, string> | undefined)?.lastModifiedDateTime
                      ?? (item.lastModifiedDateTime as string)
                      ?? ''),
        fileType:     (ext || mimeType.split('/').pop()) ?? 'file',
        sizeBytes:    (item.size as number | undefined),
      };
    });
  }

  /**
   * Returns the teams the user has joined in Microsoft Teams.
   * Requires Team.ReadBasic.All permission.
   */
  async getJoinedTeams(): Promise<JoinedTeam[]> {
    const data = await this.fetch<{ value: Array<Record<string, unknown>> }>(
      GRAPH_V1, '/me/joinedTeams?$select=id,displayName,description',
    );

    return data.value.map((team) => ({
      id:          team.id as string,
      displayName: (team.displayName as string) ?? '',
      description: (team.description as string) ?? '',
    }));
  }
}
