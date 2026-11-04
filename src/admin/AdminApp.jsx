import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { isFirebaseConfigured } from '../lib/firebaseConfig';
import { isActiveAdmin, requestPasswordReset, signIn, signOutUser, watchAuth } from '../services/authService';
import { markAdminDevice } from '../services/analyticsService';
import { Banner, BrandMark, buttonClass, OWNER, SessionContext, ToastProvider, useSession } from './ui';
import { ForgotPasswordLink, LoginCard, LoginForm, LoginLayout } from './LoginParts';
import { ProjectEditor, ProjectsList } from './ProjectsAdmin';
import CategoriesAdmin from './CategoriesAdmin';
import AnalyticsAdmin from './AnalyticsAdmin';
import MediaAdmin from './MediaAdmin';
import TechStackAdmin from './TechStackAdmin';
import ResumeAdmin from './ResumeAdmin';
import AdminShell from './AdminShell';
import './admin.css';

// Private admin area, mounted at /admin/*. Not linked from the public site.
// Route guards here are for UX only; Firestore Security Rules are the security boundary.

const SESSION_TIMEOUT_MS = 10000;

function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = 'Admin · Portfolio';
    return () => {
      meta.remove();
      document.title = previousTitle;
    };
  }, []);
}

// Inter is loaded here, not in index.html, so the public site never requests it for the admin.
function useAdminFont() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

function Screen({ children }) {
  return (
    <div className="adm min-h-screen bg-admin-app font-admin text-admin-body antialiased selection:bg-teal-300 selection:text-teal-900">
      {children}
    </div>
  );
}

function CenteredCard({ title, children }) {
  return (
    <div className="px-4 py-10">
      <div className="mx-auto mt-10 flex max-w-sm items-center gap-3">
        <BrandMark />
        <div className="flex flex-col">
          <span className="font-semibold text-admin-strong">{OWNER.name}</span>
          <span className="text-xs text-admin-muted">Portfolio admin</span>
        </div>
      </div>
      <div className="mx-auto mt-6 max-w-sm rounded-lg border border-admin-border bg-admin-card p-6">
        <h1 className="mb-4 text-xl font-bold text-admin-heading">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function SessionProvider({ children }) {
  const [session, setSession] = useState({ status: 'loading', user: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(
    () =>
      watchAuth(async (user) => {
        if (!user) {
          setSession({ status: 'signedOut', user: null });
          return;
        }
        setSession({ status: 'loading', user });
        try {
          const admin = await isActiveAdmin(user.uid);
          if (admin) markAdminDevice(); // exclude this browser from analytics
          setSession({ status: admin ? 'admin' : 'denied', user });
        } catch (err) {
          setSession({ status: err.code === 'permission-denied' ? 'denied' : 'error', user });
        }
      }),
    [attempt]
  );

  // Don't spin forever if Firebase can't be reached.
  useEffect(() => {
    if (session.status !== 'loading') return undefined;
    const timer = setTimeout(
      () => setSession((s) => (s.status === 'loading' ? { ...s, status: 'error' } : s)),
      SESSION_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [session.status, attempt]);

  const value = {
    ...session,
    retry: () => {
      setSession((s) => ({ ...s, status: 'loading' }));
      setAttempt((n) => n + 1);
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function AccessDenied() {
  return (
    <CenteredCard title="Access denied">
      <p className="mb-4 text-sm">This account doesn't have admin access.</p>
      <button type="button" className={buttonClass.secondary} onClick={signOutUser}>
        Sign out
      </button>
    </CenteredCard>
  );
}

function SessionError() {
  const { retry } = useSession();
  return (
    <CenteredCard title="Couldn't reach the sign-in service">
      <p className="mb-4 text-sm">Check your connection and try again.</p>
      <div className="flex gap-2">
        <button type="button" className={buttonClass.primary} onClick={retry}>
          Try again
        </button>
        <button type="button" className={buttonClass.secondary} onClick={signOutUser}>
          Sign out
        </button>
      </div>
    </CenteredCard>
  );
}

function RequireAdmin() {
  const { status } = useSession();
  const location = useLocation();
  if (status === 'loading') return <p className="p-10 text-center text-sm" role="status">Checking your session…</p>;
  if (status === 'signedOut') return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (status === 'denied') return <AccessDenied />;
  if (status === 'error') return <SessionError />;
  return <Outlet />;
}

function LoginPage() {
  const { status } = useSession();
  const location = useLocation();
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (status === 'admin') return <Navigate to={location.state?.from || '/admin'} replace />;
  if (status === 'denied') return <AccessDenied />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        await requestPasswordReset(email);
        setNotice('If that email belongs to an admin account, a reset link is on its way.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const isSignIn = mode === 'signIn';
  return (
    <LoginLayout>
      <LoginCard
        title={isSignIn ? 'Admin Sign In' : 'Reset password'}
        subtitle={isSignIn ? 'Access your portfolio admin panel.' : "Enter your email and we'll send a reset link."}
      >
        {error && <Banner tone="error">{error}</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}
        <LoginForm
          mode={mode}
          email={email}
          password={password}
          showPassword={showPassword}
          busy={busy}
          onEmail={(e) => setEmail(e.target.value)}
          onPassword={(e) => setPassword(e.target.value)}
          onToggle={() => setShowPassword((v) => !v)}
          onSubmit={submit}
        />
        <ForgotPasswordLink
          onClick={() => {
            setMode(isSignIn ? 'reset' : 'signIn');
            setError('');
            setNotice('');
          }}
        >
          {isSignIn ? 'Forgot password?' : 'Back to sign in'}
        </ForgotPasswordLink>
      </LoginCard>
    </LoginLayout>
  );
}

export default function AdminApp() {
  useNoIndex();
  useAdminFont();

  if (!isFirebaseConfigured) {
    return (
      <Screen>
        <CenteredCard title="Admin unavailable">
          <p className="text-sm">
            Firebase isn't configured for this build. Set the REACT_APP_FIREBASE_* environment variables and rebuild.
          </p>
        </CenteredCard>
      </Screen>
    );
  }

  return (
    <SessionProvider>
      <Screen>
        <ToastProvider>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<RequireAdmin />}>
            <Route element={<AdminShell />}>
              <Route index element={<ProjectsList />} />
              <Route path="projects/new" element={<ProjectEditor />} />
              <Route path="projects/:id" element={<ProjectEditor />} />
              <Route path="categories" element={<CategoriesAdmin />} />
              <Route path="tech-stack" element={<TechStackAdmin />} />
              <Route path="resume" element={<ResumeAdmin />} />
              <Route path="media" element={<MediaAdmin />} />
              <Route path="analytics" element={<AnalyticsAdmin />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
        </ToastProvider>
      </Screen>
    </SessionProvider>
  );
}
