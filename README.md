# Answers — a frictionless writing tool + GEO/AEO-optimised blog

One Netlify site, two faces:

| URL | What it is |
|---|---|
| `clairecoley.com/write` | Your private editor (password-protected). Write, proofread, optimise, publish. |
| `clairecoley.com/answers` | The public blog. Server-rendered, fast, with full schema.org markup, sitemap and RSS. |

Posts live in Netlify Blobs (built-in storage, no database to run). Publishing is instant — no rebuilds.
When you're ready for the full site build, `/api/export` hands you every post as Markdown + JSON.

---

## 1. Deploy (about 10 minutes)

### Option A — GitHub → Netlify (recommended; gives you version history)

1. Create a new GitHub repo and push this folder to it.
2. In Netlify: **Add new site → Import an existing project → GitHub → pick the repo.**
   Build settings are read from `netlify.toml` (publish directory `public`, functions in `netlify/functions`). No build command needed.
3. Add the environment variables (next section), then **Deploy**.

### Option B — Netlify CLI from your Mac

```bash
npm install -g netlify-cli
cd answers-cms
npm install
netlify login
netlify init          # create & link a new site
netlify env:set WRITE_PASSWORD "a-long-password"
netlify env:set SESSION_SECRET "$(openssl rand -hex 32)"
netlify env:set SITE_URL "https://clairecoley.com"
netlify env:set ANTHROPIC_API_KEY "sk-ant-..."
netlify env:set INDEXNOW_KEY "$(openssl rand -hex 16)"
netlify deploy --prod
```

### Environment variables

Set these in **Netlify → Site configuration → Environment variables** (or via the CLI as above).

| Variable | Required | What it does |
|---|---|---|
| `WRITE_PASSWORD` | yes | Password for `/write`. |
| `SESSION_SECRET` | yes | Random string that signs your login cookie. Any long random value. |
| `SITE_URL` | yes | `https://clairecoley.com` — used for canonical URLs, schema and sitemap. |
| `ANTHROPIC_API_KEY` | for suggestions | Enables the Subheads / FAQ / TL;DR / Meta / Titles / Editor's notes buttons. Get one at console.anthropic.com. Without it, all rules-based checks still work. |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-sonnet-4-5`. |
| `INDEXNOW_KEY` | recommended | Any 8–128 character alphanumeric string. Enables automatic IndexNow pings (Bing, DuckDuckGo, Yandex, Naver) on publish. The key file is served automatically at `/answers/indexnow-<key>.txt`. |
| `LANGUAGETOOL_URL` | no | Proofread uses LanguageTool's free public API by default. Set this if you self-host or subscribe to LanguageTool Premium. |

### Domain

In Netlify → **Domain management → Add a domain → clairecoley.com**, then follow the DNS instructions
(either move nameservers to Netlify DNS, or add an `A`/`ALIAS` record for the apex and a `CNAME` for `www`).
HTTPS is automatic. Once the domain is live, `/answers` and `/write` work at clairecoley.com.

The placeholder homepage is `public/index.html` — replace it with whatever you like, or with the full site later.

---

## 2. Writing — three steps

The editor is a three-step flow: **01 Write** (a blank page: title, body, and a References pull-out for passages and structures you've saved), **02 Edit** (your text on the left, untouched; on the right the score, suggestions you add or skip, proofread, the address, meta description and tags), **03 Publish** (the address, one button, then the off-page checklist). Drafts, References and Settings live in the left rail.


Open `/write`, enter your password.

- **New post** → type a title (ideally the question someone would ask) → write.
  Plain Markdown: `## Heading`, `**bold**`, `- list`, `[link](url)`. Nothing else to learn.
- **Spell check** is the browser's own (en-GB), so red underlines appear as you type. Grammarly and similar extensions also work in the editor.
- **Proofread** runs LanguageTool over the whole post and shows fixes you apply with one click.
- **Autosave** every 1.5 s, plus a local backup in the browser in case the connection drops. ⌘S saves immediately.
- **Preview** (⌘E) shows the rendered post. **Focus** (⌘.) hides everything but the page.
- **References** (the pull-out) holds two kinds of thing:
  - *Structures* — fill-in skeletons you insert into the editor. `{{placeholders}}` and `<!-- notes -->` are stripped on publish, so you can leave them lying around.
  - *Voice* — passages you admire, opened in a reading pane beside your draft. Never published.
  - **+ Add** pastes in anything from Claude or ChatGPT. **Copy prompt** puts a ready-made prompt on your clipboard that asks either of them for a new structure in the right format.

## 3. Optimising (GEO / AEO)

The **Optimise** tab scores the post live against answer-engine rules — answer-first opening, TL;DR block, question-phrased headings, FAQ section, sources, numbers, first-person experience, readability, metadata — and tells you exactly what to change.

Everything below is generated automatically on publish — you never touch it:

- `<title>`, meta description, canonical, robots, Open Graph and Twitter tags
- JSON-LD graph: `WebSite`, `Person` (author, with your bio and profile links from Settings), `BlogPosting` (with `speakable` pointing at the opening and TL;DR), `BreadcrumbList`, and `FAQPage` built from your `## FAQ` section
- `/answers/sitemap.xml`, `/answers/feed.xml`, `/answers/index.json`

**Suggestions** (needs `ANTHROPIC_API_KEY`) propose subheads, FAQ questions, TL;DR bullets, meta descriptions, title options and editor's notes. Each is an accept/reject card. Your prose is never rewritten — accepted items are inserted as new lines you can then edit.

The convention the optimiser looks for:

```markdown
Direct answer in the first paragraph, under ~60 words.

## TL;DR
- bullet
- bullet

## Question-style heading?
...

## FAQ
### Question one?
Answer.
### Question two?
Answer.
```

## 4. Publishing

**Publish** tab → **Publish**. The post is live at `/answers/<slug>` within seconds, IndexNow is pinged, and the **off-page checklist** appears: request indexing in Google Search Console, share on LinkedIn (pre-filled), answer the question where it's being asked, check what AI engines currently cite, and so on. Ticks are saved with the post.

Edits to a published post go live automatically (the CDN cache refreshes within ~5 minutes; "Update & re-ping" purges it immediately and re-pings IndexNow).

## 5. Moving to the full site later

- `GET /api/export` → JSON with every post (including a Markdown version with front matter), settings and Inspo.
- `GET /api/export/<id>` → one post as `.md` (also linked from the Details tab).
- `GET /answers/index.json` → public JSON index of published posts.

Keep the same URLs (`/answers/<slug>`) in the new build and nothing you've earned in search is lost.

---

## Local development

```bash
cp .env.example .env    # fill in values
npm install
npm run dev             # http://localhost:8888/write
```

Blobs run in a local sandbox under `.netlify/` — nothing touches production until you deploy.

## Project layout

```
netlify.toml                 Netlify config (publish dir, functions, /write redirect)
public/index.html            Placeholder homepage
public/write/                The editor (plain HTML/CSS/JS, no build step)
netlify/functions/auth.mjs   Login / logout / session
netlify/functions/posts.mjs  Posts CRUD, analyse, publish, unpublish
netlify/functions/inspo.mjs  Inspo library CRUD
netlify/functions/settings.mjs
netlify/functions/suggest.mjs   Claude suggestions (additive only)
netlify/functions/proofread.mjs LanguageTool proxy
netlify/functions/export.mjs    JSON / Markdown export
netlify/functions/blog.mjs      Public /answers pages, sitemap, feed, IndexNow key
lib/seo.mjs                  Checks, schema, head tags, off-page checklist, IndexNow
lib/markdown.mjs             Markdown analysis + rendering
lib/store.mjs                Netlify Blobs persistence
lib/default-templates.mjs    Seeded Inspo items
```
