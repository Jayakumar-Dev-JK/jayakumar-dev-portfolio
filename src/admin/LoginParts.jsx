import React from 'react';
import { FaArrowRight, FaEnvelope, FaEye, FaEyeSlash, FaLock, FaSpinner } from 'react-icons/fa';
import { BrandMark, buttonClass, Field, inputClass, OWNER } from './ui';

// Presentational pieces of the admin sign-in screen. All state and auth calls live in LoginPage
// (AdminApp.jsx); colors come from the `admin` palette in tailwind.config.js.

// Soft teal ambient light plus two faint wave lines, in the existing accent color only.
function LoginBackdrop() {
  return (
    <div className="adm-login-backdrop pointer-events-none absolute inset-0" aria-hidden="true">
      <svg className="absolute inset-x-0 bottom-0 h-[45%] w-full" viewBox="0 0 1440 400" preserveAspectRatio="none" fill="none">
        <path d="M0 260 C 240 180, 420 340, 720 250 S 1200 150, 1440 230" stroke="rgba(45,212,191,.12)" strokeWidth="1.5" />
        <path d="M0 320 C 280 240, 500 380, 760 310 S 1180 230, 1440 300" stroke="rgba(45,212,191,.07)" strokeWidth="1.5" />
        <path d="M0 260 C 240 180, 420 340, 720 250 S 1200 150, 1440 230 V 400 H 0 Z" fill="rgba(45,212,191,.03)" />
      </svg>
    </div>
  );
}

export function LoginLayout({ children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <LoginBackdrop />
      <div className="relative w-full max-w-[420px]">{children}</div>
    </div>
  );
}

export function AdminProfileHeader() {
  return (
    <div className="border-b border-admin-border pb-5">
      <div className="flex items-center gap-3">
        <BrandMark size={44} />
        <div className="flex flex-col">
          <span className="text-base font-semibold leading-5 text-admin-strong">{OWNER.name}</span>
          <span className="text-xs text-admin-muted">Portfolio Admin</span>
        </div>
      </div>
    </div>
  );
}

export function LoginCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-admin-border bg-admin-card p-6 shadow-overlay backdrop-blur-sm sm:p-8">
      <AdminProfileHeader />
      <h1 className="mt-6 text-2xl font-bold tracking-tight text-admin-heading">{title}</h1>
      <p className="mb-6 mt-1 text-sm text-admin-muted">{subtitle}</p>
      {children}
    </div>
  );
}

const iconClass = 'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-admin-placeholder transition-colors peer-focus:text-admin-accent';
const fieldInputClass = `${inputClass} peer h-11 pl-10 transition-colors`;

export function EmailInput({ value, onChange }) {
  return (
    <Field id="email" label="Email" required>
      <div className="relative">
        <input
          id="email"
          type="email"
          autoComplete="off"
          placeholder="Enter your email"
          required
          value={value}
          onChange={onChange}
          className={fieldInputClass}
        />
        <FaEnvelope className={iconClass} aria-hidden="true" />
      </div>
    </Field>
  );
}

export function PasswordInput({ value, onChange, visible, onToggle }) {
  return (
    <Field id="password" label="Password" required>
      <div className="relative">
        <input
          id="password"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Enter your password"
          required
          value={value}
          onChange={onChange}
          className={`${fieldInputClass} pr-11`}
        />
        <FaLock className={iconClass} aria-hidden="true" />
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md max-md:h-11 max-md:w-11 text-admin-muted transition-colors hover:text-admin-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent"
        >
          {visible ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
}

export function PrimaryButton({ busy, disabled, children }) {
  return (
    <button
      type="submit"
      className={`${buttonClass.primary} group h-11 w-full`}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <>
          <FaSpinner className="animate-spin" aria-hidden="true" />
          Please wait…
        </>
      ) : (
        <>
          {children}
          <FaArrowRight className="text-xs transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

export function ForgotPasswordLink({ onClick, children }) {
  return (
    <div className="mt-5 text-center">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex min-h-6 items-center rounded px-1 text-sm text-admin-muted transition-colors hover:text-admin-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent max-md:min-h-11"
      >
        {children}
      </button>
    </div>
  );
}

export function LoginForm({ mode, email, password, showPassword, busy, onEmail, onPassword, onToggle, onSubmit }) {
  const signIn = mode === 'signIn';
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <EmailInput value={email} onChange={onEmail} />
      {signIn && <PasswordInput value={password} onChange={onPassword} visible={showPassword} onToggle={onToggle} />}
      <PrimaryButton busy={busy} disabled={!email || (signIn && !password)}>
        {signIn ? 'Sign In' : 'Send reset link'}
      </PrimaryButton>
    </form>
  );
}
