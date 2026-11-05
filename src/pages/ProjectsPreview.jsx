import React, { useEffect, useMemo, useState } from 'react';
import App from '../App';
import { sampleProjects } from '../data/sampleProjects';

// TEMPORARY REVIEW PAGE: the real portfolio (the actual App, so the layout, navigation, hero, About,
// Experience, Skills, Contact and Footer are exactly the live ones) with only the Projects replaced by
// sample data, plus a small review panel. Local development only (see src/index.js).
// Delete this file, src/data/sampleProjects.js, the route in src/index.js and the `projectsData` prop in
// src/App.js after approval.

// Mirrors what the section measured, so the reviewer can see WHY sticky is on or off.
function useSectionReadout() {
  const [readout, setReadout] = useState(null);
  useEffect(() => {
    const read = () => {
      const el = document.querySelector('[data-projects-section]');
      if (el) setReadout({ sticky: el.dataset.sticky === 'on', content: el.dataset.contentHeight, available: el.dataset.availableHeight });
    };
    read();
    const observer = new MutationObserver(read);
    let watched = null;
    const watch = () => {
      const el = document.querySelector('[data-projects-section]');
      if (el && el !== watched) {
        observer.disconnect();
        observer.observe(el, { attributes: true });
        watched = el;
        read();
      }
    };
    watch();
    const timer = setInterval(watch, 400); // the section mounts after its code has loaded
    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, []);
  return readout;
}

export default function ProjectsPreview() {
  const [size, setSize] = useState('full');
  const [open, setOpen] = useState(() => window.innerWidth >= 1024);
  const data = useMemo(() => sampleProjects(size), [size]);
  const readout = useSectionReadout();

  const choice = (value, label) => (
    <button
      type="button"
      aria-pressed={size === value}
      onClick={() => setSize(value)}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300 ${
        size === value ? 'border-teal-400/40 bg-teal-400/10 text-teal-200' : 'border-slate-600 text-slate-300 hover:text-teal-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      // Sample project links must not leave the review; every other link works as on the live page.
      onClickCapture={(e) => {
        const link = e.target.closest('a');
        if (link && link.getAttribute('href')?.startsWith('/projects/')) e.preventDefault();
      }}
    >
      <App projectsData={data} />

      <aside className="fixed bottom-3 right-3 z-[60] max-w-[min(20rem,calc(100vw-1.5rem))] text-slate-300" aria-label="Review panel">
        {open ? (
          <div className="rounded-xl border border-slate-600 bg-slate-950 p-3 text-xs shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-100">Temporary review · sample projects</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-slate-300 hover:text-teal-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300"
              >
                Hide
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Sample data">
              {choice('full', '10 Design + 5 Dev')}
              {choice('short', 'Short: 3 + 2')}
            </div>
            <p className="mt-3 font-medium text-slate-100" aria-live="polite">
              Sticky tabs: {readout ? (readout.sticky ? 'ON' : 'OFF') : '…'}
            </p>
            {readout && (
              <p className="mt-0.5 text-slate-400">
                Section {readout.content}px, visible {readout.available}px.{' '}
                {readout.sticky ? 'Taller than the screen, so the tabs pin.' : 'Fits on screen, so nothing pins.'}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-slate-600 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-2xl hover:text-teal-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300"
          >
            Review panel
          </button>
        )}
      </aside>
    </div>
  );
}
