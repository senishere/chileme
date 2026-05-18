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
