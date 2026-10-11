import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { messages, type Language } from "./translations.js";

export type { Language } from "./translations.js";
type LanguageChoice = Language | "auto";
const SETTINGS_FILE = "ui-language.json";

export class LanguageStore {
	private setting: LanguageChoice = "auto";
	private readonly systemLanguage: Language;
	private readonly defaultChoice: LanguageChoice;
	private readonly listeners = new Set<() => void>();
	constructor(private readonly directory = getAgentDir()) {
		const locale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale;
		this.systemLanguage = /^zh(?:[-_.@]|$)/i.test(locale) ? "zh" : "en";
		const preference = (process.env.PI_UI_LANG ?? "auto").trim().toLowerCase();
		this.defaultChoice = ["en", "zh", "auto"].includes(preference) ? preference as LanguageChoice : "auto";
		this.reload();
	}
	get language(): Language { return this.setting === "auto" ? this.systemLanguage : this.setting; }
	reload(): void {
		const previous = this.language;
		this.setting = this.defaultChoice;
		try {
			const stored = JSON.parse(readFileSync(join(this.directory, SETTINGS_FILE), "utf8"))?.language;
			if (stored === "zh" || stored === "en") this.setting = stored;
		} catch { /* Missing or malformed preferences use the environment default. */ }
		if (this.language !== previous) for (const listener of this.listeners) listener();
	}
	set(language: Language): void {
		if (language !== "zh" && language !== "en") throw new Error("Unsupported language");
		mkdirSync(this.directory, { recursive: true });
		const target = join(this.directory, SETTINGS_FILE);
		const temporary = `${target}.${process.pid}.tmp`;
		try {
			writeFileSync(temporary, JSON.stringify({ language }) + "\n", { encoding: "utf8", mode: 0o600 });
			renameSync(temporary, target);
		} finally { rmSync(temporary, { force: true }); }
		const changed = this.language !== language;
		this.setting = language;
		if (changed) for (const listener of this.listeners) listener();
	}
	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
	t(key: keyof typeof messages.en, values: Record<string, string | number> = {}): string {
		return messages[this.language][key].replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? `{${name}}`));
	}
}
