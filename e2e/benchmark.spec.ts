import { test, expect, evidencePath } from "./fixtures";
import { writeFileSync, readFileSync } from "node:fs";
for (const backend of ["webgl", "auto"])
  test(`measured crowd benchmark ${backend}`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto(`/?practice=1&backend=${backend}`);
    await page.waitForFunction(
      () => !!(window as unknown as { musou?: unknown }).musou,
    );
    const results = await page.evaluate(async () => {
      return await (
        window as unknown as {
          musou: { runBenchmark: (frames: number) => Promise<unknown[]> };
        }
      ).musou.runBenchmark(180);
    });
    expect(results).toHaveLength(4);
    for (const value of results) {
      const result = value as {
        count: number;
        drawCalls: number;
        metadata: {
          liveEnemies: number;
          specialActivations: number;
          scenario: string;
        };
      };
      expect(result.metadata.liveEnemies).toBe(result.count);
      expect(result.drawCalls).toBeGreaterThan(0);
      expect(result.drawCalls).toBeLessThan(result.count * 5 + 200);
      expect(result.metadata.specialActivations).toBe(1);
      expect(result.metadata.scenario).toBe("weapon-crowd-v1-saber");
    }
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#export").click(),
    ]);
    expect(download.suggestedFilename()).toBe("iron-field-benchmarks.json");
    expect(JSON.parse(readFileSync((await download.path())!, "utf8"))).toEqual(
      results,
    );
    writeFileSync(
      evidencePath(
        `benchmark-${process.env.MUSOU_WEBGPU === "1" ? "webgpu" : backend}.json`,
      ),
      JSON.stringify(results, null, 2),
    );
  });

test("measured ranger benchmark preserves full crowds and exports its own scenario", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await page.goto("/?practice=1&backend=webgl");
  await expect(page.locator("#status")).toContainText("WebGL2");
  const results = await page.evaluate(async () => {
    const m = (
      window as unknown as {
        musou: {
          runBenchmark: (
            frames: number,
            hero: "ranger",
          ) => Promise<import("../src/BenchmarkRunner").BenchmarkResult[]>;
        };
      }
    ).musou;
    return m.runBenchmark(180, "ranger");
  });
  expect(results.map((r) => r.count)).toEqual([0, 20, 100, 300]);
  for (const r of results) {
    expect(r.metadata.scenario).toBe("weapon-crowd-v1-shortbow");
    expect(r.metadata.hero).toBe("ranger");
    expect(r.metadata.liveEnemies).toBe(r.count);
    expect(r.metadata.specialActivations).toBe(1);
    expect(r.drawCalls).toBeGreaterThan(0);
  }
  writeFileSync(
    evidencePath("benchmark-ranger-webgl.json"),
    JSON.stringify(results, null, 2),
  );
});

test("measured max multishot benchmark exports seven arrows and complete crowds", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await page.goto("/?practice=1&backend=webgl");
  await page.waitForFunction(
    () => !!(window as unknown as { musou?: unknown }).musou,
  );
  const results = await page.evaluate(() =>
    (
      window as unknown as {
        musou: {
          runBenchmark: (
            frames: number,
            hero: "ranger",
            weapon: "shortbow",
            stress: boolean,
          ) => Promise<import("../src/BenchmarkRunner").BenchmarkResult[]>;
        };
      }
    ).musou.runBenchmark(120, "ranger", "shortbow", true),
  );
  expect(results.map((r) => r.count)).toEqual([0, 20, 100, 300]);
  for (const r of results) {
    expect(r.metadata.scenario).toBe("weapon-crowd-max-v1-shortbow");
    expect(r.metadata.weapon).toBe("shortbow");
    expect(r.metadata.pierce).toBe(2);
    expect(r.metadata.peakArrows).toBeGreaterThanOrEqual(7);
    expect(r.metadata.peakArrows).toBeLessThanOrEqual(84);
    expect(r.metadata.liveEnemies).toBe(r.count);
    expect(r.metadata.specialActivations).toBe(1);
    expect((r.metadata.weaponStats as { arrows: number }).arrows).toBe(7);
  }
  writeFileSync(
    evidencePath("benchmark-multishot-webgl.json"),
    JSON.stringify(results, null, 2),
  );
});
