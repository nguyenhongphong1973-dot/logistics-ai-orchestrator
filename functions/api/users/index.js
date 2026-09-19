// Danh sách và tạo tài khoản mới. Nội bộ, không phân quyền admin/member —
// ai đã đăng nhập cũng tạo được tài khoản cho đồng nghiệp (đúng quy mô 1 công ty
// dùng chung, không phải hệ thống bán đa khách hàng).

import { getSessionUser, hashPassword, json, unauthorized } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();
  const { results } = await env.DB.prepare('SELECT id, username, name, created_at FROM users ORDER BY id').all();
  return json({ users: results });
}

export async function onRequestPost({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { username, password, name } = body;
  if (!username || !password || password.length < 6) {
    return json({ error: 'Thiếu username hoặc mật khẩu phải từ 6 ký tự trở lên.' }, 400);
  }

  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exists) return json({ error: 'Username đã tồn tại.' }, 409);

  const { hash, salt } = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO users (username, password_hash, password_salt, name, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(username, hash, salt, name || username, new Date().toISOString())
    .run();

  return json({ ok: true }, 201);
}
