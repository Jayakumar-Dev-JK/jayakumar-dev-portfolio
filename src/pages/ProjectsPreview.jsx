import React, { useMemo, useState } from 'react';
import ProjectsPage from '../components/projects';
import { sampleProjects } from '../data/sampleProjects';

// REVIEW PAGE: shows the projects section with sample data, inside a copy of the site's scrolling
// layout, so the sticky tabs / full-screen panel can be judged without touching real content.
// Local development only (see src/index.js). Delete this file, src/data/sampleProjects.js and the
// route when the review is done.

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
      <p>
        {title} placeholder. When you reach the end of the projects list, scrolling carries on into this section
        without any extra step.
      </p>
    </section>
  );
}

export default function ProjectsPreview() {
  const [size, setSize] = useState('many');
  const [variant, setVariant] = useState('sticky');
  const [chips, setChips] = useState(true);
  const data = useMemo(() => sampleProjects(size), [size]);

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
                  Local review page with sample data; it is not part of the production site. Scroll the right-hand
                  column (the page on a phone) and try the tabs.
                </p>
              </div>
              <Choice
                label="Sample size"
                value={size}
                onChange={setSize}
                options={[
                  { value: 'few', label: '3 projects (short)' },
                  { value: 'many', label: '12 projects (long)' },
                ]}
              />
              <Choice
                label="Scrolling"
                value={variant}
                onChange={setVariant}
                options={[
                  { value: 'sticky', label: 'Sticky tabs' },
                  { value: 'panel', label: 'Full-screen panel' },
                ]}
              />
              <Choice
                label="Category chips"
                value={chips}
                onChange={setChips}
                options={[
                  { value: true, label: 'Show' },
                  { value: false, label: 'Hide' },
                ]}
              />
            </div>
            <ul className="mt-8 max-w-xs list-disc space-y-1.5 pl-4 text-sm lg:mt-0">
              <li>Scroll deep, then switch tabs: the tabs stay in view and the list returns to its top.</li>
              <li>With 3 projects the section is only as tall as its content.</li>
              <li>Cards fade in as they arrive. No scrollbar is drawn.</li>
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
              <ProjectsPage key={`${size}-${variant}-${chips}`} data={data} variant={variant} showCategories={chips} />
            </section>
            <Filler id="contact" title="Contact" />
            <Filler id="footer" title="Footer" />
          </main>
        </div>
      </div>
    </div>
  );
}
