import {
  addCategory,
  addLocalProfile,
  activeRecordState,
  buildEntryItem,
  createId,
  dateKey,
  defaultIconForCategory,
  deleteCategory,
  deleteLocalProfile,
  exportLogRows,
  exportRowsAsCsv,
  findFood,
  getActiveProfile,
  lastItemAmount,
  nonNegativeFiniteNumber,
  positiveFiniteNumber,
  recentMeals,
  renameCategory,
  renameLocalProfile,
  repeatEntryItems,
  setActiveProfile,
  setCategoryIcon,
  updateActiveProfile
} from "./domain.js";
import {
  createStore,
  exportState,
  importState
} from "./store.js";
import {
  escapeAttr,
  escapeHtml,
  caloriesFromEnergyInput,
  formatNumber,
  itemAmountLabel
} from "./ui/format.js";
import { readImage } from "./ui/image.js";
import { renderToday, isWaterFood, foodLabel } from "./views/today.js";
import { openCategoryManager, openFoodForm, renderFoodRows, renderFoods } from "./views/foods.js";
import { renderStats } from "./views/stats.js";
import { renderSettings } from "./views/settings.js";

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

function viewContext() {
  return {
    state,
    currentView,
    selectedFoodId,
    entryDraft,
    quickCategory,
    foodLibraryCategory,
    foodSearchQuery,
    statsDays,
    root,
    modalRoot,
    todayLabel,
    setQuickCategory: (value) => {
      quickCategory = value;
    },
    setFoodLibraryCategory: (value) => {
      foodLibraryCategory = value;
    }
  };
}

function categoryIcon(categoryName, fallbackIcon = "") {
  const category = state.categories.find((item) => item.name === categoryName);
  return defaultIconForCategory(categoryName, fallbackIcon || category?.icon);
}

function render() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === currentView);
  });

  const context = viewContext();
  if (currentView === "foods") root.innerHTML = renderFoods(context);
  else if (currentView === "stats") root.innerHTML = renderStats(context);
  else if (currentView === "settings") root.innerHTML = renderSettings(context);
  else root.innerHTML = renderToday(context);
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

function defaultAmount(foodId) {
  return lastItemAmount(state, foodId) || { amount: 100, unit: "g" };
}

function addRepeatedEntry(items) {
  const repeated = repeatEntryItems(state, items);
  if (!repeated.length) return;
  state = updateActiveProfile(state, (profile) => ({
    ...profile,
    entries: [
      ...profile.entries,
      { id: createId("entry"), timestamp: new Date().toISOString(), items: repeated, note: "", photo: "" }
    ]
  }));
  currentView = "today";
  saveAndRender();
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
  const { amount, unit } = defaultAmount(selectedFoodId);
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
        <label class="field"><span>数量</span><input name="amount" inputmode="decimal" value="${escapeAttr(amount)}"></label>
        <label class="field"><span>单位</span><select name="unit"><option value="g" ${unit === "g" ? "selected" : ""}>g</option><option value="ml" ${unit === "ml" ? "selected" : ""}>ml</option></select></label>
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
    icon: categoryIcon(category, icon || existingFood?.icon),
    image: image.dataUrl || existingFood?.image || "",
    nutritionPer100g: {
      calories: caloriesFromEnergyInput(data.get("energy"), data.get("energyUnit")),
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
  if (action === "repeat-entry") {
    const entry = activeRecordState(state).entries.find((item) => item.id === target.dataset.entryId);
    if (entry) addRepeatedEntry(entry.items);
  }
  if (action === "repeat-meal") {
    const meal = recentMeals(state).find((item) => item.key === target.dataset.mealKey);
    if (meal) addRepeatedEntry(meal.items);
  }
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
  if (action === "open-food-form") openFoodForm(viewContext());
  if (action === "edit-food") openFoodForm(viewContext(), target.dataset.foodId || "");
  if (action === "open-category-manager") openCategoryManager(viewContext());
  if (action === "rename-category") {
    const oldName = target.dataset.category || "";
    const nextName = prompt("新的分类名称", oldName);
    if (nextName !== null) {
      try {
        state = renameCategory(state, oldName, nextName);
        saveAndRender();
        openCategoryManager(viewContext());
      } catch (error) {
        alert(error.message || "分类更新失败");
      }
    }
  }
  if (action === "edit-category-icon") {
    const nextIcon = prompt("新的分类图标", target.dataset.icon || "🍽️");
    if (nextIcon !== null) {
      try {
        state = setCategoryIcon(state, target.dataset.category || "", nextIcon);
        saveAndRender();
        openCategoryManager(viewContext());
      } catch (error) {
        alert(error.message || "分类图标更新失败");
      }
    }
  }
  if (action === "delete-category" && confirm("删除分类？该分类下的食物会移到其他。")) {
    try {
      state = deleteCategory(state, target.dataset.category || "");
      saveAndRender();
      openCategoryManager(viewContext());
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
  if (results) results.innerHTML = renderFoodRows(viewContext());
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
  const icon = categoryIcon(select.value);
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
      openCategoryManager(viewContext());
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
  if (select.name === "foodId") {
    selectedFoodId = select.value;
    const { amount, unit } = defaultAmount(selectedFoodId);
    if (form?.elements.amount) form.elements.amount.value = amount;
    if (form?.elements.unit) form.elements.unit.value = unit;
  }
});

registerServiceWorker();
render();
