# Iron Field

A playable browser Musou vertical slice: a gold-armored fighter against a continuously replenishing crowd of 20 opponents, in a procedural low-poly courtyard. Strict TypeScript, Vite, Babylon.js, a pure deterministic 60 Hz simulation, and an installable offline PWA. No server, physics package, ECS, custom shaders, multiplayer, or external art.

## Run and validate

Node 22.12+ (Node 24 used locally).

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run benchmark
npm run preview
```

Open the local URL printed by Vite. Browser tests build production assets, start their own static production loopback server on port 5187 (including `/musou/` for the Pages subpath check), and run Chromium at 1280 × 720. `npm run benchmark` writes actual 0/20/100/300-enemy measurements into `evidence/benchmark-webgl.json` and `evidence/benchmark-auto.json`. Keep that port free. If an OS sandbox blocks sockets or browser processes, run those commands in an environment permitting local servers.

## Play

| Action                      | Keyboard / mouse           | Standard gamepad  |
| --------------------------- | -------------------------- | ----------------- |
| Camera-relative movement    | WASD                       | Left stick        |
| Orbit / pitch camera        | Mouse drag; arrow keys     | Right stick       |
| Strike                      | J or Space, tap repeatedly | A, tap repeatedly |
| Respawn / restart encounter | R                          | Y                 |

A strike lasts 0.38 seconds. Tap within the last 0.22 seconds to buffer the next strike; the combo continuation window lasts 0.28 seconds. The three stages deal 25 / 25 / 40 damage in a forward 151° arc with 2.8-unit reach. Each enemy can be hit only once per swing. Enemies have 60 HP, pursue, telegraph attacks in amber, attack, and recover. Hits flash enemies white and push them away; player hits flash the screen and grant 0.65 seconds of recovery invulnerability with slower movement. Enemies return five seconds after defeat. Kill totals persist until restart. Death stops movement and attacks until restart.

The HUD shows vitality, combo stage, kills, live enemies, and actual graphics backend. Gamepad mappings require a standard browser-compatible controller. The narrow-screen HUD adapts, but this slice requires keyboard or gamepad; it has no touch movement controls.

## Architecture

`Simulation` in `GameLoop.ts` owns gameplay state and calls `EnemyStore`, `SpatialGrid`, `CombatSystem`, then `CrowdSystem`. Those modules use no DOM, Babylon objects, wall clock, or unseeded randomness. The seeded LCG controls initial positions and enemy returns. Given identical seed and input frames, repeated runs produce identical states within the same JavaScript runtime.

`GameLoop` accumulates real elapsed time and executes only 1/60-second simulation steps. Catch-up is capped at 15 ticks (0.25 seconds); longer stalls discard excess time and record it. Rendering is independent and currently displays the latest simulation state without interpolation. `InputManager` samples keyboard, pointer, and gamepad input at simulation boundaries, normalizes movement, and consumes discrete attack/reset edges. Camera orbit and camera-relative movement are presentation/input concerns.

`Renderer` defines the backend boundary. `BabylonRenderer` chooses WebGPU when available, otherwise WebGL2 (with Babylon's legacy WebGL1 compatibility path on older environments). The backend selector or `?backend=auto|webgl|webgpu` reloads with the selected preference; the HUD reports the backend actually obtained. Explicit WebGPU selection still falls back when unsupported. All geometry and materials are procedural, using Babylon's built-in material shaders. The enemy silhouette is merged into one mesh per actor. No custom shader source is included.

`BenchmarkRunner` suspends interactive simulation and creates isolated seeded encounters. `window.musou` exposes the simulation, renderer, pause/reset and benchmark hooks for browser testing and local inspection; this is a prototype debugging API.

## Performance guide

Use **Run benchmarks**, keep the tab foreground, then **Export JSON**. Each size gets 60 warmup frames and 240 measured samples in the UI (180 in automated tests). The camera follows the same orbit around the origin at distance 30, advancing 0.15 radians per simulation second. The input follows a seeded encounter with sinusoidal movement and one strike every 24 ticks. One fixed simulation tick runs per sample independently of RAF delays. Health is replenished and benchmark enemy HP is raised so the full requested crowd stays active. This is a controlled workload, not a real-time replay when rendering falls below 60 FPS.

JSON includes frame p50/p95/p99 wall intervals, simulation p50/p95/p99 CPU durations, mean per-frame draw calls, seed, live count, warmup/sample sizes, viewport, DPR, hardware concurrency, engine/backend/adapter information, and UTC time. Frame intervals include RAF scheduling, rendering, and browser overhead; they are not GPU timer-query measurements. Sub-millisecond CPU timings can quantize to zero. Compare runs on the same browser/device, resolution, and power mode; software rendering is not representative of a gaming GPU.

See [validation evidence](evidence/VALIDATION.md) for measured results and screenshots. The supplied runner uses SwiftShader in headless Chromium for reproducible CI. For a supported local WebGPU software experiment, `MUSOU_WEBGPU=1 npm run benchmark -- --grep auto` adds Chromium's unsafe WebGPU flag and writes separate `benchmark-webgpu.json` only on success; ordinary users do not need it. This local experiment crashed Chromium, so WebGPU remains unverified; see [the recorded limit](evidence/WEBGPU_LIMIT.md).

At higher counts, rendering uses one mesh per enemy and CPU crowd separation can become expensive when cells are crowded. The spatial grid narrows range checks, but neighbor processing is not guaranteed linear in dense clusters. Future profiling should examine instancing and crowd separation budgets before adding art or post-processing. The renderer caps backing resolution on high-DPR displays. No performance threshold is imposed on CI because shared runners vary.

## Offline and static hosting

`npm run build` emits `dist/` with relative URLs (`base: './'`). Serve that directory over HTTP(S), including under a GitHub Pages repository path; do not open `index.html` with `file://`. The build generates a content-versioned service worker precaching every emitted file, including dynamic Babylon modules and PNG app icons. After the first successful online load and service-worker activation, reloads work offline. Install from a supporting browser's app/install menu. Installation UI depends on the browser; automated tests verify service-worker readiness and a real offline reload.

`.github/workflows/pages.yml` runs clean install, unit/integration tests, build, Chromium installation, browser checks, and benchmarks, then uploads the Pages candidate and validation artifacts. To publish, configure repository Pages to use GitHub Actions, then manually run the workflow on `main`. Pushes and pull requests run validation; deployment runs only on a manual trigger.

## Tests and limits

Unit and integration coverage includes damage/recovery/death, arc/range boundaries, swing deduplication, buffered three-stage chaining, seed repeatability, spawn/respawn, spatial cells and dead filtering, AI pursuit/windup/attack, and fixed-step cadence/stall handling. Playwright covers launch, real keyboard combat and kills, player death/restart, simulated standard gamepad input, responsive HUD, offline reload, desktop/mobile reference screenshots, and full live crowd benchmarks. Refresh reference images deliberately with `npm run test:e2e -- --update-snapshots` and inspect them before committing.

This is a single-arena prototype with simple kinematic AI, no collision solver, animation rig, audio, persistence, touch controls, or accessibility navigation of the 3D game. Enemies may overlap in dense crowds; decorative pillars are not colliders. Physical-controller and real desktop/mobile GPU behavior need device testing. Visual references target Linux Chromium/SwiftShader and allow limited raster differences; exact cross-platform pixel identity is not expected. Floating-point determinism is tested within one runtime, not promised as cross-engine lockstep.
