import test from "node:test";
import assert from "node:assert/strict";
import {
  addCategory,
  addLocalProfile,
  activeRecordState,
  buildEntryItem,
  calculateItemNutrition,
  cloneState,
  createDefaultState,
  createLocalProfile,
  dateKey,
  defaultIconForCategory,
  deleteCategory,
  deleteLocalProfile,
  dailyStructure,
  estimateDailyTargets,
  exportLogRows,
  exportRowsAsCsv,
  filterFoods,
  findFood,
  foodUsageCounts,
  lastItemAmount,
  recentMeals,
  repeatEntryItems,
  getActiveProfile,
  kilojoulesToCalories,
  limitStatus,
  listFoodCategories,
  nutritionStatus,
  renameCategory,
  renameLocalProfile,
  setCategoryIcon,
  setActiveProfile,
  summarizeDay,
  sevenDayStats,
  trendStats,
  updateActiveProfile
} from "../src/domain.js";

test("converts kilojoules to calories for nutrition label entry", () => {
  assert.equal(kilojoulesToCalories(418.4), 100);
  assert.equal(kilojoulesToCalories("209.2"), 50);
  assert.equal(kilojoulesToCalories(""), 0);
  assert.equal(kilojoulesToCalories(-10), 0);
});

test("calculates per-100g nutrition from grams", () => {
  const food = {
    id: "food_rice",
    nutritionPer100g: { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3, sodium: 1 }
  };

  assert.deepEqual(calculateItemNutrition(food, 150, "g"), {
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45,
    sodium: 1.5,
    fiber: 0
  });
});

test("treats ml as grams for rough drink logging", () => {
  const food = {
    id: "food_milk",
    nutritionPer100g: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sodium: 42 }
  };

  assert.deepEqual(calculateItemNutrition(food, 250, "ml"), {
    calories: 152.5,
    protein: 8,
    carbs: 12,
    fat: 8.25,
    sodium: 105,
    fiber: 0
  });
});

test("calculates dietary fiber with per-100g nutrition", () => {
  const food = {
    id: "food_oatmeal",
    nutritionPer100g: {
      calories: 389,
      protein: 16.9,
      carbs: 66.3,
      fat: 6.9,
      sodium: 2,
      fiber: 10.6
    }
  };

  assert.deepEqual(calculateItemNutrition(food, 50, "g"), {
    calories: 194.5,
    protein: 8.45,
    carbs: 33.15,
    fat: 3.45,
    sodium: 1,
    fiber: 5.3
  });
});

test("builds entry items with dietary fiber", () => {
  const food = {
    id: "food_custom",
    nutritionPer100g: {
      calories: 200,
      protein: 8,
      carbs: 30,
      fat: 4,
      sodium: 100,
      fiber: 6
    }
  };

  assert.deepEqual(buildEntryItem(food, 150, "g"), {
    foodId: "food_custom",
    amount: 150,
    unit: "g",
    grams: 150,
    nutrition: {
      calories: 300,
      protein: 12,
      carbs: 45,
      fat: 6,
      sodium: 150,
      fiber: 9
    }
  });
});

test("summarizes entries and water for one local day", () => {
  const state = createDefaultState();
  const day = "2026-05-18";
  state.entries = [
    {
      id: "entry_a",
      timestamp: "2026-05-18T11:20:00",
      items: [
        {
          foodId: "food_rice",
          grams: 150,
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5, fiber: 0.6 }
        }
      ],
      note: "",
      photo: ""
    },
    {
      id: "entry_b",
      timestamp: "2026-05-17T23:20:00",
      items: [
        {
          foodId: "food_rice",
          grams: 150,
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5, fiber: 0.6 }
        }
      ],
      note: "",
      photo: ""
    }
  ];
  state.waterEntries = [
    { id: "water_a", timestamp: "2026-05-18T15:30:00", milliliters: 300 }
  ];

  assert.deepEqual(summarizeDay(state, day), {
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45,
    sodium: 1.5,
    fiber: 0.6,
    waterMl: 300,
    entryCount: 1
  });
});

test("summarizes multiple water entries for a day", () => {
  const state = createDefaultState();
  state.waterEntries = [
    { id: "water_a", timestamp: new Date(2026, 4, 18, 9, 0).toISOString(), milliliters: 250 },
    { id: "water_b", timestamp: new Date(2026, 4, 18, 13, 0).toISOString(), milliliters: 500 },
    { id: "water_c", timestamp: new Date(2026, 4, 17, 13, 0).toISOString(), milliliters: 500 }
  ];

  assert.equal(summarizeDay(state, dateKey(new Date(2026, 4, 18, 12, 0))).waterMl, 750);
});

test("builds trend stats ending on the selected date", () => {
  const state = createDefaultState();
  state.entries = [
    {
      id: "entry_a",
      timestamp: "2026-05-18T11:20:00",
      items: [
        {
          foodId: "food_rice",
          grams: 150,
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5, fiber: 0.6 }
        }
      ],
      note: "",
      photo: ""
    }
  ];

  const stats = trendStats(state, "2026-05-18", 7);
  const month = trendStats(state, "2026-05-18", 30);

  assert.equal(stats.length, 7);
  assert.equal(stats[0].date, "2026-05-12");
  assert.equal(stats[6].date, "2026-05-18");
  assert.equal(stats[6].calories, 174);
  assert.equal(stats[6].fiber, 0.6);
  assert.equal(month.length, 30);
  assert.equal(month[0].date, "2026-04-19");
  assert.deepEqual(sevenDayStats(state, "2026-05-18"), stats);
});

test("formats local dates as yyyy-mm-dd", () => {
  assert.equal(dateKey(new Date(2026, 4, 18, 9, 5)), "2026-05-18");
});

test("builds entry items without portion templates", () => {
  const state = createDefaultState();
  const food = findFood(state, "food_rice");

  assert.deepEqual(buildEntryItem(food, 150, "g"), {
    foodId: "food_rice",
    amount: 150,
    unit: "g",
    grams: 150,
    nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5, fiber: 0.6 }
  });
});

test("default foods use simplified categories and icon fields", () => {
  const state = createDefaultState();

  assert.equal(Array.isArray(state.portions), false);
  assert.ok(state.categories.find((category) => category.name === "细粮"));
  assert.ok(state.categories.find((category) => category.name === "零食"));
  assert.ok(state.categories.find((category) => category.name === "水"));
  assert.equal(findFood(state, "food_rice").category, "细粮");
  assert.equal(findFood(state, "food_water").category, "水");
  assert.deepEqual(findFood(state, "food_water").nutritionPer100g, {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sodium: 0,
    fiber: 0
  });
  assert.equal(typeof findFood(state, "food_rice").icon, "string");
  assert.equal(typeof findFood(state, "food_rice").nutritionPer100g.calories, "number");
  assert.equal(findFood(state, "food_chicken").nutritionPer100g.fiber, 0);
  assert.equal(findFood(state, "food_oatmeal").nutritionPer100g.fiber, 10.6);
  assert.equal(findFood(state, "food_apple").nutritionPer100g.fiber, 2.4);
  assert.equal(findFood(state, "food_broccoli").nutritionPer100g.fiber, 2.6);
});

test("category helpers add rename delete and move foods to fallback category", () => {
  const state = createDefaultState();
  const cloned = cloneState(state);

  const added = addCategory(cloned, "自定义", "⭐");
  assert.notEqual(added, cloned);
  assert.ok(added.categories.find((category) => category.name === "自定义"));

  const customFood = {
    ...added.foods[0],
    id: "food_custom",
    name: "自定义餐",
    category: "自定义"
  };
  const renamed = renameCategory({ ...added, foods: [...added.foods, customFood] }, "自定义", "备餐");
  assert.equal(renamed.categories.filter((category) => category.name === "自定义").length, 0);
  assert.equal(renamed.categories.filter((category) => category.name === "备餐").length, 1);
  assert.ok(renamed.categories.find((category) => category.name === "备餐"));
  assert.equal(renamed.foods.find((food) => food.id === "food_custom").category, "备餐");

  const deleted = deleteCategory(renamed, "备餐");
  assert.equal(deleted.categories.some((category) => category.name === "备餐"), false);
  assert.equal(deleted.foods.find((food) => food.id === "food_custom").category, "其他");

  assert.throws(() => addCategory(deleted, "其他"), /分类已存在/);
  assert.throws(() => renameCategory(deleted, "其他", "细粮"), /分类已存在/);
  assert.throws(() => deleteCategory(deleted, "其他"), /不能删除/);
  assert.throws(() => addCategory(deleted, " "), /分类名称/);
});

test("category icon helper updates existing category icons", () => {
  const state = createDefaultState();
  const updated = setCategoryIcon(state, "细粮", "🍙");

  assert.notEqual(updated, state);
  assert.equal(updated.categories.find((category) => category.name === "细粮").icon, "🍙");
  assert.equal(state.categories.find((category) => category.name === "细粮").icon, "🍚");
  assert.throws(() => setCategoryIcon(updated, "不存在", "⭐"), /分类不存在/);
});

test("default state starts with one active local profile", () => {
  const state = createDefaultState();
  const profile = getActiveProfile(state);

  assert.equal(state.activeProfileId, "profile_default");
  assert.equal(state.profiles.length, 1);
  assert.equal(profile.name, "日常维持");
  assert.deepEqual(profile.entries, []);
  assert.deepEqual(profile.waterEntries, []);
  assert.equal(profile.dailyGoal.fiber, 25);
});

test("creates local profiles from override objects", () => {
  const profile = createLocalProfile({
    id: "profile_custom",
    name: "自定义",
    dailyGoal: { fiber: 30 }
  });

  assert.equal(createLocalProfile().name, "新档案");
  assert.equal(createLocalProfile({ name: " " }).name, "新档案");
  assert.equal(profile.id, "profile_custom");
  assert.equal(profile.name, "自定义");
  assert.equal(profile.dailyGoal.fiber, 30);
  assert.deepEqual(profile.entries, []);
  assert.deepEqual(profile.waterEntries, []);
});

test("active record state projects current profile records with shared foods", () => {
  const state = createDefaultState();
  state.profiles[0].entries = [{
    id: "entry_a",
    timestamp: "2026-05-18T12:00:00",
    items: [{
      foodId: "food_rice",
      amount: 150,
      unit: "g",
      nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5, fiber: 0.6 }
    }],
    note: "",
    photo: ""
  }];

  const active = activeRecordState(state);

  assert.equal(active.entries.length, 1);
  assert.equal(active.foods, state.foods);
  assert.equal(active.categories, state.categories);
  assert.equal(active.dailyGoal.fiber, 25);
  assert.equal(summarizeDay(active, "2026-05-18").fiber, 0.6);
});

test("local profile helpers add rename switch update and delete profiles", () => {
  const state = createDefaultState();
  const added = addLocalProfile(state, "减脂期");

  assert.equal(added.profiles.length, 2);
  assert.equal(added.profiles[1].name, "减脂期");
  assert.equal(added.activeProfileId, added.profiles[1].id);
  assert.deepEqual(added.profiles[1].entries, []);
  assert.throws(() => addLocalProfile(added, "减脂期"), /档案已存在/);

  const renamed = renameLocalProfile(added, added.activeProfileId, "出差期");
  assert.equal(getActiveProfile(renamed).name, "出差期");
  assert.throws(() => renameLocalProfile(renamed, renamed.activeProfileId, "日常维持"), /档案已存在/);

  const updated = updateActiveProfile(renamed, (profile) => ({
    ...profile,
    dailyGoal: { ...profile.dailyGoal, fiber: 30 },
    entries: [{ id: "entry_trip", timestamp: "2026-05-18T12:00:00", items: [], note: "", photo: "" }]
  }));
  assert.equal(getActiveProfile(updated).dailyGoal.fiber, 30);
  assert.equal(activeRecordState(updated).entries[0].id, "entry_trip");

  const changedId = updateActiveProfile(updated, (profile) => ({
    ...profile,
    id: "profile_trip"
  }));
  assert.equal(changedId.activeProfileId, "profile_trip");
  assert.equal(getActiveProfile(changedId).id, "profile_trip");
  assert.throws(() => updateActiveProfile(updated, (profile) => ({
    ...profile,
    id: " "
  })), /档案 ID 不能为空/);
  assert.throws(() => updateActiveProfile(updated, (profile) => ({
    ...profile,
    id: ""
  })), /档案 ID 不能为空/);
  assert.throws(() => updateActiveProfile(updated, (profile) => ({
    ...profile,
    id: null
  })), /档案 ID 不能为空/);
  const trimmedId = updateActiveProfile(updated, (profile) => ({
    ...profile,
    id: " profile_trimmed "
  }));
  assert.equal(trimmedId.activeProfileId, "profile_trimmed");
  assert.equal(getActiveProfile(trimmedId).id, "profile_trimmed");
  assert.throws(() => updateActiveProfile(updated, (profile) => ({
    ...profile,
    id: "profile_default"
  })), /档案 ID 已存在|档案已存在/);
  assert.throws(() => updateActiveProfile(updated, (profile) => ({
    ...profile,
    name: "日常维持"
  })), /档案已存在/);

  const switched = setActiveProfile(updated, "profile_default");
  assert.equal(getActiveProfile(switched).name, "日常维持");

  const deleted = deleteLocalProfile(switched, added.profiles[1].id);
  assert.equal(deleted.profiles.length, 1);
  assert.equal(deleted.activeProfileId, "profile_default");
  assert.throws(() => deleteLocalProfile(deleted, "profile_default"), /至少保留一个档案/);
  assert.throws(() => renameLocalProfile(deleted, "profile_default", " "), /档案名称不能为空/);
});

test("resolves a category default icon unless an explicit icon is selected", () => {
  assert.equal(defaultIconForCategory("粗粮"), "🌾");
  assert.equal(defaultIconForCategory("粗粮", "🍠"), "🍠");
  assert.equal(defaultIconForCategory("未知"), "🍽️");
});

test("default state includes a mixed built-in food library", () => {
  const state = createDefaultState();

  assert.equal(state.foods.length >= 50, true);
  assert.ok(findFood(state, "food_milk"));
  assert.equal(findFood(state, "food_soy_milk").category, "植物蛋白");
  assert.ok(findFood(state, "food_instant_noodles"));
});

test("lists food categories once in first-seen order", () => {
  const foods = [
    { id: "a", name: "米饭", category: "主食" },
    { id: "b", name: "鸡蛋", category: "蛋白质" },
    { id: "c", name: "面条", category: "主食" },
    { id: "d", name: "自定义", category: "" }
  ];

  assert.deepEqual(listFoodCategories(foods), ["主食", "蛋白质"]);
});

test("filters foods by favorites category and search query", () => {
  const foods = [
    { id: "rice", name: "米饭", category: "主食", quickAdd: true },
    { id: "egg", name: "鸡蛋", category: "蛋白质", quickAdd: false },
    { id: "milk", name: "牛奶", category: "奶/饮品", quickAdd: true }
  ];

  assert.deepEqual(filterFoods(foods, { category: "favorite" }).map((food) => food.id), ["rice", "milk"]);
  assert.deepEqual(filterFoods(foods, { category: "蛋白质" }).map((food) => food.id), ["egg"]);
  assert.deepEqual(filterFoods(foods, { query: "奶" }).map((food) => food.id), ["milk"]);
  assert.deepEqual(filterFoods(foods, { category: "favorite", query: "米" }).map((food) => food.id), ["rice"]);
});

test("exports food and water rows for a rolling day range", () => {
  const state = createDefaultState();
  state.entries = [{
    id: "entry_a",
    timestamp: "2026-05-18T12:00:00",
    items: [{
      foodId: "food_rice",
      amount: 150,
      unit: "g",
      nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5, fiber: 0.6 }
    }],
    note: "午餐",
    photo: "data:image/png;base64,ignored"
  }, {
    id: "entry_old",
    timestamp: "2026-05-10T12:00:00",
    items: [{
      foodId: "food_rice",
      amount: 150,
      unit: "g",
      nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5, fiber: 0.6 }
    }],
    note: "",
    photo: ""
  }];
  state.waterEntries = [
    { id: "water_a", timestamp: "2026-05-18T15:00:00", milliliters: 300 }
  ];

  assert.deepEqual(exportLogRows(state, "2026-05-18", 7), [{
    date: "2026-05-18",
    timestamp: "2026-05-18T12:00:00",
    type: "food",
    food: "米饭",
    amount: 150,
    unit: "g",
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45,
    sodium: 1.5,
    fiber: 0.6,
    waterMl: 0,
    note: "午餐"
  }, {
    date: "2026-05-18",
    timestamp: "2026-05-18T15:00:00",
    type: "water",
    food: "饮水",
    amount: 300,
    unit: "ml",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sodium: 0,
    fiber: 0,
    waterMl: 300,
    note: ""
  }]);
});

test("serializes exported rows as escaped CSV", () => {
  const csv = exportRowsAsCsv([{
    date: "2026-05-18",
    timestamp: "2026-05-18T12:00:00",
    type: "food",
    food: "米饭,鸡蛋",
    amount: 150,
    unit: "g",
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45,
    sodium: 1.5,
    fiber: 0.6,
    waterMl: 0,
    note: "午餐"
  }]);

  assert.equal(csv.split("\n")[0], "date,timestamp,type,food,amount,unit,calories,protein,carbs,fat,sodium,fiber,waterMl,note");
  assert.match(csv, /"米饭,鸡蛋"/);
});

test("status helpers classify nutrition targets and upper limits", () => {
  assert.equal(nutritionStatus(0.39), "severe-low");
  assert.equal(nutritionStatus(0.4), "low");
  assert.equal(nutritionStatus(0.75), "normal");
  assert.equal(nutritionStatus(1.05), "normal");
  assert.equal(nutritionStatus(1.2), "high");
  assert.equal(nutritionStatus(1.21), "over");
  assert.equal(limitStatus(1), "normal");
  assert.equal(limitStatus(1.2), "high");
  assert.equal(limitStatus(1.21), "over");
});

test("estimates rough daily targets from profile with explicit goal overrides", () => {
  const targets = estimateDailyTargets({
    sex: "female",
    age: 35,
    heightCm: 165,
    weightKg: 60,
    activityLevel: "light",
    goal: "lose"
  }, {
    calories: 1600,
    protein: null,
    waterMl: 2200
  });

  assert.equal(targets.calories, 1600);
  assert.equal(targets.protein, 84);
  assert.equal(targets.waterMl, 2200);
  assert.equal(targets.sodium, 2000);
  assert.equal(targets.fiber, 25);
  assert.equal(targets.carbs > 0, true);
  assert.equal(targets.fat > 0, true);
});

test("builds daily structure statuses from summary and targets", () => {
  const state = createDefaultState();
  state.dailyGoal = { calories: 2000, protein: 100, waterMl: 2000, fiber: 25 };
  state.entries = [{
    id: "entry_a",
    timestamp: "2026-05-18T12:00:00",
    items: [{
      foodId: "food_rice",
      amount: 150,
      unit: "g",
      nutrition: { calories: 2100, protein: 60, carbs: 300, fat: 80, sodium: 2300, fiber: 20 }
    }],
    note: "",
    photo: ""
  }];
  state.waterEntries = [{ id: "water_a", timestamp: "2026-05-18T15:00:00", milliliters: 500 }];

  const structure = dailyStructure(state, "2026-05-18");

  assert.equal(structure.calories.status, "normal");
  assert.equal(structure.protein.status, "low");
  assert.equal(structure.fiber.status, "normal");
  assert.equal(structure.waterMl.status, "severe-low");
  assert.equal(structure.sodium, undefined);
});

function stateWithEntries(entries) {
  return updateActiveProfile(createDefaultState(), (profile) => ({ ...profile, entries }));
}

function quickEntry(id, timestamp, items) {
  const state = createDefaultState();
  return {
    id,
    timestamp,
    note: "",
    photo: "",
    items: items.map(([foodId, amount, unit = "g"]) => buildEntryItem(findFood(state, foodId), amount, unit))
  };
}

test("recent meals group identical combinations and rank by frequency then recency", () => {
  const state = stateWithEntries([
    quickEntry("e1", "2026-10-28T08:00:00", [["food_oatmeal", 50], ["food_apple", 150]]),
    quickEntry("e2", "2026-10-29T08:00:00", [["food_apple", 150], ["food_oatmeal", 50]]),
    quickEntry("e3", "2026-10-30T12:00:00", [["food_rice", 200]]),
    quickEntry("e4", "2026-10-01T12:00:00", [["food_broccoli", 100]])
  ]);

  const meals = recentMeals(state, { endDayKey: "2026-10-31", days: 14 });

  assert.equal(meals.length, 2);
  assert.equal(meals[0].count, 2);
  assert.deepEqual(meals[0].items.map((item) => item.foodId), ["food_apple", "food_oatmeal"]);
  assert.equal(meals[1].items[0].foodId, "food_rice");
});

test("recent meals skip items whose food was deleted", () => {
  const state = stateWithEntries([
    quickEntry("e1", "2026-10-30T08:00:00", [["food_apple", 150]])
  ]);
  state.foods = state.foods.filter((food) => food.id !== "food_apple");

  assert.deepEqual(recentMeals(state, { endDayKey: "2026-10-31" }), []);
});

test("last item amount returns the most recent portion for a food", () => {
  const state = stateWithEntries([
    quickEntry("e1", "2026-10-30T08:00:00", [["food_rice", 180]]),
    quickEntry("e2", "2026-10-28T08:00:00", [["food_rice", 250]])
  ]);

  assert.deepEqual(lastItemAmount(state, "food_rice"), { amount: 180, unit: "g" });
  assert.equal(lastItemAmount(state, "food_apple"), null);
});

test("food usage counts only include the recent window", () => {
  const state = stateWithEntries([
    quickEntry("e1", "2026-10-30T08:00:00", [["food_rice", 180], ["food_apple", 100]]),
    quickEntry("e2", "2026-10-29T08:00:00", [["food_rice", 180]]),
    quickEntry("e3", "2026-08-01T08:00:00", [["food_apple", 100]])
  ]);
  const counts = foodUsageCounts(state, "2026-10-31", 30);

  assert.equal(counts.get("food_rice"), 2);
  assert.equal(counts.get("food_apple"), 1);
});

test("repeat entry items recompute nutrition from current food data", () => {
  const state = createDefaultState();
  const [item] = quickEntry("e1", "2026-10-30T08:00:00", [["food_rice", 200]]).items;
  findFood(state, "food_rice").nutritionPer100g.calories = 100;

  const repeated = repeatEntryItems(state, [item, { foodId: "missing", amount: 1, unit: "g" }]);

  assert.equal(repeated.length, 1);
  assert.equal(repeated[0].nutrition.calories, 200);
});
