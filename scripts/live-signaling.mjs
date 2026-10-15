// Opt-in, ONE production create attempt per invocation; never part of test:e2e.
// Budget: <= TWO deliberate invocations for a validation session (50 attempts/day globally).
import { chromium } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
if (process.env.MUSOU_LIVE_SIGNALING !== "1")
  throw new Error(
    "Opt in with MUSOU_LIVE_SIGNALING=1 after npm run build. This consumes one live room attempt; do not automatically retry.",
  );
const root = resolve("dist");
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const contexts = [];
let stage = "loading locally built game at production Origin";
try {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    contexts.push(context);
    await context.route("https://min-games.github.io/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let relative = path.replace(/^\/musou-prototype\//, "");
      if (!relative || relative.endsWith("/")) relative += "index.html";
      const file = resolve(root, relative);
      if (!file.startsWith(root + sep)) return route.abort();
      try {
        if (!(await stat(file)).isFile()) return route.abort();
        const mime = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".webmanifest": "application/manifest+json",
        };
        await route.fulfill({
          body: await readFile(file),
          contentType: mime[extname(file)] ?? "application/octet-stream",
        });
      } catch {
        await route.fulfill({ status: 404, body: "Missing local asset" });
      }
    });
  }
  const host = await contexts[0].newPage(),
    guest = await contexts[1].newPage();
  const url = "https://min-games.github.io/musou-prototype/?backend=webgl";
  await Promise.all([host.goto(url), guest.goto(url)]);
  for (const page of [host, guest])
    await page.locator("#lan-menu > summary").click();
  stage = "single live create request";
  await host.locator("#room-create").click();
  await host.waitForFunction(
    () =>
      document
        .querySelector("#room-status")
        ?.textContent?.includes("Room ready"),
    undefined,
    { timeout: 25000 },
  );
  const code = await host.locator("#room-code").inputValue();
  stage = "live guest join and native WebRTC connection";
  await guest.locator("#room-code").fill(code);
  await guest.locator("#room-join").click();
  for (const page of [host, guest])
    await page.waitForFunction(
      () => window.musou?.lan.session?.connected,
      undefined,
      { timeout: 45000 },
    );
  for (const page of [host, guest])
    await page.evaluate(() => window.musou.pause(false));
  stage = "native movement through live-negotiated channels";
  await guest.locator("#lan-menu > summary").click();
  await guest.locator("#game").focus();
  const x = await host.evaluate(
    () => window.musou.sim.remotePlayers.get("p2").player.x,
  );
  await guest.keyboard.down("KeyD");
  await host.waitForFunction(
    (x) => window.musou.sim.remotePlayers.get("p2").player.x > x + 0.5,
    x,
    { timeout: 15000 },
  );
  await guest.keyboard.up("KeyD");
  console.log(
    JSON.stringify({
      result: "passed",
      roomAttempts: 1,
      origin: new URL(url).origin,
      signaling: "real HTTPS/WSS, not routed",
      gameplay: "three native DataChannels, guest movement observed by host",
      limitations:
        "Local dist routed under production Origin; not a deployed build or physical LAN test.",
    }),
  );
} catch {
  // Never print raw HTTP/WS messages, errors, or credentials.
  console.error(
    JSON.stringify({
      result: "blocked or failed",
      stage,
      roomAttempts: "at most one; no retries",
      limitations:
        "Local dist under production Origin; no deployment or physical LAN claim.",
    }),
  );
  for (const context of contexts)
    for (const page of context.pages()) {
      console.error(
        "UI:",
        await page
          .locator("#room-status")
          .textContent()
          .catch(() => "unavailable"),
      );
    }
  process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
