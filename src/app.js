import {
  ICON_OPTIONS,
  addCategory,
  addLocalProfile,
  activeRecordState,
  buildEntryItem,
  createId,
  dateKey,
  defaultIconForCategory,
  deleteCategory,
  deleteLocalProfile,
  dailyStructure,
  exportLogRows,
  exportRowsAsCsv,
  filterFoods,
  findFood,
  getActiveProfile,
  nonNegativeFiniteNumber,
  positiveFiniteNumber,
  renameCategory,
  renameLocalProfile,
  setActiveProfile,
  summarizeDay,
  trendStats,
  updateActiveProfile
} from "./domain.js";
import {
  createStore,
  exportState,
  importState
} from "./store.js";
import {
  amountLabel,
  escapeAttr,
  escapeHtml,
  caloriesFromEnergyInputs,
  formatNumber,
  formatTime,
  itemAmountLabel
} from "./ui/format.js";
import { readImage } from "./ui/image.js";

const store = createStore();
let state = store.load();
let currentView = "today";
let selectedFoodId = "";
let entryDraft = null;
let quickCategory = "favorite";
let foodLibraryCategory = "all";
let foodSearchQuery = "";
let statsDays = 7;

const root = document.querySelector("#view-root");
const modalRoot = document.querySelector("#modal-root");
const todayLabel = document.querySelector("#today-label");

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is optional; the app remains usable without it.
    });
  });
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

function foodLabel(food) {
  return food?.name || "未知食物";
}

function isWaterFood(food) {
  return food?.id === "food_water" || food?.category === "水";
}

function thumbHtml(food, photo = "") {
  if (photo) return `<span class="entry-thumb"><img alt="" src="${escapeAttr(photo)}"></span>`;
  if (food?.image) return `<span class="entry-thumb"><img alt="" src="${escapeAttr(food.image)}"></span>`;
  return `<span class="entry-thumb">${escapeHtml(food?.icon || "🍽️")}</span>`;
}

function quickThumbHtml(food) {
  if (food.image) return `<span class="food-thumb"><img alt="" src="${escapeAttr(food.image)}"></span>`;
  return `<span class="food-thumb">${escapeHtml(food.icon || "🍽️")}</span>`;
}

function categoryLabel(category) {
  if (category === "all") return "全部";
  if (category === "favorite") return "最常吃";
  return category;
}

function renderCategoryChips(categories, activeCategory, action) {
  return `
    <div class="filter-rail" role="list">
      ${categories.map((category) => `
        <button class="filter-chip ${category === activeCategory ? "active" : ""}" type="button" data-action="${escapeAttr(action)}" data-category="${escapeAttr(category)}">${escapeHtml(categoryLabel(category))}</button>
      `).join("")}
    </div>
  `;
}

function renderSummary(day, records = activeRecordState(state)) {
  const summary = summarizeDay(records, day);
  return `
    <section class="summary-grid" aria-label="今日概览">
      <article class="metric-card"><div class="metric-value">${formatNumber(summary.calories)}</div><div class="metric-label">kcal 粗略</div></article>
      <article class="metric-card"><div class="metric-value">${formatNumber(summary.protein, 1)}g</div><div class="metric-label">蛋白质</div></article>
      <article class="metric-card"><div class="metric-value">${formatNumber(summary.waterMl / 1000, 1)}L</div><div class="metric-label">饮水</div></article>
    </section>
  `;
}

function statusLabel(status) {
  if (status === "severe-low") return "严重不足";
  if (status === "low") return "不足";
  if (status === "normal") return "正常";
  if (status === "high") return "偏高";
  if (status === "over") return "超量";
  return "估算";
}

function structureIcon(key) {
  if (key === "calories") return "🍱";
  if (key === "protein") return "🥚";
  if (key === "carbs") return "🍚";
  if (key === "fat") return "🥑";
  if (key === "fiber") return "🌾";
  if (key === "waterMl") return "💧";
  return "🍽️";
}

function renderStructure(day, records = activeRecordState(state)) {
  const metrics = dailyStructure(records, day);
  const rows = Object.entries(metrics).map(([key, metric]) => {
    const progress = Math.min(100, Math.round((metric.ratio || 0) * 100));
    const ratioLabel = `${Math.round((metric.ratio || 0) * 100)}%`;
    return `
      <article class="structure-row metric-${escapeAttr(key)} ${escapeAttr(metric.status)}">
        <span class="structure-icon" aria-hidden="true">${escapeHtml(structureIcon(key))}</span>
        <div class="structure-label">
          <strong>${escapeHtml(metric.label)}</strong>
          <span>达成 ${escapeHtml(ratioLabel)}</span>
        </div>
        <div class="structure-track" aria-hidden="true"><span style="width: ${progress}%"></span></div>
        <em>${escapeHtml(statusLabel(metric.status))}</em>
      </article>
    `;
  }).join("");

  return `
    <section class="panel">
      <div class="section-head"><h2>今日结构</h2><span class="hint">估算值</span></div>
      <div class="structure-list">${rows}</div>
    </section>
  `;
}

function renderQuickAdd() {
  const categories = ["favorite", ...state.categories.map((category) => category.name)];
  if (!categories.includes(quickCategory)) quickCategory = "favorite";
  const quickFoods = filterFoods(state.foods, { category: quickCategory });
  const cards = quickFoods.map((food) => `
      <button class="quick-card" type="button" data-action="open-entry" data-food-id="${escapeAttr(food.id)}">
        ${quickThumbHtml(food)}
        <span class="quick-name">${escapeHtml(food.name)}</span>
        <span class="quick-calories">
          <span class="quick-calorie-value">${formatNumber(food.nutritionPer100g?.calories || 0)}</span>
          <span class="quick-calorie-unit">kcal/100g</span>
        </span>
      </button>
    `).join("");

  return `
    <section class="panel">
      <div class="section-head">
        <h2>快速添加</h2>
        <span class="hint">左右滑动</span>
      </div>
      ${renderCategoryChips(categories, quickCategory, "set-quick-category")}
      <div class="quick-rail">${cards || `<div class="empty">添加第一个常吃食物</div>`}</div>
      <div class="actions-row">
        <button class="button secondary" type="button" data-action="show-foods">搜索/更多</button>
        <button class="button" type="button" data-action="open-entry">+ 自定义</button>
      </div>
    </section>
  `;
}

function renderTimeline(day, records = activeRecordState(state)) {
  const entries = records.entries
    .filter((entry) => dateKey(entry.timestamp) === day)
    .map((entry) => ({ type: "food", timestamp: entry.timestamp, entry }));
  const waterEntries = records.waterEntries
    .filter((entry) => dateKey(entry.timestamp) === day)
    .map((entry) => ({ type: "water", timestamp: entry.timestamp, entry }));
  const timelineRecords = [...entries, ...waterEntries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (!timelineRecords.length) {
    return `
      <section class="panel">
        <div class="section-head"><h2>今日记录</h2><span class="hint">上下滚动</span></div>
        <div class="empty">还没有记录。吃完就点上面的快捷食物。</div>
      </section>
    `;
  }

  const rows = timelineRecords.map((record) => {
    if (record.type === "water") {
      const water = record.entry;
      return `
        <article class="timeline-card">
          <span class="entry-thumb">💧</span>
          <div>
            <p class="entry-title">${escapeHtml(formatTime(water.timestamp))} 饮水</p>
            <p class="entry-meta">${amountLabel(water.milliliters, "ml")}</p>
          </div>
          <div class="entry-actions">
            <button class="icon-button" type="button" aria-label="删除饮水" data-action="delete-water" data-water-id="${escapeAttr(water.id)}">×</button>
          </div>
        </article>
      `;
    }
    const entry = record.entry;
    const firstItem = entry.items[0];
    const firstFood = findFood(state, firstItem?.foodId);
    const title = entry.items.map((item) => foodLabel(findFood(state, item.foodId))).join(" + ");
    const calories = entry.items.reduce((sum, item) => sum + (item.nutrition?.calories || 0), 0);
    const amounts = entry.items.map((item) => itemAmountLabel(item)).join(" + ");
    return `
      <article class="timeline-card">
        ${thumbHtml(firstFood, entry.photo)}
        <div>
          <p class="entry-title">${escapeHtml(formatTime(entry.timestamp))} ${escapeHtml(title)}</p>
          <p class="entry-meta">${escapeHtml(amounts)} · 约 ${formatNumber(calories)} kcal</p>
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
  const records = activeRecordState(state);
  const activeProfile = getActiveProfile(state);
  todayLabel.textContent = `今天 · ${day}`;
  root.innerHTML = `
    <section class="panel profile-banner">
      <span class="hint">当前档案</span>
      <strong class="profile-name">${escapeHtml(activeProfile.name)}</strong>
    </section>
  ` + renderSummary(day, records) + renderStructure(day, records) + renderQuickAdd() + renderTimeline(day, records);
}

function renderFoodRows() {
  const foods = filterFoods(state.foods, {
    category: foodLibraryCategory,
    query: foodSearchQuery
  });
  if (!foods.length) return `<div class="empty">没有匹配的食物</div>`;

  return foods.map((food) => {
    const favoriteLabel = food.quickAdd === false ? "常用" : "取消";
    return `
      <article class="food-row">
        <div class="food-main">
          <strong>${escapeHtml(food.icon || "🍽️")} ${escapeHtml(food.name)}</strong>
        </div>
        <div class="food-actions">
          <button class="button secondary compact" type="button" data-action="toggle-favorite" data-food-id="${escapeAttr(food.id)}">${favoriteLabel}</button>
          <button class="icon-button" type="button" aria-label="编辑食物" data-action="edit-food" data-food-id="${escapeAttr(food.id)}">✎</button>
          <button class="icon-button" type="button" data-action="open-entry" data-food-id="${escapeAttr(food.id)}">+</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderFoods() {
  const categories = ["all", "favorite", ...state.categories.map((category) => category.name)];
  if (!categories.includes(foodLibraryCategory)) foodLibraryCategory = "all";

  root.innerHTML = `
    <section class="panel">
      <div class="section-head">
        <h2>食物</h2>
        <div class="food-actions">
          <button class="button secondary compact" type="button" data-action="open-category-manager">分类</button>
          <button class="button compact" type="button" data-action="open-food-form">+ 食物</button>
        </div>
      </div>
      <label class="field search-field">
        <span>搜索</span>
        <input name="foodSearch" type="search" enterkeyhint="search" value="${escapeAttr(foodSearchQuery)}" placeholder="食物名或分类">
      </label>
      ${renderCategoryChips(categories, foodLibraryCategory, "set-food-category")}
      <div id="food-results">${renderFoodRows()}</div>
    </section>
  `;
}

function renderStats() {
  const records = activeRecordState(state);
  const stats = trendStats(records, dateKey(), statsDays);
  const maxCalories = Math.max(1, ...stats.map((day) => day.calories));
  const totalCalories = stats.reduce((sum, day) => sum + day.calories, 0);
  const averageCalories = Math.round(totalCalories / stats.length);
  const activeDays = stats.filter((day) => day.entryCount > 0 || day.waterMl > 0).length;
  const bars = stats.map((day, index) => {
    const label = trendLabel(day, index, stats.length);
    return `
    <article class="trend-day ${label ? "has-label" : ""}" title="${escapeAttr(day.date)} · ${formatNumber(day.calories)} kcal">
      <span style="height: ${Math.max(4, Math.round((day.calories / maxCalories) * 100))}%"></span>
      ${label ? `<em>${escapeHtml(label)}</em>` : ""}
    </article>
  `;
  }).join("");

  root.innerHTML = `
    <section class="panel">
      <div class="section-head"><h2>统计</h2><span class="hint">${statsDays} 天趋势</span></div>
      <div class="segmented">
        <button class="${statsDays === 7 ? "active" : ""}" type="button" data-action="set-stats-range" data-days="7">最近一周</button>
        <button class="${statsDays === 30 ? "active" : ""}" type="button" data-action="set-stats-range" data-days="30">最近一月</button>
      </div>
      <div class="trend-summary" aria-label="统计摘要">
        <article><strong>${formatNumber(totalCalories)}</strong><span>总热量 kcal</span></article>
        <article><strong>${formatNumber(averageCalories)}</strong><span>日均 kcal</span></article>
        <article><strong>${activeDays}</strong><span>有记录天数</span></article>
      </div>
      <div class="trend-bars" aria-label="热量趋势">${bars}</div>
    </section>
  `;
}

function trendLabel(day, index, total) {
  if (total <= 7) return day.date.slice(5);
  if (index === 0 || index === total - 1 || index % 5 === 0) return day.date.slice(5);
  return "";
}

function renderSettings() {
  const activeProfile = getActiveProfile(state);
  const profile = activeProfile.profile;
  const dailyGoal = activeProfile.dailyGoal;
  root.innerHTML = `
    <section class="panel">
      <div class="section-head"><h2>设置</h2><span class="hint">本地数据</span></div>
      <div class="settings-group">
        <h3>当前档案</h3>
        <label class="field">
          <span>当前档案</span>
          <select name="activeProfileId" data-action="set-active-profile">
            ${state.profiles.map((item) => `<option value="${escapeAttr(item.id)}" ${item.id === state.activeProfileId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </label>
        <div class="actions-row">
          <button class="button secondary" type="button" data-action="add-profile">新增档案</button>
          <button class="button secondary" type="button" data-action="rename-profile">重命名</button>
          <button class="button secondary" type="button" data-action="delete-profile">删除档案</button>
        </div>
      </div>
      <form class="form-grid" data-action="save-settings">
        <label class="field"><span>热量目标 kcal</span><input name="calories" inputmode="numeric" value="${escapeAttr(dailyGoal.calories || "")}"></label>
        <label class="field"><span>蛋白质目标 g</span><input name="protein" inputmode="numeric" value="${escapeAttr(dailyGoal.protein || "")}"></label>
        <label class="field"><span>膳食纤维目标 g</span><input name="fiber" inputmode="numeric" value="${escapeAttr(dailyGoal.fiber || "")}"></label>
        <label class="field"><span>饮水目标 ml</span><input name="waterMl" inputmode="numeric" value="${escapeAttr(dailyGoal.waterMl || "")}"></label>
        <label class="field"><span>性别</span><select name="sex"><option value="female" ${profile.sex === "female" ? "selected" : ""}>女</option><option value="male" ${profile.sex === "male" ? "selected" : ""}>男</option></select></label>
        <label class="field"><span>年龄</span><input name="age" inputmode="numeric" value="${escapeAttr(profile.age || "")}"></label>
        <label class="field"><span>身高 cm</span><input name="heightCm" inputmode="decimal" value="${escapeAttr(profile.heightCm || "")}"></label>
        <label class="field"><span>体重 kg</span><input name="weightKg" inputmode="decimal" value="${escapeAttr(profile.weightKg || "")}"></label>
        <label class="field"><span>活动水平</span><select name="activityLevel"><option value="sedentary" ${profile.activityLevel === "sedentary" ? "selected" : ""}>久坐</option><option value="light" ${profile.activityLevel === "light" ? "selected" : ""}>轻度</option><option value="moderate" ${profile.activityLevel === "moderate" ? "selected" : ""}>中等</option><option value="active" ${profile.activityLevel === "active" ? "selected" : ""}>较高</option></select></label>
        <label class="field"><span>目标</span><select name="goal"><option value="maintain" ${profile.goal === "maintain" ? "selected" : ""}>维持</option><option value="lose" ${profile.goal === "lose" ? "selected" : ""}>减脂</option><option value="gain" ${profile.goal === "gain" ? "selected" : ""}>增肌</option></select></label>
        <button class="button" type="submit">保存设置</button>
      </form>
      <div class="settings-group">
        <h3>完整备份</h3>
        <div class="actions-row">
          <button class="button secondary" type="button" data-action="export">导出备份 JSON</button>
          <button class="button secondary" type="button" data-action="import">导入备份 JSON</button>
        </div>
      </div>
      <div class="settings-group">
        <h3>记录明细</h3>
        <form class="export-form" data-action="export-range-form">
          <label class="field"><span>范围</span><select name="exportDays"><option value="7">最近 7 天</option><option value="30">最近 30 天</option></select></label>
          <label class="field"><span>格式</span><select name="exportFormat"><option value="csv">CSV 表格</option><option value="json">JSON 数据</option></select></label>
          <button class="button" type="submit">导出明细</button>
        </form>
      </div>
      <div class="settings-group danger-zone">
        <h3>本地数据</h3>
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

function createDraftItem(foodId, amountValue = 100, unitValue = "g") {
  const food = findFood(state, foodId);
  if (!food) return null;
  const amount = positiveFiniteNumber(amountValue, 100);
  const unit = unitValue === "ml" ? "ml" : "g";
  return buildEntryItem(food, amount, unit);
}

function draftTitle() {
  return entryDraft?.entryId ? "编辑记录" : "记录刚吃的";
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
          <br><span class="hint">${itemAmountLabel(item)} · ${formatNumber(item.nutrition?.calories)} kcal</span>
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
        <label class="field"><span>数量</span><input name="amount" inputmode="decimal" value="100"></label>
        <label class="field"><span>单位</span><select name="unit"><option value="g">g</option><option value="ml">ml</option></select></label>
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
  const records = activeRecordState(state);
  const existing = entryId ? records.entries.find((entry) => entry.id === entryId) : null;
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
        items: [],
        note: "",
        photo: ""
      };
  renderEntryModal();
}

function openFoodForm(foodId = "") {
  const existingFood = findFood(state, foodId);
  const title = existingFood ? "编辑食物" : "新增食物";
  const nutrition = existingFood?.nutritionPer100g || {};
  const category = existingFood?.category || state.categories[0]?.name || "其他";
  const icon = defaultIconForCategory(category, existingFood?.icon);

  modalRoot.hidden = false;
  modalRoot.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
      <div class="section-head">
        <h2>${escapeHtml(title)}</h2>
        <button class="icon-button" type="button" data-action="close-modal">×</button>
      </div>
      <form class="form-grid" data-action="save-food">
        <input type="hidden" name="foodId" value="${escapeAttr(existingFood?.id || "")}">
        <input type="hidden" name="icon" value="${escapeAttr(icon)}">
        <label class="field"><span>名称</span><input name="name" required placeholder="例如 牛奶" value="${escapeAttr(existingFood?.name || "")}"></label>
        <label class="field"><span>分类</span><select name="category">${state.categories.map((item) => `<option value="${escapeAttr(item.name)}" ${item.name === category ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
        <div class="icon-picker" role="listbox" aria-label="图标">
          ${Object.values(ICON_OPTIONS).flat().map((option) => `<button class="${option === icon ? "active" : ""}" type="button" data-action="select-food-icon" data-icon="${escapeAttr(option)}">${escapeHtml(option)}</button>`).join("")}
        </div>
        <label class="field"><span>每 100g 热量 kcal</span><input name="calories" inputmode="decimal" value="${escapeAttr(existingFood ? (nutrition.calories ?? "") : "")}"></label>
        <label class="field"><span>每 100g 热量 kJ</span><input name="kilojoules" inputmode="decimal" value=""></label>
        <label class="field"><span>每 100g 蛋白质 g</span><input name="protein" inputmode="decimal" value="${escapeAttr(nutrition.protein || 0)}"></label>
        <label class="field"><span>每 100g 碳水 g</span><input name="carbs" inputmode="decimal" value="${escapeAttr(nutrition.carbs || 0)}"></label>
        <label class="field"><span>每 100g 脂肪 g</span><input name="fat" inputmode="decimal" value="${escapeAttr(nutrition.fat || 0)}"></label>
        <label class="field"><span>每 100g 膳食纤维 g</span><input name="fiber" inputmode="decimal" value="${escapeAttr(nutrition.fiber || 0)}"></label>
        <label class="field"><span>每 100g 钠 mg</span><input name="sodium" inputmode="decimal" value="${escapeAttr(nutrition.sodium || 0)}"></label>
        ${existingFood?.image ? `<div class="photo-preview"><span class="entry-thumb"><img alt="" src="${escapeAttr(existingFood.image)}"></span><span class="hint">已保存图片</span></div>` : ""}
        <label class="field"><span>图片</span><input name="image" type="file" accept="image/*"></label>
        <button class="button" type="submit">保存食物</button>
      </form>
    </section>
  `;
}

function openCategoryManager() {
  const icon = ICON_OPTIONS["其他"]?.[0] || "🍽️";

  modalRoot.hidden = false;
  modalRoot.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="管理分类">
      <div class="section-head">
        <h2>管理分类</h2>
        <button class="icon-button" type="button" data-action="close-modal">×</button>
      </div>
      <form class="category-add" data-action="add-category">
        <input type="hidden" name="icon" value="${escapeAttr(icon)}">
        <label class="field"><span>新分类</span><input name="categoryName" required placeholder="例如 备餐"></label>
        <div class="icon-picker" role="listbox" aria-label="分类图标">
          ${Object.values(ICON_OPTIONS).flat().map((option) => `<button class="${option === icon ? "active" : ""}" type="button" data-action="select-category-icon" data-icon="${escapeAttr(option)}">${escapeHtml(option)}</button>`).join("")}
        </div>
        <button class="button" type="submit">添加</button>
      </form>
      <div class="category-list">
        ${state.categories.map((category) => `
          <article class="category-row">
            <span><strong>${escapeHtml(category.icon || "🍽️")}</strong> ${escapeHtml(category.name)}</span>
            <div class="food-actions">
              <button class="button secondary compact" type="button" data-action="rename-category" data-category="${escapeAttr(category.name)}">重命名</button>
              <button class="icon-button" type="button" aria-label="删除分类" data-action="delete-category" data-category="${escapeAttr(category.name)}">×</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
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
      data.get("amount"),
      String(data.get("unit") || "g")
    );
    if (item) entryDraft.items.push(item);
  }
  if (!entryDraft.items.length) {
    alert("请先加入至少一种食物。");
    return;
  }

  const image = await readImage(form.photo.files[0]);
  const photo = image.dataUrl || entryDraft.photo || "";
  const timestamp = entryDraft.timestamp || new Date().toISOString();
  const waterItems = entryDraft.items.filter((item) => isWaterFood(findFood(state, item.foodId)));
  const foodItems = entryDraft.items.filter((item) => !isWaterFood(findFood(state, item.foodId)));
  state = updateActiveProfile(state, (profile) => {
    const waterEntries = [...profile.waterEntries];
    for (const item of waterItems) {
      waterEntries.push({
        id: createId("water"),
        timestamp,
        milliliters: positiveFiniteNumber(item.amount, positiveFiniteNumber(item.grams, 0))
      });
    }

    const entry = {
      id: entryDraft.entryId || createId("entry"),
      timestamp,
      items: cloneEntryItems(foodItems),
      note: entryDraft.note,
      photo
    };
    let entries = [...profile.entries];

    if (entryDraft.entryId && foodItems.length) {
      entries = entries.map((existing) => existing.id === entryDraft.entryId ? entry : existing);
    } else if (entryDraft.entryId) {
      entries = entries.filter((existing) => existing.id !== entryDraft.entryId);
    } else if (foodItems.length) {
      entries.push(entry);
    }

    return { ...profile, entries, waterEntries };
  });

  closeModal();
  currentView = "today";
  saveAndRender();
  if (image.dropped) alert("照片过大，记录已保存但不保存照片。");
}

async function handleFoodSubmit(form) {
  const data = new FormData(form);
  const existingFood = findFood(state, String(data.get("foodId") || ""));
  const foodId = existingFood?.id || createId("food");
  const image = await readImage(form.image.files[0]);
  const category = state.categories.some((item) => item.name === data.get("category"))
    ? String(data.get("category"))
    : "其他";
  const icon = String(data.get("icon") || "");
  const food = {
    id: foodId,
    name: String(data.get("name") || "未命名"),
    category,
    icon: defaultIconForCategory(category, icon || existingFood?.icon),
    image: image.dataUrl || existingFood?.image || "",
    nutritionPer100g: {
      calories: caloriesFromEnergyInputs(data.get("calories"), data.get("kilojoules")),
      protein: nonNegativeFiniteNumber(data.get("protein"), 0),
      carbs: nonNegativeFiniteNumber(data.get("carbs"), 0),
      fat: nonNegativeFiniteNumber(data.get("fat"), 0),
      sodium: nonNegativeFiniteNumber(data.get("sodium"), 0),
      fiber: nonNegativeFiniteNumber(data.get("fiber"), 0)
    },
    quickAdd: existingFood?.quickAdd === false ? false : true
  };

  if (existingFood) {
    state.foods = state.foods.map((item) => item.id === foodId ? food : item);
  } else {
    state.foods.push(food);
  }

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

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportRange(days, format) {
  const safeDays = Number(days) === 30 ? 30 : 7;
  const records = activeRecordState(state);
  const rows = exportLogRows(records, dateKey(), safeDays);
  const safeFormat = format === "json" ? "json" : "csv";
  const filename = `chileme-${safeDays}d-${dateKey()}.${safeFormat}`;
  if (safeFormat === "json") {
    downloadText(filename, JSON.stringify(rows, null, 2), "application/json");
  } else {
    downloadText(filename, exportRowsAsCsv(rows), "text/csv;charset=utf-8");
  }
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
      alert("备份已导入");
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
  if (action === "set-quick-category") {
    quickCategory = target.dataset.category || "favorite";
    render();
  }
  if (action === "set-food-category") {
    foodLibraryCategory = target.dataset.category || "all";
    render();
  }
  if (action === "set-stats-range") {
    statsDays = Number(target.dataset.days) === 30 ? 30 : 7;
    render();
  }
  if (action === "toggle-favorite") {
    const food = findFood(state, target.dataset.foodId || "");
    if (food) {
      food.quickAdd = food.quickAdd === false;
      saveAndRender();
    }
  }
  if (action === "open-food-form") openFoodForm();
  if (action === "edit-food") openFoodForm(target.dataset.foodId || "");
  if (action === "open-category-manager") openCategoryManager();
  if (action === "rename-category") {
    const oldName = target.dataset.category || "";
    const nextName = prompt("新的分类名称", oldName);
    if (nextName !== null) {
      try {
        state = renameCategory(state, oldName, nextName);
        saveAndRender();
        openCategoryManager();
      } catch (error) {
        alert(error.message || "分类更新失败");
      }
    }
  }
  if (action === "delete-category" && confirm("删除分类？该分类下的食物会移到其他。")) {
    try {
      state = deleteCategory(state, target.dataset.category || "");
      saveAndRender();
      openCategoryManager();
    } catch (error) {
      alert(error.message || "分类删除失败");
    }
  }
  if (action === "select-food-icon") {
    const form = target.closest("form");
    if (form?.elements.icon) {
      form.elements.icon.value = target.dataset.icon || "🍽️";
      form.querySelectorAll('[data-action="select-food-icon"]').forEach((button) => {
        button.classList.toggle("active", button === target);
      });
    }
  }
  if (action === "select-category-icon") {
    const form = target.closest("form");
    if (form?.elements.icon) {
      form.elements.icon.value = target.dataset.icon || "🍽️";
      form.querySelectorAll('[data-action="select-category-icon"]').forEach((button) => {
        button.classList.toggle("active", button === target);
      });
    }
  }
  if (action === "close-modal") closeModal();
  if (action === "add-draft-item") {
    const form = target.closest("form");
    updateEntryDraftFromForm(form);
    const data = new FormData(form);
    const item = createDraftItem(
      String(data.get("foodId")),
      data.get("amount"),
      String(data.get("unit") || "g")
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
    state = updateActiveProfile(state, (profile) => ({
      ...profile,
      entries: profile.entries.filter((entry) => entry.id !== target.dataset.entryId)
    }));
    saveAndRender();
  }
  if (action === "delete-water") {
    state = updateActiveProfile(state, (profile) => ({
      ...profile,
      waterEntries: profile.waterEntries.filter((entry) => entry.id !== target.dataset.waterId)
    }));
    saveAndRender();
  }
  if (action === "add-profile") {
    const name = prompt("新档案名称", "新档案");
    if (name !== null) {
      try {
        state = addLocalProfile(state, name);
        saveAndRender();
      } catch (error) {
        alert(error.message || "档案添加失败");
      }
    }
  }
  if (action === "rename-profile") {
    const activeProfile = getActiveProfile(state);
    const name = prompt("新的档案名称", activeProfile.name);
    if (name !== null) {
      try {
        state = renameLocalProfile(state, activeProfile.id, name);
        saveAndRender();
      } catch (error) {
        alert(error.message || "档案更新失败");
      }
    }
  }
  if (action === "delete-profile" && confirm("删除当前档案？该档案的记录也会删除。")) {
    try {
      state = deleteLocalProfile(state, state.activeProfileId);
      saveAndRender();
    } catch (error) {
      alert(error.message || "档案删除失败");
    }
  }
  if (action === "export") exportJson();
  if (action === "import") importJson();
  if (action === "clear-data" && confirm("清空本地数据？")) {
    store.clear();
    state = store.load();
    render();
  }
});

document.addEventListener("input", (event) => {
  const input = event.target.closest('input[name="foodSearch"]');
  if (!input) return;
  foodSearchQuery = input.value;
  const results = document.querySelector("#food-results");
  if (results) results.innerHTML = renderFoodRows();
});

document.addEventListener("change", (event) => {
  const activeProfileSelect = event.target.closest('select[data-action="set-active-profile"]');
  if (activeProfileSelect) {
    try {
      state = setActiveProfile(state, activeProfileSelect.value);
      saveAndRender();
    } catch (error) {
      alert(error.message || "档案切换失败");
      render();
    }
    return;
  }

  const select = event.target.closest('form[data-action="save-food"] select[name="category"]');
  if (!select) return;
  const form = select.closest("form");
  const icon = defaultIconForCategory(select.value);
  if (form?.elements.icon) form.elements.icon.value = icon;
  form?.querySelectorAll('[data-action="select-food-icon"]').forEach((button) => {
    button.classList.toggle("active", button.dataset.icon === icon);
  });
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  const action = form.dataset.action;
  if (!action) return;
  event.preventDefault();

  if (action === "save-entry") await handleEntrySubmit(form);
  if (action === "save-food") await handleFoodSubmit(form);
  if (action === "add-category") {
    const data = new FormData(form);
    try {
      state = addCategory(state, data.get("categoryName"), data.get("icon"));
      saveAndRender();
      openCategoryManager();
    } catch (error) {
      alert(error.message || "分类添加失败");
    }
  }
  if (action === "save-settings") {
    const data = new FormData(form);
    const activeProfile = getActiveProfile(state);
    state = updateActiveProfile(state, (profile) => ({
      ...profile,
      dailyGoal: {
        calories: goalInputValue(data.get("calories")),
        protein: goalInputValue(data.get("protein")),
        fiber: goalInputValue(data.get("fiber")),
        waterMl: goalInputValue(data.get("waterMl"))
      },
      profile: {
        sex: data.get("sex") === "male" ? "male" : "female",
        age: positiveFiniteNumber(data.get("age"), activeProfile.profile.age),
        heightCm: positiveFiniteNumber(data.get("heightCm"), activeProfile.profile.heightCm),
        weightKg: positiveFiniteNumber(data.get("weightKg"), activeProfile.profile.weightKg),
        activityLevel: String(data.get("activityLevel") || activeProfile.profile.activityLevel),
        goal: String(data.get("goal") || activeProfile.profile.goal)
      }
    }));
    saveAndRender();
    alert("设置已保存");
  }
  if (action === "export-range-form") {
    const data = new FormData(form);
    exportRange(data.get("exportDays"), data.get("exportFormat"));
  }
});

modalRoot.addEventListener("change", (event) => {
  const select = event.target.closest('select[name="foodId"]');
  if (!select) return;
  const form = select.closest("form");
  updateEntryDraftFromForm(form);
  if (select.name === "foodId") selectedFoodId = select.value;
});

registerServiceWorker();
render();
