/** Serves the built site, sweeps it with axe, and stops the server. */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
/**
 * Where the site's Playwright config reads the origin to sweep, as its
 * `baseURL`. The port is free when chosen rather than fixed, because a fixed
 * one may already answer with another checkout's preview, which would be swept
 * in this site's place and pass or fail on pages this site does not serve.
 */
export const ORIGIN_VARIABLE = "LEMONFIBER_A11Y_ORIGIN";
/** A port nothing on this machine listens on now. */
const freePort = () => new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
        const address = probe.address();
        const port = typeof address === "object" && address ? address.port : 0;
        probe.close(() => {
            resolve(port);
        });
    });
});
/** Serve the built site, sweep it with axe, and stop the server. */
export async function runA11y(options) {
    const ROOT = options.root.endsWith("/") ? options.root : `${options.root}/`;
    const BIN = `${ROOT}node_modules/.bin/`;
    const PORT = await freePort();
    const ORIGIN = `http://127.0.0.1:${String(PORT)}/`;
    const reachable = async () => {
        try {
            const response = await fetch(ORIGIN);
            return response.ok;
        }
        catch {
            return false;
        }
    };
    const stopDaemon = () => {
        spawnSync(`${BIN}astro`, ["preview", "stop"], {
            cwd: ROOT,
            stdio: "inherit",
        });
    };
    // A daemon an interrupted sweep left running answers a new `astro preview`
    // with its own port rather than the one asked for, so it goes first.
    stopDaemon();
    // `astro preview` daemonises on some platforms and stays in the foreground on
    // others, so the server is started without waiting on it and stopped both ways.
    const server = spawn(`${BIN}astro`, ["preview", "--port", String(PORT), "--host", "127.0.0.1"], { cwd: ROOT, stdio: "inherit", detached: false });
    const stop = () => {
        server.kill("SIGTERM");
        stopDaemon();
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
            spawnSync(`${BIN}playwright`, ["test"], {
                cwd: ROOT,
                stdio: "inherit",
                env: { ...process.env, [ORIGIN_VARIABLE]: ORIGIN },
            }).status ?? 1;
    else
        console.error("a11y: the preview server never answered");
    stop();
    process.exit(status);
}
