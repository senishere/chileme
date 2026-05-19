export function renderToday() {
  return "";
}

export function isWaterFood(food) {
  return food?.id === "food_water" || food?.category === "水";
}

export function foodLabel(food) {
  return food?.name || "未知食物";
}

export function renderCategoryChips() {
  return "";
}
