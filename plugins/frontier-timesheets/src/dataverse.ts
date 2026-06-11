import { getAccessToken } from './auth.js';
import { Config } from './config.js';

export interface Project {
  id: string;
  name: string;
}

export interface ProjectTask {
  id: string;
  name: string;
  projectId: string;
}

export interface ResourceCategory {
  id: string;
  name: string;
}

export interface TimeEntry {
  id: string;
  date: string;
  durationMinutes: number;
  type: number;
  typeName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  roleId?: string;
  roleName?: string;
  description?: string;
  status: string;
}

export interface TimeEntryType {
  value: number;
  label: string;
}

export class DataverseClient {
  private baseUrl: string;
  private config: Config;
  private tokenPromise: Promise<string> | null = null;

  constructor(config: Config) {
    this.config = config;
    this.baseUrl = `${config.dataverseUrl}/api/data/v9.2`;
  }

  private async getToken(): Promise<string> {
    if (!this.tokenPromise) {
      this.tokenPromise = getAccessToken(
        this.config.tenantId,
        this.config.clientId,
        [`${this.config.dataverseUrl}/user_impersonation`],
      );
    }
    return this.tokenPromise;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Dataverse API error ${response.status}: ${body}`);
    }

    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  }

  async listProjects(search?: string): Promise<Project[]> {
    const filter = [
      'statecode eq 0',
      search ? `contains(msdyn_subject,'${search.replace(/'/g, "''")}')` : '',
    ]
      .filter(Boolean)
      .join(' and ');

    const data = await this.fetch<{ value: Array<Record<string, string>> }>(
      `/msdyn_projects?$select=msdyn_projectid,msdyn_subject&$filter=${filter}&$orderby=msdyn_subject asc&$top=50`
    );
    return data.value.map((p) => ({ id: p.msdyn_projectid, name: p.msdyn_subject }));
  }

  async listProjectTasks(projectId: string): Promise<ProjectTask[]> {
    const data = await this.fetch<{ value: Array<Record<string, string>> }>(
      `/msdyn_projecttasks?$select=msdyn_projecttaskid,msdyn_subject,_msdyn_project_value` +
        `&$filter=_msdyn_project_value eq '${projectId}' and statecode eq 0` +
        `&$orderby=msdyn_subject asc`
    );
    return data.value.map((t) => ({
      id: t.msdyn_projecttaskid,
      name: t.msdyn_subject,
      projectId: t._msdyn_project_value,
    }));
  }

  async listRoles(): Promise<ResourceCategory[]> {
    const data = await this.fetch<{ value: Array<Record<string, string>> }>(
      `/msdyn_resourcecategories?$select=msdyn_resourcecategoryid,msdyn_name&$filter=statecode eq 0&$orderby=msdyn_name asc`
    );
    return data.value.map((r) => ({
      id: r.msdyn_resourcecategoryid,
      name: r.msdyn_name,
    }));
  }

  async getTimeEntryTypes(): Promise<TimeEntryType[]> {
    const data = await this.fetch<{ OptionSet: { Options: Array<{ Value: number; Label: { UserLocalizedLabel: { Label: string } } }> } }>(
      `/EntityDefinitions(LogicalName='msdyn_timeentry')/Attributes(LogicalName='msdyn_type')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata/OptionSet?$select=Options`
    );
    return data.OptionSet.Options.map((o) => ({
      value: o.Value,
      label: o.Label.UserLocalizedLabel.Label,
    }));
  }

  async getTimeEntries(startDate: string, endDate: string): Promise<TimeEntry[]> {
    const data = await this.fetch<{ value: Array<Record<string, string>> }>(
      `/msdyn_timeentries` +
        `?$select=msdyn_timeentryid,msdyn_date,msdyn_duration,msdyn_type,msdyn_description,msdyn_entrystatus` +
        `&$expand=msdyn_project($select=msdyn_subject),msdyn_projecttask($select=msdyn_subject),msdyn_resourcecategory($select=msdyn_name)` +
        `&$filter=msdyn_date ge ${startDate} and msdyn_date le ${endDate}` +
        `&$orderby=msdyn_date asc`
    );

    return data.value.map((e) => ({
      id: e.msdyn_timeentryid,
      date: e.msdyn_date?.substring(0, 10) ?? '',
      durationMinutes: parseInt(e.msdyn_duration ?? '0', 10),
      type: parseInt(e.msdyn_type ?? '0', 10),
      typeName: (e['msdyn_type@OData.Community.Display.V1.FormattedValue'] as string) ?? '',
      projectId: (e as unknown as Record<string, Record<string, string>>).msdyn_project?.msdyn_projectid ?? '',
      projectName: (e as unknown as Record<string, Record<string, string>>).msdyn_project?.msdyn_subject ?? '',
      taskId: (e as unknown as Record<string, Record<string, string>>).msdyn_projecttask?.msdyn_projecttaskid ?? '',
      taskName: (e as unknown as Record<string, Record<string, string>>).msdyn_projecttask?.msdyn_subject ?? '',
      roleId: (e as unknown as Record<string, Record<string, string>>).msdyn_resourcecategory?.msdyn_resourcecategoryid,
      roleName: (e as unknown as Record<string, Record<string, string>>).msdyn_resourcecategory?.msdyn_name,
      description: e.msdyn_description ?? e.exg_description ?? '',
      status: (e['msdyn_entrystatus@OData.Community.Display.V1.FormattedValue'] as string) ?? '',
    }));
  }

  async createTimeEntry(params: {
    date: string;
    durationMinutes: number;
    projectId: string;
    projectTaskId: string;
    typeValue: number;
    roleId?: string;
    description?: string;
  }): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      msdyn_date: params.date,
      msdyn_duration: params.durationMinutes,
      msdyn_type: params.typeValue,
      'msdyn_project@odata.bind': `/msdyn_projects(${params.projectId})`,
      'msdyn_projecttask@odata.bind': `/msdyn_projecttasks(${params.projectTaskId})`,
    };

    if (params.description) {
      body.msdyn_description = params.description;
      body.exg_description = params.description;
    }

    if (params.roleId) {
      body['msdyn_resourcecategory@odata.bind'] = `/msdyn_resourcecategories(${params.roleId})`;
    }

    const response = await fetch(`${this.baseUrl}/msdyn_timeentries`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${await this.getToken()}`,
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Failed to create time entry: ${response.status} ${errBody}`);
    }

    const created = (await response.json()) as Record<string, string>;
    return { id: created.msdyn_timeentryid };
  }

  async deleteTimeEntry(timeEntryId: string): Promise<void> {
    await this.fetch(`/msdyn_timeentries(${timeEntryId})`, { method: 'DELETE' });
  }
}
