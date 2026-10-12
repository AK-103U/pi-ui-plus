# AGENTS.md

本文件面向在本仓库工作的编码代理。人类贡献者也可参考。

## 项目概览

`pi-ui-plus` 是一个 Pi（`@earendil-works/pi-coding-agent`）扩展包，提供三项功能：折叠工具调用与旧回复、本地化 Pi 原生界面、Agent 完成整轮工作后发送系统通知。

- 纯 TypeScript，无运行时依赖，不编译，不执行 `npm install`。
- 面向 Pi 1.1.0 开发，Node.js 22.19.0+。
- 折叠和界面本地化只在 TUI 模式生效。

## 仓库结构

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

## 常用命令

```bash
# 单元测试和扩展加载测试（需要 pi 和 node 在 PATH 中）
node --test test/pi-ui-plus-fold.test.mjs test/pi-ui-plus.test.mjs test/pi-agent-notify.test.mjs

# PTY 烟雾测试（需要 POSIX 系统）
python3 test/pi-ui-plus-smoke.py
```

测试通过 `test/host.mjs` 的 `findHostRoot()` 定位已安装的 Pi，兼容 POSIX 和 Windows 的 pnpm 布局。


## 设计约束

- **不改动数据**：原始消息、工具参数、工具结果和模型上下文必须完整保留。扩展只影响显示。
- **可恢复**：接管原生方法时保存属性描述符，`dispose` 时按描述符还原。重载或卸载必须恢复原生渲染。
- **保守本地化**：只翻译精确匹配的原生短语。用户消息、模型回复、工具名、路径、命令、代码、原始输出和模型上下文一律不翻译。无法确认的文案保持英文。
- **不干扰 Pi 原生设置**：`/settings` 不增加语言项，项目数量、key 和回调值保持不变。
- **环境变量优先**：`PI_AGENT_NOTIFY*`、`PI_UI_LANG` 等环境变量优先于 `~/.pi/agent/pi-ui-plus.json` 和 `ui-language.json`。
- **无副作用**：无计时器、无后台进程、无额外依赖，不修改 Pi 安装目录。
- **非 TUI 不启用**：print、JSON、RPC 模式不启用折叠和原生 UI 适配。

## 代码约定

- 使用 Tab 缩进。
- 模块使用 ESM，导入本地模块时带 `.js` 扩展名（如 `./fold.js`）。
- 界面文案集中在 `pi-ui-plus/translations.ts`，同时提供 `en` 和 `zh`；两个语言表的键必须一致。
- 折叠面板的列表项不显示 `[展开]` / `[收起]` 动作标签，用行首 `▶` / `▼` 和整行选中表达状态。
- 修改公共行为时同步更新 `README.md`、`README_en.md` 和 `docs/` 下对应文档。

## 提交约定

沿用仓库历史的英文 Conventional Commits，无 scope，标题使用祈使语气小写开头：

```text
feat: add fold settings panel and batch reply expansion
fix: keep the current reply visible while streaming
docs: split detailed guides into docs
test: cover batch reply expansion
chore: ship the English README in the npm tarball
```

同一目的的实现、测试和文档放在一个提交里。不虚构问题原因、Issue 编号或测试结果。

## 文档地图

- `README.md` / `README_en.md`：精简入口，只放最常用信息。
- `docs/integrations.md`：原生界面本地化范围与边界，完成通知的后端与环境变量。
- `docs/development.md`：实现说明、项目结构与测试。
