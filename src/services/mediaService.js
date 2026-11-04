import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

/* Media library backed by Cloudinary (files) and Firestore (metadata only).
   Uploads are signed by the Netlify Function at /.netlify/functions/cloudinary, which checks
   the admin's Firebase token and admins/{uid} record. The Cloudinary secret never reaches
   the browser. Files are re-checked on the server after upload; bad files are deleted. */

const FUNCTION_URL = '/.netlify/functions/cloudinary';

// Keep in sync with LIMITS in netlify/functions/cloudinary.js (the server enforces them).
export const MEDIA_LIMITS = {
  image: {
    maxBytes: 10 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
    accept: 'image/jpeg,image/png,image/webp,image/avif,image/gif',
    label: 'JPG, PNG, WebP, AVIF or GIF, up to 10 MB',
  },
  video: {
    maxBytes: 100 * 1024 * 1024,
    types: ['video/mp4', 'video/webm', 'video/quicktime'],
    accept: 'video/mp4,video/webm,video/quicktime',
    label: 'MP4, WebM or MOV, up to 100 MB',
  },
  // Resume PDFs (Cloudinary "raw" files). The server also checks the file really is a PDF.
  raw: {
    maxBytes: 10 * 1024 * 1024,
    types: ['application/pdf'],
    accept: 'application/pdf,.pdf',
    label: 'PDF, up to 10 MB',
  },
};

export function checkFile(file, expectedType) {
  const resourceType = file.type.startsWith('video/') ? 'video' : file.type === 'application/pdf' ? 'raw' : 'image';
  const limits = MEDIA_LIMITS[resourceType];
  if (expectedType && resourceType !== expectedType) {
    throw new Error(`Choose ${{ image: 'an image', video: 'a video', raw: 'a PDF' }[expectedType]} file.`);
  }
  if (!limits.types.includes(file.type)) throw new Error(`Unsupported file. Use ${limits.label}.`);
  if (file.size > limits.maxBytes) throw new Error(`File is too large. Use ${limits.label}.`);
  return resourceType;
}

async function callUploadFunction(body) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in again to continue.');
  let res;
  try {
    res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error ||
        (res.status === 404 ? 'The upload service is not available here. Uploads work on Netlify (or `netlify dev`).' : `Upload service error (${res.status}).`)
    );
  }
  return data;
}

function sendWithProgress(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the status check
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body.error?.message || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload. Try again.'));
    xhr.send(form);
  });
}

// Signed upload to Cloudinary, re-checked by the server. Returns { resourceType, publicId, url, bytes, … }.
// Use uploadFile() for media-library files; this alone is for files kept elsewhere (resumes).
export async function uploadToCloudinary(file, { expectedType, onProgress } = {}) {
  const resourceType = checkFile(file, expectedType);
  const signed = await callUploadFunction({ action: 'sign', resourceType });

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', signed.timestamp);
  form.append('signature', signed.signature);
  form.append('folder', signed.folder);
  if (signed.allowed_formats) form.append('allowed_formats', signed.allowed_formats);
  const uploaded = await sendWithProgress(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/${resourceType}/upload`,
    form,
    onProgress
  );

  const verified = await callUploadFunction({ action: 'verify', resourceType, publicId: uploaded.public_id });
  return { resourceType, ...verified };
}

// Tech-stack skill logo → Cloudinary PortFolio/tech-stack/<variant>. `source` is a File/Blob
// (e.g. pasted SVG code) or an https URL, which Cloudinary fetches and stores itself, so the
// logo no longer depends on the original site. Returns { url, publicId }.
export const LOGO_MAX_BYTES = 1024 * 1024;

export async function uploadLogo(source, variant) {
  if (typeof source !== 'string' && source.size > LOGO_MAX_BYTES) throw new Error('Logo files must be 1 MB or smaller.');
  // Raw SVG code goes to the server as-is: it adds what Cloudinary needs and uploads it.
  if (typeof source !== 'string') {
    const uploaded = await callUploadFunction({
      action: 'upload-svg',
      resourceType: 'logo',
      variant,
      name: (source.name || 'logo').replace(/\.svg$/i, ''),
      svg: await source.text(),
    });
    return { url: uploaded.url, publicId: uploaded.publicId };
  }
  const signed = await callUploadFunction({ action: 'sign', resourceType: 'logo', variant });
  const form = new FormData();
  form.append('file', source);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', signed.timestamp);
  form.append('signature', signed.signature);
  form.append('folder', signed.folder);
  form.append('allowed_formats', signed.allowed_formats);
  const uploaded = await sendWithProgress(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, form);
  const verified = await callUploadFunction({ action: 'verify', resourceType: 'logo', publicId: uploaded.public_id });
  return { url: verified.url, publicId: verified.publicId };
}

export function deleteLogoFile(publicId) {
  return callUploadFunction({ action: 'delete', resourceType: 'logo', publicId });
}

export function deleteCloudinaryFile(resourceType, publicId) {
  return callUploadFunction({ action: 'delete', resourceType, publicId });
}

export async function uploadFile(file, uid, { expectedType, onProgress } = {}) {
  const { resourceType, ...verified } = await uploadToCloudinary(file, { expectedType, onProgress });
  const record = {
    provider: 'cloudinary',
    publicId: verified.publicId,
    url: verified.url,
    resourceType,
    format: verified.format,
    contentType: file.type,
    sizeBytes: verified.bytes,
    width: verified.width,
    height: verified.height,
    duration: verified.duration,
    filename: file.name.slice(0, 200),
    altText: '',
    createdAt: serverTimestamp(),
    createdBy: uid,
  };
  const ref = await addDoc(collection(db, 'media'), record);
  return { id: ref.id, ...record };
}

export async function listMedia() {
  const snap = await getDocs(query(collection(db, 'media'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function updateMediaAlt(id, altText) {
  return updateDoc(doc(db, 'media', id), { altText: altText.trim().slice(0, 200) });
}

// Projects that use this file as their cover image or video.
export function findMediaUsage(item, projects) {
  return projects.filter(
    (p) => p.coverMedia?.url === item.url || (p.media || []).some((m) => m.url === item.url)
  );
}

export async function deleteMedia(item, projects) {
  const usedBy = findMediaUsage(item, projects);
  if (usedBy.length) {
    throw new Error(`This file is used by ${usedBy.map((p) => `"${p.title}"`).join(', ')}. Replace it there first.`);
  }
  await deleteCloudinaryFile(item.resourceType, item.publicId);
  await deleteDoc(doc(db, 'media', item.id));
}
