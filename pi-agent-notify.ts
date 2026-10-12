import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readSettings, type NotifyMode } from "./pi-ui-plus/settings.js";

const DEFAULT_TITLE = "Pi";
type Backend = "windows" | "linux" | "macos";
const DEFAULT_MESSAGE = "Agent 已完成本轮对话";
const IMAGE_MESSAGE = "已完成：图片相关任务";
const MAX_TASK_LENGTH = 56;
const WINDOWS_SCRIPT = fileURLToPath(new URL("./assets/pi-toast.ps1", import.meta.url));

export function summarizeTask(text: string, maxLength = MAX_TASK_LENGTH): string {
	const cleaned = text
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "图片")
		.replace(/[`*_>#~]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned) return DEFAULT_MESSAGE;
	const characters = Array.from(cleaned);
	if (characters.length <= maxLength) return `已完成：${cleaned}`;
	return `已完成：${characters.slice(0, maxLength - 3).join("")}...`;
}

function envValue(name: string, fallback: string): string {
	const value = process.env[name]?.trim();
	return value || fallback;
}

function configuredMessage(fallback: string): string {
	return envValue("PI_AGENT_NOTIFY_MESSAGE", fallback);
}

// Environment variables keep overriding the persisted /fold settings.
function notifyMode(settings: NotifyMode): NotifyMode {
	const value = process.env.PI_AGENT_NOTIFY?.trim().toLowerCase();
	if (value === "on" || value === "off" || value === "auto") return value;
	return settings;
}

function isWsl(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): boolean {
	return platform === "linux" && Boolean(env.WSL_INTEROP || env.WSL_DISTRO_NAME);
}

export function detectBackend(
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
): Backend | undefined {
	if (platform === "win32" || isWsl(platform, env)) return "windows";
	if (platform === "darwin") return "macos";
	if (platform === "linux") return "linux";
	return undefined;
}

function shouldNotify(ctx: ExtensionContext): boolean {
	const mode = notifyMode(readSettings().notify);
	if (mode === "off") return false;
	return mode === "on" || ctx.mode === "tui";
}

function hasSound(): boolean {
	const value = process.env.PI_AGENT_NOTIFY_SOUND?.trim().toLowerCase();
	if (value === "on" || value === "off") return value !== "off";
	return readSettings().notifySound;
}

async function windowsScriptPath(pi: ExtensionAPI): Promise<string | undefined> {
	if (!existsSync(WINDOWS_SCRIPT)) return undefined;
	if (process.platform === "win32") return WINDOWS_SCRIPT;
	const result = await pi.exec("wslpath", ["-w", WINDOWS_SCRIPT], { timeout: 3000 });
	if (result.code !== 0) return undefined;
	const path = result.stdout.trim();
	return path || undefined;
}

async function notifyWindows(pi: ExtensionAPI, message: string): Promise<void> {
	const scriptPath = await windowsScriptPath(pi);
	if (!scriptPath) return;
	const args = [
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-File",
		scriptPath,
		"-Title",
		envValue("PI_AGENT_NOTIFY_TITLE", DEFAULT_TITLE),
		"-Message",
		configuredMessage(message),
		"-AppId",
		envValue("PI_AGENT_NOTIFY_APP_ID", "Microsoft.WindowsTerminal_8wekyb3d8bbwe!App"),
	];
	if (!hasSound()) args.push("-Silent");
	await pi.exec("powershell.exe", args, { timeout: 10_000 });
}

async function notifyLinux(pi: ExtensionAPI, message: string): Promise<void> {
	const result = await pi.exec("sh", ["-c", "command -v notify-send"], { timeout: 3000 });
	if (result.code !== 0) return;
	await pi.exec("notify-send", [
		"--app-name=Pi",
		"--urgency=normal",
		envValue("PI_AGENT_NOTIFY_TITLE", DEFAULT_TITLE),
		configuredMessage(message),
	], { timeout: 5000 });
}

async function notifyMacos(pi: ExtensionAPI, message: string): Promise<void> {
	const title = envValue("PI_AGENT_NOTIFY_TITLE", DEFAULT_TITLE).replaceAll('"', "\\\"");
	const body = configuredMessage(message).replaceAll('"', "\\\"");
	const sound = hasSound() ? ' sound name "Glass"' : "";
	await pi.exec("osascript", ["-e", `display notification "${body}" with title "${title}"${sound}`], { timeout: 5000 });
}

async function notify(pi: ExtensionAPI, message: string): Promise<void> {
	const backend = detectBackend();
	if (!backend) return;
	if (backend === "windows") return notifyWindows(pi, message);
	if (backend === "linux") return notifyLinux(pi, message);
	return notifyMacos(pi, message);
}

function abortedMessage(summary: string): string {
	return summary.startsWith("已完成：") ? summary.replace(/^已完成：/, "已中止：") : `已中止：${summary}`;
}

export default function (pi: ExtensionAPI): void {
	let latestTask = DEFAULT_MESSAGE;

	pi.on("session_start", () => {
		latestTask = DEFAULT_MESSAGE;
	});

	pi.on("input", (event) => {
		const text = event.text.trim();
		if (text) {
			latestTask = summarizeTask(text);
		} else if (event.images?.length) {
			latestTask = IMAGE_MESSAGE;
		}
	});

	pi.on("agent_settled", async (event, ctx) => {
		if (!shouldNotify(ctx)) return;
		try {
			await notify(pi, event.aborted ? abortedMessage(latestTask) : latestTask);
		} catch {
			// Notification failure must never change the agent result.
		}
	});
}
