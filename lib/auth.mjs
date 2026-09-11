// Password login with a signed, expiring cookie. One user (you).
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const COOKIE = 'cc_write_session';
const TTL_DAYS = 30;

function secret() {
  return process.env.SESSION_SECRET || 'dev-only-secret-change-me';
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function checkPassword(candidate) {
  const expected = process.env.WRITE_PASSWORD || 'password';
  const a = Buffer.from(String(candidate || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function makeSessionCookie() {
  const exp = Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000;
  const nonce = randomBytes(8).toString('hex');
  const payload = `${exp}.${nonce}`;
  const token = `${payload}.${sign(payload)}`;
  const secure = (process.env.SITE_URL || process.env.URL || '').startsWith('https') ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_DAYS * 86400}${secure}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isAuthed(req) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const parts = m[1].split('.');
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(`${exp}.${nonce}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Wrap a handler so it requires login. */
export function requireAuth(handler) {
  return async (req, context) => {
    if (!isAuthed(req)) {
      return new Response(JSON.stringify({ error: 'Not logged in' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    return handler(req, context);
  };
}
