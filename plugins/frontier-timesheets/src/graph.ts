import { getAccessToken } from './auth.js';
import { Config } from './config.js';

const GRAPH_V1   = 'https://graph.microsoft.com/v1.0';
const GRAPH_BETA = 'https://graph.microsoft.com/beta';

// Scopes requested together so the user only sees one device-code prompt.
const GRAPH_SCOPES = [
  'https://graph.microsoft.com/Analytics.Read',
  'https://graph.microsoft.com/Sites.Read.All',
  'https://graph.microsoft.com/UserActivity.ReadWrite.CreatedByApp',
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
}
