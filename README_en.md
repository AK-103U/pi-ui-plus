# pi-ui-plus

A Pi extension package. The package does three jobs:

- Fold tool calls and previous replies.
- Localize the native Pi interface.
- Send a system notification after the agent settles.

The package adds no runtime dependencies. It does not run `npm install`, does not compile, and does not change the Pi installation directory.

## Requirements

- Pi: `@earendil-works/pi-coding-agent` 1.1.0 or later.
- Node.js 22.19.0 or later.
- Folding and interface localization work in TUI mode only.

## Install

Install from npm:

```bash
pi install npm:@ak-103u/pi-ui-plus
```

Install from Git:

```bash
pi install git:github.com/AK-103U/pi-ui-plus
```

Install from a local directory. The path points to the package root:

```bash
pi install /path/to/pi-ui-plus
```

After the install, run `/reload`, or start Pi again.

Try the package once without writing to the settings file:

```bash
pi -e npm:@ak-103u/pi-ui-plus
```

Update or remove the package:

```bash
pi update npm:@ak-103u/pi-ui-plus
pi remove npm:@ak-103u/pi-ui-plus
```

The package declares two extensions in the `pi.extensions` field of `package.json`:

- `pi-ui-plus/index.ts`: folding and interface localization.
- `pi-agent-notify.ts`: settle notification.

Run `pi config` to enable only one of the two extensions.

## Folding

A tool call shows one summary line by default. The summary holds the tool name, the path or command, the run state, and the failure hint. Long arguments, written code, diffs, and output start folded. An expanded block shows the full content. The tool name uses the accent color of the current theme and is bold.

Assistant commentary shows as written. The final reply of the current turn always shows in full.

After you send the next user message, the final reply of the previous turn folds to one line. Folded replies stay folded. A manual expansion stays expanded. Turn boundaries trigger this rule. Reply length does not.

If a tool fails, one error preview line stays below the summary. A running tool shows "Running". Errors, aborts, length stops, and unfinished replies always show in full.

```text
┌─ current turn ────────────────────────────────────┐
│ You: Check this problem and fix it.               │
│                                                   │
│ Assistant: I will check the files first.          │
│ ─ ▶ #1 read · src/main.ts · Done                  │
│ ─ ▶ #2 bash · run tests · Done                    │
│                                                   │
│ Assistant: Done. The details follow.              │
│ Notes, full examples ... shown in full ...        │
└───────────────────────────────────────────────────┘

                 after the next user message

┌─ next turn ───────────────────────────────────────┐
│ You: Check this problem and fix it.               │
│                                                   │
│ ─ ▶ #1 read · src/main.ts · Done                  │
│ ─ ▶ #2 bash · run tests · Done                    │
│ ─ ▶ #3 Previous reply · Done                      │
│                                                   │
│ You: Add one more option.                         │
│ ─ ▶ #4 edit · config.ts · Done                    │
│                                                   │
│ Assistant: The option is added. Full usage: ...   │
└───────────────────────────────────────────────────┘
```

### Controls

| Control | Effect |
| --- | --- |
| `/fold` | Opens the floating panel with a `Settings` and a `Chats` tab |
| `Tab` | Switches between the `Settings` and `Chats` tabs |
| `Alt+O` or `/fold latest` | Toggles the latest tool call or previous reply |
| `Alt+Shift+O` | Expands the most recent replies; when all are expanded, folds the most recent ones |
| `/fold recent [n]` | Expands the most recent n replies. Without n, uses the configured count |
| `/fold recent off` | Folds every previous reply |
| `/fold collapse` | Folds the current foldable tool calls and previous replies |
| `/fold expand` | Expands the current foldable tool calls and previous replies |
| `/fold off` | Restores the native Pi rendering. The interface language does not change |
| `/fold on` | Turns folding on again |
| Click on a fold header | Toggles this block in fullscreen mode |
| `Ctrl+O` | Uses the native Pi tool expansion. Tool summaries follow it |

`/fold` uses the native Pi overlay. The background chat stays visible. The first level groups by chat. Its title is a snippet of the user message, followed by the tool count and the expansion state of that chat. The newest chat sorts first.

```text
┌─ /fold · Choose a chat ───────────────────────────────────────────┐
│  Settings   [Chats]                                               │
├───────────────────────────────────────────────────────────────────┤
│ → "Add one more option" · Current · 0 tools · No tools yet        │
│   "Check this problem and fix it" · 1 tool · All collapsed        │
│   "Compare Mermaid final and streaming rendering" · 2 tools ...   │
├───────────────────────────────────────────────────────────────────┤
│ ↑↓ Select · l 简体中文 · enter Enter · escape Close               │
└───────────────────────────────────────────────────────────────────┘
```

Entering a chat shows a second level with the final reply and each tool. The final reply sorts first, because it is the content you expand most often. A selection toggles the expansion state in the chat area. The panel stays open. The current reply has no fold option. A chat without tools shows "No tools in this turn".

```text
┌─ "Check this problem and fix it" · Tool calls ────────────────────┐
│  Settings   [Chats]                                               │
├───────────────────────────────────────────────────────────────────┤
│ → ▶ Final reply · "Fixed the null pointer and added ..."          │
│   ▶ read · src/auth.ts · Done · 8 ms                              │
│   ▶ edit · src/auth.ts · Done · 21 ms                             │
│   ← Back to chats                                                 │
├───────────────────────────────────────────────────────────────────┤
│ ↑↓ Select · l 简体中文 · enter Toggle · escape Back               │
└───────────────────────────────────────────────────────────────────┘
```

List items no longer show `[Expand]` / `[Collapse]` action labels. A leading `▶` / `▼` and the row selection carry the state instead.

### Settings tab

The `Settings` tab uses `↑↓` to select and `←→` or `Enter` to change. Settings are written to `~/.pi/agent/pi-ui-plus.json`, shared by the folding and notification extensions.

```text
┌─ /fold ───────────────────────────────────────────────────────────┐
│ [Settings]   Chats                                                │
├───────────────────────────────────────────────────────────────────┤
│ → Previous replies                                    ‹ Fold ›     │
│   Batch expand                              ‹ 3 replies ›         │
│   Notifications                          ‹ Auto (TUI) ›           │
│   Notification sound                                    ‹ On ›     │
│   Interface language                                 ‹ English ›   │
├───────────────────────────────────────────────────────────────────┤
│ ←→ Change · Enter cycle · Tab Switch · l Language · Esc Close     │
└───────────────────────────────────────────────────────────────────┘
```

| Setting | Values | Effect |
| --- | --- | --- |
| Previous replies | Fold / Keep expanded | When off, old replies stay expanded |
| Batch expand | 1-5 | The count `Alt+Shift+O` and `/fold recent` process at once |
| Notifications | Auto (TUI) / On / Off | Maps to `PI_AGENT_NOTIFY` |
| Notification sound | On / Off | Maps to `PI_AGENT_NOTIFY_SOUND` |
| Interface language | English / 简体中文 | Same as the `l` key |

Environment variables still override the settings file: `PI_AGENT_NOTIFY` and `PI_AGENT_NOTIFY_SOUND` replace the panel choice when set.

Thinking blocks stay under the control of `Ctrl+T` and the native mouse interaction. This package does not change them.

### Language

The language comes from the first available source:

1. The saved preference: `~/.pi/agent/ui-language.json`.
2. The `PI_UI_LANG` environment variable.
3. The system locale: `LC_ALL`, `LC_MESSAGES`, `LANG`, then the Node system language.
4. A Chinese region uses `zh`. All other regions use `en`.

Use an environment variable to select the default language:

```bash
PI_UI_LANG=zh pi -e /path/to/pi-ui-plus
PI_UI_LANG=en pi -e /path/to/pi-ui-plus
```

`PI_UI_LANG=auto` selects the language from the system locale.

Press `l` on any `/fold` tab to switch between Chinese and English. The switch keeps the current tab, the selected item, and all expansion states. The hint shows the target language:

- Chinese interface: `l English`
- English interface: `l 简体中文`

The saved preference has priority over the environment variable. The preference is global. The preference does not go into the session record and does not go to the model. If the save fails, the package shows an error notification and keeps the current interface language.

The language is also editable from the `Settings` tab of `/fold`, equivalent to the `l` key.

## Native interface localization

The same entry point localizes the known native display text of Pi:

- The shortcut groups, action descriptions, and fullscreen navigation text of `/hotkeys`.
- The setting names, descriptions, option menus, and control hints of `/settings`.
- The native startup help, common selector text, working states, compaction states, and branch summary hints.
- The known descriptions in the slash command autocomplete, including parameter hints. Completion values, command arguments, and completion actions stay as Pi supplies them.

The localization boundary is deliberately conservative. The package does not translate: user messages, model replies, tool names, paths, commands, code, raw tool output, unknown extension text, and model context. Pi text that the package cannot confirm stays in English. This rule prevents changes to functional data.

`/settings` gets no language item. The `l` key and the `Settings` tab in the `/fold` panel are the only language controls. Therefore, the item count, the setting keys, and the callback values of the native settings menu do not change.

## Agent settle notification

`pi-agent-notify.ts` sends a notification after the agent settles. The event is `agent_settled`. The extension does not notify again during a single model response, an automatic retry, or a context compaction.

The notification body comes from the latest user input. The extension removes Markdown, then limits the text to 56 characters. If no input is available, it uses a fixed text.

Notification backends:

| Platform | Backend |
| --- | --- |
| Windows | Windows Toast |
| WSL | Windows Toast, through `powershell.exe` |
| Linux desktop | `notify-send` |
| macOS | `osascript` |

The Windows Toast script is `assets/pi-toast.ps1`. In WSL, the extension converts the path with `wslpath`. The extension does not depend on a fixed user name or on `C:\Users\Public`.

The default sends notifications in TUI mode only. The `Settings` tab of `/fold` changes the notification switch and sound, written to `~/.pi/agent/pi-ui-plus.json`. Environment variables have priority.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PI_AGENT_NOTIFY` | `auto` | `auto` notifies in TUI mode only. `on` notifies in all modes. `off` disables notifications. Overrides the panel setting when set |
| `PI_AGENT_NOTIFY_SOUND` | `on` | `off` disables the notification sound. Overrides the panel setting when set |
| `PI_AGENT_NOTIFY_TITLE` | `Pi` | Notification title |
| `PI_AGENT_NOTIFY_MESSAGE` | latest user input | Overrides the notification body |
| `PI_AGENT_NOTIFY_APP_ID` | Windows Terminal AppID | AppID for the Windows Toast |

Examples:

```bash
PI_AGENT_NOTIFY=on pi -e /path/to/pi-ui-plus
PI_AGENT_NOTIFY_SOUND=off pi -e /path/to/pi-ui-plus
PI_AGENT_NOTIFY_TITLE='Code assistant' pi -e /path/to/pi-ui-plus
PI_AGENT_NOTIFY_MESSAGE='Task complete' pi -e /path/to/pi-ui-plus
```

A failed notification process does not change the agent result.

## Implementation notes

Original messages, tool arguments, tool results, and model context stay complete. Tool execution behavior does not change.

A folded tool renderer makes the summary only. It skips the formatting and the syntax highlighting of the original renderer for long arguments and output. An expanded block uses the original Pi renderer.

Previous reply folding adapts to the internal message container of Pi. If the package cannot identify the internal layout of a mixed message, that message shows as written.

A reload or an unload restores the native methods and the component text that the package took over. It also clears the plugin caches. Pi continues to own the tool expansion state.

The floating panel uses `ctx.ui.custom({ overlay: true })` and the Pi select components. The package has no timer and no background process. Settings are written to `~/.pi/agent/pi-ui-plus.json` with the same atomic temporary-file-plus-`rename` write as the language preference.

Non-interactive modes (print, JSON, RPC) do not enable TUI folding and do not enable the native UI adapter. Both regular and fullscreen modes are supported.

The package is developed and tested against `@earendil-works/pi-coding-agent` 1.1.0. If a later Pi version changes the internal component structure, the extension keeps the original display where possible. Areas that it cannot adapt stay in English and do not affect session functions.

## Project layout

```text
pi-ui-plus/
├── package.json          # npm manifest and pi manifest
├── pi-ui-plus/
│   ├── index.ts          # entry for folding and localization
│   ├── fold.ts           # folding logic and floating panel
│   ├── settings.ts       # shared settings store
│   ├── native-ui.ts      # native component adapter
│   ├── translations.ts   # messages and phrase table
│   ├── language.ts       # language detection and preference storage
│   └── autocomplete.ts   # slash command autocomplete localization
├── pi-agent-notify.ts    # settle notification extension
├── assets/pi-toast.ps1   # Windows Toast script
└── test/                 # unit tests and PTY smoke test
```

## Test

Run the unit tests and the extension load tests. The command needs `pi` and `node` in PATH:

```bash
node --test test/pi-ui-plus-fold.test.mjs test/pi-ui-plus.test.mjs test/pi-agent-notify.test.mjs
```

Run the PTY smoke test for regular and fullscreen mode. This test needs a POSIX system:

```bash
python3 test/pi-ui-plus-smoke.py
```

The tests cover:

- Tool folding and previous reply folding.
- Full display of the current reply.
- Independent thinking blocks.
- Original text preservation.
- Floating panel navigation, the `Settings` / `Chats` tabs, and settings cycling.
- Batch expand and collapse through `Alt+Shift+O` and `/fold recent`.
- The previous-reply folding switch.
- Shared notification settings and their fallback.
- Mouse input and terminal size adaptation.
- Language switch, locale priority, and global language persistence.
- Native `/hotkeys` and `/settings` adaptation.
- Slash command autocomplete.
- Reload and unload restore.
- Non-TUI modes.

## License

MIT
