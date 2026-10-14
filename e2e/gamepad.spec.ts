import { expect, test } from "@playwright/test";
import type { Simulation } from "../src/GameLoop";
interface TestPad {
  connected: boolean;
  id: string;
  index: number;
  mapping: string;
  timestamp: number;
  axes: number[];
  buttons: { pressed: boolean; value: number; touched: boolean }[];
}
interface TestWindow extends Window {
  testPad: TestPad;
  musou: { sim: Simulation };
}
test("gamepad movement, camera, attack edge and restart edge on a nonzero device slot", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const pad = {
      connected: true,
      id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
      index: 1,
      mapping: "standard",
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({
        pressed: false,
        value: 0,
        touched: false,
      })),
    };
    Object.assign(window, { testPad: pad });
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [null, pad],
    });
  });
  await page.goto("/?backend=webgl");
  await expect(page.locator("#status")).toContainText("WebGL2");
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    w.musou.sim.reset(0);
    w.testPad.axes[0] = 0.8;
    w.testPad.axes[2] = 0.5;
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as TestWindow).musou.sim.player.x),
    )
    .toBeGreaterThan(0.3);
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    w.testPad.axes = [0, 0, 0, 0];
    w.testPad.buttons[0]!.pressed = true;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as TestWindow).musou.sim.player.stage,
      ),
    )
    .toBe(1);
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(
      () => (window as unknown as TestWindow).musou.sim.player.stage,
    ),
  ).toBe(1);
  await page.evaluate(
    () =>
      ((window as unknown as TestWindow).testPad.buttons[3]!.pressed = true),
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as TestWindow).musou.sim.player.x),
    )
    .toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as TestWindow).musou.sim.ticks),
    )
    .toBeGreaterThan(15);
  expect(
    await page.evaluate(
      () => (window as unknown as TestWindow).musou.sim.player.x,
    ),
  ).toBe(0);
  expect(errors).toEqual([]);
});
test("focused HUD controls do not trigger player combat shortcuts", async ({
  page,
}) => {
  await page.goto("/?backend=webgl");
  await expect(page.locator("#status")).toContainText("WebGL2");
  await page.evaluate(() =>
    (window as unknown as TestWindow).musou.sim.reset(0),
  );
  await page.locator("#export").focus();
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(
      () => (window as unknown as TestWindow).musou.sim.player.stage,
    ),
  ).toBe(0);
});
