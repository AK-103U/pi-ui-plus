import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { findHostRoot, hostRequire } from "./host.mjs";

const hostRoot = findHostRoot();
const require = hostRequire(hostRoot);
const host = (path) => import(pathToFileURL(resolve(hostRoot, "dist", path)).href);
const { loadExtensions, createExtensionRuntime } = await host("core/extensions/loader.js");
const { createEventBus } = await host("core/event-bus.js");
const { initTheme, theme, getMarkdownTheme, getSettingsListTheme } = await host("modes/interactive/theme/theme.js");
const { KeybindingsManager } = await host("core/keybindings.js");
const { ThemedText } = await host("modes/interactive/components/themed-text.js");
const { WorkingStatusIndicator, CompactionStatusIndicator } = await host("modes/interactive/components/status-indicator.js");
const { AssistantMessageComponent } = await host("modes/interactive/components/assistant-message.js");
const { UserMessageComponent } = await host("modes/interactive/components/user-message.js");
const { ToolExecutionComponent } = await host("modes/interactive/components/tool-execution.js");
const { BUILTIN_SLASH_COMMANDS } = await host("core/slash-commands.js");
const { Container, Text, Markdown, SettingsList, CombinedAutocompleteProvider, stripTerminalSequences } = await import(pathToFileURL(require.resolve("@earendil-works/pi-tui")).href);
initTheme("dark", false);
const plugin = fileURLToPath(new URL("../pi-ui-plus/index.ts", import.meta.url));
const keys = new KeybindingsManager();
const strip = (text) => stripTerminalSequences(text);
const settingsItem = () => ({ id: "autocompact", label: "Auto-compact", description: "Automatically compact context when it gets too large", currentValue: "false", values: ["false", "true"] });
class SettingsSelectorComponent extends Container {
	constructor(list) { super(); this.list = list; this.children = [list]; }
	getSettingsList() { return this.list; }
}

async function setup(mode = "tui", preference = "zh", directory) {
	const agentDir = directory ?? mkdtempSync(resolve(tmpdir(), "pi-ui-plus-integration-"));
	const saved = { dir: process.env.PI_CODING_AGENT_DIR, lang: process.env.PI_UI_LANG };
	process.env.PI_CODING_AGENT_DIR = agentDir;
	process.env.PI_UI_LANG = preference;
	const bus = createEventBus();
	const runtime = createExtensionRuntime();
	let appended = 0;
	runtime.appendEntry = () => { appended++; };
	let result;
	try { result = await loadExtensions([plugin], dirname(plugin), bus, runtime); }
	finally {
		if (saved.dir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = saved.dir;
		if (saved.lang === undefined) delete process.env.PI_UI_LANG; else process.env.PI_UI_LANG = saved.lang;
	}
	assert.deepEqual(result.errors, []);
	const extension = result.extensions[0];
	const document = new Container();
	const chat = new Container();
	const editor = new Container();
	document.children = [new Container(), new Container(), chat];
	const tui = { children: [document, new Container(), new Container(), new Container(), editor, new Container(), new Container()], mode: "fullscreen", terminal: { columns: 100, rows: 30 }, requestRender() {} };
	const notifications = [];
	const wrappers = [];
	const widgets = new Map();
	let overlay;
	const ctx = { mode, hasUI: mode === "tui", ui: {
		theme, notify(text) { notifications.push(text); },
		addAutocompleteProvider(factory) { wrappers.push(factory); },
		setWidget(key, factory) { widgets.get(key)?.dispose?.(); widgets.set(key, factory(tui, theme)); },
		custom(factory, options) {
			return new Promise((resolvePromise) => {
				overlay = { options, closed: false };
				overlay.panel = factory(tui, theme, keys, () => { overlay.closed = true; overlay.panel?.dispose?.(); resolvePromise(); });
			});
		},
	} };
	const emit = async (type) => { for (const handler of extension.handlers.get(type) ?? []) await handler({ type }, ctx); };
	await emit("session_start");
	return {
		agentDir, extension, bus, runtime, ctx, document, chat, editor, tui, wrappers, notifications, emit,
		get appended() { return appended; },
		text: () => strip(document.render(100).join("\n")),
		command: (args = "") => extension.commands.get("fold").handler(args, ctx),
		get overlay() { return overlay; },
		provider(commands = BUILTIN_SLASH_COMMANDS) { return wrappers.reduce((provider, wrap) => wrap(provider), new CombinedAutocompleteProvider(commands, agentDir)); },
		settings(onChange = () => {}) {
			const list = new SettingsList([settingsItem()], 10, getSettingsListTheme(), onChange, () => {}, { enableSearch: true });
			editor.children = [new SettingsSelectorComponent(list)];
			document.render(100);
			return list;
		},
		async dispose() { await emit("session_shutdown"); for (const widget of widgets.values()) widget.dispose?.(); if (!directory) rmSync(agentDir, { recursive: true, force: true }); },
	};
}
const suggest = (provider, text, options = {}) => provider.getSuggestions([text], 0, text.length, { signal: new AbortController().signal, ...options });
const assistant = (text) => new AssistantMessageComponent({ role: "assistant", content: [{ type: "text", text }], stopReason: "stop", api: "test", model: "test", provider: "test", timestamp: 0 }, true);
const hotkeysSource = "**Navigation**\n| Key | Action |\n|-----|--------|\n| `Ctrl+O` | Toggle tool output expansion |\n\n**Extensions**\n| Key | Action |\n|-----|--------|\n| `Alt+X` | Custom third-party message |";

test("one plugin owns only /fold, Alt+O, one widget and one tool resolver", async () => {
	const s = await setup();
	assert.deepEqual([...s.extension.commands.keys()], ["fold"]);
	assert.deepEqual([...s.extension.shortcuts.keys()], ["alt+o", "alt+shift+o"]);
	assert.equal(s.extension.toolRenderers.length, 1);
	assert.equal(s.wrappers.length, 1);
	assert.equal(s.appended, 0);
	assert.deepEqual([...s.extension.handlers.keys()], ["session_start", "session_tree", "session_shutdown"]);
	await s.dispose();
});

test("all installed native slash commands have translated descriptions, including parameter hints", async () => {
	const s = await setup();
	const nativeProvider = new CombinedAutocompleteProvider(BUILTIN_SLASH_COMMANDS, s.agentDir);
	const original = await suggest(nativeProvider, "/");
	const result = await suggest(s.provider(), "/");
	assert.equal(result.items.length, BUILTIN_SLASH_COMMANDS.length);
	for (const item of result.items) {
		const raw = original.items.find((entry) => entry.value === item.value);
		assert.equal(item.label, raw.label);
		assert.notEqual(item.description, raw.description, item.value);
		assert.match(item.description, /\p{Script=Han}/u, item.value);
		assert.deepEqual(s.provider().applyCompletion(["/"], 0, 1, item, "/"), nativeProvider.applyCompletion(["/"], 0, 1, raw, "/"));
	}
	const model = (await suggest(s.provider(), "/model")).items.find((item) => item.value === "model");
	assert.equal(model.description, "<provider/model> — 选择模型（打开选择器）");
	assert.equal((await suggest(s.provider(), "/quit")).items[0].description, "退出 Pi");
	await s.dispose();
});

test("sources and unknown extensions remain intact; matching extension descriptions translate", async () => {
	const s = await setup();
	const result = await suggest(s.provider([
		{ name: "known", description: "[u:npm:test] Open settings menu" },
		{ name: "hinted", argumentHint: "<path>", description: "[p] Open settings menu" },
		{ name: "unknown", description: "[u] Inspect a bespoke deployment" },
	]), "/");
	assert.equal(result.items.find((item) => item.value === "known").description, "[u:npm:test] 打开设置菜单");
	assert.equal(result.items.find((item) => item.value === "hinted").description, "<path> — [p] 打开设置菜单");
	assert.equal(result.items.find((item) => item.value === "unknown").description, "[u] Inspect a bespoke deployment");
	await s.dispose();
});

test("arguments, paths, force completion and null results are never localized", async () => {
	const s = await setup();
	const raw = { items: [{ value: "provider/model", label: "model", description: "Open settings menu" }], prefix: "fixture" };
	let received;
	const current = {
		triggerCharacters: ["#"],
		async getSuggestions(...args) { received = args; return raw; },
		applyCompletion(...args) { return { args }; },
		shouldTriggerFileCompletion() { return false; },
	};
	const provider = s.wrappers[0](current);
	for (const text of ["/model model", "@fixture", "some /text", "/model\tmodel"]) assert.equal(await suggest(provider, text), raw);
	raw.prefix = "/fixture";
	assert.equal(await suggest(provider, "/fixture", { force: true }), raw);
	assert.equal(received[3].force, true);
	assert.deepEqual(provider.triggerCharacters, ["#"]);
	assert.equal(provider.shouldTriggerFileCompletion([], 0, 0), false);
	assert.deepEqual(provider.applyCompletion(["/"], 0, 1, raw.items[0], "/"), { args: [["/"], 0, 1, raw.items[0], "/"] });
	const empty = s.wrappers[0]({ ...current, getSuggestions: async () => null });
	assert.equal(await suggest(empty, "/"), null);
	await s.dispose();
});

test("l changes folded headers, native hotkeys, settings and slash descriptions together", async () => {
	const s = await setup();
	const status = new ThemedText(() => theme.fg("muted", "Tool output: collapsed"), 0, 0);
	const hotkeys = new Markdown(hotkeysSource, 0, 0, getMarkdownTheme());
	const output = new ToolExecutionComponent("read", "call", { path: "RAW.ts" }, {}, s.extension.toolRenderers[0]("read", () => undefined), s.tui, s.agentDir);
	output.updateResult({ content: [{ type: "text", text: "RAW_TOOL_CONTENT" }], isError: false });
	s.chat.children = [new UserMessageComponent("RAW_USER"), output, assistant("RAW_REPLY"), status, hotkeys];
	const list = s.settings();
	assert.match(s.text(), /工具输出：已收起/);
	assert.match(s.text(), /导航/);
	const before = await suggest(s.provider(), "/settings");
	assert.equal(before.items[0].description, "打开设置菜单");
	const promise = s.command();
	s.overlay.panel.render(100);
	s.overlay.panel.handleInput("l");
	assert.match(strip(s.overlay.panel.render(100).join("\n")), /Choose a chat/);
	assert.match(s.text(), /Tool output: collapsed/);
	assert.match(s.text(), /read.*Done/);
	assert.match(strip(list.render(100).join("\n")), /Auto-compact/);
	assert.match(s.text(), /RAW_USER/);
	assert.match(s.text(), /RAW_REPLY/);
	assert.doesNotMatch(s.text(), /RAW_TOOL_CONTENT/);
	assert.match(hotkeys.text, /\*\*Navigation\*\*/);
	assert.equal((await suggest(s.provider(), "/settings")).items[0].description, "Open settings menu");
	assert.deepEqual(JSON.parse(readFileSync(resolve(s.agentDir, "ui-language.json"), "utf8")), { language: "en" });
	assert.equal(s.appended, 0);
	s.overlay.panel.handleInput("\x1b");
	await promise;
	await s.dispose();
});

test("settings localizes labels and search without adding a menu or changing native values and callbacks", async () => {
	const s = await setup();
	const changes = [];
	const list = s.settings((...args) => changes.push(args));
	assert.equal(list.items.length, 1);
	assert.equal(list.items[0].id, "autocompact");
	assert.equal(list.items[0].label, "自动压缩上下文");
	assert.equal(list.items[0].currentValue, "false");
	list.handleInput("\r");
	assert.deepEqual(changes, [["autocompact", "true"]]);
	list.applyFilter("自动压缩");
	assert.deepEqual(list.filteredItems, list.items);
	const promise = s.command();
	s.overlay.panel.handleInput("l");
	assert.equal(list.items[0].label, "Auto-compact");
	assert.equal(list.items[0].currentValue, "true");
	assert.equal((await suggest(s.provider(), "/tree")).items[0].description, "Navigate session tree (switch branches)");
	assert.doesNotMatch(strip(list.render(100).join("\n")), /Interface language|界面语言/);
	s.overlay.panel.handleInput("l");
	assert.equal(list.items[0].label, "自动压缩上下文");
	assert.equal(list.items[0].currentValue, "true");
	s.overlay.panel.handleInput("\x1b");
	await promise;
	await s.dispose();
});

test("native localization leaves user, assistant, tool and extension content unchanged", async () => {
	const s = await setup();
	const phrase = "Open settings menu";
	const user = new UserMessageComponent(phrase);
	const reply = assistant(phrase);
	const custom = new Container(); custom.children = [new Text(phrase)];
	const plain = new Text(phrase);
	const arbitrary = new Markdown(phrase, 0, 0, getMarkdownTheme());
	s.chat.children = [user, reply, custom, plain, arbitrary];
	s.text();
	assert.equal(user.text, phrase);
	assert.equal(reply.lastMessage.content[0].text, phrase);
	assert.equal(plain.text, phrase);
	assert.equal(custom.children[0].text, phrase);
	assert.equal(arbitrary.text, phrase);
	await s.dispose();
});

test("shutdown restores native method ownership, strings and settings; retained autocomplete becomes inert", async () => {
	const s = await setup();
	const status = new ThemedText(() => theme.fg("muted", "Tool output: collapsed"), 0, 0);
	const originalStatus = ThemedText.prototype.render;
	const hotkeys = new Markdown(hotkeysSource, 0, 0, getMarkdownTheme());
	s.chat.children = [status, hotkeys];
	const list = s.settings();
	s.text();
	assert.equal(list.items.length, 1);
	const provider = s.provider();
	assert.equal((await suggest(provider, "/settings")).items[0].description, "打开设置菜单");
	await s.emit("session_shutdown");
	assert.equal(s.document.render, Container.prototype.render);
	assert.equal(status.render, originalStatus);
	assert.match(strip(status.render(100).join("\n")), /Tool output: collapsed/);
	assert.equal(hotkeys.text, hotkeysSource);
	assert.equal(list.items.length, 1);
	assert.equal(list.items[0].label, "Auto-compact");
	assert.equal(Object.hasOwn(s.document, "render"), false);
	assert.equal(Object.hasOwn(status, "render"), false);
	assert.equal(Object.hasOwn(status, "setText"), false);
	assert.equal(Object.hasOwn(list, "render"), false);
	assert.equal((await suggest(provider, "/settings")).items[0].description, "Open settings menu");
	await s.dispose();
});

test("global preference survives session restart and invalid preferences fall back safely", async () => {
	const s = await setup();
	const initial = s.command();
	s.overlay.panel.handleInput("l");
	s.overlay.panel.handleInput("\x1b"); await initial;
	await s.emit("session_start");
	const promise = s.command();
	assert.match(strip(s.overlay.panel.render(100).join("\n")), /Choose a chat/);
	s.overlay.panel.handleInput("\x1b"); await promise;
	writeFileSync(resolve(s.agentDir, "ui-language.json"), "invalid-json");
	await s.emit("session_start");
	const reset = s.command();
	assert.match(strip(s.overlay.panel.render(100).join("\n")), /选择对话/);
	s.overlay.panel.handleInput("\x1b"); await reset;
	await s.dispose();
});

test("settings write failure reports an error and does not change the current language", async () => {
	const s = await setup();
	writeFileSync(resolve(s.agentDir, "ui-language.json"), JSON.stringify({ language: "zh" }));
	// Force an atomic rename failure without modifying any user files.
	rmSync(resolve(s.agentDir, "ui-language.json"));
	mkdirSync(resolve(s.agentDir, "ui-language.json"));
	const promise = s.command();
	s.overlay.panel.handleInput("l");
	assert.match(strip(s.overlay.panel.render(100).join("\n")), /选择对话/);
	assert.match(s.notifications.at(-1), /Could not save UI language/);
	assert.deepEqual(readdirSync(s.agentDir), ["ui-language.json"]);
	s.overlay.panel.handleInput("\x1b"); await promise;
	await s.dispose();
});

test("saved preference beats environment defaults in a newly loaded extension runtime", async () => {
	const directory = mkdtempSync(resolve(tmpdir(), "pi-ui-plus-persist-"));
	try {
		const first = await setup("tui", "zh", directory);
		const promise = first.command();
		first.overlay.panel.handleInput("l");
		first.overlay.panel.handleInput("\x1b"); await promise;
		await first.dispose();
		const second = await setup("tui", "zh", directory);
		assert.equal((await suggest(second.provider(), "/settings")).items[0].description, "Open settings menu");
		const opened = second.command();
		assert.match(strip(second.overlay.panel.render(100).join("\n")), /Choose a chat/);
		second.overlay.panel.handleInput("\x1b"); await opened;
		await second.dispose();
	} finally { rmSync(directory, { recursive: true, force: true }); }
});

test("our command and shortcut descriptions toggle both directions without altering third-party hotkeys", async () => {
	const s = await setup("tui", "en");
	const command = { name: "fold", description: "[t] " + s.extension.commands.get("fold").description };
	const provider = s.provider([command]);
	const own = `| \`Alt+O\` | ${s.extension.shortcuts.get("alt+o").description} |`;
	const hotkeys = new Markdown(hotkeysSource + "\n" + own, 0, 0, getMarkdownTheme());
	s.chat.children = [hotkeys];
	s.text();
	assert.equal((await suggest(provider, "/fold")).items[0].description, "[t] Browse chats, tool calls and previous replies");
	const promise = s.command();
	s.overlay.panel.handleInput("l");
	s.text();
	assert.equal((await suggest(provider, "/fold")).items[0].description, "[t] 按用户消息查看工具调用和旧回复");
	assert.match(hotkeys.text, /展开或收起最近一块工具调用或旧回复/);
	assert.match(hotkeys.text, /Custom third-party message/);
	s.overlay.panel.handleInput("l");
	s.text();
	assert.equal((await suggest(provider, "/fold")).items[0].description, command.description);
	assert.match(hotkeys.text, /Toggle the latest tool call or previous reply/);
	s.overlay.panel.handleInput("\x1b"); await promise;
	await s.dispose();
});

test("native embedded and standalone loaders translate display only, including live updates and cleanup", async () => {
	const s = await setup();
	class CustomEditor extends Container {}
	const indicator = new WorkingStatusIndicator(s.tui, "Working", { frames: ["*"] });
	const formatter = indicator.messageColorFn;
	const editor = new CustomEditor();
	editor.workingStatusIndicator = indicator;
	s.editor.children = [editor];
	const compaction = new CompactionStatusIndicator(s.tui, "manual");
	compaction.stop();
	const originalMessage = compaction.message;
	s.tui.children[2].children = [compaction];
	s.text();
	assert.match(strip(indicator.renderInBorder(100)), /正在处理/);
	assert.match(strip(compaction.render(100).join("\n")), /正在压缩上下文/);
	assert.equal(indicator.message, "Working");
	assert.equal(compaction.message, originalMessage);
	indicator.setMessage("Working... (Esc to interrupt)");
	assert.match(strip(indicator.renderInBorder(100)), /正在处理……（Esc 中断）/);
	const promise = s.command();
	s.overlay.panel.handleInput("l");
	assert.match(strip(indicator.renderInBorder(100)), /Working\.\.\. \(Esc to interrupt\)/);
	assert.match(strip(compaction.render(100).join("\n")), /Compacting context/);
	s.overlay.panel.handleInput("l");
	assert.match(strip(indicator.renderInBorder(100)), /正在处理/);
	s.overlay.panel.handleInput("\x1b"); await promise;
	await s.emit("session_shutdown");
	assert.equal(indicator.messageColorFn, formatter);
	assert.match(strip(indicator.renderInBorder(100)), /Working/);
	assert.equal(compaction.message, originalMessage);
	indicator.dispose(); compaction.dispose();
	await s.dispose();
});

test("native cleanup preserves later render wrappers and makes retained hooks inert", async () => {
	const s = await setup();
	const status = new ThemedText(() => "Tool output: collapsed", 0, 0);
	s.chat.children = [status];
	s.text();
	const retained = status.render.bind(status);
	const later = (width) => ["LATER", ...retained(width)];
	status.render = later;
	await s.emit("session_shutdown");
	assert.equal(status.render, later);
	const text = strip(status.render(100).join("\n"));
	assert.match(text, /LATER/);
	assert.match(text, /Tool output: collapsed/);
	assert.doesNotMatch(text, /工具输出/);
	await s.dispose();
});

test("print, JSON and RPC modes install no native UI or autocomplete hooks", async () => {
	for (const mode of ["print", "json", "rpc"]) {
		const s = await setup(mode);
		assert.equal(s.wrappers.length, 0);
		assert.equal(Object.hasOwn(s.document, "render"), false);
		assert.equal(Object.hasOwn(s.chat, "render"), false);
		await s.command();
		assert.deepEqual(s.notifications, []);
		await s.dispose();
	}
});
