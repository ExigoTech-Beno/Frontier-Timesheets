import * as msal from '@azure/msal-node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CACHE_DIR = path.join(os.homedir(), '.frontier-timesheets');
const CACHE_FILE = path.join(CACHE_DIR, 'token-cache.json');

function loadCache(): string {
  try {
    return fs.readFileSync(CACHE_FILE, 'utf-8');
  } catch {
    return '';
  }
}

function saveCache(data: string): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, data, { mode: 0o600 });
}

export async function getAccessToken(
  tenantId: string,
  clientId: string,
  dataverseUrl: string
): Promise<string> {
  const cachePlugin: msal.ICachePlugin = {
    beforeCacheAccess: async (ctx) => {
      ctx.tokenCache.deserialize(loadCache());
    },
    afterCacheAccess: async (ctx) => {
      if (ctx.cacheHasChanged) {
        saveCache(ctx.tokenCache.serialize());
      }
    },
  };

  const pca = new msal.PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    cache: { cachePlugin },
  });

  const scopes = [`${dataverseUrl}/user_impersonation`];

  // Try silent auth from cache first
  const accounts = await pca.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    try {
      const silentResult = await pca.acquireTokenSilent({
        scopes,
        account: accounts[0],
      });
      if (silentResult?.accessToken) {
        return silentResult.accessToken;
      }
    } catch {
      // Fall through to device code flow
    }
  }

  // Interactive device code flow
  const result = await pca.acquireTokenByDeviceCode({
    scopes,
    deviceCodeCallback: (response) => {
      // Print to stderr so it doesn't interfere with MCP JSON-RPC on stdout
      process.stderr.write('\n' + response.message + '\n\n');
    },
  });

  if (!result?.accessToken) {
    throw new Error('Authentication failed: no access token returned.');
  }
  return result.accessToken;
}
