# Liquid Foods And Seed Library Implementation Plan

**Goal:** Add ml-based liquid food support, sodium nutrition, and a mixed built-in food library.

**Architecture:** Keep the app static and local-first. Extend domain nutrition math and default data first, then store normalization/migration, then UI display and forms. Preserve old grams-based records.

**Tech Stack:** Vanilla JavaScript ES modules, Node `node:test`, localStorage.

## Tasks

- [x] Add domain tests for `sodium`, `per100ml`, amount/unit portions, and seeded foods.
- [x] Extend `src/domain.js` nutrition model, default state, default food library, and entry item builder.
- [x] Add store tests for old-data migration and seed-food merge behavior.
- [x] Extend `src/store.js` normalization for sodium, unit, amount, `per100ml`, and built-in food merge.
- [x] Update `src/app.js` UI for ml units, sodium display, food form fields, and per100ml mode.
- [x] Update README/spec references where needed.
- [x] Run automated tests and browser smoke checks.

## Verification

- `npm test`
- `TZ=America/Los_Angeles npm test`
- `node --check src/app.js`
- Local server curl checks for `index.html`, `src/app.js`, `manifest.webmanifest`
- Browser smoke: record `250ml 牛奶`, verify ml display and sodium calculation; confirm seeded foods appear without manual entry.
