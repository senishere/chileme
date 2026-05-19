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
    waterMl: normalizeGoalValue(dailyGoal.waterMl, defaults.dailyGoal.waterMl),
    fiber: normalizeGoalValue(dailyGoal.fiber, defaults.dailyGoal.fiber)
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
    sodium: nonNegativeFiniteNumber(nutrition.sodium, 0),
    fiber: nonNegativeFiniteNumber(nutrition.fiber, 0)
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
  const fiberValid = nutrition.fiber === undefined || (() => {
    const number = Number(nutrition.fiber);
    return Number.isFinite(number) && number >= 0;
  })();
  return baseValid && sodiumValid && fiberValid;
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
  ["蔬果", "水果"],
  ["饮品", "饮料"],
  ["奶/饮品", "奶"],
  ["包装/高钠", "零食"],
  ["调味", "其他"],
  ["轻食", "餐食"],
  ["中式", "餐食"],
  ["常吃", "其他"]
]);

function isLegacyCategoryName(name) {
  return LEGACY_CATEGORY_MAP.has(name);
}

function normalizeCategories(categories, defaults, foods = []) {
  const merged = [];
  const seen = new Set();
  const defaultCategoryByName = new Map(defaults.categories.map((category) => [category.name, category]));
  const foodCategoryNames = new Set(
    Array.isArray(foods)
      ? foods.map((food) => normalizeCategoryName(food?.category)).filter(Boolean)
      : []
  );
  const renamedDefaultTargets = new Set(
    Array.isArray(categories)
      ? categories
        .filter((category) => {
          const name = normalizeCategoryName(category?.name);
          const id = normalizeCategoryName(category?.id);
          return name && id === `category_${name}`;
        })
        .map((category) => LEGACY_CATEGORY_MAP.get(normalizeCategoryName(category.name)))
        .filter(Boolean)
      : []
  );
  const add = (category, { skipLegacy = false } = {}) => {
    if (!category || typeof category !== "object") return;
    const name = normalizeCategoryName(category.name);
    const id = normalizeCategoryName(category.id) || `category_${name}`;
    const currentCategoryId = id === `category_${name}`;
    if (!name || seen.has(name) || (skipLegacy && isLegacyCategoryName(name) && !currentCategoryId)) return;
    if (renamedDefaultTargets.has(name) && defaultCategoryByName.has(name) && !foodCategoryNames.has(name)) return;
    seen.add(name);
    merged.push({
      id,
      name,
      icon: categoryIcon(name, category.icon)
    });
  };
  const addFoodCategory = (food, { allowCustom = true } = {}) => {
    if (!food || typeof food !== "object") return;
    const rawName = normalizeCategoryName(food.category);
    if (!rawName) return;
    const name = seen.has(rawName) ? rawName : LEGACY_CATEGORY_MAP.get(rawName) || rawName;
    if (!name || isLegacyCategoryName(name)) return;
    if (!allowCustom && !defaultCategoryByName.has(name)) return;
    add({ id: `category_${name}`, name, icon: food.icon || food.emoji || defaultCategoryByName.get(name)?.icon }, {
      skipLegacy: true
    });
  };

  if (Array.isArray(categories)) {
    for (const category of categories) add(category, { skipLegacy: true });
    if (Array.isArray(foods)) {
      for (const food of foods) addFoodCategory(food, { allowCustom: false });
      const foodIds = new Set(foods.map((food) => food?.id).filter(Boolean));
      for (const food of defaults.foods) {
        if (!foodIds.has(food.id)) add(defaultCategoryByName.get(food.category));
      }
    } else {
      for (const category of defaults.categories) add(category);
    }
  } else if (Array.isArray(foods)) {
    for (const category of defaults.categories) add(category);
    for (const food of foods) addFoodCategory(food);
  } else {
    for (const category of defaults.categories) add(category);
  }
  if (!seen.has("其他")) add(defaultCategoryByName.get("其他") || { id: "category_其他", name: "其他", icon: "🍽️" });
  return merged;
}

function normalizeFoodCategory(value, validCategoryNames) {
  const category = normalizeCategoryName(value);
  if (!category) return "其他";
  if (validCategoryNames.has(category)) return category;
  const mapped = LEGACY_CATEGORY_MAP.get(category) || category;
  return validCategoryNames.has(mapped) ? mapped : "其他";
}

function scaleNutrition(nutrition, factor) {
  return {
    calories: roundMetric((nutrition.calories || 0) * factor),
    protein: roundMetric((nutrition.protein || 0) * factor),
    carbs: roundMetric((nutrition.carbs || 0) * factor),
    fat: roundMetric((nutrition.fat || 0) * factor),
    sodium: roundMetric((nutrition.sodium || 0) * factor),
    fiber: roundMetric((nutrition.fiber || 0) * factor)
  };
}

function normalizeFoodNutrition(food) {
  if (isValidNutrition(food.nutritionPer100g)) return normalizeNutrition(food.nutritionPer100g);
  if (!isValidNutrition(food.nutrition)) return null;

  const nutrition = normalizeNutrition(food.nutrition);
  if (food.nutritionMode === "perServing") {
    const grams = positiveFiniteNumber(food.servingGrams, NaN);
    return Number.isFinite(grams) ? scaleNutrition(nutrition, 100 / grams) : nutrition;
  }
  if (food.nutritionMode === "perPackage") {
    const grams = positiveFiniteNumber(food.packageGrams, NaN);
    return Number.isFinite(grams) ? scaleNutrition(nutrition, 100 / grams) : nutrition;
  }
  return nutrition;
}

function normalizeFoods(foods, defaults, categories) {
  if (!Array.isArray(foods)) return defaults.foods;
  const validCategoryNames = new Set(categories.map((category) => category.name));

  const validFoods = foods.flatMap((food) => {
    if (!food || typeof food !== "object") return [];
    const id = typeof food.id === "string" ? food.id.trim() : "";
    const name = typeof food.name === "string" ? food.name.trim() : "";
    const nutrition = normalizeFoodNutrition(food);
    if (
      !id
      || !name
      || !nutrition
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
      nutritionPer100g: nutrition,
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

function normalizeProfileId(value, fallback) {
  const id = typeof value === "string" ? value.trim() : "";
  return id || fallback;
}

function uniqueProfileId(baseId, unavailable) {
  if (!unavailable.has(baseId)) return baseId;
  let suffix = 2;
  let id = `${baseId}_${suffix}`;
  while (unavailable.has(id)) {
    suffix += 1;
    id = `${baseId}_${suffix}`;
  }
  return id;
}

function normalizeLocalProfileName(value, fallback) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || fallback;
}

function normalizeLocalProfile(profile, defaults, fallbackId, fallbackName) {
  const source = profile && typeof profile === "object" ? profile : {};
  return createLocalProfile({
    id: normalizeProfileId(source.id, fallbackId),
    name: normalizeLocalProfileName(source.name, fallbackName),
    profile: normalizeProfile(source.profile, defaults),
    dailyGoal: normalizeDailyGoal(source.dailyGoal, defaults),
    entries: normalizeEntries(source.entries),
    waterEntries: normalizeWaterEntries(source.waterEntries)
  });
}

function normalizeProfiles(state, defaults) {
  if (Array.isArray(state.profiles) && state.profiles.length > 0) {
    const profileSources = state.profiles.map((profile, index) => ({
      profile,
      originalId: normalizeProfileId(profile?.id, ""),
      fallbackId: `profile_${index + 1}`,
      fallbackName: `档案 ${index + 1}`
    }));
    const reservedOriginalIds = new Set(profileSources.map((source) => source.originalId).filter(Boolean));
    const emittedIds = new Set();
    const profiles = profileSources.flatMap((source) => {
      const normalized = normalizeLocalProfile(
        source.profile,
        defaults.profiles[0],
        source.fallbackId,
        source.fallbackName
      );
      const canUseOriginalId = source.originalId && !emittedIds.has(source.originalId);
      const unavailableIds = new Set([...reservedOriginalIds, ...emittedIds]);
      normalized.id = canUseOriginalId ? source.originalId : uniqueProfileId(normalized.id, unavailableIds);
      emittedIds.add(normalized.id);
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

export function normalizeState(input) {
  const defaults = createDefaultState();
  const state = input && typeof input === "object" ? input : {};
  const categories = normalizeCategories(state.categories, defaults, state.foods);
  const profiles = normalizeProfiles(state, defaults);
  const requestedActiveProfileId = normalizeProfileId(state.activeProfileId, "");
  const activeProfileId = profiles.some((profile) => profile.id === requestedActiveProfileId)
    ? requestedActiveProfileId
    : profiles[0].id;

  return {
    activeProfileId,
    profiles,
    categories,
    foods: normalizeFoods(state.foods, defaults, categories)
  };
}

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
  const hasOversizedTopLevelPhoto = Array.isArray(state?.entries)
    && state.entries.some((entry) => dataUrlBytes(entry?.photo) > MAX_STORED_DATA_URL_BYTES);
  const hasOversizedProfilePhoto = Array.isArray(state?.profiles)
    && state.profiles.some((profile) => (
      Array.isArray(profile.entries)
      && profile.entries.some((entry) => dataUrlBytes(entry?.photo) > MAX_STORED_DATA_URL_BYTES)
    ));
  return hasOversizedTopLevelPhoto || hasOversizedProfilePhoto;
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
      let droppedPhotos = hasOversizedEntryPhoto(state) || hasOversizedEntryPhoto(normalized);
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
    const parsed = JSON.parse(json);
    const hasStateShape = parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
      && ["categories", "foods", "profiles", "activeProfileId", "entries", "waterEntries", "profile", "dailyGoal"].some((key) => key in parsed);
    if (!hasStateShape) {
      throw new Error("完整备份 JSON");
    }
    return normalizeState(parsed);
  } catch (error) {
    if (error.message === "完整备份 JSON") {
      throw new Error("无法导入数据：请选择完整备份 JSON，不是记录明细 JSON。");
    }
    throw new Error("无法导入数据：JSON 格式无效");
  }
}
