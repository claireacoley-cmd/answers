// Small helpers for Netlify Functions (v2 API: Request in, Response out)

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

export function text(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...headers } });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function siteUrl() {
  return (process.env.SITE_URL || process.env.URL || 'http://localhost:8888').replace(/\/$/, '');
}

export function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
