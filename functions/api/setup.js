// GET  /api/setup — hỏi hệ thống đã có tài khoản nào chưa (để frontend quyết định
//                    hiện màn "Tạo tài khoản quản trị đầu tiên" hay "Đăng nhập").
// POST /api/setup — tạo tài khoản ĐẦU TIÊN. Chỉ chạy được đúng 1 lần, khi bảng
//                    users còn trống. Sau đó vĩnh viễn trả 403 — dùng /api/users
//                    (khi đã đăng nhập) để thêm người dùng tiếp theo.

import { hashPassword, generateSessionToken, sessionExpiry, cookieHeader, json } from './_lib/auth.js';

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  return json({ hasUsers: row.count > 0 });
}

export async function onRequestPost({ request, env }) {
  const row = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  if (row.count > 0) {
    return json({ error: 'Hệ thống đã có tài khoản. Liên hệ người quản trị để được cấp tài khoản mới.' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const { username, password, name } = body;
  if (!username || !password || password.length < 6) {
    return json({ error: 'Thiếu username hoặc mật khẩu phải từ 6 ký tự trở lên.' }, 400);
  }

  const { hash, salt } = await hashPassword(password);
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO users (username, password_hash, password_salt, name, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(username, hash, salt, name || username, now)
    .run();

  const user = await env.DB.prepare('SELECT id, username, name FROM users WHERE username = ?').bind(username).first();
  const token = generateSessionToken();
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, user.id, sessionExpiry())
    .run();

  return json({ user }, 200, { 'Set-Cookie': cookieHeader(token) });
}
