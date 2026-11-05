import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LEGACY_PROJECTS } from '../data/legacyProjects';
import { SAMPLE_POST } from '../data/samplePost';
import {
  isSafeUrl,
  LINK_TYPES,
  parseTags,
  parseVideoUrl,
  PROJECT_TYPES,
  slugFromTitle,
  slugify,
  validateProject,
  videoEmbedUrl,
  videoFileUrl,
  videoWatchUrl,
} from '../lib/validation';
import { listCategories } from '../services/categoryService';
import {
  archiveProject,
  ConflictError,
  createProject,
  getProject,
  createSamplePost,
  importLegacyProjects,
  listProjects,
  permanentlyDeleteProject,
  publishProject,
  restoreProject,
  softDeleteProject,
  unpublishProject,
  updateProject,
  ValidationError,
} from '../services/projectService';
import { ProjectCard } from '../components/projects';
import PostViewer from '../components/postViewer';
import { cardImageUrl, fitImageUrl } from '../lib/images';
import { SITE_URL } from '../lib/pageMeta';
import { PagePreview, SeoBadge, SeoPanel } from './SeoPanel';
import {
  FaArrowDown,
  FaArrowLeft,
  FaArrowUp,
  FaCode,
  FaEllipsisV,
  FaExternalLinkAlt,
  FaFileImport,
  FaList,
  FaMagic,
  FaPalette,
  FaPen,
  FaPlus,
  FaSearch,
  FaStar,
  FaThLarge,
  FaTimes,
  FaUndo,
} from 'react-icons/fa';
import {
  Banner,
  buttonClass,
  Card,
  EmptyState,
  ErrorState,
  Field,
  formatDate,
  Icon,
  inputClass,
  MenuButton,
  SegmentedControl,
  SkeletonRows,
  smallButtonClass,
  StatusBadge,
  useConfirm,
  useSession,
  useToast,
  useUnsavedGuard,
} from './ui';
import { MediaPicker, UploadButton } from './MediaAdmin';

const errorMessage = (err) => {
  if (err instanceof ValidationError) return Object.values(err.fieldErrors).join(' ');
  if (err?.code === 'permission-denied') {
    return 'Firebase refused this change. If the app was just updated, re-publish firestore.rules in the Firebase console (Firestore → Rules), then try again.';
  }
  return err?.message || 'Something went wrong.';
};

/* ======================================================================
   Project list (card and table views)
   ====================================================================== */

const STATUS_TABS = [
  { id: 'active', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Draft' },
  { id: 'archived', label: 'Archived' },
  { id: 'trash', label: 'Trash' },
];

const SORTS = [
  { id: 'updated', label: 'Recently updated' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'order', label: 'Manual order' },
];

const VIEW_KEY = 'admin.projects.view';

function readView() {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}

function writeView(view) {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage can be blocked; the toggle still works for this visit.
  }
}

function matchesStatus(project, filter) {
  if (filter === 'trash') return Boolean(project.deletedAt);
  if (project.deletedAt) return false;
  return filter === 'active' || project.status === filter;
}

const SORTERS = {
  updated: (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0),
  title: (a, b) => a.title.localeCompare(b.title),
  order: (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
};

// "Oct 19, 2026"; the full date and time stays in the tooltip.
const shortDate = (timestamp) => {
  const date = timestamp?.toDate?.();
  return date ? date.toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';
};

const monogram = (title) =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

// Where "View" opens: the post popup for posts, else the project's own link.
// Every project has its own page; the card on the homepage and any shared link lead to it.
const publicUrl = (p) => (p.slug ? `/projects/${p.slug}` : null);

// Cover image, or a type-colored monogram when there is none.
function ProjectThumb({ project, className = '' }) {
  const cover = project.coverMedia?.url;
  if (cover) {
    const src = project.display === 'gallery' ? fitImageUrl(cover, 480, 270) : cardImageUrl(cover, 480);
    return (
      <div className={`overflow-hidden bg-slate-950 ${className}`}>
        <img
          src={src}
          alt=""
          loading="lazy"
          className={`h-full w-full ${project.display === 'gallery' ? 'object-contain' : 'object-cover object-top'}`}
        />
      </div>
    );
  }
  const tone =
    project.type === 'Design'
      ? 'border-admin-accent-border bg-admin-accent-bg text-admin-accent-text'
      : 'border-blue-400/40 bg-blue-500/10 text-blue-200';
  return (
    <div aria-hidden="true" className={`flex items-center justify-center border text-xs font-semibold ${tone} ${className}`}>
      {monogram(project.title)}
    </div>
  );
}

function FeaturedStar({ featured, size = 16 }) {
  return (
    <span title={featured ? 'Featured' : 'Not featured'} className="inline-flex">
      <Icon as={FaStar} size={size} className={featured ? 'text-admin-accent' : 'text-slate-600'} />
      <span className="sr-only">{featured ? 'Featured' : 'Not featured'}</span>
    </span>
  );
}

const kebabClass =
  'flex h-8 w-8 items-center justify-center rounded-full border border-admin-border text-admin-body hover:border-admin-accent-border hover:text-admin-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent max-md:h-11 max-md:w-11';

export function ProjectsList() {
  const { user } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [data, setData] = useState({ status: 'loading', projects: [], categories: [] });
  const [filters, setFilters] = useState({ type: 'all', status: 'active', category: 'all', featured: false, search: '', sort: 'updated' });
  const [view, setView] = useState(readView);
  const [busyId, setBusyId] = useState(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [projects, categories] = await Promise.all([listProjects(), listCategories()]);
      setData({ status: 'ready', projects, categories });
    } catch (err) {
      setData((d) => ({ ...d, status: 'error' }));
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeView = (next) => {
    setView(next);
    writeView(next);
  };

  const categoryNames = (p) =>
    (p.categoryIds || []).map((id) => data.categories.find((c) => c.id === id)?.name || id).join(', ') || 'No category';
  const setFilter = (key) => (e) =>
    setFilters((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const counts = Object.fromEntries(
    STATUS_TABS.map((tab) => [tab.id, data.projects.filter((p) => matchesStatus(p, tab.id)).length])
  );

  const search = filters.search.trim().toLowerCase();
  const visible = data.projects
    .filter(
      (p) =>
        matchesStatus(p, filters.status) &&
        (filters.type === 'all' || p.type === filters.type) &&
        (filters.category === 'all' || (p.categoryIds || []).includes(filters.category)) &&
        (!filters.featured || p.featured) &&
        (!search || p.title.toLowerCase().includes(search) || p.slug.includes(search))
    )
    .sort(SORTERS[filters.sort]);

  const filtersActive =
    filters.type !== 'all' || filters.category !== 'all' || filters.featured || Boolean(search);
  const clearFilters = () => setFilters((f) => ({ ...f, type: 'all', category: 'all', featured: false, search: '' }));

  const legacyMissing = LEGACY_PROJECTS.some((l) => !data.projects.some((p) => p.slug === l.slug));
  const sampleMissing = !data.projects.some((p) => p.slug === SAMPLE_POST.slug);

  // Runs an action with optional confirmation, then reports the outcome as a toast.
  const run = async (id, action, { dialog, success, undo } = {}) => {
    if (dialog && !(await confirm(dialog))) return;
    setBusyId(id);
    try {
      await action();
      toast.show({ text: success, action: undo });
      await load();
    } catch (err) {
      toast.show({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const uid = user.uid;
  const ACTIONS = {
    publish: (p) => run(p.id, () => publishProject(p.id, uid), { success: `"${p.title}" is live.` }),
    unpublish: (p) =>
      run(p.id, () => unpublishProject(p.id, uid), {
        dialog: {
          title: `Unpublish "${p.title}"?`,
          description: 'It disappears from the public portfolio. You can publish it again at any time.',
          confirmLabel: 'Unpublish',
          tone: 'warn',
        },
        success: `"${p.title}" is now a draft.`,
      }),
    archive: (p) =>
      run(p.id, () => archiveProject(p.id, uid), {
        dialog: {
          title: `Archive "${p.title}"?`,
          description: 'It is hidden from the portfolio and moved to Archived. Its analytics are kept.',
          confirmLabel: 'Archive',
          tone: 'warn',
        },
        success: `"${p.title}" archived.`,
      }),
    restore: (p) => run(p.id, () => restoreProject(p.id, uid), { success: `"${p.title}" restored as a draft.` }),
    trash: (p) =>
      run(p.id, () => softDeleteProject(p.id, uid), {
        dialog: {
          title: `Move "${p.title}" to the trash?`,
          description: 'It is hidden from the portfolio. You can restore it from Trash.',
          confirmLabel: 'Move to trash',
          tone: 'danger',
        },
        success: `"${p.title}" moved to the trash.`,
        undo: { label: 'Undo', onClick: () => ACTIONS.restore(p) },
      }),
    purge: (p) =>
      run(p.id, () => permanentlyDeleteProject(p.id, uid), {
        dialog: {
          title: `Delete "${p.title}" permanently?`,
          description: 'This removes the project for good. It cannot be undone.',
          confirmLabel: 'Delete permanently',
          tone: 'danger',
          confirmText: 'delete',
        },
        success: 'Project permanently deleted.',
      }),
  };

  // Primary button + menu items for a project, by status.
  const actionsFor = (p) => {
    const url = publicUrl(p);
    const edit = { label: 'Edit', onSelect: () => navigate(`/admin/projects/${p.id}`) };
    const trash = { label: 'Move to trash', tone: 'danger', onSelect: () => ACTIONS.trash(p) };
    if (p.deletedAt) {
      return {
        primary: { label: 'Restore', icon: FaUndo, onClick: () => ACTIONS.restore(p) },
        menu: [{ label: 'Delete permanently', tone: 'danger', onSelect: () => ACTIONS.purge(p) }],
      };
    }
    if (p.status === 'archived') {
      return { primary: { label: 'Restore', icon: FaUndo, onClick: () => ACTIONS.restore(p) }, menu: [edit, trash] };
    }
    const primary = { label: 'Edit', icon: FaPen, to: `/admin/projects/${p.id}` };
    if (p.status === 'published') {
      return {
        primary,
        menu: [
          ...(url ? [{ label: 'View on site', href: url, external: true }] : []),
          { label: 'Unpublish', onSelect: () => ACTIONS.unpublish(p) },
          { label: 'Archive', onSelect: () => ACTIONS.archive(p) },
          trash,
        ],
      };
    }
    return {
      primary,
      menu: [
        { label: 'Publish', onSelect: () => ACTIONS.publish(p) },
        { label: 'Archive', onSelect: () => ACTIONS.archive(p) },
        trash,
      ],
    };
  };

  // A render function (not a component) so open menus survive re-renders.
  const renderActions = (project) => {
    const { primary, menu } = actionsFor(project);
    const busy = busyId === project.id;
    return (
      <div className="flex items-center justify-end gap-2">
        {primary.to ? (
          <Link to={primary.to} className={smallButtonClass.secondary}>
            <Icon as={primary.icon} size={11} />
            {primary.label}
          </Link>
        ) : (
          <button type="button" className={smallButtonClass.secondary} onClick={primary.onClick} disabled={busy}>
            <Icon as={primary.icon} size={11} />
            {primary.label}
          </button>
        )}
        <MenuButton
          ariaLabel={`More actions for ${project.title}`}
          buttonClassName={kebabClass}
          label={<Icon as={FaEllipsisV} size={13} />}
          items={menu.map((item) => ({ ...item, disabled: busy }))}
        />
      </div>
    );
  };

  const runImport = () =>
    run('import', async () => {
      const count = await importLegacyProjects(uid);
      if (count === 0) throw new Error('Nothing to import: all original projects already exist.');
    }, {
      dialog: {
        title: 'Import the original projects?',
        description: 'Adds the 4 projects that were built into the site as published Development projects.',
        confirmLabel: 'Import',
      },
      success: 'Original projects imported and published.',
    });

  const runSample = () =>
    run('sample', async () => {
      if (!(await createSamplePost(uid))) throw new Error('The sample post already exists.');
    }, {
      dialog: {
        title: 'Add a sample post?',
        description: 'Publishes a 3-image poster post under Design → Others so you can try the popup. Delete it once your own work is in.',
        confirmLabel: 'Add sample post',
      },
      success: 'Sample post published. Open the portfolio, go to Design → Others and click it.',
    });

  const tabClass = (on) =>
    `inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent max-md:min-h-11 ${
      on ? 'border-admin-accent-border bg-admin-accent-bg text-admin-accent-text' : 'border-admin-border text-admin-body hover:text-admin-accent'
    }`;
  const viewButtonClass = (on) =>
    `flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent max-md:h-11 max-md:w-11 ${
      on ? 'bg-admin-accent-bg text-admin-accent-text' : 'text-admin-muted hover:text-admin-accent'
    }`;

  return (
    <section aria-labelledby="projects-heading" className="flex flex-col gap-6">
      {confirmDialog}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 id="projects-heading" className="text-xl font-bold text-admin-heading">
            Projects
          </h1>
          <p className="text-admin-muted">Create, publish and organise the projects shown on your portfolio.</p>
          <p className="text-xs text-admin-muted">
            Each published project gets its own page and is added to the{' '}
            <a href="/sitemap.xml" target="_blank" rel="noreferrer noopener" className="underline">sitemap<span className="sr-only"> (opens in a new tab)</span></a>{' '}
            automatically. Google picks new pages up on its own schedule.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.status === 'ready' && sampleMissing && (
            <button type="button" className={buttonClass.secondary} onClick={runSample} disabled={busyId === 'sample'}>
              <Icon as={FaMagic} size={14} />
              {busyId === 'sample' ? 'Adding…' : 'Add sample post'}
            </button>
          )}
          {data.status === 'ready' && legacyMissing && (
            <button type="button" className={buttonClass.secondary} onClick={runImport} disabled={busyId === 'import'}>
              <Icon as={FaFileImport} size={14} />
              {busyId === 'import' ? 'Importing…' : 'Import original projects'}
            </button>
          )}
          <Link to="/admin/projects/new" className={buttonClass.primary}>
            <Icon as={FaPlus} size={13} />
            Add project
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={filters.status === tab.id}
              onClick={() => setFilters((f) => ({ ...f, status: tab.id }))}
              className={tabClass(filters.status === tab.id)}
            >
              {tab.label}
              <span className={`text-xs ${filters.status === tab.id ? 'text-admin-accent-text' : 'text-admin-muted'}`}>
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-admin-border p-1" role="group" aria-label="Layout">
          <button type="button" aria-pressed={view === 'cards'} onClick={() => changeView('cards')} className={viewButtonClass(view === 'cards')} title="Card view">
            <Icon as={FaThLarge} size={14} />
            <span className="sr-only">Card view</span>
          </button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => changeView('table')} className={viewButtonClass(view === 'table')} title="Table view">
            <Icon as={FaList} size={14} />
            <span className="sr-only">Table view</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] items-end gap-3">
        <div className="col-span-full min-w-0 sm:col-span-2">
          <label htmlFor="project-search" className="mb-1 block font-medium text-admin-label">Search</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-admin-muted">
              <Icon as={FaSearch} size={13} />
            </span>
            <input id="project-search" type="search" placeholder="Title or slug" value={filters.search} onChange={setFilter('search')} className={`${inputClass} h-9 pl-9`} />
          </div>
        </div>
        <div>
          <label htmlFor="project-type" className="mb-1 block font-medium text-admin-label">Type</label>
          <select id="project-type" value={filters.type} onChange={setFilter('type')} className={`${inputClass} h-9`}>
            <option value="all">All types</option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="project-category" className="mb-1 block font-medium text-admin-label">Category</label>
          <select id="project-category" value={filters.category} onChange={setFilter('category')} className={`${inputClass} h-9`}>
            <option value="all">All categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="project-sort" className="mb-1 block font-medium text-admin-label">Sort</label>
          <select id="project-sort" value={filters.sort} onChange={setFilter('sort')} className={`${inputClass} h-9`}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <label className="flex h-9 items-center gap-2 font-medium text-admin-label max-md:min-h-11">
          <input type="checkbox" checked={filters.featured} onChange={setFilter('featured')} className="h-4 w-4 accent-teal-400" />
          Featured only
        </label>
      </div>

      {data.status === 'loading' && <SkeletonRows count={5} label="Loading projects" />}
      {data.status === 'error' && (
        <ErrorState title="Couldn't load projects" onRetry={load}>
          {loadError}
        </ErrorState>
      )}

      {data.status === 'ready' && visible.length === 0 && (
        <EmptyState
          title={data.projects.length === 0 ? 'No projects yet' : 'No projects match'}
          actions={
            data.projects.length === 0 ? (
              <Link to="/admin/projects/new" className={buttonClass.primary}>
                <Icon as={FaPlus} size={13} />
                Add project
              </Link>
            ) : (
              filtersActive && (
                <button type="button" className={buttonClass.secondary} onClick={clearFilters}>
                  Clear filters
                </button>
              )
            )
          }
        >
          {data.projects.length === 0
            ? 'Add your first project, or try the sample post to see the popup.'
            : 'Try another status tab or clear the filters.'}
        </EmptyState>
      )}

      {data.status === 'ready' && visible.length > 0 && view === 'cards' && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Projects">
          {visible.map((p) => (
            <Card as="li" key={p.id} className="flex min-w-0 flex-col transition-colors hover:border-admin-border">
              {/* Clip only the image: clipping the whole card would hide the actions menu. */}
              <div className="relative overflow-hidden rounded-t-lg">
                <ProjectThumb project={p} className="aspect-video w-full" />
                <span className="absolute left-3 top-3 rounded-full bg-admin-app/90 shadow-overlay">
                  <StatusBadge project={p} />
                </span>
                <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-admin-app/90 shadow-overlay">
                  <FeaturedStar featured={p.featured} size={13} />
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                  <h2 className="truncate font-medium text-admin-strong" title={p.title}>
                    <Link to={`/admin/projects/${p.id}`} className="block truncate py-1 max-md:py-3 hover:text-admin-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent">
                      {p.title}
                    </Link>
                  </h2>
                  <p className="truncate text-xs text-admin-muted">/{p.slug}</p>
                </div>
                <p className="flex items-center gap-2 text-xs text-admin-body">
                  <Icon as={p.type === 'Design' ? FaPalette : FaCode} size={12} className="text-admin-muted" />
                  <span className="truncate">
                    {p.type} · {categoryNames(p)}
                  </span>
                </p>
                {!p.deletedAt && p.status !== 'archived' && (
                  <p className="flex items-center gap-2 text-xs text-admin-muted">
                    <span>Search</span>
                    <SeoBadge project={p} />
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-admin-subtle pt-3">
                  <span className="text-xs text-admin-muted" title={formatDate(p.updatedAt)}>Updated {shortDate(p.updatedAt)}</span>
                  {renderActions(p)}
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}

      {data.status === 'ready' && visible.length > 0 && view === 'table' && (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <caption className="sr-only">Projects</caption>
            <thead>
              <tr className="bg-slate-800/30 text-xs font-semibold text-admin-muted">
                <th scope="col" className="px-4 py-2.5 font-semibold">Project</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Type</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Category</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Search</th>
                <th scope="col" className="px-3 py-2.5 font-semibold"><span className="sr-only">Featured</span></th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Updated</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className="border-t border-admin-subtle hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProjectThumb project={p} className="h-9 w-12 shrink-0 rounded-md" />
                      <div className="min-w-0">
                        <Link to={`/admin/projects/${p.id}`} className="block max-w-[18rem] truncate font-medium text-admin-strong hover:text-admin-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent" title={p.title}>
                          {p.title}
                        </Link>
                        <span className="block max-w-[18rem] truncate text-xs text-admin-muted">/{p.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">{p.type}</td>
                  <td className="max-w-[10rem] truncate px-3 py-3">{categoryNames(p)}</td>
                  <td className="px-3 py-3"><StatusBadge project={p} /></td>
                  <td className="px-3 py-3">{!p.deletedAt && p.status !== 'archived' ? <SeoBadge project={p} /> : null}</td>
                  <td className="px-3 py-3"><FeaturedStar featured={p.featured} /></td>
                  <td className="whitespace-nowrap px-3 py-3 text-admin-muted" title={formatDate(p.updatedAt)}>{shortDate(p.updatedAt)}</td>
                  <td className="px-4 py-3">{renderActions(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data.status === 'ready' && data.projects.length > 0 && (
        <p className="text-admin-muted">
          Showing {visible.length} of {counts[filters.status]} {filters.status === 'trash' ? 'in the trash' : 'projects'}
          {data.projects.length >= 500 && ' · only the 500 most recently updated are loaded'}
        </p>
      )}
    </section>
  );
}

/* ======================================================================
   Project editor
   ====================================================================== */

const EMPTY_FORM = {
  title: '',
  slug: '',
  type: 'Design',
  shortDescription: '',
  description: '',
  categoryIds: [],
  techStackText: '',
  coverUrl: '',
  coverAlt: '',
  videoUrl: '',
  projectUrl: '',
  links: [],
  featured: false,
  sortOrder: 0,
  display: 'link',
  gallery: [],
};

function toForm(project) {
  return {
    title: project.title || '',
    slug: project.slug || '',
    type: project.type || 'Design',
    shortDescription: project.shortDescription || '',
    description: project.description || '',
    categoryIds: project.categoryIds || [],
    techStackText: (project.techStack || []).join(', '),
    coverUrl: project.coverMedia?.url || '',
    coverAlt: project.coverMedia?.alt || '',
    videoUrl: videoWatchUrl((project.media || []).find((m) => m.type === 'video')),
    projectUrl: project.projectUrl || '',
    links: project.links || [],
    featured: Boolean(project.featured),
    sortOrder: project.sortOrder ?? 0,
    display: project.display || 'link',
    gallery: project.gallery || [],
  };
}

function toInput(form) {
  return {
    title: form.title,
    slug: form.slug,
    type: form.type,
    shortDescription: form.shortDescription,
    description: form.description,
    categoryIds: form.categoryIds,
    techStack: parseTags(form.techStackText),
    coverMedia: { url: form.coverUrl.trim(), alt: form.coverAlt },
    videoUrl: form.videoUrl.trim(),
    projectUrl: form.projectUrl.trim(),
    links: form.links,
    featured: form.featured,
    sortOrder: Number(form.sortOrder),
    display: form.display,
    gallery: form.gallery,
  };
}

export function ProjectEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user } = useSession();

  const [loadState, setLoadState] = useState('loading');
  const [categories, setCategories] = useState([]);
  const [stored, setStored] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [initial, setInitial] = useState(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pagePreviewOpen, setPagePreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const [cats, project] = await Promise.all([listCategories(), isNew ? null : getProject(id)]);
      setCategories(cats);
      if (!isNew && !project) {
        setLoadState('missing');
        return;
      }
      const next = project ? toForm(project) : EMPTY_FORM;
      setStored(project);
      setForm(next);
      setInitial(next);
      setSlugTouched(Boolean(project));
      setErrors({});
      setLoadState('ready');
    } catch (err) {
      setNotice({ tone: 'error', text: `Couldn't load: ${errorMessage(err)}` });
      setLoadState('error');
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  // Warn before closing or reloading the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const onTitle = (value) =>
    setForm((f) => ({ ...f, title: value, slug: slugTouched ? f.slug : slugFromTitle(value) }));
  const onType = (type) =>
    setForm((f) => ({
      ...f,
      type,
      categoryIds: f.categoryIds.filter((cid) => categories.find((c) => c.id === cid)?.projectTypes?.includes(type)),
    }));
  // Ticking "Others" (posters, banners…) switches the card to the post popup.
  const toggleCategory = (cid) =>
    setForm((f) => {
      const adding = !f.categoryIds.includes(cid);
      return {
        ...f,
        categoryIds: adding ? [...f.categoryIds, cid] : f.categoryIds.filter((x) => x !== cid),
        display: adding && cid === 'others' ? 'gallery' : f.display,
      };
    });
  const addGalleryImage = (item) =>
    setForm((f) =>
      f.gallery.some((img) => img.url === item.url) ? f : { ...f, gallery: [...f.gallery, { url: item.url, alt: item.altText || '' }] }
    );
  const updateGalleryAlt = (index, alt) =>
    setForm((f) => ({ ...f, gallery: f.gallery.map((img, i) => (i === index ? { ...img, alt } : img)) }));
  const moveGalleryImage = (index, step) =>
    setForm((f) => {
      const gallery = [...f.gallery];
      const target = index + step;
      if (target < 0 || target >= gallery.length) return f;
      [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
      return { ...f, gallery };
    });
  const updateLink = (index, key, value) =>
    setForm((f) => ({ ...f, links: f.links.map((l, i) => (i === index ? { ...l, [key]: value } : l)) }));

  const typeCategories = categories.filter(
    (c) => (c.projectTypes || []).includes(form.type) && (c.active || form.categoryIds.includes(c.id))
  );

  // Returns true when everything was saved (and published, if asked). `stay: false` is for "save
  // and leave": the caller navigates, so no reload or redirect to the new project's edit URL.
  const save = async ({ publish, stay = true }) => {
    const input = toInput(form);
    const fieldErrors = validateProject(input, {
      publish: publish || stored?.status === 'published',
      categories,
    });
    setErrors(fieldErrors);
    setNotice(null);
    if (Object.keys(fieldErrors).length) {
      setNotice({ tone: 'error', text: 'Please fix the highlighted fields.' });
      return false;
    }

    setSaving(true);
    let createdId = null;
    let saved = false;
    let published = !publish;
    try {
      if (isNew) createdId = await createProject(input, user.uid);
      else await updateProject(id, input, user.uid, stored?.updatedAt?.toMillis?.() ?? null);
      saved = true;
      setInitial(form);
      if (publish) await publishProject(createdId || id, user.uid);
      published = true;
      setNotice({ tone: 'success', text: publish ? 'Saved and published.' : 'Saved.' });
    } catch (err) {
      if (err instanceof ValidationError) setErrors(err.fieldErrors);
      setNotice({
        tone: 'error',
        text: saved ? `Saved, but not published: ${errorMessage(err)}` : errorMessage(err),
        conflict: err instanceof ConflictError,
      });
    } finally {
      setSaving(false);
    }
    if (!stay) return saved && published;
    // A new project now exists: move to its edit URL so saving again doesn't create a duplicate.
    if (createdId) navigate(`/admin/projects/${createdId}`, { replace: true });
    else if (saved) await load();
    return saved && published;
  };

  // Back, Cancel, the sidebar and the breadcrumbs all ask before unsaved changes are lost.
  const { leave, guardClick } = useUnsavedGuard({
    dirty,
    save: () => save({ publish: false, stay: false }),
    saveLabel: 'Save & leave',
    description:
      stored?.status === 'published'
        ? 'This project is live. Your changes are not saved yet, so visitors still see the last saved version.'
        : 'You have unsaved changes to this project. Save them as a draft, or discard them and leave.',
  });
  const cancel = () => leave('/admin');

  if (loadState === 'loading') return <p role="status">Loading…</p>;
  if (loadState === 'missing') {
    return (
      <Banner tone="error">
        This project doesn't exist. <Link to="/admin" className="underline">Back to projects</Link>
      </Banner>
    );
  }
  if (loadState === 'error') {
    return (
      <>
        {notice && <Banner tone="error">{notice.text}</Banner>}
        <button type="button" className={buttonClass.secondary} onClick={load}>
          Try again
        </button>
      </>
    );
  }

  const isPublished = stored?.status === 'published';
  const preview = {
    id: 'preview',
    slug: form.slug,
    type: form.type,
    title: form.title || 'Project title',
    description: form.shortDescription || 'Short description',
    fullDescription: form.description,
    thumbnail: isSafeUrl(form.coverUrl) ? form.coverUrl : form.gallery.find((img) => isSafeUrl(img.url))?.url || null,
    thumbnailAlt: form.coverAlt,
    tags: parseTags(form.techStackText),
    display: form.display,
    href: isSafeUrl(form.projectUrl) ? form.projectUrl : null,
    links: form.links.filter((l) => l.label && isSafeUrl(l.url)),
    gallery: form.gallery.filter((img) => isSafeUrl(img.url)),
    videoEmbedUrl: videoEmbedUrl(parseVideoUrl(form.videoUrl)),
    videoFileUrl: videoFileUrl(parseVideoUrl(form.videoUrl)),
    categoryIds: form.categoryIds,
  };
  const errorProps = (key) =>
    errors[key] ? { 'aria-invalid': true, 'aria-describedby': `${key}-error` } : {};
  const pageAddress = `${SITE_URL}/projects/${form.slug || 'your-project'}`;
  // A live project's address is what Google and any shared link point to.
  const slugChangesLiveAddress =
    Boolean(stored?.slug) &&
    Boolean(form.slug) &&
    form.slug !== stored.slug &&
    (stored.status === 'published' || Boolean(stored.publishedAt));

  return (
    <section aria-labelledby="editor-heading">
      <Link
        to="/admin"
        onClick={guardClick('/admin')}
        className="-ml-2 mb-3 inline-flex h-9 items-center gap-2 rounded-full px-2 text-sm font-medium text-admin-muted hover:text-admin-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent max-md:h-11"
      >
        <Icon as={FaArrowLeft} size={12} />
        Back to projects
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 id="editor-heading" className="text-xl font-bold text-teal-300">
          {isNew ? 'New project' : 'Edit project'}
        </h1>
        {stored && <StatusBadge project={stored} />}
        {isPublished && stored?.slug && (
          <a
            href={`/projects/${stored.slug}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-6 items-center gap-1.5 rounded text-sm font-medium text-admin-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent max-md:min-h-11"
          >
            View live page
            <Icon as={FaExternalLinkAlt} size={11} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>

      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}{' '}
          {notice.conflict && (
            <button type="button" className="underline" onClick={load}>
              Reload latest version
            </button>
          )}
        </Banner>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save({ publish: false });
        }}
        className="grid gap-8 lg:grid-cols-5"
      >
        <div className="min-w-0 space-y-5 lg:col-span-3">
          <Field id="title" label="Title" required error={errors.title}>
            <input id="title" className={inputClass} value={form.title} onChange={(e) => onTitle(e.target.value)} {...errorProps('title')} />
          </Field>
          <Field id="slug" label="Slug (page address)" required hint={`This project's page: ${pageAddress}. Lowercase letters, numbers and hyphens.`} error={errors.slug}>
            <input
              id="slug"
              className={inputClass}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                update('slug', e.target.value);
              }}
              onBlur={() => update('slug', slugify(form.slug))}
              {...errorProps('slug')}
            />
          </Field>
          {slugChangesLiveAddress && (
            <Banner tone="warn" className="">
              This project is live at <strong>/projects/{stored.slug}</strong>. Saving a new slug moves the page to{' '}
              <strong>/projects/{form.slug}</strong>. The old address keeps working: visitors and Google are redirected
              to the new one.
            </Banner>
          )}

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-200">
              Type<span className="text-teal-300"> *</span>
            </legend>
            <div className="flex gap-4">
              {PROJECT_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="type" value={t} checked={form.type === t} onChange={() => onType(t)} className="h-4 w-4 accent-teal-400" />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset aria-describedby={errors.categoryIds ? 'categoryIds-error' : undefined}>
            <legend className="mb-1 text-sm font-medium text-slate-200">
              Categories<span className="text-teal-300"> *</span>
            </legend>
            {typeCategories.length === 0 ? (
              <p className="text-xs text-admin-muted">
                No categories for this type yet. <Link to="/admin/categories" className="underline">Manage categories</Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {typeCategories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} className="h-4 w-4 accent-teal-400" />
                    {c.name}
                    {!c.active && <span className="text-xs text-admin-muted">(inactive)</span>}
                  </label>
                ))}
              </div>
            )}
            {errors.categoryIds && <p id="categoryIds-error" className="mt-1 text-xs text-red-300">{errors.categoryIds}</p>}
          </fieldset>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-200">When the card is clicked</p>
            <SegmentedControl
              ariaLabel="When the card is clicked"
              value={form.display}
              onChange={(value) => update('display', value)}
              options={[
                { value: 'link', label: 'Open project page' },
                { value: 'gallery', label: 'Show post popup' },
              ]}
            />
            <p className="mt-1 text-xs text-admin-muted">
              {form.display === 'gallery'
                ? 'Opens an Instagram-style popup with the images below, with a link to the full page. The project still has its own page. Good for posters and banners.'
                : "Opens the project's own page, which shows the description, images and your links."}
            </p>
          </div>

          {form.display === 'gallery' && (
            <fieldset aria-describedby={errors.gallery ? 'gallery-error' : undefined}>
              <legend className="mb-1 text-sm font-medium text-slate-200">
                Post images<span className="text-teal-300"> *</span>
              </legend>
              <p className="mb-3 text-xs text-admin-muted">
                Shown as a carousel, in this order. Any size works; portrait 4:5 (1080 × 1350 px) fits the popup best.
              </p>
              {form.gallery.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {form.gallery.map((img, i) => (
                    <li key={img.url} className="flex items-center gap-3 rounded-md border border-slate-700/70 p-2">
                      <img src={fitImageUrl(img.url, 160)} alt="" className="h-16 w-16 shrink-0 rounded bg-slate-950 object-contain" />
                      <input
                        id={`gallery-alt-${i}`}
                        aria-label={`Alt text for image ${i + 1}`}
                        placeholder="Alt text (describe the image)"
                        className={inputClass}
                        value={img.alt}
                        onChange={(e) => updateGalleryAlt(i, e.target.value)}
                      />
                      <div className="flex shrink-0 gap-1">
                        <button type="button" className={smallButtonClass.secondary} disabled={i === 0}
                          onClick={() => moveGalleryImage(i, -1)} aria-label={`Move image ${i + 1} up`}><Icon as={FaArrowUp} size={11} /></button>
                        <button type="button" className={smallButtonClass.secondary} disabled={i === form.gallery.length - 1}
                          onClick={() => moveGalleryImage(i, 1)} aria-label={`Move image ${i + 1} down`}><Icon as={FaArrowDown} size={11} /></button>
                        <button type="button" className={smallButtonClass.danger}
                          onClick={() => update('gallery', form.gallery.filter((_, x) => x !== i))} aria-label={`Remove image ${i + 1}`}><Icon as={FaTimes} size={11} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-start gap-4">
                <UploadButton type="image" label="Upload images" multiple onUploaded={addGalleryImage} />
                <MediaPicker type="image" onPick={addGalleryImage} />
              </div>
              {errors.gallery && <p id="gallery-error" className="mt-1 text-xs text-red-300">{errors.gallery}</p>}
            </fieldset>
          )}

          <Field id="shortDescription" label="Short description" required hint="Shown on the project card and used as the description in Google. Aim for 70-160 characters." error={errors.shortDescription}>
            <textarea id="shortDescription" rows={2} className={inputClass} value={form.shortDescription}
              onChange={(e) => update('shortDescription', e.target.value)} {...errorProps('shortDescription')} />
          </Field>
          <Field id="description" label="Description" hint="Shown on the project page. Leave a blank line between paragraphs." error={errors.description}>
            <textarea id="description" rows={6} className={inputClass} value={form.description}
              onChange={(e) => update('description', e.target.value)} {...errorProps('description')} />
          </Field>
          <Field id="techStack" label="Tools / tech stack" hint="Comma-separated, e.g. Figma, UI Design, Prototyping." error={errors.techStack}>
            <input id="techStack" className={inputClass} value={form.techStackText}
              onChange={(e) => update('techStackText', e.target.value)} {...errorProps('techStack')} />
          </Field>

          <Field id="coverUrl" label="Cover image URL" hint={form.display === 'gallery'
              ? 'Optional for posts: the first post image is used if this is empty. Shown on the card.'
              : 'Use a 16:9 image, ideally 1600 × 900 px (at least 1280 × 720). Upload, choose from the library, or paste an https:// URL. Required to publish.'} error={errors.coverUrl}>
            <input id="coverUrl" type="url" className={inputClass} value={form.coverUrl}
              onChange={(e) => update('coverUrl', e.target.value)} {...errorProps('coverUrl')} />
          </Field>
          <div className="flex flex-wrap items-start gap-4">
            <UploadButton type="image" label="Upload image"
              onUploaded={(item) => setForm((f) => ({ ...f, coverUrl: item.url, coverAlt: f.coverAlt || item.altText }))} />
            <MediaPicker type="image"
              onPick={(item) => setForm((f) => ({ ...f, coverUrl: item.url, coverAlt: f.coverAlt || item.altText }))} />
          </div>
          <Field id="coverAlt" label="Cover image alt text" hint="Describe the image for screen readers. Required to publish." error={errors.coverAlt}>
            <input id="coverAlt" className={inputClass} value={form.coverAlt}
              onChange={(e) => update('coverAlt', e.target.value)} {...errorProps('coverAlt')} />
          </Field>

          <Field id="videoUrl" label="Video link" hint="Optional. Paste a YouTube or Vimeo link, or upload a video. Shown as the first slide of the post popup." error={errors.videoUrl}>
            <input id="videoUrl" type="url" className={inputClass} value={form.videoUrl}
              onChange={(e) => update('videoUrl', e.target.value)} {...errorProps('videoUrl')} />
          </Field>
          <div className="flex flex-wrap items-start gap-4">
            <UploadButton type="video" label="Upload video" onUploaded={(item) => update('videoUrl', item.url)} />
            <MediaPicker type="video" onPick={(item) => update('videoUrl', item.url)} />
          </div>
          {videoFileUrl(parseVideoUrl(form.videoUrl)) && (
            <video src={videoFileUrl(parseVideoUrl(form.videoUrl))} controls preload="metadata" className="aspect-video w-full rounded-md border border-slate-700 bg-black" />
          )}
          {videoEmbedUrl(parseVideoUrl(form.videoUrl)) && (
            <div className="aspect-video overflow-hidden rounded-md border border-slate-700">
              <iframe
                title="Video preview"
                src={videoEmbedUrl(parseVideoUrl(form.videoUrl))}
                className="h-full w-full"
                loading="lazy"
                allow="encrypted-media; picture-in-picture; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}

          <Field id="projectUrl" label="Primary link" hint="Shown as the 'View project' button on the project page: live site, Figma, Behance… https:// only." error={errors.projectUrl}>
            <input id="projectUrl" type="url" className={inputClass} value={form.projectUrl}
              onChange={(e) => update('projectUrl', e.target.value)} {...errorProps('projectUrl')} />
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-200">Additional links</legend>
            <div className="space-y-3">
              {form.links.map((link, i) => (
                <div key={i}>
                  <div className="grid gap-2 sm:grid-cols-[1fr_9rem_2fr_auto]">
                    <input aria-label={`Link ${i + 1} label`} placeholder="Label" className={inputClass} value={link.label}
                      onChange={(e) => updateLink(i, 'label', e.target.value)} />
                    <select aria-label={`Link ${i + 1} type`} className={inputClass} value={link.type}
                      onChange={(e) => updateLink(i, 'type', e.target.value)}>
                      {LINK_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input aria-label={`Link ${i + 1} URL`} type="url" placeholder="https://" className={inputClass} value={link.url}
                      onChange={(e) => updateLink(i, 'url', e.target.value)} />
                    <button type="button" className={smallButtonClass.danger}
                      onClick={() => update('links', form.links.filter((_, x) => x !== i))}>
                      Remove
                    </button>
                  </div>
                  {errors[`link-${i}`] && <p className="mt-1 text-xs text-red-300">{errors[`link-${i}`]}</p>}
                </div>
              ))}
            </div>
            {errors.links && <p className="mt-1 text-xs text-red-300">{errors.links}</p>}
            <button type="button" className={`${smallButtonClass.secondary} mt-3`}
              onClick={() => update('links', [...form.links, { label: '', type: LINK_TYPES[0], url: '' }])}>
              Add link
            </button>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="sortOrder" label="Sort order" hint="Lower numbers appear first." error={errors.sortOrder}>
              <input id="sortOrder" type="number" className={inputClass} value={form.sortOrder}
                onChange={(e) => update('sortOrder', e.target.value)} {...errorProps('sortOrder')} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={form.featured} onChange={(e) => update('featured', e.target.checked)} className="h-4 w-4 accent-teal-400" />
              Featured (shown first)
            </label>
          </div>

          <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-t border-admin-subtle bg-admin-app px-4 py-3 md:mx-0 md:px-0">
            <button type="submit" className={buttonClass.secondary} disabled={saving}>
              {saving ? 'Saving…' : isPublished ? 'Save changes' : 'Save draft'}
            </button>
            {!isPublished && !stored?.deletedAt && (
              <button type="button" className={buttonClass.primary} disabled={saving} onClick={() => save({ publish: true })}>
                Save &amp; publish
              </button>
            )}
            <button type="button" className={buttonClass.secondary} onClick={cancel} disabled={saving}>
              Cancel
            </button>
            <p role="status" className="ml-auto flex items-center gap-2 text-xs text-admin-muted">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dirty ? 'bg-amber-300' : 'bg-admin-accent-bright'}`} />
              {dirty ? 'Unsaved changes' : stored ? 'All changes saved' : 'Not saved yet'}
            </p>
          </div>
          {isPublished && (
            <p className="text-xs text-admin-muted">
              This project is live. Saved changes appear on the portfolio immediately. Its page refreshes for search engines within about 5 minutes.
            </p>
          )}
        </div>

        <aside
          aria-label="Previews"
          className="min-w-0 lg:sticky lg:top-20 lg:col-span-2 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1"
        >
          <h2 className="mb-2 text-sm font-medium text-slate-200">Preview</h2>
          <p className="mb-3 text-xs text-admin-muted">How the card will look on the portfolio. Only visible to you. Use "Preview page" to see the project's own page, including unsaved changes.</p>
          <ul>
            <ProjectCard project={preview} onOpen={() => setPreviewOpen(true)} />
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={smallButtonClass.secondary} onClick={() => setPagePreviewOpen(true)}>
              Preview page
            </button>
            {form.display === 'gallery' && (
              <button type="button" className={smallButtonClass.secondary} onClick={() => setPreviewOpen(true)}>
                Preview popup
              </button>
            )}
          </div>
          <SeoPanel input={toInput(form)} type={form.type} />
          {pagePreviewOpen && (
            <PagePreview project={preview} categories={categories} onClose={() => setPagePreviewOpen(false)} />
          )}
          {previewOpen && (
            <PostViewer
              project={preview}
              categoryNames={form.categoryIds.map((cid) => categories.find((c) => c.id === cid)?.name).filter(Boolean)}
              onClose={() => setPreviewOpen(false)}
            />
          )}
        </aside>
      </form>
    </section>
  );
}
