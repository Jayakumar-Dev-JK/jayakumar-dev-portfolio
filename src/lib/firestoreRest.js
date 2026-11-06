import { firebaseConfig } from './firebaseConfig';

// Reads public Firestore data with a plain fetch instead of the Firebase SDK, which keeps ~170 KB
// of JavaScript off the home page. Security Rules still decide what is readable, so queries must
// match the rules (e.g. status == "published"). Writes and the admin keep using the SDK.

// Firestore's REST API wraps every value in a type tag. This turns one back into a plain value.
export function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  return null;
}

export function decodeFields(fields) {
  const out = {};
  Object.entries(fields || {}).forEach(([key, value]) => {
    out[key] = decodeValue(value);
  });
  return out;
}

// One document's fields by path (e.g. "siteSettings/resume"), or null when it does not exist.
export async function getDocument(path) {
  const { projectId, apiKey } = firebaseConfig;
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?key=${apiKey}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status})`);
  return decodeFields((await response.json()).fields);
}

// Several parts of a page can ask for the same list at once, so identical requests share one
// fetch for the life of the page. A failed request is forgotten so a retry fetches again.
const inFlight = new Map();
export const clearQueryCache = () => inFlight.clear();

// Documents where `field == value` in a collection, as [{ id, data }].
export function queryEquals(collectionId, field, value) {
  const key = `${collectionId}|${field}|${value}`;
  if (!inFlight.has(key)) {
    const request = runEqualsQuery(collectionId, field, value);
    request.catch(() => inFlight.delete(key));
    inFlight.set(key, request);
  }
  return inFlight.get(key);
}

async function runEqualsQuery(collectionId, field, value) {
  const { projectId, apiKey } = firebaseConfig;
  const valueTag = typeof value === 'boolean' ? { booleanValue: value } : { stringValue: String(value) };
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`,
    {
      method: 'POST',
      // text/plain keeps this a "simple" cross-origin request, so the browser skips the preflight round trip.
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: valueTag } },
        },
      }),
    }
  );
  if (!response.ok) throw new Error(`Firestore query failed (${response.status})`);
  const rows = await response.json();
  return rows
    .filter((row) => row.document)
    .map((row) => ({ id: row.document.name.split('/').pop(), data: decodeFields(row.document.fields) }));
}
