// Public blog: /answers, /answers/:slug, /answers/feed.xml, /answers/sitemap.xml, /answers/index.json
import { html, text, json, siteUrl, escapeHtml } from '../../lib/http.mjs';
import { listPublished, getPublishedBySlug, getSettings } from '../../lib/store.mjs';
import { render, analyse, excerpt } from '../../lib/markdown.mjs';
import { buildHead } from '../../lib/seo.mjs';

const cacheHeaders = (tags) => ({
  'cache-control': 'public, max-age=0, must-revalidate',
  'netlify-cdn-cache-control': 'public, s-maxage=60, stale-while-revalidate=600, durable',
  'netlify-cache-tag': tags.join(','),
});

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

function css(accent) {
  return `
:root{--accent:${accent};--ink:#1E1B18;--muted:rgba(30,27,24,.45);--rule:rgba(30,27,24,.14);--bg:#FFFFFF;--maxw:37rem}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 'Founders Grotesk','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
main{max-width:var(--maxw);margin:0 auto;padding:3rem 1.5rem 5rem}
.mono{font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}
header.site{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:1.5rem;border-bottom:1px solid var(--rule);margin-bottom:3rem}
header.site a{color:var(--ink);text-decoration:none}header.site .brand{font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-size:18px;letter-spacing:-.01em;font-weight:600}header.site .tag{color:var(--muted)}
h1{font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:2.8rem;line-height:1.08;letter-spacing:-.025em;margin:0 0 .75rem}
h2{font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-weight:600;font-size:1.5rem;letter-spacing:-.02em;line-height:1.25;margin:2.4rem 0 .6rem}h3{font-size:1.1rem;margin:1.6rem 0 .4rem}
.meta{color:var(--muted);font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;margin-bottom:2.5rem}
.post-intro{font-size:1.2rem}
.post-tldr{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:.5rem 0 1rem;margin:2rem 0}
.post-tldr h2{margin:.75rem 0 .25rem;font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:var(--muted)}
img{max-width:100%;height:auto}blockquote{margin:1.5rem 0;padding-left:1rem;border-left:1px solid var(--rule);color:var(--muted);font-style:italic}
pre{overflow-x:auto;border:1px solid var(--rule);padding:1rem;font-size:.85rem}code{font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-size:.85em}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto;font-size:.95rem}th,td{border-bottom:1px solid var(--rule);padding:.5rem .7rem;text-align:left}
ul.posts{list-style:none;padding:0;margin:0}ul.posts li{padding:1.5rem 0;border-bottom:1px solid var(--rule)}ul.posts a{font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-size:1.6rem;line-height:1.2;color:var(--ink);font-weight:600;letter-spacing:-.02em}ul.posts a:hover{color:var(--accent);text-decoration:none}
ul.posts p{margin:.5rem 0 .5rem;color:var(--muted)}ul.posts .meta{margin:0}
.author{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--rule);display:flex;gap:1rem;align-items:flex-start;font-size:.95rem}
.author img{width:48px;height:48px;border-radius:50%;object-fit:cover}.author .name{font-weight:700}.author .links a{margin-right:.75rem}
nav.more{margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--rule)}nav.more strong{font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;font-weight:400;color:var(--muted)}nav.more ul{list-style:none;padding:0;margin:.75rem 0 0}nav.more li{padding:.4rem 0}nav.more a{color:var(--ink)}
footer{max-width:var(--maxw);margin:0 auto;padding:1rem 1.5rem 3rem;color:var(--muted);font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600}
.tags a{font-family:'Founders Grotesk','Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:var(--muted);margin-right:1rem}
`;
}

function shell({ head, body, settings, site }) {
  return `<!doctype html>
<html lang="${settings.language || 'en-GB'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}
<link rel="stylesheet" href="${site}/fonts/fonts.css">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(settings.blogTitle)}" href="${site}/answers/feed.xml">
<style>${css(settings.accentColour || '#1f5f8b')}</style>
</head>
<body>
<main>
<header class="site">
  <a href="${site}/" class="brand">${escapeHtml(settings.siteName)}</a>
  <a href="${site}/answers" class="tag mono">${escapeHtml(settings.blogTitle)}</a>
</header>
${body}
</main>
<footer>${settings.footerText ? escapeHtml(settings.footerText) : `© ${new Date().getFullYear()} ${escapeHtml(settings.authorName)}`} · <a href="${site}/answers/feed.xml">RSS</a></footer>
</body>
</html>`;
}

function authorBox(settings) {
  if (!settings.authorBio && !(settings.sameAs || []).length) return '';
  return `<section class="author" itemscope itemtype="https://schema.org/Person">
  ${settings.authorImage ? `<img src="${escapeHtml(settings.authorImage)}" alt="${escapeHtml(settings.authorName)}">` : ''}
  <div><div class="name" itemprop="name">${escapeHtml(settings.authorName)}</div>
  ${settings.authorBio ? `<div itemprop="description">${escapeHtml(settings.authorBio)}</div>` : ''}
  ${(settings.sameAs || []).length ? `<div class="links">${settings.sameAs.map((u) => `<a href="${escapeHtml(u)}" rel="me">${escapeHtml(new URL(u).hostname.replace('www.', ''))}</a>`).join('')}</div>` : ''}
  </div></section>`;
}

/** Wrap the intro paragraph and TL;DR section so speakable/citation selectors resolve. */
function decorate(htmlBody) {
  let out = htmlBody.replace(/^\s*<p>/, '<p class="post-intro">');
  out = out.replace(/<h2[^>]*>(TL;?DR|Key takeaways?|In short|Summary)[^<]*<\/h2>([\s\S]*?)(?=<h2|$)/i, (m, h, rest) => `<section class="post-tldr"><h2>${h}</h2>${rest}</section>`);
  return out;
}

export default async (req, context) => {
  const site = siteUrl();
  const settings = await getSettings();
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, '');
  // Derive the slug from the path (not context.params) so /answers/x/index.html etc. can't fall through to the index.
  const segments = path.split('/').filter(Boolean); // ['answers', slug?]
  if (segments.length > 2) return text('Not found', 404);
  const slug = segments[1] ? decodeURIComponent(segments[1]) : undefined;

  // IndexNow key file
  const keyMatch = path.match(/\/answers\/indexnow-([a-zA-Z0-9-]{8,128})\.txt$/);
  if (keyMatch) {
    return keyMatch[1] === process.env.INDEXNOW_KEY ? text(keyMatch[1]) : text('Not found', 404);
  }

  if (path.endsWith('/feed.xml')) {
    const posts = await listPublished();
    const items = posts
      .map(
        (p) => `<item><title>${escapeHtml(p.title)}</title><link>${site}/answers/${p.slug}</link><guid>${site}/answers/${p.slug}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${escapeHtml(p.metaDescription || excerpt(p.body))}</description><content:encoded><![CDATA[${render(p.body)}]]></content:encoded></item>`,
      )
      .join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeHtml(settings.blogTitle)} — ${escapeHtml(settings.siteName)}</title><link>${site}/answers</link><atom:link href="${site}/answers/feed.xml" rel="self" type="application/rss+xml"/><description>${escapeHtml(settings.blogTagline)}</description><language>${(settings.language || 'en-GB').toLowerCase()}</language>${items}</channel></rss>`;
    return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', ...cacheHeaders(['answers']) } });
  }

  if (path.endsWith('/sitemap.xml')) {
    const posts = await listPublished();
    const urls = [`<url><loc>${site}/answers</loc>${posts[0] ? `<lastmod>${posts[0].updatedAt}</lastmod>` : ''}</url>`]
      .concat(posts.map((p) => `<url><loc>${site}/answers/${p.slug}</loc><lastmod>${p.updatedAt}</lastmod></url>`))
      .join('');
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
      headers: { 'content-type': 'application/xml; charset=utf-8', ...cacheHeaders(['answers']) },
    });
  }

  if (path.endsWith('/index.json')) {
    const posts = await listPublished();
    return json(
      posts.map((p) => ({ title: p.title, slug: p.slug, url: `${site}/answers/${p.slug}`, description: p.metaDescription || excerpt(p.body), publishedAt: p.publishedAt, updatedAt: p.updatedAt, tags: p.tags })),
      200,
      cacheHeaders(['answers']),
    );
  }

  // Single post
  if (slug) {
    const post = await getPublishedBySlug(slug);
    if (!post) return html(shell({ head: `<title>Not found</title><meta name="robots" content="noindex">`, body: `<h1>Not found</h1><p><a href="${site}/answers">Back to ${escapeHtml(settings.blogTitle)}</a></p>`, settings, site }), 404);
    const all = await listPublished();
    const others = all.filter((p) => p.id !== post.id).slice(0, 5);
    const a = analyse(post.body);
    const body = `<article itemscope itemtype="https://schema.org/BlogPosting">
<h1 itemprop="headline">${escapeHtml(post.title)}</h1>
<div class="meta"><span itemprop="author">${escapeHtml(settings.authorName)}</span> · <time itemprop="datePublished" datetime="${post.publishedAt}">${fmtDate(post.publishedAt)}</time>${post.updatedAt && post.updatedAt.slice(0, 10) !== (post.publishedAt || '').slice(0, 10) ? ` · Updated <time itemprop="dateModified" datetime="${post.updatedAt}">${fmtDate(post.updatedAt)}</time>` : ''} · ${Math.max(1, Math.round(a.words / 220))} min read</div>
${post.coverImage ? `<img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.coverAlt || '')}" itemprop="image">` : ''}
<div itemprop="articleBody">${decorate(render(post.body))}</div>
${(post.tags || []).length ? `<p class="tags">${post.tags.map((t) => `<a href="${site}/answers?tag=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join('')}</p>` : ''}
</article>
${authorBox(settings)}
${others.length ? `<nav class="more"><strong>More answers</strong><ul>${others.map((p) => `<li><a href="${site}/answers/${p.slug}">${escapeHtml(p.title)}</a></li>`).join('')}</ul></nav>` : ''}`;
    return html(shell({ head: buildHead(post, settings, site), body, settings, site }), 200, cacheHeaders(['answers', `post-${post.id}`]));
  }

  // Index
  const tag = url.searchParams.get('tag');
  let posts = await listPublished();
  if (tag) posts = posts.filter((p) => (p.tags || []).includes(tag));
  const head = `<title>${escapeHtml(settings.blogTitle)} — ${escapeHtml(settings.siteName)}</title>
<meta name="description" content="${escapeHtml(settings.blogTagline)}">
<link rel="canonical" href="${site}/answers">
<meta property="og:title" content="${escapeHtml(settings.blogTitle)} — ${escapeHtml(settings.siteName)}">
<meta property="og:description" content="${escapeHtml(settings.blogTagline)}">
<meta property="og:url" content="${site}/answers">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${site}/answers#blog`,
    url: `${site}/answers`,
    name: settings.blogTitle,
    description: settings.blogTagline,
    author: { '@type': 'Person', name: settings.authorName, url: settings.authorUrl || site, ...(settings.sameAs?.length ? { sameAs: settings.sameAs } : {}) },
    blogPost: posts.slice(0, 20).map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${site}/answers/${p.slug}`, datePublished: p.publishedAt })),
  })}</script>`;
  const body = `<h1>${escapeHtml(settings.blogTitle)}${tag ? ` <span class="tag">· ${escapeHtml(tag)}</span>` : ''}</h1>
<p class="meta">${escapeHtml(settings.blogTagline)}</p>
${posts.length ? `<ul class="posts">${posts.map((p) => `<li><a href="${site}/answers/${p.slug}">${escapeHtml(p.title)}</a><p>${escapeHtml(p.metaDescription || excerpt(p.body))}</p><div class="meta">${fmtDate(p.publishedAt)}</div></li>`).join('')}</ul>` : `<p>Nothing published yet.</p>`}
${authorBox(settings)}`;
  return html(shell({ head, body, settings, site }), 200, cacheHeaders(['answers']));
};

export const config = { path: ['/answers', '/answers/:slug'] };
