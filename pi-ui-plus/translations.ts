export const messages = {
	en: {
		failed: "Failed", running: "Running", preparing: "Preparing", completed: "Done",
		toolFailed: "Tool execution failed", previousReply: "Previous reply", finalReply: "Final reply",
		current: "Current", toolCount: "{count} tools", toolCountOne: "{count} tool",
		allCollapsed: "All collapsed", allExpanded: "All expanded", partlyExpanded: "Partly expanded",
		noTurnTools: "No tools in this turn", backToChats: "Back to chats", noChats: "No chats yet",
		chooseChat: "/fold · Choose a chat", toolCalls: "Tool calls",
		select: "Select", toggle: "Toggle", enter: "Enter", back: "Back", close: "Close",
		tabChats: "Chats", tabSettings: "Settings",
		settingReplies: "Previous replies", settingRepliesOn: "Fold", settingRepliesOff: "Keep expanded",
		settingBatch: "Batch expand", settingBatchValue: "{count} replies",
		settingNotify: "Notifications", notifyAuto: "Auto (TUI)", notifyOn: "On", notifyOff: "Off",
		settingSound: "Notification sound", soundOn: "On", soundOff: "Off",
		settingLanguage: "Interface language",
		settingsHint: "←→ Change · Enter cycle · Tab Switch · l Language · Esc Close",
		usage: "Usage: /fold [latest|collapse|expand|off|on] or /fold recent [n|off]",
		incompatible: "pi-ui-plus: this Pi transcript layout is incompatible; keeping the original display.",
		notAttached: "pi-ui-plus is not attached to the transcript yet.",
		commandDescription: "Browse chats, tool calls and previous replies",
		shortcutDescription: "Toggle the latest tool call or previous reply",
		recentShortcutDescription: "Expand the most recent replies",
		languageHint: "l 简体中文",
	},
	zh: {
		failed: "失败", running: "运行中", preparing: "准备中", completed: "完成",
		toolFailed: "工具执行失败", previousReply: "上一轮回复", finalReply: "本轮最终回复",
		current: "当前", toolCount: "{count} 个工具", toolCountOne: "{count} 个工具",
		allCollapsed: "全部收起", allExpanded: "全部展开", partlyExpanded: "部分展开",
		noTurnTools: "本轮暂无工具", backToChats: "返回对话列表", noChats: "暂无对话",
		chooseChat: "/fold · 选择对话", toolCalls: "工具调用",
		select: "选择", toggle: "切换", enter: "进入", back: "返回", close: "关闭",
		tabChats: "对话", tabSettings: "设置",
		settingReplies: "上一轮回复", settingRepliesOn: "折叠", settingRepliesOff: "保持展开",
		settingBatch: "批量展开条数", settingBatchValue: "最近 {count} 条",
		settingNotify: "完成通知", notifyAuto: "自动（仅 TUI）", notifyOn: "开启", notifyOff: "关闭",
		settingSound: "通知声音", soundOn: "开启", soundOff: "关闭",
		settingLanguage: "界面语言",
		settingsHint: "←→ 修改 · Enter 循环 · Tab 切换 · l 语言 · Esc 关闭",
		usage: "用法：/fold [latest|collapse|expand|off|on]，或 /fold recent [n|off]",
		incompatible: "pi-ui-plus：当前 Pi 的消息容器不兼容，保留原始显示。",
		notAttached: "pi-ui-plus 尚未接入消息界面。",
		commandDescription: "按用户消息查看工具调用和旧回复",
		shortcutDescription: "展开或收起最近一块工具调用或旧回复",
		recentShortcutDescription: "展开最近的若干条回复",
		languageHint: "l English",
	},
};

export type Language = keyof typeof messages;

// Exact native UI phrases only. IDs, model names, paths, commands, user text,
// assistant replies and tool results are never passed through this dictionary.
export const phrases: Record<string, string> = {
	"Open settings menu": "打开设置菜单",
	"Select model (opens selector UI)": "选择模型（打开选择器）",
	"Navigate session tree (switch branches)": "浏览会话树（切换分支）",
	"Set thinking level": "设置思考强度",
	"Enable/disable models for Ctrl+P cycling": "启用或禁用 Ctrl+P 轮换的模型",
	"Export session (HTML default, or specify path: .html/.jsonl)": "导出会话（默认 HTML，也可指定 .html/.jsonl 路径）",
	"Import and resume a session from a JSONL file": "从 JSONL 文件导入并恢复会话",
	"Share session as a secret GitHub gist": "将会话作为私密 GitHub gist 分享",
	"Report a bug to the Pi developers": "向 Pi 开发者报告问题",
	"Copy last agent message to clipboard": "复制最后一条模型回复到剪贴板",
	"Set session display name": "设置会话显示名称",
	"Show session info and stats": "显示会话信息和统计",
	"Show changelog entries": "显示更新日志",
	"Show all keyboard shortcuts": "显示所有快捷键",
	"Create a new fork from a previous user message": "从之前的用户消息创建新分支",
	"Duplicate the current session at the current position": "在当前位置复制当前会话",
	"Save project trust decision for future sessions": "保存项目的信任决定，供后续会话使用",
	"Configure provider authentication": "配置服务提供方认证",
	"Remove provider authentication": "移除服务提供方认证",
	"Start a new session": "开始新会话",
	"Manually compact the session context": "手动压缩会话上下文",
	"Resume a different session": "恢复另一个会话",
	"Reload keybindings, extensions, skills, prompts, themes, and context files": "重载快捷键、扩展、技能、提示模板、主题和上下文文件",
	"Quit Pi": "退出 Pi", "Quit pi": "退出 Pi",
	[messages.en.commandDescription]: messages.zh.commandDescription,
	[messages.en.shortcutDescription]: messages.zh.shortcutDescription,
	[messages.en.recentShortcutDescription]: messages.zh.recentShortcutDescription,
	"Keyboard Shortcuts": "快捷键",
	"Navigation": "导航", "Editing": "编辑", "Other": "其他", "Extensions": "扩展",
	"Key": "按键", "Action": "功能",
	"Move cursor / browse history": "移动光标／浏览输入历史",
	"Move by word": "按词移动", "Start of line": "移到行首", "End of line": "移到行尾",
	"Jump forward to character": "向后查找并跳到指定字符", "Jump backward to character": "向前查找并跳到指定字符",
	"Scroll by page": "按页滚动", "Send message": "发送消息", "New line": "插入换行",
	"New line (Ctrl+Enter on Windows Terminal)": "插入换行（Windows Terminal 使用 Ctrl+Enter）",
	"Delete word backwards": "删除前一个词", "Delete word forwards": "删除后一个词",
	"Delete to start of line": "删除到行首", "Delete to end of line": "删除到行尾",
	"Paste the most-recently-deleted text": "粘贴最近删除的文本",
	"Cycle through the deleted text after pasting": "粘贴后轮换已删除的文本",
	"Undo": "撤销", "Path completion / accept autocomplete": "补全路径／接受补全",
	"Cancel autocomplete / abort streaming": "取消补全／中断生成",
	"Clear editor (first) / exit (second)": "第一次清空输入，第二次退出",
	"Exit (when editor is empty)": "输入框为空时退出", "Suspend to background": "挂起到后台",
	"Cycle thinking level": "切换思考强度", "Cycle models": "轮换模型",
	"Open model selector": "打开模型选择器", "Toggle tool output expansion": "展开／收起工具输出",
	"Toggle thinking block visibility": "展开／收起思考块",
	"Edit message in external editor": "使用外部编辑器编辑消息",
	"Copy selection or last assistant message": "复制选中文字或最后一条模型回复",
	"Queue follow-up message": "将后续消息加入队列", "Restore queued messages": "将排队消息恢复到输入框",
	"Paste files on macOS, images, or text from clipboard": "粘贴剪贴板中的图片或文本（macOS 也支持文件）",
	"Slash commands": "斜杠命令", "Run bash command": "运行 bash 命令",
	"Run bash command (excluded from context)": "运行 bash 命令（不加入模型上下文）",
	"Fullscreen navigation": "全屏对话导航", "Previous marked message": "跳到上一条标记消息",
	"Next marked message": "跳到下一条标记消息", "Beginning of transcript": "跳到对话顶部",
	"Latest output and follow new messages": "跳到最新位置并跟随新输出", "Search transcript": "搜索对话内容",
	"Scroll transcript up by one page": "对话向上滚动一页", "Scroll transcript down by one page": "对话向下滚动一页",
	"to interrupt": "中断", "to clear": "清空输入", "to exit": "退出",
	"to exit (empty)": "输入为空时退出", "to suspend": "挂起到后台",
	"to delete to end": "删除到行尾", "to cycle thinking level": "切换思考强度",
	"to cycle models": "轮换模型", "to select model": "选择模型",
	"to expand tools": "展开工具输出", "to expand thinking": "展开思考块",
	"for external editor": "打开外部编辑器", "for commands": "命令",
	"for bash": "运行 bash", "for bash (no context)": "运行 bash（不加入上下文）",
	"to run bash": "运行 bash", "to run bash (no context)": "运行 bash（不加入上下文）",
	"to queue follow-up": "排队发送后续消息", "to edit all queued messages": "编辑所有排队消息",
	"to paste files on macOS, images, or text": "粘贴图片或文本（macOS 也支持文件）",
	"to attach": "添加附件", "interrupt": "中断", "clear/exit": "清空／退出",
	"commands": "命令", "bash": "bash", "more": "展开更多",
	"Pi can explain its own features and look up its docs. Ask it how to use or extend Pi.": "可以询问 Pi 的功能、使用方式及扩展开发；它能查阅自己的文档。",
	"Auto-compact": "自动压缩上下文", "Steering mode": "即时引导消息模式", "Follow-up mode": "后续消息模式",
	"Transport": "传输方式", "HTTP idle timeout": "HTTP 空闲超时", "Cache warming": "缓存预热",
	"Hide thinking": "隐藏思考块", "Mermaid diagrams": "Mermaid 图表", "Cache miss notices": "缓存与恢复提示",
	"Collapse changelog": "折叠更新日志", "Quiet startup": "简洁启动", "Install telemetry": "安装统计",
	"Default project trust": "默认项目信任策略", "Double-escape action": "双击 Esc 的操作",
	"Tree filter mode": "会话树默认筛选", "Warnings": "警告设置", "Default thinking level per model": "各模型的默认思考强度",
	"TUI mode": "终端显示模式", "Fullscreen exit output": "退出全屏时的输出",
	"Fullscreen scrollbar": "全屏滚动条", "Fullscreen copy on select": "选中文字自动复制",
	"Fullscreen wheel scrolling": "全屏滚轮速度", "Theme": "主题", "Show images": "显示图片",
	"Image width": "图片显示宽度", "Auto-resize images": "自动缩小图片", "Block images": "禁止发送图片",
	"Skill commands": "技能命令", "Show hardware cursor": "显示终端光标", "Editor padding": "输入区左右边距",
	"Output padding": "输出区左右边距", "Autocomplete max items": "补全列表最大条数",
	"Clear on shrink": "内容缩短时清除空行", "Terminal progress": "终端标签页进度",
	"Anthropic extra usage": "Anthropic 额外付费用量",
	"Automatically compact context when it gets too large": "上下文过长时自动压缩。",
	"Enter while streaming queues steering messages. 'one-at-a-time': deliver one, wait for response. 'all': deliver all at once.": "生成期间按 Enter 排队发送引导消息。one-at-a-time：逐条发送并等待回复；all：一次发送全部。",
	"Preferred transport for providers that support multiple transports": "服务提供方支持多种传输方式时，优先使用此方式。",
	"Maximum idle gap while waiting for HTTP headers or body chunks. Disable for local models that pause longer than five minutes.": "等待 HTTP 响应头或内容时允许的最长空闲时间。若本地模型可能暂停超过五分钟，可关闭超时。",
	"off; streaming while the agent runs; idle also between runs while continuation stays profitable": "off：关闭；streaming：执行期间预热；idle：有收益时也在两轮之间预热。",
	"Hide thinking blocks in assistant responses": "隐藏模型回复中的思考内容。",
	"Render Mermaid code blocks as Unicode diagrams": "把 Mermaid 代码块渲染成 Unicode 图表。",
	"Show transcript notices for cache costs and provider recovery diagnostics": "在对话中显示缓存费用及服务提供方恢复诊断提示。",
	"Show condensed changelog after updates": "更新后只显示精简的更新日志。",
	"Disable verbose printing at startup (header: keep only the startup header)": "减少启动信息。header：只保留启动页头。",
	"Send an anonymous version/update ping after changelog-detected updates": "检测到版本更新后发送匿名版本与更新统计。",
	"Fallback behavior when no extension or saved trust decision decides project trust": "没有扩展或已保存的信任决定时，使用此项目信任策略。",
	"Action when pressing Escape twice with empty editor": "输入框为空时连续按两次 Esc 执行的操作。",
	"Default filter when opening /tree": "打开 /tree 时使用的默认筛选方式。",
	"Enable or disable individual warnings": "分别开启或关闭各种警告。",
	"Interface layout; regular mode uses the terminal's normal scrollback": "终端界面布局；regular 使用终端原生滚动历史，fullscreen 使用全屏对话视图。",
	"Print the transcript or only a session resume hint when exiting fullscreen mode": "退出全屏时打印对话内容，或只显示恢复会话的提示。",
	"Scrollbar behavior in fullscreen mode; has no effect in regular mode": "全屏模式的滚动条行为；不影响 regular 模式。",
	"Automatically copy selected text in fullscreen mode; disable to copy selections with Ctrl+X": "全屏模式中选中文字后自动复制；关闭后使用 Ctrl+X 复制。",
	"Lines per mouse-wheel event in fullscreen mode; 'auto' speeds up fast wheel spins where the terminal does not": "全屏模式中每次滚轮事件滚动的行数；auto 会在终端未加速时对快速滚动加速。",
	"Color theme for the interface": "界面使用的配色主题。",
	"Render images inline in terminal": "直接在终端里显示图片。",
	"Preferred inline image width in terminal cells": "图片在终端中显示的首选宽度，单位为字符列。",
	"Resize large images to 2000x2000 max for better model compatibility": "将大图片缩小到最多 2000×2000，以提升模型兼容性。",
	"Prevent images from being sent to LLM providers": "阻止向模型服务提供方发送图片。",
	"Register skills as /skill:name commands": "把技能注册为 /skill:name 命令。",
	"Show the terminal cursor while still positioning it for IME support": "显示终端光标，同时保留输入法候选窗口定位支持。",
	"Horizontal padding for input editor (0-3)": "输入区左右边距，范围为 0–3 列。",
	"Horizontal padding for messages, tool output, and command output": "消息、工具输出和命令输出的左右边距。",
	"Max visible items in autocomplete dropdown (3-20)": "补全下拉列表最多显示的条数，范围为 3–20。",
	"Clear empty rows when content shrinks (may cause flicker)": "内容缩短后清除多余空行，可能引起闪烁。",
	"Show OSC 9;4 progress indicators in the terminal tab bar": "在支持 OSC 9;4 的终端标签栏显示进度。",
	"Warn when Anthropic subscription auth may use paid extra usage": "Anthropic 订阅认证可能产生额外付费时显示警告。",
	"Type to search · Enter/Space to change · Esc to cancel": "输入以搜索 · Enter/Space 修改 · Esc 返回",
	"Enter/Space to change · Esc to cancel": "Enter/Space 修改 · Esc 返回",
	"No settings available": "暂无设置项", "No matching settings": "没有匹配的设置",
	"Select a theme, or choose automatic to follow terminal appearance.": "选择主题，或选择 automatic 跟随终端的明暗外观。",
	"Automatic Theme": "自动主题", "Choose themes for terminal light and dark appearance.": "分别选择终端浅色和深色外观的主题。",
	"Light/dark detection requires terminal support.": "明暗外观检测需要终端支持。",
	"Light theme": "浅色主题", "Dark theme": "深色主题", "Light Theme": "浅色主题", "Dark Theme": "深色主题",
	"Theme to use in automatic mode when the terminal is light": "自动模式中终端为浅色时使用的主题。",
	"Theme to use in automatic mode when the terminal is dark": "自动模式中终端为深色时使用的主题。",
	"Select the theme to use for light terminal appearance": "选择终端浅色外观使用的主题。",
	"Select the theme to use for dark terminal appearance": "选择终端深色外观使用的主题。",
	"Theme created from your terminal's colors": "根据终端自身的配色生成的主题。",
	"Use separate themes for light and dark terminal appearance": "分别为浅色和深色终端使用不同主题。",
	"Apply": "应用", "Save and go back": "保存并返回", "Change mode": "切换模式",
	"Switch to one theme for light and dark": "在浅色和深色外观下都使用同一个主题。",
	"Per-Model Thinking Level": "各模型的思考强度", "Select a model to configure": "选择要配置的模型。",
	"Select default thinking level for this model": "选择此模型的默认思考强度。",
	"No models available": "暂无可用模型", "Log in to a provider or configure an API key first": "请先登录服务提供方或配置 API key。",
	"No reasoning": "不进行推理", "Very brief reasoning (~1k tokens)": "极简推理（约 1k tokens）",
	"Light reasoning (~2k tokens)": "轻量推理（约 2k tokens）", "Moderate reasoning (~8k tokens)": "中等推理（约 8k tokens）",
	"Deep reasoning (~16k tokens)": "深入推理（约 16k tokens）", "Extra-high reasoning (~32k tokens)": "超高强度推理（约 32k tokens）",
	"Maximum reasoning": "最高强度推理",
	"Working": "正在处理", "Working...": "正在处理……",
	"Compacting context...": "正在压缩上下文……", "Auto-compacting...": "正在自动压缩……",
	"Summarizing branch...": "正在总结分支……",
	"Tool output: expanded": "工具输出：已展开", "Tool output: collapsed": "工具输出：已收起",
	"Thinking blocks: hidden": "思考块：已隐藏", "Thinking blocks: visible": "思考块：已展开",
	"Copied last assistant message to clipboard": "已复制最后一条模型回复", "No assistant message to copy": "没有可复制的模型回复",
	"Startup is still in progress": "仍在启动中", "✓ New session started": "✓ 已开始新会话",
	"Copied last agent message to clipboard": "已复制最后一条模型回复",
	"No agent messages to copy yet.": "没有可复制的模型回复。",
	"Refreshing model catalogs…": "正在刷新模型目录……",
	"Model catalogs refreshed.": "模型目录已刷新。",
	"Model refresh timed out; showing cached models.": "刷新模型超时，正在显示缓存中的模型。",
	"Only showing models from configured providers. Use /login to add providers.": "只显示已配置服务提供方的模型。可用 /login 添加服务提供方。",
	"Close active overlays before changing TUI mode": "请先关闭悬浮窗口，再切换终端显示模式。",
	"Wait for the current response to finish before reloading.": "请等待当前回复结束，再进行重载。",
	"Wait for compaction to finish before reloading.": "请等待上下文压缩结束，再进行重载。",
	"Type to search · Enter to select · Esc to cancel": "输入以搜索 · Enter 选择 · Esc 返回",
	"Enter to select · Esc to cancel": "Enter 选择 · Esc 返回",
	"Model selection saved to settings": "模型选择已保存到设置",
	"Reloading keybindings, extensions, skills, prompts, themes, and context files...": "正在重载快捷键、扩展、技能、提示模板、主题和上下文文件……",
	"Reloaded keybindings, extensions, skills, prompts, themes, and context files": "已重载快捷键、扩展、技能、提示模板、主题和上下文文件",
};

// Match only native descriptive phrases; do not translate generic tokens such
// as 'model', 'off', 'read' or arbitrary substrings in paths and names.
function translateLine(segment: string): string {
		const trimmed = segment.trim();
		let translated = Object.hasOwn(phrases, trimmed) ? phrases[trimmed] : undefined;
		if (!translated) {
			const followUp = /^(\S+) queues follow-up messages until agent stops\. 'one-at-a-time': deliver one, wait for response\. 'all': deliver all at once\.$/.exec(trimmed);
			const thinking = /^Override the default thinking level for specific models\. (\S+) cycles in-session\.$/.exec(trimmed);
			const select = /^(.*?) to select · (.*?) to set as default · (.*?) to cancel$/.exec(trimmed);
			const waiting = /^(Working(?:\.\.\.)?|Compacting context\.\.\.|Auto-compacting\.\.\.|Summarizing branch\.\.\.) \((.*?) to (interrupt|cancel)\)$/.exec(trimmed);
			const prompt = /^Press (.*?) to show full startup help( and loaded resources)?\.$/.exec(trimmed);
			const status = /^(TUI mode|HTTP idle timeout|Cache warming|Default thinking level|Thinking level|Default model|Model): (.+)$/.exec(trimmed);
			const reasoning = /^(.*) · default$/.exec(trimmed);
			const modelThinking = /^Thinking Level for (.+)$/.exec(trimmed);
			const defaultThinking = /^Revert to global default \((.+)\)$/.exec(trimmed);
			const retry = /^Retrying \((\d+\/\d+)\) in (\d+)s\.\.\. \((.+) to cancel\)$/.exec(trimmed);
			if (followUp) translated = `${followUp[1]} 将后续消息排队，待执行结束后发送。one-at-a-time：逐条发送并等待回复；all：一次发送全部。`;
			else if (thinking) translated = `为特定模型覆盖默认思考强度；${thinking[1]} 在当前会话中轮换。`;
			else if (select) translated = `${select[1]} 选择 · ${select[2]} 设为默认 · ${select[3]} 返回`;
			else if (waiting) translated = `${({ "Working": "正在处理", "Working...": "正在处理……", "Compacting context...": "正在压缩上下文……", "Auto-compacting...": "正在自动压缩……", "Summarizing branch...": "正在总结分支……" } as Record<string, string>)[waiting[1]]}（${waiting[2]} ${waiting[3] === "interrupt" ? "中断" : "取消"}）`;
			else if (prompt) translated = `按 ${prompt[1]} 展开完整启动帮助${prompt[2] ? "和已加载资源" : ""}。`;
			else if (status) translated = `${({ "TUI mode": "终端显示模式", "HTTP idle timeout": "HTTP 空闲超时", "Cache warming": "缓存预热", "Default thinking level": "默认思考强度", "Thinking level": "思考强度", "Default model": "默认模型", "Model": "模型" } as Record<string, string>)[status[1]]}：${status[2]}`;
			else if (reasoning && Object.hasOwn(phrases, reasoning[1])) translated = `${phrases[reasoning[1]]} · 默认`;
			else if (modelThinking) translated = `${modelThinking[1]} 的思考强度`;
			else if (defaultThinking) translated = `恢复全局默认值（${defaultThinking[1]}）`;
			else if (retry) translated = `${retry[2]} 秒后重试（${retry[1]}，${retry[3]} 取消）`;
		}
		return translated ? segment.replace(trimmed, translated) : segment;
}

export function translatePhrase(text: string): string {
	// Preserve terminal escapes byte-for-byte and translate before wrapping.
	return text.split(/(\x1b\[[0-9;]*m)/g).map((part) => /^\x1b/.test(part) ? part : part.split("\n").map(translateLine).join("\n")).join("");
}

export function translateHotkeys(source: string): string {
	let section = "";
	return source.split("\n").map((line) => {
		const heading = /^\*\*([^*]+)\*\*$/.exec(line.trim());
		if (heading) {
			section = heading[1];
			return `**${Object.hasOwn(phrases, section) ? phrases[section] : section}**`;
		}
		if (line === "| Key | Action |") return "| 按键 | 功能 |";
		// Only our own shortcut description is localized in Extensions.
		const row = /^(\|.*\|) ([^|]*) \|$/.exec(line);
		if (row && (section !== "Extensions" || row[2] === messages.en.shortcutDescription)) return row[1] + " " + translatePhrase(row[2]) + " |";
		return line;
	}).join("\n");
}
