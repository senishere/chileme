# 吃了么 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable local-first iPhone PWA for “吃了么”, with quick food logging, a personal food library, packaged food entry, local persistence, basic stats, and PWA install metadata.

**Architecture:** Use a static frontend with focused JavaScript modules. Pure calculation logic lives in `src/domain.js`, persistence lives in `src/store.js`, rendering and interaction live in `src/app.js`, and CSS owns the mobile-first layout. Tests use Node's built-in test runner for the pure data and storage behavior.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Node `node:test`, `localStorage`, PWA manifest.

---

## File Structure

- Create `package.json`: npm scripts for tests and local serving.
- Create `.gitignore`: local server and OS clutter exclusions.
- Create `index.html`: app shell, modal containers, navigation, script entrypoint.
- Create `manifest.webmanifest`: PWA metadata for “吃了么”.
- Create `assets/icon.svg`: simple install icon.
- Create `src/domain.js`: nutrition math, date aggregation, default data factories.
- Create `src/store.js`: localStorage adapter, CRUD helpers, export/import.
- Create `src/app.js`: DOM rendering, event handling, modal flows, photo input handling.
- Create `src/styles.css`: iPhone-first visual system, horizontal quick-add rail, vertical timeline.
- Create `tests/domain.test.mjs`: pure calculation tests.
- Create `tests/store.test.mjs`: storage tests with an in-memory localStorage stub.
- Keep `docs/superpowers/specs/2026-05-18-chileme-design.md`: source spec.

## Task 1: Project Harness And Nutrition Domain

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/domain.js`
- Test: `tests/domain.test.mjs`

- [x] **Step 1: Create the failing domain tests**

Create `tests/domain.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateItemNutrition,
  createDefaultState,
  dateKey,
  summarizeDay,
  sevenDayStats
} from "../src/domain.js";

test("calculates per-100g nutrition for a regular food item", () => {
  const food = {
    id: "food_rice",
    nutritionMode: "per100g",
    nutrition: { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3 }
  };

  assert.deepEqual(calculateItemNutrition(food, 150), {
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45
  });
});

test("calculates package nutrition by serving ratio", () => {
  const food = {
    id: "food_yogurt",
    nutritionMode: "perServing",
    servingGrams: 100,
    nutrition: { calories: 120, protein: 10, carbs: 8, fat: 4 }
  };

  assert.deepEqual(calculateItemNutrition(food, 50), {
    calories: 60,
    protein: 5,
    carbs: 4,
    fat: 2
  });
});

test("summarizes entries and water for one local day", () => {
  const state = createDefaultState();
  const day = "2026-05-18";
  state.entries = [
    {
      id: "entry_a",
      timestamp: "2026-05-18T11:20:00+08:00",
      items: [
        {
          foodId: "food_rice",
          grams: 150,
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45 }
        }
      ],
      note: "",
      photo: ""
    },
    {
      id: "entry_b",
      timestamp: "2026-05-17T23:20:00+08:00",
      items: [
        {
          foodId: "food_rice",
          grams: 150,
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45 }
        }
      ],
      note: "",
      photo: ""
    }
  ];
  state.waterEntries = [
    { id: "water_a", timestamp: "2026-05-18T15:30:00+08:00", milliliters: 300 }
  ];

  assert.deepEqual(summarizeDay(state, day), {
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45,
    waterMl: 300,
    entryCount: 1
  });
});

test("builds seven days of stats ending on the selected date", () => {
  const state = createDefaultState();
  state.entries = [
    {
      id: "entry_a",
      timestamp: "2026-05-18T11:20:00+08:00",
      items: [
        {
          foodId: "food_rice",
          grams: 150,
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45 }
        }
      ],
      note: "",
      photo: ""
    }
  ];

  const stats = sevenDayStats(state, "2026-05-18");

  assert.equal(stats.length, 7);
  assert.equal(stats[0].date, "2026-05-12");
  assert.equal(stats[6].date, "2026-05-18");
  assert.equal(stats[6].calories, 174);
});

test("formats local dates as yyyy-mm-dd", () => {
  assert.equal(dateKey(new Date("2026-05-18T09:05:00+08:00")), "2026-05-18");
});
```

- [x] **Step 2: Add package scripts and verify the domain test fails**

Create `package.json`:

```json
{
  "name": "chileme",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "serve": "python3 -m http.server 4173"
  }
}
```

Create `.gitignore`:

```gitignore
.DS_Store
node_modules/
.superpowers/
coverage/
```

Run: `npm test`

Expected: FAIL because `src/domain.js` does not exist or does not export the tested functions.

- [x] **Step 3: Implement the nutrition domain**

Create `src/domain.js`:

```js
export const EMPTY_NUTRITION = Object.freeze({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0
});

export function roundMetric(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calculateItemNutrition(food, grams) {
  const safeGrams = Number(grams) || 0;
  const nutrition = food?.nutrition || EMPTY_NUTRITION;
  const divisor = food?.nutritionMode === "perServing"
    ? Number(food.servingGrams) || 1
    : 100;
  const ratio = safeGrams / divisor;

  return {
    calories: roundMetric((nutrition.calories || 0) * ratio),
    protein: roundMetric((nutrition.protein || 0) * ratio),
    carbs: roundMetric((nutrition.carbs || 0) * ratio),
    fat: roundMetric((nutrition.fat || 0) * ratio)
  };
}

export function createDefaultState() {
  return {
    foods: [
      {
        id: "food_rice",
        name: "米饭",
        category: "主食",
        kind: "regular",
        emoji: "🍚",
        image: "",
        nutritionMode: "per100g",
        nutrition: { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3 },
        defaultPortionId: "portion_rice_fist",
        quickAdd: true
      },
      {
        id: "food_chicken",
        name: "鸡胸肉",
        category: "蛋白质",
        kind: "regular",
        emoji: "🍗",
        image: "",
        nutritionMode: "per100g",
        nutrition: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        defaultPortionId: "portion_chicken_palm",
        quickAdd: true
      },
      {
        id: "food_yogurt",
        name: "希腊酸奶",
        category: "包装",
        kind: "packaged",
        emoji: "🥛",
        image: "",
        nutritionMode: "perServing",
        servingGrams: 100,
        packageGrams: 100,
        nutrition: { calories: 120, protein: 10, carbs: 8, fat: 4 },
        defaultPortionId: "portion_yogurt_cup",
        quickAdd: true
      },
      {
        id: "food_nuts",
        name: "坚果",
        category: "零食",
        kind: "regular",
        emoji: "🥜",
        image: "",
        nutritionMode: "per100g",
        nutrition: { calories: 607, protein: 20, carbs: 21, fat: 54 },
        defaultPortionId: "portion_nuts_half_hand",
        quickAdd: true
      }
    ],
    portions: [
      { id: "portion_rice_fist", foodId: "food_rice", label: "1拳", grams: 150 },
      { id: "portion_chicken_palm", foodId: "food_chicken", label: "1掌心", grams: 120 },
      { id: "portion_yogurt_cup", foodId: "food_yogurt", label: "1杯", grams: 100 },
      { id: "portion_nuts_half_hand", foodId: "food_nuts", label: "半把", grams: 15 }
    ],
    entries: [],
    waterEntries: [],
    calibration: {
      fistWidthCm: 8.5,
      palmWidthCm: 8,
      fingerWidthCm: 1.8,
      containers: [{ id: "container_bowl", label: "家用碗", capacityMl: 350 }]
    },
    dailyGoal: { calories: 2000, protein: 100, waterMl: 2000 }
  };
}

export function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

export function addNutrition(left, right) {
  return {
    calories: roundMetric((left.calories || 0) + (right.calories || 0)),
    protein: roundMetric((left.protein || 0) + (right.protein || 0)),
    carbs: roundMetric((left.carbs || 0) + (right.carbs || 0)),
    fat: roundMetric((left.fat || 0) + (right.fat || 0))
  };
}

export function summarizeDay(state, dayKey) {
  const summary = {
    ...EMPTY_NUTRITION,
    waterMl: 0,
    entryCount: 0
  };

  for (const entry of state.entries || []) {
    if (dateKey(entry.timestamp) !== dayKey) continue;
    summary.entryCount += 1;
    for (const item of entry.items || []) {
      const next = addNutrition(summary, item.nutrition || EMPTY_NUTRITION);
      summary.calories = next.calories;
      summary.protein = next.protein;
      summary.carbs = next.carbs;
      summary.fat = next.fat;
    }
  }

  for (const water of state.waterEntries || []) {
    if (dateKey(water.timestamp) === dayKey) {
      summary.waterMl += Number(water.milliliters) || 0;
    }
  }

  return summary;
}

export function addDays(dayKey, offset) {
  const date = new Date(`${dayKey}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}

export function sevenDayStats(state, endDayKey = dateKey()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(endDayKey, index - 6);
    return { date, ...summarizeDay(state, date) };
  });
}

export function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
```

- [x] **Step 4: Run the domain tests**

Run: `npm test`

Expected: PASS for `tests/domain.test.mjs`.

- [x] **Step 5: Commit Task 1**

```bash
git add package.json .gitignore src/domain.js tests/domain.test.mjs
git commit -m "feat: add nutrition domain"
```

## Task 2: Local Storage Adapter

**Files:**
- Create: `src/store.js`
- Test: `tests/store.test.mjs`

- [x] **Step 1: Create the failing storage tests**

Create `tests/store.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultState } from "../src/domain.js";
import {
  createStore,
  exportState,
  importState,
  normalizeState
} from "../src/store.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

test("loads default state when storage is empty", () => {
  const store = createStore(memoryStorage());
  const state = store.load();

  assert.equal(state.foods.length >= 4, true);
  assert.equal(state.entries.length, 0);
});

test("saves and reloads state", () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const state = createDefaultState();
  state.entries.push({
    id: "entry_test",
    timestamp: "2026-05-18T12:00:00+08:00",
    items: [],
    note: "test",
    photo: ""
  });

  store.save(state);

  assert.equal(createStore(storage).load().entries[0].id, "entry_test");
});

test("normalizes partial imported state", () => {
  const normalized = normalizeState({ foods: [{ id: "custom", name: "自定义" }] });

  assert.equal(normalized.foods[0].id, "custom");
  assert.deepEqual(normalized.entries, []);
  assert.deepEqual(normalized.waterEntries, []);
  assert.equal(typeof normalized.dailyGoal, "object");
});

test("exports and imports JSON state", () => {
  const state = createDefaultState();
  state.entries.push({
    id: "entry_export",
    timestamp: "2026-05-18T12:00:00+08:00",
    items: [],
    note: "export",
    photo: ""
  });

  const imported = importState(exportState(state));

  assert.equal(imported.entries[0].id, "entry_export");
});

test("throws a useful error for invalid import JSON", () => {
  assert.throws(() => importState("{bad json"), /无法导入数据/);
});
```

- [x] **Step 2: Run storage test to verify it fails**

Run: `npm test`

Expected: FAIL because `src/store.js` does not exist or does not export the tested functions.

- [x] **Step 3: Implement the storage adapter**

Create `src/store.js`:

```js
import { createDefaultState } from "./domain.js";

export const STORAGE_KEY = "chileme.state.v1";

export function normalizeState(input) {
  const defaults = createDefaultState();
  const state = input && typeof input === "object" ? input : {};

  return {
    foods: Array.isArray(state.foods) ? state.foods : defaults.foods,
    portions: Array.isArray(state.portions) ? state.portions : defaults.portions,
    entries: Array.isArray(state.entries) ? state.entries : [],
    waterEntries: Array.isArray(state.waterEntries) ? state.waterEntries : [],
    calibration: state.calibration && typeof state.calibration === "object"
      ? { ...defaults.calibration, ...state.calibration }
      : defaults.calibration,
    dailyGoal: state.dailyGoal && typeof state.dailyGoal === "object"
      ? { ...defaults.dailyGoal, ...state.dailyGoal }
      : defaults.dailyGoal
  };
}

export function createStore(storage = globalThis.localStorage) {
  return {
    load() {
      if (!storage) return createDefaultState();
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      return normalizeState(JSON.parse(raw));
    },
    save(state) {
      if (!storage) {
        throw new Error("当前浏览器无法保存数据");
      }
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
    },
    clear() {
      if (storage) storage.removeItem(STORAGE_KEY);
    }
  };
}

export function exportState(state) {
  return JSON.stringify(normalizeState(state), null, 2);
}

export function importState(json) {
  try {
    return normalizeState(JSON.parse(json));
  } catch (error) {
    throw new Error("无法导入数据：JSON 格式无效");
  }
}
```

- [x] **Step 4: Run the full test suite**

Run: `npm test`

Expected: PASS for domain and storage tests.

- [x] **Step 5: Commit Task 2**

```bash
git add src/store.js tests/store.test.mjs
git commit -m "feat: add local storage adapter"
```

## Task 3: PWA Shell And Mobile Layout

**Files:**
- Create: `index.html`
- Create: `src/styles.css`
- Create: `manifest.webmanifest`
- Create: `assets/icon.svg`

- [x] **Step 1: Create the app shell**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#fbfaf7">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="吃了么">
    <title>吃了么</title>
    <link rel="manifest" href="./manifest.webmanifest">
    <link rel="apple-touch-icon" href="./assets/icon.svg">
    <link rel="icon" href="./assets/icon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="./src/styles.css">
  </head>
  <body>
    <div class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow" id="today-label">今天</p>
          <h1>吃了么</h1>
        </div>
        <div class="brand-mark" aria-hidden="true">饭</div>
      </header>

      <main id="view-root" class="view-root" tabindex="-1"></main>

      <nav class="bottom-nav" aria-label="主导航">
        <button class="nav-item active" type="button" data-view="today">今天</button>
        <button class="nav-item" type="button" data-view="foods">食物库</button>
        <button class="nav-item" type="button" data-view="stats">统计</button>
        <button class="nav-item" type="button" data-view="settings">设置</button>
      </nav>
    </div>

    <div id="modal-root" class="modal-root" hidden></div>
    <script type="module" src="./src/app.js"></script>
  </body>
</html>
```

- [x] **Step 2: Create the visual styling**

Create `src/styles.css` with mobile-first styles for the full app. Include these selectors and values:

```css
:root {
  color-scheme: light;
  --bg: #fbfaf7;
  --surface: #ffffff;
  --surface-soft: #f1eadf;
  --text: #20231f;
  --muted: #697064;
  --line: #e3dfd5;
  --primary: #1f5d43;
  --primary-strong: #174633;
  --accent: #f1b45b;
  --danger: #a33a32;
  --radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
  background: var(--bg);
  color: var(--text);
}

body {
  overflow: hidden;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  width: min(100vw, 430px);
  height: 100dvh;
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background:
    radial-gradient(circle at top left, rgba(241, 180, 91, 0.16), transparent 34%),
    var(--bg);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: max(16px, env(safe-area-inset-top)) 18px 12px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 12px;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  font-size: 28px;
  line-height: 1.05;
  letter-spacing: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f6c27a, #7cbf8f);
  color: #173524;
  font-weight: 800;
}

.view-root {
  min-height: 0;
  overflow-y: auto;
  padding: 0 14px 14px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.metric-card,
.panel,
.timeline-card,
.food-row,
.stat-row {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.92);
}

.metric-card {
  padding: 10px;
}

.metric-value {
  font-size: 20px;
  font-weight: 800;
}

.metric-label {
  color: var(--muted);
  font-size: 12px;
}

.panel {
  padding: 12px;
  margin-bottom: 12px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.section-head h2 {
  margin: 0;
  font-size: 17px;
}

.hint {
  color: var(--muted);
  font-size: 12px;
}

.quick-rail {
  display: flex;
  gap: 9px;
  overflow-x: auto;
  padding-bottom: 4px;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}

.quick-card {
  min-width: 86px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 8px;
  text-align: left;
  scroll-snap-align: start;
}

.food-thumb,
.entry-thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: linear-gradient(135deg, #f2c879, #f7f0df);
}

.food-thumb {
  width: 100%;
  height: 48px;
  border-radius: var(--radius);
  margin-bottom: 7px;
  font-size: 24px;
}

.quick-name {
  display: block;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-portion {
  color: var(--muted);
  font-size: 12px;
}

.actions-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.button {
  min-height: 42px;
  border: 0;
  border-radius: 999px;
  padding: 0 14px;
  background: var(--primary);
  color: #fff;
  font-weight: 700;
}

.button.secondary {
  border: 1px dashed #b6ad9e;
  background: transparent;
  color: var(--muted);
}

.button.danger {
  background: var(--danger);
}

.timeline {
  display: grid;
  gap: 9px;
}

.timeline-card {
  display: grid;
  grid-template-columns: 54px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 9px;
}

.entry-thumb {
  width: 54px;
  height: 54px;
  border-radius: var(--radius);
  font-size: 24px;
}

.entry-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.entry-title {
  margin: 0 0 4px;
  font-weight: 800;
}

.entry-meta {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.icon-button {
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
}

.bottom-nav {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 8px 10px max(8px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
  background: rgba(251, 250, 247, 0.96);
}

.nav-item {
  min-height: 42px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
}

.nav-item.active {
  background: var(--primary);
  color: #fff;
  font-weight: 800;
}

.form-grid {
  display: grid;
  gap: 10px;
}

.field {
  display: grid;
  gap: 5px;
}

.field span {
  color: var(--muted);
  font-size: 12px;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: #fff;
  padding: 10px;
}

.modal-root {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: end center;
  padding: 16px;
  background: rgba(32, 35, 31, 0.34);
}

.modal-root[hidden] {
  display: none;
}

.sheet {
  width: min(100%, 430px);
  max-height: 88dvh;
  overflow-y: auto;
  border-radius: 18px 18px 10px 10px;
  background: var(--bg);
  padding: 16px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.22);
}

.empty {
  border: 1px dashed #b6ad9e;
  border-radius: var(--radius);
  padding: 16px;
  color: var(--muted);
  text-align: center;
}

.food-row,
.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  margin-bottom: 8px;
}

@media (min-width: 700px) {
  body {
    background: #e7e1d8;
  }

  .app-shell {
    margin-top: 24px;
    height: calc(100dvh - 48px);
    border: 1px solid #d6d0c7;
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 20px 80px rgba(40, 35, 25, 0.18);
  }
}
```

- [x] **Step 3: Create manifest and icon**

Create `manifest.webmanifest`:

```json
{
  "name": "吃了么",
  "short_name": "吃了么",
  "description": "本地优先的健康饮食记录助手",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#fbfaf7",
  "theme_color": "#fbfaf7",
  "icons": [
    {
      "src": "./assets/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

Create `assets/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#fbfaf7"/>
  <circle cx="256" cy="256" r="168" fill="#1f5d43"/>
  <path d="M160 226c34-58 158-74 203 0 32 52-7 135-103 137-92 2-133-79-100-137z" fill="#f6c27a"/>
  <path d="M176 210c37-24 113-35 167 0" fill="none" stroke="#fff7df" stroke-width="24" stroke-linecap="round"/>
  <text x="256" y="292" text-anchor="middle" font-family="Arial, sans-serif" font-size="88" font-weight="700" fill="#173524">么</text>
</svg>
```

- [x] **Step 4: Verify static files and tests**

Run: `npm test`

Expected: PASS.

Run: `npm run serve`

Expected: local server starts on `http://0.0.0.0:4173/`.

In a second terminal or after starting the server in the background, run: `curl -sSf http://127.0.0.1:4173/index.html`

Expected: output contains `<title>吃了么</title>`.

- [x] **Step 5: Commit Task 3**

```bash
git add index.html src/styles.css manifest.webmanifest assets/icon.svg
git commit -m "feat: add pwa shell"
```

## Task 4: App Rendering And Food Logging

**Files:**
- Create: `src/app.js`
- Modify: `src/domain.js`

- [x] **Step 1: Add entry creation helpers to the domain**

Append these exports to `src/domain.js`:

```js
export function findFood(state, foodId) {
  return (state.foods || []).find((food) => food.id === foodId);
}

export function findPortion(state, portionId) {
  return (state.portions || []).find((portion) => portion.id === portionId);
}

export function portionsForFood(state, foodId) {
  return (state.portions || []).filter((portion) => portion.foodId === foodId);
}

export function buildEntryItem(food, portion, gramsOverride) {
  const grams = Number(gramsOverride || portion?.grams || 0);
  return {
    foodId: food.id,
    portionId: portion?.id || "",
    label: portion?.label || `${grams}g`,
    grams,
    nutrition: calculateItemNutrition(food, grams)
  };
}
```

- [x] **Step 2: Extend domain tests for entry helpers**

Append to `tests/domain.test.mjs`:

```js
import {
  buildEntryItem,
  findFood,
  findPortion,
  portionsForFood
} from "../src/domain.js";

test("finds foods and portions and builds an entry item", () => {
  const state = createDefaultState();
  const food = findFood(state, "food_rice");
  const portion = findPortion(state, "portion_rice_fist");

  assert.equal(food.name, "米饭");
  assert.equal(portionsForFood(state, "food_rice").length, 1);
  assert.deepEqual(buildEntryItem(food, portion), {
    foodId: "food_rice",
    portionId: "portion_rice_fist",
    label: "1拳",
    grams: 150,
    nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45 }
  });
});
```

Run: `npm test`

Expected: PASS.

- [x] **Step 3: Implement app rendering and interactions**

Create `src/app.js`:

```js
import {
  buildEntryItem,
  calculateItemNutrition,
  createId,
  dateKey,
  findFood,
  findPortion,
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
  if (photo) return `<span class="entry-thumb"><img alt="" src="${photo}"></span>`;
  if (food?.image) return `<span class="entry-thumb"><img alt="" src="${food.image}"></span>`;
  return `<span class="entry-thumb">${food?.emoji || "🍽️"}</span>`;
}

function quickThumbHtml(food) {
  if (food.image) return `<span class="food-thumb"><img alt="" src="${food.image}"></span>`;
  return `<span class="food-thumb">${food.emoji || "🍽️"}</span>`;
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
      <button class="quick-card" type="button" data-action="open-entry" data-food-id="${food.id}">
        ${quickThumbHtml(food)}
        <span class="quick-name">${food.name}</span>
        <span class="quick-portion">${portion?.label || "自定义"}</span>
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
          <p class="entry-title">${formatTime(entry.timestamp)} ${title}</p>
          <p class="entry-meta">${portions} · 约 ${formatNumber(calories)} kcal</p>
          ${entry.note ? `<p class="entry-meta">${entry.note}</p>` : ""}
        </div>
        <button class="icon-button" type="button" aria-label="删除记录" data-action="delete-entry" data-entry-id="${entry.id}">×</button>
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
        <div><strong>${food.emoji || "🍽️"} ${food.name}</strong><br><span class="hint">${food.category} · ${food.kind === "packaged" ? "包装食品" : "常规食物"} · ${portion?.label || "无默认份量"}</span></div>
        <button class="icon-button" type="button" data-action="open-entry" data-food-id="${food.id}">+</button>
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
      <strong>${day.date.slice(5)}</strong>
      <span>${formatNumber(day.calories)} kcal</span>
      <span>${formatNumber(day.protein, 1)}g 蛋白</span>
      <span>${formatNumber(day.waterMl / 1000, 1)}L</span>
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
  root.innerHTML = `
    <section class="panel">
      <div class="section-head"><h2>设置</h2><span class="hint">本地数据</span></div>
      <form class="form-grid" data-action="save-settings">
        <label class="field"><span>热量目标 kcal</span><input name="calories" inputmode="numeric" value="${state.dailyGoal.calories || ""}"></label>
        <label class="field"><span>蛋白质目标 g</span><input name="protein" inputmode="numeric" value="${state.dailyGoal.protein || ""}"></label>
        <label class="field"><span>饮水目标 ml</span><input name="waterMl" inputmode="numeric" value="${state.dailyGoal.waterMl || ""}"></label>
        <label class="field"><span>拳头宽度 cm</span><input name="fistWidthCm" inputmode="decimal" value="${state.calibration.fistWidthCm || ""}"></label>
        <label class="field"><span>掌心宽度 cm</span><input name="palmWidthCm" inputmode="decimal" value="${state.calibration.palmWidthCm || ""}"></label>
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
            ${state.foods.map((item) => `<option value="${item.id}" ${item.id === selectedFoodId ? "selected" : ""}>${item.name}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>份量</span>
          <select name="portionId">
            ${portions.map((portion) => `<option value="${portion.id}" ${portion.id === defaultPortion?.id ? "selected" : ""}>${portion.label} · ${portion.grams}g</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>自定义克数</span><input name="grams" inputmode="decimal" value="${defaultPortion?.grams || 100}"></label>
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

  const grams = Number(data.get("grams")) || portion?.grams || 0;
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
  const grams = Number(data.get("grams")) || 100;
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
      calories: Number(data.get("calories")) || 0,
      protein: Number(data.get("protein")) || 0,
      carbs: Number(data.get("carbs")) || 0,
      fat: Number(data.get("fat")) || 0
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
    state = importState(await file.text());
    saveAndRender();
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
    state.dailyGoal = {
      calories: Number(data.get("calories")) || 0,
      protein: Number(data.get("protein")) || 0,
      waterMl: Number(data.get("waterMl")) || 0
    };
    state.calibration = {
      ...state.calibration,
      fistWidthCm: Number(data.get("fistWidthCm")) || 0,
      palmWidthCm: Number(data.get("palmWidthCm")) || 0
    };
    saveAndRender();
  }
});

modalRoot.addEventListener("change", (event) => {
  const select = event.target.closest('select[name="foodId"]');
  if (!select) return;
  openEntryModal(select.value);
});

render();
```

- [x] **Step 4: Run tests and serve the app**

Run: `npm test`

Expected: PASS.

Run: `npm run serve`

Expected: the app loads at `http://127.0.0.1:4173/`, shows “吃了么”, has the bottom navigation, and no console-breaking syntax error in the browser.

- [x] **Step 5: Manually verify core logging**

In the browser:

1. Open `http://127.0.0.1:4173/`.
2. Click the 米饭 quick card.
3. Save the record.
4. Confirm the timeline shows a new 米饭 record.
5. Confirm today's calories increase.
6. Refresh the page.
7. Confirm the record remains visible.

- [x] **Step 6: Commit Task 4**

```bash
git add src/domain.js src/app.js tests/domain.test.mjs
git commit -m "feat: add food logging interface"
```

## Task 5: Water, Stats, Settings, And Data Management Polish

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Test: `tests/domain.test.mjs`

- [x] **Step 1: Add a water entry domain test**

Append to `tests/domain.test.mjs`:

```js
test("summarizes multiple water entries for a day", () => {
  const state = createDefaultState();
  state.waterEntries = [
    { id: "water_a", timestamp: "2026-05-18T09:00:00+08:00", milliliters: 250 },
    { id: "water_b", timestamp: "2026-05-18T13:00:00+08:00", milliliters: 500 },
    { id: "water_c", timestamp: "2026-05-17T13:00:00+08:00", milliliters: 500 }
  ];

  assert.equal(summarizeDay(state, "2026-05-18").waterMl, 750);
});
```

Run: `npm test`

Expected: PASS because `summarizeDay` already supports water entries.

- [x] **Step 2: Add water controls to the Today view**

Modify `renderQuickAdd()` in `src/app.js` so the actions row includes a water button:

```js
      <div class="actions-row">
        <button class="button secondary" type="button" data-action="show-foods">搜索/更多</button>
        <button class="button secondary" type="button" data-action="add-water">+ 300ml</button>
        <button class="button" type="button" data-action="open-entry">+ 自定义</button>
      </div>
```

Add this case to the document click handler:

```js
  if (action === "add-water") {
    state.waterEntries.push({
      id: createId("water"),
      timestamp: new Date().toISOString(),
      milliliters: 300
    });
    saveAndRender();
  }
```

- [x] **Step 3: Improve settings save feedback and import error handling**

In `src/app.js`, update `importJson()`:

```js
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
```

Update the settings submit branch:

```js
  if (action === "save-settings") {
    const data = new FormData(form);
    state.dailyGoal = {
      calories: Number(data.get("calories")) || 0,
      protein: Number(data.get("protein")) || 0,
      waterMl: Number(data.get("waterMl")) || 0
    };
    state.calibration = {
      ...state.calibration,
      fistWidthCm: Number(data.get("fistWidthCm")) || 0,
      palmWidthCm: Number(data.get("palmWidthCm")) || 0
    };
    saveAndRender();
    alert("设置已保存");
  }
```

- [x] **Step 4: Add small-screen action wrapping**

Append to `src/styles.css`:

```css
@media (max-width: 360px) {
  .actions-row {
    flex-wrap: wrap;
  }

  .actions-row .button {
    flex: 1 1 120px;
  }

  .summary-grid {
    gap: 6px;
  }

  .metric-card {
    padding: 8px;
  }
}
```

- [x] **Step 5: Verify tests and manual flows**

Run: `npm test`

Expected: PASS.

Manual checks at `http://127.0.0.1:4173/`:

1. Click `+ 300ml`.
2. Confirm the water summary increases.
3. Open `统计`.
4. Confirm today's water value appears in the last row.
5. Open `设置`, change a target value, save, refresh, and confirm the value persists.

- [x] **Step 6: Commit Task 5**

```bash
git add src/app.js src/styles.css tests/domain.test.mjs
git commit -m "feat: add water and settings polish"
```

## Task 6: Final Verification And Documentation

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/plans/2026-05-18-chileme-pwa.md`

- [x] **Step 1: Create README**

Create `README.md`:

```md
# 吃了么

“吃了么”是一个本地优先的 iPhone PWA，用于快速记录刚吃过的食物、零食和饮水，并查看粗略营养汇总。

## 运行

```bash
npm run serve
```

然后打开：

```text
http://127.0.0.1:4173/
```

在 iPhone Safari 中打开后，可以使用分享菜单里的“添加到主屏幕”。

## 测试

```bash
npm test
```

## 范围

- 数据保存在当前浏览器本地。
- 照片只作为记录附件，不参与识别、估重或营养计算。
- 营养数值是粗略估算，不是医疗建议。
```

- [x] **Step 2: Run automated verification**

Run: `npm test`

Expected: PASS for all tests.

Run: `curl -sSf http://127.0.0.1:4173/manifest.webmanifest`

Expected: output contains `"name": "吃了么"`.

Run: `curl -sSf http://127.0.0.1:4173/index.html`

Expected: output contains `src="./src/app.js"`.

- [x] **Step 3: Run mobile layout manual verification**

Open `http://127.0.0.1:4173/` in a browser with a narrow mobile viewport around 390px wide.

Verify:

1. Top header, summary cards, quick rail, timeline, and bottom nav fit without horizontal page overflow.
2. Quick food cards scroll horizontally.
3. Timeline scrolls vertically.
4. Food logging modal fits in the viewport and scrolls internally.
5. Adding a new food makes it appear in `食物库` and in the quick rail.
6. Adding a record with no photo works.
7. Adding a record with a small photo shows a thumbnail.
8. Refresh keeps data.

- [x] **Step 4: Update plan checkboxes as completed**

Edit `docs/superpowers/plans/2026-05-18-chileme-pwa.md` and change completed task checkboxes from `- [ ]` to `- [x]`.

- [x] **Step 5: Commit final docs**

```bash
git add README.md docs/superpowers/plans/2026-05-18-chileme-pwa.md
git commit -m "docs: add app usage guide"
```

## Self-Review Notes

- Spec coverage: The plan covers local-first PWA setup, quick logging, non-fixed meal timing, food library, packaged food entry, personal portions, photos as non-computational attachments, today summary, seven-day stats, settings, import/export, PWA metadata, and validation.
- Scope control: Photo recognition, cloud sync, AI suggestions, medical advice, and a large food database remain outside this plan.
- Type consistency: The plan uses the same `Food`, `Portion`, `Entry`, `WaterEntry`, `Calibration`, and `DailyGoal` shapes from the design spec.
