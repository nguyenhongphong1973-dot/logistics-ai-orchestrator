// HPS demo – cổng AI (Cloudflare Worker). Dán toàn bộ file này vào Worker "hps-ai".
// Settings → Variables and Secrets: thêm Secret ANTHROPIC_API_KEY = khoá sk-ant-... (bắt buộc).
// Đi qua AI Gateway "cic-survey" (gọi thẳng Anthropic từ Hải Phòng/HKG bị chặn 403).
const GW = 'https://gateway.ai.cloudflare.com/v1/6bf7a5a6e5ccc12ffee3f19fb48ad197/cic-survey/anthropic';
const ORIGINS = ['https://nguyenhongphong1973-dot.github.io'];
const MODELS = {
  quick: ['claude-haiku-4-5-20251001', 'claude-haiku-4-5'],
  default: ['claude-sonnet-5-5', 'claude-sonnet-4-5', 'claude-opus-4-8'],
};

export default {
  async fetch(request, env) {
  const origin = request.headers.get('Origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json' } });

  const until = env.HPS_AI_UNTIL || '2026-11-30';
  const expired = new Date() > new Date(until + 'T23:59:59+07:00');

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method === 'GET') return json({ ok: !expired && !!env.ANTHROPIC_API_KEY, service: 'hps-ai', until });
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (expired) return json({ error: 'expired' }, 403);
  if (!ORIGINS.includes(origin)) return json({ error: 'forbidden' }, 403);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'missing_key' }, 500);

  const ip = request.headers.get('CF-Connecting-IP') || 'x', now = Date.now();
  const rl = (globalThis.__hpsRl ||= new Map());
  const hits = (rl.get(ip) || []).filter((t) => now - t < 3600e3);
  if (hits.length >= Number(env.HPS_AI_MAX_PER_HOUR || 40)) return json({ error: 'rate_limited' }, 429);
  hits.push(now); rl.set(ip, hits);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  if (!Array.isArray(body.messages) || !body.messages.length) return json({ error: 'bad_request' }, 400);
  if (JSON.stringify(body).length > 8e6) return json({ error: 'too_large' }, 413);

  const base = {
    max_tokens: Math.min(Number(body.max_tokens) || 1024, 2048),
    messages: body.messages,
  };
  if (Array.isArray(body.tools) && body.tools.length) base.tools = body.tools.slice(0, 12);
  if (body.system) base.system = String(body.system).slice(0, 40000);

  const url = (env.AI_GATEWAY_URL || GW) + '/v1/messages';
  const list = MODELS[body.tier === 'quick' ? 'quick' : 'default'];
  let last;
  for (const model of list) {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'cf-aig-metadata': JSON.stringify({ app: 'hps-demo' }),
      },
      body: JSON.stringify({ ...base, model }),
    });
    // Tên model chưa có ở tài khoản này → thử model kế tiếp; lỗi khác trả về nguyên trạng.
    if (r.status === 404 || r.status === 400) {
      const t = await r.text();
      if (/model/i.test(t) && /not.?found|invalid|does not exist/i.test(t)) { last = { status: r.status, t }; continue; }
      return new Response(t, { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
    }
    return new Response(r.body, { status: r.status, headers: { ...cors, 'content-type': 'application/json' } });
  }
  return new Response(last ? last.t : JSON.stringify({ error: 'no_model' }), { status: last ? last.status : 500, headers: { ...cors, 'content-type': 'application/json' } });
}
};
