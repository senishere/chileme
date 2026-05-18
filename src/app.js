import {
  buildEntryItem,
  createId,
  dateKey,
  findFood,
  findPortion,
  nonNegativeFiniteNumber,
  positiveFiniteNumber,
  portionsForFood,
  sevenDayStats,
  summarizeDay
} from "./domain.js";
import { createStore, exportState, importState } from "./store.js";

const store = createStore();
let state = store.load();
let currentView = "today";
let selectedFoodId = "";

const root = document.querySelector("#view-root");
const modalRoot = document.querySelector("#modal-root");
const todayLabel = document.querySelector("#today-label");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function saveAndRender() {
  store.save(state);
  render();
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("zh-CN", {
    maximumFractionDigits: digits
  });
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

function foodLabel(food) {
  return food?.name || "未知食物";
}

function portionLabel(stateValue, item) {
  const portion = findPortion(stateValue, item.portionId);
  return portion?.label || item.label || `${item.grams}g`;
}

function thumbHtml(food, photo = "") {
  if (photo) return `<span class="entry-thumb"><img alt="" src="${escapeAttr(photo)}"></span>`;
  if (food?.image) return `<span class="entry-thumb"><img alt="" src="${escapeAttr(food.image)}"></span>`;
  return `<span class="entry-thumb">${escapeHtml(food?.emoji || "🍽️")}</span>`;
}

function quickThumbHtml(food) {
  if (food.image) return `<span class="food-thumb"><img alt="" src="${escapeAttr(food.image)}"></span>`;
  return `<span class="food-thumb">${escapeHtml(food.emoji || "🍽️")}</span>`;
}

function renderSummary(day) {
  const summary = summarizeDay(state, day);
  return `
    <section class="summary-grid" aria-label="今日概览">
      <article class="metric-card"><div class="metric-value">${formatNumber(summary.calories)}</div><div class="metric-label">kcal 粗略</div></article>
      <article class="metric-card"><div class="metric-value">${formatNumber(summary.protein, 1)}g</div><div class="metric-label">蛋白质</div></article>
      <article class="metric-card"><div class="metric-value">${formatNumber(summary.waterMl / 1000, 1)}L</div><div class="metric-label">饮水</div></article>
    </section>
  `;
}

function renderQuickAdd() {
  const quickFoods = state.foods.filter((food) => food.quickAdd !== false);
  const cards = quickFoods.map((food) => {
    const portion = findPortion(state, food.defaultPortionId);
    return `
      <button class="quick-card" type="button" data-action="open-entry" data-food-id="${escapeAttr(food.id)}">
        ${quickThumbHtml(food)}
        <span class="quick-name">${escapeHtml(food.name)}</span>
        <span class="quick-portion">${escapeHtml(portion?.label || "自定义")}</span>
      </button>
    `;
  }).join("");

  return `
    <section class="panel">
      <div class="section-head">
        <h2>快速添加</h2>
        <span class="hint">左右滑动</span>
      </div>
      <div class="quick-rail">${cards || `<div class="empty">添加第一个常吃食物</div>`}</div>
      <div class="actions-row">
        <button class="button secondary" type="button" data-action="show-foods">搜索/更多</button>
        <button class="button secondary" type="button" data-action="add-water">+ 300ml</button>
        <button class="button" type="button" data-action="open-entry">+ 自定义</button>
      </div>
    </section>
  `;
}

function renderTimeline(day) {
  const entries = state.entries
    .filter((entry) => dateKey(entry.timestamp) === day)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (!entries.length) {
    return `
      <section class="panel">
        <div class="section-head"><h2>今日记录</h2><span class="hint">上下滚动</span></div>
        <div class="empty">还没有记录。吃完就点上面的快捷食物。</div>
      </section>
    `;
  }

  const rows = entries.map((entry) => {
    const firstItem = entry.items[0];
    const firstFood = findFood(state, firstItem?.foodId);
    const title = entry.items.map((item) => foodLabel(findFood(state, item.foodId))).join(" + ");
    const calories = entry.items.reduce((sum, item) => sum + (item.nutrition?.calories || 0), 0);
    const portions = entry.items.map((item) => portionLabel(state, item)).join(" + ");
    return `
      <article class="timeline-card">
        ${thumbHtml(firstFood, entry.photo)}
        <div>
          <p class="entry-title">${escapeHtml(formatTime(entry.timestamp))} ${escapeHtml(title)}</p>
          <p class="entry-meta">${escapeHtml(portions)} · 约 ${formatNumber(calories)} kcal</p>
          ${entry.note ? `<p class="entry-meta">${escapeHtml(entry.note)}</p>` : ""}
        </div>
        <button class="icon-button" type="button" aria-label="删除记录" data-action="delete-entry" data-entry-id="${escapeAttr(entry.id)}">×</button>
      </article>
    `;
  }).join("");

  return `
    <section class="panel">
      <div class="section-head"><h2>今日记录</h2><span class="hint">上下滚动</span></div>
      <div class="timeline">${rows}</div>
    </section>
  `;
}

function renderToday() {
  const day = dateKey();
  todayLabel.textContent = `今天 · ${day}`;
  root.innerHTML = renderSummary(day) + renderQuickAdd() + renderTimeline(day);
}

function renderFoods() {
  const rows = state.foods.map((food) => {
    const portion = findPortion(state, food.defaultPortionId);
    return `
      <article class="food-row">
        <div><strong>${escapeHtml(food.emoji || "🍽️")} ${escapeHtml(food.name)}</strong><br><span class="hint">${escapeHtml(food.category)} · ${food.kind === "packaged" ? "包装食品" : "常规食物"} · ${escapeHtml(portion?.label || "无默认份量")}</span></div>
        <button class="icon-button" type="button" data-action="open-entry" data-food-id="${escapeAttr(food.id)}">+</button>
      </article>
    `;
  }).join("");

  root.innerHTML = `
    <section class="panel">
      <div class="section-head">
        <h2>食物库</h2>
        <button class="button" type="button" data-action="open-food-form">+ 食物</button>
      </div>
      ${rows}
    </section>
  `;
}

function renderStats() {
  const stats = sevenDayStats(state);
  const rows = stats.map((day) => `
    <article class="stat-row">
      <strong>${escapeHtml(day.date.slice(5))}</strong>
      <span>${formatNumber(day.calories)} kcal</span>
      <span>${formatNumber(day.protein, 1)}g 蛋白</span>
      <span>${formatNumber(day.waterMl / 1000, 1)}L</span>
      <span>${formatNumber(day.entryCount)}条记录</span>
    </article>
  `).join("");

  root.innerHTML = `
    <section class="panel">
      <div class="section-head"><h2>最近 7 天</h2><span class="hint">事实汇总</span></div>
      ${rows}
    </section>
  `;
}

function renderSettings() {
  const firstContainer = state.calibration.containers?.[0] || {
    id: "container_custom",
    label: "常用容器",
    capacityMl: 350
  };

  root.innerHTML = `
    <section class="panel">
      <div class="section-head"><h2>设置</h2><span class="hint">本地数据</span></div>
      <form class="form-grid" data-action="save-settings">
        <label class="field"><span>热量目标 kcal</span><input name="calories" inputmode="numeric" value="${escapeAttr(state.dailyGoal.calories || "")}"></label>
        <label class="field"><span>蛋白质目标 g</span><input name="protein" inputmode="numeric" value="${escapeAttr(state.dailyGoal.protein || "")}"></label>
        <label class="field"><span>饮水目标 ml</span><input name="waterMl" inputmode="numeric" value="${escapeAttr(state.dailyGoal.waterMl || "")}"></label>
        <label class="field"><span>拳头宽度 cm</span><input name="fistWidthCm" inputmode="decimal" value="${escapeAttr(state.calibration.fistWidthCm || "")}"></label>
        <label class="field"><span>掌心宽度 cm</span><input name="palmWidthCm" inputmode="decimal" value="${escapeAttr(state.calibration.palmWidthCm || "")}"></label>
        <label class="field"><span>手指宽度 cm</span><input name="fingerWidthCm" inputmode="decimal" value="${escapeAttr(state.calibration.fingerWidthCm || "")}"></label>
        <label class="field"><span>常用容器名称</span><input name="containerLabel" value="${escapeAttr(firstContainer.label || "")}"></label>
        <label class="field"><span>常用容器容量 ml</span><input name="containerCapacityMl" inputmode="decimal" value="${escapeAttr(firstContainer.capacityMl || "")}"></label>
        <button class="button" type="submit">保存设置</button>
      </form>
      <div class="actions-row">
        <button class="button secondary" type="button" data-action="export">导出 JSON</button>
        <button class="button secondary" type="button" data-action="import">导入 JSON</button>
      </div>
      <div class="actions-row">
        <button class="button danger" type="button" data-action="clear-data">清空本地数据</button>
      </div>
    </section>
  `;
}

function render() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === currentView);
  });

  if (currentView === "foods") renderFoods();
  else if (currentView === "stats") renderStats();
  else if (currentView === "settings") renderSettings();
  else renderToday();
}

function closeModal() {
  modalRoot.hidden = true;
  modalRoot.innerHTML = "";
  selectedFoodId = "";
}

function openEntryModal(foodId = "") {
  selectedFoodId = foodId || state.foods[0]?.id || "";
  const food = findFood(state, selectedFoodId);
  const portions = portionsForFood(state, selectedFoodId);
  const defaultPortion = findPortion(state, food?.defaultPortionId) || portions[0];

  modalRoot.hidden = false;
  modalRoot.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="添加记录">
      <div class="section-head">
        <h2>记录刚吃的</h2>
        <button class="icon-button" type="button" data-action="close-modal">×</button>
      </div>
      <form class="form-grid" data-action="save-entry">
        <label class="field">
          <span>食物</span>
          <select name="foodId">
            ${state.foods.map((item) => `<option value="${escapeAttr(item.id)}" ${item.id === selectedFoodId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>份量</span>
          <select name="portionId">
            ${portions.map((portion) => `<option value="${escapeAttr(portion.id)}" ${portion.id === defaultPortion?.id ? "selected" : ""}>${escapeHtml(portion.label)} · ${formatNumber(portion.grams, 1)}g</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>自定义克数</span><input name="grams" inputmode="decimal" value="${escapeAttr(defaultPortion?.grams || 100)}"></label>
        <label class="field"><span>备注</span><textarea name="note" rows="2" placeholder="可选"></textarea></label>
        <label class="field"><span>照片，只用于回忆</span><input name="photo" type="file" accept="image/*"></label>
        <button class="button" type="submit">保存记录</button>
      </form>
    </section>
  `;
}

function openFoodForm() {
  modalRoot.hidden = false;
  modalRoot.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="新增食物">
      <div class="section-head">
        <h2>新增食物</h2>
        <button class="icon-button" type="button" data-action="close-modal">×</button>
      </div>
      <form class="form-grid" data-action="save-food">
        <label class="field"><span>名称</span><input name="name" required placeholder="例如 牛奶"></label>
        <label class="field"><span>分类</span><input name="category" value="常吃"></label>
        <label class="field"><span>类型</span><select name="kind"><option value="regular">常规食物</option><option value="packaged">包装食品</option></select></label>
        <label class="field"><span>默认份量名称</span><input name="portionLabel" value="1份"></label>
        <label class="field"><span>默认份量克数</span><input name="grams" inputmode="decimal" value="100"></label>
        <label class="field"><span>热量 kcal / 100g 或每份</span><input name="calories" inputmode="decimal" value="0"></label>
        <label class="field"><span>蛋白质 g</span><input name="protein" inputmode="decimal" value="0"></label>
        <label class="field"><span>碳水 g</span><input name="carbs" inputmode="decimal" value="0"></label>
        <label class="field"><span>脂肪 g</span><input name="fat" inputmode="decimal" value="0"></label>
        <label class="field"><span>图片</span><input name="image" type="file" accept="image/*"></label>
        <button class="button" type="submit">保存食物</button>
      </form>
    </section>
  `;
}

function readImage(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function handleEntrySubmit(form) {
  const data = new FormData(form);
  const food = findFood(state, String(data.get("foodId")));
  const portion = findPortion(state, String(data.get("portionId")));
  if (!food) return;

  const grams = positiveFiniteNumber(data.get("grams"), positiveFiniteNumber(portion?.grams, 0));
  const item = buildEntryItem(food, portion, grams);
  const photo = await readImage(form.photo.files[0]);
  state.entries.push({
    id: createId("entry"),
    timestamp: new Date().toISOString(),
    items: [item],
    note: String(data.get("note") || ""),
    photo
  });

  closeModal();
  currentView = "today";
  saveAndRender();
}

async function handleFoodSubmit(form) {
  const data = new FormData(form);
  const foodId = createId("food");
  const portionId = createId("portion");
  const image = await readImage(form.image.files[0]);
  const kind = String(data.get("kind") || "regular");
  const grams = positiveFiniteNumber(data.get("grams"), 100);
  const food = {
    id: foodId,
    name: String(data.get("name") || "未命名"),
    category: String(data.get("category") || "常吃"),
    kind,
    emoji: "🍽️",
    image,
    nutritionMode: kind === "packaged" ? "perServing" : "per100g",
    servingGrams: grams,
    packageGrams: grams,
    nutrition: {
      calories: nonNegativeFiniteNumber(data.get("calories"), 0),
      protein: nonNegativeFiniteNumber(data.get("protein"), 0),
      carbs: nonNegativeFiniteNumber(data.get("carbs"), 0),
      fat: nonNegativeFiniteNumber(data.get("fat"), 0)
    },
    defaultPortionId: portionId,
    quickAdd: true
  };
  state.foods.push(food);
  state.portions.push({
    id: portionId,
    foodId,
    label: String(data.get("portionLabel") || "1份"),
    grams
  });

  closeModal();
  currentView = "foods";
  saveAndRender();
}

function exportJson() {
  const blob = new Blob([exportState(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chileme-${dateKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importJson() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      state = importState(await file.text());
      saveAndRender();
    } catch (error) {
      alert(error.message);
    }
  });
  input.click();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], .nav-item");
  if (!target) return;

  if (target.dataset.view) {
    currentView = target.dataset.view;
    render();
    return;
  }

  const action = target.dataset.action;
  if (action === "open-entry") openEntryModal(target.dataset.foodId || "");
  if (action === "show-foods") {
    currentView = "foods";
    render();
  }
  if (action === "add-water") {
    state.waterEntries.push({
      id: createId("water"),
      timestamp: new Date().toISOString(),
      milliliters: 300
    });
    saveAndRender();
  }
  if (action === "open-food-form") openFoodForm();
  if (action === "close-modal") closeModal();
  if (action === "delete-entry") {
    state.entries = state.entries.filter((entry) => entry.id !== target.dataset.entryId);
    saveAndRender();
  }
  if (action === "export") exportJson();
  if (action === "import") importJson();
  if (action === "clear-data" && confirm("清空本地数据？")) {
    store.clear();
    state = store.load();
    render();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  const action = form.dataset.action;
  if (!action) return;
  event.preventDefault();

  if (action === "save-entry") await handleEntrySubmit(form);
  if (action === "save-food") await handleFoodSubmit(form);
  if (action === "save-settings") {
    const data = new FormData(form);
    const existingContainers = Array.isArray(state.calibration.containers)
      ? state.calibration.containers
      : [];
    const firstContainer = existingContainers[0] || {
      id: "container_custom",
      label: "常用容器",
      capacityMl: 350
    };
    state.dailyGoal = {
      calories: Number(data.get("calories")) || 0,
      protein: Number(data.get("protein")) || 0,
      waterMl: Number(data.get("waterMl")) || 0
    };
    state.calibration = {
      ...state.calibration,
      fistWidthCm: Number(data.get("fistWidthCm")) || 0,
      palmWidthCm: Number(data.get("palmWidthCm")) || 0,
      fingerWidthCm: Number(data.get("fingerWidthCm")) || 0,
      containers: [
        {
          ...firstContainer,
          label: String(data.get("containerLabel") || firstContainer.label || "常用容器"),
          capacityMl: Number(data.get("containerCapacityMl")) || firstContainer.capacityMl || 0
        },
        ...existingContainers.slice(1)
      ]
    };
    saveAndRender();
    alert("设置已保存");
  }
});

modalRoot.addEventListener("change", (event) => {
  const select = event.target.closest('select[name="foodId"]');
  if (!select) return;
  openEntryModal(select.value);
});

render();
