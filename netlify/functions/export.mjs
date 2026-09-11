// Export everything as JSON (posts + settings + inspo) or one post as Markdown with front matter.
// Use this when you fold /answers into the full site build.
import { requireAuth } from '../../lib/auth.mjs';
import { json, error, text } from '../../lib/http.mjs';
import { listPosts, getPost, getSettings, listTemplates } from '../../lib/store.mjs';
import { cleanBody } from '../../lib/markdown.mjs';

function frontMatter(p) {
  const fm = {
    title: p.title, slug: p.slug, status: p.status, date: p.publishedAt || p.createdAt, updated: p.updatedAt,
    description: p.metaDescription, tags: p.tags, cover: p.coverImage || undefined, coverAlt: p.coverAlt || undefined,
  };
  const lines = Object.entries(fm)
    .filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => (Array.isArray(v) ? `${k}: [${v.map((x) => JSON.stringify(x)).join(', ')}]` : `${k}: ${JSON.stringify(v)}`));
  return `---\n${lines.join('\n')}\n---\n\n${cleanBody(p.body)}\n`;
}

export default requireAuth(async (req, context) => {
  const { id } = context.params || {};
  if (id) {
    const p = await getPost(id);
    if (!p) return error('Not found', 404);
    return text(frontMatter(p), 200, {
      'content-disposition': `attachment; filename="${p.slug || 'post'}.md"`,
      'content-type': 'text/markdown; charset=utf-8',
    });
  }
  const [posts, settings, inspo] = await Promise.all([listPosts(), getSettings(), listTemplates()]);
  return json(
    { exportedAt: new Date().toISOString(), settings, posts: posts.map((p) => ({ ...p, markdown: frontMatter(p) })), inspo },
    200,
    { 'content-disposition': 'attachment; filename="answers-export.json"' },
  );
});

export const config = { path: ['/api/export', '/api/export/:id'] };
