# pi-ui-plus

Pi 扩展包。本包提供三项功能：

- 折叠工具调用和旧回复。
- 本地化 Pi 原生界面。
- Agent 完成整轮工作后发送系统通知。

本包不引入额外依赖。运行时不执行 `npm install`，不执行编译，也不修改 Pi 的安装目录。

## 环境要求

- Pi：`@earendil-works/pi-coding-agent` 1.1.0 或更高版本。
- Node.js 22.19.0 或更高版本。
- 折叠和界面本地化只在 TUI 模式生效。

## 安装

从 npm 安装：

```bash
pi install npm:@ak-103u/pi-ui-plus
```

从 Git 安装：

```bash
pi install git:github.com/AK-103U/pi-ui-plus
```

从本地目录安装。路径指向本包根目录：

```bash
pi install /path/to/pi-ui-plus
```

安装后执行 `/reload`，或重新启动 Pi。

试用一次，不写入设置：

```bash
pi -e npm:@ak-103u/pi-ui-plus
```

更新或卸载：

```bash
pi update npm:@ak-103u/pi-ui-plus
pi remove npm:@ak-103u/pi-ui-plus
```

本包在 `package.json` 的 `pi.extensions` 中声明两个扩展：

- `pi-ui-plus/index.ts`：折叠和界面本地化。
- `pi-agent-notify.ts`：完成通知。

执行 `pi config` 可以只启用其中一个扩展。

## 折叠功能

工具调用默认显示为一行摘要。摘要包含工具名、路径或命令、运行状态和失败提示。大段参数、写入的代码、差异和输出默认收起。展开后显示完整内容。工具名使用当前主题的强调色并加粗。

助手的过程说明原样显示。当前轮的最终回复始终完整显示。

提交下一条用户消息后，上一轮的最终回复自动收成一行。已收起的旧回复保持收起。手动展开的状态保留。本规则由对话轮次触发，不依赖回复长度。

工具失败时，摘要下保留一行错误预览。运行中的工具显示“运行中”。错误、中断、长度截断和尚未结束的回复保持完整显示。

```text
┌─ 最新一轮 ────────────────────────────────────────┐
│ 你：检查并修复这个问题                             │
│                                                   │
│ 助手：先检查相关文件。                            │
│ ─ ▶ #1 read · src/main.ts · 完成 [展开]           │
│ ─ ▶ #2 bash · 执行测试 · 完成 [展开]              │
│                                                   │
│ 助手：已完成，下面是详细说明。                    │
│ 修改说明、完整示例……即使很长，也完整显示……      │
└───────────────────────────────────────────────────┘

                提交下一条用户消息后

┌─ 开始下一轮 ──────────────────────────────────────┐
│ 你：检查并修复这个问题                             │
│                                                   │
│ ─ ▶ #1 read · src/main.ts · 完成 [展开]           │
│ ─ ▶ #2 bash · 执行测试 · 完成 [展开]              │
│ ─ ▶ #3 上一轮回复 · 已完成 [展开]                 │
│                                                   │
│ 你：再加一个配置项                                 │
│ ─ ▶ #4 edit · config.ts · 完成 [展开]             │
│                                                   │
│ 助手：配置项已添加，完整使用方法如下……            │
└───────────────────────────────────────────────────┘
```

### 操作

| 操作 | 效果 |
| --- | --- |
| `/fold` | 打开悬浮面板。先选择轮次，再管理本轮的工具和旧回复 |
| `Alt+O` 或 `/fold latest` | 切换最近一块工具调用或旧回复 |
| `/fold collapse` | 收起当前可管理的工具调用和旧回复 |
| `/fold expand` | 展开当前可管理的工具调用和旧回复 |
| `/fold off` | 恢复 Pi 原生渲染。界面语言保持不变 |
| `/fold on` | 重新开启折叠 |
| 点击折叠标题 | 在 fullscreen 模式下切换这一块 |
| `Ctrl+O` | 使用 Pi 原生工具展开开关。工具摘要与其同步 |

`/fold` 使用 Pi 原生悬浮界面。背景聊天仍然可见。轮次按最新在前排序。每轮显示工具数量和整体展开状态。

```text
┌─ /fold · 选择轮次 ─────────────────────────────┐
│ → 第 3 轮 · 当前 · 4 个工具 · 全部收起        │
│   第 2 轮 · 3 个工具 · 部分展开               │
│   第 1 轮 · 2 个工具 · 全部展开               │
├───────────────────────────────────────────────┤
│ ↑↓ 选择 · l English · Enter 进入 · Esc 关闭    │
└───────────────────────────────────────────────┘

┌─ 第 2 轮 · 工具调用 ──────────────────────────┐
│ → ▶ read · 8 ms · main.ts · 完成 [展开]       │
│   ▼ edit · 21 ms · main.ts · 完成 [收起]      │
│   ▶ bash · 1240 ms · 测试 · 完成 [展开]       │
│   ▶ 本轮最终回复 · 已完成 [展开]              │
│   ← 返回轮次列表                              │
├───────────────────────────────────────────────┤
│ ↑↓ 选择 · l English · Enter 切换 · Esc 返回    │
└───────────────────────────────────────────────┘
```

选择工具或旧回复会切换聊天区中的展开状态。浮窗保持打开。第二层只列出单个工具、可折叠的旧回复和返回项。当前回复没有折叠选项。没有工具的轮次显示“本轮暂无工具”。整体状态只统计工具。

思考块由 Pi 的 `Ctrl+T` 和原生鼠标交互控制。本包不修改思考块。

### 语言选择

语言按以下优先级确定：

1. 保存的偏好：`~/.pi/agent/ui-language.json`。
2. 环境变量 `PI_UI_LANG`。
3. 系统 locale：依次读取 `LC_ALL`、`LC_MESSAGES`、`LANG`，然后使用 Node 的系统语言。
4. 中文区域使用 `zh`。其余区域使用 `en`。

可用环境变量指定默认语言：

```bash
PI_UI_LANG=zh pi -e /path/to/pi-ui-plus
PI_UI_LANG=en pi -e /path/to/pi-ui-plus
```

`PI_UI_LANG=auto` 表示按系统 locale 自动选择。

在任一 `/fold` 面板层级按 `l` 可切换中文和 English。切换后保持当前层级、选中项和所有展开状态。语言提示显示切换后的目标语言：

- 中文界面：`l English`
- 英文界面：`l 简体中文`

保存的偏好优先于环境变量。偏好是全局设置。偏好不写入会话记录，也不发送给模型。保存失败只显示错误通知，当前界面语言不变。

## Pi 原生界面本地化

同一个入口还本地化 Pi 已知的原生显示文本：

- `/hotkeys` 的快捷键分组、功能描述和 fullscreen 导航说明。
- `/settings` 的设置名称、说明、选项菜单和操作提示。
- 原生启动帮助、常见选择器文案、工作状态、压缩状态和分支总结提示。
- 斜杠命令自动补全的已知描述，包括参数提示。补全值、命令参数和补全操作保持 Pi 原样。

本地化边界是刻意保守的。以下内容不翻译：用户消息、模型回复、工具名称、路径、命令、代码、原始工具输出、未知扩展作者文案和模型上下文。无法确认的 Pi 文案继续显示英文，避免误改功能数据。

`/settings` 不增加语言设置项。语言切换只有 `/fold` 面板中的 `l`。因此，Pi 原生设置菜单的项目数量、设置 key 和回调值保持不变。

## Agent 完成通知

`pi-agent-notify.ts` 在 Agent 完成整轮自动工作后发送通知。事件为 `agent_settled`。本扩展不在单次模型响应、自动重试或上下文压缩中途重复通知。

通知正文取最近一次用户输入。扩展先清理 Markdown，再截取到最多 56 个字符。没有可用输入时使用固定文本。

通知后端：

| 平台 | 后端 |
| --- | --- |
| Windows | Windows Toast |
| WSL | Windows Toast，通过 `powershell.exe` 调用 |
| Linux 桌面 | `notify-send` |
| macOS | `osascript` |

Windows Toast 的脚本资源位于 `assets/pi-toast.ps1`。WSL 中运行时通过 `wslpath` 转换路径。本扩展不依赖固定用户名，也不依赖 `C:\Users\Public`。

默认只在 TUI 模式发送通知。可用环境变量调整：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PI_AGENT_NOTIFY` | `auto` | `auto` 只在 TUI 模式发送通知。`on` 在所有模式发送通知。`off` 关闭通知 |
| `PI_AGENT_NOTIFY_SOUND` | `on` | `off` 关闭通知声音 |
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

## 实现说明

原始消息、工具参数、工具结果和模型上下文完整保留。工具执行行为不受影响。

工具渲染器在收起时只生成摘要。它跳过原始渲染器对大段参数和输出的格式化与代码高亮。展开后委托 Pi 的原始渲染器。

旧回复折叠适配 Pi 的内部消息容器。无法识别混合消息的内部布局时，该消息原样显示。

重载或卸载会恢复接管的原生方法和组件文案，并清除插件缓存。工具展开状态仍由 Pi 管理。

悬浮面板复用 `ctx.ui.custom({ overlay: true })` 和 Pi 的选择组件。本包没有计时器，也没有后台进程。

非交互模式（print、JSON、RPC）不启用 TUI 折叠，也不启用原生 UI 适配。regular 和 fullscreen 模式均支持。

本包面向 `@earendil-works/pi-coding-agent` 1.1.0 开发和测试。Pi 升级后，若内部组件结构变化，扩展会尽量保留原始显示。无法适配的区域继续显示英文，不影响会话功能。

## 项目结构

```text
pi-ui-plus/
├── package.json          # npm 清单和 pi 清单
├── pi-ui-plus/
│   ├── index.ts          # 折叠和本地化的入口
│   ├── fold.ts           # 折叠逻辑和悬浮面板
│   ├── native-ui.ts      # 原生组件适配
│   ├── translations.ts   # 词条和短语表
│   ├── language.ts       # 语言检测和偏好存储
│   └── autocomplete.ts   # 斜杠命令补全本地化
├── pi-agent-notify.ts    # 完成通知扩展
├── assets/pi-toast.ps1   # Windows Toast 脚本
└── test/                 # 单元测试和 PTY 烟雾测试
```

## 测试

运行单元测试和扩展加载测试。命令要求 `pi` 和 `node` 在 PATH 中：

```bash
node --test test/pi-ui-plus-fold.test.mjs test/pi-ui-plus.test.mjs test/pi-agent-notify.test.mjs
```

运行普通终端和 fullscreen 的 PTY 烟雾测试。此测试需要 POSIX 系统：

```bash
python3 test/pi-ui-plus-smoke.py
```

测试覆盖以下内容：

- 工具折叠和旧回复折叠。
- 当前回复保持完整。
- 思考块独立。
- 原文保留。
- 悬浮面板导航。
- 鼠标和终端尺寸适配。
- 语言切换、locale 优先级和全局语言持久化。
- 原生 `/hotkeys` 和 `/settings` 适配。
- 斜杠命令补全。
- 重载和卸载恢复。
- 非 TUI 模式。

## 许可证

MIT
