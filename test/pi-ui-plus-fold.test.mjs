import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { findHostRoot, hostRequire } from "./host.mjs";

const hostRoot = findHostRoot();
const require = hostRequire(hostRoot);
const hostDir = resolve(hostRoot, "dist");
const host = (path) => import(pathToFileURL(resolve(hostDir, path)).href);
const { loadExtensions, createExtensionRuntime } = await host("core/extensions/loader.js");
const { initTheme, theme } = await host("modes/interactive/theme/theme.js");
const { AssistantMessageComponent } = await host("modes/interactive/components/assistant-message.js");
const { UserMessageComponent } = await host("modes/interactive/components/user-message.js");
const { ToolExecutionComponent } = await host("modes/interactive/components/tool-execution.js");
const { KeybindingsManager } = await host("core/keybindings.js");
const { Container, Text, visibleWidth } = await import(pathToFileURL(require.resolve("@earendil-works/pi-tui")).href);
initTheme("dark", false);
const pluginPath = fileURLToPath(new URL("../pi-ui-plus/index.ts", import.meta.url));

function assistant(text, options = {}) {
	return new AssistantMessageComponent({
		role: "assistant", content: [{ type: "text", text }], stopReason: "stop",
		api: "test", provider: "test", model: "test", timestamp: 0, ...options,
	}, true);
}
const longText = (prefix, length = 60) => Array.from({ length }, (_, n) => `${prefix}_${n}`).join("\n\n");
const mouse = (y, width = 80) => ({
	type: "click", button: "left", x: 3, y, screenX: 3, screenY: y,
	width, height: 30, shift: false, alt: false, ctrl: false,
});

async function withEnvironment(values, run) {
	const saved = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
	for (const [name, value] of Object.entries(values)) {
		if (value === undefined) delete process.env[name]; else process.env[name] = value;
	}
	try { return await run(); } finally {
		for (const [name, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[name]; else process.env[name] = value;
		}
	}
}

async function setup(mode = "tui", language = "zh") {
	const agentDir = mkdtempSync(resolve(tmpdir(), "pi-ui-plus-test-"));
	const entries = [];
	const runtime = createExtensionRuntime();
	runtime.appendEntry = (customType, data) => { entries.push({ type: "custom", customType, data }); };
	const { extensions, errors } = await withEnvironment({ PI_CODING_AGENT_DIR: agentDir, PI_UI_LANG: language },
		() => loadExtensions([pluginPath], dirname(pluginPath), undefined, runtime));
	assert.deepEqual(errors, []);
	const extension = extensions[0];
	const chat = new Container();
	const document = new Container();
	document.children = [new Container(), new Container(), chat];
	const editor = new Container();
	editor.children = [{ render: () => [], invalidate() {}, handleInput() {} }];
	const tui = {
		children: [document, new Container(), new Container(), new Container(), editor, new Container(), new Container()],
		terminal: { columns: 80, rows: 30 }, mode: "fullscreen", requestRender() {},
	};
	let widget;
	const overlays = [];
	const keys = new KeybindingsManager();
	const notifications = [];
	const ctx = {
		mode, hasUI: mode === "tui", sessionManager: { getBranch: () => entries },
		ui: {
			theme,
			addAutocompleteProvider() {},
			setWidget(_key, factory) { widget?.dispose(); widget = factory(tui, theme); },
			notify(message) { notifications.push(message); },
			custom(factory, options) {
				return new Promise((resolve, reject) => {
					const overlay = { options, panel: undefined, closed: false };
					overlays.push(overlay);
					const done = (result) => {
						if (overlay.closed) return;
						overlay.closed = true;
						overlay.panel?.dispose?.();
						resolve(result);
					};
					try { overlay.panel = factory(tui, theme, keys, done); } catch (error) { reject(error); }
				});
			},
		},
	};
	async function emit(type) {
		for (const handler of extension.handlers.get(type) ?? []) await handler({ type }, ctx);
	}
	await emit("session_start");
	const command = (args) => extension.commands.get("fold").handler(args, ctx);
	return { chat, tui, ctx, overlays, keys, notifications, entries, agentDir, command, emit,
		dispose: () => { widget?.dispose(); rmSync(agentDir, { recursive: true, force: true }); }, extension,
		text: (width = 80) => chat.render(width).join("\n") };
}

function tool(s, text, { name = "read", args = { path: "example.ts" }, error = false, partial = false, original } = {}) {
	const definition = s.extension.toolRenderers[0](name, () => original);
	const component = new ToolExecutionComponent(name, "call-1", args, {}, definition, s.tui, dirname(pluginPath));
	if (text !== undefined) component.updateResult({ content: [{ type: "text", text }], details: undefined, isError: error }, partial);
	return component;
}

function fill(s) {
	const user = new UserMessageComponent("检查并修复这个问题");
	const before = assistant("我先读取文件。", { content: [
		{ type: "text", text: "我先读取文件。" },
		{ type: "toolCall", id: "call-1", name: "read", arguments: { path: "example.ts" } },
	] });
	const output = tool(s, longText("OUTPUT", 2000));
	const final = assistant("修复完成，测试通过。");
	s.chat.children.push(user, before, output, final);
	return { user, before, output, final };
}

function oldReply(s, text = longText("OLD_REPLY"), options = {}) {
	const reply = assistant(text, options);
	s.chat.children.push(new UserMessageComponent("第一轮"), reply, new UserMessageComponent("第二轮"));
	return reply;
}

const key = { up: "\x1b[A", down: "\x1b[B", enter: "\r", escape: "\x1b", end: "\x1b[F", home: "\x1b[H", pageDown: "\x1b[6~" };
const strip = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");
const panelText = (overlay, width = 80) => strip(overlay.panel.render(width).join("\n"));

function choose(overlay, label) {
	for (let n = 0; n < 300; n++) {
		const selected = panelText(overlay).split("\n").find((line) => line.includes("→ "));
		if (selected?.includes(label)) { overlay.panel.handleInput(key.enter); return; }
		overlay.panel.handleInput(key.down);
	}
	throw new Error(`Cannot find panel item: ${label}`);
}

function toolLine(lines, marker = "▶") {
	return lines.findIndex((line) => line.includes(`─ ${marker} #`));
}

async function selectBlock(s, label) {
	label = label.replace("上一轮回复", "本轮最终回复");
	const promise = s.command("");
	const overlay = s.overlays.at(-1);
	for (let n = 0; n < 100; n++) {
		overlay.panel.handleInput(key.enter);
		if (panelText(overlay).includes(label)) { choose(overlay, label); break; }
		overlay.panel.handleInput(key.escape);
		overlay.panel.handleInput(key.down);
	}
	overlay.panel.handleInput(key.escape);
	overlay.panel.handleInput(key.escape);
	await promise;
}

test("closed tools skip large output rendering while assistant commentary stays visible and messages stay intact", async () => {
	const s = await setup();
	const { before, output } = fill(s);
	const children = [...s.chat.children];
	const message = JSON.stringify(before.lastMessage);
	const result = JSON.stringify(output.result);
	const args = JSON.stringify(output.args);
	let calls = 0;
	const original = output.render;
	output.render = function (width) { calls++; return original.call(this, width); };
	const text = s.text();
	assert.match(text, /read.*example\.ts.*完成/);
	assert.match(text, /我先读取文件/);
	assert.match(text, /修复完成/);
	assert.doesNotMatch(text, /OUTPUT_1999|执行过程/);
	assert.equal(calls, 0);
	assert.deepEqual(s.chat.children, children);
	assert.equal(JSON.stringify(before.lastMessage), message);
	assert.equal(JSON.stringify(output.result), result);
	assert.equal(JSON.stringify(output.args), args);
	await s.command("expand");
	assert.match(s.text(), /OUTPUT_1999/);
	assert.ok(calls > 0);
	s.dispose();
});

test("tools have separate toggles for their arguments and results", async () => {
	const s = await setup();
	const first = tool(s, "FIRST_OUTPUT", { name: "write", args: { path: "first.ts", content: longText("FIRST_ARG") } });
	const second = tool(s, "SECOND_OUTPUT", { name: "bash", args: { command: "run-tests", script: longText("SECOND_ARG") } });
	s.chat.children.push(first, second);
	let lines = s.chat.render(80);
	assert.equal(lines.filter((line) => /─ ▶ #\d/.test(line)).length, 2);
	assert.doesNotMatch(lines.join("\n"), /FIRST_OUTPUT|SECOND_OUTPUT|FIRST_ARG_59|SECOND_ARG_59/);
	assert.ok(s.chat.handleMouse(mouse(toolLine(lines)))?.handled);
	assert.match(s.text(), /FIRST_OUTPUT/);
	assert.match(s.text(4000), /FIRST_ARG_59/);
	assert.doesNotMatch(s.text(), /SECOND_OUTPUT|SECOND_ARG_59/);
	await s.extension.shortcuts.get("alt+o").handler(s.ctx);
	assert.match(s.text(), /SECOND_OUTPUT/);
	assert.match(s.text(4000), /SECOND_ARG_59/);
	s.dispose();
});

test("native tool expansion and pi-ui-plus use the same state", async () => {
	const s = await setup();
	const { output } = fill(s);
	assert.equal(output.expanded, false);
	output.setExpanded(true); // The method Pi's Ctrl+O uses.
	assert.match(s.text(), /OUTPUT_1999/);
	await s.command("collapse");
	assert.equal(output.expanded, false);
	assert.doesNotMatch(s.text(), /OUTPUT_1999/);
	output.setExpanded(true);
	const lines = s.chat.render(80);
	assert.ok(s.chat.handleMouse(mouse(toolLine(lines, "▼")))?.handled);
	assert.equal(output.expanded, false);
	s.dispose();
});

test("long user inputs and the current long reply always render in full", async () => {
	const s = await setup();
	const user = new UserMessageComponent(longText("LONG_INPUT", 200));
	const reply = assistant(longText("CURRENT_REPLY", 200));
	s.chat.children.push(user, reply);
	for (const action of ["collapse", "expand", "latest", "off", "on"]) {
		await s.command(action);
		assert.match(s.text(), /LONG_INPUT_199/);
		assert.match(s.text(), /CURRENT_REPLY_199/);
		assert.doesNotMatch(s.text(), /上一轮回复|长回复|长输入/);
	}
	const promise = s.command("");
	const overlay = s.overlays.at(-1);
	assert.match(panelText(overlay), /LONG_INPUT_0/);
	assert.match(panelText(overlay), /当前 · 0 个工具/);
	overlay.panel.handleInput(key.enter);
	assert.match(panelText(overlay), /本轮暂无工具/);
	assert.doesNotMatch(panelText(overlay), /本轮最终回复/);
	overlay.panel.handleInput(key.escape);
	overlay.panel.handleInput(key.escape);
	await promise;
	s.dispose();
});

test("submitting a new user message folds the previous final reply immediately", async () => {
	const s = await setup();
	const final = assistant(longText("OLD_REPLY", 200));
	s.chat.children.push(new UserMessageComponent("第一轮"), final);
	assert.match(s.text(), /OLD_REPLY_199/);
	await s.command("expand");
	s.chat.children.push(new UserMessageComponent("下一条问题"));
	assert.match(s.text(), /上一轮回复/);
	assert.doesNotMatch(s.text(), /OLD_REPLY_199/);
	assert.match(s.text(), /下一条问题/);
	const current = assistant(longText("NEW_REPLY", 200));
	s.chat.children.push(current);
	await s.command("collapse");
	assert.match(s.text(), /NEW_REPLY_199/);
	assert.doesNotMatch(s.text(), /OLD_REPLY_199/);
	await selectBlock(s, "上一轮回复");
	assert.match(s.text(), /OLD_REPLY_199/);
	assert.equal(final.lastMessage.content[0].text, longText("OLD_REPLY", 200));
	s.dispose();
});

test("reply folding follows turn boundaries rather than a length threshold", async () => {
	const s = await setup();
	oldReply(s, "很短的上一轮答复");
	s.chat.children.push(assistant("最新答复"));
	assert.match(s.text(), /上一轮回复 · 很短的上一轮答复/);
	assert.match(s.text(), /最新答复/);
	assert.equal((s.text().match(/上一轮回复/g) ?? []).length, 1);
	s.dispose();
});

test("old replies keep one balanced prompt zone when collapsed or expanded", async () => {
	for (const thinking of [false, true]) {
		const s = await setup();
		oldReply(s, "", { content: [
			...(thinking ? [{ type: "thinking", thinking: "THOUGHT" }] : []),
			{ type: "text", text: longText("OLD") },
		] });
		for (const action of ["collapse", "expand", "collapse"]) {
			await s.command(action);
			const text = s.text();
			assert.equal((text.match(/\x1b\]133;A\x07/g) ?? []).length, 3);
			assert.equal((text.match(/\x1b\]133;B\x07/g) ?? []).length, 3);
		}
		s.dispose();
	}
});

test("older replies stay folded across later turns and manual expansion persists", async () => {
	const s = await setup();
	oldReply(s, longText("ROUND_ONE"));
	s.chat.children.push(assistant(longText("ROUND_TWO")), new UserMessageComponent("第三轮"), assistant(longText("ROUND_THREE")));
	assert.doesNotMatch(s.text(), /ROUND_ONE_59|ROUND_TWO_59/);
	assert.match(s.text(), /ROUND_THREE_59/);
	await selectBlock(s, "ROUND_ONE_0");
	assert.match(s.text(), /ROUND_ONE_59/);
	s.chat.children.push(new UserMessageComponent("第四轮"));
	assert.match(s.text(), /ROUND_ONE_59/);
	assert.doesNotMatch(s.text(), /ROUND_TWO_59|ROUND_THREE_59/);
	assert.equal((s.text().match(/上一轮回复/g) ?? []).length, 3);
	s.dispose();
});

test("queued input and commands do not make the current reply historical", async () => {
	const s = await setup();
	const reply = assistant(longText("CURRENT"));
	s.chat.children.push(new UserMessageComponent("已提交的问题"), reply);
	s.tui.children[1].addChild(new UserMessageComponent("尚未交给模型的排队消息"));
	await s.command("collapse");
	assert.match(s.text(), /CURRENT_59/);
	assert.doesNotMatch(s.text(), /上一轮回复/);
	s.dispose();
});

test("only the final reply folds while earlier model commentary remains visible", async () => {
	const s = await setup();
	s.chat.children.push(new UserMessageComponent("第一轮"), assistant("PRE_TOOL_COMMENTARY"));
	fill(s);
	s.chat.children.splice(2, 1); // Keep commentary and tools in the same user turn.
	s.chat.children.push(new UserMessageComponent("第二轮"), assistant("CURRENT_FINAL"));
	const text = s.text();
	assert.match(text, /PRE_TOOL_COMMENTARY/);
	assert.match(text, /我先读取文件/);
	assert.match(text, /上一轮回复 · 修复完成/);
	assert.match(text, /CURRENT_FINAL/);
	assert.doesNotMatch(text, /OUTPUT_1999|执行过程/);
	s.dispose();
});

test("streaming, failed, aborted and truncated replies stay visible", async () => {
	const s = await setup();
	const streaming = assistant(longText("STREAM"));
	streaming.updateContent(streaming.lastMessage, true);
	s.chat.children.push(new UserMessageComponent("第一轮"), streaming, new UserMessageComponent("第二轮"));
	assert.match(s.text(), /STREAM_59/);
	assert.doesNotMatch(s.text(), /上一轮回复/);
	for (const [reason, warning] of [["error", "Unknown error"], ["aborted", "Operation aborted"], ["length", "Response was truncated"]]) {
		s.chat.children.push(assistant(longText("FAILED"), { stopReason: reason }), new UserMessageComponent("下一轮"));
		assert.match(s.text(), /FAILED_59/);
		assert.match(s.text(), new RegExp(warning));
	}
	assert.doesNotMatch(s.text(), /上一轮回复/);
	s.dispose();
});

test("thinking remains independent when old reply text is folded", async () => {
	const s = await setup();
	const reply = oldReply(s, "", { content: [
		{ type: "thinking", thinking: longText("THINK", 40) },
		{ type: "text", text: longText("OLD_TEXT") },
	] });
	reply.setHideThinkingBlock(false);
	const original = JSON.stringify(reply.lastMessage);
	assert.match(s.text(), /THINK_39/);
	assert.doesNotMatch(s.text(), /OLD_TEXT_59/);
	for (const action of ["expand", "collapse", "latest", "off", "on"]) {
		await s.command(action);
		assert.match(s.text(), /THINK_39/);
		assert.equal(reply.hideThinkingBlock, false);
		assert.equal(reply.thinkingVisibilityOverrides.size, 0);
	}
	await s.command("collapse");
	reply.setHideThinkingBlock(true);
	let lines = s.chat.render(80);
	assert.match(lines.join("\n"), /Thinking\.\.\./);
	assert.doesNotMatch(lines.join("\n"), /THINK_39|OLD_TEXT_59/);
	assert.ok(s.chat.handleMouse(mouse(lines.findIndex((line) => line.includes("Thinking..."))))?.handled);
	assert.match(s.text(), /THINK_39/);
	assert.doesNotMatch(s.text(), /OLD_TEXT_59/);
	assert.equal(reply.thinkingVisibilityOverrides.get(0), false);
	await selectBlock(s, "上一轮回复");
	assert.match(s.text(), /OLD_TEXT_59/);
	reply.setHideThinkingBlock(true);
	assert.match(s.text(), /Thinking\.\.\./);
	assert.match(s.text(), /OLD_TEXT_59/);
	assert.equal(JSON.stringify(reply.lastMessage), original);
	s.dispose();
});

test("interleaved thinking keeps native order and all old text shares one reply toggle", async () => {
	const s = await setup();
	const reply = oldReply(s, "", { content: [
		{ type: "text", text: "SUMMARY\n\nTEXT_A_END" },
		{ type: "thinking", thinking: "THOUGHT_FIRST" },
		{ type: "thinking", thinking: "" },
		{ type: "text", text: "TEXT_B_END" },
		{ type: "thinking", thinking: "THOUGHT_SECOND" },
		{ type: "text", text: "TEXT_C_END" },
	] });
	reply.setHideThinkingBlock(false);
	const children = [...reply.contentContainer.children];
	let text = s.text();
	assert.match(text, /THOUGHT_FIRST/);
	assert.match(text, /THOUGHT_SECOND/);
	assert.doesNotMatch(text, /TEXT_A_END|TEXT_B_END|TEXT_C_END/);
	assert.equal((text.match(/上一轮回复/g) ?? []).length, 1);
	await s.command("expand");
	text = s.text();
	const ordered = ["TEXT_A_END", "THOUGHT_FIRST", "TEXT_B_END", "THOUGHT_SECOND", "TEXT_C_END"];
	for (let i = 1; i < ordered.length; i++) assert.ok(text.indexOf(ordered[i - 1]) < text.indexOf(ordered[i]));
	assert.equal(text.match(/THOUGHT_FIRST/g).length, 1);
	assert.deepEqual(reply.contentContainer.children, children);
	await s.command("collapse");
	assert.doesNotMatch(s.text(), /TEXT_A_END|TEXT_B_END|TEXT_C_END/);
	s.dispose();
});

test("current mixed replies and thinking-only messages use native rendering unchanged", async () => {
	const s = await setup();
	for (const text of ["", longText("CURRENT_TEXT")]) {
		const reply = assistant("", { content: [
			{ type: "thinking", thinking: longText("THINK_ONLY") },
			...(text ? [{ type: "text", text }] : []),
		] });
		reply.setHideThinkingBlock(false);
		s.chat.children = [reply];
		assert.deepEqual(s.chat.render(80), reply.render(80));
		await s.command("collapse");
		assert.deepEqual(s.chat.render(80), reply.render(80));
		if (!text) {
			s.chat.children.push(new UserMessageComponent("下一轮"));
			assert.doesNotMatch(s.text(), /上一轮回复/);
		}
	}
	s.dispose();
});

test("unknown old thinking layouts pass through instead of hiding thinking", async () => {
	const s = await setup();
	const reply = oldReply(s, "", { content: [
		{ type: "thinking", thinking: "UNRECOGNIZED_THINKING" },
		{ type: "text", text: longText("UNRECOGNIZED_TEXT") },
	] });
	reply.setHideThinkingBlock(false);
	reply.contentContainer = undefined;
	assert.match(s.text(), /UNRECOGNIZED_THINKING/);
	assert.match(s.text(), /UNRECOGNIZED_TEXT_59/);
	assert.doesNotMatch(s.text(), /上一轮回复/);
	s.dispose();
});

test("closed partial tools skip original argument formatting and result rendering", async () => {
	const s = await setup();
	let calls = 0, results = 0;
	const original = {
		renderCall(args) { calls++; return new Text(args.content, 0, 0); },
		renderResult(result) { results++; return new Text(result.content[0].text, 0, 0); },
	};
	const output = tool(s, undefined, { name: "write", args: { path: "large.ts", content: longText("WRITE_ARG", 1000) }, original });
	s.chat.children.push(output);
	for (let n = 0; n < 4; n++) {
		output.updateArgs({ path: "large.ts", content: longText("WRITE_ARG", 1000 + n) });
		output.updateResult({ content: [{ type: "text", text: longText("PARTIAL_RESULT", 1000) }], isError: false }, true);
		assert.doesNotMatch(s.text(), /WRITE_ARG_999|PARTIAL_RESULT_999/);
	}
	assert.equal(calls, 0);
	assert.equal(results, 0);
	await s.command("expand");
	assert.match(s.text(), /WRITE_ARG_1002/);
	assert.match(s.text(), /PARTIAL_RESULT_999/);
	assert.equal(calls, 1);
	assert.equal(results, 1);
	await s.command("collapse");
	output.updateArgs({ path: "large.ts", content: "CLOSED_AGAIN" });
	assert.equal(calls, 1);
	assert.equal(results, 1);
	await s.command("off");
	assert.ok(calls > 1);
	assert.match(s.text(), /CLOSED_AGAIN/);
	s.dispose();
});

test("pending and failed tools retain status and bounded error previews", async () => {
	const s = await setup();
	const failed = tool(s, `Error: permission denied\n${longText("FAILURE_BODY", 2000)}`, { error: true });
	const pending = tool(s, undefined, { name: "bash", args: { command: "run-tests" } });
	pending.markExecutionStarted();
	s.chat.children.push(failed, pending);
	assert.match(s.text(), /read.*失败/);
	assert.match(s.text(), /permission denied/);
	assert.match(s.text(), /bash.*run-tests.*运行中/);
	assert.doesNotMatch(s.text(), /FAILURE_BODY_1999/);
	pending.updateResult({ content: [{ type: "text", text: "done" }], isError: false, durationMs: 123 });
	assert.match(s.text(), /bash.* · 123 ms · run-tests · 完成/);
	s.dispose();
});

test("new tools and newly historical replies start closed after expanding existing blocks", async () => {
	const s = await setup();
	const { output } = fill(s);
	await s.command("expand");
	assert.equal(output.expanded, true);
	s.chat.children.push(new UserMessageComponent("下一轮"));
	const nextTool = tool(s, "NEW_TOOL_OUTPUT");
	s.chat.children.push(nextTool, assistant("CURRENT_FINAL"));
	assert.equal(nextTool.expanded, false);
	assert.doesNotMatch(s.text(), /NEW_TOOL_OUTPUT/);
	assert.match(s.text(), /上一轮回复/);
	assert.match(s.text(), /CURRENT_FINAL/);
	s.dispose();
});

test("narrow widths, Chinese, emoji and resizing fit within terminal columns", async () => {
	const s = await setup();
	oldReply(s, "中文 👩‍💻 é\n\n".repeat(60));
	s.chat.children.push(tool(s, "工具结果", { args: { path: "很长的路径/👩‍💻/文件.ts" } }), assistant("最新回复"));
	for (const width of [8, 16, 40, 120, 16]) {
		for (const line of s.chat.render(width)) assert.ok(visibleWidth(line) <= width, `${visibleWidth(line)} > ${width}`);
	}
	s.dispose();
});

test("off and unloading restore native rendering, caches and method ownership", async () => {
	const s = await setup();
	fill(s);
	oldReply(s);
	await s.command("off");
	assert.deepEqual(s.chat.render(80), Container.prototype.render.call(s.chat, 80));
	assert.match(s.text(), /OUTPUT_1999|OLD_REPLY_59/);
	await s.command("on");
	assert.doesNotMatch(s.text(), /OUTPUT_1999|OLD_REPLY_59/);
	s.dispose();
	s.dispose();
	assert.equal(Object.hasOwn(s.chat, "render"), false);
	assert.equal(Object.hasOwn(s.chat, "handleMouse"), false);
	assert.match(s.text(), /OLD_REPLY_59/);
});

test("unloading leaves a later extension wrapper intact and disables its retained fold hook", async () => {
	const s = await setup();
	oldReply(s);
	const retained = s.chat.render;
	const wrapper = (width) => retained(width);
	s.chat.render = wrapper;
	s.dispose();
	assert.equal(s.chat.render, wrapper);
	assert.match(s.text(), /OLD_REPLY_59/);
	assert.doesNotMatch(s.text(), /上一轮回复/);
});

test("branch navigation restores a reply that becomes current and resets old reply state", async () => {
	const s = await setup();
	const reply = oldReply(s);
	assert.doesNotMatch(s.text(), /OLD_REPLY_59/);
	s.chat.children.pop();
	await s.emit("session_tree");
	assert.match(s.text(), /OLD_REPLY_59/);
	assert.doesNotMatch(s.text(), /上一轮回复/);
	s.chat.children.push(new UserMessageComponent("重新开始下一轮"));
	assert.match(s.text(), /#1.*上一轮回复/);
	assert.equal(reply.lastMessage.content[0].text, longText("OLD_REPLY"));
	s.chat.clear();
	assert.deepEqual(s.chat.render(80), []);
	await s.emit("session_shutdown");
	assert.equal(Object.hasOwn(s.chat, "render"), false);
});

test("reload reattaches while the editor is empty and closes historical replies again", async () => {
	const s = await setup();
	oldReply(s);
	await s.command("expand");
	s.tui.children[4].clear();
	await s.emit("session_start");
	assert.deepEqual(s.notifications, []);
	assert.match(s.text(), /上一轮回复/);
	assert.doesNotMatch(s.text(), /OLD_REPLY_59/);
	s.dispose();
	assert.equal(Object.hasOwn(s.chat, "render"), false);
});

test("noninteractive modes do not fold replies or replace native tool formatting", async () => {
	for (const mode of ["print", "json", "rpc"]) {
		const s = await setup(mode);
		let calls = 0;
		const output = tool(s, "OUTPUT", { original: { renderCall() { calls++; return new Text("ORIGINAL_FORMATTER", 0, 0); } } });
		s.chat.children.push(output);
		oldReply(s);
		assert.ok(calls > 0);
		assert.equal(Object.hasOwn(s.chat, "render"), false);
		assert.match(s.text(), /ORIGINAL_FORMATTER/);
		assert.match(s.text(), /OLD_REPLY_59/);
		await s.command("expand");
		assert.deepEqual(s.notifications, []);
	}
});

function openPanel(s) {
	const promise = s.command("");
	return { overlay: s.overlays.at(-1), promise };
}

async function closePanel(overlay, promise) {
	if (/工具调用|Tool calls/.test(panelText(overlay))) overlay.panel.handleInput(key.escape);
	overlay.panel.handleInput(key.escape);
	await promise;
	assert.equal(overlay.closed, true);
}

test("overlay opens on chats, navigates in place, and closes with two-level Escape", async () => {
	const s = await setup();
	fill(s);
	s.chat.children.push(new UserMessageComponent("第二轮"), tool(s, "ROUND_TWO_OUTPUT"), assistant("最新回复"));
	const { overlay, promise } = openPanel(s);
	assert.equal(overlay.options.overlay, true);
	assert.equal(overlay.options.overlayOptions.anchor, "center");
	let text = panelText(overlay);
	assert.match(text, /┌.*\/fold · 选择对话/);
	assert.match(text, /“第二轮” · 当前 · 1 个工具 · 全部收起/);
	assert.match(text, /“检查并修复这个问题” · 1 个工具 · 全部收起/);
	assert.ok(text.indexOf("第二轮") < text.indexOf("检查并修复"));
	choose(overlay, "检查并修复");
	text = panelText(overlay);
	assert.match(text, /“检查并修复这个问题” · 工具调用/);
	assert.match(text, /本轮最终回复/);
	choose(overlay, "read");
	assert.equal(overlay.closed, false);
	assert.match(panelText(overlay), /▼ read/);
	assert.match(s.text(), /OUTPUT_1999/);
	overlay.panel.handleInput(key.escape);
	assert.equal(overlay.closed, false);
	text = panelText(overlay);
	assert.match(text, /→ “检查并修复这个问题” · 1 个工具 · 全部展开/);
	overlay.panel.handleInput(key.escape);
	await promise;
	assert.equal(overlay.closed, true);
	s.dispose();
});

test("chat panel offers individual toggles and reports combined tool state without bulk actions", async () => {
	const s = await setup();
	const first = tool(s, "FIRST_OUTPUT", { args: { path: "first.ts" } });
	const second = tool(s, "SECOND_OUTPUT", { args: { path: "second.ts" } });
	const other = tool(s, "OTHER_TURN_OUTPUT", { args: { path: "other.ts" } });
	s.chat.children.push(new UserMessageComponent("第一轮"), first, second, assistant(longText("OLD")),
		new UserMessageComponent("第二轮"), other, assistant(longText("CURRENT")));
	const { overlay, promise } = openPanel(s);
	choose(overlay, "第一轮");
	choose(overlay, "first.ts");
	overlay.panel.handleInput(key.escape);
	assert.match(panelText(overlay), /“第一轮” · 2 个工具 · 部分展开/);
	choose(overlay, "第一轮");
	assert.doesNotMatch(panelText(overlay), /本轮工具全部展开|本轮工具全部收起/);
	choose(overlay, "second.ts");
	assert.equal(first.expanded, true);
	assert.equal(second.expanded, true);
	assert.equal(other.expanded, false);
	assert.equal(overlay.closed, false);
	assert.doesNotMatch(s.text(), /OLD_59|OTHER_TURN_OUTPUT/);
	assert.match(s.text(), /CURRENT_59/);
	overlay.panel.handleInput(key.escape);
	assert.match(panelText(overlay), /“第一轮” · 2 个工具 · 全部展开/);
	choose(overlay, "第一轮");
	choose(overlay, "本轮最终回复");
	assert.match(s.text(), /OLD_59/);
	choose(overlay, "first.ts");
	choose(overlay, "second.ts");
	assert.equal(first.expanded, false);
	assert.equal(second.expanded, false);
	assert.match(s.text(), /OLD_59/);
	assert.match(s.text(), /CURRENT_59/);
	overlay.panel.handleInput(key.escape);
	assert.match(panelText(overlay), /“第一轮” · 2 个工具 · 全部收起/);
	await closePanel(overlay, promise);
	s.dispose();
});

test("current turn has no reply toggle and an empty conversation has a closable panel", async () => {
	const s = await setup();
	let session = openPanel(s);
	assert.match(panelText(session.overlay), /暂无对话/);
	await closePanel(session.overlay, session.promise);
	s.chat.children.push(new UserMessageComponent("当前问题"), assistant(longText("CURRENT")));
	session = openPanel(s);
	choose(session.overlay, "当前问题");
	assert.match(panelText(session.overlay), /本轮暂无工具/);
	assert.doesNotMatch(panelText(session.overlay), /本轮最终回复|工具全部/);
	await closePanel(session.overlay, session.promise);
	assert.match(s.text(), /CURRENT_59/);
	s.dispose();
});

test("opening the panel does not render large tools or replies and keeps terminal viewport untouched", async () => {
	const s = await setup();
	const { output, final } = fill(s);
	s.chat.children.push(new UserMessageComponent("下一轮"));
	let calls = 0;
	for (const component of [output, final]) {
		const original = component.render;
		component.render = function (width) { calls++; return original.call(this, width); };
	}
	let scrollCalls = 0;
	s.tui.viewportTop = 70;
	s.tui.isFollowingOutput = false;
	s.tui.scrollBy = () => { scrollCalls++; };
	const { overlay, promise } = openPanel(s);
	panelText(overlay);
	choose(overlay, "检查并修复");
	panelText(overlay);
	await closePanel(overlay, promise);
	assert.equal(calls, 0);
	assert.equal(s.tui.viewportTop, 70);
	assert.equal(s.tui.isFollowingOutput, false);
	assert.equal(scrollCalls, 0);
	s.dispose();
});

test("mouse clicks and wheel input stay within the overlay and maintain its open state", async () => {
	const s = await setup();
	fill(s);
	const { overlay, promise } = openPanel(s);
	panelText(overlay);
	assert.ok(overlay.panel.handleMouse(mouse(4))?.handled);
	assert.match(panelText(overlay), /工具调用/);
	assert.ok(overlay.panel.handleMouse({ ...mouse(4), type: "press" })?.handled);
	panelText(overlay);
	assert.ok(overlay.panel.handleMouse(mouse(4))?.handled);
	assert.match(s.text(), /OUTPUT_1999/);
	assert.equal(overlay.closed, false);
	assert.ok(overlay.panel.handleMouse({ ...mouse(4), type: "wheel", wheelDelta: 1 })?.handled);
	assert.match(panelText(overlay).split("\n").find((line) => line.includes("→ ")), /← 返回对话列表/);
	await closePanel(overlay, promise);
	s.dispose();
});

test("long chat and tool lists scroll and resize within the overlay bounds", async () => {
	const s = await setup();
	for (let n = 1; n <= 50; n++) s.chat.children.push(new UserMessageComponent(`第${n}轮`), assistant("回复"));
	for (let n = 0; n < 40; n++) s.chat.children.push(tool(s, "输出", { args: { path: `中文/👩‍💻/文件${n}.ts` } }));
	const { overlay, promise } = openPanel(s);
	assert.match(panelText(overlay), /1\/50/);
	overlay.panel.handleInput(key.pageDown);
	assert.match(panelText(overlay), /14\/50/);
	overlay.panel.handleInput(key.end);
	assert.match(panelText(overlay), /→ “第1轮”/);
	overlay.panel.handleInput(key.home);
	overlay.panel.handleInput(key.enter);
	assert.match(panelText(overlay), /“第50轮” · 工具调用/);
	overlay.panel.handleInput(key.end);
	assert.match(panelText(overlay), /→ ← 返回对话列表/);
	for (const [width, rows] of [[8, 8], [20, 12], [80, 30], [120, 45], [16, 8]]) {
		s.tui.terminal.rows = rows;
		overlay.panel.invalidate();
		const lines = overlay.panel.render(width);
		assert.ok(lines.length <= Math.min(20, rows - 4));
		assert.ok(strip(lines.at(-1)).endsWith("┘"));
		for (const line of lines) assert.ok(visibleWidth(line) <= width, `${visibleWidth(line)} > ${width}`);
	}
	await closePanel(overlay, promise);
	s.dispose();
});

test("native expansion and live tool updates appear in the open panel without losing selection", async () => {
	const s = await setup();
	const { output } = fill(s);
	const { overlay, promise } = openPanel(s);
	choose(overlay, "检查并修复");
	output.setExpanded(true);
	assert.match(panelText(overlay), /→ ▼ read/);
	const added = tool(s, "SECOND_OUTPUT", { args: { path: "second.ts" } });
	s.chat.children.push(added);
	assert.match(panelText(overlay), /second.ts/);
	assert.match(panelText(overlay), /→ ▼ read/);
	added.updateResult({ content: [{ type: "text", text: "Error: fixture failed" }], isError: true });
	assert.match(panelText(overlay), /second\.ts · 失败/);
	overlay.panel.handleInput(key.escape);
	assert.match(panelText(overlay), /2 个工具 · 部分展开/);
	await closePanel(overlay, promise);
	s.dispose();
});

test("panel honors configured selection keys and Ctrl+C closes from either level", async () => {
	const s = await setup();
	fill(s);
	s.keys.setUserBindings({ "tui.select.confirm": "f2", "tui.select.down": "f3" });
	const { overlay, promise } = openPanel(s);
	overlay.panel.handleInput("\x1bOQ"); // F2 enters the chat.
	assert.match(panelText(overlay), /工具调用/);
	overlay.panel.handleInput("\x1bOR"); // F3 selects the back action.
	assert.match(panelText(overlay).split("\n").find((line) => line.includes("→ ")), /← 返回对话列表/);
	overlay.panel.handleInput("\x03");
	await promise;
	assert.equal(overlay.closed, true);
	s.dispose();
});

test("reload, branch navigation and unloading close active panels without hanging their commands", async () => {
	for (const event of ["session_start", "session_tree", "session_shutdown", "dispose"]) {
		const s = await setup();
		fill(s);
		const { overlay, promise } = openPanel(s);
		choose(overlay, "检查并修复");
		if (event === "dispose") s.dispose(); else await s.emit(event);
		await promise;
		assert.equal(overlay.closed, true);
		if (event !== "dispose") s.dispose();
	}
});

test("language switches inside the same floating panel and preserves all expansion and thinking state", async () => {
	const s = await setup();
	const { output } = fill(s);
	const reply = assistant("", { content: [
		{ type: "thinking", thinking: "NATIVE_THINKING" },
		{ type: "text", text: "KEEP_THIS_TEXT\n\nUNCHANGED_TAIL" },
	] });
	reply.setHideThinkingBlock(false);
	s.chat.children.push(reply, new UserMessageComponent("中文问题保持原样"), assistant("CURRENT_REPLY"));
	const before = JSON.stringify(reply.lastMessage);
	const { overlay, promise } = openPanel(s);
	choose(overlay, "检查并修复");
	choose(overlay, "read");
	choose(overlay, "本轮最终回复");
	overlay.panel.handleInput(key.escape);
	assert.match(panelText(overlay), /l English/);
	overlay.panel.handleInput("l");
	assert.equal(overlay.closed, false);
	assert.match(panelText(overlay), /\/fold · Choose a chat/);
	assert.match(panelText(overlay), /l 简体中文/);
	assert.doesNotMatch(panelText(overlay), /界面语言|选择|切换|返回/);
	assert.match(panelText(overlay), /“检查并修复这个问题” · 1 tool · All expanded/);
	choose(overlay, "检查并修复");
	const english = panelText(overlay);
	assert.match(english, /Tool calls/);
	assert.match(english, /l 简体中文/);
	assert.match(english, /read.*Done/);
	assert.match(english, /Final reply · KEEP_THIS_TEXT/);
	assert.match(english, /Back to chats/);
	assert.doesNotMatch(english, /本轮|回复|完成|展开|收起|工具全部/);
	assert.match(s.text(), /NATIVE_THINKING|UNCHANGED_TAIL|中文问题保持原样/);
	assert.equal(output.expanded, true);
	assert.equal(reply.hideThinkingBlock, false);
	assert.equal(reply.thinkingVisibilityOverrides.size, 0);
	assert.equal(JSON.stringify(reply.lastMessage), before);
	overlay.panel.handleInput("l");
	assert.match(panelText(overlay), /工具调用/);
	assert.match(panelText(overlay), /l English/);
	assert.equal(overlay.closed, false);
	overlay.panel.handleInput(key.escape);
	assert.match(panelText(overlay), /“检查并修复这个问题” · 1 个工具 · 全部展开/);
	await closePanel(overlay, promise);
	assert.deepEqual([...s.extension.commands.keys()], ["fold"]);
	assert.match(s.text(), /UNCHANGED_TAIL/);
	s.dispose();
});

test("automatic language honors system locale precedence with English fallback", async () => {
	for (const [env, title] of [
		[{ LANG: "zh_CN.UTF-8" }, "选择对话"],
		[{ LANG: "zh-TW" }, "选择对话"],
		[{ LANG: "zh_CN.UTF-8", LC_MESSAGES: "en_US.UTF-8" }, "Choose a chat"],
		[{ LANG: "en_US.UTF-8", LC_MESSAGES: "en_US.UTF-8", LC_ALL: "zh_HK.UTF-8" }, "选择对话"],
		[{ LANG: "zh_CN.UTF-8", LC_ALL: "C" }, "Choose a chat"],
		[{ LANG: "ja_JP.UTF-8" }, "Choose a chat"],
	]) {
		const s = await withEnvironment({ LANG: undefined, LC_MESSAGES: undefined, LC_ALL: undefined, ...env }, () => setup("tui", "auto"));
		const { overlay, promise } = openPanel(s);
		assert.match(panelText(overlay), new RegExp(title));
		overlay.panel.handleInput(key.escape);
		await promise;
		s.dispose();
	}
});

test("explicit environment language overrides detection and l toggles only Chinese and English", async () => {
	const s = await withEnvironment({ LANG: "zh_CN.UTF-8", LC_MESSAGES: undefined, LC_ALL: undefined }, () => setup("tui", "en"));
	const { overlay, promise } = openPanel(s);
	assert.match(panelText(overlay), /Choose a chat/);
	overlay.panel.handleInput("l");
	assert.match(panelText(overlay), /选择对话/);
	overlay.panel.handleInput("l");
	assert.match(panelText(overlay), /Choose a chat/);
	assert.doesNotMatch(panelText(overlay), /Interface language|界面语言|Automatic|自动/);
	await closePanel(overlay, promise);
	const invalid = await withEnvironment({ LANG: "en_US.UTF-8", LC_MESSAGES: undefined, LC_ALL: undefined }, () => setup("tui", "invalid-locale"));
	const fallback = openPanel(invalid);
	assert.match(panelText(fallback.overlay), /Choose a chat/);
	await closePanel(fallback.overlay, fallback.promise);
	invalid.dispose();
	s.dispose();
});

test("language choice persists as a global UI preference across reload and new sessions", async () => {
	const s = await setup();
	let opened = openPanel(s);
	opened.overlay.panel.handleInput("l");
	assert.deepEqual(s.entries, []);
	assert.deepEqual(JSON.parse(readFileSync(resolve(s.agentDir, "ui-language.json"), "utf8")), { language: "en" });
	await closePanel(opened.overlay, opened.promise);
	await s.emit("session_start");
	opened = openPanel(s);
	assert.match(panelText(opened.overlay), /Choose a chat/);
	await closePanel(opened.overlay, opened.promise);
	s.entries.length = 0;
	await s.emit("session_start");
	opened = openPanel(s);
	assert.match(panelText(opened.overlay), /Choose a chat/);
	await closePanel(opened.overlay, opened.promise);
	s.dispose();
});

test("English labels cover tool statuses, errors, notifications and narrow panels without per-turn bulk actions", async () => {
	const s = await setup("tui", "en");
	const pending = tool(s, undefined, { name: "bash", args: { command: "run-fixture" } });
	const failed = tool(s, "", { error: true });
	s.chat.children.push(new UserMessageComponent("QUESTION"), pending, failed);
	assert.match(strip(s.text()), /bash.*Preparing/);
	assert.match(strip(s.text()), /read.*Failed/);
	assert.match(strip(s.text()), /Tool execution failed/);
	pending.markExecutionStarted();
	assert.match(strip(s.text()), /bash.*Running/);
	pending.updateResult({ content: [{ type: "text", text: "RAW_TOOL_TEXT" }], isError: false, durationMs: 23 });
	assert.match(strip(s.text()), /bash · 23 ms · run-fixture · Done/);
	const { overlay, promise } = openPanel(s);
	choose(overlay, "QUESTION");
	assert.doesNotMatch(panelText(overlay), /Expand all|Collapse all|本轮工具全部/);
	for (const [width, rows] of [[10, 8], [25, 12], [80, 30]]) {
		s.tui.terminal.rows = rows;
		for (const line of overlay.panel.render(width)) assert.ok(visibleWidth(line) <= width);
	}
	await closePanel(overlay, promise);
	await s.command("bad-action");
	assert.match(s.notifications.at(-1), /^Usage:/);
	assert.doesNotMatch(s.notifications.at(-1), /lang/);
	s.dispose();
	s.tui.children = [];
	await s.emit("session_start");
	assert.match(s.notifications.at(-1), /incompatible/);
	await s.command("latest");
	assert.match(s.notifications.at(-1), /not attached/);
	s.dispose();
});

test("unknown host layouts retain native display", async () => {
	const s = await setup();
	s.dispose();
	s.tui.children = [];
	await s.emit("session_start");
	assert.equal(Object.hasOwn(s.chat, "render"), false);
	assert.match(s.notifications[0], /不兼容/);
	s.dispose();
});

function manyReplies(s, count) {
	const replies = [];
	for (let n = 1; n <= count; n++) {
		s.chat.children.push(new UserMessageComponent(`问题${n}`), assistant(longText(`REPLY_${n}`, 3)));
		replies.push(s.chat.children.at(-1));
	}
	return replies;
}

test("the batch shortcut progressively expands and collapses the most recent replies", async () => {
	const s = await setup();
	const replies = manyReplies(s, 6);
	const replyCount = (text) => (text.match(/上一轮回复/g) ?? []).length;
	assert.equal(replyCount(s.text()), 5);
	assert.doesNotMatch(s.text(), /REPLY_[1-5]_2/);
	const recent = s.extension.shortcuts.get("alt+shift+o");
	assert.ok(recent);
	await recent.handler(s.ctx);
	// Newest three replies (5, 4, 3) expand; the two oldest stay folded.
	assert.match(s.text(), /REPLY_5_2/);
	assert.match(s.text(), /REPLY_4_2/);
	assert.match(s.text(), /REPLY_3_2/);
	assert.doesNotMatch(s.text(), /REPLY_2_2|REPLY_1_2/);
	await recent.handler(s.ctx);
	// The remaining collapsed replies (2, 1) expand on the next press.
	assert.match(s.text(), /REPLY_2_2/);
	assert.match(s.text(), /REPLY_1_2/);
	await recent.handler(s.ctx);
	// Everything is expanded, so the next press collapses the newest three.
	assert.doesNotMatch(s.text(), /REPLY_5_2|REPLY_4_2|REPLY_3_2/);
	assert.match(s.text(), /REPLY_2_2|REPLY_1_2/);
	assert.equal(replies.at(-1).lastMessage.content[0].text, longText("REPLY_6", 3));
	s.dispose();
});

test("the /fold recent command expands a given count and can collapse all replies", async () => {
	const s = await setup();
	manyReplies(s, 6);
	await s.command("recent 2");
	assert.match(s.text(), /REPLY_5_2/);
	assert.match(s.text(), /REPLY_4_2/);
	assert.doesNotMatch(s.text(), /REPLY_3_2|REPLY_2_2|REPLY_1_2/);
	await s.command("recent off");
	assert.doesNotMatch(s.text(), /REPLY_[1-5]_2/);
	assert.equal((s.text().match(/上一轮回复/g) ?? []).length, 5);
	s.dispose();
});

test("the settings tab cycles reply folding, batch size, notifications and sound", async () => {
	const s = await setup();
	const settingsPath = resolve(s.agentDir, "pi-ui-plus.json");
	const { overlay, promise } = openPanel(s);
	overlay.panel.handleInput("\t");
	let text = panelText(overlay);
	assert.match(text, /\[设置\]/);
	assert.match(text, /上一轮回复.*折叠/s);
	assert.match(text, /批量展开条数.*最近 3 条/s);
	assert.match(text, /完成通知.*自动（仅 TUI）/s);
	assert.match(text, /通知声音.*开启/s);
	assert.match(text, /界面语言.*简体中文/s);
	// Enter cycles the selected setting (previous replies on -> off).
	overlay.panel.handleInput(key.enter);
	assert.deepEqual(JSON.parse(readFileSync(settingsPath, "utf8")), { foldReplies: false, recentCount: 3, notify: "auto", notifySound: true });
	// Arrow down + right cycles the batch size to 4.
	overlay.panel.handleInput(key.down);
	overlay.panel.handleInput("\x1b[C");
	assert.equal(JSON.parse(readFileSync(settingsPath, "utf8")).recentCount, 4);
	overlay.panel.handleInput(key.down);
	overlay.panel.handleInput(key.enter);
	assert.equal(JSON.parse(readFileSync(settingsPath, "utf8")).notify, "on");
	overlay.panel.handleInput(key.down);
	overlay.panel.handleInput(key.enter);
	assert.equal(JSON.parse(readFileSync(settingsPath, "utf8")).notifySound, false);
	overlay.panel.handleInput("\x1b");
	await promise;
	s.dispose();
});

test("disabling previous-reply folding keeps historical replies visible and restores on reload", async () => {
	const s = await setup();
	const reply = oldReply(s);
	assert.match(s.text(), /上一轮回复/);
	assert.doesNotMatch(s.text(), /OLD_REPLY_59/);
	writeFileSync(resolve(s.agentDir, "pi-ui-plus.json"), JSON.stringify({ foldReplies: false, recentCount: 3, notify: "auto", notifySound: true }));
	await s.emit("session_start");
	assert.doesNotMatch(s.text(), /上一轮回复/);
	assert.match(s.text(), /OLD_REPLY_59/);
	writeFileSync(resolve(s.agentDir, "pi-ui-plus.json"), JSON.stringify({ foldReplies: true, recentCount: 3, notify: "auto", notifySound: true }));
	await s.emit("session_start");
	assert.match(s.text(), /上一轮回复/);
	assert.doesNotMatch(s.text(), /OLD_REPLY_59/);
	assert.equal(reply.lastMessage.content[0].text, longText("OLD_REPLY"));
	s.dispose();
});

test("the reply order puts the final reply first and drops all expand action labels", async () => {
	const s = await setup();
	fill(s);
	s.chat.children.push(new UserMessageComponent("下一轮"));
	const { overlay, promise } = openPanel(s);
	choose(overlay, "检查并修复");
	const lines = panelText(overlay).split("\n");
	const reply = lines.findIndex((line) => line.includes("本轮最终回复"));
	const firstTool = lines.findIndex((line) => line.includes("read"));
	assert.ok(reply >= 0 && firstTool >= 0 && reply < firstTool, "final reply must precede tools");
	assert.doesNotMatch(panelText(overlay), /\[展开\]|\[收起\]|\[Expand\]|\[Collapse\]/);
	assert.doesNotMatch(s.text(), /\[展开\]|\[收起\]/);
	overlay.panel.handleInput(key.escape);
	overlay.panel.handleInput(key.escape);
	await promise;
	s.dispose();
});
