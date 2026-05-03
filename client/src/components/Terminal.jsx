import { useEffect, useRef } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { socket } from "../socket/socket";

function Terminal({ roomId }) {
  const terminalContainerRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    const terminal = new XTerminal({
      cursorBlink: true,
      fontSize: 14,
      rows: 10,
      theme: {
        background: "#0f172a",
        foreground: "#e5e7eb"
      }
    });

    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(terminalContainerRef.current);
    fitAddon.fit();

    terminal.writeln("CodeSync Terminal");
    terminal.writeln("Type run and press Enter to execute JavaScript.");
    terminal.writeln("Type clear to clear terminal.");
    terminal.write("> ");

    let command = "";

    terminal.onData((data) => {
      if (data === "\r") {
        terminal.writeln("");

        const trimmedCommand = command.trim();

        if (trimmedCommand === "run") {
          terminal.writeln("Running code...");
          socket.emit("run-code", { roomId });
        } else if (trimmedCommand === "clear") {
          terminal.clear();
          terminal.write("> ");
        } else if (trimmedCommand.length === 0) {
          terminal.write("> ");
        } else {
          terminal.writeln(`Unknown command: ${trimmedCommand}`);
          terminal.write("> ");
        }

        command = "";
      } else if (data === "\u007F") {
        if (command.length > 0) {
          command = command.slice(0, -1);
          terminal.write("\b \b");
        }
      } else {
        command += data;
        terminal.write(data);
      }
    });

    function handleTerminalOutput({ output }) {
      terminal.write(output);
    }

    function handleTerminalDone() {
      terminal.writeln("");
      terminal.write("> ");
    }

    socket.on("terminal-output", handleTerminalOutput);
    socket.on("terminal-done", handleTerminalDone);

    terminalRef.current = terminal;

    return () => {
      socket.off("terminal-output", handleTerminalOutput);
      socket.off("terminal-done", handleTerminalDone);
      terminal.dispose();
    };
  }, [roomId]);

  return <div className="terminal-container" ref={terminalContainerRef} />;
}

export default Terminal;