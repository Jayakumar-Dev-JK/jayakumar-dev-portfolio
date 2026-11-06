import { getDocument } from '../lib/firestoreRest';
import { isSafeUrl } from '../lib/validation';

// The one published resume ({ title, url, fileName }), or null when none is published.
// Kept separate from resumeService so the public site doesn't load the upload code, and read
// with a plain request so it doesn't load the Firebase SDK either.
export async function fetchPublishedResume() {
  const data = await getDocument('siteSettings/resume');
  if (!data) return null;
  const { title, url, fileName } = data;
  return isSafeUrl(url) ? { title, url, fileName } : null;
}
