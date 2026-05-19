import test from "node:test";
import assert from "node:assert/strict";
import { activeRecordState, createDefaultState, getActiveProfile } from "../src/domain.js";
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
  const active = getActiveProfile(state);

  assert.equal(state.foods.length >= 50, true);
  assert.equal(state.categories.some((category) => category.name === "其他"), true);
  assert.equal("portions" in state, false);
  assert.equal("calibration" in state, false);
  assert.deepEqual(active.entries, []);
});

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

test("clears corrupt persisted state and loads defaults", () => {
  const storage = memoryStorage();
  storage.setItem("chileme.state.v1", "{bad json");

  const state = createStore(storage).load();
  const active = getActiveProfile(state);

  assert.equal(state.foods.length >= 50, true);
  assert.equal(active.entries.length, 0);
  assert.equal(storage.getItem("chileme.state.v1"), null);
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

test("normalizes duplicate profile ids without dropping profile records", () => {
  const normalized = normalizeState({
    profiles: [{
      id: " profile_1 ",
      name: "日常",
      entries: [{
        id: "entry_first",
        timestamp: "2026-05-18T12:00:00",
        items: [],
        note: "",
        photo: ""
      }],
      waterEntries: []
    }, {
      id: "profile_1",
      name: "训练日",
      entries: [{
        id: "entry_second",
        timestamp: "2026-05-18T18:00:00",
        items: [],
        note: "",
        photo: ""
      }],
      waterEntries: [{ id: "water_second", timestamp: "2026-05-18T19:00:00", milliliters: 400 }]
    }]
  });

  assert.equal(normalized.profiles.length, 2);
  assert.equal(normalized.profiles[0].id, "profile_1");
  assert.notEqual(normalized.profiles[1].id, "profile_1");
  assert.equal(normalized.profiles[1].id.startsWith("profile_1_"), true);
  assert.equal(normalized.profiles[0].entries[0].id, "entry_first");
  assert.equal(normalized.profiles[1].entries[0].id, "entry_second");
  assert.equal(normalized.profiles[1].waterEntries[0].id, "water_second");
});

test("repairs duplicate ids without stealing later real profile ids", () => {
  const normalized = normalizeState({
    activeProfileId: "profile_1_2",
    profiles: [{
      id: "profile_1",
      name: "日常",
      entries: [{
        id: "entry_first",
        timestamp: "2026-05-18T08:00:00",
        items: [],
        note: "",
        photo: ""
      }],
      waterEntries: []
    }, {
      id: "profile_1",
      name: "重复",
      entries: [{
        id: "entry_duplicate",
        timestamp: "2026-05-18T12:00:00",
        items: [],
        note: "",
        photo: ""
      }],
      waterEntries: []
    }, {
      id: "profile_1_2",
      name: "真实后缀",
      entries: [{
        id: "entry_real_suffix",
        timestamp: "2026-05-18T18:00:00",
        items: [],
        note: "",
        photo: ""
      }],
      waterEntries: [{ id: "water_real_suffix", timestamp: "2026-05-18T19:00:00", milliliters: 500 }]
    }]
  });
  const ids = normalized.profiles.map((profile) => profile.id);

  assert.equal(normalized.profiles.length, 3);
  assert.equal(new Set(ids).size, 3);
  assert.equal(normalized.profiles[2].id, "profile_1_2");
  assert.equal(getActiveProfile(normalized).entries[0].id, "entry_real_suffix");
  assert.equal(getActiveProfile(normalized).waterEntries[0].id, "water_real_suffix");
});

test("repairs blank fallback ids without stealing later real profile ids", () => {
  const normalized = normalizeState({
    activeProfileId: "profile_1",
    profiles: [{
      id: " ",
      name: "空 ID",
      entries: [{
        id: "entry_blank",
        timestamp: "2026-05-18T08:00:00",
        items: [],
        note: "",
        photo: ""
      }],
      waterEntries: []
    }, {
      id: "profile_1",
      name: "真实 ID",
      entries: [{
        id: "entry_real",
        timestamp: "2026-05-18T12:00:00",
        items: [],
        note: "",
        photo: ""
      }],
      waterEntries: [{ id: "water_real", timestamp: "2026-05-18T13:00:00", milliliters: 350 }]
    }]
  });
  const ids = normalized.profiles.map((profile) => profile.id);

  assert.equal(normalized.profiles.length, 2);
  assert.equal(new Set(ids).size, 2);
  assert.notEqual(normalized.profiles[0].id, "profile_1");
  assert.equal(normalized.profiles[1].id, "profile_1");
  assert.equal(getActiveProfile(normalized).entries[0].id, "entry_real");
  assert.equal(getActiveProfile(normalized).waterEntries[0].id, "water_real");
});

test("normalizes active profile id before repairing active profile", () => {
  const normalized = normalizeState({
    activeProfileId: " profile_b ",
    profiles: [{
      id: "profile_a",
      name: "日常",
      entries: [],
      waterEntries: []
    }, {
      id: " profile_b ",
      name: "减脂期",
      entries: [{
        id: "entry_b",
        timestamp: "2026-05-18T12:00:00",
        items: [],
        note: "",
        photo: ""
      }],
      waterEntries: []
    }]
  });

  assert.equal(normalized.activeProfileId, "profile_b");
  assert.equal(getActiveProfile(normalized).entries[0].id, "entry_b");
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
        id: "legacy_fruit",
        name: "旧水果",
        category: "蔬果",
        emoji: "🍎",
        nutrition: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2 }
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
  assert.equal(normalized.foods.find((food) => food.id === "legacy_fruit").category, "水果");
  assert.deepEqual(normalized.foods.find((food) => food.id === "legacy_rice").nutritionPer100g, {
    calories: 88,
    protein: 3,
    carbs: 12,
    fat: 2,
    sodium: 0,
    fiber: 0
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

test("saving renamed built-in categories does not recreate the old default category", () => {
  const state = createDefaultState();
  state.categories = state.categories.map((category) => (
    category.name === "细粮" ? { ...category, id: "category_主食", name: "主食" } : category
  ));
  state.foods = state.foods.map((food) => (
    food.category === "细粮" ? { ...food, category: "主食" } : food
  ));

  const normalized = normalizeState(state);

  assert.equal(normalized.categories.some((category) => category.name === "细粮"), false);
  assert.equal(normalized.categories.filter((category) => category.name === "主食").length, 1);
  assert.equal(normalized.foods.find((food) => food.id === "food_rice").category, "主食");
});

test("normalizes existing duplicate category left by a previous built-in rename save", () => {
  const state = createDefaultState();
  state.categories = [
    ...state.categories,
    { id: "category_主食", name: "主食", icon: "🍚" }
  ];
  state.foods = state.foods.map((food) => (
    food.category === "细粮" ? { ...food, category: "主食" } : food
  ));

  const normalized = normalizeState(state);

  assert.equal(normalized.categories.some((category) => category.name === "细粮"), false);
  assert.equal(normalized.categories.filter((category) => category.name === "主食").length, 1);
  assert.equal(normalized.foods.find((food) => food.id === "food_rice").category, "主食");
});

test("infers implicit custom categories from legacy food rows", () => {
  const normalized = normalizeState({
    foods: [{
      id: "custom_breakfast_food",
      name: "早餐组合",
      category: "早餐",
      nutrition: { calories: 200, protein: 8, carbs: 30, fat: 5, sodium: 200 }
    }]
  });

  assert.ok(normalized.categories.find((category) => category.name === "早餐"));
  assert.equal(normalized.foods.find((food) => food.id === "custom_breakfast_food").category, "早餐");
});

test("converts legacy serving and package nutrition to per 100g", () => {
  const normalized = normalizeState({
    foods: [{
      id: "serving_food",
      name: "半份餐",
      category: "餐食",
      nutritionMode: "perServing",
      servingGrams: 50,
      nutrition: { calories: 200, protein: 10, carbs: 20, fat: 5, sodium: 100 }
    }, {
      id: "package_food",
      name: "整包零食",
      category: "零食",
      nutritionMode: "perPackage",
      packageGrams: 40,
      nutrition: { calories: 180, protein: 4, carbs: 24, fat: 8, sodium: 220 }
    }, {
      id: "drink_food",
      name: "旧饮料",
      category: "饮品",
      nutritionMode: "per100ml",
      nutrition: { calories: 45, protein: 0, carbs: 11, fat: 0, sodium: 5 }
    }]
  });

  assert.deepEqual(normalized.foods.find((food) => food.id === "serving_food").nutritionPer100g, {
    calories: 400,
    protein: 20,
    carbs: 40,
    fat: 10,
    sodium: 200,
    fiber: 0
  });
  assert.deepEqual(normalized.foods.find((food) => food.id === "package_food").nutritionPer100g, {
    calories: 450,
    protein: 10,
    carbs: 60,
    fat: 20,
    sodium: 550,
    fiber: 0
  });
  assert.deepEqual(normalized.foods.find((food) => food.id === "drink_food").nutritionPer100g, {
    calories: 45,
    protein: 0,
    carbs: 11,
    fat: 0,
    sodium: 5,
    fiber: 0
  });
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
  assert.deepEqual(active.waterEntries, [
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
  const active = getActiveProfile(normalized);

  assert.deepEqual(active.profile, {
    sex: "male",
    age: 42,
    heightCm: 178,
    weightKg: 76,
    activityLevel: "moderate",
    goal: "gain"
  });
  assert.deepEqual(active.dailyGoal, {
    calories: null,
    protein: null,
    waterMl: 2300,
    fiber: 25
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
  const active = getActiveProfile(state);

  assert.equal(state.foods.find((food) => food.id === "legacy_food").category, "动物蛋白");
  assert.equal(active.entries[0].id, "entry_legacy");
  assert.equal("portionId" in active.entries[0].items[0], false);
  assert.equal("label" in active.entries[0].items[0], false);
});

test("saves and reloads simplified state", () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const state = createDefaultState();
  getActiveProfile(state).entries.push({
    id: "entry_test",
    timestamp: "2026-05-18T12:00:00+08:00",
    items: [],
    note: "test",
    photo: ""
  });

  store.save(state);

  const loaded = createStore(storage).load();
  assert.equal(getActiveProfile(loaded).entries[0].id, "entry_test");
  assert.equal("portions" in loaded, false);
  assert.equal("calibration" in loaded, false);
});

test("saves and reloads user edits to built-in food names", () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const state = createDefaultState();
  state.foods = state.foods.map((food) => {
    if (food.id === "food_salmon") return { ...food, name: "鱼" };
    if (food.id === "food_chicken") return { ...food, name: "鸡肉" };
    if (food.id === "food_shrimp") return { ...food, name: "虾" };
    return food;
  });

  store.save(state);

  const loaded = createStore(storage).load();
  assert.equal(loaded.foods.find((food) => food.id === "food_salmon").name, "鱼");
  assert.equal(loaded.foods.find((food) => food.id === "food_chicken").name, "鸡肉");
  assert.equal(loaded.foods.find((food) => food.id === "food_shrimp").name, "虾");
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
  getActiveProfile(state).entries.push({
    id: "entry_photo",
    timestamp: "2026-05-18T12:00:00+08:00",
    items: [],
    note: "keep me",
    photo: `data:image/jpeg;base64,${"a".repeat(200)}`
  });

  const result = store.save(state);
  const loaded = createStore(storage).load();
  const active = getActiveProfile(loaded);

  assert.equal(attempts, 2);
  assert.equal(result.droppedPhotos, true);
  assert.equal(active.entries[0].id, "entry_photo");
  assert.equal(active.entries[0].note, "keep me");
  assert.equal(active.entries[0].photo, "");
});

test("save reports oversized entry photos dropped during normalization", () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const state = createDefaultState();
  getActiveProfile(state).entries.push({
    id: "entry_oversized",
    timestamp: "2026-05-18T12:00:00+08:00",
    items: [],
    note: "",
    photo: `data:image/jpeg;base64,${"a".repeat(MAX_STORED_DATA_URL_BYTES)}`
  });

  const result = store.save(state);
  const loaded = createStore(storage).load();
  const active = getActiveProfile(loaded);

  assert.equal(result.droppedPhotos, true);
  assert.equal(active.entries[0].id, "entry_oversized");
  assert.equal(active.entries[0].photo, "");
});

test("save reports oversized photos from legacy top-level entries", () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const state = {
    entries: [{
      id: "entry_legacy_oversized",
      timestamp: "2026-05-18T12:00:00+08:00",
      items: [],
      note: "",
      photo: `data:image/jpeg;base64,${"a".repeat(MAX_STORED_DATA_URL_BYTES)}`
    }]
  };

  const result = store.save(state);
  const loaded = createStore(storage).load();
  const active = getActiveProfile(loaded);

  assert.equal(result.droppedPhotos, true);
  assert.equal(active.entries[0].id, "entry_legacy_oversized");
  assert.equal(active.entries[0].photo, "");
});

test("exports and imports JSON state", () => {
  const state = createDefaultState();
  getActiveProfile(state).entries.push({
    id: "entry_export",
    timestamp: "2026-05-18T12:00:00+08:00",
    items: [],
    note: "export",
    photo: ""
  });

  const imported = importState(exportState(state));

  assert.equal(getActiveProfile(imported).entries[0].id, "entry_export");
  assert.equal("portions" in imported, false);
});

test("rejects record-detail JSON when importing a full backup", () => {
  const detailRows = [{
    date: "2026-05-18",
    timestamp: "2026-05-18T12:00:00",
    type: "food",
    food: "米饭",
    amount: 150,
    unit: "g"
  }];

  assert.throws(() => importState(JSON.stringify(detailRows)), /完整备份 JSON/);
  assert.throws(() => importState("{}"), /完整备份 JSON/);
});

test("throws a useful error for invalid import JSON", () => {
  assert.throws(() => importState("{bad json"), /无法导入数据/);
});
