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
import {
  MAX_STORED_DATA_URL_BYTES,
  createStore,
  exportState,
  importState
} from "./store.js";

const IMAGE_MAX_DIMENSION = 1200;
const IMAGE_QUALITY = 0.72;

const store = createStore();
let state = store.load();
let currentView = "today";
let selectedFoodId = "";
let entryDraft = null;

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
  try {
    const result = store.save(state);
    if (result?.state) state = result.state;
    render();
    if (result?.droppedPhotos) {
      alert("存储空间不足，记录已保存，但照片没有保存。");
    }
  } catch (error) {
    alert(error.message || "保存失败，请导出数据后清理本地空间。");
  }
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
        <div class="entry-actions">
          <button class="icon-button" type="button" aria-label="编辑记录" data-action="edit-entry" data-entry-id="${escapeAttr(entry.id)}">✎</button>
          <button class="icon-button" type="button" aria-label="删除记录" data-action="delete-entry" data-entry-id="${escapeAttr(entry.id)}">×</button>
        </div>
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
  entryDraft = null;
}

function cloneEntryItems(items) {
  return (items || []).map((item) => ({
    ...item,
    nutrition: { ...(item.nutrition || {}) }
  }));
}

function createDraftItem(foodId, portionId = "", gramsValue = "") {
  const food = findFood(state, foodId);
  const portions = portionsForFood(state, foodId);
  const portion = findPortion(state, portionId) || findPortion(state, food?.defaultPortionId) || portions[0];
  if (!food) return null;
  const grams = positiveFiniteNumber(gramsValue, positiveFiniteNumber(portion?.grams, 100));
  return buildEntryItem(food, portion, grams);
}

function draftTitle() {
  return entryDraft?.entryId ? "编辑记录" : "记录刚吃的";
}

function renderPortionOptions(foodId, selectedPortionId = "") {
  const activeFoodId = foodId || selectedFoodId;
  const activeFood = findFood(state, activeFoodId);
  const portions = portionsForFood(state, activeFoodId);
  const defaultPortion = findPortion(state, selectedPortionId)
    || findPortion(state, activeFood?.defaultPortionId)
    || portions[0];

  return portions.map((portion) => `
    <option value="${escapeAttr(portion.id)}" ${portion.id === defaultPortion?.id ? "selected" : ""}>${escapeHtml(portion.label)} · ${formatNumber(portion.grams, 1)}g</option>
  `).join("");
}

function renderDraftItems() {
  if (!entryDraft?.items?.length) {
    return `<div class="empty compact">还没有加入食物</div>`;
  }

  return entryDraft.items.map((item, index) => {
    const food = findFood(state, item.foodId);
    return `
      <article class="food-row">
        <div>
          <strong>${escapeHtml(foodLabel(food))}</strong>
          <br><span class="hint">${escapeHtml(portionLabel(state, item))} · ${formatNumber(item.grams, 1)}g · ${formatNumber(item.nutrition?.calories)} kcal</span>
        </div>
        <button class="icon-button" type="button" aria-label="移除食物" data-action="remove-draft-item" data-index="${index}">×</button>
      </article>
    `;
  }).join("");
}

function updateEntryDraftFromForm(form) {
  if (!entryDraft || !form) return;
  const data = new FormData(form);
  entryDraft.note = String(data.get("note") || "");
}

function renderEntryModal() {
  const food = findFood(state, selectedFoodId);
  const portions = portionsForFood(state, selectedFoodId);
  const defaultPortion = findPortion(state, food?.defaultPortionId) || portions[0];

  modalRoot.hidden = false;
  modalRoot.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(draftTitle())}">
      <div class="section-head">
        <h2>${escapeHtml(draftTitle())}</h2>
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
            ${renderPortionOptions(selectedFoodId)}
          </select>
        </label>
        <label class="field"><span>自定义克数</span><input name="grams" inputmode="decimal" value="${escapeAttr(defaultPortion?.grams || 100)}"></label>
        <button class="button secondary" type="button" data-action="add-draft-item">加入记录</button>
        <div class="draft-list" aria-label="已加入食物">${renderDraftItems()}</div>
        <label class="field"><span>备注</span><textarea name="note" rows="2" placeholder="可选">${escapeHtml(entryDraft?.note || "")}</textarea></label>
        ${entryDraft?.photo ? `<div class="photo-preview"><span class="entry-thumb"><img alt="" src="${escapeAttr(entryDraft.photo)}"></span><span class="hint">已保存照片</span></div>` : ""}
        <label class="field"><span>照片，只用于回忆</span><input name="photo" type="file" accept="image/*"></label>
        <button class="button" type="submit">保存记录</button>
      </form>
    </section>
  `;
}

function openEntryModal(foodId = "", entryId = "") {
  const existing = entryId ? state.entries.find((entry) => entry.id === entryId) : null;
  selectedFoodId = foodId || existing?.items?.[0]?.foodId || state.foods[0]?.id || "";
  entryDraft = existing
    ? {
        entryId: existing.id,
        timestamp: existing.timestamp,
        items: cloneEntryItems(existing.items),
        note: existing.note || "",
        photo: existing.photo || ""
      }
    : {
        entryId: "",
        timestamp: "",
        items: foodId ? [createDraftItem(selectedFoodId)].filter(Boolean) : [],
        note: "",
        photo: ""
      };
  renderEntryModal();
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
        <label class="field"><span>营养标注方式</span><select name="nutritionMode"><option value="per100g">每 100g</option><option value="perServing">每份</option><option value="perPackage">整包</option></select></label>
        <label class="field"><span>默认份量名称</span><input name="portionLabel" value="1份"></label>
        <label class="field"><span>默认份量克数</span><input name="grams" inputmode="decimal" value="100"></label>
        <label class="field"><span>每份克数</span><input name="servingGrams" inputmode="decimal" value="100"></label>
        <label class="field"><span>整包克数</span><input name="packageGrams" inputmode="decimal" value="100"></label>
        <label class="field"><span>热量 kcal</span><input name="calories" inputmode="decimal" value="0"></label>
        <label class="field"><span>蛋白质 g</span><input name="protein" inputmode="decimal" value="0"></label>
        <label class="field"><span>碳水 g</span><input name="carbs" inputmode="decimal" value="0"></label>
        <label class="field"><span>脂肪 g</span><input name="fat" inputmode="decimal" value="0"></label>
        <label class="field"><span>图片</span><input name="image" type="file" accept="image/*"></label>
        <button class="button" type="submit">保存食物</button>
      </form>
    </section>
  `;
}

function dataUrlTooLarge(dataUrl) {
  return String(dataUrl || "").length > MAX_STORED_DATA_URL_BYTES;
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片"));
    };
    image.src = url;
  });
}

async function compressImage(file) {
  const image = await loadImageElement(file);
  const ratio = Math.min(
    1,
    IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)
  );
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  const webp = canvas.toDataURL("image/webp", IMAGE_QUALITY);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
}

function readRawImage(file) {
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

async function readImage(file) {
  if (!file) return { dataUrl: "", dropped: false };
  let dataUrl = "";
  try {
    dataUrl = await compressImage(file);
  } catch (error) {
    dataUrl = await readRawImage(file);
  }

  if (!dataUrl || dataUrlTooLarge(dataUrl)) {
    return { dataUrl: "", dropped: Boolean(dataUrl) };
  }
  return { dataUrl, dropped: false };
}

function goalInputValue(value) {
  const text = String(value ?? "").trim();
  if (text === "") return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function handleEntrySubmit(form) {
  updateEntryDraftFromForm(form);
  if (!entryDraft) return;
  if (!entryDraft.items.length) {
    const data = new FormData(form);
    const item = createDraftItem(
      String(data.get("foodId")),
      String(data.get("portionId")),
      data.get("grams")
    );
    if (item) entryDraft.items.push(item);
  }
  if (!entryDraft.items.length) {
    alert("请先加入至少一种食物。");
    return;
  }

  const image = await readImage(form.photo.files[0]);
  const photo = image.dataUrl || entryDraft.photo || "";
  const entry = {
    id: entryDraft.entryId || createId("entry"),
    timestamp: entryDraft.timestamp || new Date().toISOString(),
    items: cloneEntryItems(entryDraft.items),
    note: entryDraft.note,
    photo
  };

  if (entryDraft.entryId) {
    state.entries = state.entries.map((existing) => existing.id === entryDraft.entryId ? entry : existing);
  } else {
    state.entries.push(entry);
  }

  closeModal();
  currentView = "today";
  saveAndRender();
  if (image.dropped) alert("照片过大，记录已保存但不保存照片。");
}

async function handleFoodSubmit(form) {
  const data = new FormData(form);
  const foodId = createId("food");
  const portionId = createId("portion");
  const image = await readImage(form.image.files[0]);
  const kind = String(data.get("kind") || "regular");
  const grams = positiveFiniteNumber(data.get("grams"), 100);
  const nutritionMode = String(data.get("nutritionMode") || "per100g");
  const servingGrams = positiveFiniteNumber(data.get("servingGrams"), grams);
  const packageGrams = positiveFiniteNumber(data.get("packageGrams"), grams);
  const food = {
    id: foodId,
    name: String(data.get("name") || "未命名"),
    category: String(data.get("category") || "常吃"),
    kind,
    emoji: "🍽️",
    image: image.dataUrl,
    nutritionMode: kind === "packaged" ? nutritionMode : "per100g",
    servingGrams,
    packageGrams,
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
  if (image.dropped) alert("图片过大，食物已保存但不保存图片。");
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
  if (action === "edit-entry") openEntryModal("", target.dataset.entryId || "");
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
  if (action === "add-draft-item") {
    const form = target.closest("form");
    updateEntryDraftFromForm(form);
    const data = new FormData(form);
    const item = createDraftItem(
      String(data.get("foodId")),
      String(data.get("portionId")),
      data.get("grams")
    );
    if (item) entryDraft.items.push(item);
    renderEntryModal();
  }
  if (action === "remove-draft-item") {
    const form = target.closest("form");
    updateEntryDraftFromForm(form);
    const index = Number(target.dataset.index);
    if (Number.isInteger(index)) entryDraft.items.splice(index, 1);
    renderEntryModal();
  }
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
      calories: goalInputValue(data.get("calories")),
      protein: goalInputValue(data.get("protein")),
      waterMl: goalInputValue(data.get("waterMl"))
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
  const form = select.closest("form");
  updateEntryDraftFromForm(form);
  selectedFoodId = select.value;
  const portions = portionsForFood(state, selectedFoodId);
  const defaultPortion = findPortion(state, findFood(state, selectedFoodId)?.defaultPortionId) || portions[0];
  const portionSelect = form.elements.portionId;
  portionSelect.innerHTML = renderPortionOptions(selectedFoodId);
  form.elements.grams.value = defaultPortion?.grams || 100;
});

render();
