#!/usr/bin/env node
/**
 * analyze-sessions.mjs
 * Analyse Claude Code session transcripts stored in ~/.claude/projects/
 *
 * Usage:
 *   node tools/analyze-sessions.mjs
 *   node tools/analyze-sessions.mjs --filter Frontier
 *   node tools/analyze-sessions.mjs --csv sessions.csv
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const filterIdx = args.indexOf('--filter');
const csvIdx    = args.indexOf('--csv');
const filter    = filterIdx !== -1 ? args[filterIdx + 1] : '';
const csvOut    = csvIdx    !== -1 ? args[csvIdx + 1]    : '';

const claudeDir = path.join(os.homedir(), '.claude', 'projects');

if (!fs.existsSync(claudeDir)) {
  console.error(`Claude projects directory not found: ${claudeDir}`);
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtN(n) { return n.toLocaleString(); }
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
}
function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : s; }

function parseJsonl(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  return lines.flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
}

function col(text, width) {
  const s = String(text ?? '');
  return s.length >= width ? s.slice(0, width - 1) + '…' : s.padEnd(width);
}

function printTable(rows, columns) {
  const header = columns.map(c => col(c.label, c.width)).join('  ');
  const divider = columns.map(c => '─'.repeat(c.width)).join('  ');
  console.log(header);
  console.log(divider);
  for (const row of rows) {
    console.log(columns.map(c => {
      const val = typeof c.get === 'function' ? c.get(row) : row[c.key];
      const s = col(val, c.width);
      return s;
    }).join('  '));
  }
}

// ── Analyse ───────────────────────────────────────────────────────────────────
const projectDirs = fs.readdirSync(claudeDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && (!filter || d.name.toLowerCase().includes(filter.toLowerCase())))
  .map(d => path.join(claudeDir, d.name));

const sessions = [];

for (const projPath of projectDirs) {
  const rawName = path.basename(projPath);
  const projectName = rawName
    .replace(/^C--Projects-/, '')
    .replace(/^C--Users-[^-]+-/, '~/')
    .replace(/-/g, ' ');

  const jsonlFiles = fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl'));

  for (const file of jsonlFiles) {
    const filePath = path.join(projPath, file);
    const entries = parseJsonl(filePath);

    if (!entries.length) continue;

    // Metadata
    const withTime = entries.filter(e => e.timestamp).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const first = withTime[0];
    const last  = withTime[withTime.length - 1];

    const sessionId  = entries.find(e => e.sessionId)?.sessionId ?? '';
    const gitBranch  = entries.find(e => e.gitBranch)?.gitBranch ?? '';
    const model      = entries.find(e => e.type === 'assistant' && e.message?.model)?.message?.model ?? '';

    // Title / theme
    const aiTitle = entries.find(e => e.type === 'ai-title' && e.aiTitle)?.aiTitle ?? '';
    let firstPrompt = '';
    for (const e of entries) {
      if (e.type !== 'user' || e.isMeta) continue;
      const c = e.message?.content;
      if (typeof c === 'string' && c.trim().length > 10 && !c.startsWith('<')) {
        firstPrompt = c.trim();
        break;
      }
      if (Array.isArray(c)) {
        const text = c.find(b => b.type === 'text')?.text ?? '';
        if (text.trim().length > 10) { firstPrompt = text.trim(); break; }
      }
    }
    const theme = aiTitle || truncate(firstPrompt, 80) || '(no title)';

    // Tokens — deduplicate by requestId
    const seen = new Set();
    let inputTokens = 0, outputTokens = 0, cacheCreate = 0, cacheRead = 0;
    for (const e of entries) {
      if (e.type !== 'assistant' || !e.requestId || !e.message?.usage) continue;
      if (seen.has(e.requestId)) continue;
      seen.add(e.requestId);
      const u = e.message.usage;
      inputTokens  += u.input_tokens                  ?? 0;
      outputTokens += u.output_tokens                 ?? 0;
      cacheCreate  += u.cache_creation_input_tokens   ?? 0;
      cacheRead    += u.cache_read_input_tokens        ?? 0;
    }
    const totalTokens = inputTokens + outputTokens + cacheCreate + cacheRead;

    // Git pushes — check Bash tool_use inputs + tool result content
    const pushOps = new Set();
    for (const e of entries) {
      if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
        for (const block of e.message.content) {
          if (block.type === 'tool_use' && block.name === 'Bash') {
            const cmd = block.input?.command ?? '';
            if (/git push/.test(cmd)) {
              const remote = cmd.match(/git push\s+(\S+)/)?.[1] ?? 'origin';
              pushOps.add(`git push → ${remote}`);
            }
          }
        }
      }
      // Also catch confirmed pushes surfacing in tool results
      if (e.type === 'user' && Array.isArray(e.message?.content)) {
        for (const block of e.message.content) {
          if (block.type === 'tool_result') {
            const txt = Array.isArray(block.content)
              ? block.content.map(b => b.text ?? '').join(' ')
              : (block.content ?? '');
            if (/git push/.test(txt)) pushOps.add('git push (confirmed in output)');
          }
        }
      }
    }

    sessions.push({
      project:    projectName,
      file,
      theme,
      model,
      gitBranch,
      gitPushes:  [...pushOps].join('; '),
      started:    fmtDate(first?.timestamp),
      ended:      fmtDate(last?.timestamp),
      inputTokens,
      outputTokens,
      cacheCreate,
      cacheRead,
      totalTokens,
      fileSizeKB: Math.round(fs.statSync(filePath).size / 1024),
    });
  }
}

sessions.sort((a, b) => b.started.localeCompare(a.started));

// ── Print ─────────────────────────────────────────────────────────────────────
console.log('\n\x1b[36m=== Claude Code Session Analyser ===\x1b[0m');
console.log(`Scanned ${sessions.length} session(s) across ${projectDirs.length} project(s)\n`);

console.log('\x1b[36m━━━ SESSIONS ━━━\x1b[0m');
printTable(sessions, [
  { label: 'Started',    width: 14, key: 'started' },
  { label: 'Project',    width: 35, key: 'project' },
  { label: 'Title / Theme',          width: 55, key: 'theme' },
  { label: 'Model',      width: 20, key: 'model' },
  { label: 'Branch',     width: 14, key: 'gitBranch' },
  { label: 'Git Pushes', width: 30, key: 'gitPushes' },
]);

console.log('\n\x1b[36m━━━ TOKEN CONSUMPTION ━━━\x1b[0m');
const byTokens = [...sessions].sort((a, b) => b.totalTokens - a.totalTokens);
printTable(byTokens, [
  { label: 'Started',    width: 14, key: 'started' },
  { label: 'Project',    width: 35, key: 'project' },
  { label: 'Input',      width: 10, get: r => fmtN(r.inputTokens) },
  { label: 'Output',     width: 10, get: r => fmtN(r.outputTokens) },
  { label: 'CacheWrite', width: 12, get: r => fmtN(r.cacheCreate) },
  { label: 'CacheRead',  width: 12, get: r => fmtN(r.cacheRead) },
  { label: 'Total',      width: 12, get: r => fmtN(r.totalTokens) },
]);

const sumIn    = sessions.reduce((s, r) => s + r.inputTokens,  0);
const sumOut   = sessions.reduce((s, r) => s + r.outputTokens, 0);
const sumCC    = sessions.reduce((s, r) => s + r.cacheCreate,  0);
const sumCR    = sessions.reduce((s, r) => s + r.cacheRead,    0);
const sumTotal = sessions.reduce((s, r) => s + r.totalTokens,  0);
console.log(`\n  Sessions   : ${sessions.length}`);
console.log(`  Input      : ${fmtN(sumIn)} tokens`);
console.log(`  Output     : ${fmtN(sumOut)} tokens`);
console.log(`  Cache write: ${fmtN(sumCC)} tokens`);
console.log(`  Cache read : ${fmtN(sumCR)} tokens`);
console.log(`\x1b[33m  GRAND TOTAL: ${fmtN(sumTotal)} tokens\x1b[0m`);

const pushSessions = sessions.filter(s => s.gitPushes);
console.log('\n\x1b[36m━━━ GIT PUSHES DETECTED ━━━\x1b[0m');
if (!pushSessions.length) {
  console.log('  No git push operations found in session transcripts.');
} else {
  printTable(pushSessions, [
    { label: 'Started',    width: 14, key: 'started' },
    { label: 'Project',    width: 35, key: 'project' },
    { label: 'Branch',     width: 14, key: 'gitBranch' },
    { label: 'Push',       width: 40, key: 'gitPushes' },
  ]);
}

// ── CSV export ────────────────────────────────────────────────────────────────
if (csvOut) {
  const headers = ['project','started','ended','theme','model','gitBranch','gitPushes','inputTokens','outputTokens','cacheCreate','cacheRead','totalTokens','fileSizeKB'];
  const rows = sessions.map(s => headers.map(h => `"${String(s[h] ?? '').replace(/"/g, '""')}"`).join(','));
  fs.writeFileSync(csvOut, [headers.join(','), ...rows].join('\n'), 'utf-8');
  console.log(`\n\x1b[32mExported ${sessions.length} rows → ${csvOut}\x1b[0m`);
}
