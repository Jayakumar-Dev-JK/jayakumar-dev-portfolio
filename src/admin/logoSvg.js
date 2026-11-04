import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BuiltInLogo, SKILL_ICONS } from '../components/techIcon';
import { parseLogoInput, slugify } from '../lib/validation';
import { deleteLogoFile, uploadLogo } from '../services/mediaService';

// Skill logo files (admin only: react-dom/server stays out of the public bundle).
// Built-in logos are shared files already in Cloudinary (src/data/techLogoAssets.json), so a
// skill only stores files for custom logos: PortFolio/tech-stack/default (rest) and
// PortFolio/tech-stack/hover (hover). Firestore keeps { url, publicId, source, iconKey } per
// custom version, or null when the built-in logo is used.

export const LOGO_VARIANTS = ['default', 'hover'];
const FIELD = { default: 'logoDefault', hover: 'logoHover' };

// Stand-alone SVG markup for a built-in logo; '' when the key has no built-in logo.
export function builtInLogoSvg(iconKey, variant) {
  if (!SKILL_ICONS[iconKey]) return '';
  return renderToStaticMarkup(
    <BuiltInLogo iconKey={iconKey} colored={variant === 'hover'} size={64} gradientId={`g-${iconKey}`} />
  ).replace(/ aria-hidden="true"| focusable="false"/g, '');
}

// Raw SVG code is sent as-is; the Netlify function adds the XML declaration and namespace
// Cloudinary needs, then uploads it (netlify/functions/cloudinary.js, action 'upload-svg').
const svgFile = (svg, name) => new File([svg], `${name}.svg`, { type: 'image/svg+xml' });

// What the form's logo box should show for an existing skill: only real custom logos.
export function logoInputValue(skill, variant) {
  const stored = skill[FIELD[variant]];
  if (stored) return stored.source === 'custom' ? stored.url : '';
  // Legacy fields (before cloud logos) are treated as the custom hover logo.
  if (variant === 'hover' && !SKILL_ICONS[skill.icon]) return skill.iconSvg || skill.iconUrl || '';
  return '';
}

// Works out the stored logo for one variant, uploading only when something changed.
// `text` is the form value ('' = use the built-in logo for `iconKey`).
async function resolveVariant(variant, text, iconKey, existing, baseName) {
  const value = (text || '').trim();
  // Empty: the built-in logo (shared cloud file) or the initials tile; nothing to upload.
  if (!value) return null;
  if (existing?.source === 'custom' && existing.url === value) return existing;
  const parsed = parseLogoInput(value);
  if (parsed.error) throw new Error(`${variant === 'hover' ? 'Hover' : 'Default'} logo: ${parsed.error}`);
  const source = parsed.iconSvg ? svgFile(parsed.iconSvg, `${baseName}-${variant}`) : parsed.iconUrl;
  const uploaded = await uploadLogo(source, variant);
  return { ...uploaded, source: 'custom', iconKey: '' };
}

// Uploads whatever is needed and returns { logoDefault, logoHover, replaced } where
// `replaced` lists Cloudinary files that are no longer used once the skill is saved.
export async function resolveSkillLogos({ name, icon, logoDefault, logoHover }, existingSkill = {}) {
  const baseName = slugify(name) || 'logo';
  const result = { replaced: [] };
  for (const variant of LOGO_VARIANTS) {
    const field = FIELD[variant];
    const before = existingSkill[field] || null;
    const after = await resolveVariant(variant, variant === 'hover' ? logoHover : logoDefault, icon, before, baseName);
    if (before?.publicId && before.publicId !== after?.publicId) result.replaced.push(before.publicId);
    result[field] = after;
  }
  return result;
}

// Skills with a custom logo from before cloud logos (stored inline in Firestore, not in
// Cloudinary). Built-in logos are always in the cloud already.
export function needsLogoSync(skill) {
  return !SKILL_ICONS[skill.icon] && Boolean(skill.iconSvg || skill.iconUrl) && !skill.logoHover;
}

// Logo update for one skill during a bulk sync: keeps custom files, fills in the rest.
export async function syncSkillLogos(skill) {
  const resolved = await resolveSkillLogos(
    { name: skill.name, icon: skill.icon, logoDefault: logoInputValue(skill, 'default'), logoHover: logoInputValue(skill, 'hover') },
    skill
  );
  return resolved;
}

// Best effort: a file left behind in Cloudinary is harmless, so failures are ignored.
export async function deleteLogoFiles(publicIds) {
  await Promise.all(publicIds.filter(Boolean).map((id) => deleteLogoFile(id).catch(() => {})));
}

export const skillLogoIds = (skill) => [skill.logoDefault?.publicId, skill.logoHover?.publicId].filter(Boolean);
