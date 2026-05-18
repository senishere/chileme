import { createDefaultState } from "./domain.js";

export const STORAGE_KEY = "chileme.state.v1";

function normalizePositiveNumber(value, fallback) {
  const number = typeof value === "string" && value.trim() === ""
    ? NaN
    : Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeContainers(containers, defaults) {
  if (!Array.isArray(containers)) return defaults.calibration.containers;

  const validContainers = containers.flatMap((container) => {
    if (!container || typeof container !== "object") return [];
    const id = typeof container.id === "string" ? container.id.trim() : "";
    const label = typeof container.label === "string" ? container.label.trim() : "";
    const capacityMl = normalizePositiveNumber(container.capacityMl, NaN);
    if (!id || !label || !Number.isFinite(capacityMl)) return [];
    return [{ id, label, capacityMl }];
  });

  return validContainers.length > 0
    ? validContainers
    : defaults.calibration.containers;
}

function normalizeCalibration(calibration, defaults) {
  if (!calibration || typeof calibration !== "object") return defaults.calibration;

  return {
    ...defaults.calibration,
    fistWidthCm: normalizePositiveNumber(calibration.fistWidthCm, defaults.calibration.fistWidthCm),
    palmWidthCm: normalizePositiveNumber(calibration.palmWidthCm, defaults.calibration.palmWidthCm),
    fingerWidthCm: normalizePositiveNumber(calibration.fingerWidthCm, defaults.calibration.fingerWidthCm),
    containers: normalizeContainers(calibration.containers, defaults)
  };
}

function normalizeDailyGoal(dailyGoal, defaults) {
  if (!dailyGoal || typeof dailyGoal !== "object") return defaults.dailyGoal;

  return {
    ...defaults.dailyGoal,
    calories: normalizePositiveNumber(dailyGoal.calories, defaults.dailyGoal.calories),
    protein: normalizePositiveNumber(dailyGoal.protein, defaults.dailyGoal.protein),
    waterMl: normalizePositiveNumber(dailyGoal.waterMl, defaults.dailyGoal.waterMl)
  };
}

export function normalizeState(input) {
  const defaults = createDefaultState();
  const state = input && typeof input === "object" ? input : {};

  return {
    foods: Array.isArray(state.foods) ? state.foods : defaults.foods,
    portions: Array.isArray(state.portions) ? state.portions : defaults.portions,
    entries: Array.isArray(state.entries) ? state.entries : [],
    waterEntries: Array.isArray(state.waterEntries) ? state.waterEntries : [],
    calibration: normalizeCalibration(state.calibration, defaults),
    dailyGoal: normalizeDailyGoal(state.dailyGoal, defaults)
  };
}

export function createStore(storage = globalThis.localStorage) {
  return {
    load() {
      if (!storage) return createDefaultState();
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      try {
        return normalizeState(JSON.parse(raw));
      } catch (error) {
        try {
          storage.removeItem(STORAGE_KEY);
        } catch (removeError) {
          // Ignore cleanup failures and still recover with a fresh state.
        }
        return createDefaultState();
      }
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
