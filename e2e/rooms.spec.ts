import { test, expect, evidencePath } from "./fixtures";
import type { Page } from "@playwright/test";
import { signalingFixture } from "./signaling-fixture";
let fixture: Awaited<ReturnType<typeof signalingFixture>>;
test.beforeAll(async () => {
  fixture = await signalingFixture();
});
test.afterAll(async () => {
  await fixture.close();
});
async function connect(host: Page, guest: Page) {
  await host.locator("#lan-menu > summary").click();
  await host.locator("#room-create").click();
  await expect(host.locator("#room-code")).toHaveValue(/^[A-Z2-9]{8}$/);
  const code = await host.locator("#room-code").inputValue();
  const link = await host.locator("#room-invite").inputValue();
  expect(link).toBe(`http://127.0.0.1:5187/#room=${code}`);
  expect(link).not.toContain("token");
  await guest.goto(`/?backend=webgl#room=${code}`);
  await expect(guest.locator("#room-code")).toHaveValue(code);
  expect(
    await guest.evaluate(() => (window as any).musou.lan.session),
  ).toBeUndefined();
  await guest.locator("#room-join").click();
  for (const page of [host, guest])
    await expect(page.locator("#lan-status")).toContainText("Connected");
  expect(fixture.errors).toEqual([]);
}
test("native automatic Create/Join, movement, authoritative combat, signaling expiry and cleanup", async ({
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
    fixture.expire();
    for (const page of [host, guest]) {
      await expect(page.locator("#room-status")).toContainText(
        "Gameplay continues",
      );
      expect(
        await page.evaluate(() => (window as any).musou.lan.session.connected),
      ).toBe(true);
    }
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

test("room errors, invite prefill, cancellation, desktop and narrow room UI", async ({
  page,
}) => {
  await page.goto("/?backend=webgl#room=ABCD2345&token=ignored");
  await expect(page.locator("#room-code")).toHaveValue("ABCD2345");
  await expect(page.locator("#room-status")).toContainText("Select Join Game");
  await page.screenshot({ path: evidencePath("room-ui-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: evidencePath("room-ui-narrow.png") });
  const bounds = await page.locator("#lan-menu").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.locator("#room-join").click();
  await expect(page.locator("#room-status")).toContainText("Room not found");
  // Failed HTTP mutations are never retried automatically.
  const count = fixture.requests.length;
  await page.waitForTimeout(1500);
  expect(fixture.requests.length).toBe(count);
  await page.locator("#room-create").click();
  await expect(page.locator("#room-status")).toContainText("Room ready");
  await page.locator("#lan-single").click();
  await expect(page.locator("#room-invite")).toHaveValue("");
  await expect(page.locator("#lan-status")).toHaveText("Single Player");
});

test("full room and canceled room request do not auto-retry or create a session", async ({
  browser,
}) => {
  const hc = await browser.newContext(),
    gc = await browser.newContext(),
    third = await browser.newContext();
  try {
    const host = await hc.newPage(),
      guest = await gc.newPage(),
      other = await third.newPage();
    await Promise.all([
      host.goto("/?backend=webgl"),
      guest.goto("/?backend=webgl"),
    ]);
    await connect(host, guest);
    const code = await host.locator("#room-code").inputValue();
    await other.goto(`/?backend=webgl#room=${code}`);
    await other.locator("#room-join").click();
    await expect(other.locator("#room-status")).toContainText(
      "already has a guest",
    );
    expect(
      await other.evaluate(() => (window as any).musou.lan.session),
    ).toBeUndefined();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let called!: () => void;
    const requested = new Promise<void>((resolve) => {
      called = resolve;
    });
    await other.route("http://127.0.0.1:5190/v1/rooms", async (route) => {
      called();
      await blocked;
      await route.abort();
    });
    await other.locator("#room-create").click();
    await requested;
    await other.locator("#lan-single").click();
    release();
    await expect(other.locator("#lan-status")).toHaveText("Single Player");
    await expect(other.locator("#room-status")).toHaveText("");
    expect(
      await other.evaluate(() => (window as any).musou.lan.session),
    ).toBeUndefined();
  } finally {
    await hc.close();
    await gc.close();
    await third.close();
  }
});
