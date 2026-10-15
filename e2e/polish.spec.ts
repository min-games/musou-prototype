import { test, expect } from "@playwright/test";
import type { Simulation } from "../src/GameLoop";
interface TestWindow extends Window {
  musou: { sim: Simulation; pause: (value: boolean) => void };
  specialTestPad: {
    buttons: { pressed: boolean; value: number; touched: boolean }[];
  };
}

test("earned Solar Break hits the mixed crowd and displays its shockwave", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?practice=1&backend=webgl");
  await expect(page.locator("#status")).toContainText("WebGL2");
  await expect(page.locator("#roster")).toContainText("Flanker");
  await expect(page.locator("#roster")).toContainText("Armored");
  await page.evaluate(() => {
    const sim = (window as unknown as TestWindow).musou.sim;
    sim.reset();
    sim.enemies.enemies.forEach((e, i) => {
      e.x = ((i % 5) - 2) * 0.25;
      e.z = 1.5 + Math.floor(i / 5) * 0.15;
    });
  });
  await page.keyboard.press("KeyJ");
  await expect(page.locator("#charge")).toHaveText("READY");
  await page.keyboard.press("KeyQ");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as TestWindow).musou.sim.player.specials,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as TestWindow).musou.sim.player.kills,
      ),
    )
    .toBeGreaterThanOrEqual(12);
  await page.evaluate(() => {
    const m = (window as unknown as TestWindow).musou;
    m.pause(true);
    // Capture a deterministic combat pose after verifying the real keyboard cast.
    m.sim.reset();
    m.sim.player.charge = 100;
    m.sim.enemies.enemies.forEach((enemy, i) => {
      const angle = (i * Math.PI * 2) / 20,
        radius = 3 + Math.floor(i / 5) * 0.6;
      enemy.x = Math.sin(angle) * radius;
      enemy.z = Math.cos(angle) * radius;
    });
    for (let i = 0; i < 24; i++)
      m.sim.step({
        x: 0,
        z: 0,
        yaw: 0,
        attack: false,
        respawn: false,
        special: i === 0,
      });
  });
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(
      () => (window as unknown as TestWindow).musou.sim.player.charge,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => (window as unknown as TestWindow).musou.sim.player.hp,
    ),
  ).toBe(100);
  await expect(page).toHaveScreenshot("solar-break.png", {
    maxDiffPixelRatio: 0.04,
  });
  await page.screenshot({ path: "evidence/solar-break.png" });
  expect(errors).toEqual([]);
});

test("empty special, dodge, pause and reduced motion keep controls consistent", async ({
  page,
}) => {
  await page.goto("/?practice=1&backend=webgl");
  await expect(page.locator("#status")).toContainText("WebGL2");
  await page.evaluate(() =>
    (window as unknown as TestWindow).musou.sim.reset(0),
  );
  await page.keyboard.press("KeyQ");
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(
      () => (window as unknown as TestWindow).musou.sim.player.specials,
    ),
  ).toBe(0);
  await page.keyboard.down("KeyD");
  await page.keyboard.press("ShiftLeft");
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as TestWindow).musou.sim.player.x),
    )
    .toBeGreaterThan(0.2);
  await page.keyboard.up("KeyD");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pause-overlay")).toBeVisible();
  const x = await page.evaluate(
    () => (window as unknown as TestWindow).musou.sim.player.x,
  );
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(200);
  await page.keyboard.up("KeyD");
  expect(
    await page.evaluate(
      () => (window as unknown as TestWindow).musou.sim.player.x,
    ),
  ).toBe(x);
  await page.locator("#reduced-motion").check();
  await page.locator("#pause").click();
  await expect(page.locator("#pause-overlay")).toBeHidden();
  await page.locator("#game").click();
  await page.keyboard.down("KeyD");
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as TestWindow).musou.sim.player.x),
    )
    .toBeGreaterThan(x);
  await page.keyboard.up("KeyD");
});

test("gamepad special and dodge are discrete edges", async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      connected: true,
      id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
      index: 0,
      mapping: "standard",
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({
        pressed: false,
        value: 0,
        touched: false,
      })),
    };
    Object.assign(window, { specialTestPad: pad });
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
  });
  await page.goto("/?practice=1&backend=webgl");
  await expect(page.locator("#status")).toContainText("WebGL2");
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    w.musou.sim.reset(0);
    w.musou.sim.player.charge = 100;
    w.specialTestPad.buttons[1]!.pressed = true;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as TestWindow).musou.sim.player.specials,
      ),
    )
    .toBe(1);
  await page.waitForTimeout(1000);
  await page.evaluate(
    () => ((window as unknown as TestWindow).musou.sim.player.charge = 100),
  );
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(
      () => (window as unknown as TestWindow).musou.sim.player.specials,
    ),
  ).toBe(1);
  await page.evaluate(
    () =>
      ((window as unknown as TestWindow).specialTestPad.buttons[1]!.pressed =
        false),
  );
  await page.waitForTimeout(60);
  await page.evaluate(
    () =>
      ((window as unknown as TestWindow).specialTestPad.buttons[2]!.pressed =
        true),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as TestWindow).musou.sim.player.dashCooldown,
      ),
    )
    .toBeGreaterThan(0);
});
