import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { writeFileSync } from "node:fs";

async function connect(host: Page, guest: Page) {
  for (const page of [host, guest]) {
    if ((await page.locator("#lan-menu").getAttribute("open")) === null)
      await page.locator("#lan-menu summary").first().click();
  }
  for (const page of [host, guest])
    if ((await page.locator("#lan-advanced").getAttribute("open")) === null)
      await page.locator("#lan-advanced > summary").click();
  await host
    .getByRole("button", { name: "Host LAN Game", exact: true })
    .click();
  await expect(host.locator("#lan-output")).toHaveValue(/"type":"offer"/);
  const offer = await host.locator("#lan-output").inputValue();
  expect(JSON.parse(offer).sdp).toContain("a=candidate:");
  await guest
    .getByRole("button", { name: "Join LAN Game", exact: true })
    .click();
  await guest.locator("#lan-code").fill(offer);
  await guest
    .getByRole("button", {
      name: "Paste Offer · Generate Answer",
      exact: true,
    })
    .click();
  await expect(guest.locator("#lan-output")).toHaveValue(/"type":"answer"/);
  await host
    .locator("#lan-code")
    .fill(await guest.locator("#lan-output").inputValue());
  await host
    .getByRole("button", { name: "Paste Answer · Connect", exact: true })
    .click();
  for (const page of [host, guest])
    await expect(page.locator("#lan-status")).toContainText("Connected");
}

test("native WebRTC manual UI exchange, independent movement, authoritative combat and cleanup", async ({
  browser,
}) => {
  const hostContext = await browser.newContext(),
    guestContext = await browser.newContext();
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const errors: string[] = [];
  for (const page of [host, guest])
    page.on("pageerror", (e) => errors.push(e.message));
  try {
    await Promise.all([
      host.goto("/?backend=webgl"),
      guest.goto("/?backend=webgl"),
    ]);
    await connect(host, guest);
    const overhead = await host.evaluate(() => {
      const m = (window as any).musou;
      return [20, 40].map((count) => {
        const world = new m.sim.constructor(count),
          replica = new m.lan.session.replicator.constructor();
        world.remotePlayers.set("p2", {
          player: { ...world.player },
          combat: new world.combat.constructor(),
        });
        const client = new m.sim.constructor(0),
          reader = new m.lan.session.replicator.constructor();
        const iterations = 1000,
          start = performance.now();
        let bytes = 0;
        for (let i = 0; i < iterations; i++) {
          const json = JSON.stringify(replica.capture(world, i));
          bytes += json.length;
          reader.apply(JSON.parse(json), client, "p2");
          reader.interpolate(client, 1 / 60, "p2");
        }
        return {
          enemies: count,
          iterations,
          captureEncodeDecodeApplyInterpolateMs:
            (performance.now() - start) / iterations,
          snapshotBytes: bytes / iterations,
          payloadBytesPerSecondAt15Hz: (bytes / iterations) * 15,
        };
      });
    });
    writeFileSync(
      "evidence/multiplayer-overhead.json",
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          environment:
            "Same-machine native Chromium, idle enemies, two players; excludes rendering and transport framing",
          results: overhead,
        },
        null,
        2,
      ),
    );
    console.log("Browser replication overhead", overhead);
    // Keep both independent browser windows active under headless Chromium.
    for (const page of [host, guest])
      await page.evaluate(() => (window as any).musou.pause(false));
    await expect
      .poll(() =>
        guest.evaluate(
          () => (window as any).musou.lan.session.replicator.applied,
        ),
      )
      .toBeGreaterThan(1);
    await guest.locator("#lan-menu summary").first().click();
    await guest.locator("#game").focus();
    const guestX = await guest.evaluate(
      () => (window as any).musou.sim.player.x,
    );
    await guest.keyboard.down("KeyD");
    await expect
      .poll(() =>
        host.evaluate(
          () => (window as any).musou.sim.remotePlayers.get("p2").player.x,
        ),
      )
      .toBeGreaterThan(guestX + 0.5);
    await guest.keyboard.up("KeyD");
    await host.locator("#lan-menu summary").first().click();
    await host.locator("#game").focus();
    await host.keyboard.down("KeyA");
    await expect
      .poll(() =>
        guest.evaluate(
          () => (window as any).musou.sim.remotePlayers.get("p1").player.x,
        ),
      )
      .toBeLessThan(-0.5);
    await host.keyboard.up("KeyA");
    // Controlled host fixture: put an existing enemy in guest melee reach, then attack through actual guest keyboard.
    await host.evaluate(() => {
      const s = (window as any).musou.sim,
        p = s.remotePlayers.get("p2").player;
      s.player.x = -15;
      s.player.z = -15;
      p.x = 0;
      p.z = 0;
      p.yaw = 0;
      p.recovery = 0;
      for (const e of s.enemies.enemies) {
        e.x = 20;
        e.z = 20;
      }
      Object.assign(s.enemies.enemies[0], {
        x: 0,
        z: 1,
        hp: 20,
        state: "stagger",
        timer: 5,
        vx: 0,
        vz: 0,
      });
    });
    await expect
      .poll(() =>
        guest.evaluate(() => (window as any).musou.sim.enemies.enemies[0].hp),
      )
      .toBe(20);
    await guest.locator("#game").focus();
    await guest.keyboard.press("KeyJ");
    await expect
      .poll(() =>
        host.evaluate(() => (window as any).musou.sim.enemies.enemies[0].state),
      )
      .toBe("dead");
    await expect
      .poll(() =>
        guest.evaluate(
          () => (window as any).musou.sim.enemies.enemies[0].state,
        ),
      )
      .toBe("dead");
    expect(
      await guest.evaluate(() => (window as any).musou.sim.player.kills),
    ).toBe(1);
    const diagnostics = await host.evaluate(() => {
      const s = (window as any).musou.lan.session;
      return {
        connection: s.transport.pc.connectionState,
        sentBytes: s.transport.sentBytes,
        receivedBytes: s.transport.receivedBytes,
        channels: [...s.transport.channels.keys()],
      };
    });
    console.log("Native WebRTC evidence", diagnostics);
    expect(diagnostics.connection).toBe("connected");
    expect(diagnostics.channels.sort()).toEqual(["events", "input", "state"]);
    await guest.locator("#lan-menu summary").first().click();
    await guest
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    await expect
      .poll(() =>
        host.evaluate(() => (window as any).musou.sim.remotePlayers.size),
      )
      .toBe(0);
    const tick = await host.evaluate(() => (window as any).musou.sim.ticks);
    await expect
      .poll(() => host.evaluate(() => (window as any).musou.sim.ticks))
      .toBeGreaterThan(tick);
    await guest
      .getByRole("button", { name: "Single Player", exact: true })
      .click();
    await expect(guest.locator("#lan-status")).toHaveText("Single Player");
    expect(
      await guest.evaluate(() => (window as any).musou.sim.remotePlayers.size),
    ).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test("host loss freezes client and a fresh manual exchange clears the old session", async ({
  browser,
}) => {
  const hc = await browser.newContext(),
    gc = await browser.newContext();
  const host = await hc.newPage(),
    guest = await gc.newPage();
  try {
    await Promise.all([
      host.goto("/?backend=webgl"),
      guest.goto("/?backend=webgl"),
    ]);
    await connect(host, guest);
    await expect
      .poll(() =>
        guest.evaluate(
          () => (window as any).musou.lan.session.replicator.applied,
        ),
      )
      .toBeGreaterThan(1);
    await host.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(guest.locator("#lan-status")).toContainText(
      /Repeat manual signaling/i,
    );
    expect(
      await guest.evaluate(() => (window as any).musou.lan.session.connected),
    ).toBe(false);
    expect(
      await guest.evaluate(() => (window as any).musou.sim.remotePlayers.size),
    ).toBe(0);
    const tick = await guest.evaluate(() => (window as any).musou.sim.ticks);
    await guest.locator("#game").focus();
    await guest.keyboard.press("KeyJ");
    expect(await guest.evaluate(() => (window as any).musou.sim.ticks)).toBe(
      tick,
    );
    await connect(host, guest);
    await expect
      .poll(() =>
        guest.evaluate(() => (window as any).musou.sim.remotePlayers.size),
      )
      .toBe(1);
    for (const page of [host, guest]) {
      await page
        .getByRole("button", { name: "Single Player", exact: true })
        .click();
      await expect(page.locator("#lan-status")).toHaveText("Single Player");
      expect(
        await page.evaluate(() => (window as any).musou.sim.remotePlayers.size),
      ).toBe(0);
    }
  } finally {
    await hc.close();
    await gc.close();
  }
});
