import { test as base, expect } from "@playwright/test";
// Optional slow-renderer check: assertions follow state, and pad pulses span frames.
export const test = base.extend({
  page: async ({ page }, use) => {
    const rate = Number(process.env.MUSOU_CPU_THROTTLE ?? 1);
    if (rate > 1) {
      const client = await page.context().newCDPSession(page);
      await client.send("Emulation.setCPUThrottlingRate", { rate });
    }
    await use(page);
  },
});
export { expect };
