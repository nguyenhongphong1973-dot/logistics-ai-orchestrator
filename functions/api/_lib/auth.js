// Xác thực bằng session cookie lưu trong D1. Không dùng thư viện ngoài —
// chỉ dùng Web Crypto (PBKDF2) sẵn có trong runtime Cloudflare Workers.

const PBKDF2_ITERATIONS = 100000;
const SESSION_DAYS = 30;

function bufferToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function randomHex(byteLen) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLen));
  return bufferToHex(bytes.buffer);
}

async function pbkdf2(password, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufferToHex(bits);
}

export async function hashPassword(password) {
  const saltHex = randomHex(16);
  const hash = await pbkdf2(password, hexToBytes(saltHex));
  return { hash, salt: saltHex };
}

export async function verifyPassword(password, salt, hash) {
  const computed = await pbkdf2(password, hexToBytes(salt));
  return computed === hash;
}

export function generateSessionToken() {
  return randomHex(32);
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
}

export function cookieHeader(token) {
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearCookieHeader() {
  return `session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? match[1] : null;
}

export async function getSessionUser(request, env) {
  const token = getCookie(request, 'session');
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT users.id, users.username, users.name
     FROM sessions JOIN users ON sessions.user_id = users.id
     WHERE sessions.token = ? AND sessions.expires_at > ?`
  )
    .bind(token, new Date().toISOString())
    .first();
  return row || null;
}

export function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function unauthorized() {
  return json({ error: 'Chưa đăng nhập.' }, 401);
}
