// The running list of questions. One JSON document in Blobs; seeded from lib/questions-seed.mjs on first run.
// Each item: { n, section, sub, text, done, postId, tier: 'mvp'|'bank', order? (mvp priority) }
import { getStore } from '@netlify/blobs';
import { requireAuth } from '../../lib/auth.mjs';
import { json, error, readJson } from '../../lib/http.mjs';
import { QUESTIONS_SEED, QUESTIONS_GOAL, QUESTIONS_VERSION, PUBLISHED_MAP } from '../../lib/questions-seed.mjs';
import { listPublished } from '../../lib/store.mjs';

const store = () => getStore({ name: 'questions', consistency: 'strong' });
const norm = (s) => (s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 3));
function similarity(a, b) {
  const A = words(a), B = words(b); if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}
const fresh = () => ({ version: QUESTIONS_VERSION, items: QUESTIONS_SEED.map((s) => ({ ...s })), goal: QUESTIONS_GOAL });

// Rebuild the list from the current seed, carrying over ticks, post links and user-added questions.
function migrate(old) {
  const doc = fresh();
  const oldItems = old.items || [];
  const used = new Set();
  for (const it of doc.items) {
    let match = oldItems.find((o, i) => !used.has(i) && norm(o.text) === norm(it.text));
    if (!match) {
      let best = null, bestScore = 0.6;
      oldItems.forEach((o, i) => { if (used.has(i) || !(o.done || o.postId)) return; const s = similarity(o.text, it.text); if (s > bestScore) { best = o; bestScore = s; } });
      match = best;
    }
    if (match) { used.add(oldItems.indexOf(match)); if (match.done) it.done = true; if (match.postId) it.postId = match.postId; }
  }
  // questions Claire added herself (not from any seed) survive as "Added"
  let n = doc.items.length;
  oldItems.forEach((o, i) => { if (used.has(i)) return; if (o.section === 'Added' || o.custom) doc.items.push({ ...o, n: ++n, tier: 'bank', section: 'Added', sub: '' }); });
  return doc;
}

// Tick questions that have a published post, even when the post title drifted from the question.
// Explicit slug map first; then a conservative word-overlap match on title vs question.
const STOP = new Set(['what','when','how','does','do','the','a','an','of','to','in','is','it','its','and','or','that','than','should','company','companys','business','you','your','be','can','with','for','who','which','their','them','they','are','vs','rather']);
const keywords = (t) => new Set(norm(t).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
function kwSim(a, b) { const A = keywords(a), B = keywords(b); if (!A.size || !B.size) return 0; let i = 0; for (const w of A) if (B.has(w)) i++; return i / Math.min(A.size, B.size); }
export async function syncPublished(doc) {
  let changed = 0;
  let posts = [];
  try { posts = await listPublished(); } catch { return 0; }
  const linked = new Set(doc.items.map((q) => q.postId).filter(Boolean));
  for (const post of posts) {
    if (linked.has(post.id)) { const q = doc.items.find((x) => x.postId === post.id); if (q && !q.done) { q.done = true; changed++; } continue; }
    let q = PUBLISHED_MAP[post.slug] ? doc.items.find((x) => x.n === PUBLISHED_MAP[post.slug]) : null;
    if (!q) { let best = null, bs = 0.75; for (const x of doc.items) { if (x.postId) continue; const sc = Math.max(kwSim(x.text, post.title || ''), kwSim(x.text, (post.slug || '').replace(/-/g, ' '))); if (sc > bs) { best = x; bs = sc; } } q = best; }
    if (q && !q.postId) { q.postId = post.id; q.done = true; linked.add(post.id); changed++; }
  }
  return changed;
}

async function load() {
  let doc = await store().get('list', { type: 'json' });
  if (!doc) { doc = fresh(); await store().setJSON('list', doc); return doc; }
  if ((doc.version || 1) < QUESTIONS_VERSION) {
    await store().setJSON(`backup-v${doc.version || 1}`, doc); // keep the old list, just in case
    doc = migrate(doc); await syncPublished(doc); await store().setJSON('list', doc); return doc;
  }
  // merge in any seed questions added since the list was created (never overwrites edits or ticks)
  const have = new Map(doc.items.map((i) => [i.n, i]));
  let changed = false;
  for (const seed of QUESTIONS_SEED) {
    if (!have.has(seed.n)) { doc.items.push({ ...seed }); changed = true; }
  }
  doc.items.sort((a, b) => a.n - b.n);
  if (changed) await store().setJSON('list', doc);
  return doc;
}
const save = (doc) => store().setJSON('list', doc);

export default requireAuth(async (req, context) => {
  const { n } = context.params || {};
  const doc = await load();

  if (req.method === 'GET') return json(doc);

  if (req.method === 'POST' && n === 'sync') {
    const changed = await syncPublished(doc);
    if (changed) await save(doc);
    return json({ changed, ...doc });
  }

  if (req.method === 'POST' && n === 'reorder') {
    // body: { ns: [n, n, ...] } — the MVP list in the wanted order; everything listed becomes MVP
    const body = (await readJson(req)) || {};
    if (!Array.isArray(body.ns)) return error('ns required');
    let order = 0;
    for (const num of body.ns) { const it = doc.items.find((i) => i.n === Number(num)); if (it) { it.tier = 'mvp'; it.order = ++order; } }
    for (const it of doc.items) if (it.tier === 'mvp' && !body.ns.includes(it.n)) { it.tier = 'bank'; delete it.order; }
    await save(doc);
    return json(doc);
  }

  if (req.method === 'POST') {
    const body = (await readJson(req)) || {};
    if (!body.text?.trim()) return error('Question text is required');
    const max = doc.items.reduce((m, i) => Math.max(m, i.n), 0);
    const item = { n: max + 1, section: body.section || 'Added', sub: body.sub || '', text: body.text.trim(), done: false, postId: null, tier: 'bank', custom: true };
    doc.items.push(item); await save(doc);
    return json(item, 201);
  }

  if (req.method === 'PUT' && n) {
    const item = doc.items.find((i) => i.n === Number(n));
    if (!item) return error('Not found', 404);
    const body = (await readJson(req)) || {};
    for (const k of ['done', 'postId', 'text', 'section']) if (k in body) item[k] = body[k];
    if ('tier' in body) {
      if (body.tier === 'mvp' && item.tier !== 'mvp') { item.tier = 'mvp'; item.order = doc.items.filter((i) => i.tier === 'mvp').reduce((m, i) => Math.max(m, i.order || 0), 0) + 1; }
      if (body.tier === 'bank') { item.tier = 'bank'; delete item.order; }
    }
    await save(doc);
    return json(item);
  }

  if (req.method === 'DELETE' && n) {
    doc.items = doc.items.filter((i) => i.n !== Number(n)); await save(doc);
    return json({ ok: true });
  }
  return error('Method not allowed', 405);
});

export const config = { path: ['/api/questions', '/api/questions/:n'] };
