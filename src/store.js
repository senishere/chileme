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
