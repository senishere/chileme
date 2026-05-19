import {
  activeRecordState,
  dateKey,
  trendStats
} from "../domain.js";
import {
  escapeAttr,
  escapeHtml,
  formatNumber
} from "../ui/format.js";

export function renderStats(context) {
  const { state, statsDays } = context;
  const stats = trendStats(activeRecordState(state), dateKey(), statsDays);
  const maxCalories = Math.max(1, ...stats.map((day) => day.calories));
  const totalCalories = stats.reduce((sum, day) => sum + day.calories, 0);
  const averageCalories = Math.round(totalCalories / stats.length);
  const activeDays = stats.filter((day) => day.entryCount > 0 || day.waterMl > 0).length;
  const bars = stats.map((day, index) => {
    const label = trendLabel(day, index, stats.length);
    return `
    <article class="trend-day ${label ? "has-label" : ""}" title="${escapeAttr(day.date)} · ${formatNumber(day.calories)} kcal">
      <span style="height: ${Math.max(4, Math.round((day.calories / maxCalories) * 100))}%"></span>
      ${label ? `<em>${escapeHtml(label)}</em>` : ""}
    </article>
  `;
  }).join("");

  return `
    <section class="panel">
      <div class="section-head"><h2>统计</h2><span class="hint">${statsDays} 天趋势</span></div>
      <div class="segmented">
        <button class="${statsDays === 7 ? "active" : ""}" type="button" data-action="set-stats-range" data-days="7">最近一周</button>
        <button class="${statsDays === 30 ? "active" : ""}" type="button" data-action="set-stats-range" data-days="30">最近一月</button>
      </div>
      <div class="trend-summary" aria-label="统计摘要">
        <article><strong>${formatNumber(totalCalories)}</strong><span>总热量 kcal</span></article>
        <article><strong>${formatNumber(averageCalories)}</strong><span>日均 kcal</span></article>
        <article><strong>${activeDays}</strong><span>有记录天数</span></article>
      </div>
      <div class="trend-bars" aria-label="热量趋势">${bars}</div>
    </section>
  `;
}

function trendLabel(day, index, total) {
  if (total <= 7) return day.date.slice(5);
  if (index === 0 || index === total - 1 || index % 5 === 0) return day.date.slice(5);
  return "";
}
