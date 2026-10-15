# Gameplay polish validation

Validated in the isolated `R-20261014212323-c90953b6` workspace run before integration.

- Clean locked dependency installation passed with zero audit vulnerabilities.
- `npm test`: 24 unit/integration tests passed, including mixed enemy roles, armor and finisher interaction, charge gating, radial hit deduplication, movement lock, dodge protection/cooldown, seeded repeatability and existing combat/spatial checks.
- `npm run build`: strict TypeScript and production PWA precache generation passed.
- `npm run test:e2e`: 11 browser checks passed, including keyboard-earned Solar Break, its frozen visual reference, gamepad special/dodge edges, pause/reduced-motion controls, existing combat/death/respawn checks, desktop/mobile references, root and repository-prefix offline reloads, unavailable-WebGPU fallback, benchmark exports and JSON downloads.

## Measured mixed-crowd scenario

Scenario `mixed-crowd-solar-v2`: seed 4242; 60/20/20 percent grunt/flanker/armored roles; deterministic orbit and movement; strike every 24 ticks; one fully charged Solar Break on tick 90. Each scenario retains all requested living enemies using elevated enemy health and replenished player health. Sixty warmup frames precede 180 measured samples. Each sample advances one 1/60-second simulation tick independently of RAF delay; frame timing is wall interval and simulation timing is CPU duration, not a GPU timer query. Renderer metadata records software adapter, backing resolution, engine/browser and date. No FPS requirement is imposed.

| Selection / actual backend | Enemies | Frame p50 / p95 / p99 (ms) | Simulation p50 / p95 / p99 (ms) | Mean draw calls |
| --- | ---: | --- | --- | ---: |
| webgl / WebGL2 | 0 | 26.80 / 36.50 / 55.40 | 0.00 / 0.10 / 0.20 | 43.97 |
| webgl / WebGL2 | 20 | 32.50 / 39.20 / 48.00 | 0.10 / 0.20 / 0.30 | 64.60 |
| webgl / WebGL2 | 100 | 41.80 / 73.10 / 120.00 | 0.20 / 0.40 / 0.40 | 145.18 |
| webgl / WebGL2 | 300 | 61.20 / 83.90 / 143.20 | 0.50 / 0.90 / 1.60 | 345.52 |
| auto / WebGL2 | 0 | 28.10 / 34.70 / 45.50 | 0.00 / 0.10 / 0.20 | 43.97 |
| auto / WebGL2 | 20 | 31.50 / 38.30 / 57.00 | 0.10 / 0.30 / 0.40 | 64.60 |
| auto / WebGL2 | 100 | 38.30 / 57.60 / 94.10 | 0.20 / 0.40 / 0.50 | 145.18 |
| auto / WebGL2 | 300 | 69.70 / 121.00 / 165.70 | 0.50 / 0.80 / 1.40 | 345.52 |

These are local headless Chromium/SwiftShader measurements, not real GPU forecasts. The previous one-role prototype measurements are retained in [baseline-v1](baseline-v1/README.md); its workload differs from this scenario.

## Evidence and limits

[Unit log](unit-test.log), [build log](build.log), [browser log](browser-test.log), [WebGL JSON](benchmark-webgl.json), [auto JSON](benchmark-auto.json).

[Arena](arena.png), [mobile HUD](mobile.png), [Solar Break](solar-break.png). Desktop/mobile and special-effects reference images are committed under `e2e/`. The Solar Break reference uses a fixed simulation pose after live keyboard charge/cast assertions; normal attack cones and the area attack use built-in materials and procedural geometry. Effects reuse 32 sparks, two rings and one core; reduced motion removes hero spin/lift and camera pulse and keeps eight sparks.

The prior unsafe software WebGPU experiment [crashed Chromium](WEBGPU_LIMIT.md); hardware WebGPU remains unverified. Physical controllers and browser audio activation still need device checks. Kinematic enemies can overlap in dense crowds; decorative pillars are not colliders. No animation rigs, authored audio assets, touch movement, weapons or bosses are included in this milestone. The main bundle still exceeds Vite's 500 kB warning threshold; all local chunks are precached. See the README for controls and architecture.

A final follow-up resets the frame timestamp on pause/resume so hidden-tab time is not caught up on return, and allows benchmark tests five minutes per backend on slow CI. The 24 unit tests, strict build, and focused browser pause/dodge check passed again; gameplay workload and benchmark samples are unchanged.
