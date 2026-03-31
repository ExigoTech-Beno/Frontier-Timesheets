export interface Config {
  dataverseUrl: string;
  tenantId: string;
  clientId: string;
}

export function loadConfig(): Config {
  const dataverseUrl = process.env.DATAVERSE_URL?.replace(/\/$/, '');
  const tenantId = process.env.D365_TENANT_ID;
  const clientId = process.env.D365_CLIENT_ID;

  const missing: string[] = [];
  if (!dataverseUrl) missing.push('DATAVERSE_URL');
  if (!tenantId) missing.push('D365_TENANT_ID');
  if (!clientId) missing.push('D365_CLIENT_ID');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}.\n` +
      `Copy .env.example to .env and fill in your values, then set them in your environment.`
    );
  }

  return { dataverseUrl: dataverseUrl!, tenantId: tenantId!, clientId: clientId! };
}
