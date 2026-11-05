import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaPalette, FaCode, FaClone } from 'react-icons/fa';
import { isFirebaseConfigured } from '../lib/firebaseConfig';
import { parseTags } from '../lib/validation';
import { cardImageSrcSet, cardImageUrl, fitImageUrl } from '../lib/images';
import { DEFAULT_CATEGORIES, LEGACY_PROJECTS } from '../data/legacyProjects';
import PostViewer, { buildSlides } from './postViewer';

const MODES = [
  { id: 'design', type: 'Design', label: 'Design', Icon: FaPalette, subtitle: 'Selected UI/UX design work.' },
  { id: 'development', type: 'Development', label: 'Development', Icon: FaCode, subtitle: 'Web applications I have built.' },
];

const MAX_TAGS = 3;
const POST_HASH_PREFIX = 'post=';

// Built-in data, used only when Firebase isn't configured (e.g. local development without .env.local).
const STATIC_PORTFOLIO = {
  projects: LEGACY_PROJECTS.map((p, index) => ({
    id: p.slug,
    type: 'Development',
    title: p.title,
    description: p.description,
    thumbnail: p.thumbnail,
    thumbnailAlt: '',
    tags: parseTags(p.platform),
    display: 'link',
    href: null,
    links: [],
    gallery: [],
    categoryIds: [p.category],
    featured: false,
    sortOrder: index,
  })),
  categories: DEFAULT_CATEGORIES,
};

// Published projects from Firestore. Firebase is loaded on demand so it stays out of the main bundle.
function usePortfolioData() {
  const [state, setState] = useState(() =>
    isFirebaseConfigured
      ? { status: 'loading', projects: [], categories: [] }
      : { status: 'ready', ...STATIC_PORTFOLIO }
  );

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    let cancelled = false;
    import('../services/publicProjectService')
      .then(({ fetchPublicPortfolio }) => fetchPublicPortfolio())
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', ...data });
      })
      .catch((err) => {
        console.error('Failed to load projects', err);
        if (!cancelled) setState({ status: 'error', projects: [], categories: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// First-party analytics, loaded on demand and never allowed to break the page.
function track(method, ...args) {
  if (!isFirebaseConfigured) return;
  import('../services/analyticsService')
    .then((analytics) => analytics[method](...args))
    .catch(() => {});
}

// The card's clickable title. The invisible overlay span makes the whole card clickable on desktop.
// Link projects open their primary link in a new tab; posts open the popup viewer.
function ProjectTitleAction({ project, onOpen }) {
  const className =
    'inline-flex items-baseline text-left font-medium leading-tight text-slate-200 hover:text-teal-300 focus-visible:text-teal-300 focus-visible:outline-none group/link text-base';
  const overlay = (
    <span className="absolute -inset-x-4 -inset-y-2.5 hidden rounded md:-inset-x-6 md:-inset-y-4 sm:-inset-y-6 lg:block"></span>
  );

  if (project.display === 'gallery' && onOpen) {
    return (
      <button type="button" className={className} onClick={() => onOpen(project)} aria-haspopup="dialog">
        {overlay}
        <span>{project.title}</span>
      </button>
    );
  }
  if (!project.href) return <span>{project.title}</span>;
  return (
    <a
      className={className}
      href={project.href}
      target="_blank"
      rel="noreferrer noopener"
      onClick={() => track('recordOutboundClick', project.id, project.href)}
    >
      {overlay}
      <span>{project.title}</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

// Shown when a project has no cover image, or when the image fails to load.
export function ThumbnailPlaceholder({ type }) {
  const Icon = type === 'Design' ? FaPalette : FaCode;
  return (
    <div
      className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md border border-slate-700/70"
      style={{
        backgroundImage:
          'radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px), linear-gradient(to bottom right, #1e293b, #0f172a)',
        backgroundSize: '14px 14px, 100% 100%',
      }}
      aria-hidden="true"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-400/10 text-teal-300 ring-1 ring-teal-400/30">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Preview coming soon</span>
    </div>
  );
}

// 16:9 thumbnail. Cloudinary images are served at the size the card needs (320/640/960 px).
// Posts (posters, banners) are shown whole on a dark backdrop instead of being cropped.
function ProjectThumbnail({ project }) {
  const [failed, setFailed] = useState(false);
  if (!project.thumbnail || failed) return <ThumbnailPlaceholder type={project.type} />;

  if (project.display === 'gallery') {
    const slideCount = buildSlides(project).length;
    return (
      <div className="relative aspect-video w-full bg-slate-950">
        <img
          src={fitImageUrl(project.thumbnail, 640, 360)}
          alt={project.thumbnailAlt}
          width="640"
          height="360"
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
        {slideCount > 1 && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
            <FaClone className="h-2.5 w-2.5" aria-hidden="true" />
            {slideCount}
            <span className="sr-only"> images</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={cardImageUrl(project.thumbnail, 640)}
      srcSet={cardImageSrcSet(project.thumbnail)}
      sizes="(min-width: 640px) 360px, 100vw"
      alt={project.thumbnailAlt}
      width="640"
      height="360"
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-video w-full object-cover object-top"
    />
  );
}

export function ProjectCard({ project, onOpen }) {
  const shownTags = project.tags.slice(0, MAX_TAGS);
  const hiddenTags = project.tags.slice(MAX_TAGS);

  return (
    <li className="group relative grid gap-4 rounded-lg p-4 transition-all sm:grid-cols-8 sm:gap-6 md:gap-4 overflow-hidden">
      <div className="absolute -inset-x-4 -inset-y-4 z-0 hidden transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:group-hover:bg-slate-600/15 lg:group-hover:shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] lg:group-hover:drop-shadow-lg"></div>

      <div className="z-10 overflow-hidden rounded-md sm:col-span-3">
        <ProjectThumbnail project={project} />
      </div>

      <div className="z-10 min-w-0 sm:col-span-5">
        <h3 className="font-medium leading-snug text-slate-200">
          <ProjectTitleAction project={project} onOpen={onOpen} />
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-normal">{project.description}</p>

        <ul className="flex flex-wrap gap-2 pt-3" aria-label="Technologies used">
          {shownTags.map((tech) => (
            <li
              key={tech}
              className="flex items-center rounded-full bg-teal-400/10 px-3 py-1 text-xs font-medium leading-4 text-teal-200"
            >
              {tech}
            </li>
          ))}
          {hiddenTags.length > 0 && (
            <li
              className="flex items-center rounded-full bg-teal-400/10 px-3 py-1 text-xs font-medium leading-4 text-teal-200"
              title={hiddenTags.join(', ')}
            >
              +{hiddenTags.length}
              <span className="sr-only">: {hiddenTags.join(', ')}</span>
            </li>
          )}
        </ul>
      </div>
    </li>
  );
}

function ProjectsPage() {
  const [mode, setMode] = useState('design');
  const [category, setCategory] = useState('all');
  const { status, projects: allProjects, categories } = usePortfolioData();
  const activeMode = MODES.find((m) => m.id === mode);
  const [openPost, setOpenPost] = useState(null);
  const pushedHash = useRef(false);

  // Posts get a shareable URL: /#post=<slug>. Opening one adds a history entry so Back closes it.
  const openViewer = useCallback((project) => {
    setOpenPost(project);
    track('recordView', project.id);
    const hash = `#${POST_HASH_PREFIX}${project.slug}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash);
      pushedHash.current = true;
    }
  }, []);

  const closeViewer = useCallback(() => {
    setOpenPost(null);
    if (pushedHash.current) {
      pushedHash.current = false;
      window.history.back();
    } else if (window.location.hash.startsWith(`#${POST_HASH_PREFIX}`)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Open a shared post link once projects have loaded, and follow Back/Forward.
  useEffect(() => {
    if (status !== 'ready') return undefined;
    const sync = () => {
      const hash = window.location.hash;
      const slug = hash.startsWith(`#${POST_HASH_PREFIX}`) ? hash.slice(POST_HASH_PREFIX.length + 1) : null;
      const post = slug && allProjects.find((p) => p.slug === slug && p.display === 'gallery');
      if (post) {
        setMode(MODES.find((m) => m.type === post.type)?.id || 'design');
        setOpenPost(post);
        track('recordView', post.id); // de-duplicated per session, so Back/Forward won't double count
        document.getElementById('projects')?.scrollIntoView();
      } else {
        pushedHash.current = false;
        setOpenPost(null);
      }
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [status, allProjects]);

  const switchMode = (id) => {
    setMode(id);
    setCategory('all');
  };

  const projects = allProjects.filter((p) => p.type === activeMode.type);
  const chips = [
    { id: 'all', label: 'All' },
    ...categories
      .filter((c) => (c.projectTypes || []).includes(activeMode.type))
      .map((c) => ({ id: c.id, label: c.name })),
  ];
  const countFor = (id) => (id === 'all' ? projects.length : projects.filter((p) => p.categoryIds.includes(id)).length);
  const visibleProjects = category === 'all' ? projects : projects.filter((p) => p.categoryIds.includes(category));

  return (
    <div className="pb-2">
      <div className="mb-2 flex items-center justify-between gap-x-3 py-2 sm:gap-x-4">
        <div className="min-w-0 flex-1">
          <h2 className="z-10 text-xl font-bold text-teal-300">Projects</h2>
          <p className="mt-1 text-sm text-slate-400">{activeMode.subtitle}</p>
        </div>
        <div className="flex min-h-[38px] shrink-0 items-stretch rounded-full border border-slate-700 p-0.5 sm:min-h-[46px] sm:p-1" role="group" aria-label="Project type">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => switchMode(id)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300 ${
                mode === id ? 'bg-teal-400/10 text-teal-200' : 'text-slate-400 hover:text-teal-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter projects by category">
        {chips.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-full border pl-3 pr-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300 ${
              category === id
                ? 'border-teal-400/40 bg-teal-400/10 text-teal-200'
                : 'border-slate-700 text-slate-400 hover:text-teal-300'
            }`}
          >
            {label}
            <span
              className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs ${
                category === id ? 'bg-teal-400/20 text-teal-100' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {countFor(id)}
            </span>
          </button>
        ))}
      </div>
      {status === 'loading' && (
        <p className="py-4 text-sm text-slate-400" role="status">Loading projects…</p>
      )}
      {status === 'error' && (
        <p className="py-4 text-sm text-slate-400" role="alert">
          Projects couldn't be loaded right now. Please refresh the page to try again.
        </p>
      )}
      {status === 'ready' && visibleProjects.length === 0 && (
        <p className="py-4 text-sm text-slate-400">
          {projects.length === 0 ? `${activeMode.label} projects are coming soon.` : 'No projects in this category yet.'}
        </p>
      )}
      <ul className="space-y-2">
        {visibleProjects.map((project) => (
          <ProjectCard key={project.id} project={project} onOpen={openViewer} />
        ))}
      </ul>
      {openPost && (
        <PostViewer
          project={openPost}
          categoryNames={openPost.categoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean)}
          onClose={closeViewer}
          onLinkClick={(url) => track('recordOutboundClick', openPost.id, url)}
        />
      )}
    </div>
  );
}

export default ProjectsPage;
