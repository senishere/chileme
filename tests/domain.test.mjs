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
    nutrition: { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3 }
  };

  assert.deepEqual(calculateItemNutrition(food, 150), {
    calories: 174,
    protein: 3.9,
    carbs: 38.85,
    fat: 0.45
  });
});

test("calculates package nutrition by serving ratio", () => {
  const food = {
    id: "food_yogurt",
    nutritionMode: "perServing",
    servingGrams: 100,
    nutrition: { calories: 120, protein: 10, carbs: 8, fat: 4 }
  };

  assert.deepEqual(calculateItemNutrition(food, 50), {
    calories: 60,
    protein: 5,
    carbs: 4,
    fat: 2
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
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45 }
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
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45 }
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
          nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45 }
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
    grams: 150,
    nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45 }
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
    grams: 150,
    nutrition: { calories: 174, protein: 3.9, carbs: 38.85, fat: 0.45 }
  });
});
