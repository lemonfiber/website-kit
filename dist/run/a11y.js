/** Serves the built site, sweeps it with axe, and stops the server. */
import { spawn, spawnSync } from "node:child_process";
/** Serve the built site, sweep it with axe, and stop the server. */
export async function runA11y(options) {
    const ROOT = options.root.endsWith("/") ? options.root : `${options.root}/`;
    const BIN = `${ROOT}node_modules/.bin/`;
    const ORIGIN = "http://127.0.0.1:4321/";
    const reachable = async () => {
        try {
            const response = await fetch(ORIGIN);
            return response.ok;
        }
        catch {
            return false;
        }
    };
    // `astro preview` daemonises on some platforms and stays in the foreground on
    // others, so the server is started without waiting on it and stopped both ways.
    const server = spawn(`${BIN}astro`, ["preview", "--port", "4321", "--host", "127.0.0.1"], { cwd: ROOT, stdio: "inherit", detached: false });
    const stop = () => {
        server.kill("SIGTERM");
        spawnSync(`${BIN}astro`, ["preview", "stop"], {
            cwd: ROOT,
            stdio: "inherit",
        });
    };
    /** How many times the server is asked before it is taken as never coming up. */
    const ATTEMPTS = 120;
    /** How long to wait between two of those. */
    const PAUSE_MS = 500;
    // Asked one attempt after another rather than in a loop, because each attempt
    // waits on the one before it: a server that answers ends the asking.
    const answered = async (left) => {
        if (left === 0)
            return false;
        if (await reachable())
            return true;
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        return answered(left - 1);
    };
    const up = await answered(ATTEMPTS);
    let status = 1;
    if (up)
        status =
            spawnSync(`${BIN}playwright`, ["test"], { cwd: ROOT, stdio: "inherit" })
                .status ?? 1;
    else
        console.error("a11y: the preview server never answered");
    stop();
    process.exit(status);
}
