# Unit Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace portion-template and packaging-mode UX with a simple `g/ml` recording model, user-managed food categories, icon selection, cleaner trend stats, and simplified settings.

**Architecture:** Keep the static PWA and existing file boundaries. `src/domain.js` owns the new food/category data model, nutrition math, migration helpers, trend summaries, and status thresholds. `src/store.js` normalizes legacy localStorage into the new model. `src/app.js` renders the simplified flows and consumes domain helpers.

**Tech Stack:** Vanilla JavaScript ES modules, browser `localStorage`, Node `node:test`, static HTML/CSS PWA.

---

## File Structure

- Modify `src/domain.js`: introduce `DEFAULT_CATEGORIES`, `ICON_OPTIONS`, `nutritionPer100g`, `calculateItemNutrition(food, amount, unit)`, category helpers, trend helpers, and simplified default foods.
- Modify `src/store.js`: normalize legacy food/category/entry state into the simplified model; drop persisted portions and calibration fields.
- Modify `src/app.js`: simplify recording modal, food page, category management, icon picker, stats tabs, settings page, and navigation label.
- Modify `src/styles.css`: add category manager, icon picker, improved trend cards, and progress status styles.
- Modify `index.html`: rename bottom nav label from `食物库` to `食物`.
- Modify `README.md` and `docs/CURRENT.md`: update durable user-facing scope and current context.
- Modify `tests/domain.test.mjs`: replace portion/package tests with new nutrition, category, status, and trend tests.
- Modify `tests/store.test.mjs`: replace portion/calibration migration tests with simplified model migration tests.
- Modify `tests/pwa.test.mjs`: update static UI-contract tests for removed fields and renamed navigation.

## Task 1: Domain Model And Nutrition Math

**Files:**
- Modify: `src/domain.js`
- Test: `tests/domain.test.mjs`

- [ ] **Step 1: Replace old nutrition tests with simplified model tests**

In `tests/domain.test.mjs`, remove tests that require `per100ml`, `perServing`, `perPackage`, `findPortion`, `portionsForFood`, or `buildEntryItem(food, portion)`. Add these tests:

```js
test("calculates per-100g nutrition from grams", () => {
  const food = {
    id: "food_rice",
    nutritionPer100g: { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3, sodium: 1 }
  };

  assert.deepEqual(calculateItemNutrition(food, 150, "g"), {
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45,
    sodium: 1.5
  });
});

test("treats ml as grams for rough drink logging", () => {
  const food = {
    id: "food_milk",
    nutritionPer100g: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sodium: 42 }
  };

  assert.deepEqual(calculateItemNutrition(food, 250, "ml"), {
    calories: 152.5,
    protein: 8,
    carbs: 12,
    fat: 8.25,
    sodium: 105
  });
});

test("builds entry items without portion templates", () => {
  const state = createDefaultState();
  const food = findFood(state, "food_rice");

  assert.deepEqual(buildEntryItem(food, 150, "g"), {
    foodId: "food_rice",
    amount: 150,
    unit: "g",
    grams: 150,
    nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
  });
});

test("default foods use simplified categories and icon fields", () => {
  const state = createDefaultState();

  assert.equal(Array.isArray(state.portions), false);
  assert.ok(state.categories.find((category) => category.name === "细粮"));
  assert.ok(state.categories.find((category) => category.name === "零食"));
  assert.equal(findFood(state, "food_rice").category, "细粮");
  assert.equal(typeof findFood(state, "food_rice").icon, "string");
  assert.equal(typeof findFood(state, "food_rice").nutritionPer100g.calories, "number");
});
```

- [ ] **Step 2: Run the domain tests to verify they fail**

Run:

```bash
node --test tests/domain.test.mjs
```

Expected: FAIL because `nutritionPer100g` helpers and the new `buildEntryItem(food, amount, unit)` signature do not exist yet, and old default state still includes `portions`.

- [ ] **Step 3: Implement the simplified nutrition model**

In `src/domain.js`, replace `EMPTY_NUTRITION` users and food helpers with:

```js
export const EMPTY_NUTRITION = Object.freeze({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sodium: 0
});

export const ICON_OPTIONS = Object.freeze({
  "细粮": ["🍚", "🍜", "🍞"],
  "粗粮": ["🌾", "🍠", "🌽", "🥔"],
  "动物蛋白": ["🥩", "🍗", "🐟", "🥚", "🦐"],
  "植物蛋白": ["🫘", "⬜", "🥜"],
  "蔬菜": ["🥬", "🥦", "🍅", "🥒", "🥕", "🍄"],
  "水果": ["🍎", "🍌", "🍊", "🍓", "🍇", "🫐"],
  "奶": ["🥛", "🧀", "🍦"],
  "饮料": ["🥤", "☕", "🧃"],
  "坚果": ["🥜", "🌰"],
  "零食": ["🍪", "🍫", "🍟"],
  "餐食": ["🍱", "🥗", "🍛", "🥟", "🍣"],
  "其他": ["🍽️"]
});

export const DEFAULT_CATEGORIES = Object.freeze(
  Object.entries(ICON_OPTIONS).map(([name, icons]) => ({
    id: `category_${name}`,
    name,
    icon: icons[0]
  }))
);

function food(id, name, category, icon, nutritionPer100g, quickAdd = true) {
  return {
    id,
    name,
    category,
    icon,
    image: "",
    nutritionPer100g: { ...EMPTY_NUTRITION, ...nutritionPer100g },
    quickAdd
  };
}
```

Keep the existing seeded food list, but update every food call to the new signature. Map old categories as:

```js
const CATEGORY_MAP = {
  "主食": "细粮",
  "蛋白质": "动物蛋白",
  "奶/饮品": "奶",
  "包装/高钠": "零食",
  "调味": "其他",
  "轻食": "餐食",
  "中式": "餐食",
  "蔬果": "水果"
};
```

For soy milk, tofu, edamame, and similar soy/bean items, use `植物蛋白`. For coffee, cola, juice, and protein drinks, use `饮料`. For almonds, walnuts, and mixed nuts, use `坚果`.

- [ ] **Step 4: Replace amount and entry helpers**

In `src/domain.js`, replace `amountToGrams`, `calculateItemNutrition`, and `buildEntryItem` with:

```js
export function amountToGrams(amount, unit = "g") {
  const safeAmount = positiveFiniteNumber(amount, 0);
  return unit === "ml" ? safeAmount : safeAmount;
}

export function calculateItemNutrition(food, amount, unit = "g") {
  const grams = amountToGrams(amount, unit);
  const nutrition = food?.nutritionPer100g || food?.nutrition || EMPTY_NUTRITION;
  const ratio = grams / 100;

  return {
    calories: roundMetric((nutrition.calories || 0) * ratio),
    protein: roundMetric((nutrition.protein || 0) * ratio),
    carbs: roundMetric((nutrition.carbs || 0) * ratio),
    fat: roundMetric((nutrition.fat || 0) * ratio),
    sodium: roundMetric((nutrition.sodium || 0) * ratio)
  };
}

export function buildEntryItem(food, amountValue, unitValue = "g") {
  const unit = unitValue === "ml" ? "ml" : "g";
  const amount = positiveFiniteNumber(amountValue, 100);
  return {
    foodId: food.id,
    amount,
    unit,
    grams: amountToGrams(amount, unit),
    nutrition: calculateItemNutrition(food, amount, unit)
  };
}
```

Remove `findPortion` and `portionsForFood` exports after all call sites are updated in later tasks.

- [ ] **Step 5: Run domain tests to verify Task 1 passes**

Run:

```bash
node --test tests/domain.test.mjs
```

Expected: PASS for the rewritten simplified domain tests. It is acceptable for store/UI tests to fail until later tasks update them.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/domain.js tests/domain.test.mjs
git commit -m "refactor: simplify nutrition domain"
```

## Task 2: Category Helpers, Status Thresholds, And Trends

**Files:**
- Modify: `src/domain.js`
- Test: `tests/domain.test.mjs`

- [ ] **Step 1: Add failing category-management tests**

Append these tests to `tests/domain.test.mjs`:

```js
test("renames categories and updates foods", () => {
  const state = createDefaultState();
  const next = renameCategory(state, "细粮", "精制主食");

  assert.ok(next.categories.find((category) => category.name === "精制主食"));
  assert.equal(findFood(next, "food_rice").category, "精制主食");
});

test("deletes categories by moving foods to other", () => {
  const state = createDefaultState();
  const next = deleteCategory(state, "细粮");

  assert.equal(next.categories.some((category) => category.name === "细粮"), false);
  assert.equal(findFood(next, "food_rice").category, "其他");
});

test("prevents deleting the other category", () => {
  const state = createDefaultState();

  assert.throws(() => deleteCategory(state, "其他"), /不能删除其他/);
});

test("classifies nutrition status by ratio without gram deltas", () => {
  assert.equal(nutritionStatus(0.35), "severe-low");
  assert.equal(nutritionStatus(0.6), "low");
  assert.equal(nutritionStatus(0.9), "normal");
  assert.equal(nutritionStatus(1.1), "high");
  assert.equal(nutritionStatus(1.25), "over");
  assert.equal(limitStatus(0.5), "normal");
  assert.equal(limitStatus(1.1), "high");
  assert.equal(limitStatus(1.25), "over");
});

test("builds trend stats for seven and thirty days", () => {
  const state = createDefaultState();
  state.entries = [{
    id: "entry_a",
    timestamp: "2026-05-18T12:00:00",
    items: [{
      foodId: "food_rice",
      amount: 150,
      unit: "g",
      nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
    }],
    note: "",
    photo: ""
  }];

  assert.equal(trendStats(state, "2026-05-18", 7).length, 7);
  assert.equal(trendStats(state, "2026-05-18", 30).length, 30);
  assert.equal(trendStats(state, "2026-05-18", 7)[6].calories, 174);
});
```

Update the import list with `renameCategory`, `deleteCategory`, `nutritionStatus`, `limitStatus`, and `trendStats`.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/domain.test.mjs
```

Expected: FAIL because new category and status helpers are missing.

- [ ] **Step 3: Implement category and status helpers**

Add to `src/domain.js`:

```js
export function cloneState(state) {
  return typeof structuredClone === "function"
    ? structuredClone(state)
    : JSON.parse(JSON.stringify(state));
}

export function addCategory(state, name, icon = "🍽️") {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("分类名称不能为空");
  if ((state.categories || []).some((category) => category.name === trimmed)) {
    throw new Error("分类名称不能重复");
  }
  const next = cloneState(state);
  next.categories.push({ id: createId("category"), name: trimmed, icon });
  return next;
}

export function renameCategory(state, oldName, newName) {
  const trimmed = String(newName || "").trim();
  if (!trimmed) throw new Error("分类名称不能为空");
  if ((state.categories || []).some((category) => category.name === trimmed)) {
    throw new Error("分类名称不能重复");
  }
  const next = cloneState(state);
  const category = next.categories.find((item) => item.name === oldName);
  if (!category) throw new Error("分类不存在");
  category.name = trimmed;
  next.foods = next.foods.map((foodItem) => (
    foodItem.category === oldName ? { ...foodItem, category: trimmed } : foodItem
  ));
  return next;
}

export function deleteCategory(state, name) {
  if (name === "其他") throw new Error("不能删除其他分类");
  const next = cloneState(state);
  next.categories = next.categories.filter((category) => category.name !== name);
  next.foods = next.foods.map((foodItem) => (
    foodItem.category === name ? { ...foodItem, category: "其他" } : foodItem
  ));
  return next;
}

export function nutritionStatus(ratio) {
  const safeRatio = nonNegativeFiniteNumber(ratio, 0);
  if (safeRatio < 0.4) return "severe-low";
  if (safeRatio < 0.75) return "low";
  if (safeRatio <= 1.05) return "normal";
  if (safeRatio <= 1.2) return "high";
  return "over";
}

export function limitStatus(ratio) {
  const safeRatio = nonNegativeFiniteNumber(ratio, 0);
  if (safeRatio <= 1) return "normal";
  if (safeRatio <= 1.2) return "high";
  return "over";
}
```

- [ ] **Step 4: Update structure and trend helpers**

Replace existing status logic in `dailyStructure` so normal nutrients use `nutritionStatus(metric.ratio)` and sodium uses `limitStatus(metric.ratio)`.

Add:

```js
export function trendStats(state, endDayKey = dateKey(), days = 7) {
  const safeDays = Number(days) === 30 ? 30 : 7;
  return Array.from({ length: safeDays }, (_, index) => {
    const date = addDays(endDayKey, index - safeDays + 1);
    return { date, ...summarizeDay(state, date) };
  });
}
```

Keep `sevenDayStats` as a wrapper for compatibility:

```js
export function sevenDayStats(state, endDayKey = dateKey()) {
  return trendStats(state, endDayKey, 7);
}
```

- [ ] **Step 5: Run domain tests**

Run:

```bash
node --test tests/domain.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/domain.js tests/domain.test.mjs
git commit -m "feat: add simplified category and trend helpers"
```

## Task 3: Store Normalization And Legacy Migration

**Files:**
- Modify: `src/store.js`
- Test: `tests/store.test.mjs`

- [ ] **Step 1: Replace store tests for legacy migration**

In `tests/store.test.mjs`, remove tests that assert `portions`, `servingGrams`, `packageGrams`, `densityGPerMl`, `calibration.containers`, `fistWidthCm`, `palmWidthCm`, or `fingerWidthCm` are preserved. Add:

```js
test("normalizes legacy foods into simplified per-100g foods", () => {
  const normalized = normalizeState({
    foods: [{
      id: " custom_food ",
      name: " 自定义鸡肉 ",
      category: " 蛋白质 ",
      kind: "packaged",
      emoji: "🍱",
      nutritionMode: "perServing",
      servingGrams: 100,
      nutrition: { calories: 180, protein: 24, carbs: 3, fat: 6, sodium: 300 },
      defaultPortionId: "old_portion",
      quickAdd: false
    }],
    portions: [{ id: "old_portion", foodId: "custom_food", label: "旧份量", grams: 125 }]
  });

  assert.deepEqual(normalized.foods[0], {
    id: "custom_food",
    name: "自定义鸡肉",
    category: "动物蛋白",
    icon: "🍱",
    image: "",
    nutritionPer100g: { calories: 180, protein: 24, carbs: 3, fat: 6, sodium: 300 },
    quickAdd: false
  });
  assert.equal("portions" in normalized, false);
});

test("normalizes categories and moves unknown food categories to other", () => {
  const normalized = normalizeState({
    categories: [{ id: "category_custom", name: "自定义", icon: "⭐" }],
    foods: [{
      id: "food_custom",
      name: "奇怪食物",
      category: "不存在",
      nutrition: { calories: 1, protein: 1, carbs: 1, fat: 1, sodium: 1 }
    }]
  });

  assert.ok(normalized.categories.find((category) => category.name === "自定义"));
  assert.equal(normalized.foods.find((food) => food.id === "food_custom").category, "其他");
});

test("drops old calibration units while preserving profile and goals", () => {
  const normalized = normalizeState({
    calibration: {
      fistWidthCm: 10,
      palmWidthCm: 10,
      fingerWidthCm: 2,
      containers: [{ id: "bowl", label: "碗", capacityMl: 350 }]
    },
    profile: { sex: "male", age: 42, heightCm: 178, weightKg: 76, activityLevel: "moderate", goal: "gain" },
    dailyGoal: { calories: 2200, protein: 120, waterMl: 2300 }
  });

  assert.equal("calibration" in normalized, false);
  assert.equal(normalized.profile.sex, "male");
  assert.equal(normalized.dailyGoal.calories, 2200);
});
```

- [ ] **Step 2: Run store tests to verify failure**

Run:

```bash
node --test tests/store.test.mjs
```

Expected: FAIL because `normalizeState` still returns `portions` and `calibration`.

- [ ] **Step 3: Implement simplified category normalization**

In `src/store.js`, import `DEFAULT_CATEGORIES` and `ICON_OPTIONS`:

```js
import {
  DEFAULT_CATEGORIES,
  EMPTY_NUTRITION,
  ICON_OPTIONS,
  createDefaultState,
  nonNegativeFiniteNumber,
  positiveFiniteNumber
} from "./domain.js";
```

Add:

```js
const LEGACY_CATEGORY_MAP = {
  "主食": "细粮",
  "蛋白质": "动物蛋白",
  "奶/饮品": "奶",
  "包装/高钠": "零食",
  "调味": "其他",
  "轻食": "餐食",
  "中式": "餐食",
  "蔬果": "水果",
  "常吃": "其他"
};

function normalizeCategoryName(value, categories) {
  const raw = typeof value === "string" ? value.trim() : "";
  const mapped = LEGACY_CATEGORY_MAP[raw] || raw;
  return categories.some((category) => category.name === mapped) ? mapped : "其他";
}

function defaultIconForCategory(category) {
  return ICON_OPTIONS[category]?.[0] || "🍽️";
}

function normalizeCategories(categories) {
  const defaults = DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  if (!Array.isArray(categories)) return defaults;

  const merged = [...defaults];
  const seen = new Set(merged.map((category) => category.name));
  for (const category of categories) {
    const name = typeof category?.name === "string" ? category.name.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    merged.push({
      id: typeof category.id === "string" && category.id.trim() ? category.id.trim() : `category_${name}`,
      name,
      icon: typeof category.icon === "string" && category.icon.trim() ? category.icon.trim() : "🍽️"
    });
  }
  return merged;
}
```

- [ ] **Step 4: Implement simplified food and entry normalization**

Replace `normalizeFoods` so it returns new food objects:

```js
function normalizeFoods(foods, defaults, categories) {
  if (!Array.isArray(foods)) return defaults.foods;

  const validFoods = foods.flatMap((food) => {
    if (!food || typeof food !== "object") return [];
    const id = typeof food.id === "string" ? food.id.trim() : "";
    const name = typeof food.name === "string" ? food.name.trim() : "";
    const nutrition = food.nutritionPer100g || food.nutrition;
    if (!id || !name || !isValidNutrition(nutrition)) return [];
    const category = normalizeCategoryName(food.category, categories);

    return [{
      id,
      name,
      category,
      icon: typeof food.icon === "string" && food.icon.trim()
        ? food.icon.trim()
        : typeof food.emoji === "string" && food.emoji.trim()
          ? food.emoji.trim()
          : defaultIconForCategory(category),
      image: normalizeDataUrl(food.image),
      nutritionPer100g: normalizeNutrition(nutrition),
      quickAdd: food.quickAdd === false ? false : true
    }];
  });

  return validFoods.length > 0 ? mergeById(validFoods, defaults.foods) : defaults.foods;
}
```

Replace entry item normalization so it drops `portionId` and `label`:

```js
function normalizeEntryItems(items) {
  if (!Array.isArray(items)) return null;

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const foodId = typeof item.foodId === "string" ? item.foodId.trim() : "";
    const unit = item.unit === "ml" ? "ml" : "g";
    const amount = positiveFiniteNumber(item.amount, positiveFiniteNumber(item.grams, NaN));
    const grams = amount;
    if (!foodId || !Number.isFinite(amount)) return [];

    return [{
      foodId,
      amount,
      unit,
      grams,
      nutrition: normalizeNutrition(item.nutrition)
    }];
  });
}
```

- [ ] **Step 5: Update normalizeState shape**

Replace `normalizeState` return value with:

```js
export function normalizeState(input) {
  const defaults = createDefaultState();
  const state = input && typeof input === "object" ? input : {};
  const categories = normalizeCategories(state.categories);

  return {
    categories,
    foods: normalizeFoods(state.foods, defaults, categories),
    entries: normalizeEntries(state.entries),
    waterEntries: normalizeWaterEntries(state.waterEntries),
    profile: normalizeProfile(state.profile, defaults),
    dailyGoal: normalizeDailyGoal(state.dailyGoal, defaults)
  };
}
```

Remove `normalizePortions`, `normalizeCalibration`, and `normalizeContainers` after tests and app code no longer reference them.

- [ ] **Step 6: Run store tests**

Run:

```bash
node --test tests/store.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/store.js tests/store.test.mjs
git commit -m "refactor: migrate storage to simplified food model"
```

## Task 4: Recording Flow And Food Page UI

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Test: `tests/pwa.test.mjs`

- [ ] **Step 1: Add failing static UI contract tests**

In `tests/pwa.test.mjs`, replace the old food editing test with:

```js
test("app uses simplified recording and food editing UI", () => {
  const app = readText("../src/app.js");
  const html = readText("../index.html");

  assert.match(html, />食物</);
  assert.doesNotMatch(html, /食物库/);
  assert.match(app, /name="amount"/);
  assert.match(app, /name="unit"/);
  assert.match(app, /nutritionPer100g/);
  assert.match(app, /data-action="open-category-manager"/);
  assert.match(app, /data-action="select-food-icon"/);
  assert.doesNotMatch(app, /name="portionId"/);
  assert.doesNotMatch(app, /默认份量/);
  assert.doesNotMatch(app, /营养标注方式/);
  assert.doesNotMatch(app, /每份重量/);
  assert.doesNotMatch(app, /整包重量/);
  assert.doesNotMatch(app, /液体密度/);
});

test("today timeline does not display sodium in entry rows", () => {
  const app = readText("../src/app.js");
  const timelineSection = app.slice(app.indexOf("function renderTimeline"), app.indexOf("function renderToday"));

  assert.doesNotMatch(timelineSection, /钠/);
  assert.doesNotMatch(timelineSection, /sodium/);
});
```

- [ ] **Step 2: Run static UI tests to verify failure**

Run:

```bash
node --test tests/pwa.test.mjs
```

Expected: FAIL because old labels and fields still exist.

- [ ] **Step 3: Update imports and label helpers in app**

In `src/app.js`, remove imports of `amountToGrams`, `findPortion`, and `portionsForFood`. Add imports for category helpers and icon options:

```js
import {
  ICON_OPTIONS,
  addCategory,
  buildEntryItem,
  createId,
  dateKey,
  dailyStructure,
  deleteCategory,
  exportLogRows,
  exportRowsAsCsv,
  filterFoods,
  findFood,
  listFoodCategories,
  nonNegativeFiniteNumber,
  positiveFiniteNumber,
  renameCategory,
  trendStats,
  summarizeDay
} from "./domain.js";
```

Replace `quickThumbHtml(food)` so it uses `food.icon`:

```js
function quickThumbHtml(food) {
  if (food.image) return `<span class="food-thumb"><img alt="" src="${escapeAttr(food.image)}"></span>`;
  return `<span class="food-thumb">${escapeHtml(food.icon || "🍽️")}</span>`;
}
```

- [ ] **Step 4: Simplify quick add and timeline rendering**

In `renderQuickAdd`, remove default portion display and show category:

```js
const cards = quickFoods.map((food) => `
  <button class="quick-card" type="button" data-action="open-entry" data-food-id="${escapeAttr(food.id)}">
    ${quickThumbHtml(food)}
    <span class="quick-name">${escapeHtml(food.name)}</span>
    <span class="quick-portion">${escapeHtml(food.category)}</span>
  </button>
`).join("");
```

In `renderTimeline`, replace entry meta with:

```js
const portions = entry.items.map((item) => itemAmountLabel(item)).join(" + ");
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
```

- [ ] **Step 5: Replace entry modal with amount and unit only**

Replace `createDraftItem` with:

```js
function createDraftItem(foodId, amountValue = "", unitValue = "g") {
  const food = findFood(state, foodId);
  if (!food) return null;
  return buildEntryItem(food, amountValue || 100, unitValue);
}
```

Replace the food/portion fields in `renderEntryModal` with:

```js
<label class="field">
  <span>食物</span>
  <select name="foodId">
    ${state.foods.map((item) => `<option value="${escapeAttr(item.id)}" ${item.id === selectedFoodId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
  </select>
</label>
<label class="field"><span>数量</span><input name="amount" inputmode="decimal" value="100"></label>
<label class="field">
  <span>单位</span>
  <select name="unit">
    <option value="g">g</option>
    <option value="ml">ml</option>
  </select>
</label>
```

Update `add-draft-item` and `handleEntrySubmit` to read `amount` and `unit`:

```js
const item = createDraftItem(
  String(data.get("foodId")),
  data.get("amount"),
  String(data.get("unit") || "g")
);
```

Remove the `modalRoot.addEventListener("change", ...)` block that updates portions.

- [ ] **Step 6: Simplify food rows and food editor**

In `renderFoodRows`, replace row summary with:

```js
<div><strong>${escapeHtml(food.icon || "🍽️")} ${escapeHtml(food.name)}</strong><br><span class="hint">${escapeHtml(food.category)} · 每100g ${formatNumber(food.nutritionPer100g?.calories || 0)} kcal</span></div>
```

In `openFoodForm(foodId = "")`, remove `kind`, `nutritionMode`, `portionId`, `portionLabel`, `amount`, `unit`, `densityGPerMl`, `servingGrams`, and `packageGrams` fields. Add category and icon fields:

```js
<label class="field"><span>分类</span><select name="category">${state.categories.map((category) => `<option value="${escapeAttr(category.name)}" ${category.name === (existingFood?.category || "其他") ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</select></label>
<input type="hidden" name="icon" value="${escapeAttr(existingFood?.icon || "🍽️")}">
<div class="icon-grid" aria-label="选择图标">
  ${Object.values(ICON_OPTIONS).flat().map((icon) => `<button class="icon-choice ${icon === (existingFood?.icon || "🍽️") ? "active" : ""}" type="button" data-action="select-food-icon" data-icon="${escapeAttr(icon)}">${escapeHtml(icon)}</button>`).join("")}
</div>
```

Update nutrition fields to use `existingFood?.nutritionPer100g`.

- [ ] **Step 7: Update food submit handler**

Replace `handleFoodSubmit` food creation with:

```js
const food = {
  id: foodId,
  name: String(data.get("name") || "未命名"),
  category: String(data.get("category") || "其他"),
  icon: String(data.get("icon") || "🍽️"),
  image: image.dataUrl || existingFood?.image || "",
  nutritionPer100g: {
    calories: nonNegativeFiniteNumber(data.get("calories"), 0),
    protein: nonNegativeFiniteNumber(data.get("protein"), 0),
    carbs: nonNegativeFiniteNumber(data.get("carbs"), 0),
    fat: nonNegativeFiniteNumber(data.get("fat"), 0),
    sodium: nonNegativeFiniteNumber(data.get("sodium"), 0)
  },
  quickAdd: existingFood?.quickAdd === false ? false : true
};
```

Remove all portion creation and `state.portions` updates.

Add click handling for icon selection:

```js
if (action === "select-food-icon") {
  const form = target.closest("form");
  form.elements.icon.value = target.dataset.icon || "🍽️";
  form.querySelectorAll(".icon-choice").forEach((button) => {
    button.classList.toggle("active", button === target);
  });
}
```

- [ ] **Step 8: Add category manager UI**

Add a `renderCategoryManager()` function in `src/app.js`:

```js
function renderCategoryManager() {
  modalRoot.hidden = false;
  modalRoot.innerHTML = `
    <section class="sheet" role="dialog" aria-modal="true" aria-label="分类管理">
      <div class="section-head">
        <h2>分类管理</h2>
        <button class="icon-button" type="button" data-action="close-modal">×</button>
      </div>
      <form class="form-grid" data-action="add-category">
        <label class="field"><span>新增分类</span><input name="name" placeholder="例如 早餐"></label>
        <button class="button" type="submit">添加分类</button>
      </form>
      <div class="category-list">
        ${state.categories.map((category) => `
          <article class="food-row">
            <div><strong>${escapeHtml(category.icon)} ${escapeHtml(category.name)}</strong></div>
            <div class="food-actions">
              <button class="button secondary compact" type="button" data-action="rename-category" data-category="${escapeAttr(category.name)}">重命名</button>
              <button class="button secondary compact" type="button" data-action="delete-category" data-category="${escapeAttr(category.name)}">删除</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}
```

In `renderFoods`, add:

```js
<button class="button secondary" type="button" data-action="open-category-manager">分类</button>
```

Add click handlers for `open-category-manager`, `rename-category`, and `delete-category`. Use `prompt()` for rename in this iteration:

```js
if (action === "open-category-manager") renderCategoryManager();
if (action === "rename-category") {
  const name = prompt("新的分类名称", target.dataset.category || "");
  if (name) {
    try {
      state = renameCategory(state, target.dataset.category || "", name);
      saveAndRender();
      renderCategoryManager();
    } catch (error) {
      alert(error.message);
    }
  }
}
if (action === "delete-category" && confirm("删除分类？该分类下食物会移动到其他。")) {
  try {
    state = deleteCategory(state, target.dataset.category || "");
    saveAndRender();
    renderCategoryManager();
  } catch (error) {
    alert(error.message);
  }
}
```

Add submit handling for `add-category`:

```js
if (action === "add-category") {
  const data = new FormData(form);
  try {
    state = addCategory(state, data.get("name"), "🍽️");
    saveAndRender();
    renderCategoryManager();
  } catch (error) {
    alert(error.message);
  }
}
```

- [ ] **Step 9: Update CSS for icons and category controls**

Add to `src/styles.css`:

```css
.icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.icon-choice {
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 22px;
}

.icon-choice.active {
  border-color: var(--primary);
  background: var(--surface-soft);
  box-shadow: inset 0 0 0 2px var(--primary);
}

.category-list {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}
```

- [ ] **Step 10: Run UI static tests**

Run:

```bash
node --test tests/pwa.test.mjs
```

Expected: PASS.

- [ ] **Step 11: Commit Task 4**

```bash
git add index.html src/app.js src/styles.css tests/pwa.test.mjs
git commit -m "feat: simplify recording and food editing UI"
```

## Task 5: Settings And Stats Redesign

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Test: `tests/pwa.test.mjs`

- [ ] **Step 1: Add failing static tests for settings and stats**

Append to `tests/pwa.test.mjs`:

```js
test("settings no longer exposes portion calibration fields", () => {
  const app = readText("../src/app.js");

  assert.doesNotMatch(app, /拳头宽度/);
  assert.doesNotMatch(app, /掌心宽度/);
  assert.doesNotMatch(app, /手指宽度/);
  assert.doesNotMatch(app, /常用容器/);
});

test("stats page exposes week and month trend tabs", () => {
  const app = readText("../src/app.js");

  assert.match(app, /最近一周/);
  assert.match(app, /最近一月/);
  assert.match(app, /trendStats/);
  assert.doesNotMatch(app, /day\.sodium/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
node --test tests/pwa.test.mjs
```

Expected: FAIL because settings still renders calibration fields and stats still renders dense day rows.

- [ ] **Step 3: Simplify settings page**

In `renderSettings`, remove all calibration/container code and fields. Keep:

```js
<label class="field"><span>热量目标 kcal</span><input name="calories" inputmode="numeric" value="${escapeAttr(state.dailyGoal.calories || "")}"></label>
<label class="field"><span>蛋白质目标 g</span><input name="protein" inputmode="numeric" value="${escapeAttr(state.dailyGoal.protein || "")}"></label>
<label class="field"><span>饮水目标 ml</span><input name="waterMl" inputmode="numeric" value="${escapeAttr(state.dailyGoal.waterMl || "")}"></label>
<label class="field"><span>性别</span><select name="sex"><option value="female" ${state.profile.sex === "female" ? "selected" : ""}>女</option><option value="male" ${state.profile.sex === "male" ? "selected" : ""}>男</option></select></label>
<label class="field"><span>年龄</span><input name="age" inputmode="numeric" value="${escapeAttr(state.profile.age || "")}"></label>
<label class="field"><span>身高 cm</span><input name="heightCm" inputmode="decimal" value="${escapeAttr(state.profile.heightCm || "")}"></label>
<label class="field"><span>体重 kg</span><input name="weightKg" inputmode="decimal" value="${escapeAttr(state.profile.weightKg || "")}"></label>
<label class="field"><span>活动水平</span><select name="activityLevel"><option value="sedentary" ${state.profile.activityLevel === "sedentary" ? "selected" : ""}>久坐</option><option value="light" ${state.profile.activityLevel === "light" ? "selected" : ""}>轻度</option><option value="moderate" ${state.profile.activityLevel === "moderate" ? "selected" : ""}>中等</option><option value="active" ${state.profile.activityLevel === "active" ? "selected" : ""}>较高</option></select></label>
<label class="field"><span>目标</span><select name="goal"><option value="maintain" ${state.profile.goal === "maintain" ? "selected" : ""}>维持</option><option value="lose" ${state.profile.goal === "lose" ? "selected" : ""}>减脂</option><option value="gain" ${state.profile.goal === "gain" ? "selected" : ""}>增肌</option></select></label>
```

In submit handling for `save-settings`, remove all `state.calibration` writes.

- [ ] **Step 4: Implement stats tabs and trend bars**

Add state:

```js
let statsRange = 7;
```

Replace `renderStats` with:

```js
function sparkBars(days, key) {
  const max = Math.max(1, ...days.map((day) => Number(day[key]) || 0));
  return `
    <div class="spark-bars">
      ${days.map((day) => {
        const height = Math.max(8, Math.round(((Number(day[key]) || 0) / max) * 44));
        return `<span style="height: ${height}px" title="${escapeAttr(day.date)}"></span>`;
      }).join("")}
    </div>
  `;
}

function renderStats() {
  const days = trendStats(state, dateKey(), statsRange);
  const totalEntries = days.reduce((sum, day) => sum + day.entryCount, 0);
  const totalCalories = days.reduce((sum, day) => sum + day.calories, 0);

  root.innerHTML = `
    <section class="panel">
      <div class="section-head"><h2>趋势</h2><span class="hint">最近记录</span></div>
      <div class="filter-rail">
        <button class="filter-chip ${statsRange === 7 ? "active" : ""}" type="button" data-action="set-stats-range" data-days="7">最近一周</button>
        <button class="filter-chip ${statsRange === 30 ? "active" : ""}" type="button" data-action="set-stats-range" data-days="30">最近一月</button>
      </div>
      <div class="trend-summary">
        <article><strong>${formatNumber(totalEntries)}</strong><span>条记录</span></article>
        <article><strong>${formatNumber(totalCalories)}</strong><span>kcal</span></article>
      </div>
      <article class="trend-card"><div><strong>热量趋势</strong><span class="hint">按天汇总</span></div>${sparkBars(days, "calories")}</article>
      <article class="trend-card"><div><strong>记录趋势</strong><span class="hint">每天记录次数</span></div>${sparkBars(days, "entryCount")}</article>
      <article class="trend-card"><div><strong>饮水趋势</strong><span class="hint">按天汇总</span></div>${sparkBars(days, "waterMl")}</article>
    </section>
  `;
}
```

Add click handler:

```js
if (action === "set-stats-range") {
  statsRange = Number(target.dataset.days) === 30 ? 30 : 7;
  render();
}
```

- [ ] **Step 5: Add trend CSS**

Add to `src/styles.css`:

```css
.trend-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.trend-summary article,
.trend-card {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 10px;
}

.trend-summary strong,
.trend-summary span {
  display: block;
}

.trend-card {
  display: grid;
  gap: 10px;
  margin-bottom: 8px;
}

.spark-bars {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  align-items: end;
  gap: 3px;
  height: 52px;
}

.spark-bars span {
  display: block;
  border-radius: 999px 999px 3px 3px;
  background: var(--primary);
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
node --test tests/pwa.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add src/app.js src/styles.css tests/pwa.test.mjs
git commit -m "feat: simplify settings and trend stats"
```

## Task 6: Export, Docs, And PWA Cache Version

**Files:**
- Modify: `src/domain.js`
- Modify: `sw.js`
- Modify: `README.md`
- Modify: `docs/CURRENT.md`
- Test: `tests/domain.test.mjs`
- Test: `tests/pwa.test.mjs`

- [ ] **Step 1: Update export tests for simplified rows**

In `tests/domain.test.mjs`, update CSV header expectations so exported rows still include `sodium` for CSV/JSON analysis, but the user-facing timeline does not display it:

```js
assert.equal(csv.split("\n")[0], "date,timestamp,type,food,amount,unit,calories,protein,carbs,fat,sodium,waterMl,note");
```

Update expected exported rows to remove `portion`.

- [ ] **Step 2: Update export helpers**

In `src/domain.js`, update `exportLogRows` so food rows remove `portion`:

```js
return {
  date: dateKey(entry.timestamp),
  timestamp: entry.timestamp,
  type: "food",
  food: foodItem?.name || item.foodId || "未知食物",
  amount: nonNegativeFiniteNumber(item.amount, nonNegativeFiniteNumber(item.grams, 0)),
  unit: item.unit === "ml" ? "ml" : "g",
  calories: nonNegativeFiniteNumber(item.nutrition?.calories, 0),
  protein: nonNegativeFiniteNumber(item.nutrition?.protein, 0),
  carbs: nonNegativeFiniteNumber(item.nutrition?.carbs, 0),
  fat: nonNegativeFiniteNumber(item.nutrition?.fat, 0),
  sodium: nonNegativeFiniteNumber(item.nutrition?.sodium, 0),
  waterMl: 0,
  note: entry.note || ""
};
```

Update CSV headers:

```js
const headers = [
  "date",
  "timestamp",
  "type",
  "food",
  "amount",
  "unit",
  "calories",
  "protein",
  "carbs",
  "fat",
  "sodium",
  "waterMl",
  "note"
];
```

- [ ] **Step 3: Update service worker cache version**

In `sw.js`, change:

```js
const CACHE_NAME = "chileme-app-shell-v2";
```

Update `tests/pwa.test.mjs` if it asserts the cache name version.

- [ ] **Step 4: Update README and current context**

In `README.md`, replace old scope bullets with:

```markdown
- 记录时只使用 g/ml；ml 按 1ml = 1g 粗略换算。
- 食物营养统一按每 100g 录入。
- 食物页支持搜索、分类管理、图标选择和常用标记。
- 今日结构用比例进度条显示严重不足、不足、正常范围、偏高或超量。
- 统计页按最近一周/最近一月展示趋势。
```

In `docs/CURRENT.md`, record:

```markdown
- 已完成单位简化：取消拳/碗/份量模板/包装规格，新记录统一使用 g/ml。
- 已完成食物页重命名、分类管理和图标选择。
- 已完成统计页周/月趋势改造。
```

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
TZ=America/Los_Angeles npm test
node --check src/app.js
node --check src/domain.js
node --check src/store.js
node --check sw.js
git diff --check
```

Expected:

- `npm test`: all tests pass.
- `TZ=America/Los_Angeles npm test`: all tests pass.
- `node --check ...`: no output, exit 0.
- `git diff --check`: no output, exit 0.

- [ ] **Step 6: Browser smoke test**

Run local server:

```bash
npm run serve
```

If port `4173` is occupied:

```bash
python3 -m http.server 4174
```

Open the app and verify:

- Bottom nav says `食物`, not `食物库`.
- Recording modal has food, amount, unit, note, photo; no portion selector.
- Today timeline entry does not show sodium.
- Food edit modal only has category, icon, image, and per-100g nutrition fields.
- Category manager can add, rename, and delete a category.
- Settings has no fist/palm/finger/container fields.
- Stats has `最近一周` and `最近一月` tabs and trend bars.

- [ ] **Step 7: Commit Task 6**

```bash
git add README.md docs/CURRENT.md src/domain.js sw.js tests/domain.test.mjs tests/pwa.test.mjs
git commit -m "docs: update simplified food tracking context"
```

## Final Verification

After all task commits, run:

```bash
npm test
TZ=America/Los_Angeles npm test
node --check src/app.js
node --check src/domain.js
node --check src/store.js
node --check sw.js
git diff --check
git status --short
```

Expected:

- All tests pass.
- Syntax checks pass.
- Whitespace check passes.
- `git status --short` only shows intentional local files or is clean.

## Self-Review

- Spec coverage: data model simplification is covered by Tasks 1 and 3; recording and food UI by Task 4; settings and stats by Task 5; exports/docs/PWA by Task 6.
- No placeholders: every task has concrete tests, implementation snippets, commands, and expected results.
- Type consistency: the plan consistently uses `nutritionPer100g`, `categories`, `icon`, `amount`, `unit`, and no new `Portion` model.
