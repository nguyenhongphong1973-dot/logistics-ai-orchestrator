import { getCookie, clearCookieHeader, json } from './_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, 'session');
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookieHeader() });
}
