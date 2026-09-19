import { getSessionUser, json, unauthorized } from '../_lib/auth.js';

const VALID_STATUS = ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'DONE', 'ESCALATE'];

export async function onRequestPatch({ request, env, params }) {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();

  const id = params.id;
  const ticket = await env.DB.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
  if (!ticket) return json({ error: 'Không tìm thấy ticket.' }, 404);

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.confidence !== undefined) {
    const conf = body.confidence === null ? null : Math.max(0, Math.min(1, parseFloat(body.confidence)));
    await env.DB.prepare('UPDATE tickets SET confidence = ? WHERE id = ?').bind(conf, id).run();
  }

  if (body.status) {
    if (!VALID_STATUS.includes(body.status)) return json({ error: 'Trạng thái không hợp lệ.' }, 400);

    // RETURN: SUBMITTED -> IN_PROGRESS nghĩa là CEO trả ticket lại để sửa.
    const isReturn = body.status === 'IN_PROGRESS' && ticket.status === 'SUBMITTED';
    const returnCount = isReturn ? ticket.return_count + 1 : ticket.return_count;
    const action = isReturn ? 'RETURN' : body.status;
    const doneAt = body.status === 'DONE' ? now : ticket.done_at;

    await env.DB.prepare('UPDATE tickets SET status = ?, return_count = ?, done_at = ? WHERE id = ?')
      .bind(body.status, returnCount, doneAt, id)
      .run();

    await env.DB.prepare('INSERT INTO ticket_history (ticket_id, ts, action, note, actor) VALUES (?, ?, ?, ?, ?)')
      .bind(id, now, action, body.note || '', user.name)
      .run();
  }

  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();

  const id = params.id;
  await env.DB.prepare('DELETE FROM ticket_history WHERE ticket_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM tickets WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
