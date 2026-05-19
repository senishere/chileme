import { getActiveProfile } from "../domain.js";
import {
  escapeAttr,
  escapeHtml
} from "../ui/format.js";

export function renderSettings(context) {
  const { state } = context;
  const activeProfile = getActiveProfile(state);
  const profile = activeProfile.profile;
  const dailyGoal = activeProfile.dailyGoal;
  return `
    <section class="panel">
      <div class="section-head"><h2>设置</h2><span class="hint">本地数据</span></div>
      <div class="settings-group">
        <h3>当前档案</h3>
        <label class="field">
          <span>当前档案</span>
          <select name="activeProfileId" data-action="set-active-profile">
            ${state.profiles.map((item) => `<option value="${escapeAttr(item.id)}" ${item.id === state.activeProfileId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </label>
        <div class="actions-row">
          <button class="button secondary" type="button" data-action="add-profile">新增档案</button>
          <button class="button secondary" type="button" data-action="rename-profile">重命名</button>
          <button class="button secondary" type="button" data-action="delete-profile">删除档案</button>
        </div>
      </div>
      <form class="form-grid" data-action="save-settings">
        <label class="field"><span>热量目标 kcal</span><input name="calories" inputmode="numeric" value="${escapeAttr(dailyGoal.calories || "")}"></label>
        <label class="field"><span>蛋白质目标 g</span><input name="protein" inputmode="numeric" value="${escapeAttr(dailyGoal.protein || "")}"></label>
        <label class="field"><span>膳食纤维目标 g</span><input name="fiber" inputmode="numeric" value="${escapeAttr(dailyGoal.fiber || "")}"></label>
        <label class="field"><span>饮水目标 ml</span><input name="waterMl" inputmode="numeric" value="${escapeAttr(dailyGoal.waterMl || "")}"></label>
        <label class="field"><span>性别</span><select name="sex"><option value="female" ${profile.sex === "female" ? "selected" : ""}>女</option><option value="male" ${profile.sex === "male" ? "selected" : ""}>男</option></select></label>
        <label class="field"><span>年龄</span><input name="age" inputmode="numeric" value="${escapeAttr(profile.age || "")}"></label>
        <label class="field"><span>身高 cm</span><input name="heightCm" inputmode="decimal" value="${escapeAttr(profile.heightCm || "")}"></label>
        <label class="field"><span>体重 kg</span><input name="weightKg" inputmode="decimal" value="${escapeAttr(profile.weightKg || "")}"></label>
        <label class="field"><span>活动水平</span><select name="activityLevel"><option value="sedentary" ${profile.activityLevel === "sedentary" ? "selected" : ""}>久坐</option><option value="light" ${profile.activityLevel === "light" ? "selected" : ""}>轻度</option><option value="moderate" ${profile.activityLevel === "moderate" ? "selected" : ""}>中等</option><option value="active" ${profile.activityLevel === "active" ? "selected" : ""}>较高</option></select></label>
        <label class="field"><span>目标</span><select name="goal"><option value="maintain" ${profile.goal === "maintain" ? "selected" : ""}>维持</option><option value="lose" ${profile.goal === "lose" ? "selected" : ""}>减脂</option><option value="gain" ${profile.goal === "gain" ? "selected" : ""}>增肌</option></select></label>
        <button class="button" type="submit">保存设置</button>
      </form>
      <div class="settings-group">
        <h3>完整备份</h3>
        <div class="actions-row">
          <button class="button secondary" type="button" data-action="export">导出备份 JSON</button>
          <button class="button secondary" type="button" data-action="import">导入备份 JSON</button>
        </div>
      </div>
      <div class="settings-group">
        <h3>记录明细</h3>
        <form class="export-form" data-action="export-range-form">
          <label class="field"><span>范围</span><select name="exportDays"><option value="7">最近 7 天</option><option value="30">最近 30 天</option></select></label>
          <label class="field"><span>格式</span><select name="exportFormat"><option value="csv">CSV 表格</option><option value="json">JSON 数据</option></select></label>
          <button class="button" type="submit">导出明细</button>
        </form>
      </div>
      <div class="settings-group danger-zone">
        <h3>本地数据</h3>
        <button class="button danger" type="button" data-action="clear-data">清空本地数据</button>
      </div>
    </section>
  `;
}
