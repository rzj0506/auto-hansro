# ro.hans幸存者助手

基于用户提供的 **v1.3.0** 开发，当前版本 **v1.3.1**，适用于 <https://ro.hans-webgametw.com/>。

[安装／更新脚本](https://raw.githubusercontent.com/rzj0506/auto-hansro/userscript-release/ro-survivors-helper.user.js) · [更新元数据](https://raw.githubusercontent.com/rzj0506/auto-hansro/userscript-release/ro-survivors-helper.meta.js)

使用 Tampermonkey 安装后刷新游戏。首次使用保持暂停，按 F9 展开面板，按 F8 启动／暂停。安装改名后的脚本时，请停用原来的“RO 倖存者：三系法術與寶箱助手”，避免两个版本同时运行。

## 独立重抽开关

面板的“重抽設定”中有两个可独立保存的勾选项：

- **局內技能：允許重抽**：仅在没有符合技能配置的选项时重抽整组；取消勾选后，有合规牌照常选择，无合规牌等待手动选择。
- **寶箱：允許重抽**：控制宝箱单张和整组重抽；取消勾选后，按已有优先级和“重抽用盡／達上限後”设置选择现有卡片或等待手动选择。

两个开关默认开启，以延续 v1.3.0 行为。旧配置中的技能开关、宝箱策略（含“不重抽”）、重抽上限和保留次数继续生效。勾选宝箱重抽后，仍需策略允许且有剩余次数才会重抽；开关不保证一定重抽。每次修改立即保存，可导入／导出 JSON。使用同一游戏域名的原有浏览器配置和面板位置会保留。

保留 v1.3.0 的三系技能及 4／5 技配置、宝箱五栏优先级、放逐、避怪、拾取、重复远征、拖动面板和后台运行逻辑。后台运行仍受浏览器冻结／丢弃标签页和电脑休眠影响。

## 开发与发布

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm build
```

源码位于 `src/ro-survivors-helper.user.js`。版本更新时，同时递增 `@version`、`const VERSION` 和 `package.json` 的版本。推送 main 后，GitHub Actions 完成测试并将安装文件、元数据和 SHA-256 清单发布到 `userscript-release` 分支。安装路径固定，后续更新由 Tampermonkey 检查；运行中的游戏需刷新加载新版本。

测试覆盖四种重抽开关组合、真实脚本 DOM 点击、次数限制、宝箱优先级、设置保存和导入／导出、旧配置迁移以及发布元数据。测试使用模拟游戏接口，尚未进行真实账号实战验证。

## 基线记录

首次提交完整保留用户提供的 v1.3.0 文件。该原文件的 SHA-256 为 `031cb5502c8b79dadcfbfb1a191f250049225274d9b2587fba59b72883b9debf`。新仓库独立维护 ro.hans 站点版本。
