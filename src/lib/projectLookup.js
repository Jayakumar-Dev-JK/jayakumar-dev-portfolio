// Finds the project for a /projects/:slug address. A slug that a published project used before
// is not an error: the visitor is sent on to the project's current address.
export function resolveProject(projects, slug) {
  const current = projects.find((p) => p.slug === slug);
  if (current) return { project: current, redirectTo: null };
  const renamed = projects.find((p) => (p.previousSlugs || []).includes(slug));
  if (renamed) return { project: null, redirectTo: `/projects/${renamed.slug}` };
  return { project: null, redirectTo: null };
}
