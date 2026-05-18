import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readText(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("registers the service worker from the app entrypoint only when supported", () => {
  const app = readText("../src/app.js");

  assert.match(app, /"serviceWorker"\s+in\s+navigator/);
  assert.match(app, /window\.isSecureContext/);
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);
});

test("service worker precaches the app shell for offline startup", () => {
  const sw = readText("../sw.js");

  assert.match(sw, /const CACHE_NAME = "chileme-app-shell-v2"/);
  for (const asset of [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./assets/apple-touch-icon.png",
    "./assets/icon.svg",
    "./src/app.js",
    "./src/domain.js",
    "./src/store.js",
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

test("bottom navigation uses simplified food label", () => {
  const html = readText("../index.html");

  assert.match(html, />食物</);
  assert.doesNotMatch(html, /食物库/);
});

test("app exposes simplified recording and food editing contracts", () => {
  const app = readText("../src/app.js");

  assert.match(app, /data-action="edit-food"/);
  assert.match(app, /openFoodForm\(target\.dataset\.foodId \|\| ""\)/);
  assert.match(app, /name="foodId"/);
  assert.match(app, /name="amount"/);
  assert.match(app, /name="unit"/);
  assert.match(app, /nutritionPer100g/);
  assert.match(app, /data-action="open-category-manager"/);
  assert.match(app, /data-action="select-food-icon"/);
  assert.match(app, /state\.foods = state\.foods\.map/);
  assert.doesNotMatch(app, /默认份量|营养标注方式|每份重量|整包重量|液体密度|拳头宽度|掌心宽度|手指宽度|常用容器/);
});

test("quick add rail has no standalone water shortcut and no prefilled 100g draft item", () => {
  const app = readText("../src/app.js");
  const quickBlock = app.match(/function renderQuickAdd\(\) \{[\s\S]*?function renderTimeline/)?.[0] || "";
  const modalBlock = app.match(/function openEntryModal\([\s\S]*?function openFoodForm/)?.[0] || "";

  assert.ok(quickBlock);
  assert.doesNotMatch(quickBlock, /\+ 300ml|data-action="add-water"/);
  assert.ok(modalBlock);
  assert.doesNotMatch(modalBlock, /foodId \? \[createDraftItem/);
  assert.match(app, /if \(!entryDraft\.items\.length\)/);
});

test("quick add calorie label separates number from unit for compact cards", () => {
  const app = readText("../src/app.js");
  const quickBlock = app.match(/function renderQuickAdd\(\) \{[\s\S]*?function renderTimeline/)?.[0] || "";
  const css = readText("../src/styles.css");

  assert.ok(quickBlock);
  assert.match(quickBlock, /quick-calories/);
  assert.match(quickBlock, /quick-calorie-value/);
  assert.match(quickBlock, /quick-calorie-unit/);
  assert.match(css, /\.quick-calorie-value/);
  assert.match(css, /\.quick-calorie-unit/);
});

test("domain no longer exports temporary portion compatibility helpers", () => {
  const domain = readText("../src/domain.js");

  assert.doesNotMatch(domain, /export function \w*portion\w*/i);
});

test("category manager supports selecting default category icons", () => {
  const app = readText("../src/app.js");
  const categoryManagerBlock = app.match(/function openCategoryManager\(\) \{[\s\S]*?function dataUrlTooLarge/)?.[0] || "";

  assert.ok(categoryManagerBlock);
  assert.match(categoryManagerBlock, /name="icon"/);
  assert.match(categoryManagerBlock, /data-action="select-category-icon"/);
  assert.match(categoryManagerBlock, /ICON_OPTIONS/);
  assert.match(app, /action === "select-category-icon"/);
  assert.match(app, /addCategory\(state, data\.get\("categoryName"\), data\.get\("icon"\)\)/);
});

test("today structure labels severe low status as serious shortage", () => {
  const app = readText("../src/app.js");
  const structureBlock = app.match(/function renderStructure\([\s\S]*?function renderToday/)?.[0] || "";
  const iconBlock = app.match(/function structureIcon\(key\) \{[\s\S]*?function renderStructure/)?.[0] || "";
  const css = readText("../src/styles.css");

  assert.match(app, /status === "severe-low"\)\s+return "严重不足"/);
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
  const app = readText("../src/app.js");
  const timelineBlock = app.match(/function renderTimeline\([\s\S]*?function renderToday/)?.[0] || "";

  assert.ok(timelineBlock);
  assert.doesNotMatch(timelineBlock, /钠|sodium/);
});

test("stats source renders trend tabs without daily sodium rows", () => {
  const app = readText("../src/app.js");
  const statsBlock = app.match(/function renderStats\([\s\S]*?function renderSettings/)?.[0] || "";

  assert.ok(statsBlock);
  assert.match(statsBlock, /最近一周/);
  assert.match(statsBlock, /最近一月/);
  assert.match(statsBlock, /trendStats/);
  assert.match(statsBlock, /trend-summary/);
  assert.match(statsBlock, /trendLabel\(day, index, stats\.length\)/);
  assert.doesNotMatch(statsBlock, /day\.sodium/);
});

test("settings source groups export controls into one form instead of four sibling buttons", () => {
  const app = readText("../src/app.js");
  const settingsBlock = app.match(/function renderSettings\([\s\S]*?function render\(\)/)?.[0] || "";

  assert.ok(settingsBlock);
  assert.match(settingsBlock, /data-action="export-range-form"/);
  assert.match(settingsBlock, /name="exportDays"/);
  assert.match(settingsBlock, /name="exportFormat"/);
  assert.doesNotMatch(settingsBlock, /data-action="export-range" data-days="7"/);
  assert.doesNotMatch(settingsBlock, /data-action="export-range" data-days="30"/);
});
