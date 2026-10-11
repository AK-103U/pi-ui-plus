import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const piPath = realpathSync(execFileSync("which", ["pi"], { encoding: "utf8" }).trim());
let hostRoot = dirname(piPath);
while (true) {
	const manifest = resolve(hostRoot, "package.json");
	if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === "@earendil-works/pi-coding-agent") break;
	const parent = dirname(hostRoot);
	if (parent === hostRoot) throw new Error("Cannot locate Pi's npm installation from PATH");
	hostRoot = parent;
}

const host = async (path) => import(pathToFileURL(resolve(hostRoot, "dist", path)).href);
const { loadExtensions, createExtensionRuntime } = await host("core/extensions/loader.js");
const pluginPath = fileURLToPath(new URL("../pi-agent-notify.ts", import.meta.url));
const toastPath = fileURLToPath(new URL("../assets/pi-toast.ps1", import.meta.url));
const require = createRequire(resolve(hostRoot, "package.json"));
const { summarizeTask } = require("jiti")(import.meta.url, { interopDefault: true })(pluginPath);

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
