import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ADMIN_EVENT_LIMIT, fetchEventsSince } from '../services/analyticsService';
import { listProjects } from '../services/projectService';
import { Banner, buttonClass } from './ui';

const RANGES = [7, 30, 90];
const BAR_COLOR = '#0d9488'; // teal-600: passes the palette validator on the slate-900 surface
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayLabel = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const percent = (clicks, views) => (views ? `${((clicks / views) * 100).toFixed(1)}%` : '—');

function startOfRange(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-700/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-admin-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-admin-muted">{hint}</p>}
    </div>
  );
}

// Single-series daily bar chart: thin rounded bars on a baseline, hover/focus tooltip per day.
function DailyBars({ title, unit, series }) {
  const max = Math.max(1, ...series.map((d) => d.value));
  return (
    <figure className="rounded-lg border border-slate-700/70 p-4">
      <figcaption className="mb-4 text-sm font-medium text-slate-200">{title}</figcaption>
      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between text-right text-[10px] text-admin-muted" aria-hidden="true">
          <span>{max}</span>
          <span>0</span>
        </div>
        <div className="relative h-40 flex-1 border-b border-slate-700">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-800" aria-hidden="true" />
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {series.map((d) => (
              <div
                key={d.key}
                tabIndex={0}
                aria-label={`${d.label}: ${d.value} ${unit}`}
                className="group relative flex h-full flex-1 items-end focus-visible:outline-none"
              >
                <div
                  className="w-full rounded-t-[4px] group-hover:opacity-80 group-focus-visible:opacity-80"
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0, backgroundColor: BAR_COLOR }}
                />
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 shadow group-hover:block group-focus-visible:block"
                >
                  {d.label}: <strong>{d.value}</strong> {unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-6 mt-1 flex justify-between text-[10px] text-admin-muted" aria-hidden="true">
        <span>{series[0]?.label}</span>
        <span>{series[series.length - 1]?.label}</span>
      </div>
    </figure>
  );
}

export default function AnalyticsAdmin() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState({ status: 'loading', events: [], projects: [] });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setData((d) => ({ ...d, status: 'loading' }));
    setError('');
    try {
      const [events, projects] = await Promise.all([fetchEventsSince(startOfRange(days)), listProjects()]);
      setData({ status: 'ready', events, projects });
    } catch (err) {
      setError(`Couldn't load analytics: ${err.message}`);
      setData((d) => ({ ...d, status: 'error' }));
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const start = startOfRange(days);
    const daysList = Array.from({ length: days }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return { key: dayKey(date), label: dayLabel(date), views: 0, clicks: 0 };
    });
    const byDay = Object.fromEntries(daysList.map((d) => [d.key, d]));
    const byProject = {};
    const byTarget = {};
    let views = 0;
    let clicks = 0;

    data.events.forEach((e) => {
      const day = e.at && byDay[dayKey(e.at)];
      const project = (byProject[e.projectId] ||= { views: 0, clicks: 0 });
      if (e.type === 'view') {
        views += 1;
        project.views += 1;
        if (day) day.views += 1;
      } else if (e.type === 'outbound_click') {
        clicks += 1;
        project.clicks += 1;
        if (day) day.clicks += 1;
        if (e.target) byTarget[e.target] = (byTarget[e.target] || 0) + 1;
      }
    });

    const projectRows = Object.entries(byProject)
      .map(([id, counts]) => {
        const project = data.projects.find((p) => p.id === id);
        return { id, title: project?.title || 'Deleted project', status: project?.status || '—', ...counts };
      })
      .sort((a, b) => b.views - a.views || b.clicks - a.clicks);
    const topTargets = Object.entries(byTarget)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return { daysList, views, clicks, projectRows, topTargets };
  }, [data, days]);

  return (
    <section aria-labelledby="analytics-heading">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 id="analytics-heading" className="text-xl font-bold text-teal-300">
          Analytics
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-full border border-slate-700 p-1" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={days === r}
                onClick={() => setDays(r)}
                className={`rounded-full px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300 ${
                  days === r ? 'bg-teal-400/10 text-teal-200' : 'text-slate-400 hover:text-teal-300'
                }`}
              >
                {r} days
              </button>
            ))}
          </div>
          <span className="text-xs text-admin-muted">Timezone: {TIMEZONE}</span>
        </div>
      </div>

      {error && (
        <Banner tone="error">
          {error}{' '}
          <button type="button" className="underline" onClick={load}>
            Try again
          </button>
        </Banner>
      )}
      {data.status === 'loading' && <p role="status">Loading analytics…</p>}

      {data.status === 'ready' && (
        <>
          {data.events.length >= ADMIN_EVENT_LIMIT && (
            <Banner>Showing the latest {ADMIN_EVENT_LIMIT} events in this range. Older events aren't included.</Banner>
          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatTile label="Project views" value={summary.views} hint={`Last ${days} days`} />
            <StatTile label="Outbound clicks" value={summary.clicks} hint="Clicks on project links" />
            <StatTile label="Click-through rate" value={percent(summary.clicks, summary.views)} hint="Outbound clicks ÷ views" />
          </div>

          {data.events.length === 0 ? (
            <p className="mb-6 rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm">
              No views or clicks recorded in the last {days} days yet.
            </p>
          ) : (
            <>
              <div className="mb-4 grid gap-4 lg:grid-cols-2">
                <DailyBars title="Project views per day" unit="views" series={summary.daysList.map((d) => ({ ...d, value: d.views }))} />
                <DailyBars title="Outbound clicks per day" unit="clicks" series={summary.daysList.map((d) => ({ ...d, value: d.clicks }))} />
              </div>
              <details className="mb-8 text-sm">
                <summary className="cursor-pointer text-slate-400 hover:text-teal-300">Show daily numbers as a table</summary>
                <div className="mt-3 max-h-72 overflow-auto">
                  <table className="w-full text-left">
                    <thead className="text-xs uppercase tracking-wide text-admin-muted">
                      <tr>
                        <th className="py-1 pr-4 font-medium">Day</th>
                        <th className="py-1 pr-4 font-medium">Views</th>
                        <th className="py-1 font-medium">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.daysList.map((d) => (
                        <tr key={d.key} className="border-t border-slate-800">
                          <td className="py-1 pr-4">{d.label}</td>
                          <td className="py-1 pr-4">{d.views}</td>
                          <td className="py-1">{d.clicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <h2 className="mb-2 text-sm font-medium text-slate-200">By project</h2>
              <div className="mb-8 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-700 text-xs uppercase tracking-wide text-admin-muted">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Project</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Views</th>
                      <th className="py-2 pr-4 font-medium">Clicks</th>
                      <th className="py-2 font-medium">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.projectRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-800">
                        <td className="py-2 pr-4 text-slate-200">{row.title}</td>
                        <td className="py-2 pr-4">{row.status}</td>
                        <td className="py-2 pr-4">{row.views}</td>
                        <td className="py-2 pr-4">{row.clicks}</td>
                        <td className="py-2">{percent(row.clicks, row.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {summary.topTargets.length > 0 && (
                <>
                  <h2 className="mb-2 text-sm font-medium text-slate-200">Most-clicked links</h2>
                  <ul className="mb-8 space-y-1 text-sm">
                    {summary.topTargets.map(([target, count]) => (
                      <li key={target} className="flex justify-between gap-4 border-b border-slate-800 py-1">
                        <span className="truncate">{target}</span>
                        <span className="shrink-0 text-slate-200">{count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          <div className="rounded-lg border border-slate-700/70 p-4 text-xs text-admin-muted">
            <p className="mb-1 font-medium text-slate-400">How these numbers work</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>A view is counted when a project's page is opened (from the portfolio, a shared link or Google) or a post popup opens, at most once per project per browser session every 30 minutes.</li>
              <li>An outbound click is counted when a visitor opens a project's link, from a project page or a post popup. What happens on the destination site (Behance, Figma, GitHub…) isn't measured.</li>
              <li>Browsers that have signed in to this admin area, and automated browsers, aren't counted.</li>
              <li>Events are sent from visitors' browsers, so they can be faked. Treat the numbers as indicative.</li>
              <li>No visitor IDs, IP addresses or cookies are stored, so unique visitors aren't reported.</li>
            </ul>
          </div>
        </>
      )}

      {data.status === 'error' && !error && (
        <button type="button" className={buttonClass.secondary} onClick={load}>
          Try again
        </button>
      )}
    </section>
  );
}
