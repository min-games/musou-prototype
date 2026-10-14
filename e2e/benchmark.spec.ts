import { test, expect } from "@playwright/test";
import { writeFileSync, readFileSync } from "node:fs";
for (const backend of ["webgl", "auto"])
  test(`measured crowd benchmark ${backend}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(`/?backend=${backend}`);
    await expect(page.locator("#status")).toContainText("RENDERER");
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
      expect(result.metadata.scenario).toBe("mixed-crowd-solar-v2");
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
      `evidence/benchmark-${process.env.MUSOU_WEBGPU === "1" ? "webgpu" : backend}.json`,
      JSON.stringify(results, null, 2),
    );
  });
