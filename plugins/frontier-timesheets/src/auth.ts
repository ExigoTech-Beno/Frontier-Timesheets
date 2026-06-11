import * as msal from '@azure/msal-node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CACHE_DIR  = path.join(os.homedir(), '.frontier-timesheets');
const CACHE_FILE = path.join(CACHE_DIR, 'token-cache.json');

function loadCache(): string {
  try { return fs.readFileSync(CACHE_FILE, 'utf-8'); } catch { return ''; }
}

function saveCache(data: string): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, data, { mode: 0o600 });
}

// One PCA per (tenantId + clientId) — shared across all scope requests so
// MSAL's internal cache deduplicate tokens correctly.
const pcaCache = new Map<string, msal.PublicClientApplication>();

function getPca(tenantId: string, clientId: string): msal.PublicClientApplication {
  const key = `${tenantId}:${clientId}`;
  if (!pcaCache.has(key)) {
    const cachePlugin: msal.ICachePlugin = {
      beforeCacheAccess: async (ctx) => { ctx.tokenCache.deserialize(loadCache()); },
      afterCacheAccess:  async (ctx) => { if (ctx.cacheHasChanged) saveCache(ctx.tokenCache.serialize()); },
    };
    pcaCache.set(key, new msal.PublicClientApplication({
      auth: { clientId, authority: `https://login.microsoftonline.com/${tenantId}` },
      cache: { cachePlugin },
    }));
  }
  return pcaCache.get(key)!;
}

/**
 * Acquire an access token for the given scopes using device code flow with
 * silent refresh from the persistent cache. Throws if auth fails.
 */
export async function getAccessToken(
  tenantId: string,
  clientId: string,
  scopes: string[],
): Promise<string> {
  const pca = getPca(tenantId, clientId);

  // Try silent auth from cached accounts first
  const accounts = await pca.getTokenCache().getAllAccounts();
  for (const account of accounts) {
    try {
      const result = await pca.acquireTokenSilent({ scopes, account });
      if (result?.accessToken) return result.accessToken;
    } catch {
      // Token expired or missing for this scope — fall through to device code
    }
  }

  // Interactive device code flow (prints to stderr to avoid corrupting MCP JSON-RPC on stdout)
  const result = await pca.acquireTokenByDeviceCode({
    scopes,
    deviceCodeCallback: (response) => {
      process.stderr.write('\n' + response.message + '\n\n');
    },
  });

  if (!result?.accessToken) throw new Error('Authentication failed: no access token returned.');
  return result.accessToken;
}
