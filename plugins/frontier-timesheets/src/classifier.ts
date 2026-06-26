/**
 * Activity categories for time reporting.
 * Used to bucket signals into high-level time categories.
 */
export type ActivityCategory =
  | 'project'      // Named client / engagement work
  | 'microsoft'    // Microsoft 365 tools used in work context
  | 'learning'     // Formal learning platforms, courses, tutorials
  | 'development'  // Dev tools, package docs, Stack Overflow
  | 'research'     // Reading, articles, exploration
  | 'personal'     // Social media, news, entertainment
  | 'ai-tools'     // AI assistants and tools
  | 'other';       // Unclassified

export interface ProjectDef {
  name:        string;
  color:       string;
  category:    ActivityCategory;
  urlPatterns?: string[];
  repos?:       string[];
  keywords?:    string[];
}

// Order matters — first match wins.
export const PROJECTS: ProjectDef[] = [

  // ── Client / Engagement work ───────────────────────────────────────────────
  { name: 'BC SmartStart SoW',      category: 'project', color: '#4c48e3', repos: ['BC-SmartStartSoW', 'bc-smartstart'],   urlPatterns: ['bc-smartstart', 'bcsmartstart'],  keywords: ['BC SmartStart', 'SmartStart'] },
  { name: 'CCC FabricIQ',           category: 'project', color: '#0ea5e9', repos: ['CCC-Fabric-IQ', 'CCC FabricIQ'],       urlPatterns: ['ccc-fabric'],                     keywords: ['CCC', 'Central Coast', 'FabricIQ'] },
  { name: 'CCC TechOne Review',     category: 'project', color: '#06b6d4', repos: ['CCC-TechOne-Review'],                   keywords: ['TechOne', 'BridgeIQ'] },
  { name: 'Teams Discovery Agent',  category: 'project', color: '#7c3aed', repos: ['Teams-Discovery-Agent'],                keywords: ['Teams Discovery', 'Discovery Agent'] },
  { name: 'Purview4Edge',           category: 'project', color: '#ef4444', repos: ['Purview4Edge'],                         keywords: ['Purview', 'DLP Edge', 'PII4Edge'] },
  { name: 'StrataIQ',               category: 'project', color: '#10b981', repos: ['StrataIQ'],                             keywords: ['StrataIQ', 'Strata'] },
  { name: 'BoyceIQ',                category: 'project', color: '#f59e0b', repos: ['BoyceIQ'],                              keywords: ['BoyceIQ', 'Boyce'] },
  { name: 'BusinessIQ',             category: 'project', color: '#f97316', repos: ['BusinessIQ'],                           keywords: ['BusinessIQ'] },
  { name: 'NSWPolicyAgent',         category: 'project', color: '#16a34a', repos: ['NSWPolicyAgent'],                       keywords: ['NSW Policy', 'LGA Policy'] },
  { name: 'LG Professionals',       category: 'project', color: '#16a34a', repos: ['lgp-whiteboard', 'VibeSubmissions'],    keywords: ['LG Professionals', 'LGP'] },
  { name: 'KlaviyoStrategy',        category: 'project', color: '#e879f9', repos: ['KlaviyoStrategy'],                      keywords: ['Klaviyo'] },
  { name: 'Frontier Timesheets',    category: 'project', color: '#ec4899', repos: ['Frontier-Timesheets'],                  keywords: ['Frontier Timesheets', 'timesheet'] },

  // ── AI assistants & tools (before broad Microsoft catch-all) ──────────────
  { name: 'AI Tools',               category: 'ai-tools', color: '#06b6d4', urlPatterns: ['claude.ai', 'anthropic.com', 'openai.com', 'chat.openai.com', 'copilot.microsoft.com', 'gemini.google.com', 'bard.google.com', 'perplexity.ai', 'mistral.ai', 'huggingface.co'] },

  // ── Microsoft work tools ───────────────────────────────────────────────────
  // More-specific patterns first, broad microsoft.com catch-all last.
  { name: 'Microsoft Fabric',       category: 'microsoft', color: '#0078d4', urlPatterns: ['fabric.microsoft.com', 'app.fabric.microsoft.com'] },
  { name: 'Power BI',               category: 'microsoft', color: '#f2c811', urlPatterns: ['app.powerbi.com', 'powerbi.com'] },
  { name: 'Power Platform',         category: 'microsoft', color: '#742774', urlPatterns: ['make.powerapps.com', 'make.powerautomate.com', 'flow.microsoft.com', 'powerapps.com', 'powerautomate.com', 'powervirtualagents.microsoft.com'] },
  { name: 'Azure Portal',           category: 'microsoft', color: '#0072c6', urlPatterns: ['portal.azure.com', 'ms.portal.azure.com'] },
  { name: 'Azure DevOps',           category: 'microsoft', color: '#0078d4', urlPatterns: ['dev.azure.com', 'visualstudio.com'] },
  { name: 'D365 / Dynamics',        category: 'microsoft', color: '#d97706', urlPatterns: ['dynamics.com', 'crm.dynamics', 'crm6.dynamics'] },
  { name: 'Microsoft Teams',        category: 'microsoft', color: '#6264a7', urlPatterns: ['teams.microsoft.com', 'teams.live.com'] },
  { name: 'Outlook',                category: 'microsoft', color: '#0078d4', urlPatterns: ['outlook.office.com', 'outlook.office365.com', 'outlook.live.com'] },
  { name: 'OneDrive / SharePoint',  category: 'microsoft', color: '#2563eb', urlPatterns: ['sharepoint.com', 'onedrive.live.com', '1drv.ms'] },
  { name: 'Microsoft 365',          category: 'microsoft', color: '#d83b01', urlPatterns: ['office.com', 'm365.cloud.microsoft', 'microsoft365.com'] },
  { name: 'Microsoft Admin',        category: 'microsoft', color: '#0078d4', urlPatterns: ['admin.microsoft.com', 'compliance.microsoft.com', 'security.microsoft.com', 'endpoint.microsoft.com', 'intune.microsoft.com', 'entra.microsoft.com', 'purview.microsoft.com'] },
  { name: 'Microsoft Docs',         category: 'learning',  color: '#0078d4', urlPatterns: ['learn.microsoft.com', 'docs.microsoft.com'] },
  { name: 'Microsoft',              category: 'microsoft', color: '#0078d4', urlPatterns: ['microsoft.com'] },

  // ── GitHub & source control ────────────────────────────────────────────────
  { name: 'GitHub',                 category: 'development', color: '#1f2937', urlPatterns: ['github.com', 'github.dev'] },

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  { name: 'LinkedIn Live',          category: 'project',  color: '#0077b5', urlPatterns: ['linkedin.com/live'], keywords: ['LinkedIn Live', 'Substack'] },
  { name: 'LinkedIn',               category: 'personal', color: '#0077b5', urlPatterns: ['linkedin.com'] },

  // ── Learning platforms ────────────────────────────────────────────────────
  { name: 'Learning',               category: 'learning', color: '#f59e0b', urlPatterns: [
    'udemy.com', 'coursera.org', 'pluralsight.com', 'linkedin.com/learning',
    'skillshare.com', 'edx.org', 'khanacademy.org', 'codecademy.com',
    'app.pluralsight.com', 'cloudskillsboost.google', 'acloudguru.com', 'a.cl.ly',
    'trailhead.salesforce.com', 'learn.hashicorp.com',
  ]},

  // ── Development tools & references ───────────────────────────────────────
  { name: 'Stack Overflow',         category: 'development', color: '#f48024', urlPatterns: ['stackoverflow.com', 'stackexchange.com'] },
  { name: 'Dev Tools / Docs',       category: 'development', color: '#10b981', urlPatterns: [
    'npmjs.com', 'pypi.org', 'nuget.org', 'crates.io', 'pkg.go.dev',
    'developer.mozilla.org', 'mdn', 'devdocs.io',
    'registry.terraform.io', 'developer.apple.com',
    'developer.android.com', 'react.dev', 'vuejs.org', 'angular.io',
    'nextjs.org', 'tailwindcss.com', 'mui.com', 'radix-ui.com',
    'docker.com', 'kubernetes.io', 'helm.sh',
    'jira.', 'confluence.', 'atlassian.com',
    'vercel.com', 'netlify.com', 'render.com', 'railway.app',
    'supabase.com', 'neon.tech', 'planetscale.com',
    'postman.com', 'insomnia.rest',
    'localhost', '127.0.0.1', '0.0.0.0',
  ]},

  // ── Research & reading ────────────────────────────────────────────────────
  { name: 'Research / Articles',    category: 'research', color: '#8b5cf6', urlPatterns: [
    'medium.com', 'dev.to', 'hashnode.com', 'substack.com',
    'arxiv.org', 'papers.with.code', 'semanticscholar.org',
    'towardsdatascience.com', 'thenewstack.io', 'infoq.com',
    'techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com',
    'hbr.org', 'blog.', 'newsletter.',
    'hackernews', 'news.ycombinator.com',
  ]},
  { name: 'Google / Search',        category: 'research', color: '#4285f4', urlPatterns: ['google.com/search', 'google.com.au/search', 'bing.com/search', 'duckduckgo.com'] },

  // ── Personal / Social ─────────────────────────────────────────────────────
  { name: 'Social Media',           category: 'personal', color: '#ec4899', urlPatterns: [
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'tiktok.com', 'snapchat.com', 'pinterest.com', 'threads.net',
  ]},
  { name: 'Reddit',                 category: 'personal', color: '#ff4500', urlPatterns: ['reddit.com'] },
  { name: 'YouTube',                category: 'personal', color: '#ff0000', urlPatterns: ['youtube.com', 'youtu.be'] },
  { name: 'Entertainment',          category: 'personal', color: '#dc2626', urlPatterns: [
    'netflix.com', 'primevideo.com', 'disneyplus.com', 'hbomax.com',
    'max.com', 'spotify.com', 'twitch.tv', 'soundcloud.com',
  ]},
  { name: 'News',                   category: 'personal', color: '#64748b', urlPatterns: [
    'news.com.au', 'abc.net.au', 'smh.com.au', 'theaustralian.com.au',
    'bbc.com', 'bbc.co.uk', 'nytimes.com', 'theguardian.com',
    'reuters.com', 'apnews.com', 'bloomberg.com', 'wsj.com',
    'afr.com', 'sbs.com.au', '9news.com.au', '7news.com.au',
  ]},
  { name: 'Shopping',               category: 'personal', color: '#f97316', urlPatterns: [
    'amazon.com', 'amazon.com.au', 'ebay.com', 'ebay.com.au',
    'etsy.com', 'shopify.com', 'catch.com.au', 'kogan.com',
  ]},

  // ── Marketing / admin ─────────────────────────────────────────────────────
  { name: 'Marketing Merch',        category: 'project',  color: '#f43f5e', keywords: ['merch', 'marketing merch'] },
  { name: 'System / OS',            category: 'other',    color: '#9ca3af', keywords: ['hibernate', 'hibernat', 'sleep', 'power settings', 'windows settings'] },
];

export const CATEGORY_META: Record<ActivityCategory, { label: string; color: string; icon: string }> = {
  'project':     { label: 'Project Work',   color: '#4c48e3', icon: '🏗' },
  'microsoft':   { label: 'Microsoft 365',  color: '#0078d4', icon: '🪟' },
  'learning':    { label: 'Learning',       color: '#f59e0b', icon: '📚' },
  'development': { label: 'Development',    color: '#10b981', icon: '💻' },
  'research':    { label: 'Research',       color: '#8b5cf6', icon: '🔍' },
  'personal':    { label: 'Personal',       color: '#ec4899', icon: '🏠' },
  'ai-tools':    { label: 'AI Tools',       color: '#06b6d4', icon: '🤖' },
  'other':       { label: 'Other',          color: '#9ca3af', icon: '📌' },
};

const RESEARCH_OTHER: ProjectDef = { name: 'Research / Other', category: 'research', color: '#d1d5db' };

function includes(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some(n => h.includes(n.toLowerCase()));
}

export function classifyUrl(url: string, title: string): ProjectDef {
  const text = `${url} ${title}`;
  for (const p of PROJECTS) {
    if (p.urlPatterns && includes(url,  p.urlPatterns)) return p;
    if (p.keywords    && includes(text, p.keywords))    return p;
  }
  return RESEARCH_OTHER;
}

export function classifyRepo(repoFullName: string): ProjectDef {
  const name = repoFullName.split('/').pop() ?? repoFullName;
  for (const p of PROJECTS) {
    if (p.repos?.some(r => r.toLowerCase() === name.toLowerCase())) return p;
    if (p.keywords && includes(name, p.keywords)) return p;
  }
  return { name: 'GitHub', category: 'development', color: '#1f2937' };
}

export function classifySession(projectFolder: string, title: string): ProjectDef {
  const text = `${projectFolder} ${title}`;
  for (const p of PROJECTS) {
    if (p.repos    && includes(text, p.repos))    return p;
    if (p.keywords && includes(text, p.keywords)) return p;
  }
  return RESEARCH_OTHER;
}
