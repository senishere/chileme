import {
  ICON_OPTIONS,
  defaultIconForCategory,
  filterFoods,
  findFood
} from "../domain.js";
import {
  escapeAttr,
  escapeHtml
} from "../ui/format.js";
import { renderCategoryChips } from "./today.js";

function iconPicker(action, activeIcon) {
  return `
    <div class="icon-picker" role="listbox" aria-label="图标">
      ${Object.values(ICON_OPTIONS).flat().map((option) => `<button class="${option === activeIcon ? "active" : ""}" type="button" data-action="${escapeAttr(action)}" data-icon="${escapeAttr(option)}">${escapeHtml(option)}</button>`).join("")}
    </div>
  `;
}

function foodCategories(state) {
  return ["all", "favorite", ...state.categories.map((category) => category.name)];
}

function activeFoodCategory(context) {
  const { state } = context;
  const category = context.foodLibraryCategory;
  const categories = foodCategories(state);
  if (categories.includes(category)) return category;
  context.setFoodLibraryCategory("all");
  return "all";
}

function categoryIcon(state, categoryName, fallbackIcon = "") {
  const category = state.categories.find((item) => item.name === categoryName);
  return defaultIconForCategory(categoryName, fallbackIcon || category?.icon);
}

export function renderFoodRows(context) {
  const { state, foodSearchQuery } = context;
  const category = activeFoodCategory(context);
  const foods = filterFoods(state.foods, {
    category,
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

export function renderFoods(context) {
  const { state, foodSearchQuery } = context;
  const categories = foodCategories(state);
  const activeCategory = activeFoodCategory(context);

  return `
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
      ${renderCategoryChips(categories, activeCategory, "set-food-category")}
      <div id="food-results">${renderFoodRows({ ...context, foodLibraryCategory: activeCategory })}</div>
    </section>
  `;
}

export function openFoodForm(context, foodId = "") {
  const { state, modalRoot } = context;
  const existingFood = findFood(state, foodId);
  const title = existingFood ? "编辑食物" : "新增食物";
  const nutrition = existingFood?.nutritionPer100g || {};
  const category = existingFood?.category || state.categories[0]?.name || "其他";
  const icon = categoryIcon(state, category, existingFood?.icon);

  modalRoot.hidden = false;
  modalRoot.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
      <div class="section-head">
        <h2>${escapeHtml(title)}</h2>
        <button class="icon-button" type="button" data-action="close-modal">×</button>
      </div>
      <form class="form-grid" data-action="save-food">
        <input type="hidden" name="foodId" value="${escapeAttr(existingFood?.id || "")}">
        <label class="field"><span>名称</span><input name="name" required placeholder="例如 牛奶" value="${escapeAttr(existingFood?.name || "")}"></label>
        <label class="field"><span>图标</span><input name="icon" inputmode="text" placeholder="例如 🧅" value="${escapeAttr(icon)}"></label>
        <label class="field"><span>分类</span><select name="category">${state.categories.map((item) => `<option value="${escapeAttr(item.name)}" ${item.name === category ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
        ${iconPicker("select-food-icon", icon)}
        <label class="field"><span>每 100g 热量</span><span class="split-input"><input name="energy" inputmode="decimal" value="${escapeAttr(existingFood ? (nutrition.calories ?? "") : "")}"><select name="energyUnit"><option value="kcal" selected>kcal</option><option value="kJ">kJ</option></select></span></label>
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

export function openCategoryManager(context) {
  const { state, modalRoot } = context;
  const icon = ICON_OPTIONS["其他"]?.[0] || "🍽️";

  modalRoot.hidden = false;
  modalRoot.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="管理分类">
      <div class="section-head">
        <h2>管理分类</h2>
        <button class="icon-button" type="button" data-action="close-modal">×</button>
      </div>
      <form class="category-add" data-action="add-category">
        <label class="field"><span>新分类</span><input name="categoryName" required placeholder="例如 备餐"></label>
        <label class="field"><span>图标</span><input name="icon" inputmode="text" placeholder="例如 🧅" value="${escapeAttr(icon)}"></label>
        ${iconPicker("select-category-icon", icon)}
        <button class="button" type="submit">添加</button>
      </form>
      <div class="category-list">
        ${state.categories.map((category) => `
          <article class="category-row">
            <span><strong>${escapeHtml(category.icon || "🍽️")}</strong> ${escapeHtml(category.name)}</span>
            <div class="food-actions">
              <button class="button secondary compact" type="button" data-action="edit-category-icon" data-category="${escapeAttr(category.name)}" data-icon="${escapeAttr(category.icon || "🍽️")}">改图标</button>
              <button class="button secondary compact" type="button" data-action="rename-category" data-category="${escapeAttr(category.name)}">重命名</button>
              <button class="icon-button" type="button" aria-label="删除分类" data-action="delete-category" data-category="${escapeAttr(category.name)}">×</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}
