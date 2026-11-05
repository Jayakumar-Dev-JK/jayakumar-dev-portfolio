import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaExternalLinkAlt } from 'react-icons/fa';
import { isFirebaseConfigured } from '../lib/firebaseConfig';
import { fitImageSrcSet, fitImageUrl } from '../lib/images';
import { SITE_NAME, SITE_URL, seoDescription, seoTitle, usePageMeta } from '../lib/pageMeta';
import { resolveProject } from '../lib/projectLookup';
import { STATIC_PORTFOLIO } from '../components/projects';
import NotFound from './NotFound';

// First-party analytics, loaded on demand and never allowed to break the page.
function track(method, ...args) {
  if (!isFirebaseConfigured) return;
  import('../services/analyticsService')
    .then((analytics) => analytics[method](...args))
    .catch(() => {});
}

// Loads the published project with this slug. Firebase is loaded on demand, as on the homepage.
function useProject(slug) {
  const [state, setState] = useState(() =>
    isFirebaseConfigured
      ? { status: 'loading', project: null, redirectTo: null, categories: [] }
      : {
          status: 'ready',
          ...resolveProject(STATIC_PORTFOLIO.projects, slug),
          categories: STATIC_PORTFOLIO.categories,
        }
  );

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({
        status: 'ready',
        ...resolveProject(STATIC_PORTFOLIO.projects, slug),
        categories: STATIC_PORTFOLIO.categories,
      });
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'loading', project: null, redirectTo: null, categories: [] });
    import('../services/publicProjectService')
      .then(({ fetchPublicPortfolio }) => fetchPublicPortfolio())
      .then(({ projects, categories }) => {
        if (!cancelled) setState({ status: 'ready', ...resolveProject(projects, slug), categories });
      })
      .catch((err) => {
        console.error('Failed to load project', err);
        if (!cancelled) setState({ status: 'error', project: null, redirectTo: null, categories: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}

const pageShell = 'min-h-screen bg-slate-900 px-6 py-12 text-slate-400 antialiased md:px-12 md:py-16';

function buildJsonLd(project, canonical, image, description) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      '@id': `${canonical}#project`,
      name: project.title,
      description,
      url: canonical,
      image,
      genre: project.type === 'Design' ? 'UI/UX design' : 'Web development',
      keywords: project.tags.join(', ') || undefined,
      author: { '@id': `${SITE_URL}/#person` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Projects', item: `${SITE_URL}/#projects` },
        { '@type': 'ListItem', position: 3, name: project.title, item: canonical },
      ],
    },
  ];
}

const paragraphsOf = (text) =>
  String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

// One headed section of the case study (problem / process / outcome).
function CaseStudySection({ heading, text }) {
  const paragraphs = paragraphsOf(text);
  if (!paragraphs.length) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-teal-300">{heading}</h2>
      <div className="mt-3 space-y-4 leading-relaxed">
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

// `preview` is the admin's "Preview page": it shows exactly what visitors will see, but leaves
// the page's head tags and the view counter alone and keeps every link on the page.
export function ProjectDetails({ project, categories, preview = false }) {
  const canonical = `${SITE_URL}/projects/${project.slug || project.id}`;
  const description = seoDescription(project);
  const image = project.thumbnail || `${SITE_URL}/logo512.png`;
  const jsonLd = useMemo(
    () => buildJsonLd(project, canonical, image, description),
    [project, canonical, image, description]
  );
  usePageMeta({ title: seoTitle(project.title), description, image, canonical, jsonLd, enabled: !preview });

  useEffect(() => {
    if (!preview) track('recordView', project.id);
  }, [project.id, preview]);

  const categoryNames = (project.categoryIds || [])
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean);
  const paragraphs = paragraphsOf(project.fullDescription);
  const facts = [
    project.role && { label: 'Role', value: project.role },
    project.year && { label: 'Year', value: project.year },
  ].filter(Boolean);
  const images = project.gallery?.length
    ? project.gallery
    : project.thumbnail
      ? [{ url: project.thumbnail, alt: project.thumbnailAlt }]
      : [];
  const links = [...(project.href ? [{ label: 'View project', url: project.href }] : []), ...(project.links || [])];

  return (
    <main className={pageShell}>
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="text-sm">
          {preview ? (
            <span className="inline-flex items-center gap-2 font-medium text-slate-300">
              <FaArrowLeft className="h-3 w-3" aria-hidden="true" />
              {SITE_NAME} / Projects
            </span>
          ) : (
            <Link
              to="/"
              state={{ scrollTo: 'projects' }}
              className="inline-flex items-center gap-2 font-medium text-slate-300 hover:text-teal-300 focus-visible:outline-none focus-visible:text-teal-300"
            >
              <FaArrowLeft className="h-3 w-3" aria-hidden="true" />
              {SITE_NAME} / Projects
            </Link>
          )}
        </nav>

        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">
            {[project.type, ...categoryNames].join(' · ')}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-slate-200 sm:text-4xl">
            {project.title}
          </h1>
          {project.description && <p className="mt-4 text-lg leading-relaxed">{project.description}</p>}
          {facts.length > 0 && (
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {facts.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</dt>
                  <dd className="mt-0.5 font-medium text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </header>

        {project.videoEmbedUrl && (
          <div className="mt-8 aspect-video overflow-hidden rounded-lg border border-slate-700 bg-black">
            <iframe
              title={`${project.title} video`}
              src={project.videoEmbedUrl}
              className="h-full w-full"
              allow="encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
            />
          </div>
        )}

        {images.length > 0 && (
          <div className="mt-8 space-y-4">
            {images.map((img, i) => (
              <img
                key={img.url}
                src={fitImageUrl(img.url, 1080)}
                srcSet={fitImageSrcSet(img.url)}
                sizes="(min-width: 768px) 768px, 100vw"
                alt={img.alt || `${project.title} - screen ${i + 1}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchpriority={i === 0 ? 'high' : undefined}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 object-contain"
              />
            ))}
          </div>
        )}

        {paragraphs.length > 0 && (
          <section className="mt-8 space-y-4 leading-relaxed" aria-label="About this project">
            {paragraphs.map((text) => (
              <p key={text} className="whitespace-pre-line">
                {text}
              </p>
            ))}
          </section>
        )}

        <CaseStudySection heading="The problem" text={project.problem} />
        <CaseStudySection heading="Process" text={project.process} />
        <CaseStudySection heading="Outcome" text={project.outcome} />

        {project.tags.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-teal-300">Technologies</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {project.tags.map((tech) => (
                <li
                  key={tech}
                  className="rounded-full bg-teal-400/10 px-3 py-1 text-xs font-medium leading-4 text-teal-200"
                >
                  {tech}
                </li>
              ))}
            </ul>
          </section>
        )}

        {links.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-teal-300">Links</h2>
            <ul className="mt-3 flex flex-wrap gap-3">
              {links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={() => !preview && track('recordOutboundClick', project.id, link.url)}
                    className="inline-flex items-center gap-2 rounded-full border border-teal-400/40 bg-teal-400/10 px-4 py-2 text-sm font-medium text-teal-200 hover:text-teal-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300"
                  >
                    {link.label}
                    <FaExternalLinkAlt className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}

export default function ProjectPage() {
  const { slug } = useParams();
  const { status, project, redirectTo, categories } = useProject(slug);

  if (status === 'loading') {
    return (
      <main className={pageShell}>
        <p className="mx-auto max-w-3xl text-sm" role="status">
          Loading project…
        </p>
      </main>
    );
  }
  if (status === 'error') {
    return (
      <main className={pageShell}>
        <p className="mx-auto max-w-3xl text-sm" role="alert">
          This project couldn't be loaded right now. Please refresh the page to try again.
        </p>
      </main>
    );
  }
  // A project that was renamed: its old address leads to the current one.
  if (redirectTo) return <Navigate to={redirectTo} replace />;
  if (!project) return <NotFound />;
  return <ProjectDetails project={project} categories={categories} />;
}
