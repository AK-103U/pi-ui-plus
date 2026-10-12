import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const MANIFEST = "@earendil-works/pi-coding-agent";

function walkUp(start) {
	let root = start;
	while (true) {
		const manifest = resolve(root, "package.json");
		if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === MANIFEST) return root;
		const parent = dirname(root);
		if (parent === root) return undefined;
		root = parent;
	}
}

/** Locate the installed Pi npm package across POSIX shells and Windows shims. */
export function findHostRoot() {
	if (process.platform === "win32") {
		// The `pi` shim is a .cmd/.ps1 script that hardcodes the bundle path.
		const candidates = execFileSync("where", ["pi"], { encoding: "utf8" }).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
		for (const candidate of candidates) {
			let text;
			try { text = readFileSync(candidate, "utf8"); } catch { continue; }
			const match = /([A-Za-z]:[\\/][^"\r\n]*?node_modules[\\/]@earendil-works[\\/]pi-coding-agent)/.exec(text);
			if (match) {
				const root = walkUp(resolve(match[1]));
				if (root) return root;
			}
		}
		throw new Error("Cannot locate Pi's npm installation from PATH");
	}
	const hostRoot = walkUp(dirname(realpathSync(execFileSync("which", ["pi"], { encoding: "utf8" }).trim())));
	if (!hostRoot) throw new Error("Cannot locate Pi's npm installation from PATH");
	return hostRoot;
}

/** Resolve a peer package from Pi's install, covering pnpm's hoisted layout. */
export function hostRequire(hostRoot) {
	const candidates = [
		resolve(hostRoot, "package.json"),
		resolve(hostRoot, "../../.pnpm/node_modules/"),
		resolve(hostRoot, "../.pnpm/node_modules/"),
	];
	for (const candidate of candidates) {
		const require = createRequire(candidate);
		try { require.resolve("@earendil-works/pi-tui"); return require; } catch { /* try the next layout */ }
	}
	throw new Error("Cannot resolve @earendil-works/pi-tui from Pi's install");
}
