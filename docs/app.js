// Ticket board cho hệ thống CEO-AI + 9 agent. Lưu toàn bộ trong localStorage
// của trình duyệt — không cần server, không cần build. Dùng nút Xuất/Nhập
// JSON để sao lưu hoặc chuyển dữ liệu sang máy khác.

const STORAGE_KEY = 'logistics_ai_tickets_v1';

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

function loadTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Không đọc được dữ liệu ticket', e);
    return [];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

let tickets = loadTickets();

function nextTicketId() {
  const year = new Date().getFullYear();
  const prefix = `JOB-${year}-`;
  const nums = tickets
    .map((t) => t.id)
    .filter((id) => id.startsWith(prefix))
    .map((id) => parseInt(id.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefix + String(next).padStart(4, '0');
}

function isLate(ticket) {
  if (!ticket.deadline) return false;
  if (ticket.status === STATUS.DONE || ticket.status === STATUS.ESCALATE) return false;
  return new Date(ticket.deadline).getTime() < Date.now();
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function addHistory(ticket, action, note) {
  ticket.history = ticket.history || [];
  ticket.history.push({ ts: new Date().toISOString(), action, note: note || '' });
}

// ---------- CRUD ----------

function createTicket(data) {
  const now = new Date().toISOString();
  const ticket = {
    id: nextTicketId(),
    assignee: data.assignee,
    input: data.input,
    deliverable: data.deliverable,
    acceptCriteria: data.acceptCriteria,
    deadline: data.deadline,
    priority: data.priority,
    status: STATUS.ASSIGNED,
    confidence: null,
    note: '',
    returnCount: 0,
    createdAt: now,
    doneAt: null,
    history: [],
  };
  addHistory(ticket, 'CREATE', `Giao cho ${ticket.assignee}`);
  tickets.unshift(ticket);
  saveTickets(tickets);
  render();
}

function findTicket(id) {
  return tickets.find((t) => t.id === id);
}

function transition(id, newStatus, note) {
  const ticket = findTicket(id);
  if (!ticket) return;
  if (newStatus === STATUS.IN_PROGRESS && ticket.status === STATUS.SUBMITTED) {
    // RETURN: trả lại để sửa
    ticket.returnCount += 1;
    addHistory(ticket, 'RETURN', note);
  } else {
    addHistory(ticket, newStatus, note);
  }
  ticket.status = newStatus;
  if (newStatus === STATUS.DONE) {
    ticket.doneAt = new Date().toISOString();
  }
  saveTickets(tickets);
  render();
}

function setConfidence(id, value) {
  const ticket = findTicket(id);
  if (!ticket) return;
  ticket.confidence = value === '' ? null : Math.max(0, Math.min(1, parseFloat(value)));
  saveTickets(tickets);
  render();
}

function deleteTicket(id) {
  if (!confirm('Xoá ticket ' + id + '? Không thể hoàn tác.')) return;
  tickets = tickets.filter((t) => t.id !== id);
  saveTickets(tickets);
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

  const criteriaHtml = (t.acceptCriteria || [])
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join('');

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

  const returnBadge = t.returnCount > 0
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
    .map((h) => `${fmtDate(h.ts)} — ${h.action}${h.note ? ': ' + h.note : ''}`)
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
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const acceptCriteria = fd
      .get('acceptCriteria')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    createTicket({
      assignee: fd.get('assignee'),
      input: fd.get('input'),
      deliverable: fd.get('deliverable'),
      acceptCriteria,
      deadline: fd.get('deadline'),
      priority: fd.get('priority'),
    });
    form.reset();
    document.getElementById('newTicketDialog').close();
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

// ---------- Export / Import ----------

function exportJson() {
  const blob = new Blob([JSON.stringify(tickets, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tickets-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('File không đúng định dạng');
      tickets = data;
      saveTickets(tickets);
      render();
      alert(`Đã nhập ${data.length} ticket.`);
    } catch (e) {
      alert('Lỗi đọc file: ' + e.message);
    }
  };
  reader.readAsText(file);
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
  initTabs();
  renderAgentLibrary();
  render();

  document.getElementById('btnNewTicket').addEventListener('click', () => {
    document.getElementById('newTicketDialog').showModal();
  });
  document.getElementById('btnCloseDialog').addEventListener('click', () => {
    document.getElementById('newTicketDialog').close();
  });
  document.getElementById('filterAgent').addEventListener('change', renderBoard);
  document.getElementById('filterPriority').addEventListener('change', renderBoard);
  document.getElementById('btnExport').addEventListener('click', exportJson);
  document.getElementById('fileImport').addEventListener('change', (e) => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = '';
  });
}

document.addEventListener('DOMContentLoaded', init);
