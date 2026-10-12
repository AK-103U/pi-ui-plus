<h1 align="center">pi-ui-plus</h1>

<p align="center">
  <b>简体中文</b> · <a href="../README_en.md">English</a> · <a href="../README.md">返回 README</a>
</p>

# 开发：实现说明、结构与测试

## 实现说明

原始消息、工具参数、工具结果和模型上下文完整保留。工具执行行为不受影响。

工具渲染器在收起时只生成摘要。它跳过原始渲染器对大段参数和输出的格式化与代码高亮。展开后委托 Pi 的原始渲染器。

旧回复折叠适配 Pi 的内部消息容器。无法识别混合消息的内部布局时，该消息原样显示。

重载或卸载会恢复接管的原生方法和组件文案，并清除插件缓存。工具展开状态仍由 Pi 管理。

悬浮面板复用 `ctx.ui.custom({ overlay: true })` 和 Pi 的选择组件。本包没有计时器，也没有后台进程。设置写入 `~/.pi/agent/pi-ui-plus.json`，与语言偏好一样使用临时文件加 `rename` 的原子写。

非交互模式（print、JSON、RPC）不启用 TUI 折叠，也不启用原生 UI 适配。regular 和 fullscreen 模式均支持。

本包面向 `@earendil-works/pi-coding-agent` 1.1.0 开发和测试。Pi 升级后，若内部组件结构变化，扩展会尽量保留原始显示。无法适配的区域继续显示英文，不影响会话功能。

## 项目结构

```text
pi-ui-plus/
├── package.json          # npm 清单和 pi 清单
├── pi-ui-plus/
│   ├── index.ts          # 折叠和本地化的入口
│   ├── fold.ts           # 折叠逻辑和悬浮面板
│   ├── settings.ts       # 共享设置存储
│   ├── native-ui.ts      # 原生组件适配
│   ├── translations.ts   # 词条和短语表
│   ├── language.ts       # 语言检测和偏好存储
│   └── autocomplete.ts   # 斜杠命令补全本地化
├── pi-agent-notify.ts    # 完成通知扩展
├── assets/pi-toast.ps1   # Windows Toast 脚本
├── docs/                 # 详细文档
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

测试通过 `test/host.mjs` 的 `findHostRoot()` 定位已安装的 Pi，兼容 POSIX 和 Windows 的 pnpm 布局。

测试覆盖以下内容：

- 工具折叠和旧回复折叠。
- 当前回复保持完整。
- 思考块独立。
- 原文保留。
- 悬浮面板导航、`设置` / `对话` 页签和设置循环。
- `Alt+Shift+O` 和 `/fold recent` 批量展开与收起。
- 上一轮回复折叠开关。
- 通知设置共享与回退。
- 鼠标和终端尺寸适配。
- 语言切换、locale 优先级和全局语言持久化。
- 原生 `/hotkeys` 和 `/settings` 适配。
- 斜杠命令补全。
- 重载和卸载恢复。
- 非 TUI 模式。
