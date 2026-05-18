export const EMPTY_NUTRITION = Object.freeze({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0
});

export function roundMetric(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calculateItemNutrition(food, grams) {
  const safeGrams = Number(grams) || 0;
  const nutrition = food?.nutrition || EMPTY_NUTRITION;
  const divisor = food?.nutritionMode === "perServing"
    ? Number(food.servingGrams) || 1
    : 100;
  const ratio = safeGrams / divisor;

  return {
    calories: roundMetric((nutrition.calories || 0) * ratio),
    protein: roundMetric((nutrition.protein || 0) * ratio),
    carbs: roundMetric((nutrition.carbs || 0) * ratio),
    fat: roundMetric((nutrition.fat || 0) * ratio)
  };
}

export function createDefaultState() {
  return {
    foods: [
      {
        id: "food_rice",
        name: "米饭",
        category: "主食",
        kind: "regular",
        emoji: "🍚",
        image: "",
        nutritionMode: "per100g",
        nutrition: { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3 },
        defaultPortionId: "portion_rice_fist",
        quickAdd: true
      },
      {
        id: "food_chicken",
        name: "鸡胸肉",
        category: "蛋白质",
        kind: "regular",
        emoji: "🍗",
        image: "",
        nutritionMode: "per100g",
        nutrition: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        defaultPortionId: "portion_chicken_palm",
        quickAdd: true
      },
      {
        id: "food_yogurt",
        name: "希腊酸奶",
        category: "包装",
        kind: "packaged",
        emoji: "🥛",
        image: "",
        nutritionMode: "perServing",
        servingGrams: 100,
        packageGrams: 100,
        nutrition: { calories: 120, protein: 10, carbs: 8, fat: 4 },
        defaultPortionId: "portion_yogurt_cup",
        quickAdd: true
      },
      {
        id: "food_nuts",
        name: "坚果",
        category: "零食",
        kind: "regular",
        emoji: "🥜",
        image: "",
        nutritionMode: "per100g",
        nutrition: { calories: 607, protein: 20, carbs: 21, fat: 54 },
        defaultPortionId: "portion_nuts_half_hand",
        quickAdd: true
      }
    ],
    portions: [
      { id: "portion_rice_fist", foodId: "food_rice", label: "1拳", grams: 150 },
      { id: "portion_chicken_palm", foodId: "food_chicken", label: "1掌心", grams: 120 },
      { id: "portion_yogurt_cup", foodId: "food_yogurt", label: "1杯", grams: 100 },
      { id: "portion_nuts_half_hand", foodId: "food_nuts", label: "半把", grams: 15 }
    ],
    entries: [],
    waterEntries: [],
    calibration: {
      fistWidthCm: 8.5,
      palmWidthCm: 8,
      fingerWidthCm: 1.8,
      containers: [{ id: "container_bowl", label: "家用碗", capacityMl: 350 }]
    },
    dailyGoal: { calories: 2000, protein: 100, waterMl: 2000 }
  };
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
    fat: roundMetric((left.fat || 0) + (right.fat || 0))
  };
}

export function summarizeDay(state, dayKey) {
  const summary = {
    ...EMPTY_NUTRITION,
    waterMl: 0,
    entryCount: 0
  };

  for (const entry of state.entries || []) {
    if (dateKey(entry.timestamp) !== dayKey) continue;
    summary.entryCount += 1;
    for (const item of entry.items || []) {
      const next = addNutrition(summary, item.nutrition || EMPTY_NUTRITION);
      summary.calories = next.calories;
      summary.protein = next.protein;
      summary.carbs = next.carbs;
      summary.fat = next.fat;
    }
  }

  for (const water of state.waterEntries || []) {
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
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(endDayKey, index - 6);
    return { date, ...summarizeDay(state, date) };
  });
}

export function createId(prefix) {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
