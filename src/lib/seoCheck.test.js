import { contentWords, SEO_LEVELS, seoChecks } from './seoCheck';
import { nextPreviousSlugs } from './validation';
import { resolveProject } from './projectLookup';

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

const GOOD = {
  title: 'Why Weds',
  slug: 'why-weds',
  shortDescription: 'A web application for planning and arranging wedding events, built for real event planners.',
  description: words(160),
  techStack: ['React'],
  coverMedia: { url: 'https://img.example/a.png', alt: 'Home screen' },
  gallery: [{ url: 'https://img.example/b.png', alt: 'Guest list' }],
  projectUrl: 'https://example.com',
  links: [],
};

test('a complete project is SEO ready with every check passing', () => {
  const result = seoChecks(GOOD);
  expect(result.problems).toEqual([]);
  expect(result.level).toBe('ready');
  expect(result.passed).toBe(result.total);
  expect(contentWords(GOOD)).toBe(160);
});

test('little text makes the page "thin"', () => {
  const thin = seoChecks({ ...GOOD, description: 'Short.' });
  expect(thin.level).toBe('thin');
  expect(thin.items.find((i) => i.id === 'content').ok).toBe(false);
  expect(SEO_LEVELS[thin.level].label).toBe('Thin page');
});

test('missing polish is reported without calling the page thin', () => {
  const result = seoChecks({
    ...GOOD,
    coverMedia: { url: 'https://img.example/a.png', alt: '' },
    gallery: [{ url: 'https://img.example/b.png', alt: '' }],
    techStack: [],
    projectUrl: '',
    links: [],
  });
  expect(result.level).toBe('okay');
  expect(result.problems.map((p) => p.id).sort()).toEqual(['cover-alt', 'gallery-alt', 'link', 'tech']);
});

test('the short description has a target length and a slug that is too long is flagged', () => {
  expect(seoChecks({ ...GOOD, shortDescription: 'x'.repeat(200) }).items.find((i) => i.id === 'short').ok).toBe(false);
  expect(seoChecks({ ...GOOD, slug: 'a'.repeat(70) }).items.find((i) => i.id === 'slug').ok).toBe(false);
});

describe('slug history', () => {
  test('a published project keeps its old address when the slug changes', () => {
    expect(nextPreviousSlugs({ slug: 'old', status: 'published' }, 'new')).toEqual(['old']);
    expect(nextPreviousSlugs({ slug: 'b', status: 'published', previousSlugs: ['a'] }, 'c')).toEqual(['a', 'b']);
  });

  test('a draft that was never published leaves no redirect behind', () => {
    expect(nextPreviousSlugs({ slug: 'old', status: 'draft', publishedAt: null }, 'new')).toEqual([]);
    // ...but an unpublished project that was live once does, because Google may have indexed it.
    expect(nextPreviousSlugs({ slug: 'old', status: 'draft', publishedAt: 123 }, 'new')).toEqual(['old']);
  });

  test('going back to an old slug removes it from the history, and unchanged slugs add nothing', () => {
    expect(nextPreviousSlugs({ slug: 'b', status: 'published', previousSlugs: ['a'] }, 'a')).toEqual(['b']);
    expect(nextPreviousSlugs({ slug: 'a', status: 'published', previousSlugs: ['x'] }, 'a')).toEqual(['x']);
  });

  test('the history is capped at the newest 20 entries', () => {
    const previousSlugs = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const next = nextPreviousSlugs({ slug: 'current', status: 'published', previousSlugs }, 'new');
    expect(next).toHaveLength(20);
    expect(next[19]).toBe('current');
    expect(next).not.toContain('s0');
  });
});

describe('resolveProject', () => {
  const projects = [
    { slug: 'laya', previousSlugs: [] },
    { slug: 'deskmate', previousSlugs: ['desk-mate', 'office-desks'] },
  ];

  test('finds the current address, redirects an old one, and reports unknown ones', () => {
    expect(resolveProject(projects, 'laya')).toEqual({ project: projects[0], redirectTo: null });
    expect(resolveProject(projects, 'desk-mate')).toEqual({ project: null, redirectTo: '/projects/deskmate' });
    expect(resolveProject(projects, 'nope')).toEqual({ project: null, redirectTo: null });
  });

  test('a current slug wins over an old one that another project once used', () => {
    const both = [{ slug: 'a', previousSlugs: [] }, { slug: 'b', previousSlugs: ['a'] }];
    expect(resolveProject(both, 'a').project).toBe(both[0]);
  });
});
