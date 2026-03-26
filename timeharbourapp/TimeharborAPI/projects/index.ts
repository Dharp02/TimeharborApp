import { db, type DexieProject, type ProjectStatus, type ProjectColor } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getStoredUser } from '../auth';

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
    _dirty: 1,
    _rev: 1,
    _deleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.projects.put(project);
  return project;
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
  await db.projects.update(id, {
    ...data,
    _dirty: 1,
    _rev: (existing._rev ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  });
  return db.projects.get(id);
};

export const deleteProject = async (id: string): Promise<void> => {
  // Un-assign tickets from this project
  const tickets = await db.tickets.where('projectId').equals(id).toArray();
  for (const t of tickets) {
    await db.tickets.update(t.id, { projectId: undefined, projectName: undefined } as any);
  }
  // Soft-delete for sync
  const existing = await db.projects.get(id);
  if (existing) {
    await db.projects.update(id, {
      _deleted: true,
      _dirty: 1,
      _rev: (existing._rev ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    });
  }
};

/* ── ticket ↔ project helpers ───────────────────────────── */
export const assignTicketToProject = async (ticketId: string, projectId: string): Promise<void> => {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Project not found');
  await db.tickets.update(ticketId, {
    projectId,
    projectName: project.name,
    _dirty: 1,
    updatedAt: new Date().toISOString(),
  } as any);
};

export const removeTicketFromProject = async (ticketId: string): Promise<void> => {
  await db.tickets.update(ticketId, {
    projectId: undefined,
    projectName: undefined,
    _dirty: 1,
    updatedAt: new Date().toISOString(),
  } as any);
};

export const getProjectTickets = async (projectId: string) => {
  return db.tickets.filter((t) => (t as any).projectId === projectId && !(t as any)._deleted).toArray();
};

export const getUnassignedTickets = async () => {
  return db.tickets.filter((t) => !(t as any).projectId && !(t as any)._deleted).toArray();
};
