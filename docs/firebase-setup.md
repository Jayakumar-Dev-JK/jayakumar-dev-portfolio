# Project management module — Firebase setup

Firebase project: `portfolio-f3161` (Spark plan). The site stays a Create React App
build on Netlify. Firebase Authentication handles the admin login. Cloud Firestore
stores projects, categories, the audit trail and, later, analytics.

## 1. Environment variables

This is a Create React App project, so only variables named `REACT_APP_*` reach the
browser. `VITE_*` names are ignored.

| Variable | Value |
|---|---|
| `REACT_APP_FIREBASE_API_KEY` | Firebase Console → Project settings → Your apps → Web app → `apiKey` |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | `portfolio-f3161.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | `portfolio-f3161` |
| `REACT_APP_FIREBASE_APP_ID` | Same screen → `appId` |

- **Local:** copy `.env.example` to `.env.local` (git-ignored), fill it in, then
  restart `npm start`.
- **Netlify:** go to Site configuration → Environment variables, add the four
  variables above, then use **Trigger deploy → Clear cache and deploy site**. The
  values are baked in at build time.
- **What happens without them:** the public Projects section falls back to its
  built-in project list, and `/admin` shows "Admin unavailable".

These values are public by design. Never put a service-account key or any other
secret in a `REACT_APP_*` variable.

## 2. Authentication and the admin record

1. Authentication → Sign-in method: enable **Email/Password**.
2. Authentication → Users: create the admin user (already done).
3. Firestore → Data: create the document `admins/<UID>` with these fields:
   - `role` (string) = `admin`
   - `active` (boolean) = `true`

The current admin UID is `s0YgfCpNZfNnQJmh1OGX2bVkLdp2`. The rules deny all client
writes to `admins`, so this record can only be created in the console.

To revoke access, set `active` to `false`.

## 3. Security rules

The rules live in `firestore.rules` in the repo. Re-publish them whenever that file
changes.

**Option A, command line:** `firebase.json` and `.firebaserc` point at `portfolio-f3161`.

```
npx firebase-tools login          # once, opens a browser to sign in
npm run deploy:rules              # publishes firestore.rules
```

**Option B, console:**

1. Open Firestore → Rules.
2. Replace everything with the contents of `firestore.rules`.
3. Click **Publish**.

What the rules enforce:

- Everything is denied by default.
- Visitors can read projects with `status == "published"` and categories with
  `active == true`. Public queries must filter on those fields; rules are not
  filters.
- Only an active admin can create, update or delete projects and categories, and
  every write is validated:
  - field allowlist, types and lengths
  - slug format
  - https-only cover and primary URLs
  - server timestamps and `updatedBy`
  - new projects must start as drafts
  - publishing requires a short description, a category and a cover image
  - projects can only be deleted permanently after a soft delete
- `auditEvents` is append-only and limited to admins.
- `analyticsEvents` takes public, validated, append-only events for published
  projects. It isn't used by the UI yet.
- `admins` is readable only by its own user and can't be written by any client.

### Rules checks

**Verified against the live project on 2026-10-19.** The checks were anonymous
Firestore REST requests from a browser:

| Check | Expected | Result |
|---|---|---|
| Query projects where `status == "published"` | 200 | ✅ 200 |
| List all projects (no filter) | 403 | ✅ 403 |
| Query draft projects | 403 | ✅ 403 |
| Create a project | 403 | ✅ 403 |
| Read `admins/<uid>` | 403 | ✅ 403 |
| List all categories (no filter) | 403 | ✅ 403 |
| Query active categories | 200 | ✅ 200 |
| Read `auditEvents`, `analyticsEvents`, `media` | 403 | ✅ 403 |
| Read an unlisted collection | 403 | ✅ 403 |
| Analytics event for an unknown project | 403 | ✅ 403 |

**Still to check in the Rules Playground**, because these need a signed-in user:

| # | Simulated request | Expected |
|---|---|---|
| R4 | Signed in as a non-admin UID: `update` on `/projects/<id>` | Deny |
| R5 | Signed in as the admin UID: `get` on `/admins/<admin uid>` | Allow |
| R6 | Signed in as the admin UID: `update` on `/admins/<admin uid>` | Deny |
| R7 | Admin `delete` on a project whose `deletedAt` is null | Deny |

After deploying, also check the live behaviour:

- **Signed out:** `/admin` redirects to the login page.
- **Signed in as admin:** create a draft, then confirm it does **not** appear on
  the public site.
- **Publish:** the project appears on the public site.
- **Unpublish, archive or delete:** the project disappears from the public site.

## 4. Using the admin

- **Address:** open `https://<your-site>/admin` (or `http://localhost:3000/admin`).
  It isn't linked from the public site and is marked `noindex`.
- **First run:**
  1. On the Categories page, click **Add default categories**.
  2. On the Projects page, click **Import original projects**. This copies the 4
     hard-coded projects into Firestore as published Development projects.
- **Project lifecycle:**

  | Action | Result |
  |---|---|
  | Save draft | Not public |
  | Save & publish | Live on the portfolio |
  | Unpublish | Back to draft |
  | Archive | Hidden from the portfolio |
  | Restore | Back to draft |
  | Delete | Moved to the trash |
  | Delete permanently | Only available from the trash |

- **Audit trail:** every change writes an `auditEvents` record.

## 5. Cards, posts, video and analytics

Each project has a **"When the card is clicked"** setting in the editor:

| Setting | What visitors get |
|---|---|
| **Open link** (default) | The card opens the project's **primary link** in a new tab (live site, Figma, Behance…). With no link set, the card isn't clickable. |
| **Show post popup** | For posters, banners and similar work. The card shows the whole image (not cropped) with an image-count badge, and clicking opens an Instagram-style popup on the same page. |

Ticking the **Others** category switches a project to the popup automatically.

**The popup:**

- **Carousel:** arrows, dots, a "2 / 5" counter, arrow keys and swiping on phones.
- **Video:** shown as the first slide, if the project has one.
- **Details:** title, description, tags and links beside the image (below it on phones).
- **Closing:** the ✕ button, Esc, a click outside, or the browser's Back button.
- **Sharing:** every post gets a link like `https://<site>/#post=<slug>` that opens the popup directly.

**Post images:**

- Add them in the editor's **Post images** section: multi-upload, choose from the library, reorder, and add alt text to each.
- Portrait 4:5 (1080 × 1350 px) fits the popup best.
- A post with no cover image uses its first image on the card.
- At most 20 images per post.

**Slugs:** new projects get a short slug from the part of the title before " - ",
":" or "|" (for example "Deskmate - Tracking…" becomes `deskmate`). Existing slugs
don't change; edit the Slug field to shorten one.

**Video:** paste a YouTube or Vimeo link in the editor's **Video link** field, or
upload one. Only the provider and a validated video ID are stored, and the player
URL is rebuilt from them, so no other site can be embedded.

- **Analytics** (`analyticsEvents` collection, Admin → Analytics):

  | Metric | When it's counted |
  |---|---|
  | View | A post popup opens. At most once per post per browser session every 30 minutes. |
  | Outbound click | A visitor opens a project's link, from a card or from a popup. |

- **Not counted:**
  - Browsers that have signed in to `/admin` (a flag in localStorage marks them)
  - Automated browsers
  - Anything that happens on the destination site
- **Data:** no visitor IDs, IP addresses or cookies are stored, so unique visitors
  aren't reported.
- **Trust:** events are written from the browser and can be faked; the rules only
  accept events for published projects, with an exact field list.
- **Cost:** the analytics screen reads up to 5,000 raw events per load. The Spark
  plan allows 50,000 reads a day, which is plenty for a portfolio. Move to daily
  totals if traffic grows.

### Project pages, case studies and search

Every published project has its own page at `/projects/<slug>`:

- **Server-rendered tags.** The `project-page` Netlify function fills in the title, description,
  canonical link, social tags, structured data and text, so search engines and link previews
  don't depend on JavaScript. `sitemap.xml` is built live by the `sitemap` function. Publishing,
  unpublishing or editing a project needs no redeploy; the CDN refreshes a page within about 5 minutes.
- **Case-study fields** (all optional): role, year, the problem, process and outcome. They are
  shown on the page under their own headings.
- **Slug history.** Renaming a published project keeps its old slug in `previousSlugs`; the old
  address redirects (HTTP 301) to the new one, and the old slug can't be reused by another project.
- **Search panel.** The editor shows a Google-style preview and a checklist (advice only, never
  blocks saving), and the project list shows a "Search" badge. "Preview page" shows the page from
  the editor's current, unsaved values.

**Deploy the rules after this change.** The new fields are allowed by `firestore.rules`, so run
`npm run deploy:rules` (or paste the file into the Firebase console). Until then, saving still works
for any project that doesn't use the new fields, but a project with a role/year/case-study text, or
a renamed published project, is rejected by the old rules.

## 6. Uploads (Cloudinary, signed)

Files go to Cloudinary. Firestore keeps metadata only, in the `media` collection.
Uploads are signed by the Netlify Function `netlify/functions/cloudinary.js`, which
has no extra dependencies. For every request the function:

1. checks the caller's Firebase ID token (signature, project, expiry);
2. reads `admins/<uid>` through the Firestore REST API using the caller's own
   token, so the security rules decide who is an admin;
3. only then signs an upload, checks an uploaded file, or deletes one.

Files are re-checked after upload, and a file that's too large or the wrong type
is deleted at once.

| Type | Allowed |
|---|---|
| Images | JPG, PNG, WebP, AVIF or GIF, up to 10 MB (no SVG) |
| Videos | MP4, WebM or MOV, up to 100 MB |

Every upload goes into your existing **`PortFolio`** folder in Cloudinary, sorted by
type:

```
PortFolio/
├── images/    project covers, post/poster images, Media-library images
├── videos/    uploaded project videos
└── resumes/   resume PDFs
```

Cloudinary creates the subfolders automatically on the first upload of each type.
Folder names are case-sensitive, so `PortFolio` is not `portfolio`.

The function only verifies or deletes files that Cloudinary itself reports as
inside `PortFolio`, and refuses anything else. This works whether your Cloudinary
account uses fixed folders (the folder is part of the file's public ID) or the
newer dynamic folders (the folder is stored separately).

### Netlify environment variables (server-side only)

| Variable | Value |
|---|---|
| `CLOUDINARY_URL` | **Easiest:** one variable, `cloudinary://<api_key>:<api_secret>@<cloud_name>`, copied from Cloudinary → Settings → API Keys. It replaces the three variables below. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard → Product environment → Cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary → Settings → API Keys |
| `CLOUDINARY_API_SECRET` | Same screen. **Never** add a `REACT_APP_` prefix to this. |
| `CLOUDINARY_FOLDER` | Optional; defaults to `PortFolio`. Leave it unset to use `PortFolio`. |

The function reads the project ID from `REACT_APP_FIREBASE_PROJECT_ID`, which is
already set. Make sure all of these apply to Functions and to Deploy Previews.

Also re-publish `firestore.rules`: the `media` rules changed in this version.

### Using it

- **Project editor:** use **Upload image** / **Upload video** (with a progress
  bar), or **Choose from library**.
- **Admin → Media:** drag-and-drop uploads, a list of which projects use each
  file, alt text, copy URL, and delete.
- **Deleting:** blocked while any project still uses the file.
- **Replacing:** to replace a file, pick a new one in the project, then delete the
  old one from Media; it shows "Not used by any project" once it's free.

### Local development

`npm start` doesn't run Netlify Functions, so uploads only work on Netlify (deploy
previews included). To use them locally, run the site with the Netlify CLI
(`npx netlify-cli dev`) and put the Cloudinary variables in your Netlify site
settings or in `.env.local`.

### Tests

`npm run test:functions` checks the function. It covers:

- forged, expired and wrong-project tokens are rejected
- non-admins are refused
- the secret never appears in a response
- oversized uploads are deleted
- files outside `PortFolio/` are refused, in both folder modes

### Still pending

- **Admin pagination:** the admin list loads up to 500 projects.

## 6. Known limitations

- **Public field visibility:** Firestore returns whole documents. The public UI
  maps only the allowed fields, but anyone calling the Firestore API directly can
  read every field of a *published* project document, including `createdBy`,
  timestamps and the full description. Draft, archived and trashed projects stay
  unreadable. If that matters, a separate `publicProjects` collection can hold
  only public fields.
- **Slug uniqueness:** the admin UI checks it before saving, but the rules can't
  enforce it. That's fine with a single admin.
- **List size:** the admin list loads up to 500 projects and filters them in the
  browser. Cursor pagination isn't built yet.
- **Unsaved-change warning:** it covers closing or reloading the tab and the
  Cancel button. It doesn't cover the admin nav links.

## Tech Stack & Skills

Managed at `/admin/tech-stack` (categories and skills on one page). Data lives in `techCategories/{slug}` and `techSkills/{id}`; `techStackMeta/seed` records that the starter content was created.

- Re-publish the rules after pulling this change: `npm run deploy:rules`.
- The first time an admin opens `/admin/tech-stack` with no data, the starter categories (Development, AI Design, Tools) and skills are created once. Later visits never recreate or overwrite them, even if everything is deleted.
- Public reads only return `isActive == true` categories and skills; all writes require an active admin.
- Skills store an icon key (see `src/components/techIcon.jsx`) and an optional https logo URL, which is rendered in white.

## Resume

Manage it in **Admin → Resume**. The portfolio's **View Full Resume** link, under the
About section, opens the resume that is currently published. When none is
published, the link is hidden.

**What you can do:**

- Upload PDF versions, up to 10 MB each.
- Rename them.
- Preview them.
- Publish or unpublish one.
- Delete the ones that aren't published.

**Only one resume can be published.** The public site reads a single document,
`siteSettings/resume`, that points at the live resume. Publishing another resume
replaces that pointer. The security rules make sure the pointer names an existing
resume with the same file URL, and they refuse to delete the published resume. The
`resumes` collection itself is visible only to admins.

**Files:** PDFs are stored in Cloudinary as raw files under `PortFolio/resumes/`,
through the same signed Netlify Function as other uploads. After each upload the
function checks that the file name ends in `.pdf`, that it's 10 MB or smaller, and
that the file really starts with `%PDF-`. A file that fails any of these is
deleted.

**Cloudinary setting:** free Cloudinary accounts may block PDF delivery by default.
If an upload is rejected with "allow delivery of PDF files", go to Cloudinary →
**Settings → Security**, turn on **Allow delivery of PDF and ZIP files**, and upload
again.

**Rules:** re-publish `firestore.rules` after this update, because it adds the
`resumes` and `siteSettings/resume` rules.
- Skill logos have two versions, each a file in Cloudinary: `PortFolio/tech-stack/default` (white, at rest) and `PortFolio/tech-stack/hover` (original colours). Firestore stores `logoDefault` / `logoHover` = `{ url, publicId, source: 'builtin' | 'custom', iconKey }`. Empty custom fields use the built-in logo, which is generated as SVG and uploaded on save. "Upload logos to cloud storage" on the admin page uploads any skill that has no files yet. Uploads go through the Netlify function, so they work on Netlify or `netlify dev`, not plain `npm start`.
- Built-in logos are shared Cloudinary files (`PortFolio/tech-stack/default/default-<key>.svg` and `.../hover/hover-<key>.svg`), listed in `src/data/techLogoAssets.json`. After adding or changing a built-in logo in `src/components/techIcon.jsx`, run `npm run upload:logos` (needs `CLOUDINARY_URL` in `.env.local`); it overwrites the same files and rewrites the manifest. Add `--dry <folder>` to only write the SVGs locally.
