import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export type NotifyMode = "auto" | "on" | "off";

export interface UiSettings {
	/** Fold the final reply of previous turns into one line. */
	foldReplies: boolean;
	/** How many recent replies the batch shortcut expands or collapses. */
	recentCount: number;
	/** Completion notification mode. */
	notify: NotifyMode;
	/** Play a sound with the completion notification. */
	notifySound: boolean;
}

const DEFAULTS: UiSettings = { foldReplies: true, recentCount: 3, notify: "auto", notifySound: true };
const SETTINGS_FILE = "pi-ui-plus.json";

/** Read the persisted settings without creating a store. Used by the notify extension. */
export function readSettings(directory: string = getAgentDir()): UiSettings {
	const values = { ...DEFAULTS };
	try {
		const raw = JSON.parse(readFileSync(join(directory, SETTINGS_FILE), "utf8")) as Partial<UiSettings>;
		if (typeof raw.foldReplies === "boolean") values.foldReplies = raw.foldReplies;
		if (typeof raw.recentCount === "number" && Number.isFinite(raw.recentCount)) values.recentCount = clampCount(raw.recentCount);
		if (raw.notify === "auto" || raw.notify === "on" || raw.notify === "off") values.notify = raw.notify;
		if (typeof raw.notifySound === "boolean") values.notifySound = raw.notifySound;
	} catch { /* Missing or malformed settings use defaults. */ }
	return values;
}

function clampCount(value: number): number {
	return Math.min(5, Math.max(1, Math.round(value)));
}

/** Global, atomic settings file shared with the notification extension. */
export class SettingsStore {
	private values: UiSettings;
	private readonly listeners = new Set<() => void>();

	constructor(private readonly directory = getAgentDir()) {
		this.values = readSettings(directory);
	}

	get current(): UiSettings {
		return this.values;
	}

	reload(): void {
		const previous = JSON.stringify(this.values);
		this.values = readSettings(this.directory);
		if (JSON.stringify(this.values) !== previous) this.notify();
	}

	set(patch: Partial<UiSettings>): void {
		const next: UiSettings = { ...this.values, ...patch };
		next.recentCount = clampCount(next.recentCount);
		mkdirSync(this.directory, { recursive: true });
		const target = join(this.directory, SETTINGS_FILE);
		const temporary = `${target}.${process.pid}.tmp`;
		try {
			writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
			renameSync(temporary, target);
		} finally {
			rmSync(temporary, { force: true });
		}
		const changed = JSON.stringify(this.values) !== JSON.stringify(next);
		this.values = next;
		if (changed) this.notify();
	}

	onChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}
