import {
  kilojoulesToCalories,
  positiveFiniteNumber
} from "../domain.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString("zh-CN", {
    maximumFractionDigits: digits
  });
}

export function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(timestamp));
}

export function amountLabel(amount, unit = "g", digits = 1) {
  const safeUnit = unit === "ml" ? "ml" : "g";
  const safeDigits = safeUnit === "ml" ? 0 : digits;
  return `${formatNumber(amount, safeDigits)}${safeUnit}`;
}

export function itemAmountLabel(item) {
  return amountLabel(
    positiveFiniteNumber(item?.amount, positiveFiniteNumber(item?.grams, 0)),
    item?.unit
  );
}

export function caloriesFromEnergyInputs(caloriesValue, kilojoulesValue) {
  const caloriesText = String(caloriesValue ?? "").trim();
  if (caloriesText !== "") {
    const calories = Number(caloriesValue);
    if (Number.isFinite(calories) && calories >= 0) return calories;
  }
  return kilojoulesToCalories(kilojoulesValue);
}
