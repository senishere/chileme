import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readText(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function readAppModule(path) {
  return readText(path);
}

test("registers the service worker from the app entrypoint only when supported", () => {
  const app = readText("../src/app.js");

  assert.match(app, /"serviceWorker"\s+in\s+navigator/);
  assert.match(app, /window\.isSecureContext/);
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);
});

test("service worker precaches the app shell for offline startup", () => {
  const sw = readText("../sw.js");

  assert.match(sw, /const CACHE_NAME = "chileme-app-shell-v3"/);
  for (const asset of [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./assets/apple-touch-icon.png",
    "./assets/icon.svg",
    "./src/app.js",
    "./src/domain.js",
    "./src/store.js",
    "./src/ui/format.js",
    "./src/ui/image.js",
    "./src/recognition.js",
    "./src/views/today.js",
    "./src/views/foods.js",
    "./src/views/stats.js",
    "./src/views/settings.js",
    "./src/styles.css"
  ]) {
    assert.match(sw, new RegExp(asset.replaceAll(".", "\\.")));
  }
  assert.match(sw, /self\.addEventListener\("install"/);
  assert.match(sw, /cache\.addAll\(APP_SHELL\)/);
});

test("service worker refreshes static assets from network before using cache", () => {
  const sw = readText("../sw.js");

  const fetchBlock = sw.match(/if \(request\.mode === "navigate"\)[\s\S]*?\n  event\.respondWith\(([\s\S]*?)\n  \);\n\}\);/)?.[1] || "";
  const networkIndex = fetchBlock.indexOf("fetch(request)");
  const cacheIndex = fetchBlock.indexOf("caches.match(request)");

  assert.notEqual(networkIndex, -1);
  assert.notEqual(cacheIndex, -1);
  assert.equal(networkIndex < cacheIndex, true);
});

test("service worker serves navigation requests from cached index when offline", () => {
  const sw = readText("../sw.js");

  assert.match(sw, /self\.addEventListener\("fetch"/);
  assert.match(sw, /request\.mode === "navigate"/);
  assert.match(sw, /caches\.match\("\.\/index\.html"\)/);
});

test("README explains HTTPS deployment for iPhone offline use", () => {
  const readme = readText("../README.md");

  assert.match(readme, /HTTPS/);
  assert.match(readme, /service worker/);
  assert.match(readme, /GitHub Pages|Cloudflare Pages|Netlify|Vercel/);
  assert.match(readme, /首次联网打开/);
});

test("recognition interface scaffold exposes unconfigured label and photo contracts", () => {
  const recognition = readText("../src/recognition.js");

  assert.match(recognition, /RecognitionNotConfiguredError/);
  assert.match(recognition, /recognizeNutritionLabel/);
  assert.match(recognition, /recognizeFoodPhoto/);
  assert.match(recognition, /source:\s*"nutrition_label"/);
  assert.match(recognition, /source:\s*"food_photo"/);
});

test("recognition draft helpers expose Task 3 result shapes", async () => {
  const {
    nutritionLabelResultDraft,
    foodPhotoResultDraft
  } = await import("../src/recognition.js");

  assert.deepEqual(nutritionLabelResultDraft({
    foodName: "燕麦",
    notes: ["per package adjusted"],
    confidence: 0.82
  }), {
    source: "nutrition_label",
    foodName: "燕麦",
    basis: "per100g",
    nutritionPer100g: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sodium: 0,
      fiber: 0
    },
    notes: ["per package adjusted"],
    confidence: 0.82
  });
  assert.equal(nutritionLabelResultDraft({ confidence: "high" }).confidence, 0);
  assert.deepEqual(foodPhotoResultDraft({ candidates: [{ foodName: "米饭" }] }), {
    source: "food_photo",
    candidates: [{ foodName: "米饭" }]
  });
  assert.deepEqual(foodPhotoResultDraft({ candidates: "米饭" }), {
    source: "food_photo",
    candidates: []
  });
});

test("format energy input converts selected kilojoules to calories", async () => {
  const { caloriesFromEnergyInput } = await import("../src/ui/format.js");

  assert.equal(caloriesFromEnergyInput(100, "kcal"), 100);
  assert.equal(caloriesFromEnergyInput(418.4, "kJ"), 100);
  assert.equal(caloriesFromEnergyInput("", "kJ"), 0);
});

test("food form supports free emoji input, energy unit selection, and fiber fields", () => {
  const app = readText("../src/app.js");
  const foods = readAppModule("../src/views/foods.js");
  const formBlock = foods.match(/function openFoodForm\([\s\S]*?function openCategoryManager/)?.[0] || "";
  const submitBlock = app.match(/async function handleFoodSubmit\(form\) \{[\s\S]*?function exportJson/)?.[0] || "";

  assert.ok(formBlock);
  assert.match(formBlock, /name="icon"[\s\S]*value="\$\{escapeAttr\(icon\)\}"/);
  assert.doesNotMatch(formBlock, /<input type="hidden" name="icon"/);
  assert.match(formBlock, /name="energy"/);
  assert.match(formBlock, /name="energyUnit"/);
  assert.match(formBlock, /<option value="kcal" selected>kcal<\/option>/);
  assert.match(formBlock, /<option value="kJ">kJ<\/option>/);
  assert.doesNotMatch(formBlock, /name="kilojoules"/);
  assert.match(formBlock, /name="fiber"/);
  assert.match(formBlock, /name="energy"[\s\S]*value="\$\{escapeAttr\(existingFood \? \(nutrition\.calories \?\? ""\) : ""\)\}"/);
  assert.doesNotMatch(formBlock, /name="energy"[\s\S]*nutrition\.calories\s*\|\|\s*0/);
  assert.doesNotMatch(formBlock, /name="energy"[\s\S]*nutrition\.calories\s*\?\?\s*0/);
  assert.ok(submitBlock);
  assert.match(submitBlock, /caloriesFromEnergyInput\(data\.get\("energy"\), data\.get\("energyUnit"\)\)/);
  assert.match(submitBlock, /nutritionPer100g:\s*\{[\s\S]*fiber:\s*nonNegativeFiniteNumber\(data\.get\("fiber"\), 0\)/);
});

test("settings source renders local profile controls and fiber target", () => {
  const settings = readAppModule("../src/views/settings.js");
  const settingsBlock = settings.match(/function renderSettings\([\s\S]*/)?.[0] || "";

  assert.ok(settingsBlock);
  assert.match(settingsBlock, /当前档案/);
  assert.match(settingsBlock, /name="activeProfileId"/);
  assert.match(settingsBlock, /data-action="set-active-profile"/);
  assert.match(settingsBlock, /data-action="add-profile"/);
  assert.match(settingsBlock, /data-action="rename-profile"/);
  assert.match(settingsBlock, /data-action="delete-profile"/);
  assert.match(settingsBlock, /name="fiber"/);
  assert.match(settingsBlock, /getActiveProfile\(state\)/);
});

test("today source renders active profile banner from active record state", () => {
  const today = readAppModule("../src/views/today.js");
  const todayBlock = today.match(/function renderToday\([\s\S]*/)?.[0] || "";

  assert.ok(todayBlock);
  assert.match(todayBlock, /activeRecordState\(state\)/);
  assert.match(todayBlock, /getActiveProfile\(state\)/);
  assert.match(todayBlock, /profile-name/);
});

test("runtime render helpers project current profile records", () => {
  const app = readText("../src/app.js");
  const today = readAppModule("../src/views/today.js");
  const stats = readAppModule("../src/views/stats.js");
  const summaryBlock = today.match(/function renderSummary\([\s\S]*?function statusLabel/)?.[0] || "";
  const structureBlock = today.match(/function renderStructure\([\s\S]*?function renderQuickAdd/)?.[0] || "";
  const timelineBlock = today.match(/function renderTimeline\([\s\S]*?function renderToday/)?.[0] || "";
  const statsBlock = stats.match(/function renderStats\([\s\S]*?function trendLabel/)?.[0] || "";
  const exportBlock = app.match(/function exportRange\([\s\S]*?function importJson/)?.[0] || "";

  for (const block of [summaryBlock, structureBlock, timelineBlock, statsBlock, exportBlock]) {
    assert.match(block, /activeRecordState\(state\)/);
  }
});

test("app source does not expose temporary AI recognition UI or calls", () => {
  const app = readText("../src/app.js");

  assert.doesNotMatch(app, /拍照识别/);
  assert.doesNotMatch(app, /recognizeNutritionLabel/);
  assert.doesNotMatch(app, /recognizeFoodPhoto/);
});

test("bottom navigation uses simplified food label", () => {
  const html = readText("../index.html");

  assert.match(html, />食物</);
  assert.doesNotMatch(html, /食物库/);
});

test("app exposes simplified recording and food editing contracts", () => {
  const app = readText("../src/app.js");
  const foods = readAppModule("../src/views/foods.js");

  assert.match(foods, /data-action="edit-food"/);
  assert.match(app, /openFoodForm\(viewContext\(\), target\.dataset\.foodId \|\| ""\)/);
  assert.match(app, /name="foodId"/);
  assert.match(app, /name="amount"/);
  assert.match(app, /name="unit"/);
  assert.match(app, /nutritionPer100g/);
  assert.match(foods, /data-action="open-category-manager"/);
  assert.match(foods, /select-food-icon/);
  assert.match(app, /state\.foods = state\.foods\.map/);
  assert.doesNotMatch(app, /默认份量|营养标注方式|每份重量|整包重量|液体密度|拳头宽度|掌心宽度|手指宽度|常用容器/);
});

test("quick add rail has no standalone water shortcut and no prefilled 100g draft item", () => {
  const app = readText("../src/app.js");
  const today = readAppModule("../src/views/today.js");
  const quickBlock = today.match(/function renderQuickAdd\([\s\S]*?function renderTimeline/)?.[0] || "";
  const modalBlock = app.match(/function openEntryModal\([\s\S]*?function goalInputValue/)?.[0] || "";

  assert.ok(quickBlock);
  assert.doesNotMatch(quickBlock, /\+ 300ml|data-action="add-water"/);
  assert.ok(modalBlock);
  assert.doesNotMatch(modalBlock, /foodId \? \[createDraftItem/);
  assert.match(app, /if \(!entryDraft\.items\.length\)/);
});

test("quick add calorie label separates number from unit for compact cards", () => {
  const today = readAppModule("../src/views/today.js");
  const quickBlock = today.match(/function renderQuickAdd\([\s\S]*?function renderTimeline/)?.[0] || "";
  const css = readText("../src/styles.css");

  assert.ok(quickBlock);
  assert.match(quickBlock, /quick-calories/);
  assert.match(quickBlock, /quick-calorie-value/);
  assert.match(quickBlock, /quick-calorie-unit/);
  assert.match(css, /\.quick-calorie-value/);
  assert.match(css, /\.quick-calorie-unit/);
});

test("split views write normalized category fallback through app context callbacks", () => {
  const app = readText("../src/app.js");
  const today = readAppModule("../src/views/today.js");
  const foods = readAppModule("../src/views/foods.js");
  const quickBlock = today.match(/function renderQuickAdd\([\s\S]*?function renderTimeline/)?.[0] || "";
  const foodFallbackBlock = foods.match(/function activeFoodCategory\([\s\S]*?function renderFoodRows/)?.[0] || "";
  const foodRowsBlock = foods.match(/function renderFoodRows\([\s\S]*?function renderFoods/)?.[0] || "";
  const foodsBlock = foods.match(/function renderFoods\([\s\S]*?function openFoodForm/)?.[0] || "";

  assert.match(app, /setQuickCategory:\s*\(value\) => \{\s*quickCategory = value;\s*\}/);
  assert.match(app, /setFoodLibraryCategory:\s*\(value\) => \{\s*foodLibraryCategory = value;\s*\}/);
  assert.match(quickBlock, /context\.setQuickCategory\("favorite"\)/);
  assert.match(foodFallbackBlock, /context\.setFoodLibraryCategory\("all"\)/);
  assert.match(foodRowsBlock, /activeFoodCategory\(context\)/);
  assert.match(foodsBlock, /activeFoodCategory\(context\)/);
});

test("domain no longer exports temporary portion compatibility helpers", () => {
  const domain = readText("../src/domain.js");

  assert.doesNotMatch(domain, /export function \w*portion\w*/i);
});

test("category manager supports selecting default category icons", () => {
  const app = readText("../src/app.js");
  const foods = readAppModule("../src/views/foods.js");
  const categoryManagerBlock = foods.match(/function openCategoryManager\([\s\S]*/)?.[0] || "";

  assert.ok(categoryManagerBlock);
  assert.match(categoryManagerBlock, /name="icon"[\s\S]*value="\$\{escapeAttr\(icon\)\}"/);
  assert.doesNotMatch(categoryManagerBlock, /<input type="hidden" name="icon"/);
  assert.match(categoryManagerBlock, /select-category-icon/);
  assert.match(categoryManagerBlock, /ICON_OPTIONS/);
  assert.match(categoryManagerBlock, /edit-category-icon/);
  assert.match(app, /action === "select-category-icon"/);
  assert.match(app, /action === "edit-category-icon"/);
  assert.match(app, /setCategoryIcon\(state, target\.dataset\.category \|\| "", nextIcon\)/);
  assert.match(app, /addCategory\(state, data\.get\("categoryName"\), data\.get\("icon"\)\)/);
});

test("food list rows omit metadata chips for stable compact height", () => {
  const foods = readAppModule("../src/views/foods.js");
  const css = readText("../src/styles.css");
  const foodRowsBlock = foods.match(/function renderFoodRows\([\s\S]*?function renderFoods/)?.[0] || "";

  assert.ok(foodRowsBlock);
  assert.doesNotMatch(foodRowsBlock, /food-meta/);
  assert.doesNotMatch(foodRowsBlock, /kcal\/100g/);
  assert.match(css, /\.food-row \{[\s\S]*min-height: 58px/);
  assert.doesNotMatch(foodRowsBlock, /<br><span class="hint">\$\{escapeHtml\(food\.category\)\} · \$\{calories\} kcal\/100g/);
});

test("food icon picker centers emoji within each button", () => {
  const css = readText("../src/styles.css");

  assert.match(css, /\.icon-picker button \{[\s\S]*display: flex/);
  assert.match(css, /\.icon-picker button \{[\s\S]*align-items: center/);
  assert.match(css, /\.icon-picker button \{[\s\S]*justify-content: center/);
  assert.match(css, /\.icon-picker button \{[\s\S]*line-height: 1/);
  assert.match(css, /\.icon-picker button \{[\s\S]*padding: 0/);
});

test("water can be recorded as a water entry from the food flow", () => {
  const app = readText("../src/app.js");
  const today = readAppModule("../src/views/today.js");
  const timelineBlock = today.match(/function renderTimeline\([\s\S]*?function renderToday/)?.[0] || "";
  const submitBlock = app.match(/async function handleEntrySubmit\(form\) \{[\s\S]*?async function handleFoodSubmit/)?.[0] || "";

  assert.match(today, /function isWaterFood\(food\)/);
  assert.match(app, /import \{ renderToday, isWaterFood, foodLabel \} from "\.\/views\/today\.js"/);
  assert.match(submitBlock, /updateActiveProfile\(state/);
  assert.match(submitBlock, /waterEntries = \[\.\.\.profile\.waterEntries\]/);
  assert.match(submitBlock, /waterEntries\.push/);
  assert.match(submitBlock, /createId\("water"\)/);
  assert.match(timelineBlock, /records\.waterEntries/);
  assert.match(timelineBlock, /data-action="delete-water"/);
});

test("app install icon uses a rice emoji mark", () => {
  const svg = readText("../assets/icon.svg");

  assert.match(svg, /🍚/);
  assert.doesNotMatch(svg, />么</);
});

test("today structure labels severe low status as serious shortage", () => {
  const today = readAppModule("../src/views/today.js");
  const structureBlock = today.match(/function renderStructure\([\s\S]*?function renderToday/)?.[0] || "";
  const iconBlock = today.match(/function structureIcon\(key\) \{[\s\S]*?function renderStructure/)?.[0] || "";
  const css = readText("../src/styles.css");

  assert.match(today, /status === "severe-low"\)\s+return "严重不足"/);
  assert.match(iconBlock, /🍱/);
  assert.match(iconBlock, /🥚/);
  assert.match(iconBlock, /🍚/);
  assert.match(iconBlock, /🥑/);
  assert.match(iconBlock, /💧/);
  assert.doesNotMatch(iconBlock, /return "火"|return "蛋"|return "碳"|return "脂"|return "水"/);
  assert.ok(structureBlock);
  assert.match(structureBlock, /metric\.ratio/);
  assert.match(structureBlock, /structure-icon/);
  assert.match(structureBlock, /metric-\$\{escapeAttr\(key\)\}/);
  assert.match(css, /white-space: nowrap/);
  assert.doesNotMatch(structureBlock, /metric\.value[\s\S]*metric\.target/);
});

test("timeline source does not render sodium", () => {
  const today = readAppModule("../src/views/today.js");
  const timelineBlock = today.match(/function renderTimeline\([\s\S]*?function renderToday/)?.[0] || "";

  assert.ok(timelineBlock);
  assert.doesNotMatch(timelineBlock, /钠|sodium/);
});

test("stats source renders trend tabs without daily sodium rows", () => {
  const stats = readAppModule("../src/views/stats.js");
  const statsBlock = stats.match(/function renderStats\([\s\S]*?function trendLabel/)?.[0] || "";

  assert.ok(statsBlock);
  assert.match(statsBlock, /最近一周/);
  assert.match(statsBlock, /最近一月/);
  assert.match(statsBlock, /trendStats/);
  assert.match(statsBlock, /trend-summary/);
  assert.match(statsBlock, /trendLabel\(day, index, stats\.length\)/);
  assert.doesNotMatch(statsBlock, /day\.sodium/);
});

test("settings source groups export controls into one form instead of four sibling buttons", () => {
  const settings = readAppModule("../src/views/settings.js");
  const settingsBlock = settings.match(/function renderSettings\([\s\S]*/)?.[0] || "";

  assert.ok(settingsBlock);
  assert.match(settingsBlock, /data-action="export-range-form"/);
  assert.match(settingsBlock, /name="exportDays"/);
  assert.match(settingsBlock, /name="exportFormat"/);
  assert.doesNotMatch(settingsBlock, /data-action="export-range" data-days="7"/);
  assert.doesNotMatch(settingsBlock, /data-action="export-range" data-days="30"/);
});

test("settings distinguishes full backup import from record detail JSON", () => {
  const app = readText("../src/app.js");
  const settings = readAppModule("../src/views/settings.js");
  const settingsBlock = settings.match(/function renderSettings\([\s\S]*/)?.[0] || "";
  const importBlock = app.match(/function importJson\(\) \{[\s\S]*?document\.addEventListener\("click"/)?.[0] || "";

  assert.match(settingsBlock, /完整备份/);
  assert.match(settingsBlock, /导入备份 JSON/);
  assert.match(settingsBlock, /记录明细/);
  assert.match(importBlock, /alert\("备份已导入"/);
});
