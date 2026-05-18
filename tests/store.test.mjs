import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultState } from "../src/domain.js";
import {
  MAX_STORED_DATA_URL_BYTES,
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

test("loads default simplified state when storage is empty", () => {
  const state = createStore(memoryStorage()).load();

  assert.equal(state.foods.length >= 50, true);
  assert.equal(state.categories.some((category) => category.name === "其他"), true);
  assert.equal("portions" in state, false);
  assert.equal("calibration" in state, false);
  assert.deepEqual(state.entries, []);
});

test("clears corrupt persisted state and loads defaults", () => {
  const storage = memoryStorage();
  storage.setItem("chileme.state.v1", "{bad json");

  const state = createStore(storage).load();

  assert.equal(state.foods.length >= 50, true);
  assert.equal(state.entries.length, 0);
  assert.equal(storage.getItem("chileme.state.v1"), null);
});

test("normalizes legacy food categories, nutrition, and simplified shape", () => {
  const normalized = normalizeState({
    categories: [
      { id: "category_custom", name: "自定义", icon: "⭐" },
      { id: "", name: "", icon: "" }
    ],
    foods: [
      {
        id: " legacy_rice ",
        name: " 旧米饭 ",
        category: "主食",
        emoji: "🍚",
        image: 42,
        nutrition: { calories: 88, protein: 3, carbs: 12, fat: 2 }
      },
      {
        id: "legacy_custom",
        name: "旧自定义",
        category: "自定义",
        icon: "⭐",
        image: "data:image/png;base64,ok",
        nutritionPer100g: { calories: 120, protein: 4, carbs: 20, fat: 3, sodium: 30 },
        quickAdd: false
      },
      {
        id: "legacy_unknown",
        name: "未知分类",
        category: "过期分类",
        nutrition: { calories: 1, protein: 1, carbs: 1, fat: 1, sodium: 1 }
      }
    ],
    portions: [{ id: "old", foodId: "legacy_rice", label: "旧份量", grams: 80 }],
    calibration: { fistWidthCm: 10 }
  });

  assert.equal("portions" in normalized, false);
  assert.equal("calibration" in normalized, false);
  assert.ok(normalized.categories.find((category) => category.name === "自定义"));
  assert.equal(normalized.foods.find((food) => food.id === "legacy_rice").category, "细粮");
  assert.deepEqual(normalized.foods.find((food) => food.id === "legacy_rice").nutritionPer100g, {
    calories: 88,
    protein: 3,
    carbs: 12,
    fat: 2,
    sodium: 0
  });
  assert.equal(normalized.foods.find((food) => food.id === "legacy_rice").icon, "🍚");
  assert.equal(normalized.foods.find((food) => food.id === "legacy_custom").category, "自定义");
  assert.equal(normalized.foods.find((food) => food.id === "legacy_custom").quickAdd, false);
  assert.equal(normalized.foods.find((food) => food.id === "legacy_unknown").category, "其他");
});

test("maps legacy food categories even when old categories were persisted", () => {
  const normalized = normalizeState({
    categories: [
      { id: "old_staple", name: "主食", icon: "🍚" },
      { id: "custom_breakfast", name: "早餐", icon: "🌅" }
    ],
    foods: [{
      id: "legacy_rice",
      name: "旧米饭",
      category: "主食",
      kind: "regular",
      nutritionMode: "per100g",
      nutrition: { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3, sodium: 1 }
    }, {
      id: "custom_breakfast_food",
      name: "早餐组合",
      category: "早餐",
      nutritionPer100g: { calories: 200, protein: 8, carbs: 30, fat: 5, sodium: 200 }
    }]
  });

  assert.equal(normalized.categories.some((category) => category.name === "主食"), false);
  assert.ok(normalized.categories.find((category) => category.name === "早餐"));
  assert.equal(normalized.foods.find((food) => food.id === "legacy_rice").category, "细粮");
  assert.equal(normalized.foods.find((food) => food.id === "custom_breakfast_food").category, "早餐");
});

test("normalizes malformed foods back to built-in defaults", () => {
  const defaults = createDefaultState();
  const normalized = normalizeState({ foods: [null, { id: "", name: "", nutrition: {} }] });

  assert.deepEqual(normalized.foods, defaults.foods);
  assert.equal(normalized.foods.includes(null), false);
});

test("normalizes entries by dropping portion metadata and preserving ml as grams", () => {
  const normalized = normalizeState({
    entries: [
      {
        id: "entry_valid",
        timestamp: "2026-05-18T12:00:00+08:00",
        items: [
          {
            foodId: "food_milk",
            portionId: "portion_old",
            label: "旧杯",
            amount: "250",
            unit: "ml",
            grams: "250",
            nutrition: { calories: "152.5", protein: 8, carbs: null, fat: -1, sodium: "105" }
          },
          {
            foodId: "food_bad",
            amount: -25,
            nutrition: { calories: 99 }
          }
        ],
        note: 42,
        photo: null
      },
      {
        id: "entry_bad_timestamp",
        timestamp: "not a date",
        items: []
      }
    ],
    waterEntries: [
      { id: "water_valid", timestamp: "2026-05-18T09:00:00+08:00", milliliters: "300" },
      { id: "water_bad", timestamp: "bad", milliliters: 300 }
    ]
  });

  assert.deepEqual(normalized.entries, [
    {
      id: "entry_valid",
      timestamp: "2026-05-18T12:00:00+08:00",
      items: [
        {
          foodId: "food_milk",
          amount: 250,
          unit: "ml",
          grams: 250,
          nutrition: { calories: 152.5, protein: 8, carbs: 0, fat: 0, sodium: 105 }
        }
      ],
      note: "",
      photo: ""
    }
  ]);
  assert.deepEqual(normalized.waterEntries, [
    { id: "water_valid", timestamp: "2026-05-18T09:00:00+08:00", milliliters: 300 }
  ]);
});

test("preserves normalized profile and daily goals", () => {
  const normalized = normalizeState({
    profile: {
      sex: "male",
      age: "42",
      heightCm: "178",
      weightKg: "76",
      activityLevel: "moderate",
      goal: "gain"
    },
    dailyGoal: {
      calories: null,
      protein: 0,
      waterMl: "2300"
    }
  });

  assert.deepEqual(normalized.profile, {
    sex: "male",
    age: 42,
    heightCm: 178,
    weightKg: 76,
    activityLevel: "moderate",
    goal: "gain"
  });
  assert.deepEqual(normalized.dailyGoal, {
    calories: null,
    protein: null,
    waterMl: 2300
  });
});

test("createStore.load does not throw or erase legacy state", () => {
  const storage = memoryStorage();
  storage.setItem("chileme.state.v1", JSON.stringify({
    foods: [{
      id: "legacy_food",
      name: "旧食物",
      category: "蛋白质",
      kind: "regular",
      nutritionMode: "per100g",
      nutrition: { calories: 88, protein: 20, carbs: 1, fat: 2 }
    }],
    entries: [{
      id: "entry_legacy",
      timestamp: "2026-05-18T12:00:00+08:00",
      items: [{
        foodId: "legacy_food",
        portionId: "legacy_portion",
        label: "旧份量",
        grams: 80,
        nutrition: { calories: 70, protein: 16, carbs: 1, fat: 2 }
      }],
      note: "keep",
      photo: ""
    }]
  }));

  const state = createStore(storage).load();

  assert.equal(state.foods.find((food) => food.id === "legacy_food").category, "动物蛋白");
  assert.equal(state.entries[0].id, "entry_legacy");
  assert.equal("portionId" in state.entries[0].items[0], false);
  assert.equal("label" in state.entries[0].items[0], false);
});

test("saves and reloads simplified state", () => {
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

  const loaded = createStore(storage).load();
  assert.equal(loaded.entries[0].id, "entry_test");
  assert.equal("portions" in loaded, false);
  assert.equal("calibration" in loaded, false);
});

test("save retries without entry photos when storage quota rejects the full state", () => {
  const storage = memoryStorage();
  let attempts = 0;
  storage.setItem = (key, value) => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error("Quota exceeded");
      error.name = "QuotaExceededError";
      throw error;
    }
    storage.savedKey = key;
    storage.savedValue = value;
  };
  storage.getItem = (key) => key === storage.savedKey ? storage.savedValue : null;
  const store = createStore(storage);
  const state = createDefaultState();
  state.entries.push({
    id: "entry_photo",
    timestamp: "2026-05-18T12:00:00+08:00",
    items: [],
    note: "keep me",
    photo: `data:image/jpeg;base64,${"a".repeat(200)}`
  });

  const result = store.save(state);
  const loaded = createStore(storage).load();

  assert.equal(attempts, 2);
  assert.equal(result.droppedPhotos, true);
  assert.equal(loaded.entries[0].id, "entry_photo");
  assert.equal(loaded.entries[0].note, "keep me");
  assert.equal(loaded.entries[0].photo, "");
});

test("save reports oversized entry photos dropped during normalization", () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const state = createDefaultState();
  state.entries.push({
    id: "entry_oversized",
    timestamp: "2026-05-18T12:00:00+08:00",
    items: [],
    note: "",
    photo: `data:image/jpeg;base64,${"a".repeat(MAX_STORED_DATA_URL_BYTES)}`
  });

  const result = store.save(state);
  const loaded = createStore(storage).load();

  assert.equal(result.droppedPhotos, true);
  assert.equal(loaded.entries[0].id, "entry_oversized");
  assert.equal(loaded.entries[0].photo, "");
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
  assert.equal("portions" in imported, false);
});

test("throws a useful error for invalid import JSON", () => {
  assert.throws(() => importState("{bad json"), /无法导入数据/);
});
