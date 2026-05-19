# 当前进度

更新时间：2026-05-19

## 当前版本

- 应用名称：吃了么
- 当前分支：`feature/nutrition-profiles`
- 本轮实现提交：`12bc98c`、`392a9c4`、`9f7714b`、`3deca08`、`93f0011`
- 文档收尾提交：`docs: update nutrition profiles status`
- 本地目录：`/Users/sen/projects/chileme/.worktrees/nutrition-profiles`
- 本地预览：运行 `npm run serve` 后打开 `http://127.0.0.1:4173/`

## 已完成

- 本地优先 iPhone PWA：记录食物、零食、饮水，并在浏览器本地保存。
- 食物营养统一按每 `100g` 录入；支持 `kcal` 输入，也支持用 `kJ` 自动换算为 `kcal`。
- 营养计算和今日结构已包含膳食纤维；导出明细继续保留钠字段。
- 支持本地档案/阶段：食物库和分类共享，记录、饮水、个人资料和每日目标按档案隔离。
- 设置页支持档案新增、切换、重命名、删除，以及个人资料和目标编辑。
- 识别接口与类型已预留；当前版本不上传照片、不调用识别服务。
- 视图已拆分为 today、foods、stats、settings，并抽出格式化、图片和识别辅助模块。
- Service worker 已缓存拆分后的静态模块。

## 本轮验证

- `npm test`：81/81 通过
- `TZ=America/Los_Angeles npm test`：81/81 通过
- `node --check src/app.js`：通过
- `node --check src/domain.js`：通过
- `node --check src/store.js`：通过
- `node --check src/ui/format.js`：通过
- `node --check src/ui/image.js`：通过
- `node --check src/recognition.js`：通过
- `node --check src/views/today.js`：通过
- `node --check src/views/foods.js`：通过
- `node --check src/views/stats.js`：通过
- `node --check src/views/settings.js`：通过
- `node --check sw.js`：通过
- `git diff --check`：通过
- 本地 HTTP smoke：`http://127.0.0.1:4173/`、`/src/app.js`、`/src/views/today.js`、`/src/ui/format.js`、`/manifest.webmanifest` 均返回 200；临时服务已停止
- 手动浏览器 smoke：未运行

## 使用提示

- 电脑和 iPhone 需要在同一个 Wi-Fi。
- 如果 `4173` 被占用，可改用相邻端口运行静态服务，并在手机地址中同步替换端口。
- 可以用 Safari 分享菜单里的“添加到主屏幕”安装成主屏幕应用。
- 营养数值是粗略估算，不是医疗建议。

## 下一轮候选

1. 实际选择一个 HTTPS 托管平台并发布，得到 iPhone 可访问公网地址。
2. 接入真实 LLM 拍照识别服务，并补齐上传、隐私提示、错误处理和人工确认流程。
3. 常用食物默认列表可进一步缩短，让“最常吃”首屏更聚焦。
4. 导入流程可增加 CSV 恢复；当前完整备份 JSON 是备份恢复主路径，记录明细 JSON/CSV 只用于查看或外部分析。
