const STORAGE_KEY = "ndweb_gastos_demo_v1";
const EXPENSE_LIMIT = 5;

let expenses = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let currentPeriod = "week";
let anchorDate = new Date();
let editingId = null;
let currentView = "dashboard";

const $ = (id) => document.getElementById(id);

const categoryIcons = {
  Comida: "🍔", Transporte: "🚗", Compras: "🛒", Servicios: "💡",
  Entretenimiento: "🎮", Salud: "💊", Educación: "📚", Otros: "📌"
};

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function money(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency", currency: "CRC", maximumFractionDigits: 0
  }).format(value || 0);
}

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getPeriodBounds() {
  return currentPeriod === "week"
    ? { start: startOfWeek(anchorDate), end: endOfWeek(anchorDate) }
    : { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
}

function periodExpenses() {
  const { start, end } = getPeriodBounds();
  return expenses.filter(e => {
    const d = parseLocalDate(e.date);
    return d >= start && d <= end;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

function formatDate(date) {
  return date.toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" });
}

function updatePeriodHeader() {
  const { start, end } = getPeriodBounds();

  if (currentPeriod === "week") {
    $("periodTitle").textContent = "Vista semanal";
    $("periodRange").textContent = `${formatDate(start)} – ${formatDate(end)}`;
    $("chartSubtitle").textContent = "Distribución de tus gastos durante la semana";
  } else {
    $("periodTitle").textContent = anchorDate.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
    $("periodRange").textContent = `${formatDate(start)} – ${formatDate(end)}`;
    $("chartSubtitle").textContent = "Distribución de tus gastos durante el mes";
  }
}

function renderSummary(list) {
  const total = list.reduce((sum, e) => sum + Number(e.amount), 0);
  const largest = list.length ? Math.max(...list.map(e => Number(e.amount))) : 0;

  const days = currentPeriod === "week" ? 7 : new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();

  $("totalAmount").textContent = money(total);
  $("expenseCount").textContent = list.length;
  $("dailyAverage").textContent = money(total / days);
  $("largestExpense").textContent = money(largest);
}

function renderChart(list) {
  const container = $("barChart");
  container.innerHTML = "";

  const { start, end } = getPeriodBounds();
  const values = [];

  if (currentPeriod === "week") {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = localDateString(d);
      const total = list.filter(e => e.date === key).reduce((s, e) => s + Number(e.amount), 0);
      values.push({
        label: d.toLocaleDateString("es-CR", { weekday: "short" }).replace(".", ""),
        total,
        key
      });
    }
  } else {
    const days = end.getDate();
    for (let i = 1; i <= days; i++) {
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), i);
      const key = localDateString(d);
      const total = list.filter(e => e.date === key).reduce((s, e) => s + Number(e.amount), 0);
      values.push({ label: i, total, key });
    }
  }

  const max = Math.max(...values.map(v => v.total), 1);

  values.forEach(v => {
    const item = document.createElement("div");
    item.className = "bar-item";
    if (v.key === localDateString(new Date())) item.classList.add("current");

    item.innerHTML = `
      <div class="bar-value">${v.total ? money(v.total).replace("CRC", "₡") : ""}</div>
      <div class="bar" style="height:${Math.max(3, (v.total / max) * 155)}px"></div>
      <div class="bar-label">${v.label}</div>
    `;
    container.appendChild(item);
  });

  if (currentPeriod === "month") {
    container.style.overflowX = "auto";
    [...container.children].forEach(el => el.style.minWidth = "24px");
  } else {
    container.style.overflowX = "hidden";
  }
}

function renderCategories(list) {
  const container = $("categoryList");
  container.innerHTML = "";

  const totals = {};
  list.forEach(e => {
    totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
  });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, value]) => s + value, 0);

  if (!entries.length) {
    container.innerHTML = `<p style="color:var(--muted);font-size:12px">No hay categorías para mostrar todavía.</p>`;
    return;
  }

  entries.forEach(([category, amount]) => {
    const percentage = total ? (amount / total) * 100 : 0;
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `
      <div>
        <div class="category-info">
          <span>${categoryIcons[category] || "📌"} ${category}</span>
          <span>${money(amount)}</span>
        </div>
        <div class="progress"><span style="width:${percentage}%"></span></div>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderTable(list) {
  const tbody = $("expenseTable");
  const empty = $("emptyState");
  tbody.innerHTML = "";

  if (!list.length) {
    empty.classList.add("show");
    return;
  }

  empty.classList.remove("show");

  list.forEach(e => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(parseLocalDate(e.date))}</td>
      <td><strong>${escapeHtml(e.name)}</strong>${e.description ? `<div style="font-size:10px;color:var(--muted);margin-top:3px">${escapeHtml(e.description)}</div>` : ""}</td>
      <td><span class="category-badge">${categoryIcons[e.category] || "📌"} ${e.category}</span></td>
      <td class="amount">${money(e.amount)}</td>
      <td>
        <button class="action-btn edit-btn" data-id="${e.id}" title="Editar">✏️</button>
        <button class="action-btn delete-btn" data-id="${e.id}" title="Eliminar">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".edit-btn").forEach(btn => btn.addEventListener("click", () => openEdit(btn.dataset.id)));
  document.querySelectorAll(".delete-btn").forEach(btn => btn.addEventListener("click", () => deleteExpense(btn.dataset.id)));
}

function updateDemoLimit() {
  const count = expenses.length;
  const counter = $("demoLimit");
  if (counter) {
    counter.textContent = `Versión de prueba: ${count}/${EXPENSE_LIMIT} gastos`;
    counter.classList.toggle("limit-reached", count >= EXPENSE_LIMIT);
  }
  const disabled = count >= EXPENSE_LIMIT;
  [$("openModal"), $("emptyAddBtn")].forEach(btn => {
    if (!btn) return;
    btn.disabled = disabled;
    btn.title = disabled ? "Alcanzaste el límite de 5 gastos de la versión de prueba" : "Agregar gasto";
  });
}

function render() {
  updatePeriodHeader();
  updateDemoLimit();
  const list = currentView === "expenses"
    ? [...expenses].sort((a, b) => b.date.localeCompare(a.date))
    : periodExpenses();

  document.body.dataset.view = currentView;
  $("pageTitle").textContent = currentView === "dashboard" ? "Resumen" : "Gastos";
  $("expenseListTitle").textContent = currentView === "dashboard" ? "Gastos recientes" : "Todos mis gastos";
  $("listSubtitle").textContent = currentView === "dashboard"
    ? "Movimientos del periodo seleccionado"
    : `${list.length} ${list.length === 1 ? "gasto registrado" : "gastos registrados"}`;
  $("showAllBtn").textContent = currentView === "dashboard" ? "Ver todos" : "Volver al resumen";

  renderSummary(list);
  renderChart(list);
  renderCategories(list);
  renderTable(list);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function openModal() {
  if (expenses.length >= EXPENSE_LIMIT) {
    alert(`Esta versión de prueba permite registrar hasta ${EXPENSE_LIMIT} gastos. Elimina uno si deseas liberar un espacio.`);
    return;
  }
  editingId = null;
  $("modalTitle").textContent = "Agregar gasto";
  $("saveBtn").textContent = "Guardar gasto";
  $("expenseForm").reset();
  $("expenseDate").value = localDateString(new Date());
  $("modal").classList.add("show");
  $("expenseName").focus();
}

function openEdit(id) {
  const e = expenses.find(x => x.id === id);
  if (!e) return;

  editingId = id;
  $("modalTitle").textContent = "Editar gasto";
  $("saveBtn").textContent = "Guardar cambios";
  $("expenseName").value = e.name;
  $("expenseAmount").value = e.amount;
  $("expenseDate").value = e.date;
  $("expenseCategory").value = e.category;
  $("expenseDescription").value = e.description || "";
  $("modal").classList.add("show");
}

function closeModal() {
  $("modal").classList.remove("show");
  editingId = null;
}

function deleteExpense(id) {
  const e = expenses.find(x => x.id === id);
  if (!e) return;

  if (confirm(`¿Eliminar "${e.name}" de ${money(e.amount)}?`)) {
    expenses = expenses.filter(x => x.id !== id);
    saveData();
    render();
  }
}

$("expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const data = {
    name: $("expenseName").value.trim(),
    amount: Number($("expenseAmount").value),
    date: $("expenseDate").value,
    category: $("expenseCategory").value,
    description: $("expenseDescription").value.trim()
  };

  if (!data.name || !data.amount || data.amount < 0 || !data.date) return;

  if (!editingId && expenses.length >= EXPENSE_LIMIT) {
    alert(`Llegaste al límite de ${EXPENSE_LIMIT} gastos de esta versión de prueba.`);
    closeModal();
    render();
    return;
  }

  if (editingId) {
    const index = expenses.findIndex(e => e.id === editingId);
    if (index !== -1) expenses[index] = { ...expenses[index], ...data };
  } else {
    expenses.push({ id: crypto.randomUUID(), ...data });
  }

  saveData();
  closeModal();
  render();
});

$("openModal").addEventListener("click", openModal);
$("emptyAddBtn").addEventListener("click", openModal);
$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);

$("modal").addEventListener("click", e => {
  if (e.target === $("modal")) closeModal();
});

document.querySelectorAll(".period-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentPeriod = btn.dataset.period;
    anchorDate = new Date();

    document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    render();
  });
});

$("previousPeriod").addEventListener("click", () => {
  if (currentPeriod === "week") anchorDate.setDate(anchorDate.getDate() - 7);
  else anchorDate.setMonth(anchorDate.getMonth() - 1);
  render();
});

$("nextPeriod").addEventListener("click", () => {
  if (currentPeriod === "week") anchorDate.setDate(anchorDate.getDate() + 7);
  else anchorDate.setMonth(anchorDate.getMonth() + 1);
  render();
});

$("todayBtn").addEventListener("click", () => {
  anchorDate = new Date();
  render();
});

function setView(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-current", active ? "page" : "false");
  });
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("showAllBtn").addEventListener("click", () => {
  setView(currentView === "dashboard" ? "expenses" : "dashboard");
});

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

$("expenseDate").value = localDateString(new Date());
render();
