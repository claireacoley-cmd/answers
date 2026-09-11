// Grammar/spelling via LanguageTool's public API (proxied so it works from any origin).
// Free tier: ~20 requests/min, 20k characters per request. Your text is sent to languagetool.org.
import { requireAuth } from '../../lib/auth.mjs';
import { json, error, readJson } from '../../lib/http.mjs';

export default requireAuth(async (req) => {
  const body = (await readJson(req)) || {};
  const text = String(body.text || '').slice(0, 20000);
  if (!text.trim()) return error('Nothing to check');
  const params = new URLSearchParams({
    text,
    language: body.language || 'en-GB',
    enabledOnly: 'false',
    level: 'default',
  });
  const endpoint = process.env.LANGUAGETOOL_URL || 'https://api.languagetool.org/v2/check';
  const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: params });
  if (!res.ok) return error(`LanguageTool error ${res.status}`, 502);
  const data = await res.json();
  // Drop noisy rules for markdown (e.g. whitespace / markdown syntax)
  const matches = (data.matches || [])
    .filter((m) => !/WHITESPACE_RULE|CONSECUTIVE_SPACES|UNPAIRED_BRACKETS|OXFORD_SPELLING|MORFOLOGIK_RULE_EN_GB.*\bZ\b/.test(m.rule?.id || ''))
    .filter((m) => !/Oxford spelling/i.test(m.message || ''))
    .map((m) => {
      // LanguageTool wraps context in "..."; strip so the UI can add its own ellipsis
      const c = m.context || {};
      const lead = (c.text || '').match(/^\.{3}/) ? 3 : 0;
      const text = (c.text || '').replace(/^\.{3}/, '').replace(/\.{3}$/, '');
      return { ...m, context: { text, offset: (c.offset || 0) - lead, length: c.length } };
    });
  return json({ matches });
});

export const config = { path: '/api/proofread' };
