export interface GitHubEvent {
  type:        string;
  repo:        string;
  description: string;
  timestamp:   string; // ISO 8601
}

type Formatter = (payload: Record<string, unknown>) => string;

const FORMATTERS: Record<string, Formatter> = {
  PushEvent: (p) => {
    const commits = (p.commits as Array<{ message: string }> | undefined) ?? [];
    const msg = commits[0]?.message?.split('\n')[0] ?? 'push';
    return `Push: ${msg}`;
  },
  PullRequestEvent: (p) => {
    const pr = p.pull_request as Record<string, unknown> | undefined;
    return `PR ${p.action}: ${pr?.title ?? ''}`;
  },
  IssuesEvent: (p) => {
    const issue = p.issue as Record<string, unknown> | undefined;
    return `Issue ${p.action}: ${issue?.title ?? ''}`;
  },
  CreateEvent: (p) => `${p.ref_type} created: ${p.ref ?? ''}`,
  DeleteEvent: (p) => `${p.ref_type} deleted: ${p.ref ?? ''}`,
  ForkEvent:   (p) => {
    const forkee = p.forkee as Record<string, unknown> | undefined;
    return `Forked to ${forkee?.full_name ?? ''}`;
  },
};

export async function getGitHubEvents(
  username:  string,
  startDate: string,
  endDate:   string,
): Promise<GitHubEvent[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept:       'application/vnd.github+json',
    'User-Agent': 'frontier-timesheets/1.0',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const startMs = new Date(startDate).getTime();
  const endMs   = new Date(endDate).getTime() + 86_400_000; // include full end day

  const events: GitHubEvent[] = [];

  // GitHub returns up to 300 events across 3 pages — filter by date client-side
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=100&page=${page}`,
      { headers },
    );

    if (res.status === 404) throw new Error(`GitHub user "${username}" not found.`);
    if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);

    const items = await res.json() as Array<Record<string, unknown>>;
    if (!items.length) break;

    let reachedBeforeWindow = false;
    for (const item of items) {
      const t = new Date(item.created_at as string).getTime();
      if (t < startMs) { reachedBeforeWindow = true; break; }
      if (t > endMs)   continue;

      const payload   = (item.payload ?? {}) as Record<string, unknown>;
      const formatter = FORMATTERS[item.type as string];
      const repoName  = (item.repo as Record<string, unknown>)?.name as string ?? '';

      events.push({
        type:        item.type as string,
        repo:        repoName,
        description: formatter ? formatter(payload) : (item.type as string),
        timestamp:   item.created_at as string,
      });
    }

    if (reachedBeforeWindow) break;
  }

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
