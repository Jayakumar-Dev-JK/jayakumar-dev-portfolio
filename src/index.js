import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

// The admin area is loaded only when /admin is opened, so visitors never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'));
const ProjectPage = lazy(() => import('./pages/ProjectPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
// Review-only page for the projects section: local development only, absent from production builds.
const ProjectsPreview = process.env.NODE_ENV !== 'production' ? lazy(() => import('./pages/ProjectsPreview')) : null;
const pageFallback = <div className="min-h-screen bg-slate-900" />;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
 <BrowserRouter>
 <Routes>
 <Route
 path="/admin/*"
 element={
 <Suspense fallback={pageFallback}>
 <AdminApp />
 </Suspense>
 }
 />
 <Route
 path="/projects/:slug"
 element={
 <Suspense fallback={pageFallback}>
 <ProjectPage />
 </Suspense>
 }
 />
 {ProjectsPreview && (
 <Route
 path="/ui-preview/projects"
 element={
 <Suspense fallback={pageFallback}>
 <ProjectsPreview />
 </Suspense>
 }
 />
 )}
 <Route path="/" element={<App />} />
 <Route
 path="*"
 element={
 <Suspense fallback={pageFallback}>
 <NotFound />
 </Suspense>
 }
 />
 </Routes>
 </BrowserRouter>
);
