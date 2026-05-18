import {
  EMPTY_NUTRITION,
  ICON_OPTIONS,
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

function normalizeProfile(profile, defaults) {
  if (!profile || typeof profile !== "object") return defaults.profile;
  const sex = profile.sex === "male" ? "male" : "female";
  const activityLevels = new Set(["sedentary", "light", "moderate", "active"]);
  const goals = new Set(["lose", "maintain", "gain"]);

  return {
    sex,
    age: normalizePositiveNumber(profile.age, defaults.profile.age),
    heightCm: normalizePositiveNumber(profile.heightCm, defaults.profile.heightCm),
    weightKg: normalizePositiveNumber(profile.weightKg, defaults.profile.weightKg),
    activityLevel: activityLevels.has(profile.activityLevel) ? profile.activityLevel : defaults.profile.activityLevel,
    goal: goals.has(profile.goal) ? profile.goal : defaults.profile.goal
  };
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
    fat: nonNegativeFiniteNumber(nutrition.fat, 0),
    sodium: nonNegativeFiniteNumber(nutrition.sodium, 0)
  };
}

function isValidNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== "object") return false;
  const baseValid = ["calories", "protein", "carbs", "fat"].every((key) => {
    const number = Number(nutrition[key]);
    return Number.isFinite(number) && number >= 0;
  });
  const sodiumValid = nutrition.sodium === undefined || (() => {
    const number = Number(nutrition.sodium);
    return Number.isFinite(number) && number >= 0;
  })();
  return baseValid && sodiumValid;
}

function mergeById(primary, defaults) {
  const seen = new Set();
  const merged = [];
  for (const item of [...primary, ...defaults]) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function normalizeCategoryName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function categoryIcon(name, explicitIcon = "") {
  return normalizeCategoryName(explicitIcon) || ICON_OPTIONS[name]?.[0] || "🍽️";
}

const LEGACY_CATEGORY_MAP = new Map([
  ["主食", "细粮"],
  ["蛋白质", "动物蛋白"],
  ["蔬果", "蔬菜"],
  ["饮品", "饮料"],
  ["奶/饮品", "奶"],
  ["包装/高钠", "零食"],
  ["调味", "其他"],
  ["轻食", "餐食"],
  ["中式", "餐食"],
  ["常吃", "其他"]
]);

function normalizeCategories(categories, defaults) {
  const merged = [];
  const seen = new Set();
  const add = (category, { skipLegacy = false } = {}) => {
    if (!category || typeof category !== "object") return;
    const name = normalizeCategoryName(category.name);
    if (!name || seen.has(name) || (skipLegacy && LEGACY_CATEGORY_MAP.has(name))) return;
    seen.add(name);
    merged.push({
      id: normalizeCategoryName(category.id) || `category_${name}`,
      name,
      icon: categoryIcon(name, category.icon)
    });
  };

  for (const category of defaults.categories) add(category);
  if (Array.isArray(categories)) {
    for (const category of categories) add(category, { skipLegacy: true });
  }
  return merged;
}

function normalizeFoodCategory(value, validCategoryNames) {
  const category = normalizeCategoryName(value);
  if (!category) return "其他";
  const mapped = LEGACY_CATEGORY_MAP.get(category) || category;
  return validCategoryNames.has(mapped) ? mapped : "其他";
}

function normalizeFoods(foods, defaults, categories) {
  if (!Array.isArray(foods)) return defaults.foods;
  const validCategoryNames = new Set(categories.map((category) => category.name));

  const validFoods = foods.flatMap((food) => {
    if (!food || typeof food !== "object") return [];
    const id = typeof food.id === "string" ? food.id.trim() : "";
    const name = typeof food.name === "string" ? food.name.trim() : "";
    const nutrition = food.nutritionPer100g || food.nutrition;
    if (
      !id
      || !name
      || !isValidNutrition(nutrition)
    ) {
      return [];
    }
    const category = normalizeFoodCategory(food.category, validCategoryNames);

    return [{
      id,
      name,
      category,
      icon: categoryIcon(category, food.icon || food.emoji),
      image: normalizeDataUrl(food.image),
      nutritionPer100g: normalizeNutrition(nutrition),
      quickAdd: food.quickAdd === false ? false : true
    }];
  });

  return validFoods.length > 0 ? mergeById(validFoods, defaults.foods) : defaults.foods;
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
    const unit = item.unit === "ml" ? "ml" : "g";
    const amount = positiveFiniteNumber(item.amount, positiveFiniteNumber(item.grams, NaN));
    const grams = amount;
    if (!foodId || !Number.isFinite(amount) || !Number.isFinite(grams)) return [];

    return [{
      foodId,
      amount,
      unit,
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
  const categories = normalizeCategories(state.categories, defaults);

  return {
    categories,
    foods: normalizeFoods(state.foods, defaults, categories),
    entries: normalizeEntries(state.entries),
    waterEntries: normalizeWaterEntries(state.waterEntries),
    profile: normalizeProfile(state.profile, defaults),
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
