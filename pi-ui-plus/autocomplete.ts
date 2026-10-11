import type { AutocompleteProvider } from "@earendil-works/pi-tui";
import { translatePhrase } from "./translations.js";

export function localizedAutocomplete(current: AutocompleteProvider, language: () => "zh" | "en"): AutocompleteProvider {
	return {
		...current,
		triggerCharacters: current.triggerCharacters,
		async getSuggestions(lines, cursorLine, cursorCol, options) {
			const result = await current.getSuggestions(lines, cursorLine, cursorCol, options);
			const beforeCursor = (lines[cursorLine] ?? "").slice(0, cursorCol);
			if (!result || options.force || language() !== "zh" || !/^\/\S*$/.test(result.prefix) || !/^\s*\/\S*$/.test(beforeCursor)) return result;
			return {
				...result,
				items: result.items.map((item) => {
					if (!item.description) return item;
					// Native command values are bare names ("model", not "/model").
					// Keep argument hints and extension source tags unchanged.
					const parts = /^((?:<[^>]+> — )?(?:\[[^\]]+\]\s*)?)([\s\S]*)$/.exec(item.description)!;
					const description = parts[1] + translatePhrase(parts[2]);
					return description === item.description ? item : { ...item, description };
				}),
			};
		},
		applyCompletion: (lines, cursorLine, cursorCol, item, prefix) => current.applyCompletion(lines, cursorLine, cursorCol, item, prefix),
		shouldTriggerFileCompletion: current.shouldTriggerFileCompletion?.bind(current),
	};
}
