import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getStoredUser } from '../auth';

/* ── types ──────────────────────────────────────────────── */
export type ProjectStatus = 'Active' | 'On Hold' | 'Completed' | 'Archived';
export type ProjectColor =
  | 'blue' | 'green' | 'purple' | 'orange' | 'red'
  | 'teal' | 'pink' | 'yellow' | 'indigo' | 'gray';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  color: ProjectColor;
  prefix: string;          // e.g. "TH" – short key for ticket references
  repoUrl?: string;        // optional link to the code repository
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

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
  const project: Project = {
    id: uuidv4(),
    name: data.name,
    description: data.description,
    status: data.status || 'Active',
    color: data.color || 'blue',
    prefix: data.prefix || derivePrefix(data.name),
    repoUrl: data.repoUrl,
    createdBy: user?.id || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.projects.put(project);
  return project;
};

export const getProjects = async (): Promise<Project[]> => {
  return db.projects.toArray();
};

export const getProject = async (id: string): Promise<Project | undefined> => {
  return db.projects.get(id);
};

export const updateProject = async (id: string, data: UpdateProjectData): Promise<Project | undefined> => {
  await db.projects.update(id, { ...data, updatedAt: new Date().toISOString() });
  return db.projects.get(id);
};

export const deleteProject = async (id: string): Promise<void> => {
  // Un-assign tickets from this project
  const tickets = await db.tickets.where('projectId').equals(id).toArray();
  for (const t of tickets) {
    await db.tickets.update(t.id, { projectId: undefined, projectName: undefined });
  }
  await db.projects.delete(id);
};

/* ── ticket ↔ project helpers ───────────────────────────── */
export const assignTicketToProject = async (ticketId: string, projectId: string): Promise<void> => {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Project not found');
  await db.tickets.update(ticketId, {
    projectId,
    projectName: project.name,
    updatedAt: new Date().toISOString(),
  });
};

export const removeTicketFromProject = async (ticketId: string): Promise<void> => {
  await db.tickets.update(ticketId, {
    projectId: undefined,
    projectName: undefined,
    updatedAt: new Date().toISOString(),
  });
};

export const getProjectTickets = async (projectId: string) => {
  return db.tickets.filter((t) => (t as any).projectId === projectId).toArray();
};

export const getUnassignedTickets = async () => {
  return db.tickets.filter((t) => !(t as any).projectId).toArray();
};
