# 远征死亡邮件提醒配置

以下汇总设置适用于 ro.hans幸存者助手 v1.14.1 或更新版本。在游戏面板打开“远征死亡邮件提醒（EmailJS）”。

1. 登录自己的 EmailJS 账号，在 Email Services 连接用于发信的邮箱服务，并先用 EmailJS 的测试功能确认可发信。参见 [连接发信服务](https://www.emailjs.com/docs/user-guide/connecting-email-services/)。
2. 新建 Email Template：To Email 填 `{{to_email}}`，Subject 填 `{{title}}`，正文放 `{{message}}`。也可切到 HTML 编辑，粘贴本包 `EmailJS邮件模板.html`（仓库中为 `docs/emailjs-template.html`）的内容。From Email 使用已连接服务的默认地址；Reply-To 可留空。模板变量支持这些动态字段，参见 [模板设置](https://www.emailjs.com/docs/user-guide/creating-email-templates/)。
3. 取得该服务的 Service ID、模板的 Template ID，以及 Account 页的 Public Key。游戏面板只需要 Public Key，不需要 SMTP 密码或 Private Key。参见 [Public Key 获取位置](https://www.emailjs.com/docs/sdk/installation/)。若你的账号已设置来源限制，需要允许游戏域名 `https://ro.hans-webgametw.com`。
4. 在游戏面板填写上面三个参数与收件邮箱，点击“保存通知设置”，再点击“发送测试邮件”。该按钮会向所填邮箱发送一封真实的测试邮件，标题明确标为测试。
5. 确认收到测试邮件后，勾选“啟用單人遠征死亡郵件”。无须启动自动选牌／自动远征，也可以单独使用提醒。

邮件正文包含职业、副本、周目、局内存活时间、等级、击杀数和发生时间，不包含游戏登录信息。每局单人远征的死亡只记录一次。通关、定时退图、组队、剧情、PVP、爬塔和录像不计入。

“合併通知間隔”默认 30 分钟，从首笔死亡开始计时，到期寄一封摘要。摘要保留总次数和最近 40 条明细。保持分页面开启，刷新同一页可继续累计。填 0 恢复逐封即时发送。原来的模板继续用 `{{title}}` 和 `{{message}}` 即可。

脚本直接调用 [EmailJS REST /send](https://www.emailjs.com/docs/rest-api/send/)，不需要安装额外 SDK 或部署转发服务器。请求串行发送，至少间隔 1.1 秒；EmailJS 接口的限制为每秒一次。只有 API 接受后才显示“EmailJS 已接受”，这不等于已进入收件箱，仍需检查实际收件与服务后台记录。

失败、限额或网络超时时会在面板提示，继续游戏原有自动流程，不自动重发同一局。超时可能已经被服务接受，因此不会盲目补发；可以在检查设置后手动发送测试邮件验证通道。取消提醒停止新的死亡通知，已发出的请求无法撤回。

收件邮箱和 EmailJS 参数保存在当前浏览器的独立设置中，不随职业切换，也不放入通用配置导出、诊断和 GitHub 发布文件。换浏览器／设备需重新填写，可用“清空通知设置”删除。仅网页仍在运行时能检测死亡；网页关闭、浏览器冻结或电脑休眠时无法持续检测。

本版本已通过模拟接口及自动回归测试；发布时没有你的 EmailJS 参数，因此尚未进行真实收件箱投递验证。请完成上述测试邮件步骤后使用。
