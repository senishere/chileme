import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEntryItem,
  calculateItemNutrition,
  createDefaultState,
  dateKey,
  dailyStructure,
  estimateDailyTargets,
  exportLogRows,
  exportRowsAsCsv,
  filterFoods,
  findFood,
  findPortion,
  listFoodCategories,
  portionsForFood,
  summarizeDay,
  sevenDayStats
} from "../src/domain.js";

test("calculates per-100g nutrition for a regular food item", () => {
  const food = {
    id: "food_rice",
    nutritionMode: "per100g",
    nutrition: { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3, sodium: 1 }
  };

  assert.deepEqual(calculateItemNutrition(food, 150), {
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45,
    sodium: 1.5
  });
});

test("calculates per-100ml nutrition and sodium for liquid food", () => {
  const food = {
    id: "food_milk",
    nutritionMode: "per100ml",
    densityGPerMl: 1.03,
    nutrition: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sodium: 42 }
  };

  assert.deepEqual(calculateItemNutrition(food, 250, "ml"), {
    calories: 152.5,
    protein: 8,
    carbs: 12,
    fat: 8.25,
    sodium: 105
  });
});

test("calculates per-100g nutrition from ml amounts using density", () => {
  const food = {
    id: "food_soup",
    nutritionMode: "per100g",
    densityGPerMl: 1.2,
    nutrition: { calories: 100, protein: 5, carbs: 10, fat: 2, sodium: 300 }
  };

  assert.deepEqual(calculateItemNutrition(food, 100, "ml"), {
    calories: 120,
    protein: 6,
    carbs: 12,
    fat: 2.4,
    sodium: 360
  });
});

test("calculates package nutrition by serving ratio", () => {
  const food = {
    id: "food_yogurt",
    nutritionMode: "perServing",
    servingGrams: 100,
    nutrition: { calories: 120, protein: 10, carbs: 8, fat: 4, sodium: 55 }
  };

  assert.deepEqual(calculateItemNutrition(food, 50), {
    calories: 60,
    protein: 5,
    carbs: 4,
    fat: 2,
    sodium: 27.5
  });
});

test("calculates packaged food nutrition by package ratio", () => {
  const food = {
    id: "food_chips",
    nutritionMode: "perPackage",
    packageGrams: 200,
    nutrition: { calories: 500, protein: 8, carbs: 60, fat: 25, sodium: 900 }
  };

  assert.deepEqual(calculateItemNutrition(food, 50), {
    calories: 125,
    protein: 2,
    carbs: 15,
    fat: 6.25,
    sodium: 225
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
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
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
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
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

test("builds seven days of stats ending on the selected date", () => {
  const state = createDefaultState();
  state.entries = [
    {
      id: "entry_a",
      timestamp: "2026-05-18T11:20:00",
      items: [
        {
          foodId: "food_rice",
          grams: 150,
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
        }
      ],
      note: "",
      photo: ""
    }
  ];

  const stats = sevenDayStats(state, "2026-05-18");

  assert.equal(stats.length, 7);
  assert.equal(stats[0].date, "2026-05-12");
  assert.equal(stats[6].date, "2026-05-18");
  assert.equal(stats[6].calories, 174);
});

test("formats local dates as yyyy-mm-dd", () => {
  assert.equal(dateKey(new Date(2026, 4, 18, 9, 5)), "2026-05-18");
});

test("finds foods and portions and builds an entry item", () => {
  const state = createDefaultState();
  const food = findFood(state, "food_rice");
  const portion = findPortion(state, "portion_rice_fist");

  assert.equal(food.name, "米饭");
  assert.equal(portionsForFood(state, "food_rice").length, 1);
  assert.deepEqual(buildEntryItem(food, portion), {
    foodId: "food_rice",
    portionId: "portion_rice_fist",
    label: "1拳",
    amount: 150,
    unit: "g",
    grams: 150,
    nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
  });
});

test("builds entry items with positive grams fallback", () => {
  const state = createDefaultState();
  const food = findFood(state, "food_rice");
  const portion = findPortion(state, "portion_rice_fist");

  assert.deepEqual(buildEntryItem(food, portion, -50), {
    foodId: "food_rice",
    portionId: "portion_rice_fist",
    label: "1拳",
    amount: 150,
    unit: "g",
    grams: 150,
    nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
  });
});

test("builds liquid entry items with ml amount and gram equivalent", () => {
  const state = createDefaultState();
  const food = findFood(state, "food_milk");
  const portion = findPortion(state, "portion_milk_cup");

  assert.deepEqual(buildEntryItem(food, portion), {
    foodId: "food_milk",
    portionId: "portion_milk_cup",
    label: "1杯",
    amount: 250,
    unit: "ml",
    grams: 257.5,
    nutrition: { calories: 152.5, protein: 8, carbs: 12, fat: 8.25, sodium: 105 }
  });
});

test("default state includes a mixed built-in food library", () => {
  const state = createDefaultState();

  assert.equal(state.foods.length >= 50, true);
  assert.ok(findFood(state, "food_milk"));
  assert.ok(findFood(state, "food_soy_milk"));
  assert.ok(findFood(state, "food_instant_noodles"));
  assert.equal(findPortion(state, "portion_milk_cup").unit, "ml");
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
      label: "1拳",
      amount: 150,
      unit: "g",
      nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
    }],
    note: "午餐",
    photo: "data:image/png;base64,ignored"
  }, {
    id: "entry_old",
    timestamp: "2026-05-10T12:00:00",
    items: [{
      foodId: "food_rice",
      label: "1拳",
      amount: 150,
      unit: "g",
      nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45, sodium: 1.5 }
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
    portion: "1拳",
    amount: 150,
    unit: "g",
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45,
    sodium: 1.5,
    waterMl: 0,
    note: "午餐"
  }, {
    date: "2026-05-18",
    timestamp: "2026-05-18T15:00:00",
    type: "water",
    food: "饮水",
    portion: "",
    amount: 300,
    unit: "ml",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sodium: 0,
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
    portion: "1拳",
    amount: 150,
    unit: "g",
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45,
    sodium: 1.5,
    waterMl: 0,
    note: "午餐"
  }]);

  assert.equal(csv.split("\n")[0], "date,timestamp,type,food,portion,amount,unit,calories,protein,carbs,fat,sodium,waterMl,note");
  assert.match(csv, /"米饭,鸡蛋"/);
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
  assert.equal(targets.carbs > 0, true);
  assert.equal(targets.fat > 0, true);
});

test("builds daily structure statuses from summary and targets", () => {
  const state = createDefaultState();
  state.dailyGoal = { calories: 2000, protein: 100, waterMl: 2000 };
  state.entries = [{
    id: "entry_a",
    timestamp: "2026-05-18T12:00:00",
    items: [{
      foodId: "food_rice",
      amount: 150,
      unit: "g",
      nutrition: { calories: 2100, protein: 60, carbs: 300, fat: 80, sodium: 2300 }
    }],
    note: "",
    photo: ""
  }];
  state.waterEntries = [{ id: "water_a", timestamp: "2026-05-18T15:00:00", milliliters: 500 }];

  const structure = dailyStructure(state, "2026-05-18");

  assert.equal(structure.calories.status, "over");
  assert.equal(structure.protein.status, "low");
  assert.equal(structure.waterMl.status, "low");
  assert.equal(structure.sodium.status, "over");
});
