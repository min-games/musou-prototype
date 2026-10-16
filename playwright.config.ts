import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  snapshotPathTemplate: "evidence/art-v1/references/{testFilePath}/{arg}{ext}",
  timeout: 120000,
  expect: { timeout: 30000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5187",
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        ...(process.env.MUSOU_WEBGPU === "1" ? ["--enable-unsafe-webgpu"] : []),
        "--use-angle=swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  webServer: {
    command:
      "npx vite build --mode test && MUSOU_DIST=test-dist node scripts/precache.mjs && MUSOU_DIST=test-dist node scripts/serve.mjs",
    port: 5187,
    reuseExistingServer: false,
  },
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: `evidence/art-v1/browser-results${process.env.MUSOU_REPORT_SUFFIX ?? ""}.json`,
      },
    ],
    [
      "html",
      {
        open: "never",
        outputFolder: `evidence/playwright-report${process.env.MUSOU_REPORT_SUFFIX ?? ""}`,
      },
    ],
  ],
});
