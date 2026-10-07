// HPS demo – AI proxy (Cloudflare Worker). Giữ khóa API ở máy chủ, app trên điện thoại gọi qua đây.
// Biến môi trường (Settings → Variables):
//   ANTHROPIC_API_KEY  (Secret, bắt buộc)
//   ALLOWED_ORIGINS    mặc định https://nguyenhongphong1973-dot.github.io
//   MAX_PER_HOUR       số lượt / giờ / IP, mặc định 60
//   MODEL_QUICK        mặc định claude-haiku-4-5-20251001      (trợ lý hỏi đáp)
//   MODEL_DEFAULT      mặc định claude-sonnet-5-5     (đọc ảnh xe, tờ khai)
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || 'https://nguyenhongphong1973-dot.github.io').split(',').map(s => s.trim());
    const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Vary': 'Origin' };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method === 'GET') return json({ ok: true, service: 'hps-ai' });
    if (req.method !== 'POST' || !allowed.includes(origin)) return json({ error: 'forbidden' }, 403);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'missing_key' }, 500);

    const ip = req.headers.get('CF-Connecting-IP') || 'x', now = Date.now();
    const rl = (globalThis.__rl ||= new Map());
    const hits = (rl.get(ip) || []).filter(t => now - t < 3600e3);
    if (hits.length >= Number(env.MAX_PER_HOUR || 60)) return json({ error: 'rate_limited' }, 429);
    hits.push(now); rl.set(ip, hits);

    let body; try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
    if (!Array.isArray(body.messages) || !body.messages.length) return json({ error: 'bad_request' }, 400);
    if (JSON.stringify(body).length > 8e6) return json({ error: 'too_large' }, 413);

    const payload = {
      model: body.tier === 'quick' ? (env.MODEL_QUICK || 'claude-haiku-4-5-20251001') : (env.MODEL_DEFAULT || 'claude-sonnet-5-5'),
      max_tokens: Math.min(Number(body.max_tokens) || 1024, 2048),
      messages: body.messages,
    };
    if (Array.isArray(body.tools) && body.tools.length) payload.tools = body.tools.slice(0, 12);
    if (body.system) payload.system = String(body.system).slice(0, 40000);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return new Response(r.body, { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
  },
};
