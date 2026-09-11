import { requireAuth } from '../../lib/auth.mjs';
import { json, error, readJson } from '../../lib/http.mjs';
import { getSettings, saveSettings } from '../../lib/store.mjs';

export default requireAuth(async (req) => {
  if (req.method === 'GET') return json(await getSettings());
  if (req.method === 'PUT') {
    const body = (await readJson(req)) || {};
    if (typeof body.sameAs === 'string') {
      body.sameAs = body.sameAs.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    }
    body.minWords = Number(body.minWords) || 500;
    const saved = await saveSettings(body);
    try {
      const { purgeCache } = await import('@netlify/functions');
      await purgeCache({ tags: ['answers'] });
    } catch {}
    return json(saved);
  }
  return error('Method not allowed', 405);
});

export const config = { path: '/api/settings' };
