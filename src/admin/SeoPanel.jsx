import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SEO_LEVELS, seoChecks } from '../lib/seoCheck';
import { SITE_URL, seoDescription, seoTitle } from '../lib/pageMeta';
import { ProjectDetails } from '../pages/ProjectPage';
import { buttonClass } from './ui';

const LEVEL_STYLES = {
  success: 'bg-admin-accent-bg text-admin-accent-text',
  warning: 'bg-admin-warn-bg text-admin-warn-text',
  danger: 'bg-admin-danger-bg text-admin-danger-soft',
};

// Small badge for the project list: is this page good enough for search?
export function SeoBadge({ project }) {
  const { level, problems } = seoChecks(project);
  const { label, tone } = SEO_LEVELS[level];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLES[tone]}`}
      title={problems.length ? problems.map((p) => p.label).join(', ') : 'Nothing to improve'}
    >
      {label}
    </span>
  );
}

// "How it will look in Google" plus a checklist. Advice only: it never blocks saving.
// `input` is the editor's project (see toInput in ProjectsAdmin); `fullText` is the long
// description that feeds the Google description when the short one is thin.
export function SeoPanel({ input, type }) {
  const slug = input.slug || 'your-project';
  const project = { ...input, slug };
  const checks = seoChecks(project);
  const title = seoTitle(input.title || 'Project title');
  const description = seoDescription({
    title: input.title || 'Project title',
    type,
    description: input.shortDescription,
    fullDescription: input.description,
  });
  const host = SITE_URL.replace('https://', '');
  const { label, tone } = SEO_LEVELS[checks.level];

  return (
    <section aria-labelledby="seo-heading" className="mt-6 rounded-lg border border-slate-700/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="seo-heading" className="text-sm font-medium text-slate-200">
          Search preview
        </h2>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLES[tone]}`}>
          {label} · {checks.passed}/{checks.total}
        </span>
      </div>
      <p className="mt-1 text-xs text-admin-muted">
        How this project can appear in Google. Google may change it, and new pages take days or weeks to show up.
      </p>

      <div className="mt-3 rounded-md bg-white p-3 text-left" aria-label="Google result preview">
        <p className="truncate text-xs text-slate-600">
          {host} › projects › {slug}
        </p>
        <p className="mt-0.5 text-lg leading-snug text-[#1a0dab]">{title}</p>
        <p className="mt-0.5 text-sm leading-snug text-slate-700">{description}</p>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-admin-muted">
        <span className={title.length > 70 ? 'text-admin-warn-text' : undefined}>Title {title.length}/70</span>
        <span className={description.length > 158 ? 'text-admin-warn-text' : undefined}>
          Description {description.length}/158
        </span>
        <span>{checks.words} words of text</span>
      </p>

      <ul className="mt-3 space-y-2" aria-label="Search checklist">
        {checks.items.map((item) => (
          <li key={item.id} className="flex gap-2 text-xs">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                item.ok ? 'bg-admin-accent-bg text-admin-accent-text' : 'bg-admin-warn-bg text-admin-warn-text'
              }`}
              aria-hidden="true"
            >
              {item.ok ? '✓' : '!'}
            </span>
            <span>
              <span className="font-medium text-slate-200">{item.label}.</span>{' '}
              <span className="text-admin-muted">{item.tip}</span>
              <span className="sr-only">{item.ok ? ' Done.' : ' Needs attention.'}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled])';

// Full-screen preview of the public project page, built from the editor's current (even unsaved)
// values. It is not a public page: nothing is saved, counted or indexed.
export function PagePreview({ project, categories, onClose }) {
  const closeRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const items = [...(rootRef.current?.querySelectorAll(FOCUSABLE) || [])];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Project page preview"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-950/95 px-4 py-2.5 backdrop-blur">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-teal-300">Preview</span> · this is how the page will look. It is not
          public and nothing here is saved.
        </p>
        <button ref={closeRef} type="button" className={buttonClass.secondary} onClick={onClose}>
          Close preview
        </button>
      </div>
      <ProjectDetails project={project} categories={categories} preview />
    </div>,
    document.body
  );
}
