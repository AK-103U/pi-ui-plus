import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { findHostRoot } from "./host.mjs";

const hostRoot = findHostRoot();

const host = async (path) => import(pathToFileURL(resolve(hostRoot, "dist", path)).href);
const { loadExtensions, createExtensionRuntime } = await host("core/extensions/loader.js");
const pluginPath = fileURLToPath(new URL("../pi-agent-notify.ts", import.meta.url));
const toastPath = fileURLToPath(new URL("../assets/pi-toast.ps1", import.meta.url));
const require = createRequire(resolve(hostRoot, "../../.pnpm/node_modules/"));
// settings.ts imports the host at runtime; alias it so jiti can resolve it here.
const { summarizeTask } = require("jiti")(import.meta.url, {
	interopDefault: true,
	alias: { "@earendil-works/pi-coding-agent": resolve(hostRoot, "dist/index.js") },
})(pluginPath);
const { readSettings } = require("jiti")(import.meta.url, {
	interopDefault: true,
	alias: { "@earendil-works/pi-coding-agent": resolve(hostRoot, "dist/index.js") },
})(fileURLToPath(new URL("../pi-ui-plus/settings.ts", import.meta.url)));

test("notification summaries stay short and remove markdown noise", () => {
	assert.equal(summarizeTask("检查 Mermaid 的 final 和 streaming 渲染差异"), "已完成：检查 Mermaid 的 final 和 streaming 渲染差异");
	assert.equal(summarizeTask(["修复 bug", "", "```bash", "npm test", "```"].join("\n")), "已完成：修复 bug");
	assert.match(summarizeTask("x".repeat(100)), /^已完成：x+\.\.\.$/);
});

test("agent notification extension loads and registers agent_settled", async () => {
	const runtime = createExtensionRuntime();
	const { extensions, errors } = await loadExtensions([pluginPath], dirname(pluginPath), undefined, runtime);

	assert.deepEqual(errors, []);
	assert.equal(extensions.length, 1);
	assert.equal(extensions[0].handlers.get("agent_settled")?.length, 1);
	assert.ok(existsSync(toastPath));
	assert.match(readFileSync(toastPath, "utf8"), /ToastNotificationManager/);
});

test("the notification extension reads /fold settings and falls back to defaults", () => {
	const directory = mkdtempSync(resolve(tmpdir(), "pi-ui-plus-notify-"));
	try {
		assert.deepEqual(readSettings(directory), { foldReplies: true, recentCount: 3, notify: "auto", notifySound: true });
		writeFileSync(resolve(directory, "pi-ui-plus.json"), JSON.stringify({ foldReplies: false, recentCount: 9, notify: "off", notifySound: false }));
		assert.deepEqual(readSettings(directory), { foldReplies: false, recentCount: 5, notify: "off", notifySound: false });
		writeFileSync(resolve(directory, "pi-ui-plus.json"), "not json");
		assert.deepEqual(readSettings(directory), { foldReplies: true, recentCount: 3, notify: "auto", notifySound: true });
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
