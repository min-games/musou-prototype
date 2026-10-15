import { test, expect } from "@playwright/test";
import type { Simulation } from "../src/GameLoop";
import type { RunDirector } from "../src/RunDirector";
interface RunWindow extends Window {
  musou: { sim: Simulation; run: RunDirector; pause: (value: boolean) => void };
  runPad: { buttons: { pressed: boolean; value: number; touched: boolean }[] };
}
test("choose the ranger, fire assisted arrows, use its special and spend a bomb", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?backend=webgl");
  await expect(page.locator("#run-title")).toHaveText("Choose your fighter");
  await expect(page.locator("#run-overlay")).toBeVisible();
  await page.keyboard.press("Digit2");
  await expect(page.locator("#run-overlay")).toBeHidden();
  await expect(page.locator("#hp")).toHaveText("85 / 85");
  await expect(page.locator("#objective")).toContainText("WAVE 1 / 5");
  await page.evaluate(() => {
    const s = (window as unknown as RunWindow).musou.sim;
    s.enemies.enemies.forEach((e, i) => {
      e.x = i === 0 ? 1 : 20;
      e.z = i === 0 ? 8 : -20;
    });
    s.enemies.enemies[0]!.hp = 1000;
    s.enemies.enemies[0]!.maxHp = 1000;
  });
  await page.keyboard.down("KeyJ");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as RunWindow).musou.sim.player.hits,
      ),
    )
    .toBeGreaterThan(0);
  await page.keyboard.down("KeyS");
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as RunWindow).musou.sim.player.z),
    )
    .toBeLessThan(-0.4);
  await page.keyboard.up("KeyS");
  await page.keyboard.up("KeyJ");
  await page.evaluate(() => {
    (window as unknown as RunWindow).musou.sim.player.charge = 100;
  });
  await page.keyboard.press("KeyQ");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as RunWindow).musou.sim.player.specials,
      ),
    )
    .toBe(1);
  await expect(page.locator("#special-name")).toContainText("ARROW STORM");
  await page.evaluate(() => {
    const m = (window as unknown as RunWindow).musou;
    m.pause(true);
    m.run.start("ranger");
    m.sim.player.charge = 100;
    m.sim.enemies.enemies.forEach((e, i) => {
      e.x = ((i % 5) - 2) * 1.1;
      e.z = 6 + Math.floor(i / 5) * 1.1;
    });
    m.sim.pickups = [
      { id: 500, x: -2, z: 0, kind: "health" },
      { id: 501, x: 2, z: 0, kind: "power" },
      { id: 502, x: 3, z: -1, kind: "bomb" },
      { id: 503, x: -3, z: -1, kind: "charge" },
    ];
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
  await page.waitForTimeout(150);
  await expect(page).toHaveScreenshot("ranger-storm.png", {
    maxDiffPixelRatio: 0.04,
  });
  await page.screenshot({ path: "evidence/ranger-storm.png" });
  await page.evaluate(() => {
    const m = (window as unknown as RunWindow).musou;
    m.run.start("ranger");
    m.sim.enemies.enemies.forEach((e, i) => {
      e.x = i === 0 ? 0 : 20;
      e.z = i === 0 ? 3 : -20;
    });
    m.pause(false);
  });
  await page.keyboard.press("KeyF");
  await expect(page.locator("#bomb-count")).toHaveText("0");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as RunWindow).musou.sim.player.kills,
      ),
    )
    .toBe(1);
  expect(errors).toEqual([]);
});

test("clear finite waves, pick relics, win and retry with a fresh build", async ({
  page,
}) => {
  await page.goto("/?backend=webgl");
  await expect(page.locator("#run-title")).toHaveText("Choose your fighter");
  await page.keyboard.press("Enter");
  await expect(page.locator("#run-overlay")).toBeHidden();
  for (let wave = 1; wave <= 5; wave++) {
    await expect(page.locator("#objective")).toContainText(`WAVE ${wave} / 5`);
    await page.evaluate(() => {
      const m = (window as unknown as RunWindow).musou;
      for (const e of m.sim.enemies.enemies)
        m.sim.combat.applyHit(m.sim.player, e, 10000, true);
      for (let i = 0; i < 61; i++)
        m.run.step({ x: 0, z: 0, yaw: 0, attack: false, respawn: false });
    });
    if (wave < 5) {
      await expect(page.locator("#run-title")).toContainText(
        `Wave ${wave} cleared`,
      );
      if (wave === 1) {
        await expect(page).toHaveScreenshot("relic-choice.png", {
          maxDiffPixelRatio: 0.04,
        });
        await page.screenshot({ path: "evidence/relic-choice.png" });
      }
      await page.keyboard.press("Digit1");
      await expect(page.locator("#run-overlay")).toBeHidden();
    }
  }
  await expect(page.locator("#run-title")).toHaveText("FIELD CLEARED");
  await expect(page.locator("#run-description")).toContainText("144 defeated");
  await page.keyboard.press("Enter");
  await expect(page.locator("#objective")).toContainText("WAVE 1 / 5");
  expect(
    await page.evaluate(() => {
      const m = (window as unknown as RunWindow).musou;
      return {
        damage: m.sim.player.damageMult,
        bombs: m.sim.player.bombs,
        build: m.run.build,
      };
    }),
  ).toEqual({ damage: 1, bombs: 1, build: [] });
  await page.evaluate(() => {
    (window as unknown as RunWindow).musou.sim.player.hp = 0;
  });
  await expect(page.locator("#run-title")).toHaveText(
    "You fell. Try a new build.",
  );
  await page.keyboard.press("Digit2");
  await expect(page.locator("#run-title")).toHaveText("Choose your fighter");
});

test("gamepad navigates hero and relic menus without a keyboard", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const pad = {
      connected: true,
      id: "Test standard pad",
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
    Object.assign(window, { runPad: pad });
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
  });
  await page.goto("/?backend=webgl");
  await expect(page.locator("#run-title")).toHaveText("Choose your fighter");
  const press = async (index: number) => {
    await page.evaluate((i) => {
      (window as unknown as RunWindow).runPad.buttons[i]!.pressed = true;
    }, index);
    await page.waitForTimeout(120);
    await page.evaluate((i) => {
      (window as unknown as RunWindow).runPad.buttons[i]!.pressed = false;
    }, index);
    await page.waitForTimeout(120);
  };
  await press(13);
  await expect(page.locator("#run-choices button").nth(1)).toBeFocused();
  await press(0);
  await expect(page.locator("#hp")).toHaveText("85 / 85");
  await page.evaluate(() => {
    const m = (window as unknown as RunWindow).musou;
    for (const e of m.sim.enemies.enemies)
      m.sim.combat.applyHit(m.sim.player, e, 10000, true);
    for (let i = 0; i < 61; i++)
      m.run.step({ x: 0, z: 0, yaw: 0, attack: false, respawn: false });
  });
  await expect(page.locator("#run-title")).toContainText("Wave 1 cleared");
  await press(13);
  await expect(page.locator("#run-choices button").nth(1)).toBeFocused();
  await press(0);
  await expect(page.locator("#objective")).toContainText("WAVE 2 / 5");
});

test("character choice fits a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?backend=webgl");
  await expect(page.locator("#run-title")).toHaveText("Choose your fighter");
  await expect(page.locator("#run-choices button").nth(1)).toBeInViewport();
  await expect(page).toHaveScreenshot("hero-choice-mobile.png", {
    maxDiffPixelRatio: 0.05,
  });
  await page.screenshot({ path: "evidence/hero-choice-mobile.png" });
});
