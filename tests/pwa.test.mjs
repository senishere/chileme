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

  assert.match(sw, /const CACHE_NAME = "chileme-app-shell-v\d+"/);
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

test("app exposes a food editing flow for custom and packaged foods", () => {
  const app = readText("../src/app.js");

  assert.match(app, /data-action="edit-food"/);
  assert.match(app, /openFoodForm\(target\.dataset\.foodId \|\| ""\)/);
  assert.match(app, /name="foodId"/);
  assert.match(app, /name="portionId"/);
  assert.match(app, /state\.foods = state\.foods\.map/);
  assert.match(app, /state\.portions = state\.portions\.map/);
});
