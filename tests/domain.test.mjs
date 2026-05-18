import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEntryItem,
  calculateItemNutrition,
  createDefaultState,
  dateKey,
  findFood,
  findPortion,
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
