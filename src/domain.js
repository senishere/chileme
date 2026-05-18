export const EMPTY_NUTRITION = Object.freeze({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sodium: 0
});

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

export function amountToGrams(food, amount, unit = "g") {
  const safeAmount = positiveFiniteNumber(amount, 0);
  if (unit === "ml") {
    return roundMetric(safeAmount * positiveFiniteNumber(food?.densityGPerMl, 1));
  }
  return safeAmount;
}

export function calculateItemNutrition(food, amount, unit = "g") {
  const safeAmount = positiveFiniteNumber(amount, 0);
  const nutrition = food?.nutrition || EMPTY_NUTRITION;
  const divisor = food?.nutritionMode === "perServing"
    ? positiveFiniteNumber(food.servingGrams, 1)
    : food?.nutritionMode === "perPackage"
      ? positiveFiniteNumber(food.packageGrams, 1)
      : food?.nutritionMode === "per100ml"
        ? 100
      : 100;
  const ratioBase = food?.nutritionMode === "per100ml"
    || ((food?.nutritionMode === "perServing" || food?.nutritionMode === "perPackage") && unit === "ml")
    ? safeAmount
    : amountToGrams(food, safeAmount, unit);
  const ratio = ratioBase / divisor;

  return {
    calories: roundMetric((nutrition.calories || 0) * ratio),
    protein: roundMetric((nutrition.protein || 0) * ratio),
    carbs: roundMetric((nutrition.carbs || 0) * ratio),
    fat: roundMetric((nutrition.fat || 0) * ratio),
    sodium: roundMetric((nutrition.sodium || 0) * ratio)
  };
}

function food(id, name, category, emoji, nutritionMode, nutrition, defaultPortionId, extras = {}) {
  return {
    id,
    name,
    category,
    kind: extras.kind || "regular",
    emoji,
    image: "",
    nutritionMode,
    nutrition: { ...EMPTY_NUTRITION, ...nutrition },
    defaultPortionId,
    quickAdd: extras.quickAdd !== false,
    ...extras
  };
}

function portion(id, foodId, label, amount, unit = "g", densityGPerMl = 1) {
  return {
    id,
    foodId,
    label,
    amount,
    unit,
    grams: unit === "ml" ? roundMetric(amount * densityGPerMl) : amount
  };
}

const DEFAULT_FOODS = [
  food("food_rice", "米饭", "主食", "🍚", "per100g", { calories: 116, protein: 2.6, carbs: 25.9, fat: 0.3, sodium: 1 }, "portion_rice_fist"),
  food("food_noodles", "面条", "主食", "🍜", "per100g", { calories: 138, protein: 4.5, carbs: 25, fat: 2, sodium: 240 }, "portion_noodles_bowl"),
  food("food_steamed_bun", "馒头", "主食", "🍞", "per100g", { calories: 223, protein: 7, carbs: 47, fat: 1.1, sodium: 165 }, "portion_steamed_bun_one"),
  food("food_oatmeal", "燕麦片", "主食", "🥣", "per100g", { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, sodium: 2 }, "portion_oatmeal_scoop"),
  food("food_sweet_potato", "红薯", "主食", "🍠", "per100g", { calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1, sodium: 55 }, "portion_sweet_potato_one"),
  food("food_corn", "玉米", "主食", "🌽", "per100g", { calories: 96, protein: 3.4, carbs: 21, fat: 1.5, sodium: 1 }, "portion_corn_one"),
  food("food_whole_wheat_bread", "全麦面包", "主食", "🍞", "per100g", { calories: 247, protein: 13, carbs: 41, fat: 4.2, sodium: 400 }, "portion_bread_slice"),
  food("food_potato", "土豆", "主食", "🥔", "per100g", { calories: 77, protein: 2, carbs: 17, fat: 0.1, sodium: 6 }, "portion_potato_one"),

  food("food_egg", "鸡蛋", "蛋白质", "🥚", "per100g", { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, sodium: 142 }, "portion_egg_one"),
  food("food_chicken", "鸡胸肉", "蛋白质", "🍗", "per100g", { calories: 165, protein: 31, carbs: 0, fat: 3.6, sodium: 74 }, "portion_chicken_palm"),
  food("food_beef", "牛肉", "蛋白质", "🥩", "per100g", { calories: 250, protein: 26, carbs: 0, fat: 15, sodium: 72 }, "portion_beef_palm"),
  food("food_pork", "猪肉瘦肉", "蛋白质", "🥩", "per100g", { calories: 143, protein: 21, carbs: 0, fat: 6, sodium: 57 }, "portion_pork_palm"),
  food("food_salmon", "三文鱼", "蛋白质", "🐟", "per100g", { calories: 208, protein: 20, carbs: 0, fat: 13, sodium: 59 }, "portion_salmon_palm"),
  food("food_shrimp", "虾仁", "蛋白质", "🦐", "per100g", { calories: 99, protein: 24, carbs: 0.2, fat: 0.3, sodium: 111 }, "portion_shrimp_palm"),
  food("food_tofu", "北豆腐", "蛋白质", "⬜", "per100g", { calories: 76, protein: 8, carbs: 1.9, fat: 4.8, sodium: 7 }, "portion_tofu_block"),
  food("food_edamame", "毛豆", "蛋白质", "🫘", "per100g", { calories: 121, protein: 11.9, carbs: 8.9, fat: 5.2, sodium: 6 }, "portion_edamame_bowl"),

  food("food_milk", "牛奶", "奶/饮品", "🥛", "per100ml", { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sodium: 42 }, "portion_milk_cup", { densityGPerMl: 1.03 }),
  food("food_skim_milk", "脱脂牛奶", "奶/饮品", "🥛", "per100ml", { calories: 34, protein: 3.4, carbs: 5, fat: 0.1, sodium: 42 }, "portion_skim_milk_cup", { densityGPerMl: 1.03 }),
  food("food_yogurt", "希腊酸奶", "奶/饮品", "🥛", "perServing", { calories: 120, protein: 10, carbs: 8, fat: 4, sodium: 55 }, "portion_yogurt_cup", { kind: "packaged", servingGrams: 100, packageGrams: 100 }),
  food("food_soy_milk", "豆浆", "奶/饮品", "🥤", "per100ml", { calories: 33, protein: 3, carbs: 3, fat: 1.6, sodium: 35 }, "portion_soy_milk_cup", { densityGPerMl: 1 }),
  food("food_latte", "拿铁", "奶/饮品", "☕", "per100ml", { calories: 45, protein: 2.5, carbs: 4.2, fat: 2, sodium: 38 }, "portion_latte_cup", { densityGPerMl: 1.02 }),
  food("food_black_coffee", "黑咖啡", "奶/饮品", "☕", "per100ml", { calories: 2, protein: 0.1, carbs: 0, fat: 0, sodium: 2 }, "portion_black_coffee_cup", { densityGPerMl: 1 }),
  food("food_orange_juice", "橙汁", "奶/饮品", "🍊", "per100ml", { calories: 45, protein: 0.7, carbs: 10.4, fat: 0.2, sodium: 1 }, "portion_orange_juice_cup", { densityGPerMl: 1.04 }),
  food("food_cola", "可乐", "奶/饮品", "🥤", "per100ml", { calories: 42, protein: 0, carbs: 10.6, fat: 0, sodium: 4 }, "portion_cola_can", { densityGPerMl: 1.04 }),
  food("food_protein_shake", "蛋白粉饮品", "奶/饮品", "🥤", "perServing", { calories: 120, protein: 24, carbs: 3, fat: 1.5, sodium: 150 }, "portion_protein_shake_serving", { kind: "packaged", servingGrams: 300, packageGrams: 300 }),

  food("food_broccoli", "西兰花", "蔬菜", "🥦", "per100g", { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, sodium: 33 }, "portion_broccoli_bowl"),
  food("food_tomato", "番茄", "蔬菜", "🍅", "per100g", { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, sodium: 5 }, "portion_tomato_one"),
  food("food_spinach", "菠菜", "蔬菜", "🥬", "per100g", { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, sodium: 79 }, "portion_spinach_bowl"),
  food("food_cucumber", "黄瓜", "蔬菜", "🥒", "per100g", { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, sodium: 2 }, "portion_cucumber_one"),
  food("food_carrot", "胡萝卜", "蔬菜", "🥕", "per100g", { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, sodium: 69 }, "portion_carrot_one"),
  food("food_lettuce", "生菜", "蔬菜", "🥬", "per100g", { calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, sodium: 28 }, "portion_lettuce_bowl"),
  food("food_mushroom", "蘑菇", "蔬菜", "🍄", "per100g", { calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, sodium: 5 }, "portion_mushroom_bowl"),
  food("food_avocado", "牛油果", "蔬果", "🥑", "per100g", { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, sodium: 7 }, "portion_avocado_half"),

  food("food_apple", "苹果", "水果", "🍎", "per100g", { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, sodium: 1 }, "portion_apple_one"),
  food("food_banana", "香蕉", "水果", "🍌", "per100g", { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, sodium: 1 }, "portion_banana_one"),
  food("food_blueberry", "蓝莓", "水果", "🫐", "per100g", { calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, sodium: 1 }, "portion_blueberry_cup"),
  food("food_orange", "橙子", "水果", "🍊", "per100g", { calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, sodium: 0 }, "portion_orange_one"),
  food("food_strawberry", "草莓", "水果", "🍓", "per100g", { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, sodium: 1 }, "portion_strawberry_cup"),
  food("food_grape", "葡萄", "水果", "🍇", "per100g", { calories: 69, protein: 0.7, carbs: 18.1, fat: 0.2, sodium: 2 }, "portion_grape_cup"),

  food("food_almond", "杏仁", "零食", "🥜", "per100g", { calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, sodium: 1 }, "portion_almond_hand"),
  food("food_walnut", "核桃", "零食", "🌰", "per100g", { calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2, sodium: 2 }, "portion_walnut_hand"),
  food("food_nuts", "混合坚果", "零食", "🥜", "per100g", { calories: 607, protein: 20, carbs: 21, fat: 54, sodium: 5 }, "portion_nuts_half_hand"),
  food("food_dark_chocolate", "黑巧克力", "零食", "🍫", "per100g", { calories: 546, protein: 4.9, carbs: 61, fat: 31, sodium: 24 }, "portion_chocolate_piece"),
  food("food_potato_chips", "薯片", "零食", "🥔", "per100g", { calories: 536, protein: 7, carbs: 53, fat: 34, sodium: 525 }, "portion_chips_bag", { kind: "packaged", servingGrams: 30, packageGrams: 70 }),
  food("food_biscuit", "饼干", "零食", "🍪", "per100g", { calories: 480, protein: 6, carbs: 68, fat: 20, sodium: 450 }, "portion_biscuit_pack", { kind: "packaged", servingGrams: 30, packageGrams: 100 }),

  food("food_instant_noodles", "方便面", "包装/高钠", "🍜", "perPackage", { calories: 470, protein: 9, carbs: 62, fat: 20, sodium: 1800 }, "portion_instant_noodles_pack", { kind: "packaged", servingGrams: 100, packageGrams: 100 }),
  food("food_ham", "火腿片", "包装/高钠", "🥓", "per100g", { calories: 145, protein: 20, carbs: 2, fat: 6, sodium: 1200 }, "portion_ham_slice", { kind: "packaged", servingGrams: 30, packageGrams: 200 }),
  food("food_soy_sauce", "酱油", "调味", "🧂", "per100ml", { calories: 53, protein: 8, carbs: 4.9, fat: 0.6, sodium: 5600 }, "portion_soy_sauce_spoon", { densityGPerMl: 1.2 }),
  food("food_peanut_butter", "花生酱", "调味", "🥜", "per100g", { calories: 588, protein: 25, carbs: 20, fat: 50, sodium: 460 }, "portion_peanut_butter_spoon"),
  food("food_olive_oil", "橄榄油", "调味", "🫒", "per100ml", { calories: 824, protein: 0, carbs: 0, fat: 91.6, sodium: 2 }, "portion_olive_oil_spoon", { densityGPerMl: 0.91 }),

  food("food_chicken_salad", "鸡胸肉沙拉", "轻食", "🥗", "per100g", { calories: 110, protein: 12, carbs: 5, fat: 4, sodium: 180 }, "portion_chicken_salad_bowl"),
  food("food_sushi", "寿司", "轻食", "🍣", "per100g", { calories: 145, protein: 5, carbs: 28, fat: 2, sodium: 430 }, "portion_sushi_piece"),
  food("food_dumpling", "饺子", "中式", "🥟", "per100g", { calories: 230, protein: 8, carbs: 30, fat: 8, sodium: 480 }, "portion_dumpling_six"),
  food("food_baozi", "包子", "中式", "🥟", "per100g", { calories: 230, protein: 8, carbs: 36, fat: 6, sodium: 420 }, "portion_baozi_one"),
  food("food_congee", "白粥", "中式", "🥣", "per100g", { calories: 46, protein: 1.1, carbs: 10, fat: 0.2, sodium: 3 }, "portion_congee_bowl"),
  food("food_fried_rice", "炒饭", "中式", "🍛", "per100g", { calories: 188, protein: 5, carbs: 28, fat: 6, sodium: 420 }, "portion_fried_rice_bowl")
];

const DEFAULT_PORTIONS = [
  portion("portion_rice_fist", "food_rice", "1拳", 150),
  portion("portion_noodles_bowl", "food_noodles", "1碗", 250),
  portion("portion_steamed_bun_one", "food_steamed_bun", "1个", 100),
  portion("portion_oatmeal_scoop", "food_oatmeal", "1勺", 35),
  portion("portion_sweet_potato_one", "food_sweet_potato", "1个", 180),
  portion("portion_corn_one", "food_corn", "1根", 160),
  portion("portion_bread_slice", "food_whole_wheat_bread", "1片", 35),
  portion("portion_potato_one", "food_potato", "1个", 160),
  portion("portion_egg_one", "food_egg", "1个", 50),
  portion("portion_chicken_palm", "food_chicken", "1掌心", 120),
  portion("portion_beef_palm", "food_beef", "1掌心", 120),
  portion("portion_pork_palm", "food_pork", "1掌心", 120),
  portion("portion_salmon_palm", "food_salmon", "1掌心", 120),
  portion("portion_shrimp_palm", "food_shrimp", "1掌心", 120),
  portion("portion_tofu_block", "food_tofu", "半盒", 150),
  portion("portion_edamame_bowl", "food_edamame", "1小碗", 100),
  portion("portion_milk_cup", "food_milk", "1杯", 250, "ml", 1.03),
  portion("portion_skim_milk_cup", "food_skim_milk", "1杯", 250, "ml", 1.03),
  portion("portion_yogurt_cup", "food_yogurt", "1杯", 100),
  portion("portion_soy_milk_cup", "food_soy_milk", "1杯", 250, "ml"),
  portion("portion_latte_cup", "food_latte", "1杯", 300, "ml", 1.02),
  portion("portion_black_coffee_cup", "food_black_coffee", "1杯", 300, "ml"),
  portion("portion_orange_juice_cup", "food_orange_juice", "1杯", 250, "ml", 1.04),
  portion("portion_cola_can", "food_cola", "1罐", 330, "ml", 1.04),
  portion("portion_protein_shake_serving", "food_protein_shake", "1份", 300, "ml"),
  portion("portion_broccoli_bowl", "food_broccoli", "1碗", 150),
  portion("portion_tomato_one", "food_tomato", "1个", 150),
  portion("portion_spinach_bowl", "food_spinach", "1碗", 100),
  portion("portion_cucumber_one", "food_cucumber", "1根", 200),
  portion("portion_carrot_one", "food_carrot", "1根", 80),
  portion("portion_lettuce_bowl", "food_lettuce", "1碗", 80),
  portion("portion_mushroom_bowl", "food_mushroom", "1碗", 100),
  portion("portion_avocado_half", "food_avocado", "半个", 75),
  portion("portion_apple_one", "food_apple", "1个", 180),
  portion("portion_banana_one", "food_banana", "1根", 120),
  portion("portion_blueberry_cup", "food_blueberry", "1小碗", 100),
  portion("portion_orange_one", "food_orange", "1个", 160),
  portion("portion_strawberry_cup", "food_strawberry", "1小碗", 150),
  portion("portion_grape_cup", "food_grape", "1小碗", 150),
  portion("portion_almond_hand", "food_almond", "1把", 28),
  portion("portion_walnut_hand", "food_walnut", "1把", 28),
  portion("portion_nuts_half_hand", "food_nuts", "半把", 15),
  portion("portion_chocolate_piece", "food_dark_chocolate", "2小块", 20),
  portion("portion_chips_bag", "food_potato_chips", "1小包", 70),
  portion("portion_biscuit_pack", "food_biscuit", "1小包", 30),
  portion("portion_instant_noodles_pack", "food_instant_noodles", "1包", 100),
  portion("portion_ham_slice", "food_ham", "2片", 30),
  portion("portion_soy_sauce_spoon", "food_soy_sauce", "1勺", 15, "ml", 1.2),
  portion("portion_peanut_butter_spoon", "food_peanut_butter", "1勺", 16),
  portion("portion_olive_oil_spoon", "food_olive_oil", "1勺", 15, "ml", 0.91),
  portion("portion_chicken_salad_bowl", "food_chicken_salad", "1碗", 250),
  portion("portion_sushi_piece", "food_sushi", "2个", 60),
  portion("portion_dumpling_six", "food_dumpling", "6个", 150),
  portion("portion_baozi_one", "food_baozi", "1个", 100),
  portion("portion_congee_bowl", "food_congee", "1碗", 250),
  portion("portion_fried_rice_bowl", "food_fried_rice", "1碗", 300)
];

export function createDefaultState() {
  return {
    foods: DEFAULT_FOODS.map((item) => ({ ...item, nutrition: { ...item.nutrition } })),
    portions: DEFAULT_PORTIONS.map((item) => ({ ...item })),
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
    fat: roundMetric((left.fat || 0) + (right.fat || 0)),
    sodium: roundMetric((left.sodium || 0) + (right.sodium || 0))
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
      summary.sodium = next.sodium;
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

export function findFood(state, foodId) {
  return (state.foods || []).find((food) => food.id === foodId);
}

export function findPortion(state, portionId) {
  return (state.portions || []).find((portion) => portion.id === portionId);
}

export function portionsForFood(state, foodId) {
  return (state.portions || []).filter((portion) => portion.foodId === foodId);
}

export function buildEntryItem(food, portion, gramsOverride) {
  const unit = portion?.unit === "ml" ? "ml" : "g";
  const fallbackAmount = positiveFiniteNumber(portion?.amount, positiveFiniteNumber(portion?.grams, 0));
  const amount = positiveFiniteNumber(gramsOverride, fallbackAmount);
  const grams = amountToGrams(food, amount, unit);
  return {
    foodId: food.id,
    portionId: portion?.id || "",
    label: portion?.label || `${grams}g`,
    amount,
    unit,
    grams,
    nutrition: calculateItemNutrition(food, amount, unit)
  };
}
