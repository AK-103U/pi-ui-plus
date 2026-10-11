"""Offline PTY smoke test. Requires only Python 3, Node and Pi on PATH."""
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import shutil
import signal
import struct
import subprocess
import tempfile
import termios
import time

ROOT = Path(__file__).resolve().parents[1]
HOST = Path(shutil.which("pi")).resolve().parent
while not (HOST / "package.json").exists() or json.loads((HOST / "package.json").read_text()).get("name") != "@earendil-works/pi-coding-agent":
    if HOST.parent == HOST:
        raise RuntimeError("Cannot locate Pi's npm installation")
    HOST = HOST.parent

FIXTURE = r"""
import { SessionManager } from HOST;
const session = SessionManager.create(process.cwd(), process.argv[1]);
const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const base = { role: 'assistant', api: 'openai-responses', provider: 'openai', model: 'gpt-4o', timestamp: Date.now(), usage };
for (let n = 1; n <= 2; n++) {
 session.appendMessage({ role: 'user', content: [{ type: 'text', text: 'QUESTION_' + n }], timestamp: Date.now() });
 const id = 'call-' + n;
 session.appendMessage({ ...base, content: [{ type: 'toolCall', id, name: 'read', arguments: { path: `file-${n}.ts` } }], stopReason: 'toolUse' });
 session.appendMessage({ role: 'toolResult', toolCallId: id, toolName: 'read', content: [{ type: 'text', text: Array.from({ length: 100 }, (_, i) => `RAW_OUTPUT_${n}_${i}`).join('\n') }], isError: false, timestamp: Date.now(), durationMs: 24 });
 session.appendMessage({ ...base, content: [{ type: 'thinking', thinking: 'THOUGHT_' + n }, { type: 'text', text: `RAW_REPLY_${n}` }], stopReason: 'stop' });
}
console.log(session.getSessionFile());
""".replace("HOST", json.dumps(str(HOST / "dist/core/session-manager.js")))


def plain(text):
    return re.sub(r"\x1b\[[0-9;]*m", "", text)


class Terminal:
    def __init__(self, mode, env, session):
        self.master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 110, 0, 0))
        self.mode = mode
        self.output = bytearray()
        self.process = subprocess.Popen([
            "pi", "--offline", "--no-extensions", "--no-skills", "--no-context-files",
            "--no-prompt-templates", "--no-themes", "--no-approve", "-e",
            str(ROOT / "pi-ui-plus/index.ts"), "--session", session, "--tui-mode", mode,
        ], cwd=ROOT, stdin=slave, stdout=slave, stderr=slave, env=env, start_new_session=True)
        os.close(slave)

    def drain(self, duration=0.2):
        end = time.monotonic() + duration
        while time.monotonic() < end:
            if select.select([self.master], [], [], 0.025)[0]:
                try:
                    chunk = os.read(self.master, 65536)
                except OSError:
                    break
                self.output.extend(chunk)

    def send(self, text):
        self.drain()
        mark = len(self.output)
        os.write(self.master, text.encode() if isinstance(text, str) else text)
        return mark

    def until(self, marker, mark=0, timeout=10):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            self.drain(0.05)
            text = plain(self.output[mark:].decode(errors="replace"))
            if marker in text:
                return text
            if self.process.poll() is not None:
                break
        raise AssertionError(f"{self.mode}: missing {marker!r}; tail={text[-2000:]!r}")

    def quit(self):
        self.send("/quit\r")
        end = time.monotonic() + 10
        while self.process.poll() is None and time.monotonic() < end:
            self.drain(0.1)
        self.process.wait(timeout=1)
        assert self.process.returncode == 0, self.process.returncode
        log = plain(self.output.decode(errors="replace"))
        for error in ["Failed to load extension", "Extension error", "TypeError:", "ReferenceError:"]:
            assert error not in log, log[-2000:]

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        os.close(self.master)


with tempfile.TemporaryDirectory(prefix="pi-ui-plus-smoke-") as temporary:
    for mode in ["regular", "fullscreen"]:
        agent = Path(temporary) / mode
        agent.mkdir()
        (agent / "settings.json").write_text(json.dumps({
            "quietStartup": True, "enableInstallTelemetry": False, "enableAnalytics": False,
            "hideThinkingBlock": True, "doubleEscapeAction": "none", "fullscreenExitOutput": "hint",
        }))
        env = dict(os.environ, PI_CODING_AGENT_DIR=str(agent), PI_UI_LANG="zh", PI_OFFLINE="1", TERM="xterm-256color")
        session = subprocess.check_output(["node", "--input-type=module", "-e", FIXTURE, str(agent / "sessions")], env=env, text=True, cwd=ROOT).strip()
        terminal = Terminal(mode, env, session)
        try:
            initial = terminal.until("RAW_REPLY_2")
            assert "RAW_OUTPUT_" not in initial, "closed tool output leaked"
            assert "上一轮回复" in initial, "previous final reply is not folded"

            mark = terminal.send("/settings")
            terminal.until("打开设置菜单", mark)
            mark = terminal.send("\r")
            settings = terminal.until("自动压缩上下文", mark)
            assert "Interface language" not in settings and "界面语言" not in settings
            terminal.send(b"\x1b")

            mark = terminal.send("/hotkeys\r")
            terminal.until("全屏对话导航", mark)
            terminal.until("展开或收起最近一块工具调用或旧回复", mark)

            mark = terminal.send("/fold\r")
            terminal.until("/fold · 选择轮次", mark)
            terminal.until("l English", mark)
            mark = terminal.send(b"\x1b[B\r")
            terminal.until("第 1 轮 · 工具调用", mark)
            mark = terminal.send("\r")
            terminal.until("▼ read", mark)
            mark = terminal.send("l")
            terminal.until("Turn 1 · Tool calls", mark)
            terminal.until("l 简体中文", mark)
            assert json.loads((agent / "ui-language.json").read_text()) == {"language": "en"}
            mark = terminal.send(b"\x1b")
            terminal.until("/fold · Choose a turn", mark)
            terminal.send(b"\x1b")

            mark = terminal.send("/settings")
            terminal.until("Open settings menu", mark)
            mark = terminal.send("\r")
            terminal.until("Auto-compact", mark)
            terminal.send(b"\x1b")
            mark = terminal.send("/hotkeys\r")
            if mode == "fullscreen":
                terminal.send(b"\x1b[1;5F")
                # The preceding language change can already have drawn the same
                # English hotkeys. Resize to verify the full screen, not a delta.
                fcntl.ioctl(terminal.master, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 109, 0, 0))
                os.kill(terminal.process.pid, signal.SIGWINCH)
            terminal.until("Fullscreen navigation", mark)
            terminal.until("Toggle the latest tool call or previous reply", mark)

            mark = terminal.send("/reload\r")
            if mode == "fullscreen":
                terminal.send(b"\x1b[1;5F")
            terminal.until("Reloaded keybindings", mark)
            mark = terminal.send("/fold\r")
            terminal.until("/fold · Choose a turn", mark)
            terminal.send(b"\x1b")
            mark = terminal.send("/fold")
            terminal.until("Browse tools and previous replies by turn", mark)
            terminal.send(b"\x03")  # Clear completion without submitting a message.
            terminal.quit()
        finally:
            terminal.close()

        # A fresh Pi process keeps the saved preference ahead of PI_UI_LANG=zh.
        terminal = Terminal(mode, env, session)
        try:
            terminal.until("RAW_REPLY_2")
            mark = terminal.send("/fold\r")
            terminal.until("/fold · Choose a turn", mark)
            terminal.send(b"\x1b")
            terminal.quit()
        finally:
            terminal.close()
        entries = [json.loads(line) for line in Path(session).read_text().splitlines()]
        assert not any(entry.get("type") == "custom" for entry in entries), "UI preferences leaked into session metadata"
        print(f"{mode}: single entry, native UI/autocomplete, fold toggles, l, reload, process restart and clean exit passed")
