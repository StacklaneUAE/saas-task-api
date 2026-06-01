/* ---------------------------------------------------------------------------
   TaskFlow — frontend logic (vanilla JS)
   Talks to the Python stdlib REST API at /tasks. No framework, no build step.
--------------------------------------------------------------------------- */

const API = "/tasks";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- state ------------------------------------------------------------------
let tasks = [];
let filter = "all"; // all | active | done
let chart = null;
const seen = new Set(); // task ids already rendered — so only new rows animate in

// --- element refs -----------------------------------------------------------
const $list = document.getElementById("task-list");
const $empty = document.getElementById("empty-state");
const $form = document.getElementById("add-form");
const $input = document.getElementById("new-title");
const $filters = document.getElementById("filters");
const $toast = document.getElementById("toast");

const $statTotal = document.getElementById("stat-total");
const $statDone = document.getElementById("stat-done");
const $statPending = document.getElementById("stat-pending");
const $chartPercent = document.getElementById("chart-percent");

// --- API helpers ------------------------------------------------------------
async function api(method, path = "", body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function loadTasks() {
  try {
    const data = await api("GET");
    tasks = data.tasks || [];
    render();
  } catch (err) {
    toast(err.message, true);
  }
}

async function addTask(title) {
  try {
    const task = await api("POST", "", { title });
    tasks.push(task);
    render();
    toast("Task added");
  } catch (err) {
    toast(err.message, true);
  }
}

async function toggleTask(task, sourceEl) {
  try {
    const updated = await api("PUT", `/${task.id}`, { done: !task.done });
    const becameDone = updated.done && !task.done;
    Object.assign(task, updated);
    render();
    if (becameDone) {
      const allDone = tasks.length > 0 && tasks.every((t) => t.done);
      celebrate(sourceEl, allDone);
    }
  } catch (err) {
    toast(err.message, true);
  }
}

async function saveTitle(task, title) {
  const trimmed = title.trim();
  if (!trimmed || trimmed === task.title) {
    render();
    return;
  }
  try {
    const updated = await api("PUT", `/${task.id}`, { title: trimmed });
    Object.assign(task, updated);
    render();
    toast("Task updated");
  } catch (err) {
    toast(err.message, true);
  }
}

async function deleteTask(task, el) {
  // play exit animation, then hit the API
  el.classList.add("task--leaving");
  setTimeout(async () => {
    try {
      await api("DELETE", `/${task.id}`);
      tasks = tasks.filter((t) => t.id !== task.id);
      render();
      toast("Task deleted");
    } catch (err) {
      el.classList.remove("task--leaving");
      toast(err.message, true);
    }
  }, 280);
}

// --- rendering --------------------------------------------------------------
function visibleTasks() {
  if (filter === "active") return tasks.filter((t) => !t.done);
  if (filter === "done") return tasks.filter((t) => t.done);
  return tasks;
}

function render() {
  const list = visibleTasks();
  $list.innerHTML = "";

  let newCount = 0;
  list.forEach((task) => {
    const isNew = !seen.has(task.id);
    if (isNew) seen.add(task.id);
    $list.appendChild(taskRow(task, isNew, isNew ? newCount++ : 0));
  });
  // forget ids that no longer exist so re-adds animate again
  const live = new Set(tasks.map((t) => t.id));
  seen.forEach((id) => live.has(id) || seen.delete(id));

  $empty.hidden = list.length > 0;
  if (tasks.length === 0) {
    $empty.querySelector(".empty__title").textContent = "Nothing here yet";
    $empty.querySelector(".empty__hint").textContent =
      "Add your first task above to get started.";
  } else if (list.length === 0) {
    $empty.querySelector(".empty__title").textContent = "No matching tasks";
    $empty.querySelector(".empty__hint").textContent =
      "Try a different filter above.";
  }

  updateStats();
}

function taskRow(task, isNew, idx = 0) {
  const li = document.createElement("li");
  li.className = "task" + (task.done ? " task--done" : "");
  if (isNew && !reduceMotion) {
    li.classList.add("task--enter");
    li.style.animationDelay = Math.min(idx * 55, 400) + "ms";
  }
  li.dataset.id = task.id;

  // checkbox
  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "task__check";
  check.checked = task.done;
  check.title = task.done ? "Mark as not done" : "Mark as done";
  check.addEventListener("change", () => toggleTask(task, check));

  // title
  const title = document.createElement("span");
  title.className = "task__title";
  title.textContent = task.title;
  title.title = "Double-click to edit";
  title.addEventListener("dblclick", () => startEdit(li, task));

  // actions
  const actions = document.createElement("div");
  actions.className = "task__actions";

  const editBtn = iconBtn("✎", "icon-btn", "Edit task");
  editBtn.addEventListener("click", () => startEdit(li, task));

  const delBtn = iconBtn("🗑", "icon-btn icon-btn--danger", "Delete task");
  delBtn.addEventListener("click", () => deleteTask(task, li));

  actions.append(editBtn, delBtn);
  li.append(check, title, actions);
  return li;
}

function iconBtn(label, className, title) {
  const b = document.createElement("button");
  b.className = className;
  b.type = "button";
  b.textContent = label;
  b.title = title;
  b.setAttribute("aria-label", title);
  return b;
}

function startEdit(li, task) {
  if (li.querySelector(".task__edit")) return; // already editing

  const input = document.createElement("input");
  input.className = "task__edit";
  input.value = task.title;
  input.maxLength = 200;

  const title = li.querySelector(".task__title");
  li.replaceChild(input, title);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    saveTitle(task, input.value);
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      committed = true;
      render();
    }
  });
}

// --- stats + chart ----------------------------------------------------------
function updateStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pending = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;

  animateNumber($statTotal, total);
  animateNumber($statDone, done);
  animateNumber($statPending, pending);
  animateNumber($chartPercent, pct, "%");

  updateChart(done, pending);
}

// tween an element's number to `to`, with a little pop when it changes
function animateNumber(el, to, suffix = "") {
  const from = parseInt(el.textContent, 10) || 0;
  if (from === to) return;
  el.classList.remove("is-bumped");
  // restart the bump animation
  void el.offsetWidth;
  el.classList.add("is-bumped");

  if (reduceMotion) {
    el.textContent = to + suffix;
    return;
  }
  const duration = 450;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateChart(done, pending) {
  const data = [done, pending];
  if (chart) {
    chart.data.datasets[0].data = data;
    chart.update();
    return;
  }
  const ctx = document.getElementById("progress-chart");
  if (!ctx || typeof Chart === "undefined") return;

  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Completed", "Pending"],
      datasets: [
        {
          data,
          backgroundColor: ["#22c55e", "rgba(255,255,255,0.10)"],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      cutout: "72%",
      responsive: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
    },
  });
}

// --- toast ------------------------------------------------------------------
let toastTimer = null;
function toast(msg, isError = false) {
  $toast.textContent = msg;
  $toast.classList.toggle("toast--error", isError);
  $toast.classList.add("toast--show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove("toast--show"), 2600);
}

// --- confetti ---------------------------------------------------------------
const confettiCanvas = document.getElementById("confetti");
const cctx = confettiCanvas ? confettiCanvas.getContext("2d") : null;
let confetti = [];
let confettiRAF = null;
const COLORS = ["#6366f1", "#a855f7", "#ec4899", "#22c55e", "#facc15", "#38bdf8"];

function sizeCanvas() {
  if (!confettiCanvas) return;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener("resize", sizeCanvas);
sizeCanvas();

// burst confetti from a source element (defaults to top-center); `big` for all-done
function celebrate(sourceEl, big) {
  if (!cctx || reduceMotion) return;
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 3;
  if (sourceEl && sourceEl.getBoundingClientRect) {
    const r = sourceEl.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  const count = big ? 140 : 40;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (big ? 9 : 6) * (0.4 + Math.random());
    confetti.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 6,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
    });
  }
  if (big) toast("🎉 All tasks complete — nice work!");
  if (!confettiRAF) confettiRAF = requestAnimationFrame(drawConfetti);
}

function drawConfetti() {
  cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confetti.forEach((p) => {
    p.vy += 0.22; // gravity
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.012;
    cctx.save();
    cctx.translate(p.x, p.y);
    cctx.rotate(p.rot);
    cctx.globalAlpha = Math.max(p.life, 0);
    cctx.fillStyle = p.color;
    cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    cctx.restore();
  });
  confetti = confetti.filter((p) => p.life > 0 && p.y < confettiCanvas.height + 40);
  if (confetti.length) {
    confettiRAF = requestAnimationFrame(drawConfetti);
  } else {
    cctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiRAF = null;
  }
}

// --- ripple -----------------------------------------------------------------
function addRipple(e) {
  const btn = e.currentTarget;
  const r = btn.getBoundingClientRect();
  const span = document.createElement("span");
  span.className = "ripple";
  const size = Math.max(r.width, r.height) * 2;
  span.style.width = span.style.height = size + "px";
  span.style.left = e.clientX - r.left + "px";
  span.style.top = e.clientY - r.top + "px";
  btn.appendChild(span);
  span.addEventListener("animationend", () => span.remove());
}

// --- events -----------------------------------------------------------------
$form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $input.value.trim();
  if (!title) return;
  $input.value = "";
  addTask(title);
});

$filters.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  filter = btn.dataset.filter;
  $filters
    .querySelectorAll(".chip")
    .forEach((c) => c.classList.toggle("chip--active", c === btn));
  render();
});

// ripple on the primary buttons + filter chips
document.querySelectorAll(".btn--primary, .chip").forEach((b) => {
  b.style.position = "relative";
  b.style.overflow = "hidden";
  b.addEventListener("pointerdown", addRipple);
});

// --- boot -------------------------------------------------------------------
loadTasks();
