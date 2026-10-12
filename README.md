<h1 align="center">pi-ui-plus</h1>

<p align="center">
  <b>简体中文</b> · <a href="./README_en.md">English</a>
</p>

Pi 扩展包，提供三项功能：

- **折叠**：工具调用和旧回复收成一行。
- **本地化**：把 Pi 原生界面翻译成中文。
- **通知**：Agent 完成整轮工作后发系统通知。

无额外依赖，不编译，不修改 Pi 安装目录。

## 安装

```bash
pi install npm:@ak-103u/pi-ui-plus              # 从 npm
pi install git:github.com/AK-103U/pi-ui-plus    # 从 Git
pi install /path/to/pi-ui-plus                  # 从本地目录
```

安装后执行 `/reload` 或重启 Pi。试用一次（不写入设置）：

```bash
pi -e npm:@ak-103u/pi-ui-plus
```

更新或卸载：

```bash
pi update npm:@ak-103u/pi-ui-plus
pi remove npm:@ak-103u/pi-ui-plus
```

本包在 `package.json` 的 `pi.extensions` 中声明两个扩展（折叠与本地化、完成通知），`pi config` 可只启用其中一个。

## 折叠

工具调用显示为一行摘要（工具名、路径/命令、状态）。旧回复在下一轮开始时自动收起，当前回复始终完整显示。失败的工具保留一行错误预览。

```text
┌─ 最新一轮 ────────────────────────────────┐
│ 你：检查并修复这个问题                    │
│ 助手：先检查相关文件。                    │
│ ─ ▶ #1 read · src/main.ts · 完成          │
│ ─ ▶ #2 bash · 执行测试 · 完成             │
│ 助手：已完成，下面是详细说明……           │
└───────────────────────────────────────────┘

            提交下一条消息后

┌─ 开始下一轮 ──────────────────────────────┐
│ 你：检查并修复这个问题                    │
│ ─ ▶ #1 read · src/main.ts · 完成          │
│ ─ ▶ #3 上一轮回复 · 已完成                │
│ 你：再加一个配置项                        │
│ 助手：配置项已添加……                     │
└───────────────────────────────────────────┘
```

| 操作 | 效果 |
| --- | --- |
| `/fold` | 打开浮窗。顶部 `设置` / `对话` 两个页签，`Tab` 切换 |
| `Alt+O` | 切换最近一块 |
| `Alt+Shift+O` | 批量展开最近几条旧回复；都展开后收起 |
| `/fold recent [n\|off]` | 展开最近 n 条，`off` 收起全部 |
| `/fold off` / `on` | 关闭 / 恢复折叠 |
| `Ctrl+O` | Pi 原生工具展开开关，与摘要同步 |

`/fold` 第一层按对话分组，标题是用户消息片段 + 工具次数；第二层列出最终回复和各工具，最终回复排最前。

## 设置

`/fold` 的 `设置` 页签用 `↑↓` 选择、`←→` / `Enter` 修改，写入 `~/.pi/agent/pi-ui-plus.json`：

| 设置项 | 取值 |
| --- | --- |
| 上一轮回复 | 折叠 / 保持展开 |
| 批量展开条数 | 1–5 |
| 完成通知 | 自动（仅 TUI）/ 开启 / 关闭 |
| 通知声音 | 开启 / 关闭 |
| 界面语言 | 简体中文 / English |

## 语言

优先级：`~/.pi/agent/ui-language.json` > `PI_UI_LANG` > 系统 locale。

```bash
PI_UI_LANG=zh pi -e /path/to/pi-ui-plus
```

在 `/fold` 任一页签按 `l` 切换中英文。

## 通知

Agent 整轮结束后发通知（Windows Toast / `notify-send` / `osascript`）。默认只在 TUI 模式发。

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PI_AGENT_NOTIFY` | `auto` | `auto` / `on` / `off` |
| `PI_AGENT_NOTIFY_SOUND` | `on` | `off` 关闭声音 |
| `PI_AGENT_NOTIFY_TITLE` | `Pi` | 通知标题 |
| `PI_AGENT_NOTIFY_MESSAGE` | 最近输入 | 覆盖正文 |

环境变量优先于设置文件。

## 详细文档

- [界面本地化与完成通知](./docs/integrations.md)
- [开发：实现说明、结构与测试](./docs/development.md)

## 环境要求

- Pi `@earendil-works/pi-coding-agent` 1.1.0+
- Node.js 22.19.0+
- 折叠和本地化只在 TUI 模式生效

## 许可证

MIT
