import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FaCheck, FaExclamation, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';

// Shared admin building blocks. Colors come from the `admin` palette in tailwind.config.js.
// Class strings (inputClass, buttonClass, smallButtonClass) are kept alongside the components
// so existing pages can adopt the new look without being rewritten.

const focusRing = 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent';

/* ---------- Buttons ---------- */

export const inputClass =
  'w-full rounded-md border border-admin-border bg-admin-input px-3 py-[7px] text-sm text-admin-strong placeholder-admin-placeholder focus:border-teal-400/60 focus:outline-none focus:ring-1 focus:ring-admin-accent aria-invalid:border-red-400/60 disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-11';

const buttonBase = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 py-[7px] text-sm font-medium transition-colors ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-11`;
const smallBase = `${buttonBase.replace('px-4 py-[7px] text-sm', 'px-3 py-1 text-xs')} min-h-6 max-md:min-w-11`;

const VARIANTS = {
  primary: 'border-admin-accent-border bg-admin-accent-bg text-admin-accent-text hover:bg-admin-accent-bg-hover',
  secondary: 'border-admin-border text-admin-body hover:text-admin-accent',
  danger: 'border-admin-danger-border text-admin-danger-text hover:bg-admin-danger-bg',
};

export const buttonClass = {
  primary: `${buttonBase} ${VARIANTS.primary}`,
  secondary: `${buttonBase} ${VARIANTS.secondary}`,
  danger: `${buttonBase} ${VARIANTS.danger}`,
};

export const smallButtonClass = {
  primary: `${smallBase} ${VARIANTS.primary}`,
  secondary: `${smallBase} ${VARIANTS.secondary}`,
  danger: `${smallBase} ${VARIANTS.danger}`,
};

export const Button = React.forwardRef(function Button(
  { variant = 'secondary', size = 'default', loading = false, className = '', disabled, children, type = 'button', ...rest },
  ref
) {
  const classes = size === 'small' ? smallButtonClass : buttonClass;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${classes[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <FaSpinner className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {children}
    </button>
  );
});

/* ---------- Form pieces ---------- */

export function Field({ id, label, hint, error, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-admin-label">
        {label}
        {required && (
          <>
            <span className="text-admin-accent" aria-hidden="true"> *</span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 break-words text-xs text-admin-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 break-words text-xs text-admin-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

// On/off setting. `label` names it for assistive tech; show visible text next to it yourself.
export function Switch({ checked, onChange, label, disabled, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors before:absolute before:-inset-x-1 before:-inset-y-[10px] before:content-[''] ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'border-admin-accent-border bg-admin-accent-bg-hover' : 'border-admin-border bg-admin-draft-bg'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-4 w-4 rounded-full transition-transform ${
          checked ? 'translate-x-6 bg-admin-accent' : 'translate-x-1 bg-admin-muted'
        }`}
      />
    </button>
  );
}

// One-of-many choice (radio group). Arrow keys move and select; only the selected option is a tab stop.
export function SegmentedControl({ value, onChange, options, ariaLabel, className = '' }) {
  const refs = useRef([]);
  const move = (from, step) => {
    const next = (from + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex rounded-full border border-admin-border p-1 ${className}`}>
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium max-md:min-h-11 ${focusRing} ${
              selected ? 'bg-admin-accent-bg text-admin-accent-text' : 'text-admin-muted hover:text-admin-accent'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Tag or toggle. With `onClick` it is a toggle button (aria-pressed); without, a plain label.
export function Chip({ children, selected = false, onClick, disabled }) {
  const base = 'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium';
  if (!onClick) {
    return <span className={`${base} border-admin-border bg-admin-draft-bg text-admin-body`}>{children}</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${focusRing} disabled:opacity-50 max-md:min-h-11 ${
        selected
          ? 'border-admin-accent-border bg-admin-accent-bg text-admin-accent-text'
          : 'border-admin-border text-admin-body hover:text-admin-accent'
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- Status and feedback ---------- */

const STATUS_STYLES = {
  published: 'bg-admin-accent-bg text-admin-accent-text',
  draft: 'bg-admin-draft-bg text-admin-body',
  archived: 'bg-admin-warn-bg text-admin-warn-text',
  trash: 'bg-admin-danger-bg text-admin-danger-soft',
};

const STATUS_LABELS = { published: 'Published', draft: 'Draft', archived: 'Archived', trash: 'In trash' };

// Pass a project ({ status, deletedAt }) or a bare `status` key.
export function StatusBadge({ project, status }) {
  const key = project ? (project.deletedAt ? 'trash' : project.status) : status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[key] || STATUS_STYLES.draft}`}>
      {STATUS_LABELS[key] || key}
    </span>
  );
}

export function Banner({ tone = 'info', children, onDismiss, className = 'mb-4' }) {
  const tones = {
    info: 'border-admin-border bg-admin-info-bg text-admin-body',
    success: 'border-admin-accent-border bg-admin-accent-bg text-teal-100',
    warn: 'border-admin-warn-border bg-admin-warn-bg text-admin-warn-text',
    error: 'border-admin-danger-border bg-admin-danger-bg text-admin-danger-soft',
  };
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${tones[tone]} ${className}`}
    >
      <div className="min-w-0">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className={`whitespace-nowrap rounded text-xs font-medium underline-offset-2 hover:underline ${focusRing} max-md:min-h-11`}>
          Dismiss
        </button>
      )}
    </div>
  );
}

export function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`rounded-lg border border-admin-subtle bg-admin-card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// Dashed placeholder for "nothing here yet". `actions` are rendered as given (buttons or links).
export function EmptyState({ title, children, actions }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-admin-border px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-admin-label">{title}</h3>
      {children && <p className="max-w-sm text-admin-muted">{children}</p>}
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function SkeletonRows({ count = 3, label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3.5 rounded-lg border border-admin-subtle bg-admin-card p-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3" aria-hidden="true">
          <div className="adm-skeleton h-9 w-12 animate-shimmer" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="adm-skeleton h-3 animate-shimmer" style={{ width: `${68 - (i % 3) * 9}%` }} />
            <div className="adm-skeleton h-2.5 w-1/3 animate-shimmer" />
          </div>
          <div className="adm-skeleton h-5 w-[72px] animate-shimmer !rounded-full" />
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function ErrorState({ title, children, onRetry, retryLabel = 'Try again', extra }) {
  return (
    <div role="alert" className="mb-4 flex flex-col items-start gap-3 rounded-lg border border-admin-danger-border bg-admin-danger-bg px-4 py-3 text-sm text-admin-danger-soft">
      <div>
        <strong className="block font-semibold">{title}</strong>
        {children && <span>{children}</span>}
      </div>
      <div className="flex gap-2">
        {onRetry && (
          <button type="button" className={smallButtonClass.danger} onClick={onRetry}>
            {retryLabel}
          </button>
        )}
        {extra}
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */

const ToastContext = createContext({ show: () => {} });
export const useToast = () => useContext(ToastContext);
const TOAST_MS = 5000;

function ToastItem({ toast, onClose }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(timer);
  }, [paused, onClose]);

  const tones = {
    success: 'border-admin-accent-border text-teal-100',
    error: 'border-admin-danger-border text-admin-danger-soft',
    info: 'border-admin-border text-admin-body',
  };
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`flex items-center gap-3 rounded-lg border bg-admin-app px-4 py-3 text-sm shadow-overlay ${tones[toast.tone]}`}
    >
      <span>{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className={`rounded font-medium text-admin-accent underline ${focusRing}`}
          onClick={() => {
            toast.action.onClick();
            onClose();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss notification" onClick={onClose} className={`rounded px-1 text-admin-muted hover:text-admin-label ${focusRing}`}>
        ×
      </button>
    </div>
  );
}

// Bottom-right notifications. show({ text, tone?, action?: { label, onClick } }).
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const close = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback((toast) => {
    nextId.current += 1;
    setToasts((list) => [...list, { tone: 'success', ...toast, id: nextId.current }]);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div role="region" aria-label="Notifications" className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onClose={() => close(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Confirmation dialog ---------- */

const DIALOG_ICONS = {
  primary: { glyph: FaCheck, tone: 'border-admin-accent-border bg-admin-accent-bg text-admin-accent' },
  warn: { glyph: FaExclamation, tone: 'border-admin-warn-border bg-admin-warn-bg text-admin-warn-text' },
  danger: { glyph: FaExclamationTriangle, tone: 'border-admin-danger-border bg-admin-danger-bg text-admin-danger-text' },
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal. Traps focus, closes on Escape, starts focus on the safest button (Cancel) and
// restores focus to whatever opened it. `tone` sets the icon and the confirm button style.
// `confirmText` turns on typed confirmation: the confirm button stays disabled until it matches.
// `alternate` adds a third button ({ label, onClick, tone }) for choices like "Discard changes".
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
  confirmText,
  alternate,
  busy = false,
  hideCancel = false,
}) {
  const panelRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const [typed, setTyped] = useState('');
  const titleId = useId();
  const descId = useId();
  const inputId = useId();

  useEffect(() => {
    if (!open) return undefined;
    setTyped('');
    const opener = document.activeElement;
    (cancelRef.current || confirmRef.current)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)];
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const icon = DIALOG_ICONS[tone] || DIALOG_ICONS.primary;
  const confirmVariant = tone === 'danger' ? 'danger' : 'primary';
  const canConfirm = !confirmText || typed === confirmText;

  return createPortal(
    <div className="adm fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 font-admin" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onKeyDown={onKeyDown}
        className="flex max-h-[90vh] w-full max-w-[440px] flex-col gap-4 overflow-y-auto rounded-dialog border border-admin-border bg-admin-app p-6 text-admin-body shadow-overlay"
      >
        <div className="flex gap-3">
          <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${icon.tone}`}>
            <icon.glyph size={16} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-admin-strong">{title}</h2>
            {description && <p id={descId} className="mt-1">{description}</p>}
          </div>
        </div>
        {children}
        {confirmText && (
          <div>
            <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-admin-label">
              Type <code className="font-mono text-[13px] text-admin-label">{confirmText}</code> to confirm
            </label>
            <input id={inputId} className={inputClass} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={confirmText} autoComplete="off" spellCheck={false} />
          </div>
        )}
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          {alternate && (
            <Button variant={alternate.tone || 'secondary'} onClick={alternate.onClick} disabled={busy}>
              {alternate.label}
            </Button>
          )}
          {!hideCancel && (
            <button ref={cancelRef} type="button" className={buttonClass.secondary} onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </button>
          )}
          <Button ref={confirmRef} variant={confirmVariant} onClick={onConfirm} disabled={!canConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Promise-style confirmation, so a handler can `if (!(await confirm({...}))) return;`.
// Render the returned `dialog` once in the component.
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setState({ ...options, resolve });
      }),
    []
  );
  const finish = (result) => {
    state.resolve(result);
    setState(null);
  };
  const dialog = state ? (
    <ConfirmDialog
      open
      {...state}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
      alternate={state.alternate && { ...state.alternate, onClick: () => finish(state.alternate.value ?? 'alternate') }}
    />
  ) : null;
  return [confirm, dialog];
}

/* ---------- Unsaved-changes guard ----------
   A page with unsaved work calls useUnsavedGuard({ dirty, save, ... }). Every link in the admin
   shell (sidebar, breadcrumbs, sign-out) and the page's own Back button then ask before leaving:
   keep editing, save and leave, or discard. Closing the tab is covered by the page itself
   (beforeunload); the browser's Back button can't be intercepted by this kind of router. */

const noGuard = { register() {}, isDirty: () => false, requestLeave: null };
export const UnsavedGuardContext = createContext(noGuard);

export function UnsavedGuardProvider({ children }) {
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const getGuard = useRef(null);
  const register = useCallback((fn) => {
    getGuard.current = fn;
  }, []);
  const isDirty = useCallback(() => Boolean(getGuard.current?.()?.dirty), []);

  // Resolves true when it is fine to leave (nothing to lose, saved, or discarded), and goes to `to`.
  const requestLeave = useCallback(
    async (to) => {
      const guard = getGuard.current?.();
      if (guard?.dirty) {
        const answer = await confirm({
          title: 'Leave without saving?',
          description: guard.description || 'You have unsaved changes. If you leave now, they will be lost.',
          confirmLabel: 'Discard changes',
          cancelLabel: 'Keep editing',
          tone: 'danger',
          alternate: guard.save ? { label: guard.saveLabel || 'Save & leave', value: 'save' } : undefined,
        });
        if (answer === 'save') {
          if (!(await guard.save())) return false; // validation failed: stay and show the errors
        } else if (!answer) {
          return false;
        }
      }
      if (to) navigate(to);
      return true;
    },
    [confirm, navigate]
  );

  const value = useMemo(() => ({ register, isDirty, requestLeave }), [register, isDirty, requestLeave]);
  return (
    <UnsavedGuardContext.Provider value={value}>
      {children}
      {confirmDialog}
    </UnsavedGuardContext.Provider>
  );
}

// guard: { dirty, description?, save?: () => Promise<boolean>, saveLabel? }. Returns
//   leave(to)       - go to `to`, asking first when there are unsaved changes
//   guardClick(to)  - onClick handler for a link to `to`: plain clicks ask first, new-tab clicks pass
export function useUnsavedGuard(guard) {
  const { register, isDirty, requestLeave } = useContext(UnsavedGuardContext);
  const navigate = useNavigate();
  const latest = useRef(guard);
  latest.current = guard;
  useEffect(() => {
    register(() => latest.current);
    return () => register(null);
  }, [register]);
  const leave = useCallback((to) => (requestLeave ? requestLeave(to) : Promise.resolve(navigate(to))), [requestLeave, navigate]);
  const guardClick = useCallback(
    (to) => (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!isDirty()) return;
      e.preventDefault();
      leave(to);
    },
    [isDirty, leave]
  );
  return { leave, guardClick };
}

// For links that live outside the page that registered the guard (the shell).
export function useShellGuard() {
  const { isDirty, requestLeave } = useContext(UnsavedGuardContext);
  const guardClick = useCallback(
    (to) => (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!isDirty() || !requestLeave) return;
      e.preventDefault();
      requestLeave(to);
    },
    [isDirty, requestLeave]
  );
  return { guardClick, requestLeave };
}

/* ---------- Icons and menus ---------- */

// Filled icon. Pass a react-icons component (Font Awesome solid), e.g. <Icon as={FaFolder} />.
// Decorative: always hidden from assistive tech.
export function Icon({ as: Glyph, size = 18, className = '' }) {
  return <Glyph size={size} aria-hidden="true" focusable="false" className={`shrink-0 ${className}`} />;
}

/* ---------- Brand ---------- */

// Portfolio owner, shown in the admin shell and account menu.
export const OWNER = { name: 'Jayakumar', initials: 'JK', role: 'UI/UX Designer' };

// Portfolio logo: "JK" monogram tile in the admin accent.
export function BrandMark({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false" className="shrink-0">
      <rect x="0.5" y="0.5" width="35" height="35" rx="10" fill="rgba(45,212,191,.1)" stroke="rgba(45,212,191,.4)" />
      <text x="18" y="23.5" textAnchor="middle" fontSize="14" fontWeight="700" letterSpacing="0.5" fill="#5EEAD4" fontFamily="Inter, 'Segoe UI', system-ui, sans-serif">
        JK
      </text>
    </svg>
  );
}

// Button that opens a menu of actions. Keyboard: Enter/Space/ArrowDown open, arrows move,
// Home/End jump, Escape closes and returns focus to the button, Tab closes.
// items: [{ label, onSelect?, href?, tone?: 'danger', disabled? }]
export function MenuButton({ label, ariaLabel, items, buttonClassName, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const enabled = () => itemRefs.current.filter((el) => el && !el.disabled);
  const focusItem = (index) => {
    const list = enabled();
    if (list.length) list[(index + list.length) % list.length].focus();
  };

  const onButtonKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setTimeout(() => focusItem(0), 0);
    }
  };

  const onMenuKeyDown = (e) => {
    const list = enabled();
    const index = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') focusItem(index + 1);
    else if (e.key === 'ArrowUp') focusItem(index - 1);
    else if (e.key === 'Home') focusItem(0);
    else if (e.key === 'End') focusItem(list.length - 1);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') close(false);
    else return;
    if (e.key !== 'Tab') e.preventDefault();
  };

  const itemClass = (item) =>
    `flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${focusRing} disabled:cursor-not-allowed disabled:opacity-50 max-md:min-h-11 ${
      item.tone === 'danger' ? 'text-admin-danger-text hover:bg-admin-danger-bg' : 'text-admin-label hover:bg-slate-800'
    }`;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKeyDown}
        className={buttonClassName}
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onMenuKeyDown}
          className={`absolute z-30 mt-1 min-w-44 rounded-lg border border-admin-border bg-admin-app p-1 shadow-overlay ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, i) => {
            const common = {
              role: 'menuitem',
              tabIndex: -1,
              ref: (el) => (itemRefs.current[i] = el),
              className: itemClass(item),
            };
            return item.href ? (
              <a key={item.label} href={item.href} target={item.external ? '_blank' : undefined} rel={item.external ? 'noreferrer noopener' : undefined} {...common} onClick={() => setOpen(false)}>
                {item.label}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                {...common}
                onClick={() => {
                  close(false);
                  item.onSelect?.();
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Helpers and session ---------- */

export function formatDate(timestamp) {
  const date = timestamp?.toDate?.();
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

// Signed-in admin session, provided by AdminApp.
export const SessionContext = createContext({ status: 'loading', user: null });
export const useSession = () => useContext(SessionContext);
