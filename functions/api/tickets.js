import { getSessionUser, json, unauthorized } from './_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();

  const { results: tickets } = await env.DB.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all();
  const { results: history } = await env.DB.prepare('SELECT * FROM ticket_history ORDER BY ts ASC').all();

  const byTicket = {};
  for (const h of history) {
    (byTicket[h.ticket_id] ||= []).push({ ts: h.ts, action: h.action, note: h.note, actor: h.actor });
  }

  const out = tickets.map((t) => ({
    id: t.id,
    assignee: t.assignee,
    input: t.input,
    deliverable: t.deliverable,
    acceptCriteria: JSON.parse(t.accept_criteria),
    deadline: t.deadline,
    priority: t.priority,
    status: t.status,
    confidence: t.confidence,
    returnCount: t.return_count,
    createdAt: t.created_at,
    doneAt: t.done_at,
    createdBy: t.created_by,
    history: byTicket[t.id] || [],
  }));

  return json({ tickets: out });
}

export async function onRequestPost({ request, env }) {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const { assignee, input, deliverable, acceptCriteria, deadline, priority } = body;
  if (
    !assignee ||
    !input ||
    !deliverable ||
    !Array.isArray(acceptCriteria) ||
    acceptCriteria.length === 0 ||
    !deadline ||
    !priority
  ) {
    return json({ error: 'Thiếu trường bắt buộc.' }, 400);
  }

  const id = await nextTicketId(env);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO tickets
       (id, assignee, input, deliverable, accept_criteria, deadline, priority, status, confidence, return_count, created_at, done_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', NULL, 0, ?, NULL, ?)`
  )
    .bind(id, assignee, input, deliverable, JSON.stringify(acceptCriteria), deadline, priority, now, user.name)
    .run();

  await env.DB.prepare('INSERT INTO ticket_history (ticket_id, ts, action, note, actor) VALUES (?, ?, ?, ?, ?)')
    .bind(id, now, 'CREATE', `Giao cho ${assignee}`, user.name)
    .run();

  return json({ id }, 201);
}

async function nextTicketId(env) {
  const year = new Date().getFullYear();
  const prefix = `JOB-${year}-`;
  const { results } = await env.DB.prepare('SELECT id FROM tickets WHERE id LIKE ?')
    .bind(prefix + '%')
    .all();
  let max = 0;
  for (const r of results) {
    const n = parseInt(r.id.slice(prefix.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(4, '0');
}
