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

test("clears corrupt persisted state and loads defaults", () => {
  const storage = memoryStorage();
  storage.setItem("chileme.state.v1", "{bad json");

  const state = createStore(storage).load();

  assert.equal(state.foods.length >= 4, true);
  assert.equal(state.entries.length, 0);
  assert.equal(storage.getItem("chileme.state.v1"), null);
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

test("normalizes malformed entries and water entries", () => {
  const normalized = normalizeState({
    entries: [
      {
        id: "entry_valid",
        timestamp: "2026-05-18T12:00:00+08:00",
        items: [
          {
            foodId: "food_rice",
            portionId: "portion_rice_fist",
            label: 123,
            grams: "150",
            nutrition: { calories: "174", protein: 3.9, carbs: null, fat: -1 }
          },
          {
            foodId: "food_bad",
            grams: -25,
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
      },
      {
        id: "entry_bad_items",
        timestamp: "2026-05-18T12:00:00+08:00",
        items: "bad"
      }
    ],
    waterEntries: [
      { id: "water_valid", timestamp: "2026-05-18T09:00:00+08:00", milliliters: "300" },
      { id: "water_bad_timestamp", timestamp: "bad", milliliters: 300 },
      { id: "water_bad_amount", timestamp: "2026-05-18T09:00:00+08:00", milliliters: -50 }
    ]
  });

  assert.deepEqual(normalized.entries, [
    {
      id: "entry_valid",
      timestamp: "2026-05-18T12:00:00+08:00",
      items: [
        {
          foodId: "food_rice",
          portionId: "portion_rice_fist",
          label: "150g",
          grams: 150,
          nutrition: { calories: 174, protein: 3.9, carbs: 0, fat: 0 }
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

test("normalizes invalid calibration and goal leaf values", () => {
  const defaults = createDefaultState();
  const normalized = normalizeState({
    calibration: {
      fistWidthCm: "wide",
      palmWidthCm: 9.25,
      fingerWidthCm: "2.1",
      containers: "bad"
    },
    dailyGoal: {
      calories: "many",
      protein: 120,
      waterMl: "2300"
    }
  });

  assert.equal(normalized.calibration.fistWidthCm, defaults.calibration.fistWidthCm);
  assert.equal(normalized.calibration.palmWidthCm, 9.25);
  assert.equal(normalized.calibration.fingerWidthCm, 2.1);
  assert.deepEqual(normalized.calibration.containers, defaults.calibration.containers);
  assert.equal(normalized.dailyGoal.calories, defaults.dailyGoal.calories);
  assert.equal(normalized.dailyGoal.protein, 120);
  assert.equal(normalized.dailyGoal.waterMl, 2300);
});

test("normalizes malformed calibration containers", () => {
  const defaults = createDefaultState();
  const normalized = normalizeState({
    calibration: {
      containers: [
        { id: "", label: "", capacityMl: "huge" },
        { id: "container_valid", label: "水杯", capacityMl: "250" }
      ]
    }
  });

  assert.deepEqual(normalized.calibration.containers, [
    { id: "container_valid", label: "水杯", capacityMl: 250 }
  ]);

  const fallback = normalizeState({
    calibration: {
      containers: [{ id: "", label: "", capacityMl: "huge" }]
    }
  });

  assert.deepEqual(fallback.calibration.containers, defaults.calibration.containers);
});

test("normalizes non-positive calibration and goal numbers", () => {
  const defaults = createDefaultState();
  const normalized = normalizeState({
    calibration: {
      fistWidthCm: 0,
      palmWidthCm: -1,
      fingerWidthCm: "2.2"
    },
    dailyGoal: {
      calories: -2000,
      protein: 0,
      waterMl: "2100"
    }
  });

  assert.equal(normalized.calibration.fistWidthCm, defaults.calibration.fistWidthCm);
  assert.equal(normalized.calibration.palmWidthCm, defaults.calibration.palmWidthCm);
  assert.equal(normalized.calibration.fingerWidthCm, 2.2);
  assert.equal(normalized.dailyGoal.calories, defaults.dailyGoal.calories);
  assert.equal(normalized.dailyGoal.protein, defaults.dailyGoal.protein);
  assert.equal(normalized.dailyGoal.waterMl, 2100);
});

test("rejects nonnumeric JSON values for positive numbers", () => {
  const defaults = createDefaultState();
  const normalized = normalizeState({
    calibration: {
      fistWidthCm: true,
      palmWidthCm: [],
      fingerWidthCm: {},
      containers: [
        { id: "container_bool", label: "布尔杯", capacityMl: true },
        { id: "container_empty", label: "空杯", capacityMl: "" },
        { id: "container_space", label: "空白杯", capacityMl: "   " },
        { id: "container_valid", label: "水杯", capacityMl: "250" }
      ]
    },
    dailyGoal: {
      calories: true,
      protein: [],
      waterMl: "   "
    }
  });

  assert.equal(normalized.calibration.fistWidthCm, defaults.calibration.fistWidthCm);
  assert.equal(normalized.calibration.palmWidthCm, defaults.calibration.palmWidthCm);
  assert.equal(normalized.calibration.fingerWidthCm, defaults.calibration.fingerWidthCm);
  assert.deepEqual(normalized.calibration.containers, [
    { id: "container_valid", label: "水杯", capacityMl: 250 }
  ]);
  assert.equal(normalized.dailyGoal.calories, defaults.dailyGoal.calories);
  assert.equal(normalized.dailyGoal.protein, defaults.dailyGoal.protein);
  assert.equal(normalized.dailyGoal.waterMl, defaults.dailyGoal.waterMl);
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
