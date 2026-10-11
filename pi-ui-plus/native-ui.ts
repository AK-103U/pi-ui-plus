import { getKeybindings, type Component, type SettingItem, type TUI } from "@earendil-works/pi-tui";
import type { Language, LanguageStore } from "./language.js";
import { translateHotkeys, translatePhrase } from "./translations.js";

const kind = (component: Component) => component.constructor.name.replace(/^_+/, "");
const CONTAINERS = new Set(["Container", "WarningSettingsSubmenu", "ThemeSubmenu", "SelectSubmenu", "SteppedSubmenu"]);
const SELECTORS = new Set(["SettingsSelectorComponent", "ThinkingSelectorComponent"]);

type NativeComponent = Component & {
	children?: Component[];
	getSettingsList?(): Component;
	submenuComponent?: Component;
	items?: SettingItem[];
	filteredItems?: SettingItem[];
	applyFilter?: (query: string) => void;
	build?: () => string;
	setText?(text: string): void;
	text?: string;
	workingStatusIndicator?: NativeComponent;
	messageColorFn?: (message: string) => string;
	updateDisplay?(): void;
};

function hotkeysWithFullscreen(source: string): string {
	const kb = getKeybindings();
	const rows = [
		["tui.altScreen.previousPrompt", "Previous marked message"],
		["tui.altScreen.nextPrompt", "Next marked message"],
		["tui.altScreen.top", "Beginning of transcript"],
		["tui.altScreen.bottom", "Latest output and follow new messages"],
		["tui.altScreen.search", "Search transcript"],
		["tui.altScreen.pageUp", "Scroll transcript up by one page"],
		["tui.altScreen.pageDown", "Scroll transcript down by one page"],
	] as const;
	return source + "\n\n**Fullscreen navigation**\n| Key | Action |\n|-----|--------|\n" + rows.map(([id, description]) =>
		`| \`${kb.getKeys(id).join(" / ") || "—"}\` | ${description} |`).join("\n");
}

export class NativeUiAdapter {
	private readonly patched = new WeakSet<Component>();
	private readonly cleanups: (() => void)[] = [];
	private readonly resets = new Set<() => void>();
	private disposed = false;
	private readonly watched = new WeakSet<Component>();
	private readonly described = new WeakSet<object>();
	private readonly language: () => Language;

	constructor(private readonly tui: TUI, store: LanguageStore) {
		this.language = () => store.language;
		this.scan();
	}

	private replace<T extends object>(target: T, property: keyof T, replacement: T[keyof T]): void {
		const descriptor = Object.getOwnPropertyDescriptor(target, property);
		target[property] = replacement;
		this.cleanups.push(() => {
			if (target[property] !== replacement) return;
			if (descriptor) Object.defineProperty(target, property, descriptor);
			else delete target[property];
		});
	}

	private text(component: NativeComponent): void {
		if (this.patched.has(component) || typeof component.setText !== "function") return;
		this.patched.add(component);
		const nativeSet = component.setText.bind(component);
		const nativeRender = component.render.bind(component);
		let original = component.text ?? "";
		let sourceVersion = 0;
		let renderedVersion = -1;
		let renderedLanguage: Language | undefined;
		const setText = (text: string) => {
			original = text;
			sourceVersion++;
			nativeSet(!this.disposed && this.language() === "zh" ? translatePhrase(text) : text);
		};
		this.replace(component, "setText", setText);
		this.replace(component, "render", (width: number) => {
			if (this.disposed) return nativeRender(width);
			if (typeof component.build === "function" && (component as NativeComponent & { stale?: boolean }).stale) {
				original = component.build();
				sourceVersion++;
				(component as NativeComponent & { stale?: boolean }).stale = false;
			}
			const language = this.language();
			if (renderedVersion !== sourceVersion || renderedLanguage !== language) {
				nativeSet(language === "zh" ? translatePhrase(original) : original);
				renderedVersion = sourceVersion;
				renderedLanguage = language;
			}
			return nativeRender(width);
		});
		this.resets.add(() => { renderedVersion = -1; nativeSet(this.language() === "zh" ? translatePhrase(original) : original); });
		this.cleanups.push(() => nativeSet(original));
	}

	private indicator(component: NativeComponent): void {
		if (this.patched.has(component) || !component.messageColorFn || !component.updateDisplay) return;
		this.patched.add(component);
		const color = component.messageColorFn.bind(component);
		// Cleanup is reversed: restore the formatter before recomputing text.
		this.cleanups.push(() => component.updateDisplay!());
		// Embedded indicators render through renderInBorder(), not render().
		// Localize only the displayed message; preserve the loader's raw source.
		this.replace(component, "messageColorFn", (message: string) => color(!this.disposed && this.language() === "zh" ? translatePhrase(message) : message));
		this.resets.add(() => component.updateDisplay!());
		component.updateDisplay();
	}

	private hotkeys(component: NativeComponent): void {
		if (this.patched.has(component) || !component.setText || typeof component.text !== "string") return;
		if (!/^\*\*Navigation\*\*\s*\n\| Key \| Action \|/m.test(component.text)) return;
		this.patched.add(component);
		const original = component.text;
		const extended = hotkeysWithFullscreen(original);
		let last: Language | undefined;
		const nativeRender = component.render.bind(component);
		this.replace(component, "render", (width: number) => {
			if (this.disposed) return nativeRender(width);
			const language = this.language();
			if (language !== last) { component.setText!(language === "zh" ? translateHotkeys(extended) : extended); last = language; }
			return nativeRender(width);
		});
		this.resets.add(() => { last = undefined; });
		this.cleanups.push(() => component.setText!(original));
	}

	private selectDescriptions(component: NativeComponent): void {
		for (const item of component.items ?? []) {
			if (this.described.has(item) || !item.description) continue;
			this.described.add(item);
			const original = Object.getOwnPropertyDescriptor(item, "description")!;
			const description = item.description;
			Object.defineProperty(item, "description", { configurable: true, enumerable: original.enumerable, get: () => this.language() === "zh" && !this.disposed ? translatePhrase(description) : description });
			this.cleanups.push(() => Object.defineProperty(item, "description", original));
		}
	}

	private settings(component: NativeComponent): void {
		if (!Array.isArray(component.items)) return;
		if (!this.patched.has(component)) {
			this.patched.add(component);
			const items = component.items;
			for (const item of items) {
				const label = item.label;
				const description = item.description;
				Object.defineProperty(item, "label", { configurable: true, get: () => this.language() === "zh" ? translatePhrase(label) : label });
				if (description) Object.defineProperty(item, "description", { configurable: true, get: () => this.language() === "zh" ? translatePhrase(description) : description });
				this.cleanups.push(() => {
					Object.defineProperty(item, "label", { configurable: true, writable: true, enumerable: true, value: label });
					if (description) Object.defineProperty(item, "description", { configurable: true, writable: true, enumerable: true, value: description });
				});
			}
			// Keep raw values untouched: native callbacks depend on English tokens.
			const nativeRender = component.render.bind(component);
			this.replace(component, "render", (width: number) => {
				if (!this.disposed && component.submenuComponent) this.visit(component.submenuComponent as NativeComponent, true);
				return nativeRender(width);
			});
			// Translate the native hint before truncation, not rendered lines.
			const settingsTheme = (component as NativeComponent & { theme?: { hint: (text: string) => string } }).theme;
			if (settingsTheme?.hint) {
				const hint = settingsTheme.hint.bind(settingsTheme);
				this.replace(settingsTheme, "hint", (text: string) => hint(this.language() === "zh" && !this.disposed ? translatePhrase(text) : text));
			}
			if (component.applyFilter) {
				const nativeFilter = component.applyFilter.bind(component);
				this.replace(component, "applyFilter", (query: string) => {
					const normalized = query.toLowerCase();
					const found = items.filter((item) => `${item.id} ${item.label} ${item.description ?? ""}`.toLowerCase().includes(normalized));
					if (query && found.length) { component.filteredItems = found; (component as NativeComponent & { selectedIndex?: number }).selectedIndex = 0; }
					else nativeFilter(query);
				});
			}
		}
		if (component.submenuComponent) this.visit(component.submenuComponent as NativeComponent, true);
	}

	private visit(component: NativeComponent, settings = false): void {
		const name = kind(component);
		if (name === "SettingsSelectorComponent") {
			const list = component.getSettingsList?.();
			if (list) this.settings(list as NativeComponent);
			return;
		}
		if (name === "ThinkingSelectorComponent") {
			for (const child of component.children ?? []) this.visit(child as NativeComponent, true);
			return;
		}
		if (name === "SelectList" && settings) { this.selectDescriptions(component); return; }
		if (name === "SettingsList" && settings) { this.settings(component); return; }
		if (settings && (name === "Text" || name === "ThemedText")) { this.text(component); return; }
		if (settings && CONTAINERS.has(name)) for (const child of component.children ?? []) this.visit(child as NativeComponent, true);
	}

	private scanChat(chat: NativeComponent): void {
		for (const child of chat.children ?? []) {
			const name = kind(child);
			if (name === "ThemedText") this.text(child as NativeComponent);
			else if (name === "Markdown") this.hotkeys(child as NativeComponent);
		}
	}

	private watch(container: NativeComponent, scan: () => void): void {
		if (this.watched.has(container)) return;
		this.watched.add(container);
		const nativeRender = container.render.bind(container);
		this.replace(container, "render", (width: number) => {
			if (!this.disposed) scan();
			return nativeRender(width);
		});
	}

	scan(): void {
		const roots = this.tui.children as NativeComponent[];
		const document = roots[0];
		if (roots.length < 7 || document?.children?.length !== 3) return;
		if (!document.children.every((child) => kind(child) === "Container") || kind(roots[4]) !== "Container") return;
		const [header, _resources, chat] = document.children as NativeComponent[];
		// Both renderers render this persistent document; never replace the TUI's
		// own render method because its stable proxy may switch renderer modes.
		this.watch(document, () => this.scan());
		for (const child of header.children ?? []) if (kind(child) === "BuiltInHeader") this.text(child as NativeComponent);
		this.scanChat(chat);
		for (const child of roots[4].children ?? []) if (SELECTORS.has(kind(child))) this.visit(child as NativeComponent);
		for (const child of roots[4].children ?? []) {
			if (kind(child) !== "CustomEditor") continue;
			const indicator = (child as NativeComponent).workingStatusIndicator;
			if (indicator && ["WorkingStatusIndicator", "RetryStatusIndicator", "CompactionStatusIndicator", "BranchSummaryStatusIndicator"].includes(kind(indicator))) this.indicator(indicator);
		}
		for (const child of roots[2]?.children ?? []) if (["WorkingStatusIndicator", "RetryStatusIndicator", "CompactionStatusIndicator", "BranchSummaryStatusIndicator"].includes(kind(child))) this.indicator(child as NativeComponent);
	}

	invalidate(): void {
		for (const reset of this.resets) reset();
		this.tui.requestRender();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const cleanup of this.cleanups.reverse()) cleanup();
		this.cleanups.length = 0;
		this.resets.clear();
		this.tui.requestRender();
	}
}

