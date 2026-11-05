import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCheck, FaExclamation } from 'react-icons/fa';
import { SEO_LEVELS, seoChecks } from '../lib/seoCheck';
import { SITE_NAME, SITE_URL, seoDescription, seoTitle } from '../lib/pageMeta';
import { ProjectDetails } from '../pages/ProjectPage';
import { buttonClass, Icon, SegmentedControl, smallButtonClass } from './ui';

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

// Scrolls the editor to a field and focuses it. The top bar is sticky; admin.css pads the scroll.
export function goToField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  el.focus({ preventScroll: true });
}

const METER_STATES = {
  empty: { text: 'Empty', bar: 'bg-admin-border', tone: 'text-admin-muted' },
  short: { text: 'A bit short', bar: 'bg-amber-300', tone: 'text-admin-warn-text' },
  good: { text: 'Good length', bar: 'bg-admin-accent-bright', tone: 'text-admin-accent-text' },
  long: { text: 'Too long, Google will cut it', bar: 'bg-amber-300', tone: 'text-admin-warn-text' },
};

// How long a piece of text is against what Google shows. The state is written out, not only coloured.
function LengthMeter({ label, value, min, max }) {
  const state = value === 0 ? 'empty' : value < min ? 'short' : value > max ? 'long' : 'good';
  const { text, bar, tone } = METER_STATES[state];
  const labelId = `meter-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span id={labelId} className="font-medium text-admin-label">{label}</span>
        <span className={tone}>
          <span className="tabular-nums">{value}/{max}</span> · {text}
        </span>
      </div>
      <div
        role="meter"
        aria-labelledby={labelId}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={`${value} of ${max} characters. ${text}.`}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-admin-draft-bg"
      >
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

// "How it will look in Google" plus what to improve. Advice only: it never blocks saving.
// `input` is the editor's project (see toInput in ProjectsAdmin).
export function SeoPanel({ input, type }) {
  const [device, setDevice] = useState('desktop');
  const slug = input.slug || 'your-project';
  const checks = seoChecks({ ...input, slug });
  const title = seoTitle(input.title || 'Project title');
  const description = seoDescription({
    title: input.title || 'Project title',
    type,
    description: input.shortDescription,
    fullDescription: input.description,
  });
  const host = SITE_URL.replace('https://', '');
  const { label, tone } = SEO_LEVELS[checks.level];
  const passed = checks.items.filter((item) => item.ok);
  const mobile = device === 'mobile';

  return (
    <section aria-labelledby="seo-heading" className="mt-6 border-t border-admin-subtle pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="seo-heading" className="text-sm font-medium text-admin-label">
          Search preview
        </h2>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLES[tone]}`}>
          {label}
        </span>
      </div>
      <p className="mt-1 text-xs text-admin-muted">
        How this project can appear in Google. Google may rewrite it, and new pages take days or weeks to show up.
      </p>

      <SegmentedControl
        className="mt-3"
        ariaLabel="Preview device"
        value={device}
        onChange={setDevice}
        options={[
          { value: 'desktop', label: 'Desktop' },
          { value: 'mobile', label: 'Mobile' },
        ]}
      />

      <div
        aria-label="Google result preview"
        role="group"
        className={`mt-3 rounded-lg bg-white p-4 text-left ${mobile ? 'mx-auto max-w-[360px]' : ''}`}
      >
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
            J
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-[#202124]">{SITE_NAME}</p>
            <p className="truncate text-xs text-[#4d5156]">
              {host} › projects › {slug}
            </p>
          </div>
        </div>
        <p className={`mt-2 line-clamp-2 break-words text-[#1a0dab] ${mobile ? 'text-lg leading-6' : 'text-xl leading-7'}`}>{title}</p>
        <p className="mt-1 line-clamp-3 break-words text-sm leading-[22px] text-[#4d5156]">{description}</p>
      </div>

      <div className="mt-4 space-y-3">
        <LengthMeter label="Page title" value={title.length} min={25} max={70} />
        <LengthMeter label="Description" value={description.length} min={70} max={158} />
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-admin-subtle pt-4">
        <h3 className="text-sm font-medium text-admin-label">
          {checks.problems.length ? `To improve (${checks.problems.length})` : 'Checklist'}
        </h3>
        <p className="text-xs text-admin-muted">
          <span className="tabular-nums">{checks.passed}</span> of <span className="tabular-nums">{checks.total}</span> checks passed
          {checks.words ? <> · <span className="tabular-nums">{checks.words}</span> words</> : null}
        </p>
      </div>

      {checks.problems.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-admin-accent-text">
          <Icon as={FaCheck} size={12} />
          Everything looks good for search.
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-admin-subtle" aria-label="Things to improve">
          {checks.problems.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-admin-warn-bg text-admin-warn-text"
              >
                <Icon as={FaExclamation} size={10} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-admin-label">{item.label}</p>
                <p className="mt-0.5 text-xs text-admin-muted">{item.tip}</p>
              </div>
              <button
                type="button"
                className={`${smallButtonClass.secondary} shrink-0`}
                onClick={() => goToField(item.field)}
                aria-label={`Fix: ${item.label}`}
              >
                Fix
              </button>
            </li>
          ))}
        </ul>
      )}

      {passed.length > 0 && (
        <details className="group mt-2 border-t border-admin-subtle pt-3">
          <summary className="cursor-pointer select-none rounded text-xs font-medium text-admin-muted hover:text-admin-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent">
            Passed checks ({passed.length})
          </summary>
          <ul className="mt-2 space-y-2" aria-label="Passed checks">
            {passed.map((item) => (
              <li key={item.id} className="flex items-start gap-3 text-xs">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-admin-accent-bg text-admin-accent-text"
                >
                  <Icon as={FaCheck} size={10} />
                </span>
                <span className="min-w-0">
                  <span className="font-medium text-admin-label">{item.label}.</span>{' '}
                  <span className="text-admin-muted">{item.tip}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
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
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-4 py-2.5">
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
