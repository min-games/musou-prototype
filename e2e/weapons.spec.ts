import { test, expect } from "./fixtures";
import type { Simulation } from "../src/GameLoop";
import type { RunDirector } from "../src/RunDirector";
interface W extends Window {
  musou: { sim: Simulation; run: RunDirector; pause: (v: boolean) => void };
}
test("Fan Bow fires at separate targets and seven-arrow upgrades have a readable spread", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?backend=webgl");
  await expect(page.locator("#run-overlay")).toBeVisible();
  await page.keyboard.press("Digit2");
  await expect(page.locator("#run-title")).toHaveText(
    "Ranger · Choose your weapon",
  );
  await expect(page.locator("#run-choices")).toContainText("Longbow");
  await expect(page.locator("#run-choices")).toContainText("1.88 volleys/s");
  await expect(page).toHaveScreenshot("bow-loadouts.png", {
    maxDiffPixelRatio: 0.04,
  });
  await page.screenshot({ path: "evidence/bow-loadouts.png" });
  await page.keyboard.press("Digit3");
  await expect(page.locator("#weapon-stats")).toContainText("Fan Bow");
  await expect(page.locator("#weapon-stats")).toContainText("3 arrows");
  await page.evaluate(() => {
    const s = (window as unknown as W).musou.sim;
    s.enemies.enemies.forEach((e, i) => {
      e.x = i === 0 ? 0 : i === 1 ? -1.3 : i === 2 ? 1.3 : 20;
      e.z = i < 3 ? 8 : -20;
      e.hp = e.maxHp = 1000;
    });
  });
  await page.keyboard.down("KeyJ");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as W).musou.sim.enemies.enemies
          .slice(0, 3)
          .every((e) => e.hp < 1000),
      ),
    )
    .toBe(true);
  await page.keyboard.up("KeyJ");
  await page.evaluate(() => {
    const m = (window as unknown as W).musou;
    m.pause(true);
    m.run.start("ranger", "fanbow");
    m.sim.player.extraArrows = 4;
    m.sim.player.attackSpeedMult = 1.3;
    m.sim.player.rangeMult = 1.3;
    m.sim.enemies.enemies.forEach((e, i) => {
      e.x = ((i % 5) - 2) * 2;
      e.z = 10 + Math.floor(i / 5) * 1.2;
    });
    for (let i = 0; i < 10; i++)
      m.sim.step({ x: 0, z: 0, yaw: 0, attack: i === 0, respawn: false });
  });
  await expect(page.locator("#weapon-stats")).toContainText("7 arrows");
  expect(
    await page.evaluate(
      () => (window as unknown as W).musou.sim.combat.arrows.length,
    ),
  ).toBe(7);
  await expect(page).toHaveScreenshot("seven-arrow-fan.png", {
    maxDiffPixelRatio: 0.04,
  });
  await page.screenshot({ path: "evidence/seven-arrow-fan.png" });
  expect(errors).toEqual([]);
});
test("Spear reaches beyond the saber and its attack arc is shown at the actual reach", async ({
  page,
}) => {
  await page.goto("/?backend=webgl");
  await expect(page.locator("#run-overlay")).toBeVisible();
  await page.keyboard.press("Digit1");
  await expect(page.locator("#run-title")).toContainText("Choose your weapon");
  await expect(page.locator("#run-choices")).toContainText("72° arc");
  await page.keyboard.press("Digit2");
  await expect(page.locator("#weapon-stats")).toContainText("Spear");
  await expect(page.locator("#weapon-stats")).toContainText("4.5m");
  await page.evaluate(() => {
    const s = (window as unknown as W).musou.sim;
    s.enemies.enemies.forEach((e, i) => {
      e.x = i === 0 ? 0 : 20;
      e.z = i === 0 ? 4 : -20;
    });
  });
  await page.keyboard.press("KeyJ");
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as W).musou.sim.player.hits),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    const m = (window as unknown as W).musou;
    m.pause(true);
    m.run.start("vanguard", "spear");
    m.sim.enemies.enemies.forEach((e, i) => {
      e.x = ((i % 5) - 2) * 1.7;
      e.z = 5 + Math.floor(i / 5) * 1.8;
    });
    for (let i = 0; i < 11; i++)
      m.sim.step({ x: 0, z: 0, yaw: 0, attack: i === 0, respawn: false });
  });
  await expect(page).toHaveScreenshot("spear-reach.png", {
    maxDiffPixelRatio: 0.04,
  });
  await page.screenshot({ path: "evidence/spear-reach.png" });
});
test("weapon selection supports going back and choosing on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?backend=webgl");
  await expect(page.locator("#run-overlay")).toBeVisible();
  await page.keyboard.press("Digit2");
  await expect(page.locator("#run-title")).toContainText("Ranger");
  await page.keyboard.press("Escape");
  await expect(page.locator("#run-title")).toHaveText("Choose your fighter");
  await page.keyboard.press("Digit1");
  await expect(page.locator("#run-title")).toContainText("Vanguard");
  await page.locator("#run-choices button").nth(2).scrollIntoViewIfNeeded();
  await expect(page.locator("#run-choices button").nth(2)).toBeInViewport();
  await page.locator("#run-choices button").nth(2).click();
  await expect(page.locator("#run-overlay")).toBeHidden();
  await expect(page.locator("#weapon-stats")).toContainText("Greatblade");
});
