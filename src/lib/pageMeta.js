import { useEffect } from 'react';

// Page title/description rules. The Netlify functions apply the same rules on the server
// (netlify/lib/seo.js) so crawlers and the browser agree - keep the two in sync.
export const SITE_NAME = 'Jayakumar Jayakrishnan';
export const SITE_URL = 'https://jayakumarwebdev.netlify.app';
const TITLE_MAX = 70;
const DESCRIPTION_MAX = 158;

const collapse = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function clip(text, max) {
  const t = collapse(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:\s]+$/, '')}…`;
}

export function seoTitle(title) {
  const full = `${title} | ${SITE_NAME}`;
  return full.length <= TITLE_MAX ? full : clip(title, TITLE_MAX);
}

export function seoDescription({ title, type, description, fullDescription }) {
  let text = collapse(description);
  if (text.length < 110 && fullDescription) text = `${text} ${collapse(fullDescription)}`.trim();
  if (!text) text = `${title} - a ${String(type || 'web').toLowerCase()} project by ${SITE_NAME}.`;
  return clip(text, DESCRIPTION_MAX);
}

// Finds a head tag, changes it, and returns a function that puts it back (or removes a tag
// that did not exist before). Used so navigating away restores the homepage's tags.
function setHeadTag(selector, create, apply) {
  let el = document.head.querySelector(selector);
  const created = !el;
  if (created) {
    el = create();
    document.head.appendChild(el);
  }
  const before = created ? null : el.cloneNode(true);
  apply(el);
  return () => {
    if (created) el.remove();
    else [...before.attributes].forEach((a) => el.setAttribute(a.name, a.value));
  };
}

const metaTag = (attr, name) => () => {
  const el = document.createElement('meta');
  el.setAttribute(attr, name);
  return el;
};

// Sets the document title and the SEO/social tags for the current page while it is mounted.
export function usePageMeta({ title, description, image, canonical, noindex = false, jsonLd = [] }) {
  const jsonKey = JSON.stringify(jsonLd);
  useEffect(() => {
    const restores = [];
    const previousTitle = document.title;
    if (title) {
      document.title = title;
      restores.push(() => {
        document.title = previousTitle;
      });
    }
    const meta = (attr, name, content) => {
      if (content == null || content === '') return;
      restores.push(setHeadTag(`meta[${attr}="${name}"]`, metaTag(attr, name), (el) => el.setAttribute('content', content)));
    };
    meta('name', 'description', description);
    meta('property', 'og:title', title);
    meta('property', 'og:description', description);
    meta('property', 'og:url', canonical);
    meta('property', 'og:image', image);
    meta('name', 'twitter:title', title);
    meta('name', 'twitter:description', description);
    meta('name', 'twitter:image', image);
    if (noindex) meta('name', 'robots', 'noindex, nofollow');
    if (canonical && !noindex) {
      restores.push(
        setHeadTag(
          'link[rel="canonical"]',
          () => {
            const el = document.createElement('link');
            el.setAttribute('rel', 'canonical');
            return el;
          },
          (el) => el.setAttribute('href', canonical)
        )
      );
    }
    if (noindex) {
      // An unknown page must not claim the homepage as its canonical address.
      const canon = document.head.querySelector('link[rel="canonical"]');
      if (canon) {
        const parent = canon.parentNode;
        const next = canon.nextSibling;
        canon.remove();
        restores.push(() => parent.insertBefore(canon, next));
      }
    }
    JSON.parse(jsonKey).forEach((data) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.pageMeta = 'true';
      script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
      document.head.appendChild(script);
      restores.push(() => script.remove());
    });
    return () => restores.reverse().forEach((restore) => restore());
  }, [title, description, image, canonical, noindex, jsonKey]);
}
