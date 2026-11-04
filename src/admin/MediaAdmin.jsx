import React, { useCallback, useEffect, useRef, useState } from 'react';
import { deleteMedia, findMediaUsage, listMedia, MEDIA_LIMITS, uploadFile } from '../services/mediaService';
import { listProjects } from '../services/projectService';
import { Banner, buttonClass, inputClass, smallButtonClass, useSession } from './ui';

// Smaller Cloudinary rendition for admin previews (the stored URL stays the original).
const thumbUrl = (item) =>
  item.resourceType === 'image' ? item.url.replace('/image/upload/', '/image/upload/c_fill,w_400,h_225,f_auto,q_auto/') : item.url;

const formatBytes = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function MediaPreview({ item, className }) {
  return item.resourceType === 'video' ? (
    <video src={item.url} muted preload="metadata" className={className} />
  ) : (
    <img src={thumbUrl(item)} alt={item.altText} loading="lazy" className={className} />
  );
}

/* ---------- Upload button (used in the project editor and the library) ---------- */

// `multiple`: pick several files; they upload one after another and onUploaded runs for each.
export function UploadButton({ type, label, onUploaded, multiple = false }) {
  const { user } = useSession();
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [batch, setBatch] = useState(null); // { current, total } while uploading several files
  const [error, setError] = useState('');

  const upload = async (files) => {
    if (!files.length) return;
    setError('');
    const failures = [];
    for (const [i, file] of files.entries()) {
      setBatch(files.length > 1 ? { current: i + 1, total: files.length } : null);
      setProgress(0);
      try {
        const item = await uploadFile(file, user.uid, { expectedType: type, onProgress: setProgress });
        onUploaded(item);
      } catch (err) {
        failures.push(files.length > 1 ? `${file.name}: ${err.message}` : err.message);
      }
    }
    setError(failures.join(' '));
    setProgress(null);
    setBatch(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={type ? MEDIA_LIMITS[type].accept : `${MEDIA_LIMITS.image.accept},${MEDIA_LIMITS.video.accept}`}
        className="sr-only"
        tabIndex={-1}
        multiple={multiple}
        onChange={(e) => upload([...e.target.files])}
      />
      <button type="button" className={smallButtonClass.secondary} disabled={progress !== null} onClick={() => inputRef.current?.click()}>
        {progress !== null ? `Uploading${batch ? ` ${batch.current}/${batch.total}` : ''}… ${progress}%` : label}
      </button>
      {progress !== null && (
        <div className="mt-2 h-1 w-40 overflow-hidden rounded bg-slate-800" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <div className="h-full bg-teal-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

/* ---------- Picker: choose an already-uploaded file ---------- */

export function MediaPicker({ type, onPick }) {
  const [state, setState] = useState({ status: 'idle', items: [] });

  const load = async () => {
    if (state.status !== 'idle') return;
    setState({ status: 'loading', items: [] });
    try {
      const items = await listMedia();
      setState({ status: 'ready', items: items.filter((i) => i.resourceType === type) });
    } catch (err) {
      setState({ status: 'error', items: [], error: err.message });
    }
  };

  return (
    <details className="text-sm" onToggle={(e) => e.currentTarget.open && load()}>
      <summary className="cursor-pointer text-xs text-slate-400 hover:text-teal-300">Choose from library</summary>
      <div className="mt-2">
        {state.status === 'loading' && <p className="text-xs" role="status">Loading…</p>}
        {state.status === 'error' && <p className="text-xs text-red-300">{state.error}</p>}
        {state.status === 'ready' && state.items.length === 0 && <p className="text-xs text-admin-muted">No {type}s uploaded yet.</p>}
        <div className="grid grid-cols-3 gap-2">
          {state.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item)}
              className="overflow-hidden rounded border border-slate-700 hover:border-teal-400/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-300"
              title={item.filename}
            >
              <MediaPreview item={item} className="aspect-video w-full object-cover" />
              <span className="sr-only">Use {item.filename}</span>
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}

/* ---------- Media library page ---------- */

export default function MediaAdmin() {
  const { user } = useSession();
  const [data, setData] = useState({ status: 'loading', items: [], projects: [] });
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState([]); // [{ name, progress }]

  const load = useCallback(async () => {
    try {
      const [items, projects] = await Promise.all([listMedia(), listProjects()]);
      setData({ status: 'ready', items, projects });
    } catch (err) {
      setData((d) => ({ ...d, status: 'error' }));
      setNotice({ tone: 'error', text: `Couldn't load media: ${err.message}` });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadMany = async (files) => {
    setNotice(null);
    for (const file of files) {
      setUploads((u) => [...u, { name: file.name, progress: 0 }]);
      const setProgress = (progress) =>
        setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, progress } : x)));
      try {
        await uploadFile(file, user.uid, { onProgress: setProgress });
      } catch (err) {
        setNotice({ tone: 'error', text: `${file.name}: ${err.message}` });
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }
    await load();
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.filename}" from Cloudinary and the library?`)) return;
    setBusyId(item.id);
    setNotice(null);
    try {
      await deleteMedia(item, data.projects);
      setNotice({ tone: 'success', text: 'File deleted.' });
      await load();
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ tone: 'success', text: 'URL copied.' });
    } catch {
      setNotice({ tone: 'info', text: url });
    }
  };

  const visible = data.items.filter((i) => filter === 'all' || i.resourceType === filter);

  return (
    <section aria-labelledby="media-heading">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 id="media-heading" className="text-xl font-bold text-teal-300">
          Media
        </h1>
        <select aria-label="Filter by type" value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} w-40`}>
          <option value="all">All files</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
      </div>

      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          uploadMany([...e.dataTransfer.files]);
        }}
        className={`mb-6 rounded-lg border border-dashed p-6 text-center text-sm ${dragging ? 'border-teal-400/60 bg-teal-400/5' : 'border-slate-700'}`}
      >
        <p className="mb-3">Drag files here, or</p>
        <label className={`${buttonClass.secondary} cursor-pointer`}>
          Choose files
          <input
            type="file"
            multiple
            accept={`${MEDIA_LIMITS.image.accept},${MEDIA_LIMITS.video.accept}`}
            className="sr-only"
            onChange={(e) => {
              uploadMany([...e.target.files]);
              e.target.value = '';
            }}
          />
        </label>
        <p className="mt-3 text-xs text-admin-muted">
          Images: {MEDIA_LIMITS.image.label}. Videos: {MEDIA_LIMITS.video.label}.
        </p>
        {uploads.map((u) => (
          <p key={u.name} className="mt-2 text-xs" role="status">
            Uploading {u.name}… {u.progress}%
          </p>
        ))}
      </div>

      {data.status === 'loading' && <p role="status">Loading media…</p>}
      {data.status === 'ready' && visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm">No files yet.</p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => {
          const usedBy = findMediaUsage(item, data.projects);
          return (
            <li key={item.id} className="overflow-hidden rounded-lg border border-slate-700/70">
              <MediaPreview item={item} className="aspect-video w-full bg-slate-800 object-cover" />
              <div className="space-y-2 p-3 text-xs">
                <p className="truncate text-sm text-slate-200" title={item.filename}>{item.filename}</p>
                <p className="text-admin-muted">
                  {item.format?.toUpperCase()} · {formatBytes(item.sizeBytes)}
                  {item.width ? ` · ${item.width}×${item.height}` : ''}
                  {item.duration ? ` · ${Math.round(item.duration)}s` : ''}
                </p>
                <p className={usedBy.length ? 'text-teal-200' : 'text-admin-muted'}>
                  {usedBy.length ? `Used by ${usedBy.map((p) => p.title).join(', ')}` : 'Not used by any project'}
                </p>
                <div className="flex gap-2">
                  <button type="button" className={smallButtonClass.secondary} onClick={() => copyUrl(item.url)}>
                    Copy URL
                  </button>
                  <button
                    type="button"
                    className={smallButtonClass.danger}
                    disabled={busyId === item.id || usedBy.length > 0}
                    title={usedBy.length ? 'Used by a project. Replace it there first.' : undefined}
                    onClick={() => remove(item)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
