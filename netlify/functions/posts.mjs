import { requireAuth } from '../../lib/auth.mjs';
import { json, error, readJson, siteUrl } from '../../lib/http.mjs';
import {
  listPosts, getPost, savePost, deletePost, blankPost, slugExists, getSettings,
} from '../../lib/store.mjs';
import { runChecks, buildHead, buildSchema, offpageChecklist, pingIndexNow, slugify, excerpt } from '../../lib/seo.mjs';
import { render } from '../../lib/markdown.mjs';

async function purge(tags) {
  try {
    const { purgeCache } = await import('@netlify/functions');
    await purgeCache({ tags });
  } catch {
    /* local dev or no purge token: fine, the CDN TTL is short anyway */
  }
}

const EDITABLE = ['title', 'slug', 'body', 'metaDescription', 'tags', 'coverImage', 'coverAlt', 'canonical', 'offpage', 'evidence'];

async function uniqueSlug(base, id) {
  let slug = base || 'untitled';
  let n = 2;
  while (await slugExists(slug, id)) slug = `${base}-${n++}`;
  return slug;
}

export default requireAuth(async (req, context) => {
  const { id, action } = context.params || {};
  const site = siteUrl();

  // Collection
  if (!id) {
    if (req.method === 'GET') {
      const all = await listPosts();
      return json(
        all.map((p) => ({
          id: p.id, title: p.title, slug: p.slug, status: p.status, updatedAt: p.updatedAt,
          publishedAt: p.publishedAt, words: (p.body || '').split(/\s+/).filter(Boolean).length, tags: p.tags,
        })),
      );
    }
    if (req.method === 'POST') {
      const body = (await readJson(req)) || {};
      const post = blankPost();
      for (const k of EDITABLE) if (k in body) post[k] = body[k];
      if (post.title && !post.slug) post.slug = await uniqueSlug(slugify(post.title), post.id);
      await savePost(post);
      return json(post, 201);
    }
    return error('Method not allowed', 405);
  }

  const post = await getPost(id);
  if (!post) return error('Post not found', 404);

  // Sub-actions
  if (action === 'analyse') {
    const settings = await getSettings();
    const all = await listPosts();
    const body = (await readJson(req)) || {};
    const candidate = { ...post, ...body };
    const result = runChecks(candidate, settings, all);
    const withSlug = { ...candidate, slug: candidate.slug || slugify(candidate.title) };
    return json({
      ...result,
      head: buildHead(withSlug, settings, site),
      schema: buildSchema(withSlug, settings, site),
      offpage: offpageChecklist(withSlug, settings, site, { hasIndexNow: Boolean(process.env.INDEXNOW_KEY) }),
      suggestedMeta: excerpt(candidate.body),
      suggestedSlug: slugify(candidate.title),
    });
  }

  if (action === 'preview') {
    const settings = await getSettings();
    return json({ html: render(post.body), settings });
  }

  if (action === 'publish' && req.method === 'POST') {
    if (!post.title.trim()) return error('Add a title before publishing');
    if (!post.body.trim()) return error('Post is empty');
    post.slug = await uniqueSlug(post.slug || slugify(post.title), post.id);
    if (!post.metaDescription) post.metaDescription = excerpt(post.body);
    const wasPublished = post.status === 'published';
    post.status = 'published';
    if (!post.publishedAt) post.publishedAt = new Date().toISOString();
    const url = `${site}/answers/${post.slug}`;
    const ping = await pingIndexNow([url, `${site}/answers`], site);
    if (ping.ok) post.offpage = { ...(post.offpage || {}), indexnow: true };
    await savePost(post);
    await purge(['answers', `post-${post.id}`]);
    return json({ post, url, indexnow: ping, republished: wasPublished });
  }

  if (action === 'unpublish' && req.method === 'POST') {
    post.status = 'draft';
    await savePost(post);
    await purge(['answers', `post-${post.id}`]);
    return json({ post });
  }

  if (action) return error('Unknown action', 404);

  // Single post
  if (req.method === 'GET') return json(post);

  if (req.method === 'PUT') {
    const body = (await readJson(req)) || {};
    for (const k of EDITABLE) if (k in body) post[k] = body[k];
    if (post.slug) post.slug = slugify(post.slug);
    if (!post.slug && post.title) post.slug = await uniqueSlug(slugify(post.title), post.id);
    await savePost(post);
    if (post.status === 'published') await purge(['answers', `post-${post.id}`]);
    return json(post);
  }

  if (req.method === 'DELETE') {
    await deletePost(id);
    await purge(['answers', `post-${post.id}`]);
    return json({ ok: true });
  }

  return error('Method not allowed', 405);
});

export const config = { path: ['/api/posts', '/api/posts/:id', '/api/posts/:id/:action'] };
