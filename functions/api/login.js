import { verifyPassword, generateSessionToken, sessionExpiry, cookieHeader, json } from './_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) return json({ error: 'Thiếu tài khoản hoặc mật khẩu.' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user) return json({ error: 'Sai tài khoản hoặc mật khẩu.' }, 401);

  const ok = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!ok) return json({ error: 'Sai tài khoản hoặc mật khẩu.' }, 401);

  const token = generateSessionToken();
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, user.id, sessionExpiry())
    .run();

  return json(
    { user: { id: user.id, username: user.username, name: user.name } },
    200,
    { 'Set-Cookie': cookieHeader(token) }
  );
}
