import { db, type DexieProject, type ProjectStatus, type ProjectColor } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getStoredUser } from '../auth';
import { operationsLog } from '../OperationsLog';
import { opLogWriter } from '../sync/OpLogWriter';

/* ── Re-export types from db ────────────────────────────── */
export type { ProjectStatus, ProjectColor };
export type Project = DexieProject;

export interface CreateProjectData {
  name: string;
  description?: string;
  status?: ProjectStatus;
  color?: ProjectColor;
  prefix?: string;
  repoUrl?: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  color?: ProjectColor;
  prefix?: string;
  repoUrl?: string;
}

/* ── helpers ────────────────────────────────────────────── */
function derivePrefix(name: string): string {
  return name
    .split(/[\s\-_]+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4) || 'PROJ';
}

/* ── CRUD ───────────────────────────────────────────────── */
export const createProject = async (data: CreateProjectData): Promise<Project> => {
  const user = await getStoredUser();
  const project: DexieProject = {
    id: uuidv4(),
    name: data.name,
    description: data.description,
    status: data.status || 'Active',
    color: data.color || 'blue',
    prefix: data.prefix || derivePrefix(data.name),
    repoUrl: data.repoUrl,
    createdBy: user?.id || '',
    _deleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    await db.projects.put(project);
    await opLogWriter.recordCreate('projects', project.id, project as unknown as Record<string, unknown>);
    await operationsLog.log({ category: 'PROJECT', action: 'CREATE', result: 'success', target: 'Project', targetId: project.id, details: { name: data.name } });
    return project;
  } catch (err: any) {
    await operationsLog.log({ category: 'PROJECT', action: 'CREATE', result: 'failure', target: 'Project', errorMessage: err?.message, details: { name: data.name } });
    throw err;
  }
};

export const getProjects = async (): Promise<Project[]> => {
  return db.projects.filter(p => !p._deleted).toArray();
};

export const getProject = async (id: string): Promise<Project | undefined> => {
  const p = await db.projects.get(id);
  return p && !p._deleted ? p : undefined;
};

export const updateProject = async (id: string, data: UpdateProjectData): Promise<Project | undefined> => {
  const existing = await db.projects.get(id);
  if (!existing) return undefined;
  try {
    await db.projects.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    await opLogWriter.recordUpdate('projects', id, { ...data, updatedAt: new Date().toISOString() });
    await operationsLog.log({ category: 'PROJECT', action: 'UPDATE', result: 'success', target: 'Project', targetId: id, details: { fields: Object.keys(data) } });
    return db.projects.get(id);
  } catch (err: any) {
    await operationsLog.log({ category: 'PROJECT', action: 'UPDATE', result: 'failure', target: 'Project', targetId: id, errorMessage: err?.message });
    throw err;
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  try {
    // Un-assign tickets from this project (projectId is not indexed, so use filter)
    const tickets = await db.tickets.filter(t => t.projectId === id).toArray();
    for (const t of tickets) {
      await db.tickets.update(t.id, { projectId: undefined, projectName: undefined } as any);
    }
    // Always soft-delete — op-log sync handles propagation
    const existing = await db.projects.get(id);
    if (existing) {
      await db.projects.update(id, {
        _deleted: true,
        updatedAt: new Date().toISOString(),
      });
      await opLogWriter.recordDelete('projects', id);
    }
    await operationsLog.log({ category: 'PROJECT', action: 'DELETE', result: 'success', target: 'Project', targetId: id });
  } catch (err: any) {
    await operationsLog.log({ category: 'PROJECT', action: 'DELETE', result: 'failure', target: 'Project', targetId: id, errorMessage: err?.message });
    throw err;
  }
};

/* ── ticket ↔ project helpers ───────────────────────────── */
export const assignTicketToProject = async (ticketId: string, projectId: string): Promise<void> => {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Project not found');
  const ticket = await db.tickets.get(ticketId) as any;
  const isTimehuddle = ticket?.source === 'timehuddle';
  const updates = {
    projectId,
    projectName: project.name,
    updatedAt: new Date().toISOString(),
  };
  await db.tickets.update(ticketId, updates as any);
  await opLogWriter.recordUpdate('tickets', ticketId, updates, { syncEnabled: !isTimehuddle });
  await operationsLog.log({ category: 'TICKET', action: 'ASSIGN', result: 'success', target: 'Ticket', targetId: ticketId, details: { projectId, projectName: project.name } });
};

export const removeTicketFromProject = async (ticketId: string): Promise<void> => {
  const ticket = await db.tickets.get(ticketId) as any;
  const isTimehuddle = ticket?.source === 'timehuddle';
  const updates = {
    projectId: undefined,
    projectName: undefined,
    updatedAt: new Date().toISOString(),
  };
  await db.tickets.update(ticketId, updates as any);
  await opLogWriter.recordUpdate('tickets', ticketId, updates, { syncEnabled: !isTimehuddle });
  await operationsLog.log({ category: 'TICKET', action: 'UNASSIGN', result: 'success', target: 'Ticket', targetId: ticketId });
};

export const getProjectTickets = async (projectId: string) => {
  return db.tickets.filter((t) => (t as any).projectId === projectId && !(t as any)._deleted).toArray();
};

export const getUnassignedTickets = async () => {
  return db.tickets.filter((t) => !(t as any).projectId && !(t as any)._deleted).toArray();
};
