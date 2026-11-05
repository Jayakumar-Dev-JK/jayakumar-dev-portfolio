import React from 'react';
import { SITE_NAME, usePageMeta } from '../lib/pageMeta';

// Shown for any address the site doesn't have. It is marked noindex so search engines never
// treat an unknown URL as a real page.
export default function NotFound() {
  usePageMeta({ title: `Page not found | ${SITE_NAME}`, noindex: true });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-6 text-slate-400 antialiased">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-300">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-200">Page not found</h1>
        <p className="mt-3">That page doesn't exist, or it is no longer published.</p>
        <a
          href="/"
          className="mt-6 inline-block rounded-full border border-teal-400/40 bg-teal-400/10 px-5 py-2 text-sm font-medium text-teal-200 hover:text-teal-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300"
        >
          Back to the portfolio
        </a>
      </div>
    </main>
  );
}
