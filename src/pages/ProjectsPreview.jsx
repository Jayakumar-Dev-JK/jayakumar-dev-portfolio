import React, { useEffect, useMemo, useState } from 'react';
import ProjectsPage from '../components/projects';
import { sampleProjects } from '../data/sampleProjects';

// TEMPORARY REVIEW PAGE: the real Projects section, fed sample data, inside a copy of the site's scrolling
// layout (two columns on desktop, one scrolling page on phones), so the sticky tabs, the card animations
// and the hand-off into the next section can be judged without touching real content.
// Local development only (see src/index.js). Delete this file, src/data/sampleProjects.js and the route
// in src/index.js after approval.

function Choice({ label, value, options, onChange }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300 ${
              value === option.value
                ? 'border-teal-400/40 bg-teal-400/10 text-teal-200'
                : 'border-slate-700 text-slate-400 hover:text-teal-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    const el = document.querySelector('[data-projects-section]');
    if (el) observer.observe(el, { attributes: true });
    // The section element is replaced when the sample size changes; look again shortly after.
    const timer = setInterval(() => {
      const current = document.querySelector('[data-projects-section]');
      if (current && current !== el) {
        clearInterval(timer);
        read();
      }
    }, 300);
    return () => {
      observer.disconnect();
      clearInterval(timer);
    };
  }, []);
  return readout;
}

const FILLER = [
  'I am a UI/UX designer who builds clear, accessible product experiences for web and mobile. This paragraph only exists so there is something above the projects section to scroll past.',
  'My process starts with research and ends with a shipped, tested interface. More placeholder copy follows, so the page behaves like the real portfolio when you scroll.',
];

function Filler({ title, id }) {
  return (
    <section id={id} className="mt-4 space-y-4 py-10">
      <h2 className="text-xl font-bold text-teal-300">{title}</h2>
      {FILLER.map((text) => (
        <p key={text}>{text}</p>
      ))}
      <p>{title} placeholder. After the last project, scrolling simply carries on into this section.</p>
    </section>
  );
}

export default function ProjectsPreview() {
  const [size, setSize] = useState('full');
  const data = useMemo(() => sampleProjects(size), [size]);
  const readout = useSectionReadout();

  return (
    <div className="bg-slate-900 leading-relaxed text-slate-400 antialiased selection:bg-teal-300 selection:text-teal-900 lg:h-screen">
      <div data-fixed-header="" className="fixed top-0 z-40 w-full border-b-2 border-slate-500 bg-slate-900 px-6 py-2 text-lg font-medium text-slate-200 lg:hidden">
        Projects review
      </div>
      <div className="mx-auto h-full max-w-screen-xl px-6 py-12 md:px-12 md:py-20 lg:px-20 lg:py-0">
        <div className="h-full lg:flex lg:justify-between lg:gap-2 lg:py-8">
          <header className="lg:sticky lg:top-0 lg:flex lg:h-full lg:w-5/12 lg:flex-col lg:justify-between lg:py-10">
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-200">Projects section</h1>
                <p className="mt-3 max-w-xs text-sm">
                  Temporary review page with sample data; it is not part of the production site. Scroll the
                  right-hand column (the page itself on a phone), switch tabs, resize the window.
                </p>
              </div>
              <Choice
                label="Sample data"
                value={size}
                onChange={setSize}
                options={[
                  { value: 'full', label: '10 Design + 5 Development' },
                  { value: 'short', label: 'Short: 3 + 2' },
                ]}
              />
              <div aria-live="polite" className="max-w-xs rounded-lg border border-slate-700 p-3 text-sm">
                <p className="font-medium text-slate-200">
                  Sticky tabs: {readout ? (readout.sticky ? 'ON' : 'OFF') : '…'}
                </p>
                {readout && (
                  <p className="mt-1">
                    Section is {readout.content}px tall; {readout.available}px is visible.{' '}
                    {readout.sticky ? 'It is taller than the screen, so the tabs stay pinned.' : 'It fits on screen, so the tabs scroll normally.'}
                  </p>
                )}
              </div>
            </div>
            <ul className="mt-8 max-w-xs list-disc space-y-1.5 pl-4 text-sm lg:mt-0">
              <li>Design opens on Websites (a long list); Mobile App and Others are short. Development: Web Apps.</li>
              <li>Scroll deep, then switch tabs: they stay in view and the list returns to its first card.</li>
              <li>Keep scrolling past the last project: Contact follows.</li>
            </ul>
          </header>
          <main
            className="relative h-full transition duration-300 max-lg:overflow-x-clip lg:w-7/12 lg:overflow-y-auto lg:px-6"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <Filler id="about" title="About" />
            {/* Sample cards must not navigate away from the review. */}
            <section
              id="projects"
              className="mt-4 scroll-mt-16 lg:scroll-mt-0"
              onClickCapture={(e) => {
                if (e.target.closest('a')) e.preventDefault();
              }}
            >
              <ProjectsPage key={size} data={data} />
            </section>
            <Filler id="contact" title="Contact" />
            <Filler id="footer" title="Footer" />
          </main>
        </div>
      </div>
    </div>
  );
}
