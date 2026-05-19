import {
  activeRecordState,
  dailyStructure,
  dateKey,
  filterFoods,
  findFood,
  getActiveProfile,
  summarizeDay
} from "../domain.js";
import {
  amountLabel,
  escapeAttr,
  escapeHtml,
  formatNumber,
  formatTime,
  itemAmountLabel
} from "../ui/format.js";

export function foodLabel(food) {
  return food?.name || "未知食物";
}

export function isWaterFood(food) {
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

export function renderCategoryChips(categories, activeCategory, action) {
  return `
    <div class="filter-rail" role="list">
      ${categories.map((category) => `
        <button class="filter-chip ${category === activeCategory ? "active" : ""}" type="button" data-action="${escapeAttr(action)}" data-category="${escapeAttr(category)}">${escapeHtml(categoryLabel(category))}</button>
      `).join("")}
    </div>
  `;
}

function renderSummary(context, day, records) {
  const { state } = context;
  const activeRecords = records || activeRecordState(state);
  const summary = summarizeDay(activeRecords, day);
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

function renderStructure(context, day, records) {
  const { state } = context;
  const activeRecords = records || activeRecordState(state);
  const metrics = dailyStructure(activeRecords, day);
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

function renderQuickAdd(context) {
  const { state } = context;
  const categories = ["favorite", ...state.categories.map((category) => category.name)];
  const activeCategory = categories.includes(context.quickCategory) ? context.quickCategory : "favorite";
  if (activeCategory !== context.quickCategory) context.setQuickCategory("favorite");
  const quickFoods = filterFoods(state.foods, { category: activeCategory });
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
      ${renderCategoryChips(categories, activeCategory, "set-quick-category")}
      <div class="quick-rail">${cards || `<div class="empty">添加第一个常吃食物</div>`}</div>
      <div class="actions-row">
        <button class="button secondary" type="button" data-action="show-foods">搜索/更多</button>
        <button class="button" type="button" data-action="open-entry">+ 自定义</button>
      </div>
    </section>
  `;
}

function renderTimeline(context, day, records) {
  const { state } = context;
  records = records || activeRecordState(state);
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

export function renderToday(context) {
  const { state, todayLabel } = context;
  const day = dateKey();
  const records = activeRecordState(state);
  const activeProfile = getActiveProfile(state);
  if (todayLabel) todayLabel.textContent = `今天 · ${day}`;
  return `
    <section class="panel profile-banner">
      <span class="hint">当前档案</span>
      <strong class="profile-name">${escapeHtml(activeProfile.name)}</strong>
    </section>
  ` + renderSummary(context, day, records) + renderStructure(context, day, records) + renderQuickAdd(context) + renderTimeline(context, day, records);
}
