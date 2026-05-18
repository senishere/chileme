import {
  EMPTY_NUTRITION,
  createDefaultState,
  nonNegativeFiniteNumber,
  positiveFiniteNumber
} from "./domain.js";

export const STORAGE_KEY = "chileme.state.v1";
export const MAX_STORED_DATA_URL_BYTES = 900 * 1024;

function normalizePositiveNumber(value, fallback) {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : NaN;
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
    calories: normalizeGoalValue(dailyGoal.calories, defaults.dailyGoal.calories),
    protein: normalizeGoalValue(dailyGoal.protein, defaults.dailyGoal.protein),
    waterMl: normalizeGoalValue(dailyGoal.waterMl, defaults.dailyGoal.waterMl)
  };
}

function normalizeGoalValue(value, fallback) {
  if (value === null || value === 0) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return normalizePositiveNumber(value, fallback);
}

function isValidTimestamp(value) {
  return (typeof value === "string" || typeof value === "number")
    && Number.isFinite(new Date(value).getTime());
}

function normalizeNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== "object") return { ...EMPTY_NUTRITION };

  return {
    calories: nonNegativeFiniteNumber(nutrition.calories, 0),
    protein: nonNegativeFiniteNumber(nutrition.protein, 0),
    carbs: nonNegativeFiniteNumber(nutrition.carbs, 0),
    fat: nonNegativeFiniteNumber(nutrition.fat, 0)
  };
}

function dataUrlBytes(value) {
  return typeof value === "string" ? value.length : 0;
}

function normalizeDataUrl(value) {
  if (typeof value !== "string") return "";
  return dataUrlBytes(value) <= MAX_STORED_DATA_URL_BYTES ? value : "";
}

function normalizeEntryItems(items) {
  if (!Array.isArray(items)) return null;

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const foodId = typeof item.foodId === "string" ? item.foodId.trim() : "";
    const grams = positiveFiniteNumber(item.grams, NaN);
    if (!foodId || !Number.isFinite(grams)) return [];

    const portionId = typeof item.portionId === "string" ? item.portionId : "";
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label
      : `${grams}g`;

    return [{
      foodId,
      portionId,
      label,
      grams,
      nutrition: normalizeNutrition(item.nutrition)
    }];
  });
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || !isValidTimestamp(entry.timestamp)) return [];
    const items = normalizeEntryItems(entry.items);
    if (!items) return [];

    const id = typeof entry.id === "string" && entry.id.trim()
      ? entry.id
      : `entry_imported_${index}`;

    return [{
      id,
      timestamp: entry.timestamp,
      items,
      note: typeof entry.note === "string" ? entry.note : "",
      photo: normalizeDataUrl(entry.photo)
    }];
  });
}

function normalizeWaterEntries(waterEntries) {
  if (!Array.isArray(waterEntries)) return [];

  return waterEntries.flatMap((water, index) => {
    if (!water || typeof water !== "object" || !isValidTimestamp(water.timestamp)) return [];
    const milliliters = positiveFiniteNumber(water.milliliters, NaN);
    if (!Number.isFinite(milliliters)) return [];

    const id = typeof water.id === "string" && water.id.trim()
      ? water.id
      : `water_imported_${index}`;

    return [{ id, timestamp: water.timestamp, milliliters }];
  });
}

export function normalizeState(input) {
  const defaults = createDefaultState();
  const state = input && typeof input === "object" ? input : {};

  return {
    foods: Array.isArray(state.foods) ? state.foods : defaults.foods,
    portions: Array.isArray(state.portions) ? state.portions : defaults.portions,
    entries: normalizeEntries(state.entries),
    waterEntries: normalizeWaterEntries(state.waterEntries),
    calibration: normalizeCalibration(state.calibration, defaults),
    dailyGoal: normalizeDailyGoal(state.dailyGoal, defaults)
  };
}

function stripEntryPhotos(state) {
  let droppedPhotos = false;
  const entries = state.entries.map((entry) => {
    if (!entry.photo) return entry;
    droppedPhotos = true;
    return { ...entry, photo: "" };
  });
  return { state: { ...state, entries }, droppedPhotos };
}

function hasOversizedEntryPhoto(state) {
  return Array.isArray(state?.entries)
    && state.entries.some((entry) => dataUrlBytes(entry?.photo) > MAX_STORED_DATA_URL_BYTES);
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
      const normalized = normalizeState(state);
      let droppedPhotos = hasOversizedEntryPhoto(state);
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return { state: normalized, droppedPhotos };
      } catch (error) {
        const stripped = stripEntryPhotos(normalized);
        droppedPhotos = stripped.droppedPhotos;
        if (!droppedPhotos) throw error;
        storage.setItem(STORAGE_KEY, JSON.stringify(stripped.state));
        return { state: stripped.state, droppedPhotos };
      }
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
