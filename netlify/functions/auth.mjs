import { checkPassword, makeSessionCookie, clearSessionCookie, isAuthed } from '../../lib/auth.mjs';
import { json, readJson, error } from '../../lib/http.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, '');

  if (path.endsWith('/login') && req.method === 'POST') {
    const body = await readJson(req);
    if (!checkPassword(body?.password)) {
      await new Promise((r) => setTimeout(r, 600)); // slow brute force
      return error('Wrong password', 401);
    }
    return json({ ok: true }, 200, { 'set-cookie': makeSessionCookie() });
  }

  if (path.endsWith('/logout')) {
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
  }

  if (path.endsWith('/me')) {
    return json({
      authed: isAuthed(req),
      hasAi: Boolean(process.env.ANTHROPIC_API_KEY),
      hasIndexNow: Boolean(process.env.INDEXNOW_KEY),
      siteUrl: process.env.SITE_URL || process.env.URL || '',
    });
  }

  return error('Not found', 404);
};

export const config = { path: ['/api/login', '/api/logout', '/api/me'] };
