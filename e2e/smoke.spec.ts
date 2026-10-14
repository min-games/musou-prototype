import { test, expect } from "@playwright/test";
test("launch, movement, real keyboard combat, respawn and visual reference", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?backend=webgl");
  await expect(page.locator("#status")).toContainText("WebGL2");
  await page.evaluate(() => {
    const w = window as unknown as {
      musou: {
        sim: {
          reset: () => void;
          enemies: { enemies: { x: number; z: number }[] };
        };
      };
    };
    w.musou.sim.reset();
    w.musou.sim.enemies.enemies.forEach((e, i) => {
      e.x = ((i % 5) - 2) * 0.4;
      e.z = 1 + Math.floor(i / 5) * 0.2;
    });
  });
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(200);
  const hit = await page.evaluate(() => {
    const w = window as unknown as {
      musou: { sim: { enemies: { enemies: { hp: number; state: string }[] } } };
    };
    return w.musou.sim.enemies.enemies.some(
      (e) => e.hp < 60 && e.state === "stagger",
    );
  });
  expect(hit).toBe(true);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(350);
  await page.keyboard.up("KeyD");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { musou: { sim: { player: { x: number } } } })
          .musou.sim.player.x,
    ),
  ).toBeGreaterThan(0.5);
  await page.evaluate(() => {
    (
      window as unknown as { musou: { sim: { player: { hp: number } } } }
    ).musou.sim.player.hp = 1;
  });
  await expect(page.locator("#status")).toContainText("1 / 100");
  await page.keyboard.press("KeyR");
  await expect(page.locator("#status")).toContainText("100 / 100");
  await page.evaluate(() => {
    const sim = (
      window as unknown as {
        musou: {
          sim: {
            reset: () => void;
            player: { hp: number };
            enemies: {
              enemies: {
                x: number;
                z: number;
                hp: number;
                state: string;
                timer: number;
              }[];
            };
          };
        };
      }
    ).musou.sim;
    sim.reset();
    sim.player.hp = 9;
    Object.assign(sim.enemies.enemies[0]!, {
      x: 0,
      z: 1,
      state: "windup",
      timer: 0,
      attackYaw: Math.PI,
    });
  });
  await expect(page.locator("#notice")).toContainText("You fell");
  await page.keyboard.press("KeyR");
  await expect(page.locator("#status")).toContainText("100 / 100");
  await page.evaluate(() => {
    const sim = (
      window as unknown as {
        musou: {
          sim: { enemies: { enemies: { x: number; z: number; hp: number }[] } };
        };
      }
    ).musou.sim;
    Object.assign(sim.enemies.enemies[0]!, { x: 0, z: 1, hp: 25 });
  });
  await page.keyboard.press("KeyJ");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              musou: { sim: { player: { kills: number } } };
            }
          ).musou.sim.player.kills,
      ),
    )
    .toBe(1);

  await page.evaluate(() => {
    const m = (
      window as unknown as {
        musou: { pause: (value: boolean) => void; sim: { reset: () => void } };
      }
    ).musou;
    m.pause(true);
    m.sim.reset();
  });
  await page.waitForTimeout(100);
  await expect(page).toHaveScreenshot("arena.png", {
    maxDiffPixelRatio: 0.05,
    animations: "disabled",
  });
  await page.screenshot({ path: "evidence/arena.png" });
  expect(errors).toEqual([]);
});
test("responsive HUD and installed offline reload", async ({
  page,
  context,
}) => {
  await page.goto("/?backend=webgl");
  await expect(page.locator("#status")).toContainText("WebGL2");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator("#status")).toContainText("WebGL2");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#status")).toContainText("WebGL2");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#bench")).toBeInViewport();
  await page.evaluate(() => {
    const m = (
      window as unknown as {
        musou: { pause: (value: boolean) => void; sim: { reset: () => void } };
      }
    ).musou;
    m.pause(true);
    m.sim.reset();
  });
  await page.waitForTimeout(100);
  await expect(page).toHaveScreenshot("mobile.png", {
    maxDiffPixelRatio: 0.05,
  });
  await page.screenshot({ path: "evidence/mobile.png" });
  await context.setOffline(false);
});
