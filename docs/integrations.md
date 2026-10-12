<h1 align="center">pi-ui-plus</h1>

<p align="center">
  <b>简体中文</b> · <a href="../README_en.md">English</a> · <a href="../README.md">返回 README</a>
</p>

# 界面本地化与完成通知

## 界面本地化

同一个入口还本地化 Pi 已知的原生显示文本：

- `/hotkeys` 的快捷键分组、功能描述和 fullscreen 导航说明。
- `/settings` 的设置名称、说明、选项菜单和操作提示。
- 原生启动帮助、常见选择器文案、工作状态、压缩状态和分支总结提示。
- 斜杠命令自动补全的已知描述，包括参数提示。补全值、命令参数和补全操作保持 Pi 原样。

本地化边界是刻意保守的。以下内容不翻译：用户消息、模型回复、工具名称、路径、命令、代码、原始工具输出、未知扩展作者文案和模型上下文。无法确认的 Pi 文案继续显示英文，避免误改功能数据。

`/settings` 不增加语言设置项。语言切换只有 `/fold` 面板中的 `l` 键和 `设置` 页签。因此，Pi 原生设置菜单的项目数量、设置 key 和回调值保持不变。

### 语言优先级

语言按以下优先级确定：

1. 保存的偏好：`~/.pi/agent/ui-language.json`。
2. 环境变量 `PI_UI_LANG`。
3. 系统 locale：依次读取 `LC_ALL`、`LC_MESSAGES`、`LANG`，然后使用 Node 的系统语言。
4. 中文区域使用 `zh`。其余区域使用 `en`。

```bash
PI_UI_LANG=zh pi -e /path/to/pi-ui-plus
PI_UI_LANG=en pi -e /path/to/pi-ui-plus
```

`PI_UI_LANG=auto` 表示按系统 locale 自动选择。在 `/fold` 的任一页签按 `l` 可切换中文和 English，切换后保持当前页签、选中项和所有展开状态。保存的偏好优先于环境变量，是全局设置，不写入会话记录、不发送给模型；保存失败只显示错误通知，当前界面语言不变。

### 词条维护

界面文案集中在 `pi-ui-plus/translations.ts`。`messages` 提供 `en` 和 `zh` 两个表，键必须一致；`phrases` 是精确匹配的原生短语白名单，另有一组正则处理带变量的句子。新增词条时：

- 只加入能确认是原生界面文案的短语。
- 不要加入用户可见的通用词（如 `model`、`off`、`read`），避免误译路径和名称。
- 保留参数提示和扩展来源标签，不翻译补全值。

## 完成通知

`pi-agent-notify.ts` 在 Agent 完成整轮自动工作后发送通知。事件为 `agent_settled`。本扩展不在单次模型响应、自动重试或上下文压缩中途重复通知。

通知正文取最近一次用户输入。扩展先清理 Markdown，再截取到最多 56 个字符。没有可用输入时使用固定文本。

### 通知后端

| 平台 | 后端 |
| --- | --- |
| Windows | Windows Toast |
| WSL | Windows Toast，通过 `powershell.exe` 调用 |
| Linux 桌面 | `notify-send` |
| macOS | `osascript` |

Windows Toast 的脚本资源位于 `assets/pi-toast.ps1`。WSL 中运行时通过 `wslpath` 转换路径。本扩展不依赖固定用户名，也不依赖 `C:\Users\Public`。

### 开关与环境变量

默认只在 TUI 模式发送通知。`/fold` 的 `设置` 页签可以修改通知开关和声音，写入 `~/.pi/agent/pi-ui-plus.json`。环境变量优先级更高。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PI_AGENT_NOTIFY` | `auto` | `auto` 只在 TUI 模式发送通知。`on` 在所有模式发送通知。`off` 关闭通知。设置后覆盖浮窗设置 |
| `PI_AGENT_NOTIFY_SOUND` | `on` | `off` 关闭通知声音。设置后覆盖浮窗设置 |
| `PI_AGENT_NOTIFY_TITLE` | `Pi` | 通知标题 |
| `PI_AGENT_NOTIFY_MESSAGE` | 最近一次用户输入 | 覆盖通知正文 |
| `PI_AGENT_NOTIFY_APP_ID` | Windows Terminal 的 AppID | Windows Toast 使用的 AppID |

示例：

```bash
PI_AGENT_NOTIFY=on pi -e /path/to/pi-ui-plus
PI_AGENT_NOTIFY_SOUND=off pi -e /path/to/pi-ui-plus
PI_AGENT_NOTIFY_TITLE='代码助手' pi -e /path/to/pi-ui-plus
PI_AGENT_NOTIFY_MESSAGE='任务已完成' pi -e /path/to/pi-ui-plus
```

通知进程失败不改变 Agent 的执行结果。
