import type { ExtensionContext, KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import { Container, MouseRegion, SelectList, matchesKey, truncateToWidth, visibleWidth, type Component, type SelectItem, type TUI, type TuiMouseEvent } from "@earendil-works/pi-tui";
import type { Language, LanguageStore } from "./language.js";

type Content = { type: string; text?: string; thinking?: string };
type ChatComponent = Component & {
	children?: Component[];
	contentContainer?: Container;
	hasToolCalls?: boolean;
	isStreaming?: boolean;
	lastMessage?: { stopReason?: string; content?: Content[] };
	toolName?: string;
	args?: unknown;
	expanded?: boolean;
	setExpanded?(expanded: boolean): void;
	executionStarted?: boolean;
	isPartial?: boolean;
	result?: { isError?: boolean; content?: Content[]; durationMs?: number };
};

function kind(component: Component): string {
	return component.constructor.name.replace(/^_+/, "");
}

function isAssistant(component: Component): boolean {
	return kind(component) === "AssistantMessageComponent";
}

function isTool(component: Component): boolean {
	return kind(component) === "ToolExecutionComponent";
}

function isSpacer(component: Component): boolean {
	return kind(component) === "Spacer";
}

function hasThinking(component: ChatComponent): boolean {
	return !!component.lastMessage?.content?.some((part) => part.type === "thinking" && part.thinking?.trim());
}

function shortText(value: unknown): string {
	return typeof value === "string" ? value.slice(0, 160).replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim() : "";
}

export function errorPreview(content: Content[] | undefined, i18n: LanguageStore): string[] {
	const part = content?.find((item) => item.type === "text" && item.text?.trim());
	return [shortText(part?.text) || i18n.t("toolFailed")];
}

export function toolSummary(name: string, args: unknown, state: {
	executionStarted?: boolean; isPartial?: boolean; isError?: boolean; durationMs?: number;
}, i18n: LanguageStore): string {
	const input = args && typeof args === "object" ? args as Record<string, unknown> : {};
	const detail = ["path", "file_path", "command", "cmd", "pattern", "query", "url"]
		.map((key) => shortText(input[key])).find(Boolean);
	const status = i18n.t(state.isError ? "failed" : state.isPartial ? (state.executionStarted ? "running" : "preparing") : "completed");
	const duration = state.durationMs !== undefined ? ` · ${state.durationMs} ms` : "";
	return `${shortText(name)}${duration}${detail ? ` · ${detail}` : ""} · ${status}`;
}

function styleSummary(text: string, theme: Theme, color: "muted" | "error", toolName?: string): string {
	const name = shortText(toolName);
	if (name && text.startsWith(name)) {
		return theme.fg("accent", theme.bold(name)) + theme.fg(color, text.slice(name.length));
	}
	return theme.fg(color, text);
}

export function lineComponent(text: string, theme: Theme, color: "muted" | "error" = "muted", toolName?: string): Component {
	return { render: (width) => [truncateToWidth(styleSummary(text, theme, color, toolName), width)], invalidate() {} };
}

/** Both TUI modes mount the persistent document (header, resources, chat) first. */
export function findChat(tui: TUI): Container | undefined {
	const document = tui.children[0] as ChatComponent | undefined;
	if (tui.children.length < 7 || document?.children?.length !== 3) return;
	if (kind(document) !== "Container" || !document.children.every((child) => kind(child) === "Container")) return;
	return document.children[2] as Container;
}

// Slices reuse native components and thinking mouse handlers. They are used
// only for old replies; current replies always render through Pi unchanged.
class AssistantSlice extends Container {
	constructor(readonly foldable: boolean) { super(); }
}

class FoldBlock extends Container {
	expanded = false;
	label = "";
	replySummary = "";
	toolName?: string;
	members: Component[] = [];
	errors: string[] = [];
	onExpansion?: (expanded: boolean) => void;
	private readonly header: MouseRegion;
	private readonly body: Component;

	constructor(readonly id: number, private readonly theme: () => Theme, private readonly i18n: LanguageStore, onToggle: () => void, readonly reply = false) {
		super();
		this.header = new MouseRegion({
			render: (width) => {
				const action = this.i18n.t(this.expanded ? "collapse" : "expand");
				const theme = this.theme();
				const color = this.errors.length ? "error" : "muted";
				const prefix = theme.fg(color, `─ ${this.expanded ? "▼" : "▶"} #${this.id} `);
				const label = styleSummary(this.label, theme, color, this.toolName);
				const line = truncateToWidth(prefix + label + theme.fg(color, ` [${action}]`), width);
				// Keep the old reply navigable with a balanced native prompt marker.
				const markHeader = this.reply && (!this.expanded || this.members[0] instanceof AssistantSlice);
				return [markHeader ? "\x1b]133;A\x07\x1b]133;B\x07\x1b]133;C\x07" + line : line];
			},
			invalidate() {},
		}, (event) => {
			if (event.type !== "click" || event.button !== "left") return;
			this.setExpanded(!this.expanded);
			onToggle();
			return { handled: true };
		});
		this.body = {
			render: (width) => this.errors.map((error) => this.theme().fg("error", truncateToWidth(`  ! ${error}`, width))),
			invalidate() {},
		};
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.onExpansion?.(expanded);
	}

	render(width: number): string[] {
		this.children = this.expanded ? [this.header, ...this.members] : [this.header, this.body];
		return super.render(width);
	}
}

// Additional text runs share the same reply toggle while native thinking runs
// remain between them, preserving the original order even when expanded.
class ReplyContinuation extends Container {
	constructor(private readonly block: FoldBlock, private readonly part: Component) { super(); }
	render(width: number): string[] {
		this.children = this.block.expanded ? [this.part] : [];
		return super.render(width);
	}
}

type FoldTurn = { key: Component; number: number; current: boolean; tools: FoldBlock[]; reply?: FoldBlock };
type PanelItem = SelectItem & { block?: FoldBlock; activate: () => void };

function turnSummary(turn: FoldTurn, i18n: LanguageStore): string {
	const expanded = turn.tools.filter((tool) => tool.expanded).length;
	const state = i18n.t(!turn.tools.length ? "noTools" : !expanded ? "allCollapsed" : expanded === turn.tools.length ? "allExpanded" : "partlyExpanded");
	return `${i18n.t("turn", { number: turn.number })}${turn.current ? ` · ${i18n.t("current")}` : ""} · ${i18n.t(turn.tools.length === 1 ? "toolCountOne" : "toolCount", { count: turn.tools.length })} · ${state}`;
}

class FoldPanel implements Component {
	private closed = false;
	private turnKey?: Component;
	private parentSelection?: string;
	private list?: SelectList;
	private listSignature = "";
	private rows: PanelItem[] = [];
	private maxVisible = 1;
	private listHeight = 0;

	constructor(
		private readonly view: FoldView,
		private readonly tui: TUI,
		private readonly theme: () => Theme,
		private readonly i18n: LanguageStore,
		private readonly keys: KeybindingsManager,
		private readonly done: () => void,
	) { this.updateList(); }

	private updateList(): void {
		const selected = this.list?.getSelectedItem()?.value;
		const turns = this.view.getTurns();
		const turn = turns.find((item) => item.key === this.turnKey);
		let vanished = false;
		if (this.turnKey && !turn) { this.back(); vanished = true; }
		if (turn) {
			this.rows = turn.tools.map((block) => this.blockItem(block));
			if (!turn.tools.length) this.rows.push({ value: "empty", label: this.i18n.t("noTurnTools"), activate() {} });
			if (turn.reply) this.rows.push(this.blockItem(turn.reply));
			this.rows.push({ value: "back", label: `← ${this.i18n.t("backToTurns")}`, activate: () => this.back() });
		} else {
			this.rows = [...turns].reverse().map((item) => ({
				value: `turn:${item.number}`, label: turnSummary(item, this.i18n),
				activate: () => {
					this.parentSelection = `turn:${item.number}`;
					this.turnKey = item.key;
					this.list = undefined;
				},
			}));
			if (!turns.length) this.rows.push({ value: "empty", label: this.i18n.t("noTurns"), activate() {} });
		}
		const signature = JSON.stringify([this.i18n.language, this.maxVisible, ...this.rows.map((row) => [row.value, row.label])]);
		// Keep the same SelectList across ordinary renders so its pressed mouse
		// row and selection survive background updates.
		if (this.list && signature === this.listSignature) return;
		this.listSignature = signature;
		const theme = this.theme();
		this.list = new SelectList(this.rows, this.maxVisible, {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.bg("selectedBg", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("muted", text),
			noMatch: () => theme.fg("muted", this.i18n.t("noTurns")),
		}, {
			truncatePrimary: ({ item, maxWidth, isSelected }) => {
				const block = this.rows.find((row) => row.value === item.value)?.block;
				const text = block && !block.reply
					? theme.fg("muted", `${block.expanded ? "▼" : "▶"} `) + styleSummary(block.label, theme, block.errors.length ? "error" : "muted", block.toolName) + theme.fg("muted", ` [${this.i18n.t(block.expanded ? "collapse" : "expand")}]`)
					: theme.fg(isSelected ? "accent" : "text", item.label);
				return truncateToWidth(text, maxWidth, "");
			},
		});
		const index = this.rows.findIndex((row) => row.value === (vanished ? undefined : selected ?? (!this.turnKey ? this.parentSelection : undefined)));
		this.list.setSelectedIndex(Math.max(0, index));
		this.list.onSelect = (item) => this.activate(item.value);
	}

	private blockItem(block: FoldBlock): PanelItem {
		return {
			value: `block:${block.id}`, block,
			label: `${block.expanded ? "▼" : "▶"} ${block.reply ? this.i18n.t("finalReply") + block.replySummary : block.label} [${this.i18n.t(block.expanded ? "collapse" : "expand")}]`,
			activate: () => this.view.toggleBlock(block),
		};
	}

	private activate(value: string): void {
		this.rows.find((row) => row.value === value)?.activate();
		this.updateList();
		this.tui.requestRender();
	}

	private back(): void {
		this.turnKey = undefined;
		this.list = undefined;
		this.tui.requestRender();
	}

	handleInput(data: string): void {
		if (this.closed) return;
		this.updateList();
		if (matchesKey(data, "l")) {
			this.view.changeLanguage(this.i18n.language === "zh" ? "en" : "zh");
			this.updateList();
			this.tui.requestRender();
			return;
		}
		if (matchesKey(data, "ctrl+c")) { this.close(); return; }
		if (this.keys.matches(data, "tui.select.cancel")) {
			if (this.turnKey) { this.back(); this.updateList(); } else this.close();
		} else if (this.keys.matches(data, "tui.select.confirm")) {
			const value = this.list?.getSelectedItem()?.value;
			if (value) this.activate(value);
		} else {
			const index = Math.max(0, this.rows.findIndex((row) => row.value === this.list?.getSelectedItem()?.value));
			let next = index;
			if (this.keys.matches(data, "tui.select.up")) next = (index - 1 + this.rows.length) % this.rows.length;
			else if (this.keys.matches(data, "tui.select.down")) next = (index + 1) % this.rows.length;
			else if (this.keys.matches(data, "tui.select.pageUp")) next = Math.max(0, index - this.maxVisible);
			else if (this.keys.matches(data, "tui.select.pageDown")) next = Math.min(this.rows.length - 1, index + this.maxVisible);
			else if (matchesKey(data, "home")) next = 0;
			else if (matchesKey(data, "end")) next = this.rows.length - 1;
			if (this.rows.length) this.list?.setSelectedIndex(next);
		}
		this.tui.requestRender();
	}

	handleMouse(event: TuiMouseEvent) {
		if (this.closed) return;
		if (event.type !== "wheel" && (event.y < 1 || event.y > this.listHeight)) return;
		return this.list?.handleMouse({ ...event, x: event.x - 1, y: event.y - 1, width: Math.max(1, event.width - 2), height: this.listHeight });
	}

	render(width: number): string[] {
		const height = Math.max(1, Math.min(20, this.tui.terminal.rows - 4));
		this.maxVisible = Math.max(1, height - 5);
		this.updateList();
		const theme = this.theme();
		const turn = this.view.getTurns().find((item) => item.key === this.turnKey);
		const title = turn ? `${this.i18n.t("turn", { number: turn.number })} · ${this.i18n.t("toolCalls")}` : this.i18n.t("chooseTurn");
		if (width < 2 || height < 2) return [truncateToWidth(title, width, "")];
		const inner = width - 2;
		const border = (text: string) => theme.fg("border", text);
		const row = (text: string) => border("│") + truncateToWidth(text, inner, "", true) + border("│");
		const heading = truncateToWidth(` ${title} `, inner, "");
		const top = border("┌") + theme.fg("accent", theme.bold(heading)) + border("─".repeat(Math.max(0, inner - visibleWidth(heading)))) + border("┐");
		const bottom = border(`└${"─".repeat(inner)}┘`);
		const items = this.list?.render(Math.max(1, inner)) ?? [];
		this.listHeight = Math.min(items.length, Math.max(0, height - (height > 4 ? 4 : 2)));
		const lines = [top, ...items.slice(0, this.listHeight).map(row)];
		if (height > 4) {
			const confirm = this.keys.getKeys("tui.select.confirm")[0] ?? "enter";
			const cancel = this.keys.getKeys("tui.select.cancel")[0] ?? "escape";
			const hint = `↑↓ ${this.i18n.t("select")} · ${this.i18n.t("languageHint")} · ${confirm} ${this.i18n.t(this.turnKey ? "toggle" : "enter")} · ${cancel} ${this.i18n.t(this.turnKey ? "back" : "close")}`;
			lines.push(border(`├${"─".repeat(inner)}┤`), row(theme.fg("muted", hint)));
		}
		return [...lines, bottom];
	}

	close(): void { if (!this.closed) { this.closed = true; this.done(); } }
	invalidate(): void { this.listSignature = ""; this.list?.invalidate(); }
	dispose(): void { this.closed = true; }
}

export class FoldView {
	enabled = true;
	private closePanel?: () => void;
	private nextId = 1;
	private blocks = new WeakMap<Component, FoldBlock>();
	private slices = new WeakMap<Component, AssistantSlice[]>();
	private active: FoldBlock[] = [];
	private readonly view = new Container();
	private readonly renderDescriptor: PropertyDescriptor | undefined;
	private readonly mouseDescriptor: PropertyDescriptor | undefined;
	private readonly originalRender: Container["render"];
	private readonly originalMouse: Container["handleMouse"];
	private readonly hookedRender: Container["render"];
	private readonly hookedMouse: Container["handleMouse"];
	private disposed = false;

	constructor(private readonly chat: Container, private readonly tui: TUI, private readonly theme: () => Theme, private readonly i18n: LanguageStore, private readonly saveLanguage: (language: Language) => void) {
		this.renderDescriptor = Object.getOwnPropertyDescriptor(chat, "render");
		this.mouseDescriptor = Object.getOwnPropertyDescriptor(chat, "handleMouse");
		this.originalRender = chat.render;
		this.originalMouse = chat.handleMouse;
		this.hookedRender = (width) => this.enabled ? this.render(width) : this.originalRender.call(chat, width);
		this.hookedMouse = (event) => this.enabled ? this.view.handleMouse(event) : this.originalMouse.call(chat, event);
		chat.render = this.hookedRender;
		chat.handleMouse = this.hookedMouse;
	}

	refreshTools(): void {
		for (const child of this.chat.children) if (isTool(child)) child.invalidate();
	}

	private assistantParts(component: ChatComponent): Component[] {
		if (!hasThinking(component)) return [component];
		const native = component.contentContainer?.children;
		// Unknown thinking layouts pass through intact, outside our folding control.
		if (!native?.length || !native.every((child) => ["Spacer", "Markdown", "Text", "MouseRegion"].includes(kind(child)))) return [component];
		let expected = 0;
		let visibleRun = false;
		for (const part of component.lastMessage?.content ?? []) {
			if (part.type !== "thinking") visibleRun = false;
			else if (part.thinking?.trim() && !visibleRun) { expected++; visibleRun = true; }
		}
		if (native.filter((child) => kind(child) === "MouseRegion").length !== expected) return [component];

		const parts: { foldable: boolean; children: Component[] }[] = [];
		let text: Component[] = [];
		for (const child of native) {
			if (kind(child) !== "MouseRegion") { text.push(child); continue; }
			if (text.some((item) => !isSpacer(item))) {
				parts.push({ foldable: true, children: text });
				text = [];
			}
			parts.push({ foldable: false, children: [...text, child] });
			text = [];
		}
		if (text.some((item) => !isSpacer(item))) parts.push({ foldable: true, children: text });
		else if (text.length) parts[parts.length - 1].children.push(...text);

		let slices = this.slices.get(component);
		if (!slices) { slices = []; this.slices.set(component, slices); }
		return parts.map((part, index) => {
			let slice = slices[index];
			if (!slice || slice.foldable !== part.foldable) slice = slices[index] = new AssistantSlice(part.foldable);
			slice.children = part.children;
			return slice;
		});
	}

	private block(anchor: Component, reply = false): FoldBlock {
		let block = this.blocks.get(anchor);
		if (!block) {
			block = new FoldBlock(this.nextId++, this.theme, this.i18n, () => this.tui.requestRender(), reply);
			this.blocks.set(anchor, block);
		}
		this.active.push(block);
		return block;
	}

	private tool(component: ChatComponent): FoldBlock {
		const block = this.block(component);
		// Native Ctrl+O and native tool clicks share the same expansion state.
		if (typeof component.expanded === "boolean") block.expanded = component.expanded;
		block.onExpansion = (expanded) => component.setExpanded?.(expanded);
		block.members = [component];
		block.toolName = shortText(component.toolName ?? "tool");
		block.label = toolSummary(block.toolName, component.args, {
			executionStarted: component.executionStarted,
			isPartial: component.isPartial ?? !component.result,
			isError: component.result?.isError,
			durationMs: component.result?.durationMs,
		}, this.i18n);
		block.errors = component.result?.isError ? errorPreview(component.result.content, this.i18n) : [];
		return block;
	}

	private reply(component: ChatComponent): Component[] {
		const parts = this.assistantParts(component);
		if (hasThinking(component) && parts[0] === component) return parts;
		const textParts = parts.filter((part) => !(part instanceof AssistantSlice) || part.foldable);
		if (!textParts.length) return parts;
		const block = this.block(component, true);
		const text = component.lastMessage?.content?.find((part) => part.type === "text" && part.text?.trim())?.text;
		block.replySummary = text ? ` · ${shortText(text.split(/\r?\n/, 1)[0])}` : "";
		block.label = this.i18n.t("previousReply") + block.replySummary;
		block.members = [textParts[0]];
		return parts.map((part) => part === textParts[0] ? block : textParts.includes(part) ? new ReplyContinuation(block, part) : part);
	}

	private previousReplies(): Set<Component> {
		const previous = new Set<Component>();
		let final: ChatComponent | undefined;
		for (const child of this.chat.children as ChatComponent[]) {
			if (kind(child) === "UserMessageComponent") {
				if (final) previous.add(final);
				final = undefined;
			} else if (isAssistant(child)) {
				const hasText = child.lastMessage?.content?.some((part) => part.type === "text" && part.text?.trim());
				final = !child.hasToolCalls && !child.isStreaming && child.lastMessage?.stopReason === "stop" && hasText ? child : undefined;
			}
		}
		return previous;
	}

	private project(): FoldTurn[] {
		this.active = [];
		const previous = this.previousReplies();
		const turns: FoldTurn[] = [];
		const visible: Component[] = [];
		let turn: FoldTurn | undefined;
		for (const child of this.chat.children) {
			if (kind(child) === "UserMessageComponent" || (!turn && (isTool(child) || isAssistant(child)))) {
				turn = { key: child, number: turns.length + 1, current: false, tools: [] };
				turns.push(turn);
			}
			if (isTool(child)) {
				const block = this.tool(child);
				turn?.tools.push(block);
				visible.push(block);
			} else if (previous.has(child)) {
				visible.push(...this.reply(child));
				const block = this.blocks.get(child);
				if (turn && block && this.active.includes(block)) turn.reply = block;
			} else visible.push(child);
		}
		if (turn) turn.current = true;
		this.view.children = visible;
		return turns;
	}

	getTurns(): FoldTurn[] { return this.project(); }

	toggleBlock(block: FoldBlock): void {
		this.project();
		if (!this.active.includes(block)) return;
		this.setEnabled(true);
		block.setExpanded(!block.expanded);
		this.tui.requestRender();
	}

	changeLanguage(language: Language): void {
		this.saveLanguage(language);
	}

	languageChanged(): void {
		this.refreshTools();
		this.tui.requestRender();
	}

	private render(width: number): string[] {
		this.project();
		return this.view.render(width);
	}

	private async openPanel(ctx: ExtensionContext): Promise<void> {
		if (this.closePanel) return;
		let panel: FoldPanel | undefined;
		const close = () => panel?.close();
		this.closePanel = close;
		try {
			await ctx.ui.custom<void>((tui, _theme, keys, done) => {
				panel = new FoldPanel(this, tui, () => ctx.ui.theme, this.i18n, keys, done);
				return panel;
			}, { overlay: true, overlayOptions: { anchor: "center", width: "85%", maxHeight: "85%", margin: 1 } });
		} finally {
			if (this.closePanel === close) this.closePanel = undefined;
		}
	}

	reset(): void {
		this.closePanel?.();
		this.blocks = new WeakMap();
		this.slices = new WeakMap();
		this.active = [];
		this.nextId = 1;
		this.tui.requestRender();
	}

	private setEnabled(enabled: boolean): void {
		if (this.enabled !== enabled) {
			this.enabled = enabled;
			this.refreshTools();
		}
		this.tui.requestRender();
	}

	async command(args: string, ctx: ExtensionContext): Promise<void> {
		const action = args.trim().toLowerCase();
		if (action === "off" || action === "on") { this.setEnabled(action === "on"); return; }
		this.project();
		if (action === "collapse" || action === "expand") {
			this.setEnabled(true);
			for (const block of this.active) block.setExpanded(action === "expand");
		} else if (action === "latest") {
			this.setEnabled(true);
			const block = this.active.at(-1);
			if (block) block.setExpanded(!block.expanded);
		} else if (!action) {
			await this.openPanel(ctx);
			return;
		} else {
			ctx.ui.notify(this.i18n.t("usage"), "info");
			return;
		}
		this.tui.requestRender();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.closePanel?.();
		this.setEnabled(false);
		if (this.chat.render === this.hookedRender) {
			if (this.renderDescriptor) Object.defineProperty(this.chat, "render", this.renderDescriptor);
			else delete (this.chat as Partial<Container>).render;
		}
		if (this.chat.handleMouse === this.hookedMouse) {
			if (this.mouseDescriptor) Object.defineProperty(this.chat, "handleMouse", this.mouseDescriptor);
			else delete (this.chat as Partial<Container>).handleMouse;
		}
	}
}

