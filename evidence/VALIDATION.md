# Candidate validation

Validated in the isolated `ws/run/R-20261014201230-558d9076` worktree. No push, deployment, or publishing was performed.

Commands: `npm ci` succeeded (42 packages, zero audit vulnerabilities); `npm test` passed 14 unit/integration tests; `npm run build` passed strict TypeScript and production asset generation; `npm run test:e2e` passed all 8 browser tests, including both complete crowd benchmark runs and JSON downloads. Combat/controller and visual checks also passed twice consecutively after reset synchronization fixes. Chromium browsers were already available locally.

Environment: Linux, Node 24.12.0, npm 11.6.2, Playwright 1.64.1 / Chromium 156, Babylon 8.56.2. Viewport 1280 × 720, DPR 1, SwiftShader software rendering. All benchmark sizes retained their full live enemy count.

## Actual measurements

Each encounter: seed 4242; fixed camera and deterministic sinusoidal input; 60 warmup samples; 180 measured samples; exactly one 1/60-second simulation step per sample. The timing includes foreground RAF scheduling. CPU timer precision is approximately 0.1 ms, so some samples quantize to zero. Enemy HP is raised and player HP is replenished to preserve active workloads.

| Selection / actual backend | Enemies | Frame p50 / p95 / p99 (ms) | Simulation p50 / p95 / p99 (ms) | Mean draw calls |
| -------------------------- | ------: | -------------------------- | ------------------------------- | --------------: |
| webgl / WebGL2             |       0 | 19.60 / 25.30 / 42.50      | 0.00 / 0.10 / 0.10              |           39.85 |
| webgl / WebGL2             |      20 | 19.90 / 24.80 / 37.60      | 0.10 / 0.20 / 0.20              |           59.85 |
| webgl / WebGL2             |     100 | 25.00 / 30.90 / 46.50      | 0.20 / 0.30 / 0.30              |          139.85 |
| webgl / WebGL2             |     300 | 42.70 / 53.20 / 80.50      | 0.30 / 0.70 / 1.20              |          339.85 |
| auto / WebGL2              |       0 | 16.70 / 20.00 / 34.60      | 0.00 / 0.10 / 0.20              |           39.85 |
| auto / WebGL2              |      20 | 21.10 / 26.00 / 41.10      | 0.10 / 0.20 / 0.20              |           59.85 |
| auto / WebGL2              |     100 | 25.70 / 33.90 / 40.10      | 0.20 / 0.30 / 0.30              |          139.85 |
| auto / WebGL2              |     300 | 43.80 / 63.60 / 94.60      | 0.40 / 0.50 / 0.60              |          339.85 |

These are real local software-renderer measurements, not forecasts or desktop GPU claims. The simulation remained inexpensive in these samples; rendering/scheduling dominates this environment. The higher counts do not sustain 60 rendered FPS on SwiftShader. No CI performance gate is inferred from this machine.

## Evidence

- [Explicit WebGL2 JSON](benchmark-webgl.json) and [auto/fallback JSON](benchmark-auto.json), including adapter, seed, live count, resolution, timing method and UTC metadata.
- [Unit/integration log](unit-test.log), [production build log](build.log), and [final browser log](browser-test.log).
- [Desktop arena](arena.png) and [narrow-screen HUD](mobile.png). Inspected visually: readable status and controls, visible hero/enemies, and no clipped interactive buttons.
- Committed reference images: `e2e/smoke.spec.ts-snapshots/arena-linux.png` and `mobile-linux.png`. The final run compared both references without updating them.
- Browser checks cover real keyboard hits/kills, player death/reset, simulated standard gamepad movement/camera/attack/reset edges, focused controls, production offline reload, `/musou/` repository-prefix offline play, and WebGPU-unavailable fallback.

## Limits

[The unsafe WebGPU experiment crashed Chromium](WEBGPU_LIMIT.md) before producing complete measurements. The cause is unresolved; no WebGPU result or hardware performance claim is supplied. A real supported GPU and physical gamepad remain device-validation work. Standard auto selection and explicit WebGL2 are verified here.

The production build reports a large main chunk warning; all emitted files are precached for offline use. Simulation has bounded catch-up and no render interpolation. AI is kinematic and dense crowds can overlap; decorative geometry does not collide. There is no touch movement, audio, persistence, or cross-engine lockstep guarantee. See the README for architecture and performance guidance.
