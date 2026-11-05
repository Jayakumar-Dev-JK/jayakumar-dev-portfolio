import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fitImageSrcSet, fitImageUrl } from '../lib/images';

// Instagram-style popup for design posts (posters, banners…): image carousel + details.

// Video (if any) first, then the gallery images; falls back to the cover image.
export function buildSlides(project) {
  const slides = [];
  if (project.videoEmbedUrl) slides.push({ kind: 'embed', src: project.videoEmbedUrl });
  else if (project.videoFileUrl) slides.push({ kind: 'video', src: project.videoFileUrl });
  const images = project.gallery?.length
    ? project.gallery
    : project.thumbnail
      ? [{ url: project.thumbnail, alt: project.thumbnailAlt }]
      : [];
  images.forEach((img) => slides.push({ kind: 'image', src: img.url, alt: img.alt || project.title }));
  return slides;
}

const SWIPE_PX = 40;
const FOCUSABLE = 'a[href], button:not([disabled]), iframe, video[controls], [tabindex]:not([tabindex="-1"])';

function Chevron({ direction }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      {direction === 'left' ? (
        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
      ) : (
        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
      )}
    </svg>
  );
}

function Slide({ slide }) {
  if (slide.kind === 'embed') {
    return (
      <iframe
        title="Project video"
        src={slide.src}
        className="h-full w-full"
        allow="encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }
  if (slide.kind === 'video') {
    return (
      <video src={slide.src} controls playsInline preload="metadata" className="h-full w-full object-contain">
        <track kind="captions" />
      </video>
    );
  }
  return (
    <img
      src={fitImageUrl(slide.src, 1080)}
      srcSet={fitImageSrcSet(slide.src)}
      sizes="(min-width: 768px) 600px, 100vw"
      alt={slide.alt}
      className="h-full w-full object-contain"
      draggable="false"
    />
  );
}

export default function PostViewer({ project, categoryNames = [], onClose, onLinkClick }) {
  const slides = useMemo(() => buildSlides(project), [project]);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const touchX = useRef(null);
  const titleId = useId();

  const go = useCallback((step) => setIndex((i) => Math.min(Math.max(i + step, 0), slides.length - 1)), [slides.length]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        go(1);
      } else if (e.key === 'ArrowLeft') {
        go(-1);
      } else if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const items = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])];
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
  }, [go, onClose]);

  const slide = slides[index];
  const navButton =
    'absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/70 text-slate-100 transition-colors hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300';
  const links = [...(project.href ? [{ label: 'View project', url: project.href, primary: true }] : []), ...(project.links || [])];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[100dvh] w-full max-w-5xl flex-col overflow-y-auto bg-slate-900 text-slate-400 antialiased sm:h-auto sm:max-h-[90vh] sm:rounded-lg sm:border sm:border-slate-700 md:flex-row md:overflow-hidden"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/80 text-slate-100 hover:text-teal-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>

        {/* Media */}
        <div
          className="relative shrink-0 bg-black md:w-3/5"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="aspect-[4/5] max-h-[70dvh] w-full md:aspect-auto md:h-[min(90vh,46rem)] md:max-h-none">
            {slide ? <Slide key={index} slide={slide} /> : <div className="h-full w-full bg-slate-800" />}
          </div>

          {slides.length > 1 && (
            <>
              {index > 0 && (
                <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={`${navButton} left-3`}>
                  <Chevron direction="left" />
                </button>
              )}
              {index < slides.length - 1 && (
                <button type="button" onClick={() => go(1)} aria-label="Next image" className={`${navButton} right-3`}>
                  <Chevron direction="right" />
                </button>
              )}
              <span className="absolute left-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-slate-100" aria-hidden="true">
                {index + 1} / {slides.length}
              </span>
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show image ${i + 1} of ${slides.length}`}
                    aria-current={i === index ? 'true' : undefined}
                    className={`h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300 ${
                      i === index ? 'w-4 bg-teal-300' : 'w-1.5 bg-slate-300/60 hover:bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <p className="sr-only" aria-live="polite">
                Image {index + 1} of {slides.length}
              </p>
            </>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 p-6 md:overflow-y-auto">
          <p className="pr-10 text-xs font-semibold uppercase tracking-widest text-teal-300">
            {[project.type, ...categoryNames].join(' · ')}
          </p>
          <h2 id={titleId} className="mt-2 text-xl font-bold leading-snug text-slate-200">
            {project.title}
          </h2>
          {project.description && <p className="mt-3 text-sm leading-relaxed">{project.description}</p>}
          {project.fullDescription && (
            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              {project.fullDescription.split(/\n\s*\n/).map((paragraph, i) => (
                <p key={i} className="whitespace-pre-line">{paragraph}</p>
              ))}
            </div>
          )}
          {project.tags?.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Tools">
              {project.tags.map((tag) => (
                <li key={tag} className="flex items-center rounded-full bg-teal-400/10 px-3 py-1 text-xs font-medium leading-4 text-teal-200">
                  {tag}
                </li>
              ))}
            </ul>
          )}
          {links.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2" aria-label="Project links">
              {links.map((link) => (
                <li key={`${link.label}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={() => onLinkClick?.(link.url)}
                    className={`text-sm font-semibold hover:text-teal-200 ${link.primary ? 'text-teal-300' : 'text-slate-200'}`}
                  >
                    {link.label} ↗<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {project.slug && (
            <p className="mt-6 text-sm">
              <a href={`/projects/${project.slug}`} className="font-semibold text-slate-200 hover:text-teal-200">
                Open full page
              </a>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
