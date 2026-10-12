<h1 align="center">pi-ui-plus</h1>

<p align="center">
  <a href="./README.md">简体中文</a> · <b>English</b>
</p>

A Pi extension package with three jobs:

- **Folding**: collapse tool calls and previous replies to one line.
- **Localization**: translate the native Pi interface into Chinese.
- **Notification**: send a system notification after the agent settles.

No extra dependencies, no compilation, and no changes to the Pi installation directory.

## Install

```bash
pi install npm:@ak-103u/pi-ui-plus              # from npm
pi install git:github.com/AK-103U/pi-ui-plus    # from Git
pi install /path/to/pi-ui-plus                  # from a local directory
```

Run `/reload` or restart Pi after installing. Try it once without writing settings:

```bash
pi -e npm:@ak-103u/pi-ui-plus
```

Update or remove:

```bash
pi update npm:@ak-103u/pi-ui-plus
pi remove npm:@ak-103u/pi-ui-plus
```

The package declares two extensions in `pi.extensions` (folding plus localization, and settle notification). `pi config` enables only one of them.

## Folding

A tool call shows one summary line (tool name, path/command, state). Previous replies fold automatically when the next turn starts, and the current reply always shows in full. A failed tool keeps one error preview line.

```text
┌─ current turn ────────────────────────────┐
│ You: Check this problem and fix it.       │
│ Assistant: I will check the files first.  │
│ ─ ▶ #1 read · src/main.ts · Done          │
│ ─ ▶ #2 bash · run tests · Done            │
│ Assistant: Done. The details follow ...   │
└───────────────────────────────────────────┘

            after the next message

┌─ next turn ───────────────────────────────┐
│ You: Check this problem and fix it.       │
│ ─ ▶ #1 read · src/main.ts · Done          │
│ ─ ▶ #3 Previous reply · Done              │
│ You: Add one more option.                 │
│ Assistant: The option is added ...        │
└───────────────────────────────────────────┘
```

| Control | Effect |
| --- | --- |
| `/fold` | Open the overlay. A `Settings` / `Chats` tab bar, `Tab` switches |
| `Alt+O` | Toggle the latest block |
| `Alt+Shift+O` | Expand the most recent replies; collapse them once all are open |
| `/fold recent [n\|off]` | Expand the most recent n replies, `off` collapses all |
| `/fold off` / `on` | Turn folding off / on |
| `Ctrl+O` | Native Pi tool expansion, kept in sync with summaries |

The first level of `/fold` groups by chat, titled with a user message snippet plus the tool count. The second level lists the final reply and each tool, with the final reply first.

## Settings

The `Settings` tab of `/fold` uses `↑↓` to select and `←→` / `Enter` to change. It writes `~/.pi/agent/pi-ui-plus.json`:

| Setting | Values |
| --- | --- |
| Previous replies | Fold / Keep expanded |
| Batch expand | 1-5 |
| Notifications | Auto (TUI) / On / Off |
| Notification sound | On / Off |
| Interface language | English / 简体中文 |

## Language

Priority: `~/.pi/agent/ui-language.json` > `PI_UI_LANG` > system locale.

```bash
PI_UI_LANG=en pi -e /path/to/pi-ui-plus
```

Press `l` on any `/fold` tab to switch between Chinese and English.

## Notification

A notification is sent after the agent settles (Windows Toast / `notify-send` / `osascript`). It sends in TUI mode only by default.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PI_AGENT_NOTIFY` | `auto` | `auto` / `on` / `off` |
| `PI_AGENT_NOTIFY_SOUND` | `on` | `off` disables sound |
| `PI_AGENT_NOTIFY_TITLE` | `Pi` | Notification title |
| `PI_AGENT_NOTIFY_MESSAGE` | latest input | Overrides the body |

Environment variables have priority over the settings file.

## Detailed docs

- [Localization and notification](./docs/integrations.md)
- [Development: implementation, layout, and tests](./docs/development.md)

## Requirements

- Pi `@earendil-works/pi-coding-agent` 1.1.0+
- Node.js 22.19.0+
- Folding and localization work in TUI mode only

## License

MIT
