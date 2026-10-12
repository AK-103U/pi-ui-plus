import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Key, Text } from "@earendil-works/pi-tui";
import { LanguageStore, type Language } from "./language.js";
import { SettingsStore } from "./settings.js";
import { FoldView, findChat, errorPreview, lineComponent, toolSummary } from "./fold.js";
import { NativeUiAdapter } from "./native-ui.js";
import { localizedAutocomplete } from "./autocomplete.js";
import { messages } from "./translations.js";

const WIDGET = "pi-ui-plus";

export default function (pi: ExtensionAPI): void {
	const language = new LanguageStore();
	const settings = new SettingsStore();
	let view: FoldView | undefined;
	let native: NativeUiAdapter | undefined;
	let context: ExtensionContext | undefined;
	let stopLanguageListener: (() => void) | undefined;
	let stopSettingsListener: (() => void) | undefined;

	const changeLanguage = (next: Language) => {
		try { language.set(next); } catch (error) {
			context?.ui.notify(`无法保存界面语言 / Could not save UI language: ${error instanceof Error ? error.message : String(error)}`, "error");
		}
	};
	const dispose = () => {
		stopLanguageListener?.();
		stopLanguageListener = undefined;
		stopSettingsListener?.();
		stopSettingsListener = undefined;
		view?.dispose();
		view = undefined;
		native?.dispose();
		native = undefined;
	};

	pi.registerToolRenderer((toolName, next) => {
		const original = next();
		return {
			...original,
			renderCall(args, theme, renderContext) {
				if (view?.enabled && !renderContext.expanded) return lineComponent(toolSummary(toolName, args, renderContext, language), theme, renderContext.isError ? "error" : "muted", toolName);
				return original?.renderCall?.(args, theme, renderContext) ?? new Text(`${toolName}\n\n${JSON.stringify(args, null, 2) ?? ""}`, 0, 0);
			},
			renderResult(result, options, theme, renderContext) {
				if (view?.enabled && !options.expanded) return renderContext.isError ? lineComponent(errorPreview(result.content, language)[0], theme, "error") : new Container();
				return original?.renderResult?.(result, options, theme, renderContext) ?? new Text(result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n"), 0, 0);
			},
		};
	});

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		dispose();
		context = ctx;
		language.reload();
		settings.reload();
		ctx.ui.addAutocompleteProvider((current) => localizedAutocomplete(current, () => context ? language.language : "en"));
		ctx.ui.setWidget(WIDGET, (tui) => {
			dispose();
			const chat = findChat(tui);
			if (chat) {
				view = new FoldView(chat, tui, () => ctx.ui.theme, language, changeLanguage, settings);
				view.refreshTools();
				native = new NativeUiAdapter(tui, language);
				stopLanguageListener = language.onChange(() => { native?.invalidate(); view?.languageChanged(); });
				stopSettingsListener = settings.onChange(() => view?.settingsChanged());
			} else ctx.ui.notify(language.t("incompatible"), "warning");
			const attachedView = view;
			const attachedNative = native;
			const unsubscribeLanguage = stopLanguageListener;
			const unsubscribeSettings = stopSettingsListener;
			return {
				render: () => [], invalidate() {},
				dispose: () => { unsubscribeLanguage?.(); unsubscribeSettings?.(); attachedView?.dispose(); attachedNative?.dispose(); },
			};
		});
	});
	pi.on("session_tree", () => view?.reset());
	pi.on("session_shutdown", () => { dispose(); context = undefined; });
	pi.registerCommand("fold", {
		description: messages.en.commandDescription,
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") return;
			if (view) await view.command(args, ctx);
			else ctx.ui.notify(language.t("notAttached"), "warning");
		},
	});
	pi.registerShortcut("alt+o", {
		description: messages.en.shortcutDescription,
		handler: async (ctx) => { if (ctx.mode === "tui") await view?.command("latest", ctx); },
	});
	pi.registerShortcut(Key.altShift("o"), {
		description: messages.en.recentShortcutDescription,
		handler: async (ctx) => { if (ctx.mode === "tui") view?.recentAction(settings.current.recentCount); },
	});
}
