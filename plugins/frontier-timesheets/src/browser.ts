import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import initSqlJs from 'sql.js';

export interface BrowserVisit {
  url:       string;
  title:     string;
  visitTime: string; // ISO 8601
}

// Chrome/Edge timestamps = microseconds since 1601-01-01 00:00:00 UTC
const CHROME_EPOCH_OFFSET_MS = 11644473600000;

function chromeTimeToDate(t: number): Date {
  return new Date(Math.round(t / 1000) - CHROME_EPOCH_OFFSET_MS);
}

function candidatePaths(): string[] {
  const local = process.env.LOCALAPPDATA
    ?? path.join(os.homedir(), 'AppData', 'Local');
  return [
    path.join(local, 'Microsoft', 'Edge', 'User Data', 'Default', 'History'),
    path.join(local, 'Google', 'Chrome', 'User Data', 'Default', 'History'),
  ];
}

export async function getBrowserHistory(startDate: string, endDate: string): Promise<BrowserVisit[]> {
  const paths = candidatePaths().filter(p => fs.existsSync(p));
  if (!paths.length) {
    throw new Error('No browser history database found. Edge or Chrome must be installed.');
  }

  // Chrome epoch microseconds for the date window
  const startMs = new Date(startDate).getTime();
  const endMs   = new Date(endDate).getTime() + 86_400_000; // include full end day
  const startCr = (startMs + CHROME_EPOCH_OFFSET_MS) * 1000;
  const endCr   = (endMs   + CHROME_EPOCH_OFFSET_MS) * 1000;

  const SQL = await initSqlJs();
  const all: BrowserVisit[] = [];

  for (const histPath of paths) {
    // Copy the file — browsers hold an exclusive lock while running
    const tmp = path.join(os.tmpdir(), `ft-history-${Date.now()}.db`);
    try {
      fs.copyFileSync(histPath, tmp);
      const fileBuffer = fs.readFileSync(tmp);
      const db = new SQL.Database(fileBuffer);

      const result = db.exec(`
        SELECT u.url, u.title, v.visit_time
        FROM   visits v
        JOIN   urls   u ON v.url = u.id
        WHERE  v.visit_time >= ${startCr} AND v.visit_time < ${endCr}
        ORDER  BY v.visit_time ASC
      `);

      db.close();

      if (result.length && result[0].values) {
        for (const [url, title, visitTime] of result[0].values as [string, string, number][]) {
          all.push({
            url,
            title:     title ?? '',
            visitTime: chromeTimeToDate(visitTime).toISOString(),
          });
        }
      }
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  return all.sort((a, b) => a.visitTime.localeCompare(b.visitTime));
}
