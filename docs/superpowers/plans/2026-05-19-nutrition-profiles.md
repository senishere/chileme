# Nutrition Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dietary fiber, kJ-to-kcal entry support, local profile-separated records, and recognition interface scaffolding while keeping the PWA local-first.

**Architecture:** Keep pure calculations and model helpers in `src/domain.js`, storage migration in `src/store.js`, and split the large UI file into focused view and UI helper modules. Food categories and foods remain shared at top level; records, water entries, personal profile, and daily goals move into local profile objects.

**Tech Stack:** Vanilla JavaScript ES modules, browser `localStorage`, Node `node:test`, static PWA service worker.

---

## File Structure

- Modify `src/domain.js`: add `fiber`, `kilojoulesToCalories`, local profile helpers, and active-profile record projection.
- Modify `src/store.js`: normalize legacy and new profile-shaped states, migrate `entries` and `waterEntries` into a default profile, and preserve shared food/category behavior.
- Modify `src/app.js`: keep bootstrapping, shared state, routing, and delegated event dispatch after view extraction.
- Create `src/ui/format.js`: HTML escaping, number/time formatting, amount labels, kJ conversion helpers for UI use.
- Create `src/ui/image.js`: image compression and data URL helpers moved from `src/app.js`.
- Create `src/recognition.js`: typed recognition request/result helpers and an explicit unconfigured-service error.
- Create `src/views/today.js`: today summary, structure, quick-add rail, and timeline rendering.
- Create `src/views/foods.js`: food list, food form, category manager, icon picker rendering.
- Create `src/views/stats.js`: trend stats rendering.
- Create `src/views/settings.js`: settings, export form, and profile management rendering.
- Modify `src/styles.css`: add compact profile controls and food-form energy input styling if existing form grid spacing is insufficient.
- Modify `sw.js`: precache new JS modules.
- Modify `tests/domain.test.mjs`: add domain tests for fiber, kJ, and profiles.
- Modify `tests/store.test.mjs`: add store migration and normalize tests for profiles and fiber.
- Modify `tests/pwa.test.mjs`: update static contracts for split modules, fiber/kJ inputs, profile controls, and service worker precache.
- Modify `README.md`: update scope bullets for fiber, kJ input, and local profiles after implementation.
- Modify `docs/CURRENT.md`: update in-flight project state after implementation and verification.

## Task 1: Domain Fiber, kJ, And Local Profiles

**Files:**
- Modify: `src/domain.js`
- Test: `tests/domain.test.mjs`

- [ ] **Step 1: Add failing domain imports**

Update the import block in `tests/domain.test.mjs` to include the new helpers:

```js
import {
  addCategory,
  addLocalProfile,
  activeRecordState,
  buildEntryItem,
  calculateItemNutrition,
  cloneState,
  createDefaultState,
  dateKey,
  defaultIconForCategory,
  deleteCategory,
  deleteLocalProfile,
  dailyStructure,
  estimateDailyTargets,
  exportLogRows,
  exportRowsAsCsv,
  filterFoods,
  findFood,
  getActiveProfile,
  kilojoulesToCalories,
  limitStatus,
  listFoodCategories,
  nutritionStatus,
  renameCategory,
  renameLocalProfile,
  setActiveProfile,
  summarizeDay,
  sevenDayStats,
  trendStats,
  updateActiveProfile
} from "../src/domain.js";
```

- [ ] **Step 2: Add failing fiber and kJ tests**

Append these tests near the existing nutrition tests:

```js
test("converts kilojoules to calories for nutrition label entry", () => {
  assert.equal(kilojoulesToCalories(418.4), 100);
  assert.equal(kilojoulesToCalories("209.2"), 50);
  assert.equal(kilojoulesToCalories(""), 0);
  assert.equal(kilojoulesToCalories(-10), 0);
});

test("calculates dietary fiber with per-100g nutrition", () => {
  const food = {
    id: "food_oatmeal",
    nutritionPer100g: {
      calories: 389,
      protein: 16.9,
      carbs: 66.3,
      fat: 6.9,
      sodium: 2,
      fiber: 10.6
    }
  };

  assert.deepEqual(calculateItemNutrition(food, 50, "g"), {
    calories: 194.5,
    protein: 8.45,
    carbs: 33.15,
    fat: 3.45,
    sodium: 1,
    fiber: 5.3
  });
});

test("builds entry items with dietary fiber", () => {
  const food = {
    id: "food_custom",
    nutritionPer100g: {
      calories: 200,
      protein: 8,
      carbs: 30,
      fat: 4,
      sodium: 100,
      fiber: 6
    }
  };

  assert.deepEqual(buildEntryItem(food, 150, "g"), {
    foodId: "food_custom",
    amount: 150,
    unit: "g",
    grams: 150,
    nutrition: {
      calories: 300,
      protein: 12,
      carbs: 45,
      fat: 6,
      sodium: 150,
      fiber: 9
    }
  });
});
```

- [ ] **Step 3: Replace existing expected nutrition objects with fiber**

Update existing assertions in `tests/domain.test.mjs` so every nutrition object includes `fiber`. For example, change the first nutrition test to:

```js
assert.deepEqual(calculateItemNutrition(food, 150, "g"), {
  calories: 174,
  protein: 3.9,
  carbs: 38.85,
  fat: 0.45,
  sodium: 1.5,
  fiber: 0
});
```

Apply the same rule to existing `summarizeDay`, `trendStats`, `buildEntryItem`, `exportLogRows`, `exportRowsAsCsv`, and `dailyStructure` expectations.

- [ ] **Step 4: Add failing local profile tests**

Append these tests after the category helper tests:

```js
test("default state starts with one active local profile", () => {
  const state = createDefaultState();
  const profile = getActiveProfile(state);

  assert.equal(state.activeProfileId, "profile_default");
  assert.equal(state.profiles.length, 1);
  assert.equal(profile.name, "日常维持");
  assert.deepEqual(profile.entries, []);
  assert.deepEqual(profile.waterEntries, []);
  assert.equal(profile.dailyGoal.fiber, 25);
});

test("active record state projects current profile records with shared foods", () => {
  const state = createDefaultState();
  state.profiles[0].entries = [{
    id: "entry_a",
    timestamp: "2026-05-18T12:00:00",
    items: [{
      foodId: "food_rice",
      amount: 150,
      unit: "g",
      nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5, fiber: 0.6 }
    }],
    note: "",
    photo: ""
  }];

  const active = activeRecordState(state);

  assert.equal(active.entries.length, 1);
  assert.equal(active.foods, state.foods);
  assert.equal(active.categories, state.categories);
  assert.equal(active.dailyGoal.fiber, 25);
  assert.equal(summarizeDay(active, "2026-05-18").fiber, 0.6);
});

test("local profile helpers add rename switch update and delete profiles", () => {
  const state = createDefaultState();
  const added = addLocalProfile(state, "减脂期");

  assert.equal(added.profiles.length, 2);
  assert.equal(added.profiles[1].name, "减脂期");
  assert.equal(added.activeProfileId, added.profiles[1].id);
  assert.deepEqual(added.profiles[1].entries, []);

  const renamed = renameLocalProfile(added, added.activeProfileId, "出差期");
  assert.equal(getActiveProfile(renamed).name, "出差期");

  const updated = updateActiveProfile(renamed, (profile) => ({
    ...profile,
    dailyGoal: { ...profile.dailyGoal, fiber: 30 },
    entries: [{ id: "entry_trip", timestamp: "2026-05-18T12:00:00", items: [], note: "", photo: "" }]
  }));
  assert.equal(getActiveProfile(updated).dailyGoal.fiber, 30);
  assert.equal(activeRecordState(updated).entries[0].id, "entry_trip");

  const switched = setActiveProfile(updated, "profile_default");
  assert.equal(getActiveProfile(switched).name, "日常维持");

  const deleted = deleteLocalProfile(switched, added.profiles[1].id);
  assert.equal(deleted.profiles.length, 1);
  assert.equal(deleted.activeProfileId, "profile_default");
  assert.throws(() => deleteLocalProfile(deleted, "profile_default"), /至少保留一个档案/);
  assert.throws(() => renameLocalProfile(deleted, "profile_default", " "), /档案名称不能为空/);
});
```

- [ ] **Step 5: Run domain tests to verify failure**

Run:

```bash
node --test tests/domain.test.mjs
```

Expected: FAIL because the new profile helpers, `fiber`, and `kilojoulesToCalories` are not implemented.

- [ ] **Step 6: Extend core nutrition constants and helpers**

In `src/domain.js`, replace `EMPTY_NUTRITION`, `calculateItemNutrition`, and `addNutrition` with versions that include `fiber`, and add `kilojoulesToCalories`:

```js
export const EMPTY_NUTRITION = Object.freeze({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sodium: 0,
  fiber: 0
});

export function kilojoulesToCalories(value) {
  return roundMetric(nonNegativeFiniteNumber(value, 0) / 4.184);
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
    sodium: roundMetric((nutrition.sodium || 0) * ratio),
    fiber: roundMetric((nutrition.fiber || 0) * ratio)
  };
}

export function addNutrition(left, right) {
  return {
    calories: roundMetric((left.calories || 0) + (right.calories || 0)),
    protein: roundMetric((left.protein || 0) + (right.protein || 0)),
    carbs: roundMetric((left.carbs || 0) + (right.carbs || 0)),
    fat: roundMetric((left.fat || 0) + (right.fat || 0)),
    sodium: roundMetric((left.sodium || 0) + (right.sodium || 0)),
    fiber: roundMetric((left.fiber || 0) + (right.fiber || 0))
  };
}
```

- [ ] **Step 7: Add local profile helpers**

Add these helpers in `src/domain.js` before `createDefaultState`:

```js
export const DEFAULT_PROFILE_ID = "profile_default";

export function createLocalProfile(overrides = {}) {
  return {
    id: overrides.id || createId("profile"),
    name: String(overrides.name || "新档案").trim() || "新档案",
    profile: {
      sex: "female",
      age: 30,
      heightCm: 165,
      weightKg: 60,
      activityLevel: "light",
      goal: "maintain",
      ...(overrides.profile || {})
    },
    dailyGoal: {
      calories: 2000,
      protein: 100,
      waterMl: 2000,
      fiber: 25,
      ...(overrides.dailyGoal || {})
    },
    entries: (overrides.entries || []).map((entry) => ({
      ...entry,
      items: (entry.items || []).map((item) => ({
        ...item,
        nutrition: { ...EMPTY_NUTRITION, ...(item.nutrition || {}) }
      }))
    })),
    waterEntries: (overrides.waterEntries || []).map((entry) => ({ ...entry }))
  };
}

function cloneLocalProfile(profile) {
  return createLocalProfile({
    id: profile.id,
    name: profile.name,
    profile: { ...(profile.profile || {}) },
    dailyGoal: { ...(profile.dailyGoal || {}) },
    entries: profile.entries || [],
    waterEntries: profile.waterEntries || []
  });
}

function normalizeProfileName(name) {
  return String(name || "").trim();
}

export function getActiveProfile(state) {
  const profiles = Array.isArray(state?.profiles) && state.profiles.length > 0
    ? state.profiles
    : [createLocalProfile({ id: DEFAULT_PROFILE_ID, name: "日常维持" })];
  return profiles.find((profile) => profile.id === state?.activeProfileId) || profiles[0];
}

export function activeRecordState(state) {
  const active = getActiveProfile(state);
  return {
    ...state,
    profile: active.profile,
    dailyGoal: active.dailyGoal,
    entries: active.entries,
    waterEntries: active.waterEntries
  };
}

export function setActiveProfile(state, profileId) {
  const next = cloneState(state);
  const exists = next.profiles.some((profile) => profile.id === profileId);
  if (!exists) throw new Error("档案不存在");
  next.activeProfileId = profileId;
  return next;
}

export function addLocalProfile(state, name) {
  const next = cloneState(state);
  const profileName = normalizeProfileName(name);
  if (!profileName) throw new Error("档案名称不能为空");
  if (next.profiles.some((profile) => profile.name === profileName)) throw new Error("档案已存在");
  const profile = createLocalProfile({ name: profileName });
  next.profiles.push(profile);
  next.activeProfileId = profile.id;
  return next;
}

export function renameLocalProfile(state, profileId, name) {
  const next = cloneState(state);
  const profileName = normalizeProfileName(name);
  if (!profileName) throw new Error("档案名称不能为空");
  if (next.profiles.some((profile) => profile.id !== profileId && profile.name === profileName)) {
    throw new Error("档案已存在");
  }
  const profile = next.profiles.find((item) => item.id === profileId);
  if (!profile) throw new Error("档案不存在");
  profile.name = profileName;
  return next;
}

export function deleteLocalProfile(state, profileId) {
  const next = cloneState(state);
  if (next.profiles.length <= 1) throw new Error("至少保留一个档案");
  const remaining = next.profiles.filter((profile) => profile.id !== profileId);
  if (remaining.length === next.profiles.length) throw new Error("档案不存在");
  next.profiles = remaining;
  if (!remaining.some((profile) => profile.id === next.activeProfileId)) {
    next.activeProfileId = remaining[0].id;
  }
  return next;
}

export function updateActiveProfile(state, updater) {
  const next = cloneState(state);
  const active = getActiveProfile(next);
  const index = next.profiles.findIndex((profile) => profile.id === active.id);
  next.profiles[index] = cloneLocalProfile(updater(cloneLocalProfile(active)));
  next.activeProfileId = next.profiles[index].id;
  return next;
}
```

- [ ] **Step 8: Update default state and cloneState for profiles**

Replace `createDefaultState` in `src/domain.js` with:

```js
export function createDefaultState() {
  return {
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      createLocalProfile({
        id: DEFAULT_PROFILE_ID,
        name: "日常维持",
        dailyGoal: { calories: 2000, protein: 100, waterMl: 2000, fiber: 25 }
      })
    ],
    categories: DEFAULT_CATEGORIES.map((item) => ({ ...item })),
    foods: DEFAULT_FOODS.map((item) => ({ ...item, nutritionPer100g: { ...item.nutritionPer100g } }))
  };
}
```

Update `cloneState` so it clones profiles and keeps legacy top-level fields when callers pass projected record states:

```js
export function cloneState(state) {
  const source = state || {};
  const profiles = Array.isArray(source.profiles) && source.profiles.length > 0
    ? source.profiles.map(cloneLocalProfile)
    : [
        createLocalProfile({
          id: DEFAULT_PROFILE_ID,
          name: "日常维持",
          profile: source.profile,
          dailyGoal: source.dailyGoal,
          entries: source.entries,
          waterEntries: source.waterEntries
        })
      ];

  const activeProfileId = profiles.some((profile) => profile.id === source.activeProfileId)
    ? source.activeProfileId
    : profiles[0].id;

  return {
    activeProfileId,
    profiles,
    categories: (source.categories || []).map((category) => ({ ...category })),
    foods: (source.foods || []).map((item) => ({
      ...item,
      nutritionPer100g: { ...EMPTY_NUTRITION, ...(item.nutritionPer100g || item.nutrition || {}) }
    }))
  };
}
```

- [ ] **Step 9: Update seeded foods and export rows**

In `src/domain.js`, the `food()` helper already merges `EMPTY_NUTRITION`, so seeded foods inherit `fiber: 0`. Update `exportLogRows` food rows and water rows to include `fiber`:

```js
fiber: item.nutrition?.fiber || 0,
```

For water rows:

```js
fiber: 0,
```

Update the CSV headers in `exportRowsAsCsv`:

```js
const headers = ["date", "timestamp", "type", "food", "amount", "unit", "calories", "protein", "carbs", "fat", "sodium", "fiber", "waterMl", "note"];
```

- [ ] **Step 10: Update daily targets and structure for fiber**

In `estimateDailyTargets`, include:

```js
fiber: normalizeGoalValue(dailyGoal.fiber, 25),
```

If `normalizeGoalValue` is not in `src/domain.js`, use:

```js
fiber: dailyGoal.fiber === null ? null : positiveFiniteNumber(dailyGoal.fiber, 25),
```

In `dailyStructure`, add a `fiber` metric using `nutritionStatus`, matching the pattern for protein/carbs/fat:

```js
fiber: buildMetric("fiber", summary.fiber, targets.fiber, nutritionStatus)
```

- [ ] **Step 11: Run domain tests**

Run:

```bash
node --test tests/domain.test.mjs
```

Expected: PASS.

- [ ] **Step 12: Commit Task 1**

Run:

```bash
git add src/domain.js tests/domain.test.mjs
git commit -m "feat: add nutrition profile domain"
```

## Task 2: Store Migration For Profiles And Fiber

**Files:**
- Modify: `src/store.js`
- Test: `tests/store.test.mjs`

- [ ] **Step 1: Add failing store migration tests**

Update the import from `src/domain.js` in `tests/store.test.mjs`:

```js
import { activeRecordState, createDefaultState, getActiveProfile } from "../src/domain.js";
```

Add these tests after the default-load tests:

```js
test("loads default state with one local profile", () => {
  const state = createStore(memoryStorage()).load();
  const active = getActiveProfile(state);

  assert.equal(state.activeProfileId, "profile_default");
  assert.equal(state.profiles.length, 1);
  assert.equal(active.name, "日常维持");
  assert.deepEqual(active.entries, []);
  assert.deepEqual(active.waterEntries, []);
  assert.equal(active.dailyGoal.fiber, 25);
});

test("migrates legacy top-level records into the default profile", () => {
  const normalized = normalizeState({
    profile: { sex: "male", age: "42", heightCm: "178", weightKg: "76", activityLevel: "moderate", goal: "gain" },
    dailyGoal: { calories: null, protein: 0, waterMl: "2300" },
    entries: [{
      id: "entry_legacy",
      timestamp: "2026-05-18T12:00:00",
      items: [{
        foodId: "food_rice",
        amount: 150,
        unit: "g",
        nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
      }],
      note: "keep",
      photo: ""
    }],
    waterEntries: [{ id: "water_legacy", timestamp: "2026-05-18T09:00:00", milliliters: 300 }]
  });
  const active = getActiveProfile(normalized);

  assert.equal(normalized.entries, undefined);
  assert.equal(normalized.waterEntries, undefined);
  assert.equal(active.profile.sex, "male");
  assert.deepEqual(active.dailyGoal, { calories: null, protein: null, waterMl: 2300, fiber: 25 });
  assert.equal(active.entries[0].id, "entry_legacy");
  assert.equal(active.entries[0].items[0].nutrition.fiber, 0);
  assert.equal(active.waterEntries[0].id, "water_legacy");
});

test("normalizes multi-profile state and repairs invalid active profile", () => {
  const normalized = normalizeState({
    activeProfileId: "missing",
    profiles: [{
      id: "profile_a",
      name: "日常",
      dailyGoal: { calories: 1800, protein: 90, waterMl: 2000, fiber: 20 },
      entries: [{
        id: "entry_a",
        timestamp: "2026-05-18T12:00:00",
        items: [{
          foodId: "food_rice",
          amount: "100",
          unit: "g",
          nutrition: { calories: "116", protein: 2.6, carbs: 25.9, fat: 0.3, sodium: 1, fiber: 0.3 }
        }],
        note: "",
        photo: ""
      }],
      waterEntries: []
    }, {
      id: "profile_b",
      name: "减脂期",
      dailyGoal: { calories: 1500, protein: 110, waterMl: 2200, fiber: 28 },
      entries: [],
      waterEntries: [{ id: "water_b", timestamp: "2026-05-18T09:00:00", milliliters: "500" }]
    }]
  });

  assert.equal(normalized.activeProfileId, "profile_a");
  assert.equal(normalized.profiles.length, 2);
  assert.equal(normalized.profiles[0].entries[0].items[0].nutrition.fiber, 0.3);
  assert.equal(normalized.profiles[1].waterEntries[0].milliliters, 500);
  assert.equal(activeRecordState(normalized).entries[0].id, "entry_a");
});
```

- [ ] **Step 2: Update existing store expectations for profile shape**

In `tests/store.test.mjs`, replace direct `normalized.entries` and `normalized.waterEntries` assertions with `getActiveProfile(normalized).entries` and `getActiveProfile(normalized).waterEntries`. For example:

```js
const active = getActiveProfile(normalized);
assert.deepEqual(active.entries, [
  {
    id: "entry_valid",
    timestamp: "2026-05-18T12:00:00+08:00",
    items: [
      {
        foodId: "food_milk",
        amount: 250,
        unit: "ml",
        grams: 250,
        nutrition: { calories: 152.5, protein: 8, carbs: 0, fat: 0, sodium: 105, fiber: 0 }
      }
    ],
    note: "",
    photo: ""
  }
]);
```

Update normalized nutrition expectations to include `fiber: 0` unless the input included another valid fiber value.

- [ ] **Step 3: Run store tests to verify failure**

Run:

```bash
node --test tests/store.test.mjs
```

Expected: FAIL because `normalizeState` still returns top-level `entries`, `waterEntries`, `profile`, and `dailyGoal`.

- [ ] **Step 4: Update imports and nutrition normalization**

In `src/store.js`, update the domain import:

```js
import {
  DEFAULT_PROFILE_ID,
  EMPTY_NUTRITION,
  ICON_OPTIONS,
  createDefaultState,
  createLocalProfile,
  nonNegativeFiniteNumber,
  positiveFiniteNumber,
  roundMetric
} from "./domain.js";
```

Replace `normalizeNutrition` with:

```js
function normalizeNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== "object") return { ...EMPTY_NUTRITION };

  return {
    calories: nonNegativeFiniteNumber(nutrition.calories, 0),
    protein: nonNegativeFiniteNumber(nutrition.protein, 0),
    carbs: nonNegativeFiniteNumber(nutrition.carbs, 0),
    fat: nonNegativeFiniteNumber(nutrition.fat, 0),
    sodium: nonNegativeFiniteNumber(nutrition.sodium, 0),
    fiber: nonNegativeFiniteNumber(nutrition.fiber, 0)
  };
}
```

Update `isValidNutrition` so `fiber` is optional but valid when present:

```js
const fiberValid = nutrition.fiber === undefined || (() => {
  const number = Number(nutrition.fiber);
  return Number.isFinite(number) && number >= 0;
})();
return baseValid && sodiumValid && fiberValid;
```

Update `scaleNutrition` with `fiber`.

- [ ] **Step 5: Normalize daily goals with fiber**

In `normalizeDailyGoal`, include:

```js
fiber: normalizeGoalValue(dailyGoal.fiber, defaults.dailyGoal.fiber)
```

- [ ] **Step 6: Add profile normalization helpers**

Add this code before `normalizeState` in `src/store.js`:

```js
function normalizeProfileId(value, fallback) {
  const id = typeof value === "string" ? value.trim() : "";
  return id || fallback;
}

function normalizeProfileName(value, fallback) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || fallback;
}

function normalizeLocalProfile(profile, defaults, fallbackId, fallbackName) {
  const source = profile && typeof profile === "object" ? profile : {};
  return createLocalProfile({
    id: normalizeProfileId(source.id, fallbackId),
    name: normalizeProfileName(source.name, fallbackName),
    profile: normalizeProfile(source.profile, defaults),
    dailyGoal: normalizeDailyGoal(source.dailyGoal, defaults),
    entries: normalizeEntries(source.entries),
    waterEntries: normalizeWaterEntries(source.waterEntries)
  });
}

function normalizeProfiles(state, defaults) {
  if (Array.isArray(state.profiles) && state.profiles.length > 0) {
    const seen = new Set();
    const profiles = state.profiles.flatMap((profile, index) => {
      const normalized = normalizeLocalProfile(profile, defaults.profiles[0], `profile_${index + 1}`, `档案 ${index + 1}`);
      if (!normalized.id || seen.has(normalized.id)) return [];
      seen.add(normalized.id);
      return [normalized];
    });
    return profiles.length > 0 ? profiles : defaults.profiles;
  }

  return [
    createLocalProfile({
      id: DEFAULT_PROFILE_ID,
      name: "日常维持",
      profile: normalizeProfile(state.profile, defaults.profiles[0]),
      dailyGoal: normalizeDailyGoal(state.dailyGoal, defaults.profiles[0]),
      entries: normalizeEntries(state.entries),
      waterEntries: normalizeWaterEntries(state.waterEntries)
    })
  ];
}
```

- [ ] **Step 7: Replace normalizeState return shape**

Replace `normalizeState` in `src/store.js` with:

```js
export function normalizeState(input) {
  const defaults = createDefaultState();
  const state = input && typeof input === "object" ? input : {};
  const categories = normalizeCategories(state.categories, defaults, state.foods);
  const profiles = normalizeProfiles(state, defaults);
  const activeProfileId = profiles.some((profile) => profile.id === state.activeProfileId)
    ? state.activeProfileId
    : profiles[0].id;

  return {
    activeProfileId,
    profiles,
    categories,
    foods: normalizeFoods(state.foods, defaults, categories)
  };
}
```

- [ ] **Step 8: Update photo stripping helpers for profile shape**

Replace `stripEntryPhotos` and `hasOversizedEntryPhoto`:

```js
function stripEntryPhotos(state) {
  let droppedPhotos = false;
  const profiles = state.profiles.map((profile) => ({
    ...profile,
    entries: profile.entries.map((entry) => {
      if (!entry.photo) return entry;
      droppedPhotos = true;
      return { ...entry, photo: "" };
    })
  }));
  return { state: { ...state, profiles }, droppedPhotos };
}

function hasOversizedEntryPhoto(state) {
  return Array.isArray(state?.profiles)
    && state.profiles.some((profile) => (
      Array.isArray(profile.entries)
      && profile.entries.some((entry) => dataUrlBytes(entry?.photo) > MAX_STORED_DATA_URL_BYTES)
    ));
}
```

- [ ] **Step 9: Update importState shape detection**

Replace the `hasStateShape` check in `importState` with:

```js
const hasStateShape = parsed
  && typeof parsed === "object"
  && !Array.isArray(parsed)
  && ["categories", "foods", "profiles", "activeProfileId", "entries", "waterEntries", "profile", "dailyGoal"].some((key) => key in parsed);
```

- [ ] **Step 10: Run store tests**

Run:

```bash
node --test tests/store.test.mjs
```

Expected: PASS.

- [ ] **Step 11: Run domain and store tests together**

Run:

```bash
npm test
```

Expected: PWA tests may still fail because the UI has not been updated; domain and store tests should pass.

- [ ] **Step 12: Commit Task 2**

Run:

```bash
git add src/store.js tests/store.test.mjs
git commit -m "feat: migrate storage to local profiles"
```

## Task 3: UI Utility Modules And Recognition Interface

**Files:**
- Create: `src/ui/format.js`
- Create: `src/ui/image.js`
- Create: `src/recognition.js`
- Create: `src/views/today.js`
- Create: `src/views/foods.js`
- Create: `src/views/stats.js`
- Create: `src/views/settings.js`
- Modify: `src/app.js`
- Modify: `sw.js`
- Test: `tests/pwa.test.mjs`

- [ ] **Step 1: Add failing PWA tests for new modules and recognition scaffold**

Append these tests to `tests/pwa.test.mjs`:

```js
test("service worker precaches split app modules", () => {
  const sw = readText("../sw.js");

  for (const asset of [
    "./src/ui/format.js",
    "./src/ui/image.js",
    "./src/recognition.js",
    "./src/views/today.js",
    "./src/views/foods.js",
    "./src/views/stats.js",
    "./src/views/settings.js"
  ]) {
    assert.match(sw, new RegExp(asset.replaceAll(".", "\\.")));
  }
});

test("recognition interface is scaffolded without visible AI buttons", () => {
  const recognition = readText("../src/recognition.js");
  const app = readText("../src/app.js");

  assert.match(recognition, /RecognitionNotConfiguredError/);
  assert.match(recognition, /recognizeNutritionLabel/);
  assert.match(recognition, /recognizeFoodPhoto/);
  assert.match(recognition, /source: "nutrition_label"/);
  assert.match(recognition, /source: "food_photo"/);
  assert.doesNotMatch(app, /拍照识别|recognizeNutritionLabel|recognizeFoodPhoto/);
});
```

- [ ] **Step 2: Run PWA tests to verify failure**

Run:

```bash
node --test tests/pwa.test.mjs
```

Expected: FAIL because split modules and service worker entries do not exist.

- [ ] **Step 3: Create `src/ui/format.js`**

Create `src/ui/format.js`:

```js
import { kilojoulesToCalories } from "../domain.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("zh-CN", {
    maximumFractionDigits: digits
  });
}

export function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

export function amountLabel(amount, unit = "g", digits = 1) {
  return `${formatNumber(amount, digits)}${unit}`;
}

export function itemAmountLabel(item) {
  return amountLabel(item.amount ?? item.grams ?? 0, item.unit || "g");
}

export function caloriesFromEnergyInputs(caloriesValue, kilojoulesValue) {
  const calories = Number(caloriesValue);
  if (Number.isFinite(calories) && calories >= 0) return calories;
  return kilojoulesToCalories(kilojoulesValue);
}
```

- [ ] **Step 4: Create `src/ui/image.js`**

Create `src/ui/image.js`:

```js
export const IMAGE_MAX_DIMENSION = 1200;
export const IMAGE_QUALITY = 0.72;

export function dataUrlTooLarge(dataUrl, maxBytes) {
  return typeof dataUrl === "string" && new Blob([dataUrl]).size > maxBytes;
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("照片读取失败"));
    image.src = URL.createObjectURL(file);
  });
}

export async function compressImage(file, options = {}) {
  const maxDimension = options.maxDimension || IMAGE_MAX_DIMENSION;
  const quality = options.quality || IMAGE_QUALITY;
  const image = await loadImageElement(file);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);
  return canvas.toDataURL("image/jpeg", quality);
}

export function readRawImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("照片读取失败"));
    reader.readAsDataURL(file);
  });
}

export async function readImage(file, maxBytes) {
  if (!file) return "";
  const compressed = await compressImage(file);
  if (!dataUrlTooLarge(compressed, maxBytes)) return compressed;
  const raw = await readRawImage(file);
  return dataUrlTooLarge(raw, maxBytes) ? "" : raw;
}
```

- [ ] **Step 5: Create `src/recognition.js`**

Create `src/recognition.js`:

```js
export class RecognitionNotConfiguredError extends Error {
  constructor() {
    super("识别服务尚未配置");
    this.name = "RecognitionNotConfiguredError";
  }
}

export function nutritionLabelResultDraft(overrides = {}) {
  return {
    source: "nutrition_label",
    foodName: overrides.foodName || "",
    basis: "per100g",
    nutritionPer100g: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sodium: 0,
      fiber: 0,
      ...(overrides.nutritionPer100g || {})
    },
    notes: Array.isArray(overrides.notes) ? overrides.notes : [],
    confidence: Number.isFinite(Number(overrides.confidence)) ? Number(overrides.confidence) : 0
  };
}

export function foodPhotoResultDraft(overrides = {}) {
  return {
    source: "food_photo",
    candidates: Array.isArray(overrides.candidates) ? overrides.candidates : []
  };
}

export async function recognizeNutritionLabel() {
  throw new RecognitionNotConfiguredError();
}

export async function recognizeFoodPhoto() {
  throw new RecognitionNotConfiguredError();
}
```

- [ ] **Step 6: Move app formatting imports**

At the top of `src/app.js`, import format helpers:

```js
import {
  amountLabel,
  caloriesFromEnergyInputs,
  escapeAttr,
  escapeHtml,
  formatNumber,
  formatTime,
  itemAmountLabel
} from "./ui/format.js";
```

Remove the local definitions of `escapeHtml`, `escapeAttr`, `formatNumber`, `formatTime`, `amountLabel`, and `itemAmountLabel` from `src/app.js`.

- [ ] **Step 7: Create temporary view module shells**

Create `src/views/today.js`:

```js
export function renderToday() {
  return "";
}

export function isWaterFood(food) {
  return food?.id === "food_water" || food?.category === "水";
}

export function foodLabel(food) {
  return food?.name || "未知食物";
}

export function renderCategoryChips() {
  return "";
}
```

Create `src/views/foods.js`:

```js
export function renderFoods() {
  return "";
}

export function renderFoodRows() {
  return "";
}

export function openFoodForm() {}

export function openCategoryManager() {}
```

Create `src/views/stats.js`:

```js
export function renderStats() {
  return "";
}
```

Create `src/views/settings.js`:

```js
export function renderSettings() {
  return "";
}
```

These shells make service worker precaching valid before the real view extraction happens in Task 5. `src/app.js` does not import these shells yet.

- [ ] **Step 8: Move app image imports**

At the top of `src/app.js`, import image helpers:

```js
import { readImage } from "./ui/image.js";
```

Remove `IMAGE_MAX_DIMENSION`, `IMAGE_QUALITY`, `dataUrlTooLarge`, `loadImageElement`, `compressImage`, `readRawImage`, and the local `readImage` implementation from `src/app.js`.

- [ ] **Step 9: Update service worker app shell**

In `sw.js`, add these assets to `APP_SHELL`:

```js
"./src/ui/format.js",
"./src/ui/image.js",
"./src/recognition.js",
"./src/views/today.js",
"./src/views/foods.js",
"./src/views/stats.js",
"./src/views/settings.js",
```

- [ ] **Step 10: Run checks**

Run:

```bash
node --check src/ui/format.js
node --check src/ui/image.js
node --check src/recognition.js
node --check src/views/today.js
node --check src/views/foods.js
node --check src/views/stats.js
node --check src/views/settings.js
node --check src/app.js
node --check sw.js
node --test tests/pwa.test.mjs
```

Expected: PASS.

- [ ] **Step 11: Commit Task 3**

Run:

```bash
git add src/app.js src/ui/format.js src/ui/image.js src/recognition.js src/views/today.js src/views/foods.js src/views/stats.js src/views/settings.js sw.js tests/pwa.test.mjs
git commit -m "refactor: split ui utilities"
```

## Task 4: Profile-Aware App State And Food Form Energy Inputs

**Files:**
- Modify: `src/app.js`
- Modify: `tests/pwa.test.mjs`

- [ ] **Step 1: Add failing PWA tests for fiber, kJ, and profile controls**

Append these tests to `tests/pwa.test.mjs`:

```js
test("food form supports kilojoule helper input and dietary fiber", () => {
  const app = readText("../src/app.js");

  assert.match(app, /name="kilojoules"/);
  assert.match(app, /name="fiber"/);
  assert.match(app, /caloriesFromEnergyInputs/);
  assert.match(app, /nutritionPer100g:\s*\{[\s\S]*fiber/);
});

test("settings source renders local profile controls", () => {
  const app = readText("../src/app.js");

  assert.match(app, /name="activeProfileId"/);
  assert.match(app, /data-action="add-profile"/);
  assert.match(app, /data-action="rename-profile"/);
  assert.match(app, /data-action="delete-profile"/);
  assert.match(app, /当前档案/);
});

test("today source renders active profile name and uses active record state", () => {
  const app = readText("../src/app.js");

  assert.match(app, /activeRecordState\(state\)/);
  assert.match(app, /getActiveProfile\(state\)/);
  assert.match(app, /profile-name/);
});
```

- [ ] **Step 2: Run PWA tests to verify failure**

Run:

```bash
node --test tests/pwa.test.mjs
```

Expected: FAIL because the app does not yet render profile controls or fiber/kJ inputs.

- [ ] **Step 3: Update app domain imports**

In `src/app.js`, add the new domain helpers:

```js
addLocalProfile,
activeRecordState,
deleteLocalProfile,
getActiveProfile,
renameLocalProfile,
setActiveProfile,
updateActiveProfile
```

The import block should include these names from `./domain.js`.

- [ ] **Step 4: Read active profile in render helpers**

In `src/app.js`, update `renderSummary`, `renderStructure`, `renderTimeline`, `renderStats`, and `exportRange` to use:

```js
const recordState = activeRecordState(state);
```

Examples:

```js
function renderSummary(day) {
  const summary = summarizeDay(activeRecordState(state), day);
  ...
}
```

```js
function renderStats() {
  const stats = trendStats(activeRecordState(state), dateKey(), statsDays);
  ...
}
```

```js
function exportRange(days, format) {
  const rows = exportLogRows(activeRecordState(state), dateKey(), Number(days) === 30 ? 30 : 7);
  ...
}
```

- [ ] **Step 5: Render active profile name on today page**

In `renderToday`, add the active profile name above the summary:

```js
function renderToday() {
  const day = dateKey();
  const activeProfile = getActiveProfile(state);
  todayLabel.textContent = day;
  root.innerHTML = `
    <section class="panel compact profile-banner">
      <span class="hint">当前档案</span>
      <strong class="profile-name">${escapeHtml(activeProfile.name)}</strong>
    </section>
    ${renderSummary(day)}
    ${renderStructure(day)}
    ${renderQuickAdd()}
    ${renderTimeline(day)}
  `;
}
```

- [ ] **Step 6: Render fiber in structure icons**

In `structureIcon`, add:

```js
if (key === "fiber") return "🌾";
```

Ensure `renderStructure` iterates over `dailyStructure(activeRecordState(state), day)` so fiber appears when domain returns it.

- [ ] **Step 7: Update entry submit to write current profile**

In `handleEntrySubmit`, replace direct mutations of `state.entries` and `state.waterEntries` with `updateActiveProfile`.

Use this pattern after building `entry` and `waterEntries`:

```js
state = updateActiveProfile(state, (profile) => {
  const nextEntries = profile.entries.filter((item) => item.id !== entryDraft.entryId);
  const nextWaterEntries = profile.waterEntries.filter((item) => item.id !== entryDraft.entryId);
  for (const waterEntry of waterEntries) nextWaterEntries.push(waterEntry);
  if (entry.items.length > 0) nextEntries.push(entry);
  return {
    ...profile,
    entries: nextEntries,
    waterEntries: nextWaterEntries
  };
});
```

When editing an existing food entry, preserve the old timestamp from `entryDraft.timestamp`.

- [ ] **Step 8: Update delete entry and delete water actions**

In the global click handler, replace delete mutations with:

```js
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
```

- [ ] **Step 9: Add kJ and fiber inputs to food form**

In `openFoodForm`, add fields:

```html
<label class="field"><span>热量 kcal / 100g</span><input name="calories" inputmode="decimal" value="${escapeAttr(food?.nutritionPer100g?.calories ?? "")}"></label>
<label class="field"><span>千焦 kJ / 100g</span><input name="kilojoules" inputmode="decimal" placeholder="可选，保存时换算为 kcal"></label>
<label class="field"><span>膳食纤维 g / 100g</span><input name="fiber" inputmode="decimal" value="${escapeAttr(food?.nutritionPer100g?.fiber ?? 0)}"></label>
```

Keep the existing protein/carbs/fat/sodium fields.

- [ ] **Step 10: Use kJ conversion and fiber in food submit**

In `handleFoodSubmit`, build nutrition with:

```js
const calories = caloriesFromEnergyInputs(data.get("calories"), data.get("kilojoules"));
const nutritionPer100g = {
  calories,
  protein: nonNegativeFiniteNumber(data.get("protein"), 0),
  carbs: nonNegativeFiniteNumber(data.get("carbs"), 0),
  fat: nonNegativeFiniteNumber(data.get("fat"), 0),
  sodium: nonNegativeFiniteNumber(data.get("sodium"), 0),
  fiber: nonNegativeFiniteNumber(data.get("fiber"), 0)
};
```

Use `nutritionPer100g` in the saved food object.

- [ ] **Step 11: Add profile controls to settings render**

In `renderSettings`, add this block before personal goal fields:

```html
<section class="panel">
  <div class="section-head">
    <h2>档案</h2>
  </div>
  <label class="field">
    <span>当前档案</span>
    <select name="activeProfileId" data-action="set-active-profile">
      ${state.profiles.map((profile) => `<option value="${escapeAttr(profile.id)}" ${profile.id === state.activeProfileId ? "selected" : ""}>${escapeHtml(profile.name)}</option>`).join("")}
    </select>
  </label>
  <div class="action-row">
    <button class="button secondary" type="button" data-action="add-profile">新增档案</button>
    <button class="button secondary" type="button" data-action="rename-profile" data-profile-id="${escapeAttr(state.activeProfileId)}">重命名</button>
    <button class="button danger" type="button" data-action="delete-profile" data-profile-id="${escapeAttr(state.activeProfileId)}">删除</button>
  </div>
</section>
```

Use `const activeProfile = getActiveProfile(state);` and read settings form values from `activeProfile.profile` and `activeProfile.dailyGoal`.

- [ ] **Step 12: Add profile event handlers**

In the click handler:

```js
if (action === "add-profile") {
  const name = prompt("档案名称", "新档案");
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
if (action === "delete-profile" && confirm("删除当前档案？该档案下的记录会一起删除。")) {
  try {
    state = deleteLocalProfile(state, target.dataset.profileId || state.activeProfileId);
    saveAndRender();
  } catch (error) {
    alert(error.message || "档案删除失败");
  }
}
```

In the change handler:

```js
const profileSelect = event.target.closest('select[data-action="set-active-profile"]');
if (profileSelect) {
  try {
    state = setActiveProfile(state, profileSelect.value);
    saveAndRender();
  } catch (error) {
    alert(error.message || "档案切换失败");
  }
  return;
}
```

- [ ] **Step 13: Save settings into active profile**

In the submit handler for `save-settings`, replace direct `state.dailyGoal` and `state.profile` mutation with:

```js
state = updateActiveProfile(state, (profile) => ({
  ...profile,
  dailyGoal: {
    calories: goalInputValue(data.get("calories")),
    protein: goalInputValue(data.get("protein")),
    waterMl: goalInputValue(data.get("waterMl")),
    fiber: goalInputValue(data.get("fiber"))
  },
  profile: {
    sex: data.get("sex") === "male" ? "male" : "female",
    age: positiveFiniteNumber(data.get("age"), profile.profile.age),
    heightCm: positiveFiniteNumber(data.get("heightCm"), profile.profile.heightCm),
    weightKg: positiveFiniteNumber(data.get("weightKg"), profile.profile.weightKg),
    activityLevel: String(data.get("activityLevel") || profile.profile.activityLevel),
    goal: String(data.get("goal") || profile.profile.goal)
  }
}));
```

Add a settings input for `fiber`:

```html
<label class="field"><span>膳食纤维目标 g</span><input name="fiber" inputmode="decimal" value="${escapeAttr(activeProfile.dailyGoal.fiber ?? "")}"></label>
```

- [ ] **Step 14: Run focused checks**

Run:

```bash
node --check src/app.js
node --test tests/pwa.test.mjs
npm test
```

Expected: PWA tests may still fail if static regexes reference old function boundaries that will move in Task 5; domain and store tests should pass.

- [ ] **Step 15: Commit Task 4**

Run:

```bash
git add src/app.js tests/pwa.test.mjs
git commit -m "feat: add profile-aware app controls"
```

## Task 5: Extract View Modules

**Files:**
- Modify: `src/views/today.js`
- Modify: `src/views/foods.js`
- Modify: `src/views/stats.js`
- Modify: `src/views/settings.js`
- Modify: `src/app.js`
- Modify: `tests/pwa.test.mjs`

- [ ] **Step 1: Update PWA tests to inspect split files**

At the top of `tests/pwa.test.mjs`, add helpers:

```js
function readAppModule(path) {
  return readText(path);
}
```

Update tests that currently inspect `../src/app.js` blocks so they inspect the new view files:

```js
const today = readAppModule("../src/views/today.js");
const foods = readAppModule("../src/views/foods.js");
const stats = readAppModule("../src/views/stats.js");
const settings = readAppModule("../src/views/settings.js");
```

Examples:

- quick-add tests read `today`.
- timeline tests read `today`.
- structure tests read `today`.
- food form tests read `foods`.
- category manager tests read `foods`.
- stats tests read `stats`.
- settings tests read `settings`.

- [ ] **Step 2: Run PWA tests to verify failure**

Run:

```bash
node --test tests/pwa.test.mjs
```

Expected: FAIL because view modules do not yet contain the moved render functions.

- [ ] **Step 3: Replace `src/views/today.js` shell**

Move today-related rendering helpers from `src/app.js` into `src/views/today.js`:

- `foodLabel`
- `isWaterFood`
- `thumbHtml`
- `quickThumbHtml`
- `categoryLabel`
- `renderCategoryChips`
- `renderSummary`
- `statusLabel`
- `structureIcon`
- `renderStructure`
- `renderQuickAdd`
- `renderTimeline`
- `renderToday`

Export the functions needed by `app.js`:

```js
export {
  foodLabel,
  isWaterFood,
  renderCategoryChips,
  renderToday
};
```

Design the module function signatures so it receives dependencies instead of reading globals directly:

```js
export function renderToday(context) {
  const { state, quickCategory, todayLabel } = context;
  const day = dateKey();
  const activeProfile = getActiveProfile(state);
  todayLabel.textContent = day;
  return `
    <section class="panel compact profile-banner">
      <span class="hint">当前档案</span>
      <strong class="profile-name">${escapeHtml(activeProfile.name)}</strong>
    </section>
    ${renderSummary(context, day)}
    ${renderStructure(context, day)}
    ${renderQuickAdd(context)}
    ${renderTimeline(context, day)}
  `;
}
```

- [ ] **Step 4: Replace `src/views/foods.js` shell**

Move food-related rendering helpers from `src/app.js` into `src/views/foods.js`:

- `renderFoodRows`
- `renderFoods`
- `openFoodForm`
- `openCategoryManager`
- food icon picker markup helpers used by those functions

Export:

```js
export {
  openCategoryManager,
  openFoodForm,
  renderFoodRows,
  renderFoods
};
```

Use context parameters:

```js
export function renderFoods(context) {
  const { state, foodLibraryCategory, foodSearchQuery } = context;
  ...
}
```

For modal functions:

```js
export function openFoodForm(context, foodId = "") {
  const { state, modalRoot } = context;
  ...
}
```

- [ ] **Step 5: Replace `src/views/stats.js` shell**

Move stats rendering from `src/app.js` into `src/views/stats.js`:

- `renderStats`
- `trendLabel`

Export:

```js
export { renderStats };
```

Use:

```js
const stats = trendStats(activeRecordState(state), dateKey(), statsDays);
```

- [ ] **Step 6: Replace `src/views/settings.js` shell**

Move settings rendering from `src/app.js` into `src/views/settings.js`:

- `goalInputValue` stays in `app.js` if only submit needs it.
- `renderSettings` moves to this module.

Export:

```js
export { renderSettings };
```

Render profile controls and current active profile fields from context.

- [ ] **Step 7: Update `src/app.js` imports and render router**

Add:

```js
import { renderToday, isWaterFood, foodLabel } from "./views/today.js";
import { openCategoryManager, openFoodForm, renderFoodRows, renderFoods } from "./views/foods.js";
import { renderStats } from "./views/stats.js";
import { renderSettings } from "./views/settings.js";
```

Add a helper:

```js
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
    todayLabel
  };
}
```

Update `render`:

```js
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
```

For modal opens:

```js
openFoodForm(viewContext(), target.dataset.foodId || "");
openCategoryManager(viewContext());
```

- [ ] **Step 8: Keep draft modal in app.js**

Leave entry draft functions in `src/app.js` for this task:

- `closeModal`
- `cloneEntryItems`
- `createDraftItem`
- `draftTitle`
- `renderDraftItems`
- `updateEntryDraftFromForm`
- `renderEntryModal`
- `openEntryModal`
- `handleEntrySubmit`

This keeps the extraction bounded and avoids moving stateful modal behavior at the same time as page rendering.

- [ ] **Step 9: Run checks**

Run:

```bash
node --check src/app.js
node --check src/views/today.js
node --check src/views/foods.js
node --check src/views/stats.js
node --check src/views/settings.js
node --test tests/pwa.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 10: Commit Task 5**

Run:

```bash
git add src/app.js src/views/today.js src/views/foods.js src/views/stats.js src/views/settings.js tests/pwa.test.mjs
git commit -m "refactor: extract app views"
```

## Task 6: Styling, Documentation, And Full Verification

**Files:**
- Modify: `src/styles.css`
- Modify: `README.md`
- Modify: `docs/CURRENT.md`
- Test: all tests and browser/static smoke

- [ ] **Step 1: Add profile and energy form styles**

Add to `src/styles.css` near related panel/form styles:

```css
.profile-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profile-name {
  font-size: 1rem;
  line-height: 1.2;
}

.action-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.button.danger {
  background: #7f1d1d;
  color: #fff;
}

.metric-fiber .progress-fill {
  background: #16a34a;
}
```

If `.action-row` or `.button.danger` already exists, merge these declarations with the existing rules instead of duplicating selectors.

- [ ] **Step 2: Update README scope**

In `README.md`, update the scope list with these bullets:

```markdown
- 食物营养统一按每 100g 录入，支持 kcal，也支持在录入时用 kJ 自动换算 kcal。
- 营养汇总包含热量、蛋白质、碳水、脂肪、膳食纤维和饮水；导出明细仍保留钠字段。
- 支持本地档案/阶段；食物库共享，记录、饮水、个人资料和目标按档案隔离。
- 拍照识别接口仅预留，当前版本不上传照片、不调用识别服务。
```

Remove or adjust older bullets that conflict with these statements.

- [ ] **Step 3: Update CURRENT.md**

In `docs/CURRENT.md`, update:

- `更新时间` to `2026-05-19`.
- latest completion commit after the final implementation commit.
- completed feature bullets for fiber, kJ input, local profiles, and recognition scaffold.
- verification commands and outcomes.
- next candidate list to mention real LLM recognition as a future item.

Keep `docs/CURRENT.md` concise and avoid pasting the full design.

- [ ] **Step 4: Run full automated verification**

Run:

```bash
npm test
TZ=America/Los_Angeles npm test
node --check src/app.js
node --check src/domain.js
node --check src/store.js
node --check src/ui/format.js
node --check src/ui/image.js
node --check src/recognition.js
node --check src/views/today.js
node --check src/views/foods.js
node --check src/views/stats.js
node --check src/views/settings.js
node --check sw.js
git diff --check
```

Expected: all commands pass.

- [ ] **Step 5: Run local static smoke**

Start the static server:

```bash
npm run serve
```

Open another shell or use the existing server session and run:

```bash
curl -sSf http://127.0.0.1:4173/
curl -sSf http://127.0.0.1:4173/src/app.js
curl -sSf http://127.0.0.1:4173/src/views/today.js
curl -sSf http://127.0.0.1:4173/src/ui/format.js
curl -sSf http://127.0.0.1:4173/manifest.webmanifest
```

Expected: all curl commands exit `0` and return content.

- [ ] **Step 6: Manual browser smoke**

In the local app:

1. Open settings.
2. Add a new档案 named `减脂期`.
3. Save a fiber target of `28`.
4. Create a food named `高纤测试` with `kilojoules: 418.4`, blank kcal, and `fiber: 10`.
5. Record `100g` of `高纤测试`.
6. Confirm today structure shows fiber and the entry displays about `100 kcal`.
7. Switch back to `日常维持`.
8. Confirm the `减脂期` entry is not shown while the shared food still exists in the food page.

- [ ] **Step 7: Commit Task 6**

Run:

```bash
git add src/styles.css README.md docs/CURRENT.md
git commit -m "docs: update nutrition profiles status"
```

## Final Verification Checklist

- [ ] `npm test` passes.
- [ ] `TZ=America/Los_Angeles npm test` passes.
- [ ] All `node --check` commands from Task 6 pass.
- [ ] `git diff --check` passes.
- [ ] Local static smoke passes.
- [ ] Manual browser smoke passes or any unrun manual step is explicitly recorded in `docs/CURRENT.md`.
- [ ] Worktree is clean after final commit.
