import React, { useCallback, useEffect, useState } from 'react';
import { DEFAULT_CATEGORIES } from '../data/legacyProjects';
import { PROJECT_TYPES, slugify, validateCategory } from '../lib/validation';
import {
  createCategory,
  deleteCategory,
  listCategories,
  seedDefaultCategories,
  updateCategory,
} from '../services/categoryService';
import { listProjects } from '../services/projectService';
import { Banner, buttonClass, Field, inputClass, smallButtonClass, useSession } from './ui';

const EMPTY = { name: '', slug: '', description: '', projectTypes: ['Design'], active: true, sortOrder: 0 };

function CategoryForm({ initial, editingId, existingCount, onSaved, onCancel }) {
  const { user } = useSession();
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(editingId));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggleType = (type) =>
    update('projectTypes', form.projectTypes.includes(type) ? form.projectTypes.filter((t) => t !== type) : [...form.projectTypes, type]);

  const submit = async (e) => {
    e.preventDefault();
    const fieldErrors = validateCategory(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setSaving(true);
    setError('');
    try {
      if (editingId) await updateCategory(editingId, form, user.uid);
      else await createCategory(form, user.uid);
      onSaved(editingId ? 'Category updated.' : 'Category added.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mb-6 space-y-4 rounded-lg border border-slate-700 p-4">
      <h2 className="font-medium text-slate-200">{editingId ? 'Edit category' : 'New category'}</h2>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cat-name" label="Name" required error={errors.name}>
          <input id="cat-name" className={inputClass} value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))} />
        </Field>
        <Field id="cat-slug" label="Slug" required error={errors.slug}
          hint={editingId ? "The slug can't change once created." : 'Lowercase letters, numbers and hyphens.'}>
          <input id="cat-slug" className={inputClass} value={form.slug} disabled={Boolean(editingId)}
            onChange={(e) => {
              setSlugTouched(true);
              update('slug', e.target.value);
            }}
            onBlur={() => update('slug', slugify(form.slug))} />
        </Field>
      </div>
      <Field id="cat-description" label="Description" error={errors.description}>
        <input id="cat-description" className={inputClass} value={form.description} onChange={(e) => update('description', e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-end gap-6">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-200">
            Project types<span className="text-teal-300"> *</span>
          </legend>
          <div className="flex gap-4">
            {PROJECT_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.projectTypes.includes(t)} onChange={() => toggleType(t)} className="accent-teal-400" />
                {t}
              </label>
            ))}
          </div>
          {errors.projectTypes && <p className="mt-1 text-xs text-red-300">{errors.projectTypes}</p>}
        </fieldset>
        <Field id="cat-order" label="Sort order" error={errors.sortOrder}>
          <input id="cat-order" type="number" className={`${inputClass} w-28`} value={form.sortOrder} onChange={(e) => update('sortOrder', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} className="accent-teal-400" />
          Active (shown on the portfolio)
        </label>
      </div>
      {editingId && existingCount > 0 && form.projectTypes.length < initial.projectTypes.length && (
        <p className="text-xs text-amber-200">
          Removing a type can make this category invalid for projects that already use it.
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary} disabled={saving}>
          {saving ? 'Saving…' : 'Save category'}
        </button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function CategoriesAdmin() {
  const { user } = useSession();
  const [data, setData] = useState({ status: 'loading', categories: [], usage: {} });
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [categories, projects] = await Promise.all([listCategories(), listProjects()]);
      const usage = {};
      projects.forEach((p) => (p.categoryIds || []).forEach((id) => (usage[id] = (usage[id] || 0) + 1)));
      setData({ status: 'ready', categories, usage });
    } catch (err) {
      setData((d) => ({ ...d, status: 'error' }));
      setNotice({ tone: 'error', text: `Couldn't load categories: ${err.message}` });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const defaultsMissing = DEFAULT_CATEGORIES.some((d) => !data.categories.some((c) => c.id === d.id));

  const act = async (id, action, successText) => {
    setBusyId(id);
    setNotice(null);
    try {
      const result = await action();
      setNotice({ tone: 'success', text: typeof successText === 'function' ? successText(result) : successText });
      await load();
    } catch (err) {
      setNotice({ tone: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="categories-heading">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 id="categories-heading" className="text-xl font-bold text-teal-300">
          Categories
        </h1>
        <div className="flex flex-wrap gap-2">
          {data.status === 'ready' && defaultsMissing && (
            <button type="button" className={buttonClass.secondary} disabled={busyId === 'seed'}
              onClick={() => act('seed', () => seedDefaultCategories(user.uid), (n) => `${n} default categories added.`)}>
              Add default categories
            </button>
          )}
          <button type="button" className={buttonClass.primary} onClick={() => setEditing('new')}>
            Add category
          </button>
        </div>
      </div>

      {notice && (
        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}

      {editing && (
        <CategoryForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? EMPTY : { ...EMPTY, ...editing, description: editing.description || '' }}
          editingId={editing === 'new' ? null : editing.id}
          existingCount={editing === 'new' ? 0 : data.usage[editing.id] || 0}
          onCancel={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setNotice({ tone: 'success', text });
            load();
          }}
        />
      )}

      {data.status === 'loading' && <p role="status">Loading categories…</p>}
      {data.status === 'ready' && data.categories.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm">
          No categories yet. Add the defaults or create your own.
        </p>
      )}

      {data.categories.length > 0 && (
        <div className="relative overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 text-xs uppercase tracking-wide text-admin-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Types</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Order</th>
                <th className="py-2 pr-4 font-medium">Projects</th>
                <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => {
                const used = data.usage[c.id] || 0;
                return (
                  <tr key={c.id} className="border-b border-slate-800">
                    <td className="py-3 pr-4">
                      <span className="text-slate-200">{c.name}</span>
                      <span className="block text-xs text-admin-muted">/{c.slug}</span>
                    </td>
                    <td className="py-3 pr-4">{(c.projectTypes || []).join(', ')}</td>
                    <td className="py-3 pr-4">{c.active ? 'Active' : 'Inactive'}</td>
                    <td className="py-3 pr-4">{c.sortOrder}</td>
                    <td className="py-3 pr-4">{used}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className={smallButtonClass.secondary} onClick={() => setEditing(c)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className={smallButtonClass.danger}
                          disabled={busyId === c.id || used > 0}
                          title={used > 0 ? 'In use by projects. Reassign them or deactivate this category.' : undefined}
                          onClick={() => {
                            if (window.confirm(`Delete the "${c.name}" category?`)) {
                              act(c.id, () => deleteCategory(c.id, user.uid), 'Category deleted.');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
