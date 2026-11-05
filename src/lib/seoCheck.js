// "Is this project page good enough for search?" - the checks behind the SEO panel in the
// project editor and the badge in the project list. Advice only: nothing here blocks saving.
//
// Input is a project in the editor/Firestore shape: title, slug, shortDescription, description,
// problem, process, outcome, techStack[], coverMedia{url, alt}, gallery[{url, alt}],
// projectUrl, links[].

const words = (text) => String(text || '').trim().split(/\s+/).filter(Boolean).length;

export const CONTENT_GOOD_WORDS = 150;
export const CONTENT_THIN_WORDS = 60;
const SHORT_MIN = 70;
const SHORT_MAX = 160;
const SLUG_MAX = 60;

export function contentWords(project) {
  return ['description', 'problem', 'process', 'outcome'].reduce((sum, key) => sum + words(project[key]), 0);
}

export function seoChecks(project) {
  const short = String(project.shortDescription || '').trim();
  const total = contentWords(project);
  const gallery = (project.gallery || []).filter((img) => img?.url);
  const missingAlt = gallery.filter((img) => !String(img.alt || '').trim()).length;
  const hasCover = Boolean(project.coverMedia?.url);
  const hasLink = Boolean(project.projectUrl) || (project.links || []).some((l) => l?.url);

  const items = [
    {
      id: 'short',
      ok: short.length >= SHORT_MIN && short.length <= SHORT_MAX,
      label: 'Short description length',
      tip:
        short.length < SHORT_MIN
          ? `Add a little more: it is ${short.length} characters and works best at ${SHORT_MIN}-${SHORT_MAX}. Google uses it as the page description.`
          : short.length > SHORT_MAX
            ? `It is ${short.length} characters. Google cuts descriptions at about ${SHORT_MAX}, so put the key point first.`
            : `${short.length} characters - a good length for the Google description.`,
    },
    {
      id: 'content',
      ok: total >= CONTENT_GOOD_WORDS,
      label: 'Written content',
      tip:
        total >= CONTENT_GOOD_WORDS
          ? `${total} words of description and case-study text.`
          : total >= CONTENT_THIN_WORDS
            ? `${total} words. Pages with ${CONTENT_GOOD_WORDS}+ words (description, problem, process, outcome) rank better.`
            : `Only ${total} words. A page with little text is unlikely to rank - add the problem, your process and the outcome.`,
    },
    {
      id: 'cover-alt',
      ok: hasCover && Boolean(String(project.coverMedia.alt || '').trim()),
      label: 'Cover image description',
      tip: !hasCover
        ? 'Add a cover image: it is the picture shown in link previews.'
        : String(project.coverMedia.alt || '').trim()
          ? 'The cover image has alt text.'
          : 'Describe the cover image in the alt text field.',
    },
    {
      id: 'gallery-alt',
      ok: missingAlt === 0,
      label: 'Image descriptions',
      tip: missingAlt === 0 ? 'Every image has alt text.' : `${missingAlt} image${missingAlt === 1 ? '' : 's'} without alt text. Describe each one.`,
    },
    {
      id: 'tech',
      ok: (project.techStack || []).length > 0,
      label: 'Tools / tech stack',
      tip: (project.techStack || []).length ? 'Tools are listed.' : 'List the tools or technologies used.',
    },
    {
      id: 'link',
      ok: hasLink,
      label: 'Link to the project',
      tip: hasLink ? 'The page links to the project.' : 'Add a primary link (live site, Figma, Behance…) so visitors can open the work.',
    },
    {
      id: 'slug',
      ok: Boolean(project.slug) && project.slug.length <= SLUG_MAX,
      label: 'Page address',
      tip:
        project.slug && project.slug.length <= SLUG_MAX
          ? 'Short, readable address.'
          : `Use a shorter slug (up to ${SLUG_MAX} characters).`,
    },
  ];

  const problems = items.filter((i) => !i.ok);
  // Thin text or a missing short description hurt most; everything else is polish.
  const level = total < CONTENT_THIN_WORDS || short.length < SHORT_MIN / 2 ? 'thin' : problems.length === 0 ? 'ready' : 'okay';
  return { items, problems, level, passed: items.length - problems.length, total: items.length, words: total };
}

export const SEO_LEVELS = {
  ready: { label: 'SEO ready', tone: 'success' },
  okay: { label: 'Needs polish', tone: 'warning' },
  thin: { label: 'Thin page', tone: 'danger' },
};
