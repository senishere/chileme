# 当前进度

更新时间：2026-05-18

## 当前版本

- 应用名称：吃了么
- 分支：`main`
- 最新提交：`b78ef20 feat: add liquid foods and seed library`
- 本地目录：`/Users/sen/projects/chileme`
- 手机测试地址：`http://192.168.0.104:4173/`

## 已完成

- iPhone 可用的本地优先 PWA。
- 首页合并版交互：快捷添加左右滚动，时间线上下滚动。
- 支持任意时间记录食物、零食、饮水。
- 支持照片附件；照片只用于回忆，不参与识别、估重或营养计算。
- 支持 `g` 和 `ml` 份量。
- 支持 `per100g`、`per100ml`、`perServing`、`perPackage` 营养标注。
- 支持液体密度 `densityGPerMl`，用于把 ml 粗略换算为重量。
- 营养汇总包含热量、蛋白质、碳水、脂肪、钠和饮水。
- 内置常见主食、蛋白质、饮品、零食、包装/高钠食品、轻食和中式餐食。
- 旧数据升级时会补齐钠、单位和缺失的内置食物；用户已有同 id 食物不会被覆盖。

## 本轮验证

- `npm test`：32/32 通过
- `TZ=America/Los_Angeles npm test`：32/32 通过
- `node --check src/app.js`
- `node --check src/domain.js`
- `node --check src/store.js`
- `git diff --check`
- 本地 HTTP smoke：`index.html`、`src/app.js`、`manifest.webmanifest`
- Chrome headless 渲染首页，确认内置食物库出现在 DOM 中。
- 390x844 移动端截图检查首页布局。

## 使用提示

- 电脑和 iPhone 需要在同一个 Wi-Fi。
- 在 iPhone Safari 打开 `http://192.168.0.104:4173/`。
- 如果看到旧页面，刷新或关闭后重新打开。
- 可以用 Safari 分享菜单里的“添加到主屏幕”安装成主屏幕应用。
- 营养数值是粗略估算，不是医疗建议。

## 下一轮可改进方向

- 根据实际使用反馈调整快捷添加顺序、分类和常见食物名单。
- 给食物库增加搜索、分类筛选或常用置顶。
- 优化新增包装食品时“每份/整包/每100g/每100ml”的表单提示。
- 增加编辑已有食物和份量的入口。
- 增加目标摄入量、钠提醒或一周趋势图。
