import { fetchPublicPortfolio } from './publicProjectService';
import { clearQueryCache, decodeFields } from '../lib/firestoreRest';

const str = (stringValue) => ({ stringValue });
const doc = (id, fields) => ({ document: { name: `projects/p/databases/(default)/documents/x/${id}`, fields } });

beforeEach(() => {
  clearQueryCache();
  global.fetch = jest.fn();
});

test('public portfolio queries published projects and active categories only, exposing allowlisted fields', async () => {
  global.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [
        doc('b', {
          slug: str('second'), type: str('Development'), title: str('Second'), shortDescription: str('Short'),
          coverMedia: { mapValue: { fields: { url: str('https://img.example/b.png'), alt: str('B') } } },
          techStack: { arrayValue: { values: [str('React')] } },
          projectUrl: str('javascript:alert(1)'),
          categoryIds: { arrayValue: { values: [str('web')] } },
          sortOrder: { integerValue: '2' }, createdBy: str('admin-uid'),
        }),
        doc('a', { slug: str('first'), type: str('Development'), title: str('First'), shortDescription: str('Short'), featured: { booleanValue: true }, sortOrder: { integerValue: '5' }, projectUrl: str('https://first.example') }),
      ],
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [doc('web', { name: str('Web Apps'), projectTypes: { arrayValue: { values: [str('Development')] } }, active: { booleanValue: true } })],
    });

  const { projects, categories } = await fetchPublicPortfolio();

  const bodies = global.fetch.mock.calls.map(([, init]) => JSON.parse(init.body).structuredQuery);
  expect(bodies[0].from).toEqual([{ collectionId: 'projects' }]);
  expect(bodies[0].where.fieldFilter).toMatchObject({ field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } });
  expect(bodies[1].where.fieldFilter).toMatchObject({ field: { fieldPath: 'active' }, value: { booleanValue: true } });
  expect(projects.map((p) => p.id)).toEqual(['a', 'b']); // featured first
  expect(projects[0].href).toBe('https://first.example');
  const b = projects[1];
  expect(b.href).toBeNull(); // unsafe URL dropped
  expect(b.thumbnail).toBe('https://img.example/b.png');
  expect(b.tags).toEqual(['React']);
  expect(b).not.toHaveProperty('createdBy');
  expect(categories).toEqual([expect.objectContaining({ id: 'web', name: 'Web Apps', projectTypes: ['Development'] })]);
});

test('an empty result (no matching documents) is an empty list, not an error', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => [{ readTime: '2026-01-01T00:00:00Z' }] });
  const { projects, categories } = await fetchPublicPortfolio();
  expect(projects).toEqual([]);
  expect(categories).toEqual([]);
});

test('a failed request surfaces as an error', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
  await expect(fetchPublicPortfolio()).rejects.toThrow('403');
});

test('decodes Firestore value types', () => {
  expect(decodeFields({ n: { integerValue: '7' }, d: { doubleValue: 1.5 }, nul: { nullValue: null }, t: { timestampValue: '2026-01-01T00:00:00Z' } }))
    .toEqual({ n: 7, d: 1.5, nul: null, t: '2026-01-01T00:00:00Z' });
});

test('identical simultaneous queries share one request', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => [] });
  await Promise.all([fetchPublicPortfolio(), fetchPublicPortfolio()]);
  expect(global.fetch).toHaveBeenCalledTimes(2); // projects + categories, not four
});
