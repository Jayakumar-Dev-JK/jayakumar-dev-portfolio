import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { signOutUser } from '../services/authService';
import {
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaChartBar,
  FaChevronDown,
  FaExternalLinkAlt,
  FaFileAlt,
  FaFolderOpen,
  FaImages,
  FaLayerGroup,
  FaTags,
} from 'react-icons/fa';
import { BrandMark, Icon, MenuButton, OWNER, UnsavedGuardProvider, useSession, useShellGuard } from './ui';

// Sidebar + top bar around every signed-in admin page.
// Add a nav entry here when its page and route exist.

const NAV = [
  {
    to: '/admin',
    label: 'Projects',
    icon: FaFolderOpen,
    match: (path) => path === '/admin' || path.startsWith('/admin/projects'),
  },
  {
    to: '/admin/categories',
    label: 'Categories',
    icon: FaTags,
  },
  {
    to: '/admin/tech-stack',
    label: 'Tech Stack',
    icon: FaLayerGroup,
  },
  {
    to: '/admin/resume',
    label: 'Resume',
    icon: FaFileAlt,
  },
  {
    to: '/admin/media',
    label: 'Media',
    icon: FaImages,
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    icon: FaChartBar,
  },
];

const STORAGE_KEY = 'admin.sidebar.collapsed';

function readCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be blocked (private window, site data cleared). The sidebar still works.
  }
}

// Trail of [label, path?] pairs for the top bar. The last entry is the current page.
function breadcrumbFor(pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['admin', ...]
  const [, section, id, sub] = parts;
  if (!section) return [['Projects']];
  if (section === 'projects') {
    if (id === 'new') return [['Projects', '/admin'], ['New project']];
    if (sub === 'preview') return [['Projects', '/admin'], ['Edit project', `/admin/projects/${id}`], ['Preview']];
    return [['Projects', '/admin'], ['Edit project']];
  }
  const found = NAV.find((n) => n.to === `/admin/${section}`);
  return [[found ? found.label : 'Admin']];
}

function Avatar({ size = 'h-8 w-8' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex ${size} shrink-0 items-center justify-center rounded-full border border-admin-accent-border bg-admin-accent-bg text-xs font-semibold text-admin-accent-text`}
    >
      {OWNER.initials}
    </span>
  );
}

function ShellLayout() {
  const { user } = useSession();
  const { guardClick, requestLeave } = useShellGuard();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const trail = breadcrumbFor(pathname);

  const toggle = () => {
    setCollapsed((c) => {
      writeCollapsed(!c);
      return !c;
    });
  };

  const navClass = (active) =>
    `group relative flex h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent md:h-10 ${
      collapsed ? 'md:justify-center md:px-0' : ''
    } ${active ? 'bg-admin-accent-bg text-admin-accent-text' : 'text-admin-muted hover:bg-slate-800/60 hover:text-admin-label'}`;

  // Label stays in the DOM when collapsed (screen readers), but is hidden visually on md+.
  const labelClass = collapsed ? 'md:sr-only' : '';
  const tip = (text) =>
    collapsed ? (
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-admin-border bg-admin-app px-2 py-1 text-xs text-admin-label shadow-overlay md:group-hover:block md:group-focus-visible:block"
      >
        {text}
      </span>
    ) : null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-admin-app focus:px-3 focus:py-2 focus:text-admin-accent"
      >
        Skip to content
      </a>

      <aside
        className={`flex shrink-0 flex-col gap-4 border-b border-admin-subtle p-3 md:sticky md:top-0 md:h-screen md:gap-6 md:border-b-0 md:border-r md:p-4 ${
          collapsed ? 'md:w-14 md:px-2' : 'md:w-[248px]'
        }`}
      >
        <div className={`flex items-center gap-3 md:px-1 ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
          <BrandMark />
          <div className={`flex min-w-0 flex-col ${collapsed ? 'md:hidden' : ''}`}>
            <span className="truncate font-semibold text-admin-strong">{OWNER.name}</span>
            <span className="text-xs text-admin-muted">Portfolio admin</span>
          </div>
        </div>

        <nav aria-label="Primary" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {NAV.map((item) => {
            const active = item.match ? item.match(pathname) : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={collapsed ? item.label : undefined}
                onClick={guardClick(item.to)}
                className={navClass(active)}
              >
                <Icon as={item.icon} />
                <span className={labelClass}>{item.label}</span>
                {tip(item.label)}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto hidden flex-col gap-1 md:flex">
          <a
            href="/"
            target="_blank"
            rel="noreferrer noopener"
            aria-label={collapsed ? 'View public site (opens in a new tab)' : undefined}
            className={navClass(false)}
          >
            <Icon as={FaExternalLinkAlt} size={16} />
            <span className={labelClass}>View public site</span>
            {tip('View public site')}
          </a>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={`${navClass(false)} w-full`}
          >
            <Icon as={collapsed ? FaAngleDoubleRight : FaAngleDoubleLeft} />
            <span className={labelClass}>Collapse</span>
            {tip(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
          </button>
          <div
            className={`mt-2 flex items-center gap-3 rounded-lg border border-admin-subtle bg-admin-card p-2 ${
              collapsed ? 'md:justify-center md:border-0 md:bg-transparent md:p-0' : ''
            }`}
          >
            <Avatar size="h-9 w-9" />
            <div className={`min-w-0 ${collapsed ? 'md:sr-only' : ''}`}>
              <p className="truncate text-sm font-semibold text-admin-strong">{OWNER.name}</p>
              <p className="truncate text-xs text-admin-muted" title={user?.email}>{user?.email || OWNER.role}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-admin-subtle bg-admin-app px-4 py-2 md:px-8">
          <nav aria-label="Breadcrumb" className="text-sm text-admin-muted">
            <ol className="flex flex-wrap items-center">
              <li>Admin</li>
              {trail.map(([label, to], i) => (
                <li key={label} className="flex items-center">
                  <span aria-hidden="true" className="px-1.5">/</span>
                  {to && i < trail.length - 1 ? (
                    <Link to={to} onClick={guardClick(to)} className="inline-flex min-h-6 items-center rounded hover:text-admin-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent max-md:min-h-11">
                      {label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-admin-label">{label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          <MenuButton
            ariaLabel={`Account menu for ${OWNER.name}`}
            buttonClassName="flex h-11 items-center gap-2 rounded-full border border-admin-border pl-1 pr-3 text-admin-label hover:border-admin-accent-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent md:h-10"
            label={
              <>
                <Avatar />
                <span className="hidden flex-col items-start leading-tight sm:flex">
                  <span className="max-w-[12rem] truncate text-sm font-medium">{OWNER.name}</span>
                  <span className="text-[11px] text-admin-muted">Administrator</span>
                </span>
                <Icon as={FaChevronDown} size={12} className="text-admin-muted" />
              </>
            }
            items={[
              { label: 'View public site', href: '/', external: true },
              { label: 'Sign out', tone: 'danger', onSelect: async () => (await requestLeave()) && signOutUser() },
            ]}
          />
        </header>

        <main id="admin-main" tabIndex={-1} className="mx-auto w-full max-w-shell p-4 focus:outline-none md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// The guard provider sits outside the layout so the layout's links and any page can use it.
export default function AdminShell() {
  return (
    <UnsavedGuardProvider>
      <ShellLayout />
    </UnsavedGuardProvider>
  );
}
