// Background runner for the slow Story Bank jobs (patterns, ingest). Netlify runs "-background" functions for up to
// 15 minutes and answers 202 immediately; results are written to the stories document and polled by the app.
import { getStore } from '@netlify/blobs';
import { requireAuth } from '../../lib/auth.mjs';
import { json, error, readJson } from '../../lib/http.mjs';
import { loadStories, saveStories } from '../../lib/stories-store.mjs';
import { runIngest, runPatterns } from '../../lib/story-jobs.mjs';

export default requireAuth(async (req, context) => {
  const { action } = context.params || {};
  if (req.method !== 'POST' || !['patterns', 'ingest'].includes(action)) return error('Unknown job', 404);
  const body = (await readJson(req)) || {};
  const qdoc = (await getStore({ name: 'questions', consistency: 'strong' }).get('list', { type: 'json' })) || { items: [] };
  let doc = await loadStories();
  doc.jobs ||= {};
  doc.jobs[action] = { status: 'running', at: new Date().toISOString() };
  await saveStories(doc);
  try {
    const stories = doc.items.filter((s) => !s.dismissed);
    const result = action === 'patterns' ? await runPatterns({ body, stories, qdoc, doc }) : await runIngest({ body, stories, qdoc });
    doc = await loadStories(); doc.jobs ||= {};
    if (action === 'patterns') doc.patterns = result;
    doc.jobs[action] = { status: 'done', at: new Date().toISOString(), result };
  } catch (e) {
    doc = await loadStories(); doc.jobs ||= {};
    doc.jobs[action] = { status: 'error', at: new Date().toISOString(), error: e.message };
  }
  await saveStories(doc);
  return json({ ok: true });
});

export const config = { path: '/api/story-jobs/:action' };
