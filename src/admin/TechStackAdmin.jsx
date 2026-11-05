import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaArrowDown, FaArrowUp, FaChevronDown, FaChevronRight, FaPen, FaPlus, FaSearch, FaTrash,
} from 'react-icons/fa';
import { CATEGORY_ICONS, SKILL_ICONS, SkillLogo, svgDataUri, TechIcon } from '../components/techIcon';
import { parseLogoInput, slugify, validateTechCategory, validateTechSkill } from '../lib/validation';
import {
  assertNoDuplicate, createTechCategory, createTechSkill, deleteTechCategory, deleteTechSkill, listTechStack,
  reorderTechCategories, reorderTechSkills, saveSkillLogos, seedTechStack, setTechCategoryActive,
  setTechSkillActive, updateTechCategory, updateTechSkill,
} from '../services/techStackService';
import { deleteLogoFiles, logoInputValue, needsLogoSync, resolveSkillLogos, skillLogoIds, syncSkillLogos } from './logoSvg';
import {
  Banner, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Icon, inputClass, SkeletonRows,
  smallButtonClass, Switch, useConfirm, useSession, useToast,
} from './ui';

// One page for every category and skill. Categories are an accordion (one open at a time) and
// each skill list scrolls inside its card. Edits happen inline; each save writes to Firestore
// and the public section picks the change up on its next load. Logo files (default + hover
// versions) are uploaded to Cloudinary before the skill is saved.

const selectClass = inputClass;

function IconSelect({ id, kind, value, onChange, error }) {
  const registry = kind === 'category' ? CATEGORY_ICONS : SKILL_ICONS;
  return (
    <select id={id} className={selectClass} value={value} aria-invalid={Boolean(error) || undefined} onChange={(e) => onChange(e.target.value)}>
      {kind === 'skill' && <option value="">Auto (initials tile)</option>}
      {Object.entries(registry).map(([key, { label }]) => (
        <option key={key} value={key}>{label}</option>
      ))}
    </select>
  );
}

// Reports whether a form differs from its starting values, for the unsaved-changes warning.
function useDirtyReport(form, initial, id, report) {
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    report(id, dirty);
    return () => report(id, false);
  }, [dirty, id, report]);
}

function CategoryForm({ initial, editingId, onSave, onCancel, report }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useDirtyReport(form, initial, `cat-${editingId || 'new'}`, report);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    const fieldErrors = validateTechCategory(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const idPrefix = `cat-${editingId || 'new'}`;
  return (
    <form onSubmit={submit} noValidate className="space-y-3 p-4">
      {error && <p role="alert" className="text-sm text-admin-danger-text">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-[1fr_200px_110px]">
        <Field id={`${idPrefix}-name`} label="Category name" required error={errors.name}>
          <input id={`${idPrefix}-name`} className={inputClass} value={form.name} maxLength={60} autoFocus
            aria-invalid={Boolean(errors.name) || undefined} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field id={`${idPrefix}-icon`} label="Icon" error={errors.icon}>
          <IconSelect id={`${idPrefix}-icon`} kind="category" value={form.icon} onChange={(v) => set('icon', v)} error={errors.icon} />
        </Field>
        <Field id={`${idPrefix}-order`} label="Sort order" error={errors.sortOrder}>
          <input id={`${idPrefix}-order`} type="number" className={inputClass} value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active" />
          {form.isActive ? 'Active (shown on the portfolio)' : 'Inactive (hidden)'}
        </label>
        <div className="flex gap-2">
          <Button type="button" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{editingId ? 'Save category' : 'Add category'}</Button>
        </div>
      </div>
    </form>
  );
}

const previewSrc = (text) => {
  const { iconUrl, iconSvg } = parseLogoInput(text);
  return iconSvg ? svgDataUri(iconSvg) : iconUrl || '';
};

function LogoInput({ id, label, value, onChange, error, variant, hasBuiltIn }) {
  const parsed = parseLogoInput(value);
  const auto = hasBuiltIn ? `Empty = built-in ${variant === 'hover' ? 'original colours' : 'white version'}.` : 'Empty = ' + (variant === 'hover' ? 'same as default.' : 'white version of the hover logo.');
  return (
    <Field id={id} label={label} error={error}
      hint={parsed.iconSvg ? 'SVG code detected.' : parsed.iconUrl ? 'Image URL detected. A copy is saved to cloud storage.' : `URL or <svg> code. ${auto}`}>
      <textarea id={id} rows={value.trim().startsWith('<') ? 4 : 2} spellCheck={false}
        className={`${inputClass} resize-y font-mono text-xs`} value={value} placeholder="https://… or <svg …>…</svg>"
        aria-invalid={Boolean(error) || undefined} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function SkillForm({ initial, editingId, categories, onSave, onCancel, report }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useDirtyReport(form, initial, `skill-${editingId || initial.categoryId}`, report);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    const fieldErrors = validateTechSkill(form);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const p = `skill-${editingId || initial.categoryId}`;
  const defaultSrc = previewSrc(form.logoDefault);
  const hoverSrc = previewSrc(form.logoHover);
  const hasBuiltIn = Boolean(SKILL_ICONS[form.icon]);
  return (
    <form onSubmit={submit} noValidate className="space-y-3 border-t border-admin-subtle bg-admin-app/40 p-4">
      <p className="text-sm font-medium text-admin-label">{editingId ? `Edit ${initial.name}` : 'New skill'}</p>
      {error && <p role="alert" className="text-sm text-admin-danger-text">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_180px_100px]">
        <Field id={`${p}-name`} label="Technology name" required error={errors.name}>
          <input id={`${p}-name`} className={inputClass} value={form.name} maxLength={60} autoFocus
            aria-invalid={Boolean(errors.name) || undefined} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field id={`${p}-icon`} label="Built-in logo" error={errors.icon}>
          <div className="flex items-center gap-2">
            <span className="ti-host flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900" title="Hover to see the hover version">
              <TechIcon key={`${defaultSrc}|${hoverSrc}`} icon={form.icon} defaultSrc={defaultSrc} hoverSrc={hoverSrc} name={form.name || '?'} size={20} />
            </span>
            <IconSelect id={`${p}-icon`} kind="skill" value={form.icon} onChange={(v) => set('icon', v)} error={errors.icon} />
          </div>
        </Field>
        <Field id={`${p}-category`} label="Category" required error={errors.categoryId}>
          <select id={`${p}-category`} className={selectClass} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field id={`${p}-order`} label="Sort order" error={errors.sortOrder}>
          <input id={`${p}-order`} type="number" className={inputClass} value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <LogoInput id={`${p}-logo-default`} label="Custom default logo (optional)" variant="default" hasBuiltIn={hasBuiltIn}
          value={form.logoDefault} error={errors.logoDefault} onChange={(v) => set('logoDefault', v)} />
        <LogoInput id={`${p}-logo-hover`} label="Custom hover logo (optional)" variant="hover" hasBuiltIn={hasBuiltIn}
          value={form.logoHover} error={errors.logoHover} onChange={(v) => set('logoHover', v)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active" />
          {form.isActive ? 'Active' : 'Inactive (hidden)'}
        </label>
        <div className="flex gap-2">
          <Button type="button" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>{saving ? 'Saving logos…' : editingId ? 'Save skill' : 'Add skill'}</Button>
        </div>
      </div>
    </form>
  );
}

function MoveButtons({ index, count, onMove, label, disabled }) {
  return (
    <span className="flex gap-1">
      <button type="button" className={smallButtonClass.secondary} aria-label={`Move ${label} up`}
        disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)}>
        <Icon as={FaArrowUp} size={11} />
      </button>
      <button type="button" className={smallButtonClass.secondary} aria-label={`Move ${label} down`}
        disabled={disabled || index === count - 1} onClick={() => onMove(index, index + 1)}>
        <Icon as={FaArrowDown} size={11} />
      </button>
    </span>
  );
}

function logoSource(skill) {
  const custom = [skill.logoDefault?.source === 'custom' && 'default', skill.logoHover?.source === 'custom' && 'hover'].filter(Boolean);
  if (needsLogoSync(skill)) return 'custom logo · not in cloud yet';
  if (custom.length) return `custom ${custom.join(' + ')} · in cloud`;
  return SKILL_ICONS[skill.icon] ? `${skill.icon} · in cloud` : 'initials tile';
}

function SkillRow({ skill, index, count, filtering, busy, onToggle, onMove, onEdit, onDelete }) {
  return (
    <li className="ti-host flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-admin-subtle px-4 py-2 transition-colors first:border-t-0 hover:bg-slate-800/30">
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-admin-muted" aria-label={`Position ${index + 1}`}>
        {index + 1}
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900">
        <SkillLogo skill={skill} size={18} />
      </span>
      <span className="min-w-[8rem] flex-1">
        <span className={`block text-sm ${skill.isActive ? 'text-admin-strong' : 'text-admin-muted line-through'}`}>{skill.name}</span>
        <span className="block truncate text-xs text-admin-muted">
          {logoSource(skill)} · order {skill.sortOrder}
        </span>
      </span>
      <Switch checked={skill.isActive} onChange={(v) => onToggle(skill, v)} label={`${skill.name} active`} disabled={busy} />
      <MoveButtons index={index} count={count} label={skill.name} disabled={busy || filtering} onMove={onMove} />
      <button type="button" className={smallButtonClass.secondary} aria-label={`Edit ${skill.name}`} onClick={() => onEdit(skill)} disabled={busy}>
        <Icon as={FaPen} size={11} /> Edit
      </button>
      <button type="button" className={smallButtonClass.danger} aria-label={`Delete ${skill.name}`} onClick={() => onDelete(skill)} disabled={busy}>
        <Icon as={FaTrash} size={11} />
      </button>
    </li>
  );
}

const newSkillDefaults = (category) => ({
  categoryId: category.id, name: '', icon: '', logoDefault: '', logoHover: '', sortOrder: category.skills.length, isActive: true,
});

export default function TechStackAdmin() {
  const { user } = useSession();
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [data, setData] = useState({ status: 'loading', categories: [] });
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(undefined); // undefined = first category; null = all closed
  const [editingCategory, setEditingCategory] = useState(null); // null | 'new' | category id
  const [skillForm, setSkillForm] = useState(null); // null | { categoryId, skill? }
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null); // category being deleted
  const [moveTo, setMoveTo] = useState('');
  const [dirtyIds, setDirtyIds] = useState({});
  const [syncProgress, setSyncProgress] = useState('');
  const seedTried = useRef(false);

  const report = useCallback((id, dirty) => setDirtyIds((d) => (Boolean(d[id]) === dirty ? d : { ...d, [id]: dirty })), []);
  const hasUnsaved = Object.values(dirtyIds).some(Boolean);

  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  const load = useCallback(async () => {
    try {
      let categories = await listTechStack();
      // First visit: create the starter content once. The marker document keeps this from
      // ever running again, even if the admin later deletes everything.
      if (categories.length === 0 && !seedTried.current) {
        seedTried.current = true;
        if ((await seedTechStack(user.uid)) > 0) categories = await listTechStack();
      }
      setData({ status: 'ready', categories });
    } catch (err) {
      setData({ status: 'error', categories: [], message: err.message });
    }
  }, [user.uid]);

  useEffect(() => {
    load();
  }, [load]);

  // Runs a write, then reloads. Failures stay visible as a toast.
  const run = async (action, success) => {
    setBusy(true);
    try {
      await action();
      await load();
      if (success) toast.show({ text: success });
      return true;
    } catch (err) {
      toast.show({ tone: 'error', text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const { categories } = data;
  const totalSkills = categories.reduce((n, c) => n + c.skills.length, 0);
  const needle = query.trim().toLowerCase();
  const filtering = needle !== '';
  const visible = categories
    .map((c) => ({ ...c, shown: filtering ? c.skills.filter((s) => s.name.toLowerCase().includes(needle)) : c.skills }))
    .filter((c) => !filtering || c.shown.length > 0);

  const unsyncedSkills = categories.flatMap((c) => c.skills).filter(needsLogoSync);

  // Uploads the logo files of every skill not in Cloudinary yet, one skill at a time, then
  // saves all records together. Skills that fail are reported and can be retried.
  const syncLogos = () =>
    run(async () => {
      const updates = [];
      const failed = [];
      const replacedFiles = [];
      for (const [i, skill] of unsyncedSkills.entries()) {
        setSyncProgress(`${i + 1}/${unsyncedSkills.length}`);
        try {
          const { replaced, ...logos } = await syncSkillLogos(skill);
          updates.push({ id: skill.id, ...logos });
          replacedFiles.push(...replaced);
        } catch (err) {
          failed.push(`${skill.name} (${err.message})`);
        }
      }
      setSyncProgress('');
      if (updates.length) await saveSkillLogos(updates, user.uid);
      deleteLogoFiles(replacedFiles);
      if (failed.length) throw new Error(`${updates.length} saved; failed: ${failed.join('; ')}`);
    }, `${unsyncedSkills.length} skill logos saved to cloud storage.`);

  const moveCategory = (from, to) => {
    const ids = categories.map((c) => c.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    run(() => reorderTechCategories(ids, user.uid));
  };

  const moveSkill = (category) => (from, to) => {
    const ids = category.skills.map((s) => s.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    run(() => reorderTechSkills(ids, user.uid));
  };

  const saveCategory = async (form) => {
    const ok = await run(
      () => (editingCategory === 'new' ? createTechCategory(form, user.uid) : updateTechCategory(editingCategory, form, user.uid)),
      editingCategory === 'new' ? 'Category added.' : 'Category updated.'
    );
    if (!ok) throw new Error('Could not save the category.');
    setEditingCategory(null);
  };

  const saveSkill = async (form) => {
    const editing = skillForm.skill;
    const target = categories.find((c) => c.id === form.categoryId);
    const moved = editing && editing.categoryId !== form.categoryId;
    const nextSortOrder = (target?.skills.reduce((m, s) => Math.max(m, s.sortOrder ?? 0), -1) ?? -1) + 1;
    const ok = await run(async () => {
      await assertNoDuplicate(form.categoryId, slugify(form.name), editing?.id);
      const { replaced, ...logos } = await resolveSkillLogos(form, editing || {});
      const input = { ...form, ...logos };
      if (editing) await updateTechSkill(editing.id, input, user.uid, { moved, nextSortOrder });
      else await createTechSkill(input, user.uid);
      deleteLogoFiles(replaced);
    }, editing ? 'Skill updated.' : 'Skill added.');
    if (!ok) throw new Error('Could not save the skill.');
    setSkillForm(null);
  };

  const removeSkill = async (skill) => {
    const ok = await confirm({
      title: `Delete ${skill.name}?`,
      description: 'It will disappear from the public portfolio. This can\'t be undone.',
      confirmLabel: 'Delete skill',
      tone: 'danger',
    });
    if (ok) {
      run(async () => {
        await deleteTechSkill(skill.id, user.uid);
        deleteLogoFiles(skillLogoIds(skill));
      }, 'Skill deleted.');
    }
  };

  const startRemoveCategory = async (category) => {
    if (category.skills.length === 0) {
      const ok = await confirm({
        title: `Delete ${category.name}?`,
        description: 'This category is empty. This can\'t be undone.',
        confirmLabel: 'Delete category',
        tone: 'danger',
      });
      if (ok) run(() => deleteTechCategory(category.id, user.uid), 'Category deleted.');
      return;
    }
    setMoveTo(categories.find((c) => c.id !== category.id)?.id || '');
    setRemoving(category);
  };

  const confirmRemoveCategory = async (mode) => {
    const ok = await run(
      async () => {
        await deleteTechCategory(removing.id, user.uid, { mode, moveTo });
        if (mode === 'delete') deleteLogoFiles(removing.skills.flatMap(skillLogoIds));
      },
      mode === 'move' ? 'Skills moved and category deleted.' : 'Category and its skills deleted.'
    );
    if (ok) setRemoving(null);
  };

  const categoryInitial = (c) => (c ? { name: c.name, icon: c.icon, sortOrder: c.sortOrder, isActive: c.isActive }
    : { name: '', icon: 'code', sortOrder: categories.length, isActive: true });

  return (
    <section aria-labelledby="tech-heading">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="tech-heading" className="text-xl font-bold text-admin-heading">Tech Stack &amp; Skills</h1>
          <p className="mt-1 text-sm text-admin-muted">Manage portfolio technologies and skill categories.</p>
          {data.status === 'ready' && (
            <p className="mt-1 text-xs text-admin-muted">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'} · {totalSkills} {totalSkills === 1 ? 'skill' : 'skills'}
            </p>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {data.status === 'ready' && (
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Icon as={FaSearch} size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted" />
              <input type="search" aria-label="Search skills" placeholder="Search skills…" className={`${inputClass} pl-9`}
                value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          )}
          <Button variant="primary" onClick={() => setEditingCategory('new')} disabled={editingCategory === 'new' || data.status !== 'ready'}>
            <Icon as={FaPlus} size={12} /> Add category
          </Button>
        </div>
      </div>

      {data.status === 'loading' && <SkeletonRows count={4} label="Loading tech stack" />}
      {data.status === 'error' && (
        <ErrorState title="Couldn't load the tech stack" onRetry={load}>{data.message}</ErrorState>
      )}

      {data.status === 'ready' && (
        <>
          {unsyncedSkills.length > 0 && (
            <Banner tone="info">
              <span className="mr-3">
                {unsyncedSkills.length} {unsyncedSkills.length === 1 ? "skill's logo isn't" : "skills' logos aren't"} in cloud storage yet.
                Uploading creates a default (white) and hover (original) file for each.
              </span>
              <Button size="small" variant="primary" loading={busy} className="mt-2 sm:mt-0" onClick={syncLogos}>
                {syncProgress ? `Uploading ${syncProgress}…` : 'Upload logos to cloud storage'}
              </Button>
            </Banner>
          )}

          {editingCategory === 'new' && (
            <Card className="mb-4">
              <CategoryForm initial={categoryInitial(null)} onSave={saveCategory} onCancel={() => setEditingCategory(null)} report={report} />
            </Card>
          )}

          {categories.length === 0 && editingCategory !== 'new' && (
            <EmptyState title="No categories yet" actions={<Button variant="primary" onClick={() => setEditingCategory('new')}>Add category</Button>}>
              Create a category, then add the technologies that belong in it.
            </EmptyState>
          )}
          {filtering && visible.length === 0 && categories.length > 0 && (
            <p className="rounded-lg border border-dashed border-admin-border p-6 text-center text-sm text-admin-muted">
              No skills match "{query}".
            </p>
          )}

          <div className="space-y-4">
            {visible.map((category) => {
              const index = categories.findIndex((c) => c.id === category.id);
              const open = filtering || (openId === undefined ? index === 0 : openId === category.id);
              const editingThis = editingCategory === category.id;
              return (
                <Card key={category.id} as="section" aria-label={category.name} className="overflow-hidden">
                  {editingThis ? (
                    <CategoryForm initial={categoryInitial(category)} editingId={category.id} onSave={saveCategory}
                      onCancel={() => setEditingCategory(null)} report={report} />
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
                      <button type="button" aria-expanded={open} aria-controls={`skills-${category.id}`} disabled={filtering}
                        className="group flex min-w-[10rem] flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent max-md:min-h-11"
                        onClick={() => {
                          setOpenId(open ? null : category.id);
                          if (skillForm && skillForm.categoryId !== category.id) setSkillForm(null);
                        }}>
                        <Icon as={open ? FaChevronDown : FaChevronRight} size={13} className="text-admin-muted group-hover:text-admin-accent" />
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
                          <TechIcon kind="category" icon={category.icon} name={category.name} size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block font-semibold ${category.isActive ? 'text-admin-strong' : 'text-admin-muted'}`}>{category.name}</span>
                          <span className="block text-xs text-admin-muted">
                            {category.skills.length} {category.skills.length === 1 ? 'skill' : 'skills'} · order {category.sortOrder}
                            {!category.isActive && ' · hidden'}
                          </span>
                        </span>
                      </button>
                      <Switch checked={category.isActive} label={`${category.name} active`} disabled={busy}
                        onChange={(v) => run(() => setTechCategoryActive(category.id, v, user.uid), v ? 'Category shown.' : 'Category hidden.')} />
                      <MoveButtons index={index} count={categories.length} label={category.name} disabled={busy || filtering} onMove={moveCategory} />
                      <button type="button" className={smallButtonClass.secondary} onClick={() => setEditingCategory(category.id)} disabled={busy}>
                        <Icon as={FaPen} size={11} /> Edit
                      </button>
                      <button type="button" className={smallButtonClass.danger} aria-label={`Delete ${category.name}`} onClick={() => startRemoveCategory(category)} disabled={busy}>
                        <Icon as={FaTrash} size={11} />
                      </button>
                    </div>
                  )}

                  {open && !editingThis && (
                    <>
                      {category.shown.length === 0 && !filtering && (
                        <p className="border-t border-admin-subtle px-4 py-3 text-sm text-admin-muted">No skills in this category yet.</p>
                      )}
                      <ul id={`skills-${category.id}`} className={`max-h-64 overflow-y-auto overscroll-contain ${category.shown.length ? 'border-t border-admin-subtle' : ''}`}>
                        {category.shown.map((skill) => {
                          const i = category.skills.findIndex((s) => s.id === skill.id);
                          return skillForm?.skill?.id === skill.id ? (
                            <li key={skill.id}>
                              <SkillForm editingId={skill.id} categories={categories} onSave={saveSkill} onCancel={() => setSkillForm(null)} report={report}
                                initial={{ categoryId: skill.categoryId, name: skill.name, icon: skill.icon, logoDefault: logoInputValue(skill, 'default'), logoHover: logoInputValue(skill, 'hover'), sortOrder: skill.sortOrder, isActive: skill.isActive }} />
                            </li>
                          ) : (
                            <SkillRow key={skill.id} skill={skill} index={i} count={category.skills.length} filtering={filtering} busy={busy}
                              onToggle={(s, v) => run(() => setTechSkillActive(s.id, v, user.uid), v ? 'Skill shown.' : 'Skill hidden.')}
                              onMove={moveSkill(category)} onEdit={(s) => setSkillForm({ categoryId: s.categoryId, skill: s })} onDelete={removeSkill} />
                          );
                        })}
                      </ul>
                      {skillForm && !skillForm.skill && skillForm.categoryId === category.id ? (
                        <SkillForm categories={categories} onSave={saveSkill} onCancel={() => setSkillForm(null)} report={report}
                          initial={newSkillDefaults(category)} />
                      ) : (
                        <div className="border-t border-admin-subtle px-4 py-2">
                          <button type="button" className={smallButtonClass.primary} disabled={busy}
                            onClick={() => setSkillForm({ categoryId: category.id })}>
                            <Icon as={FaPlus} size={10} /> Add skill
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {confirmDialog}
      <ConfirmDialog
        open={Boolean(removing)}
        tone="danger"
        title={removing ? `Delete ${removing.name}?` : ''}
        description={removing ? `This category has ${removing.skills.length} skill${removing.skills.length === 1 ? '' : 's'}. Choose what happens to them.` : ''}
        confirmLabel="Move skills & delete category"
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={() => confirmRemoveCategory('move')}
        alternate={{ label: 'Delete category and skills', tone: 'danger', onClick: () => confirmRemoveCategory('delete') }}
      >
        {removing && (
          <Field id="move-to" label="Move skills to">
            <select id="move-to" className={selectClass} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {categories.filter((c) => c.id !== removing.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!moveTo && <p className="mt-1 text-xs text-admin-danger-text">No other category to move them to. Delete them or add a category first.</p>}
          </Field>
        )}
      </ConfirmDialog>
    </section>
  );
}
