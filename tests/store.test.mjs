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
