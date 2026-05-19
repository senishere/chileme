export const EMPTY_NUTRITION = Object.freeze({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sodium: 0,
  fiber: 0
});

export const DEFAULT_PROFILE_ID = "profile_default";

export function roundMetric(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function positiveFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function nonNegativeFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function kilojoulesToCalories(value) {
  return roundMetric(nonNegativeFiniteNumber(value, 0) / 4.184);
}

export function amountToGrams(amount, unit = "g") {
  const safeAmount = positiveFiniteNumber(amount, 0);
  if (unit === "ml") return safeAmount;
  return safeAmount;
}

export function calculateItemNutrition(food, amount, unit = "g") {
  const grams = amountToGrams(amount, unit);
  const nutrition = food?.nutritionPer100g || food?.nutrition || EMPTY_NUTRITION;
  const ratio = grams / 100;

  return {
    calories: roundMetric((nutrition.calories || 0) * ratio),
    protein: roundMetric((nutrition.protein || 0) * ratio),
    carbs: roundMetric((nutrition.carbs || 0) * ratio),
    fat: roundMetric((nutrition.fat || 0) * ratio),
    sodium: roundMetric((nutrition.sodium || 0) * ratio),
    fiber: roundMetric((nutrition.fiber || 0) * ratio)
  };
}

const ICON_OPTION_VALUES = {
  "细粮": ["🍚", "🍜", "🍞"],
  "粗粮": ["🌾", "🍠", "🌽", "🥔"],
  "动物蛋白": ["🥩", "🍗", "🐟", "🥚", "🦐"],
  "植物蛋白": ["🫘", "⬜", "🥜"],
  "蔬菜": ["🥬", "🥦", "🍅", "🥒", "🥕", "🍄"],
  "水果": ["🍎", "🍌", "🍊", "🍓", "🍇", "🫐"],
  "奶": ["🥛", "🧀", "🍦"],
  "水": ["💧", "🚰"],
  "饮料": ["🥤", "☕", "🧃"],
  "坚果": ["🥜", "🌰"],
  "零食": ["🍪", "🍫", "🍟"],
  "餐食": ["🍱", "🥗", "🍛", "🥟", "🍣"],
  "其他": ["🍽️"]
};

export const ICON_OPTIONS = Object.freeze(
  Object.fromEntries(
    Object.entries(ICON_OPTION_VALUES).map(([category, icons]) => [category, Object.freeze([...icons])])
  )
);

export const DEFAULT_CATEGORIES = Object.freeze(
  Object.entries(ICON_OPTIONS).map(([name, icons]) => ({
    id: `category_${name}`,
    name,
    icon: icons[0]
  }))
);

function food(id, name, category, icon, nutritionPer100g, quickAdd = true) {
  return {
    id,
    name,
    category,
    icon,
    image: "",
    nutritionPer100g: { ...EMPTY_NUTRITION, ...nutritionPer100g },
    quickAdd
  };
}

const DEFAULT_FOODS = [
  food("food_rice", "米饭", "细粮", "🍚", { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3, sodium: 1 }),
  food("food_noodles", "面条", "细粮", "🍜", { calories: 138, protein: 4.5, carbs: 25, fat: 2, sodium: 240 }),
  food("food_steamed_bun", "馒头", "细粮", "🍞", { calories: 223, protein: 7, carbs: 47, fat: 1.1, sodium: 165 }),
  food("food_oatmeal", "燕麦片", "粗粮", "🌾", { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, sodium: 2 }),
  food("food_sweet_potato", "红薯", "粗粮", "🍠", { calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1, sodium: 55 }),
  food("food_corn", "玉米", "粗粮", "🌽", { calories: 96, protein: 3.4, carbs: 21, fat: 1.5, sodium: 1 }),
  food("food_whole_wheat_bread", "全麦面包", "粗粮", "🍞", { calories: 247, protein: 13, carbs: 41, fat: 4.2, sodium: 400 }),
  food("food_potato", "土豆", "粗粮", "🥔", { calories: 77, protein: 2, carbs: 17, fat: 0.1, sodium: 6 }),

  food("food_egg", "鸡蛋", "动物蛋白", "🥚", { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, sodium: 142 }),
  food("food_chicken", "鸡胸肉", "动物蛋白", "🍗", { calories: 165, protein: 31, carbs: 0, fat: 3.6, sodium: 74 }),
  food("food_beef", "牛肉", "动物蛋白", "🥩", { calories: 250, protein: 26, carbs: 0, fat: 15, sodium: 72 }),
  food("food_pork", "猪肉瘦肉", "动物蛋白", "🥩", { calories: 143, protein: 21, carbs: 0, fat: 6, sodium: 57 }),
  food("food_salmon", "三文鱼", "动物蛋白", "🐟", { calories: 208, protein: 20, carbs: 0, fat: 13, sodium: 59 }),
  food("food_shrimp", "虾仁", "动物蛋白", "🦐", { calories: 99, protein: 24, carbs: 0.2, fat: 0.3, sodium: 111 }),
  food("food_tofu", "北豆腐", "植物蛋白", "⬜", { calories: 76, protein: 8, carbs: 1.9, fat: 4.8, sodium: 7 }),
  food("food_edamame", "毛豆", "植物蛋白", "🫘", { calories: 121, protein: 11.9, carbs: 8.9, fat: 5.2, sodium: 6 }),

  food("food_milk", "牛奶", "奶", "🥛", { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sodium: 42 }),
  food("food_skim_milk", "脱脂牛奶", "奶", "🥛", { calories: 34, protein: 3.4, carbs: 5, fat: 0.1, sodium: 42 }),
  food("food_yogurt", "希腊酸奶", "奶", "🥛", { calories: 120, protein: 10, carbs: 8, fat: 4, sodium: 55 }),
  food("food_water", "水", "水", "💧", { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0 }),
  food("food_soy_milk", "豆浆", "植物蛋白", "🥤", { calories: 33, protein: 3, carbs: 3, fat: 1.6, sodium: 35 }),
  food("food_latte", "拿铁", "饮料", "☕", { calories: 45, protein: 2.5, carbs: 4.2, fat: 2, sodium: 38 }),
  food("food_black_coffee", "黑咖啡", "饮料", "☕", { calories: 2, protein: 0.1, carbs: 0, fat: 0, sodium: 2 }),
  food("food_orange_juice", "橙汁", "饮料", "🧃", { calories: 45, protein: 0.7, carbs: 10.4, fat: 0.2, sodium: 1 }),
  food("food_cola", "可乐", "饮料", "🥤", { calories: 42, protein: 0, carbs: 10.6, fat: 0, sodium: 4 }),
  food("food_protein_shake", "蛋白粉饮品", "饮料", "🥤", { calories: 120, protein: 24, carbs: 3, fat: 1.5, sodium: 150 }),

  food("food_broccoli", "西兰花", "蔬菜", "🥦", { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, sodium: 33 }),
  food("food_tomato", "番茄", "蔬菜", "🍅", { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, sodium: 5 }),
  food("food_spinach", "菠菜", "蔬菜", "🥬", { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, sodium: 79 }),
  food("food_cucumber", "黄瓜", "蔬菜", "🥒", { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, sodium: 2 }),
  food("food_carrot", "胡萝卜", "蔬菜", "🥕", { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, sodium: 69 }),
  food("food_lettuce", "生菜", "蔬菜", "🥬", { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, sodium: 28 }),
  food("food_mushroom", "蘑菇", "蔬菜", "🍄", { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, sodium: 5 }),
  food("food_avocado", "牛油果", "水果", "🍎", { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, sodium: 7 }),

  food("food_apple", "苹果", "水果", "🍎", { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, sodium: 1 }),
  food("food_banana", "香蕉", "水果", "🍌", { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, sodium: 1 }),
  food("food_blueberry", "蓝莓", "水果", "🫐", { calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, sodium: 1 }),
  food("food_orange", "橙子", "水果", "🍊", { calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, sodium: 0 }),
  food("food_strawberry", "草莓", "水果", "🍓", { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, sodium: 1 }),
  food("food_grape", "葡萄", "水果", "🍇", { calories: 69, protein: 0.7, carbs: 18.1, fat: 0.2, sodium: 2 }),

  food("food_almond", "杏仁", "坚果", "🥜", { calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, sodium: 1 }),
  food("food_walnut", "核桃", "坚果", "🌰", { calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2, sodium: 2 }),
  food("food_nuts", "混合坚果", "坚果", "🥜", { calories: 607, protein: 20, carbs: 21, fat: 54, sodium: 5 }),
  food("food_dark_chocolate", "黑巧克力", "零食", "🍫", { calories: 546, protein: 4.9, carbs: 61, fat: 31, sodium: 24 }),
  food("food_potato_chips", "薯片", "零食", "🍟", { calories: 536, protein: 7, carbs: 53, fat: 34, sodium: 525 }),
  food("food_biscuit", "饼干", "零食", "🍪", { calories: 480, protein: 6, carbs: 68, fat: 20, sodium: 450 }),

  food("food_instant_noodles", "方便面", "零食", "🍜", { calories: 470, protein: 9, carbs: 62, fat: 20, sodium: 1800 }),
  food("food_ham", "火腿片", "零食", "🍟", { calories: 145, protein: 20, carbs: 2, fat: 6, sodium: 1200 }),
  food("food_soy_sauce", "酱油", "其他", "🍽️", { calories: 53, protein: 8, carbs: 4.9, fat: 0.6, sodium: 5600 }),
  food("food_peanut_butter", "花生酱", "其他", "🍽️", { calories: 588, protein: 25, carbs: 20, fat: 50, sodium: 460 }),
  food("food_olive_oil", "橄榄油", "其他", "🍽️", { calories: 824, protein: 0, carbs: 0, fat: 91.6, sodium: 2 }),

  food("food_chicken_salad", "鸡胸肉沙拉", "餐食", "🥗", { calories: 110, protein: 12, carbs: 5, fat: 4, sodium: 180 }),
  food("food_sushi", "寿司", "餐食", "🍣", { calories: 145, protein: 5, carbs: 28, fat: 2, sodium: 430 }),
  food("food_dumpling", "饺子", "餐食", "🥟", { calories: 230, protein: 8, carbs: 30, fat: 8, sodium: 480 }),
  food("food_baozi", "包子", "餐食", "🥟", { calories: 230, protein: 8, carbs: 36, fat: 6, sodium: 420 }),
  food("food_congee", "白粥", "餐食", "🍱", { calories: 46, protein: 1.1, carbs: 10, fat: 0.2, sodium: 3 }),
  food("food_fried_rice", "炒饭", "餐食", "🍛", { calories: 188, protein: 5, carbs: 28, fat: 6, sodium: 420 })
];

const DEFAULT_PERSONAL_PROFILE = Object.freeze({
  sex: "female",
  age: 30,
  heightCm: 165,
  weightKg: 60,
  activityLevel: "light",
  goal: "maintain"
});

const DEFAULT_DAILY_GOAL = Object.freeze({
  calories: 2000,
  protein: 100,
  waterMl: 2000,
  fiber: 25
});

function cloneNutrition(nutrition = EMPTY_NUTRITION) {
  return { ...EMPTY_NUTRITION, ...nutrition };
}

function cloneEntry(entry) {
  return {
    ...entry,
    items: (entry.items || []).map((item) => ({
      ...item,
      nutrition: cloneNutrition(item.nutrition)
    }))
  };
}

function cloneLocalProfile(profile) {
  return {
    id: profile.id || createId("profile"),
    name: normalizeProfileName(profile.name || "新档案") || "新档案",
    profile: { ...DEFAULT_PERSONAL_PROFILE, ...(profile.profile || {}) },
    dailyGoal: { ...DEFAULT_DAILY_GOAL, ...(profile.dailyGoal || {}) },
    entries: (profile.entries || []).map(cloneEntry),
    waterEntries: (profile.waterEntries || []).map((entry) => ({ ...entry }))
  };
}

export function createLocalProfile(overrides = {}) {
  return cloneLocalProfile(overrides);
}

export function createDefaultState() {
  return {
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      createLocalProfile({ id: DEFAULT_PROFILE_ID, name: "日常维持" })
    ],
    categories: DEFAULT_CATEGORIES.map((item) => ({ ...item })),
    foods: DEFAULT_FOODS.map((item) => ({ ...item, nutritionPer100g: cloneNutrition(item.nutritionPer100g) }))
  };
}

export function cloneState(state) {
  const source = state || {};
  const profiles = Array.isArray(source.profiles) && source.profiles.length > 0
    ? source.profiles.map(cloneLocalProfile)
    : [
        createLocalProfile({
          id: source.activeProfileId || DEFAULT_PROFILE_ID,
          name: source.name || "日常维持",
          profile: source.profile,
          dailyGoal: source.dailyGoal,
          entries: source.entries,
          waterEntries: source.waterEntries
        })
      ];
  const activeProfileId = source.activeProfileId && profiles.some((profile) => profile.id === source.activeProfileId)
    ? source.activeProfileId
    : profiles[0].id;
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  if (activeProfile && (
    source.profile ||
    source.dailyGoal ||
    Array.isArray(source.entries) ||
    Array.isArray(source.waterEntries)
  )) {
    const projected = cloneLocalProfile({
      ...activeProfile,
      profile: source.profile || activeProfile.profile,
      dailyGoal: source.dailyGoal || activeProfile.dailyGoal,
      entries: Array.isArray(source.entries) ? source.entries : activeProfile.entries,
      waterEntries: Array.isArray(source.waterEntries) ? source.waterEntries : activeProfile.waterEntries
    });
    Object.assign(activeProfile, projected);
  }

  return {
    activeProfileId,
    profiles,
    categories: (source.categories || []).map((category) => ({ ...category })),
    foods: (source.foods || []).map((item) => ({
      ...item,
      nutritionPer100g: cloneNutrition(item.nutritionPer100g || item.nutrition)
    }))
  };
}

function normalizeProfileName(name) {
  return String(name || "").trim();
}

function assertProfileName(name) {
  const profileName = normalizeProfileName(name);
  if (!profileName) throw new Error("档案名称不能为空");
  return profileName;
}

export function getActiveProfile(state) {
  const source = state || {};
  const profiles = source.profiles || [];
  return profiles.find((profile) => profile.id === source.activeProfileId) || profiles[0] || createLocalProfile({
    id: DEFAULT_PROFILE_ID,
    name: "日常维持",
    profile: source.profile,
    dailyGoal: source.dailyGoal,
    entries: source.entries,
    waterEntries: source.waterEntries
  });
}

export function activeRecordState(state) {
  const activeProfile = getActiveProfile(state);
  return {
    ...(state || {}),
    profile: activeProfile.profile,
    dailyGoal: activeProfile.dailyGoal,
    entries: activeProfile.entries,
    waterEntries: activeProfile.waterEntries,
    categories: state?.categories || [],
    foods: state?.foods || []
  };
}

function hasProjectedRecords(state) {
  return Array.isArray(state?.entries) || Array.isArray(state?.waterEntries);
}

function assertUniqueProfileName(state, name, existingId = "") {
  const profileName = assertProfileName(name);
  const duplicate = (state.profiles || []).some((profile) => (
    profile.name === profileName && profile.id !== existingId
  ));
  if (duplicate) throw new Error("档案已存在");
  return profileName;
}

function assertUniqueProfileId(state, profileId, existingId = "") {
  const id = String(profileId || "").trim();
  if (!id) throw new Error("档案 ID 不能为空");
  const duplicate = (state.profiles || []).some((profile) => (
    profile.id === id && profile.id !== existingId
  ));
  if (duplicate) throw new Error("档案 ID 已存在");
  return id;
}

export function setActiveProfile(state, profileId) {
  const next = cloneState(state);
  if (!next.profiles.some((profile) => profile.id === profileId)) {
    throw new Error("档案不存在");
  }
  next.activeProfileId = profileId;
  return next;
}

export function addLocalProfile(state, name) {
  const next = cloneState(state);
  const profileName = assertUniqueProfileName(next, name);
  const profile = createLocalProfile({ name: profileName });
  next.profiles.push(profile);
  next.activeProfileId = profile.id;
  return next;
}

export function renameLocalProfile(state, profileId, name) {
  const next = cloneState(state);
  const profile = next.profiles.find((item) => item.id === profileId);
  if (!profile) throw new Error("档案不存在");
  profile.name = assertUniqueProfileName(next, name, profileId);
  return next;
}

export function deleteLocalProfile(state, profileId) {
  const next = cloneState(state);
  if (next.profiles.length <= 1) throw new Error("至少保留一个档案");
  if (!next.profiles.some((profile) => profile.id === profileId)) {
    throw new Error("档案不存在");
  }
  next.profiles = next.profiles.filter((profile) => profile.id !== profileId);
  if (next.activeProfileId === profileId) {
    next.activeProfileId = next.profiles[0].id;
  }
  return next;
}

export function updateActiveProfile(state, updater) {
  const next = cloneState(state);
  const index = next.profiles.findIndex((profile) => profile.id === next.activeProfileId);
  if (index < 0) throw new Error("档案不存在");
  const updated = typeof updater === "function" ? updater(cloneLocalProfile(next.profiles[index])) : updater;
  const currentId = next.profiles[index].id;
  const hasUpdatedId = updated && typeof updated === "object" && Object.hasOwn(updated, "id");
  const updatedId = hasUpdatedId ? assertUniqueProfileId(next, updated.id, currentId) : currentId;
  const candidate = cloneLocalProfile({ ...next.profiles[index], ...updated });
  candidate.id = updatedId;
  candidate.name = assertUniqueProfileName(next, candidate.name, currentId);
  next.profiles[index] = candidate;
  next.activeProfileId = next.profiles[index].id;
  return next;
}

function normalizeCategoryName(name) {
  return String(name || "").trim();
}

function assertCategoryName(state, name, existingName = "") {
  const categoryName = normalizeCategoryName(name);
  if (!categoryName) throw new Error("分类名称不能为空");
  const duplicate = (state.categories || []).some((category) => (
    category.name === categoryName && category.name !== existingName
  ));
  if (duplicate) throw new Error("分类已存在");
  return categoryName;
}

export function defaultIconForCategory(name, icon = "") {
  const optionIcon = ICON_OPTIONS[name]?.[0];
  return normalizeCategoryName(icon) || optionIcon || "🍽️";
}

export function addCategory(state, name, icon = "") {
  const next = cloneState(state);
  const categoryName = assertCategoryName(next, name);
  next.categories.push({
    id: `category_${categoryName}`,
    name: categoryName,
    icon: defaultIconForCategory(categoryName, icon)
  });
  return next;
}

export function renameCategory(state, oldName, newName) {
  const next = cloneState(state);
  const from = normalizeCategoryName(oldName);
  const to = assertCategoryName(next, newName, from);
  const category = next.categories.find((item) => item.name === from);
  if (!category) throw new Error("分类不存在");
  category.name = to;
  category.id = `category_${to}`;
  category.icon = defaultIconForCategory(to, category.icon);
  next.foods = next.foods.map((item) => (
    item.category === from ? { ...item, category: to } : item
  ));
  return next;
}

export function deleteCategory(state, name) {
  const next = cloneState(state);
  const categoryName = normalizeCategoryName(name);
  if (categoryName === "其他") throw new Error("不能删除其他分类");
  if (!next.categories.some((category) => category.name === categoryName)) {
    throw new Error("分类不存在");
  }
  if (!next.categories.some((category) => category.name === "其他")) {
    next.categories.push({ id: "category_其他", name: "其他", icon: "🍽️" });
  }
  next.categories = next.categories.filter((category) => category.name !== categoryName);
  next.foods = next.foods.map((item) => (
    item.category === categoryName ? { ...item, category: "其他" } : item
  ));
  return next;
}

export function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}

export function addNutrition(left, right) {
  return {
    calories: roundMetric((left.calories || 0) + (right.calories || 0)),
    protein: roundMetric((left.protein || 0) + (right.protein || 0)),
    carbs: roundMetric((left.carbs || 0) + (right.carbs || 0)),
    fat: roundMetric((left.fat || 0) + (right.fat || 0)),
    sodium: roundMetric((left.sodium || 0) + (right.sodium || 0)),
    fiber: roundMetric((left.fiber || 0) + (right.fiber || 0))
  };
}

export function summarizeDay(state, dayKey) {
  const records = hasProjectedRecords(state) ? state : activeRecordState(state);
  const summary = {
    ...EMPTY_NUTRITION,
    waterMl: 0,
    entryCount: 0
  };

  for (const entry of records.entries || []) {
    if (dateKey(entry.timestamp) !== dayKey) continue;
    summary.entryCount += 1;
    for (const item of entry.items || []) {
      const next = addNutrition(summary, item.nutrition || EMPTY_NUTRITION);
      summary.calories = next.calories;
      summary.protein = next.protein;
      summary.carbs = next.carbs;
      summary.fat = next.fat;
      summary.sodium = next.sodium;
      summary.fiber = next.fiber;
    }
  }

  for (const water of records.waterEntries || []) {
    if (dateKey(water.timestamp) === dayKey) {
      summary.waterMl += Number(water.milliliters) || 0;
    }
  }

  return summary;
}

export function addDays(dayKey, offset) {
  const date = new Date(`${dayKey}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
}

export function sevenDayStats(state, endDayKey = dateKey()) {
  return trendStats(state, endDayKey, 7);
}

export function trendStats(state, endDayKey = dateKey(), days = 7) {
  const length = Number(days) === 30 ? 30 : 7;
  return Array.from({ length }, (_, index) => {
    const date = addDays(endDayKey, index - length + 1);
    return { date, ...summarizeDay(state, date) };
  });
}

export function estimateDailyTargets(profile = {}, dailyGoal = {}) {
  const weightKg = positiveFiniteNumber(profile.weightKg, 65);
  const heightCm = positiveFiniteNumber(profile.heightCm, 170);
  const age = positiveFiniteNumber(profile.age, 30);
  const sexOffset = profile.sex === "male" ? 5 : -161;
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725
  };
  const activity = activityMultipliers[profile.activityLevel] || activityMultipliers.light;
  const goalAdjustments = {
    lose: -300,
    maintain: 0,
    gain: 250
  };
  const adjustment = goalAdjustments[profile.goal] ?? 0;
  const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + sexOffset;
  const estimatedCalories = Math.max(1200, Math.round((bmr * activity) + adjustment));
  const calories = positiveFiniteNumber(dailyGoal.calories, estimatedCalories);
  const proteinFactor = profile.goal === "gain" ? 1.6 : profile.goal === "lose" ? 1.4 : 1.2;
  const protein = positiveFiniteNumber(dailyGoal.protein, Math.round(weightKg * proteinFactor));
  const fat = Math.round((calories * 0.25) / 9);
  const proteinCalories = protein * 4;
  const fatCalories = fat * 9;
  const carbs = Math.max(0, Math.round((calories - proteinCalories - fatCalories) / 4));
  const waterMl = positiveFiniteNumber(dailyGoal.waterMl, Math.round(weightKg * 35));
  const fiber = positiveFiniteNumber(dailyGoal.fiber, 25);

  return {
    calories,
    protein,
    carbs,
    fat,
    sodium: 2000,
    waterMl,
    fiber
  };
}

export function nutritionStatus(ratio) {
  const safeRatio = nonNegativeFiniteNumber(ratio, 0);
  if (safeRatio < 0.4) return "severe-low";
  if (safeRatio < 0.75) return "low";
  if (safeRatio <= 1.05) return "normal";
  if (safeRatio <= 1.2) return "high";
  return "over";
}

export function limitStatus(ratio) {
  const safeRatio = nonNegativeFiniteNumber(ratio, 0);
  if (safeRatio <= 1) return "normal";
  if (safeRatio <= 1.2) return "high";
  return "over";
}

export function dailyStructure(state, dayKey = dateKey()) {
  const records = hasProjectedRecords(state) ? state : activeRecordState(state);
  const summary = summarizeDay(records, dayKey);
  const targets = estimateDailyTargets(records.profile, records.dailyGoal);
  const metrics = {
    calories: { label: "热量", unit: "kcal", value: summary.calories, target: targets.calories },
    protein: { label: "蛋白质", unit: "g", value: summary.protein, target: targets.protein },
    carbs: { label: "碳水", unit: "g", value: summary.carbs, target: targets.carbs },
    fat: { label: "脂肪", unit: "g", value: summary.fat, target: targets.fat },
    fiber: { label: "膳食纤维", unit: "g", value: summary.fiber, target: targets.fiber },
    waterMl: { label: "饮水", unit: "ml", value: summary.waterMl, target: targets.waterMl }
  };

  for (const [key, metric] of Object.entries(metrics)) {
    metric.ratio = metric.target ? roundMetric(metric.value / metric.target) : 0;
    metric.status = nutritionStatus(metric.ratio);
  }

  return metrics;
}

export function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function findFood(state, foodId) {
  return (state.foods || []).find((food) => food.id === foodId);
}

export function listFoodCategories(foods) {
  const categories = [];
  const seen = new Set();
  for (const foodItem of foods || []) {
    const category = typeof foodItem?.category === "string" ? foodItem.category.trim() : "";
    if (!category || seen.has(category)) continue;
    seen.add(category);
    categories.push(category);
  }
  return categories;
}

export function filterFoods(foods, options = {}) {
  const category = options.category || "all";
  const query = String(options.query || "").trim().toLocaleLowerCase("zh-CN");

  return (foods || []).filter((foodItem) => {
    if (category === "favorite" && foodItem.quickAdd === false) return false;
    if (category !== "all" && category !== "favorite" && foodItem.category !== category) return false;
    if (!query) return true;

    return [foodItem.name, foodItem.category]
      .some((value) => String(value || "").toLocaleLowerCase("zh-CN").includes(query));
  });
}

export function exportLogRows(state, endDayKey = dateKey(), days = 7) {
  const records = hasProjectedRecords(state) ? state : activeRecordState(state);
  const end = new Date(`${endDayKey}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(1, Number(days) || 1) + 1);
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  const inRange = (timestamp) => {
    const key = dateKey(timestamp);
    return key >= startKey && key <= endKey;
  };

  const foodRows = (records.entries || []).flatMap((entry) => {
    if (!inRange(entry.timestamp)) return [];
    return (entry.items || []).map((item) => {
      const foodItem = findFood(records, item.foodId);
      return {
        date: dateKey(entry.timestamp),
        timestamp: entry.timestamp,
        type: "food",
        food: foodItem?.name || item.foodId || "未知食物",
        amount: nonNegativeFiniteNumber(item.amount, nonNegativeFiniteNumber(item.grams, 0)),
        unit: item.unit === "ml" ? "ml" : "g",
        calories: nonNegativeFiniteNumber(item.nutrition?.calories, 0),
        protein: nonNegativeFiniteNumber(item.nutrition?.protein, 0),
        carbs: nonNegativeFiniteNumber(item.nutrition?.carbs, 0),
        fat: nonNegativeFiniteNumber(item.nutrition?.fat, 0),
        sodium: nonNegativeFiniteNumber(item.nutrition?.sodium, 0),
        fiber: nonNegativeFiniteNumber(item.nutrition?.fiber, 0),
        waterMl: 0,
        note: entry.note || ""
      };
    });
  });

  const waterRows = (records.waterEntries || [])
    .filter((entry) => inRange(entry.timestamp))
    .map((entry) => ({
      date: dateKey(entry.timestamp),
      timestamp: entry.timestamp,
      type: "water",
      food: "饮水",
      amount: nonNegativeFiniteNumber(entry.milliliters, 0),
      unit: "ml",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sodium: 0,
      fiber: 0,
      waterMl: nonNegativeFiniteNumber(entry.milliliters, 0),
      note: ""
    }));

  return [...foodRows, ...waterRows]
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export function exportRowsAsCsv(rows) {
  const headers = [
    "date",
    "timestamp",
    "type",
    "food",
    "amount",
    "unit",
    "calories",
    "protein",
    "carbs",
    "fat",
    "sodium",
    "fiber",
    "waterMl",
    "note"
  ];
  const escapeCell = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = rows.map((row) => headers.map((header) => escapeCell(row[header])).join(","));
  return [headers.join(","), ...lines].join("\n");
}

export function buildEntryItem(food, amountValue, unitValue = "g") {
  const unit = unitValue === "ml" ? "ml" : "g";
  const amount = positiveFiniteNumber(amountValue, 100);
  return {
    foodId: food.id,
    amount,
    unit,
    grams: amountToGrams(amount, unit),
    nutrition: calculateItemNutrition(food, amount, unit)
  };
}
