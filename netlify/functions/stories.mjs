// The private Story Bank. Auth-only. No public route reads this store, ever.
// Store: Blobs "stories" → one JSON document "list": { items: [story], nextId, version, matches: {questionN: {...}} }
import { requireAuth } from '../../lib/auth.mjs';
import { json, error, readJson } from '../../lib/http.mjs';
import { loadStories, saveStories } from '../../lib/stories-store.mjs';
import { FIELDS, PRIVACY, blankStory, needsDetail, missingCore, TERRITORIES } from '../../lib/story-model.mjs';

const nextId = (doc) => `S${String(doc.nextId++).padStart(3, '0')}`;
const EDITABLE = [...FIELDS.map((f) => f.key), 'kind', 'privacy', 'territories', 'relatedQuestions', 'possibleQuestions', 'newQuestions', 'followups', 'dismissed', 'sourceRef'];

function summary(doc) {
  const items = doc.items.filter((s) => !s.dismissed);
  return {
    total: items.length,
    needsDetail: items.filter(needsDetail).length,
    leads: items.filter((s) => s.kind === 'lead').length,
    unlinked: items.filter((s) => !(s.relatedQuestions || []).length).length,
    linked: items.filter((s) => (s.relatedQuestions || []).length).length,
    private: items.filter((s) => s.privacy === 'private').length,
    anonymise: items.filter((s) => s.privacy === 'anonymise').length,
    usable: items.filter((s) => s.privacy === 'usable').length,
    territories: Object.fromEntries(TERRITORIES.map((t) => [t.id, items.filter((s) => (s.territories || []).includes(t.id)).length])),
  };
}

export default requireAuth(async (req, context) => {
  const { id } = context.params || {};
  const doc = await loadStories();

  if (req.method === 'GET') {
    if (id) { const s = doc.items.find((x) => x.id === id); return s ? json(s) : error('Not found', 404); }
    return json({ items: doc.items, summary: summary(doc), matches: doc.matches, note: doc.note, fields: FIELDS, territories: TERRITORIES, privacy: PRIVACY });
  }

  if (req.method === 'POST' && !id) {
    const body = (await readJson(req)) || {};
    const s = blankStory({ id: nextId(doc) });
    for (const k of EDITABLE) if (k in body) s[k] = body[k];
    if (!PRIVACY.includes(s.privacy)) s.privacy = 'private';
    if (!s.title?.trim()) s.title = 'Untitled story';
    doc.items.push(s); await saveStories(doc);
    return json(s, 201);
  }

  if (req.method === 'PUT' && id) {
    const s = doc.items.find((x) => x.id === id);
    if (!s) return error('Not found', 404);
    const body = (await readJson(req)) || {};
    for (const k of EDITABLE) if (k in body) s[k] = body[k];
    if (!PRIVACY.includes(s.privacy)) s.privacy = 'private';
    if (Array.isArray(body.transcriptAppend)) s.transcript = [...(s.transcript || []), ...body.transcriptAppend];
    s.updatedAt = new Date().toISOString();
    await saveStories(doc);
    return json({ ...s, missing: missingCore(s) });
  }

  if (req.method === 'DELETE' && id) {
    doc.items = doc.items.filter((x) => x.id !== id); await saveStories(doc);
    return json({ ok: true });
  }
  return error('Method not allowed', 405);
});

export const config = { path: ['/api/stories', '/api/stories/:id'] };
