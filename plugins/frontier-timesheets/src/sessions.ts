import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface CopilotSession {
  project:   string;
  title:     string;
  model:     string;
  started:   string; // ISO 8601
  ended:     string; // ISO 8601
  turns:     number;
  gitBranch: string;
}

interface Entry {
  type?:      string;
  timestamp?: string;
  isMeta?:    boolean;
  sessionId?: string;
  gitBranch?: string;
  aiTitle?:   string;
  message?: {
    model?:   string;
    content?: unknown;
    usage?:   unknown;
  };
  requestId?: string;
}

function parseJsonl(filePath: string): Entry[] {
  try {
    return fs.readFileSync(filePath, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .flatMap(line => { try { return [JSON.parse(line) as Entry]; } catch { return []; } });
  } catch {
    return [];
  }
}

function firstPrompt(entries: Entry[]): string {
  for (const e of entries) {
    if (e.type !== 'user' || e.isMeta) continue;
    const c = e.message?.content;
    if (typeof c === 'string' && c.trim().length > 10 && !c.startsWith('<')) {
      return c.trim().slice(0, 100);
    }
    if (Array.isArray(c)) {
      const t = (c as Array<{ type?: string; text?: string }>).find(b => b.type === 'text')?.text ?? '';
      if (t.trim().length > 10) return t.trim().slice(0, 100);
    }
  }
  return '';
}

export function getSessionsForRange(startDate: string, endDate: string): CopilotSession[] {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(claudeDir)) return [];

  const startMs = new Date(startDate).getTime();
  const endMs   = new Date(endDate).getTime() + 86_400_000;

  const sessions: CopilotSession[] = [];

  for (const dir of fs.readdirSync(claudeDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;

    const projectName = dir.name
      .replace(/^C--Projects-/, '')
      .replace(/^C--Users-[^-]+-/, '~/')
      .replace(/-/g, ' ');

    const projPath = path.join(claudeDir, dir.name);

    for (const file of fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl'))) {
      const entries = parseJsonl(path.join(projPath, file));
      if (!entries.length) continue;

      const timed = entries
        .filter(e => e.timestamp)
        .sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));

      if (!timed.length) continue;

      const firstTs = new Date(timed[0].timestamp!).getTime();
      const lastTs  = new Date(timed[timed.length - 1].timestamp!).getTime();

      // Session must overlap with the requested date window
      if (lastTs < startMs || firstTs > endMs) continue;

      const aiTitle = entries.find(e => e.type === 'ai-title' && e.aiTitle)?.aiTitle ?? '';
      const title   = aiTitle || firstPrompt(entries) || '(no title)';
      const model   = entries.find(e => e.type === 'assistant' && e.message?.model)?.message?.model ?? '';
      const branch  = entries.find(e => e.gitBranch)?.gitBranch ?? '';
      const turns   = entries.filter(e => e.type === 'user' && !e.isMeta).length;

      sessions.push({
        project:   projectName,
        title,
        model,
        started:   timed[0].timestamp!,
        ended:     timed[timed.length - 1].timestamp!,
        turns,
        gitBranch: branch,
      });
    }
  }

  return sessions.sort((a, b) => a.started.localeCompare(b.started));
}
