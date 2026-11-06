import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
export const STATIC_PORTFOLIO = {
  projects: LEGACY_PROJECTS.map((p, index) => ({
    id: p.slug,
    slug: p.slug,
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
function usePortfolioData(override) {
  const [state, setState] = useState(() =>
    isFirebaseConfigured
      ? { status: 'loading', projects: [], categories: [] }
      : { status: 'ready', ...STATIC_PORTFOLIO }
  );

  useEffect(() => {
    if (override || !isFirebaseConfigured) return undefined;
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
  }, [Boolean(override)]); // eslint-disable-line react-hooks/exhaustive-deps

  return override ? { status: 'ready', ...override } : state;
}

// First-party analytics, loaded on demand and never allowed to break the page.
function track(method, ...args) {
  if (!isFirebaseConfigured) return;
  import('../services/analyticsService')
    .then((analytics) => analytics[method](...args))
    .catch(() => { });
}

// The card's clickable title. The invisible overlay span makes the whole card clickable on desktop.
// Link projects open their own page; posts open the popup viewer.
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
  // Link projects open their own page (real URL, indexable); the external link is on that page.
  const slug = project.slug || project.id;
  if (!slug) return <span>{project.title}</span>;
  return (
    <Link className={className} to={`/projects/${slug}`}>
      {overlay}
      <span>{project.title}</span>
    </Link>
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
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Preview coming soon</span>
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
          className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
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
      className="aspect-video w-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
    />
  );
}

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// The nearest ancestor that really scrolls (a fixed-height box with overflow). When there is none,
// the page itself scrolls. A tall box that only grows with its content is not a scroller.
function findScrollRoot(el) {
  for (let node = el?.parentElement; node && node !== document.body; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.getBoundingClientRect().height <= window.innerHeight + 1) {
      return node;
    }
  }
  return null;
}

// Decides whether the heading and tabs should stick, from real measurements only (never from how many
// projects there are): sticky is on exactly when the section's full rendered height is taller than the
// room the visitor can see. Re-measured whenever the section resizes (tab switch, data, fonts, images,
// responsive layout) or the viewport changes. No scroll listeners.
function useStickyDecision(sectionRef, barRef) {
  const [m, setM] = useState({ sticky: false, content: 0, available: 0, top: 0, bar: 0 });
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = findScrollRoot(section);
        // On phones the page scrolls and a fixed header (data-fixed-header) covers its top edge.
        const fixed = root ? null : document.querySelector('[data-fixed-header]');
        const top = fixed ? Math.round(fixed.getBoundingClientRect().height) : 0;
        const viewport = root ? root.clientHeight : window.visualViewport?.height || window.innerHeight;
        const available = Math.round(viewport - top);
        const content = Math.round(section.offsetHeight);
        const bar = Math.round(barRef.current?.offsetHeight || 0);
        const sticky = content > available;
        setM((prev) =>
          prev.sticky === sticky && prev.content === content && prev.available === available && prev.top === top && prev.bar === bar
            ? prev
            : { sticky, content, available, top, bar }
        );
      });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(section);
    const root = findScrollRoot(section);
    observer?.observe(root || document.documentElement);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    document.fonts?.ready?.then(measure); // web fonts change line heights
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, [sectionRef, barRef]);
  return m;
}

// Fades a card in when it scrolls into view. Without IntersectionObserver, or when the visitor
// prefers reduced motion, cards are simply shown.
function useReveal(enabled) {
  const ref = useRef(null);
  const [shown, setShown] = useState(
    () => !enabled || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()
  );
  useEffect(() => {
    if (shown || !ref.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [shown]);
  return [ref, shown];
}

// `reveal` (the card's position in the list) turns on the scroll-in animation.
export function ProjectCard({ project, onOpen, reveal, scrollMargin }) {
  const shownTags = project.tags.slice(0, MAX_TAGS);
  const hiddenTags = project.tags.slice(MAX_TAGS);
  const animated = reveal !== undefined;
  const [revealRef, shown] = useReveal(animated);

  return (
    <li
      ref={revealRef}
      style={{
        ...(animated && !shown ? { transitionDelay: `${(reveal % 4) * 70}ms` } : null),
        ...(scrollMargin ? { scrollMarginTop: scrollMargin } : null),
      }}
      className={`group relative grid gap-4 rounded-lg p-4 transition-all sm:grid-cols-8 sm:gap-6 md:grid-cols-1 md:gap-4 lg:grid-cols-8 overflow-hidden lg:hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${animated ? `duration-500 ease-out motion-reduce:transition-none ${shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}` : ''
        }`}
    >
      <div className="absolute -inset-x-4 -inset-y-4 z-0 hidden transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:group-hover:bg-slate-600/15 lg:group-hover:shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] lg:group-hover:drop-shadow-lg"></div>

      <div className="z-10 overflow-hidden rounded-md sm:col-span-3 md:col-span-1 lg:col-span-3">
        <ProjectThumbnail project={project} />
      </div>

      <div className="z-10 min-w-0 sm:col-span-5 md:col-span-1 lg:col-span-5">
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

// The category to show first in a tab: "Websites" when it has projects, otherwise the first category that
// does. There is no "All" chip, so every tab always opens on a real category.
function defaultCategory(projects, chips) {
  const filled = (id) => projects.some((p) => p.categoryIds.includes(id));
  return (chips.find((c) => c.id === 'websites' && filled(c.id)) || chips.find((c) => filled(c.id)) || chips[0])?.id ?? null;
}

// `data` replaces the Firestore data (used by the tests).
function ProjectsPage({ data }) {
  const [mode, setMode] = useState('design');
  const [category, setCategory] = useState(null); // null = this tab's default category
  const { status, projects: allProjects, categories } = usePortfolioData(data);
  const activeMode = MODES.find((m) => m.id === mode);
  const [openPost, setOpenPost] = useState(null);
  const pushedHash = useRef(false);

  const sectionRef = useRef(null);
  const barRef = useRef(null);
  const sentinelRef = useRef(null);
  const { sticky, content, available, top: stickyTop, bar: barHeight } = useStickyDecision(sectionRef, barRef);
  const [stuck, setStuck] = useState(false);

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

  // A divider appears under the bar once it has actually stuck (IntersectionObserver, no scroll listener).
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sticky || !sentinel || typeof IntersectionObserver === 'undefined') {
      setStuck(false);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) + 1),
      { rootMargin: `-${stickyTop + 1}px 0px 0px 0px` }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sticky, stickyTop]);

  const projects = allProjects.filter((p) => p.type === activeMode.type);
  const countFor = (id) => projects.filter((p) => p.categoryIds.includes(id)).length;
  // A category with no projects in this tab gets no chip: there would be nothing to show behind it.
  const chips = categories
    .filter((c) => (c.projectTypes || []).includes(activeMode.type) && countFor(c.id) > 0)
    .map((c) => ({ id: c.id, label: c.name }));
  // A chosen category that has since emptied (data changed) falls back to the tab's default.
  const activeCategory = chips.some((c) => c.id === category) ? category : defaultCategory(projects, chips);
  // A tab with no categories configured simply lists all of its projects.
  const visibleProjects = chips.length === 0 ? projects : projects.filter((p) => p.categoryIds.includes(activeCategory));

  // Switching tabs while scrolled deep lands on the first card of the new list, not mid-air.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const section = sectionRef.current;
    if (section && section.getBoundingClientRect().top < stickyTop - 1) {
      section.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }, [mode, activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (id) => {
    setMode(id);
    setCategory(null);
  };

  // The pinned bar lets go while about half a screen of the list is still below it, so the last cards and the
  // next section arrive in an ordinary page scroll instead of squeezing against a pinned bar. A sticky element
  // stays inside its container including its own bottom margin, so a margin on the bar sets the release point;
  // the list's equal negative top margin cancels it, which leaves the layout exactly where it was.
  const release = sticky && status === 'ready' && visibleProjects.length > 0 ? Math.round(available * 0.45) : 0;

  return (
    <div
      ref={sectionRef}
      data-projects-section=""
      data-sticky={sticky ? 'on' : 'off'}
      data-content-height={content}
      data-available-height={available}
      className="pb-2"
      style={{ '--projects-top': `${stickyTop}px`, scrollMarginTop: stickyTop }}
    >
      <div ref={sentinelRef} aria-hidden="true" className="-mb-px h-px" />
      {/* No background on purpose (the owner asked for none): while pinned, cards scroll under the bar and show through it. */}
      <div
        ref={barRef}
        data-projects-bar=""
        className={`z-20 pb-1.5 transition-[border-color] duration-200 sm:pb-2 lg:-mx-6 lg:px-6 ${
          sticky ? 'sticky top-[var(--projects-top,0px)]' : 'relative'
        } border-b ${stuck ? 'border-slate-800' : 'border-transparent'}`}
        style={release ? { marginBottom: release } : undefined}
      >
        <div className="flex items-center justify-between gap-x-3 py-1.5 sm:gap-x-4">
          <div className="min-w-0 flex-1">
            <h2 className="z-10 text-xl font-bold text-teal-300">Projects</h2>
            <p className="mt-1 hidden text-sm text-slate-400 sm:block">{activeMode.subtitle}</p>
          </div>
          <div className="flex min-h-10 shrink-0 items-stretch rounded-full border border-slate-700 p-0.5 sm:min-h-[46px] sm:p-1" role="group" aria-label="Project type">
            {MODES.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => switchMode(id)}
                className={`relative flex items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] sm:gap-2 sm:px-4 sm:text-sm sm:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300 ${mode === id ? 'bg-teal-400/10 text-teal-200' : 'text-slate-400 hover:text-teal-300'
                  }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        {chips.length > 0 && (
          <div className="-mb-1.5 -mt-0.5 flex gap-2 overflow-x-auto py-1.5 sm:mb-0 sm:mt-1 sm:py-0 sm:pb-1" role="group" aria-label="Filter projects by category">
            {chips.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={activeCategory === id}
                onClick={() => setCategory(id)}
                className={`relative flex h-8 shrink-0 items-center gap-2 rounded-full border pl-3 pr-1.5 text-sm font-medium transition-colors before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-[''] sm:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300 sm:h-9 ${activeCategory === id
                    ? 'border-teal-400/40 bg-teal-400/10 text-teal-200'
                    : 'border-slate-700 text-slate-400 hover:text-teal-300'
                  }`}
              >
                {label}
                <span
                  className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs sm:h-6 sm:min-w-[1.5rem] ${activeCategory === id ? 'bg-teal-400/20 text-teal-100' : 'bg-slate-800 text-slate-400'
                    }`}
                >
                  {countFor(id)}
                </span>
              </button>
            ))}
          </div>
        )}
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
      {/* One column on phones, two on tablets (cards stack), one wide list beside the intro on desktop. */}
      <ul
        className="space-y-2 pt-3 md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-2 md:space-y-0 lg:block lg:space-y-2"
        style={release ? { marginTop: -release } : undefined}
      >
        {visibleProjects.map((project, index) => (
          <ProjectCard
            key={`${mode}-${activeCategory}-${project.id}`}
            project={project}
            onOpen={openViewer}
            reveal={index}
            // A card scrolled into view by the keyboard must clear the pinned bar.
            scrollMargin={sticky ? stickyTop + barHeight + 8 : undefined}
          />
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
