'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FolderOpen,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Ticket,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Badge,
  Card,
  CardContent,
  Text,
  SmallMuted,
  Select,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '@mieweb/ui';
import { Modal } from '@/components/ui/Modal';
import {
  createProject,
  getProjects,
  updateProject,
  deleteProject,
  assignTicketToProject,
  removeTicketFromProject,
  getProjectTickets,
  getUnassignedTickets,
  type Project,
  type ProjectStatus,
  type ProjectColor,
  type CreateProjectData,
} from '@/TimeharborAPI/projects';
import { type Ticket as TicketType } from '@/TimeharborAPI/tickets';
import './projects.scss';

/* ── constants ──────────────────────────────────────────── */
const COLORS: ProjectColor[] = [
  'blue', 'green', 'purple', 'orange', 'red',
  'teal', 'pink', 'yellow', 'indigo', 'gray',
];

const COLOR_HEX: Record<ProjectColor, string> = {
  blue: '#27aae1', green: '#22c55e', purple: '#8b5cf6', orange: '#f97316',
  red: '#ef4444', teal: '#14b8a6', pink: '#ec4899', yellow: '#eab308',
  indigo: '#6366f1', gray: '#6b7280',
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Archived', label: 'Archived' },
];

const statusBadgeVariant = (s: ProjectStatus) => {
  switch (s) {
    case 'Active':    return 'success' as const;
    case 'On Hold':   return 'warning' as const;
    case 'Completed': return 'default' as const;
    case 'Archived':  return 'secondary' as const;
  }
};

/* ── component ──────────────────────────────────────────── */
export default function ProjectsPage() {
  /* data state */
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  /* create / edit modal */
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState<ProjectColor>('blue');
  const [formPrefix, setFormPrefix] = useState('');
  const [formRepo, setFormRepo] = useState('');
  const [formStatus, setFormStatus] = useState<ProjectStatus>('Active');
  const [isSaving, setIsSaving] = useState(false);

  /* delete confirmation */
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  /* expanded project (shows tickets) */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [projectTickets, setProjectTickets] = useState<TicketType[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  /* move ticket modal */
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [moveTargetProject, setMoveTargetProject] = useState<string>('');
  const [unassignedTickets, setUnassignedTickets] = useState<TicketType[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);

  /* ── load projects ────────────────────────────────────── */
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();

    const handleSyncComplete = () => loadProjects();
    window.addEventListener('sync-complete', handleSyncComplete);
    return () => window.removeEventListener('sync-complete', handleSyncComplete);
  }, [loadProjects]);

  /* ── filter & search ──────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = projects;
    if (statusFilter !== 'All') {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.prefix.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [projects, statusFilter, searchQuery]);

  /* ── form helpers ─────────────────────────────────────── */
  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormColor('blue');
    setFormPrefix('');
    setFormRepo('');
    setFormStatus('Active');
    setEditingProject(null);
  };

  const openCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setFormName(p.name);
    setFormDesc(p.description || '');
    setFormColor(p.color);
    setFormPrefix(p.prefix);
    setFormRepo(p.repoUrl || '');
    setFormStatus(p.status);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setIsSaving(true);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          color: formColor,
          prefix: formPrefix.trim().toUpperCase() || undefined,
          repoUrl: formRepo.trim() || undefined,
          status: formStatus,
        });
      } else {
        const data: CreateProjectData = {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          color: formColor,
          prefix: formPrefix.trim().toUpperCase() || undefined,
          repoUrl: formRepo.trim() || undefined,
          status: formStatus,
        };
        await createProject(data);
      }
      await loadProjects();
      setIsFormOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save project:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id);
      await loadProjects();
      if (expandedId === deleteTarget.id) setExpandedId(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  /* ── expand / collapse (tickets) ──────────────────────── */
  const toggleExpand = async (projectId: string) => {
    if (expandedId === projectId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(projectId);
    setLoadingTickets(true);
    try {
      const tix = await getProjectTickets(projectId);
      setProjectTickets(tix);
    } catch (err) {
      console.error('Failed to load project tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  /* ── move tickets modal ───────────────────────────────── */
  const openMove = async (projectId: string) => {
    setMoveTargetProject(projectId);
    setSelectedTicketIds(new Set());
    setIsMoveOpen(true);
    setLoadingUnassigned(true);
    try {
      const tix = await getUnassignedTickets();
      setUnassignedTickets(tix);
    } catch (err) {
      console.error('Failed to load unassigned tickets:', err);
    } finally {
      setLoadingUnassigned(false);
    }
  };

  const toggleTicketSelection = (id: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAssignTickets = async () => {
    if (!moveTargetProject || selectedTicketIds.size === 0) return;
    try {
      for (const tid of selectedTicketIds) {
        await assignTicketToProject(tid, moveTargetProject);
      }
      setIsMoveOpen(false);
      // Refresh expanded view if same project
      if (expandedId === moveTargetProject) {
        const tix = await getProjectTickets(moveTargetProject);
        setProjectTickets(tix);
      }
    } catch (err) {
      console.error('Failed to assign tickets:', err);
    }
  };

  const handleRemoveTicket = async (ticketId: string) => {
    try {
      await removeTicketFromProject(ticketId);
      setProjectTickets((prev) => prev.filter((t) => t.id !== ticketId));
    } catch (err) {
      console.error('Failed to remove ticket:', err);
    }
  };

  /* ── ticket stats per project (computed in UI) ────────── */
  const getTicketStats = useCallback(
    (tix: TicketType[]) => {
      const open = tix.filter((t) => t.status === 'Open').length;
      const inProgress = tix.filter((t) => t.status === 'In Progress').length;
      const done = tix.filter((t) => t.status === 'Closed' || t.status === 'Done').length;
      const total = tix.length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      return { open, inProgress, done, total, progress };
    },
    [],
  );

  /* ── render ───────────────────────────────────────────── */
  return (
    <div className="projects-page max-w-7xl mx-auto px-0 py-2 space-y-4">
      <div className="sticky top-25.5 lg:top-16 z-20 bg-background -mx-4 px-4 py-2 -mt-2 space-y-4 shadow-sm shadow-background">
        {/* ── Header ───────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <Text size="xl" weight="bold">Projects</Text>
          </div>
          <Button size="sm" onClick={openCreate} aria-label="Create new project">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Project</span>
          </Button>
        </div>

        {/* ── Search & Filter Bar ──────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search projects…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search projects"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v)}
            options={[
              { value: 'All', label: 'All Statuses' },
              ...STATUS_OPTIONS,
            ]}
            aria-label="Filter by status"
            hideLabel
          />
        </div>
      </div>

      {/* ── Loading / Empty ──────────────────────────── */}
      {isLoading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
          <SmallMuted>Loading projects…</SmallMuted>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-14 h-14 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <Text size="lg" weight="semibold">
            {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
          </Text>
          <SmallMuted>
            {projects.length === 0
              ? 'Create your first project to start organizing tickets.'
              : 'Try different search terms or filters.'}
          </SmallMuted>
          {projects.length === 0 && (
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Create Project
            </Button>
          )}
        </div>
      ) : (
        /* ── Project Cards Grid ────────────────────── */
        <div className="projects-grid">
          {filtered.map((project) => {
            const isExpanded = expandedId === project.id;
            return (
              <Card key={project.id} className="flex flex-col overflow-visible">
                {/* Color band */}
                <div
                  className="h-1 rounded-t-xl"
                  style={{ background: COLOR_HEX[project.color] }}
                />

                <CardContent className="flex-1 space-y-3 pt-3">
                  {/* Top row: prefix + name + menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="project-prefix">{project.prefix}</span>
                        <Badge variant={statusBadgeVariant(project.status)} size="sm">
                          {project.status}
                        </Badge>
                      </div>
                      <Text size="base" weight="semibold" className="truncate">
                        {project.name}
                      </Text>
                    </div>

                    <Dropdown
                      trigger={
                        <Button size="sm" variant="ghost" aria-label="Project actions">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      }
                      placement="bottom-end"
                    >
                      <DropdownContent>
                        <DropdownItem icon={<Pencil className="w-4 h-4" />} onClick={() => openEdit(project)}>
                          Edit
                        </DropdownItem>
                        <DropdownItem icon={<ArrowRightLeft className="w-4 h-4" />} onClick={() => openMove(project.id)}>
                          Add Tickets
                        </DropdownItem>
                        {project.repoUrl && (
                          <DropdownItem icon={<ExternalLink className="w-4 h-4" />} onClick={() => window.open(project.repoUrl, '_blank', 'noopener')}>
                            Open Repo
                          </DropdownItem>
                        )}
                        <DropdownSeparator />
                        <DropdownItem icon={<Trash2 className="w-4 h-4" />} variant="danger" onClick={() => setDeleteTarget(project)}>
                          Delete
                        </DropdownItem>
                      </DropdownContent>
                    </Dropdown>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <SmallMuted className="line-clamp-2">{project.description}</SmallMuted>
                  )}

                  {/* Repo link */}
                  {project.repoUrl && (
                    <a
                      href={project.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{project.repoUrl.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}

                  {/* Expand / collapse tickets */}
                  <button
                    onClick={() => toggleExpand(project.id)}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse tickets' : 'Expand tickets'}
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Tickets</span>
                    {isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                      : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
                  </button>

                  {/* Expanded ticket list */}
                  {isExpanded && (
                    <div className="space-y-1 border-t border-border pt-2">
                      {loadingTickets ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : projectTickets.length === 0 ? (
                        <div className="text-center py-4">
                          <SmallMuted>No tickets assigned</SmallMuted>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => openMove(project.id)}
                          >
                            <Plus className="w-3 h-3" /> Add Tickets
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* quick stats */}
                          {(() => {
                            const stats = getTicketStats(projectTickets);
                            return (
                              <div className="space-y-2 mb-2">
                                <div className="flex gap-3 flex-wrap">
                                  <span className="project-stat">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                    {stats.open} Open
                                  </span>
                                  <span className="project-stat">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                                    {stats.inProgress} In Progress
                                  </span>
                                  <span className="project-stat">
                                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                    {stats.done} Done
                                  </span>
                                </div>
                                <div className="progress-track">
                                  <div
                                    className="progress-fill bg-green-500"
                                    style={{ width: `${stats.progress}%` }}
                                  />
                                </div>
                                <SmallMuted>{stats.progress}% complete</SmallMuted>
                              </div>
                            );
                          })()}

                          {projectTickets.map((t) => (
                            <div key={t.id} className="ticket-row">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  t.priority === 'High'
                                    ? 'bg-red-500'
                                    : t.priority === 'Medium'
                                      ? 'bg-orange-400'
                                      : 'bg-blue-400'
                                }`}
                              />
                              <span className="flex-1 text-sm truncate">{t.title}</span>
                              <Badge
                                variant={
                                  t.status === 'Open'
                                    ? 'default'
                                    : t.status === 'In Progress'
                                      ? 'warning'
                                      : 'success'
                                }
                                size="sm"
                              >
                                {t.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveTicket(t.id)}
                                aria-label={`Remove ${t.title} from project`}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}

                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-1 w-full"
                            onClick={() => openMove(project.id)}
                          >
                            <Plus className="w-3 h-3" /> Add More Tickets
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); resetForm(); }}
        title={editingProject ? 'Edit Project' : 'New Project'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="proj-name" className="block text-sm font-medium mb-1">Name *</label>
            <Input
              id="proj-name"
              placeholder="e.g. TimeHarbor App"
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                if (!editingProject && !formPrefix) {
                  // auto-derive prefix while user types
                }
              }}
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="proj-desc" className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              id="proj-desc"
              placeholder="What is this project about?"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="proj-prefix" className="block text-sm font-medium mb-1">Prefix</label>
              <Input
                id="proj-prefix"
                placeholder="e.g. TH"
                value={formPrefix}
                onChange={(e) => setFormPrefix(e.target.value.toUpperCase().slice(0, 4))}
                maxLength={4}
              />
              <SmallMuted>Short identifier (max 4 chars)</SmallMuted>
            </div>

            <div>
              <Select
                id="proj-status"
                value={formStatus}
                onValueChange={(v) => setFormStatus(v as ProjectStatus)}
                options={STATUS_OPTIONS}
                label="Status"
              />
            </div>
          </div>

          <div>
            <label htmlFor="proj-repo" className="block text-sm font-medium mb-1">Repository URL</label>
            <Input
              id="proj-repo"
              type="url"
              placeholder="https://github.com/org/repo"
              value={formRepo}
              onChange={(e) => setFormRepo(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Project color">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={formColor === c}
                  aria-label={c}
                  style={{ background: COLOR_HEX[c] }}
                  className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-all hover:scale-110 ${
                    formColor === c
                      ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-900 dark:ring-white'
                      : 'border-transparent'
                  }`}
                  onClick={() => setFormColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setIsFormOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim() || isSaving}>
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : editingProject ? (
                <><Check className="w-4 h-4" /> Save Changes</>
              ) : (
                <><Plus className="w-4 h-4" /> Create Project</>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirmation ──────────────────────── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Project"
        size="sm"
      >
        <div className="space-y-4">
          <Text>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            Tickets assigned to this project will be unassigned but not deleted.
          </Text>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Move Tickets Modal ───────────────────────── */}
      <Modal
        isOpen={isMoveOpen}
        onClose={() => setIsMoveOpen(false)}
        title="Add Tickets to Project"
        size="lg"
      >
        <div className="space-y-3">
          {loadingUnassigned ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : unassignedTickets.length === 0 ? (
            <div className="text-center py-8">
              <Ticket className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <Text>All tickets are already assigned to projects.</Text>
            </div>
          ) : (
            <>
              <SmallMuted>
                Select tickets to add ({selectedTicketIds.size} selected)
              </SmallMuted>
              <div className="max-h-72 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {unassignedTickets.map((t) => {
                  const isSelected = selectedTicketIds.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTicketSelection(t.id)}
                      className={`ticket-row w-full text-left ${
                        isSelected
                          ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-300 dark:ring-primary-700'
                          : ''
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          t.priority === 'High'
                            ? 'bg-red-500'
                            : t.priority === 'Medium'
                              ? 'bg-orange-400'
                              : 'bg-blue-400'
                        }`}
                      />
                      <span className="flex-1 text-sm truncate">{t.title}</span>
                      <Badge
                        variant={
                          t.status === 'Open'
                            ? 'default'
                            : t.status === 'In Progress'
                              ? 'warning'
                              : 'success'
                        }
                        size="sm"
                      >
                        {t.status}
                      </Badge>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setIsMoveOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignTickets}
                  disabled={selectedTicketIds.size === 0}
                >
                  <ArrowRightLeft className="w-4 h-4" /> Assign {selectedTicketIds.size} Ticket{selectedTicketIds.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
