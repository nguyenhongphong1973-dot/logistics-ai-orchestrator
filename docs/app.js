// Ticket board dùng chung nhiều người — dữ liệu lấy từ /api/* (Cloudflare D1),
// không còn localStorage. Cần đăng nhập để xem/thao tác.

const STATUS = {
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  DONE: 'DONE',
  ESCALATE: 'ESCALATE',
};

const STATUS_LABEL = {
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang làm',
  SUBMITTED: 'Chờ nghiệm thu',
  DONE: 'PASS — Hoàn thành',
  ESCALATE: 'ESCALATE — Chuyển người thật',
};

const COLUMNS = [STATUS.ASSIGNED, STATUS.IN_PROGRESS, STATUS.SUBMITTED, STATUS.DONE, STATUS.ESCALATE];
const PRIORITY_ORDER = { HIGH: 0, MED: 1, LOW: 2 };

let currentUser = null;
let tickets = [];

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    /* no body */
  }
  if (!res.ok) throw new Error((body && body.error) || `Lỗi ${res.status}`);
  return body;
}

// ---------- Auth ----------

async function boot() {
  const me = await api('/api/me');
  if (me.user) {
    currentUser = me.user;
    await enterApp();
    return;
  }
  const status = await api('/api/setup');
  showAuthScreen(status.hasUsers ? 'login' : 'setup');
}

function showAuthScreen(mode) {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('authTitle').textContent =
    mode === 'setup' ? 'Tạo tài khoản quản trị đầu tiên' : 'Đăng nhập';
  document.getElementById('authSubmit').textContent = mode === 'setup' ? 'Tạo tài khoản' : 'Đăng nhập';
  document.getElementById('authNameRow').style.display = mode === 'setup' ? 'flex' : 'none';
  document.getElementById('authForm').dataset.mode = mode;
  document.getElementById('authError').textContent = '';
}

function initAuthForm() {
  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = e.target.dataset.mode;
    const fd = new FormData(e.target);
    const payload = {
      username: fd.get('username').trim(),
      password: fd.get('password'),
      name: fd.get('name') ? fd.get('name').trim() : undefined,
    };
    const errEl = document.getElementById('authError');
    errEl.textContent = '';
    try {
      const endpoint = mode === 'setup' ? '/api/setup' : '/api/login';
      const result = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      currentUser = result.user;
      await enterApp();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}

async function enterApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';
  document.getElementById('currentUserName').textContent = currentUser.name;
  await loadTickets();
  render();
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  currentUser = null;
  tickets = [];
  location.reload();
}

// ---------- Data loading ----------

async function loadTickets() {
  const data = await api('/api/tickets');
  tickets = data.tickets;
}

function isLate(ticket) {
  if (!ticket.deadline) return false;
  if (ticket.status === STATUS.DONE || ticket.status === STATUS.ESCALATE) return false;
  return new Date(ticket.deadline).getTime() < Date.now();
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

// ---------- CRUD (qua API) ----------

async function createTicket(data) {
  await api('/api/tickets', { method: 'POST', body: JSON.stringify(data) });
  await loadTickets();
  render();
}

async function transition(id, newStatus, note) {
  await api(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus, note }) });
  await loadTickets();
  render();
}

async function setConfidence(id, value) {
  const confidence = value === '' ? null : Math.max(0, Math.min(1, parseFloat(value)));
  await api(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ confidence }) });
  await loadTickets();
  render();
}

async function deleteTicket(id) {
  if (!confirm('Xoá ticket ' + id + '? Không thể hoàn tác.')) return;
  await api(`/api/tickets/${id}`, { method: 'DELETE' });
  await loadTickets();
  render();
}

// ---------- Render: Ticket Board ----------

function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  const filterAgent = document.getElementById('filterAgent').value;
  const filterPriority = document.getElementById('filterPriority').value;

  let list = tickets.slice();
  if (filterAgent) list = list.filter((t) => t.assignee === filterAgent);
  if (filterPriority) list = list.filter((t) => t.priority === filterPriority);

  COLUMNS.forEach((status) => {
    const col = document.createElement('div');
    col.className = 'column';

    const colTickets = list
      .filter((t) => t.status === status)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    col.innerHTML = `<div class="column-head">
        <span>${STATUS_LABEL[status]}</span>
        <span class="count">${colTickets.length}</span>
      </div>`;

    const body = document.createElement('div');
    body.className = 'column-body';
    colTickets.forEach((t) => body.appendChild(renderCard(t)));
    col.appendChild(body);
    board.appendChild(col);
  });
}

function renderCard(t) {
  const card = document.createElement('div');
  card.className = 'card priority-' + t.priority.toLowerCase();
  if (isLate(t)) card.classList.add('late');

  const criteriaHtml = (t.acceptCriteria || []).map((c) => `<li>${escapeHtml(c)}</li>`).join('');

  let actions = '';
  if (t.status === STATUS.ASSIGNED) {
    actions = `<button data-act="start">Bắt đầu</button>`;
  } else if (t.status === STATUS.IN_PROGRESS) {
    actions = `<button data-act="submit">Nộp kết quả</button>`;
  } else if (t.status === STATUS.SUBMITTED) {
    const warnConfidence = t.confidence !== null && t.confidence < 0.7;
    actions = `
      <div class="confidence-row">
        <label>Độ tin cậy
          <input type="number" min="0" max="1" step="0.05" data-act="confidence" value="${t.confidence ?? ''}" placeholder="0.00–1.00">
        </label>
        ${warnConfidence ? '<span class="tag tag-warn">confidence &lt; 0.70 → nên ESCALATE</span>' : ''}
      </div>
      <div class="btn-row">
        <button class="btn-pass" data-act="pass">PASS</button>
        <button class="btn-return" data-act="return">RETURN</button>
        <button class="btn-escalate" data-act="escalate">ESCALATE</button>
      </div>`;
  }

  const returnBadge =
    t.returnCount > 0
      ? `<span class="tag tag-return">RETURN ×${t.returnCount}${t.returnCount >= 2 ? ' — nên ESCALATE' : ''}</span>`
      : '';

  card.innerHTML = `
    <div class="card-head">
      <strong>${t.id}</strong>
      <span class="tag tag-agent">${t.assignee}</span>
      <span class="tag tag-priority">${t.priority}</span>
      ${isLate(t) ? '<span class="tag tag-late">LATE</span>' : ''}
      ${returnBadge}
    </div>
    <div class="card-deliverable">${escapeHtml(t.deliverable)}</div>
    <div class="card-input"><b>Input:</b> ${escapeHtml(t.input)}</div>
    <ul class="card-criteria">${criteriaHtml}</ul>
    <div class="card-deadline">Deadline: ${fmtDate(t.deadline)}</div>
    <div class="card-actions">${actions}</div>
    <div class="card-meta">Tạo bởi ${escapeHtml(t.createdBy || '—')}</div>
    <div class="card-footer">
      <button class="link-btn" data-act="history">Lịch sử</button>
      <button class="link-btn danger" data-act="delete">Xoá</button>
    </div>
  `;

  card.querySelectorAll('[data-act]').forEach((el) => {
    const act = el.getAttribute('data-act');
    if (act === 'confidence') {
      el.addEventListener('change', (e) => setConfidence(t.id, e.target.value));
    } else {
      el.addEventListener('click', () => handleCardAction(t, act));
    }
  });

  return card;
}

function handleCardAction(t, act) {
  switch (act) {
    case 'start':
      transition(t.id, STATUS.IN_PROGRESS, 'Bắt đầu xử lý');
      break;
    case 'submit':
      transition(t.id, STATUS.SUBMITTED, 'Nộp kết quả chờ nghiệm thu');
      break;
    case 'pass':
      transition(t.id, STATUS.DONE, 'CEO-AI nghiệm thu: PASS');
      break;
    case 'return': {
      const note = prompt('Lý do RETURN (mô tả lỗi cần sửa):', '');
      if (note === null) return;
      transition(t.id, STATUS.IN_PROGRESS, note || 'RETURN');
      break;
    }
    case 'escalate': {
      const note = prompt('Lý do ESCALATE (chuyển người thật):', '');
      if (note === null) return;
      transition(t.id, STATUS.ESCALATE, note || 'ESCALATE');
      break;
    }
    case 'delete':
      deleteTicket(t.id);
      break;
    case 'history':
      showHistory(t);
      break;
  }
}

function showHistory(t) {
  const lines = (t.history || [])
    .map((h) => `${fmtDate(h.ts)} — ${h.action}${h.note ? ': ' + h.note : ''} (${h.actor || '—'})`)
    .join('\n');
  alert(`Lịch sử ${t.id}\n\n${lines || 'Chưa có sự kiện.'}`);
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s || '';
  return div.innerHTML;
}

// ---------- Render: KPI ----------

function renderKpi() {
  const kpiEl = document.getElementById('kpi');
  const doneTickets = tickets.filter((t) => t.status === STATUS.DONE);
  const escalated = tickets.filter((t) => t.status === STATUS.ESCALATE);
  const backlog = tickets.filter((t) => t.status !== STATUS.DONE && t.status !== STATUS.ESCALATE);
  const late = tickets.filter(isLate);

  const passFirstTry = doneTickets.filter((t) => t.returnCount === 0).length;
  const passFirstTryPct = doneTickets.length ? ((passFirstTry / doneTickets.length) * 100).toFixed(1) : '—';

  const avgHours = doneTickets.length
    ? (
        doneTickets.reduce((sum, t) => sum + (new Date(t.doneAt) - new Date(t.createdAt)), 0) /
        doneTickets.length /
        3600000
      ).toFixed(1)
    : '—';

  kpiEl.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-value">${tickets.length}</div><div class="kpi-label">Tổng ticket</div></div>
      <div class="kpi-card"><div class="kpi-value">${passFirstTryPct}${doneTickets.length ? '%' : ''}</div><div class="kpi-label">% PASS lần đầu</div></div>
      <div class="kpi-card"><div class="kpi-value">${avgHours}${doneTickets.length ? 'h' : ''}</div><div class="kpi-label">Thời gian xử lý TB</div></div>
      <div class="kpi-card kpi-danger"><div class="kpi-value">${escalated.length}</div><div class="kpi-label">Số ESCALATE</div></div>
      <div class="kpi-card kpi-warn"><div class="kpi-value">${backlog.length}</div><div class="kpi-label">Tồn đọng</div></div>
      <div class="kpi-card kpi-warn"><div class="kpi-value">${late.length}</div><div class="kpi-label">Đang LATE</div></div>
    </div>

    <h3>Theo agent</h3>
    <table class="kpi-table">
      <thead><tr><th>Agent</th><th>Tổng</th><th>Đang chạy</th><th>PASS</th><th>ESCALATE</th></tr></thead>
      <tbody>
        ${AGENTS.map((a) => {
          const own = tickets.filter((t) => t.assignee === a.id);
          const running = own.filter((t) => t.status !== STATUS.DONE && t.status !== STATUS.ESCALATE).length;
          const pass = own.filter((t) => t.status === STATUS.DONE).length;
          const esc = own.filter((t) => t.status === STATUS.ESCALATE).length;
          return `<tr><td>${a.id} — ${a.name}</td><td>${own.length}</td><td>${running}</td><td>${pass}</td><td>${esc}</td></tr>`;
        }).join('')}
      </tbody>
    </table>

    <h3>Danh sách LATE</h3>
    ${
      late.length
        ? `<table class="kpi-table"><thead><tr><th>ID</th><th>Agent</th><th>Deadline</th><th>Trạng thái</th></tr></thead><tbody>
            ${late.map((t) => `<tr><td>${t.id}</td><td>${t.assignee}</td><td>${fmtDate(t.deadline)}</td><td>${STATUS_LABEL[t.status]}</td></tr>`).join('')}
          </tbody></table>`
        : '<p class="muted">Không có ticket LATE.</p>'
    }
  `;
}

// ---------- Ticket form ----------

function populateAssigneeSelect() {
  const sel = document.getElementById('formAssignee');
  sel.innerHTML = AGENTS.map((a) => `<option value="${a.id}">${a.id} — ${a.name}</option>`).join('');
  const filterSel = document.getElementById('filterAgent');
  filterSel.innerHTML =
    '<option value="">Tất cả agent</option>' + AGENTS.map((a) => `<option value="${a.id}">${a.id}</option>`).join('');
}

function initForm() {
  const form = document.getElementById('ticketForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const acceptCriteria = fd
      .get('acceptCriteria')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await createTicket({
        assignee: fd.get('assignee'),
        input: fd.get('input'),
        deliverable: fd.get('deliverable'),
        acceptCriteria,
        deadline: fd.get('deadline'),
        priority: fd.get('priority'),
      });
      form.reset();
      document.getElementById('newTicketDialog').close();
    } catch (err) {
      alert('Lỗi tạo ticket: ' + err.message);
    }
  });
}

// ---------- Quản lý tài khoản ----------

function initUserForm() {
  const form = document.getElementById('userForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const errEl = document.getElementById('userFormError');
    errEl.textContent = '';
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: fd.get('username').trim(),
          password: fd.get('password'),
          name: fd.get('name').trim(),
        }),
      });
      form.reset();
      alert('Đã tạo tài khoản. Gửi username/mật khẩu cho đồng nghiệp để họ đăng nhập.');
      document.getElementById('userDialog').close();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}

// ---------- Agent prompt library ----------

function renderAgentLibrary() {
  const el = document.getElementById('agentLibrary');
  const all = [CEO_AGENT, ...AGENTS];
  el.innerHTML = all
    .map(
      (a) => `
    <div class="agent-block">
      <div class="agent-head">
        <h3>${a.id} — ${a.name}</h3>
        <button class="copy-btn" data-copy="${a.id}">Copy prompt</button>
      </div>
      <p class="muted">${a.short}</p>
      <pre id="prompt-${a.id}">${escapeHtml(a.prompt)}</pre>
    </div>`
    )
    .join('');

  el.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-copy');
      const text = (id === 'CEO' ? CEO_AGENT : AGENTS.find((a) => a.id === id)).prompt;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Đã copy!';
        setTimeout(() => (btn.textContent = 'Copy prompt'), 1200);
      });
    });
  });

  const riskEl = document.getElementById('riskPrinciples');
  riskEl.innerHTML = RISK_PRINCIPLES.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
}

// ---------- Tabs ----------

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

function render() {
  renderBoard();
  renderKpi();
}

function init() {
  populateAssigneeSelect();
  initForm();
  initUserForm();
  initAuthForm();
  initTabs();
  renderAgentLibrary();

  document.getElementById('btnNewTicket').addEventListener('click', () => {
    document.getElementById('newTicketDialog').showModal();
  });
  document.getElementById('btnCloseDialog').addEventListener('click', () => {
    document.getElementById('newTicketDialog').close();
  });
  document.getElementById('btnManageUsers').addEventListener('click', () => {
    document.getElementById('userDialog').showModal();
  });
  document.getElementById('btnCloseUserDialog').addEventListener('click', () => {
    document.getElementById('userDialog').close();
  });
  document.getElementById('btnLogout').addEventListener('click', logout);
  document.getElementById('filterAgent').addEventListener('change', renderBoard);
  document.getElementById('filterPriority').addEventListener('change', renderBoard);
  document.getElementById('btnRefresh').addEventListener('click', async () => {
    await loadTickets();
    render();
  });

  boot().catch((err) => {
    console.error(err);
    showAuthScreen('login');
  });
}

document.addEventListener('DOMContentLoaded', init);
