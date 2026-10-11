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
│ ─ ▶ #1 read · src/main.ts · Done [Expand]         │
│ ─ ▶ #2 bash · run tests · Done [Expand]           │
│                                                   │
│ Assistant: Done. The details follow.              │
│ Notes, full examples ... shown in full ...        │
└───────────────────────────────────────────────────┘

                 after the next user message

┌─ next turn ───────────────────────────────────────┐
│ You: Check this problem and fix it.               │
│                                                   │
│ ─ ▶ #1 read · src/main.ts · Done [Expand]         │
│ ─ ▶ #2 bash · run tests · Done [Expand]           │
│ ─ ▶ #3 Previous reply · Done [Expand]             │
│                                                   │
│ You: Add one more option.                         │
│ ─ ▶ #4 edit · config.ts · Done [Expand]           │
│                                                   │
│ Assistant: The option is added. Full usage: ...   │
└───────────────────────────────────────────────────┘
```

### Controls

| Control | Effect |
| --- | --- |
| `/fold` | Opens the floating panel. Select a turn, then manage its tools and previous reply |
| `Alt+O` or `/fold latest` | Toggles the latest tool call or previous reply |
| `/fold collapse` | Folds the current foldable tool calls and previous replies |
| `/fold expand` | Expands the current foldable tool calls and previous replies |
| `/fold off` | Restores the native Pi rendering. The interface language does not change |
| `/fold on` | Turns folding on again |
| Click on a fold header | Toggles this block in fullscreen mode |
| `Ctrl+O` | Uses the native Pi tool expansion. Tool summaries follow it |

`/fold` uses the native Pi overlay. The background chat stays visible. Turns sort newest first. Each turn shows its tool count and its overall expansion state.

```text
┌─ /fold · Choose a turn ───────────────────────┐
│ → Turn 3 · Current · 4 tools · All collapsed  │
│   Turn 2 · 3 tools · Partly expanded          │
│   Turn 1 · 2 tools · All expanded             │
├───────────────────────────────────────────────┤
│ ↑↓ Select · l 简体中文 · Enter Enter · Esc Close │
└───────────────────────────────────────────────┘

┌─ Turn 2 · Tool calls ─────────────────────────┐
│ → ▶ read · 8 ms · main.ts · Done [Expand]     │
│   ▼ edit · 21 ms · main.ts · Done [Collapse]  │
│   ▶ bash · 1240 ms · tests · Done [Expand]    │
│   ▶ Final reply · Done [Expand]               │
│   ← Back to turns                             │
├───────────────────────────────────────────────┤
│ ↑↓ Select · l 简体中文 · Enter Toggle · Esc Back │
└───────────────────────────────────────────────┘
```

A selection toggles the expansion state in the chat area. The panel stays open. The second level lists single tools, foldable previous replies, and the back item. The current reply has no fold option. A turn without tools shows "No tools in this turn". The overall state counts tools only.

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

Press `l` in any `/fold` panel level to switch between Chinese and English. The switch keeps the current level, the selected item, and all expansion states. The hint shows the target language:

- Chinese interface: `l English`
- English interface: `l 简体中文`

The saved preference has priority over the environment variable. The preference is global. The preference does not go into the session record and does not go to the model. If the save fails, the package shows an error notification and keeps the current interface language.

## Native interface localization

The same entry point localizes the known native display text of Pi:

- The shortcut groups, action descriptions, and fullscreen navigation text of `/hotkeys`.
- The setting names, descriptions, option menus, and control hints of `/settings`.
- The native startup help, common selector text, working states, compaction states, and branch summary hints.
- The known descriptions in the slash command autocomplete, including parameter hints. Completion values, command arguments, and completion actions stay as Pi supplies them.

The localization boundary is deliberately conservative. The package does not translate: user messages, model replies, tool names, paths, commands, code, raw tool output, unknown extension text, and model context. Pi text that the package cannot confirm stays in English. This rule prevents changes to functional data.

`/settings` gets no language item. The `l` key in the `/fold` panel is the only language control. Therefore, the item count, the setting keys, and the callback values of the native settings menu do not change.

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

The default sends notifications in TUI mode only. Use these environment variables to change the behavior:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PI_AGENT_NOTIFY` | `auto` | `auto` notifies in TUI mode only. `on` notifies in all modes. `off` disables notifications |
| `PI_AGENT_NOTIFY_SOUND` | `on` | `off` disables the notification sound |
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

The floating panel uses `ctx.ui.custom({ overlay: true })` and the Pi select components. The package has no timer and no background process.

Non-interactive modes (print, JSON, RPC) do not enable TUI folding and do not enable the native UI adapter. Both regular and fullscreen modes are supported.

The package is developed and tested against `@earendil-works/pi-coding-agent` 1.1.0. If a later Pi version changes the internal component structure, the extension keeps the original display where possible. Areas that it cannot adapt stay in English and do not affect session functions.

## Project layout

```text
pi-ui-plus/
├── package.json          # npm manifest and pi manifest
├── pi-ui-plus/
│   ├── index.ts          # entry for folding and localization
│   ├── fold.ts           # folding logic and floating panel
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
- Floating panel navigation.
- Mouse input and terminal size adaptation.
- Language switch, locale priority, and global language persistence.
- Native `/hotkeys` and `/settings` adaptation.
- Slash command autocomplete.
- Reload and unload restore.
- Non-TUI modes.

## License

MIT
