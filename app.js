import { getDb, firebaseConfig } from "./firebase-config.js";

const TODOS_COLLECTION = "todos";
const PASSWORD_KEY = "todo-password";
const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

const $ = (id) => document.getElementById(id);
const addForm = $("addForm");
const todoInput = $("todoInput");
const btnAdd = $("btnAdd");
const inputHint = $("inputHint");
const todoList = $("todoList");
const emptyState = $("emptyState");
const loadingEl = $("loading");
const filterBtns = document.querySelectorAll(".filter-btn");
const calGrid = $("calGrid");
const calMonthYear = $("calMonthYear");
const calPrev = $("calPrev");
const calNext = $("calNext");
const selectedDateEl = $("selectedDate");

const passwordOverlay = $("passwordModalOverlay");
const passwordInput = $("passwordInput");
const passwordDesc = $("passwordModalDesc");
const passwordError = $("passwordModalError");
const passwordCancel = $("passwordModalCancel");
const passwordConfirm = $("passwordModalConfirm");

const editOverlay = $("editModalOverlay");
const editInput = $("editInput");
const editError = $("editModalError");
const editCancel = $("editModalCancel");
const editSave = $("editModalSave");

let currentFilter = "all";
let pendingAction = null;
let todos = [];
let unsubscribe = null;
let firestoreOps = null;

let selectedDate = null;
let calYear = null;
let calMonth = null;

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getStoredPassword() {
  return localStorage.getItem(PASSWORD_KEY) || "";
}

function setStoredPassword(pw) {
  localStorage.setItem(PASSWORD_KEY, pw || "");
}

function requestEdit(id) {
  pendingAction = { type: "edit", id };
  passwordDesc.textContent = getStoredPassword()
    ? "수정하려면 비밀번호를 입력하세요."
    : "비밀번호가 없습니다. 새 비밀번호를 입력하여 설정 후 수정합니다.";
  passwordError.textContent = "";
  passwordInput.value = "";
  passwordOverlay.hidden = false;
  passwordInput.focus();
}

function requestDelete(id) {
  pendingAction = { type: "delete", id };
  passwordDesc.textContent = getStoredPassword()
    ? "삭제하려면 비밀번호를 입력하세요."
    : "비밀번호가 없습니다. 새 비밀번호를 입력하여 설정 후 삭제합니다.";
  passwordError.textContent = "";
  passwordInput.value = "";
  passwordOverlay.hidden = false;
  passwordInput.focus();
}

function closePasswordModal() {
  passwordOverlay.hidden = true;
  pendingAction = null;
  passwordInput.value = "";
  passwordError.textContent = "";
}

function checkPasswordAndProceed() {
  const input = passwordInput.value;
  const stored = getStoredPassword();

  if (!input.trim()) {
    passwordError.textContent = "비밀번호를 입력하세요.";
    return;
  }

  if (!stored) {
    setStoredPassword(input.trim());
    passwordError.textContent = "";
    executePendingAction();
    closePasswordModal();
    return;
  }

  if (input !== stored) {
    passwordError.textContent = "비밀번호가 올바르지 않습니다.";
    return;
  }

  passwordError.textContent = "";
  executePendingAction();
  closePasswordModal();
}

function executePendingAction() {
  if (!pendingAction) return;
  const { type, id } = pendingAction;
  pendingAction = null;
  if (type === "edit") openEditModal(id);
  else if (type === "delete") performDelete(id);
}

function openEditModal(id) {
  const t = todos.find((x) => x.id === id);
  if (!t) return;
  editInput.value = t.text;
  editInput.dataset.editId = id;
  editError.textContent = "";
  editOverlay.hidden = false;
  editInput.focus();
}

function closeEditModal() {
  editOverlay.hidden = true;
  editInput.value = "";
  editInput.removeAttribute("data-edit-id");
  editError.textContent = "";
}

function saveEdit() {
  const id = editInput.dataset.editId;
  const text = editInput.value.trim();
  if (!id) return;
  if (!text) {
    editError.textContent = "할일 내용을 입력하세요.";
    return;
  }
  closeEditModal();
  updateTodo(id, text);
}

async function performDelete(id) {
  const ops = await initFirestoreOps();
  if (!ops) return;
  const ymd = selectedDate;
  const ref = docRef(ymd);
  try {
    await ops.runTransaction(ops.db, async (tx) => {
      const snap = await tx.get(ref);
      const items = (snap.exists() ? snap.data().items || [] : []).filter((it) => it.id !== id);
      tx.set(ref, { items });
    });
  } catch (err) {
    console.error("Delete error:", err);
    showHint("삭제 중 오류가 났어요.");
  }
}

function getTodayString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(ymd) {
  const d = parseYMD(ymd);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const w = weekdays[d.getDay()];
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}년 ${m}월 ${day}일 (${w})`;
}

function showHint(msg) {
  inputHint.textContent = msg || "";
}

function setLoading(show) {
  loadingEl.classList.toggle("hidden", !show);
}

function setSelectedDate(ymd) {
  selectedDate = ymd;
  selectedDateEl.textContent = formatDisplayDate(ymd) + "의 할일";
}

function filteredTodos() {
  if (currentFilter === "active") return todos.filter((t) => !t.completed);
  if (currentFilter === "completed") return todos.filter((t) => t.completed);
  return todos;
}

function renderList() {
  const list = filteredTodos();
  todoList.innerHTML = "";
  emptyState.hidden = true;

  if (list.length === 0) {
    emptyState.hidden = todos.length === 0;
    if (todos.length > 0) {
      const li = document.createElement("li");
      li.className = "empty-in-list";
      li.textContent = "해당하는 할일이 없습니다.";
      todoList.appendChild(li);
    }
    return;
  }

  list.forEach((t) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (t.completed ? " completed" : "");
    li.dataset.id = t.id;

    const check = document.createElement("button");
    check.type = "button";
    check.className = "todo-check";
    check.setAttribute("aria-label", t.completed ? "완료 해제" : "완료");
    check.innerHTML = t.completed
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>'
      : "";
    check.addEventListener("click", () => toggleComplete(t.id));

    const span = document.createElement("span");
    span.className = "todo-text";
    span.textContent = t.text;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "todo-edit";
    edit.setAttribute("aria-label", "수정");
    edit.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    edit.addEventListener("click", () => requestEdit(t.id));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "todo-delete";
    del.setAttribute("aria-label", "삭제");
    del.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M6 18L18 6"/></svg>';
    del.addEventListener("click", () => requestDelete(t.id));

    li.append(check, span, edit, del);
    todoList.appendChild(li);
  });
}

function handleFilter(e) {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;
  filterBtns.forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentFilter = btn.dataset.filter;
  btn.setAttribute("aria-selected", "true");
  filterBtns.forEach((b) => {
    if (b !== btn) b.setAttribute("aria-selected", "false");
  });
  renderList();
}

function renderCalendar() {
  calMonthYear.textContent = `${calYear}년 ${calMonth}월`;
  const first = new Date(calYear, calMonth - 1, 1);
  const last = new Date(calYear, calMonth, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const prevLast = new Date(calYear, calMonth - 1, 0);
  const prevDays = prevLast.getDate();

  calGrid.innerHTML = "";

  for (let i = 0; i < startPad; i++) {
    const d = prevDays - startPad + 1 + i;
    const y = calMonth === 1 ? calYear - 1 : calYear;
    const m = calMonth === 1 ? 12 : calMonth - 1;
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day other-month";
    btn.textContent = d;
    btn.dataset.ymd = ymd;
    btn.addEventListener("click", () => pickDate(ymd));
    calGrid.appendChild(btn);
  }

  const today = getTodayString();
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day";
    if (ymd === today) btn.classList.add("today");
    if (ymd === selectedDate) btn.classList.add("selected");
    btn.textContent = d;
    btn.dataset.ymd = ymd;
    btn.addEventListener("click", () => pickDate(ymd));
    calGrid.appendChild(btn);
  }

  const totalCells = startPad + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) {
    const d = i + 1;
    const y = calMonth === 12 ? calYear + 1 : calYear;
    const m = calMonth === 12 ? 1 : calMonth + 1;
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day other-month";
    btn.textContent = d;
    btn.dataset.ymd = ymd;
    btn.addEventListener("click", () => pickDate(ymd));
    calGrid.appendChild(btn);
  }
}

function prevMonth() {
  if (calMonth === 1) {
    calYear--;
    calMonth = 12;
  } else calMonth--;
  renderCalendar();
}

function nextMonth() {
  if (calMonth === 12) {
    calYear++;
    calMonth = 1;
  } else calMonth++;
  renderCalendar();
}

function pickDate(ymd) {
  const [y, m] = ymd.split("-").map(Number);
  calYear = y;
  calMonth = m;
  setSelectedDate(ymd);
  renderCalendar();
  subscribeToDate(ymd);
}

async function initFirestoreOps() {
  if (firestoreOps) return firestoreOps;
  const db = getDb();
  if (!db || !isConfigured) return null;
  const { doc, runTransaction, onSnapshot } = await import(
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
  );
  firestoreOps = { db, doc, runTransaction, onSnapshot };
  return firestoreOps;
}

function docRef(ymd) {
  return firestoreOps.doc(firestoreOps.db, TODOS_COLLECTION, ymd);
}

function subscribeToDate(ymd) {
  (async () => {
    const ops = await initFirestoreOps();
    if (!ops) {
      setLoading(false);
      emptyState.hidden = false;
      todoList.innerHTML = "";
      return;
    }
    if (unsubscribe) unsubscribe();

    unsubscribe = ops.onSnapshot(
      docRef(ymd),
      (snap) => {
        const raw = snap.exists() ? snap.data().items || [] : [];
        todos = [...raw].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setLoading(false);
        renderList();
      },
      (err) => {
        console.error("Firestore error:", err);
        setLoading(false);
        showHint("동기화 중 오류가 났어요. 콘솔을 확인해 주세요.");
      }
    );
  })();
}

async function addTodo(e) {
  e.preventDefault();
  const raw = todoInput.value.trim();
  showHint("");

  if (!raw) {
    showHint("할일 내용을 입력해 주세요.");
    todoInput.focus();
    return;
  }

  const ops = await initFirestoreOps();
  if (!ops) {
    showHint("Firebase 설정 후 이용해 주세요.");
    return;
  }

  const ymd = selectedDate;
  const ref = docRef(ymd);
  const newItem = {
    id: genId(),
    text: raw,
    completed: false,
    createdAt: Date.now(),
  };

  btnAdd.disabled = true;
  try {
    await ops.runTransaction(ops.db, async (tx) => {
      const snap = await tx.get(ref);
      const items = snap.exists() ? (snap.data().items || []).slice() : [];
      items.push(newItem);
      tx.set(ref, { items });
    });
    todoInput.value = "";
    todoInput.focus();
  } catch (err) {
    console.error(err);
    showHint("추가 중 오류가 났어요.");
  } finally {
    btnAdd.disabled = false;
  }
}

async function toggleComplete(id) {
  const ops = await initFirestoreOps();
  if (!ops) return;
  const t = todos.find((x) => x.id === id);
  if (!t) return;

  const ymd = selectedDate;
  const ref = docRef(ymd);

  try {
    await ops.runTransaction(ops.db, async (tx) => {
      const snap = await tx.get(ref);
      const items = (snap.exists() ? snap.data().items || [] : []).map((it) =>
        it.id === id ? { ...it, completed: !it.completed } : it
      );
      tx.set(ref, { items });
    });
  } catch (err) {
    console.error("Toggle error:", err);
  }
}

async function updateTodo(id, newText) {
  const ops = await initFirestoreOps();
  if (!ops) return;

  const ymd = selectedDate;
  const ref = docRef(ymd);

  try {
    await ops.runTransaction(ops.db, async (tx) => {
      const snap = await tx.get(ref);
      const items = (snap.exists() ? snap.data().items || [] : []).map((it) =>
        it.id === id ? { ...it, text: newText.trim() } : it
      );
      tx.set(ref, { items });
    });
  } catch (err) {
    console.error("Update error:", err);
    showHint("수정 중 오류가 났어요.");
  }
}

function renderConfigBanner() {
  if (isConfigured) return;
  const banner = document.createElement("div");
  banner.className = "config-banner";
  banner.innerHTML =
    '<p>Firebase 설정이 필요합니다. <code>firebase-config.js</code>에 프로젝트 정보를 넣어 주세요.</p>';
  document.querySelector(".main").prepend(banner);
}

function init() {
  const today = getTodayString();
  const d = new Date();
  calYear = d.getFullYear();
  calMonth = d.getMonth() + 1;

  setSelectedDate(today);
  renderCalendar();
  renderConfigBanner();

  addForm.addEventListener("submit", addTodo);
  filterBtns.forEach((btn) => btn.addEventListener("click", handleFilter));
  calPrev.addEventListener("click", prevMonth);
  calNext.addEventListener("click", nextMonth);

  passwordConfirm.addEventListener("click", checkPasswordAndProceed);
  passwordCancel.addEventListener("click", closePasswordModal);
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkPasswordAndProceed();
    if (e.key === "Escape") closePasswordModal();
  });

  editSave.addEventListener("click", saveEdit);
  editCancel.addEventListener("click", closeEditModal);
  editInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") closeEditModal();
  });

  [passwordOverlay, editOverlay].forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target === el) {
        if (el === passwordOverlay) closePasswordModal();
        else closeEditModal();
      }
    });
  });

  setLoading(true);
  subscribeToDate(today);
}

init();
