import { test, expect } from "@playwright/test";
test("Pages repository prefix loads relative assets and remains playable offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/musou/?backend=webgl");
  await expect(page.locator("#status")).toContainText("WebGL2");
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope).toContain("/musou/");
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>("link[rel=manifest]")!;
    return (await (await fetch(link.href)).json()) as {
      icons: { src: string }[];
    };
  });
  expect(manifest.icons).toHaveLength(2);
  await page.reload();
  await expect(page.locator("#status")).toContainText("WebGL2");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#status")).toContainText("WebGL2");
  await page.keyboard.press("KeyJ");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              musou: { sim: { player: { stage: number } } };
            }
          ).musou.sim.player.stage,
      ),
    )
    .toBe(1);
  expect(errors).toEqual([]);
  await context.setOffline(false);
});

test("explicit WebGPU preference falls back when WebGPU is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", { value: undefined }),
  );
  await page.goto("/?backend=webgpu");
  await expect(page.locator("#status")).toContainText("WebGL2");
  await page.keyboard.press("KeyJ");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              musou: { sim: { player: { stage: number } } };
            }
          ).musou.sim.player.stage,
      ),
    )
    .toBe(1);
});
