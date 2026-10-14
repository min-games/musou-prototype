# Iron Field

A playable browser Musou vertical slice: a gold-armored fighter with a charged Solar Break against a continuously replenishing mixed crowd of 20 opponents, in a procedural low-poly courtyard. Strict TypeScript, Vite, Babylon.js, a pure deterministic 60 Hz simulation, and an installable offline PWA. No server, physics package, ECS, custom shaders, multiplayer, or external art.

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
| Solar Break                 | Q or K when charged        | B                 |
| Dodge                       | Shift                      | X                 |
| Pause / resume              | Esc or Pause button        | Pause button      |
| Respawn / restart encounter | R                          | Y                 |

A strike lasts 0.38 seconds. Tap within the last 0.22 seconds to buffer the next strike; the combo continuation window lasts 0.28 seconds. The three stages deal 25 / 25 / 40 damage in a forward 151° arc with 2.8-unit reach. Each enemy can be hit only once per swing. The finisher has stronger knockback and breaks armored windups.

The 20-enemy encounter contains 12 red grunts (60 HP), four teal flankers (45 HP), and four violet armored enemies (120 HP). Flankers move faster and approach from the side. Armored enemies move slowly, reduce light-hit damage to 17, withstand light-hit stagger during windup, and telegraph a stronger 18-damage attack. Their shield silhouette distinguishes them from the flanker crest and grunt helmet. Attack cones lock direction during windup, allowing a side dodge; health bars appear after damage. Enemies fall on defeat and return after five seconds with their original role and full health.

**Solar Break:** successful unique melee hits grant 10 charge, with 10 extra on a kill, capped at 100. Press Q / B or click the ready button to consume the full meter. After a 0.16-second windup, one radial impact deals 80 armor-piercing damage within 6.5 units and interrupts enemies with strong knockback. The 0.85-second cast locks movement and protects the hero. It cancels the current combo; special hits do not recharge the meter. Golden twin shockwaves, 32 pooled sparks, a light core, a brief camera pulse, and a named callout communicate the move.

**Dodge:** Shift / X moves 2.6 units over 0.2 seconds in the movement direction (or hero facing while stationary), with protection during that interval and a 0.75-second cooldown. Dodging cancels the current melee swing. Player hits otherwise grant 0.65 seconds of recovery protection with slower movement. Death stops movement and attacks until restart. Kill totals persist until restart. Restart clears charge and active effects.

Optional synthesized sound cues unlock after a keyboard/canvas gesture; use Sound to mute. Reduced motion disables the camera pulse and hero spin/lift, and reduces sparks to eight while retaining the essential attack rings. Esc / Pause freezes gameplay; returning from a hidden tab requires resume, so the hero cannot be attacked while away.
The HUD shows vitality, combo stage, kills, enemy-role counts, dodge readiness, special charge, and actual graphics backend. The ready special button is also clickable. Gamepad mappings require a standard browser-compatible controller. The narrow-screen HUD adapts, but this slice requires keyboard or gamepad; it has no touch movement controls.

## Architecture

`Simulation` in `GameLoop.ts` owns gameplay state and calls `EnemyStore`, `SpatialGrid`, `CombatSystem`, then `CrowdSystem`. Those modules use no DOM, Babylon objects, wall clock, or unseeded randomness. The seeded LCG controls initial positions and enemy returns. Given identical seed and input frames, repeated runs produce identical states within the same JavaScript runtime.

`GameLoop` accumulates real elapsed time and executes only 1/60-second simulation steps. Catch-up is capped at 15 ticks (0.25 seconds); longer stalls discard excess time and record it. Rendering is independent and currently displays the latest simulation state without interpolation. `InputManager` samples keyboard, pointer, and gamepad input at simulation boundaries, normalizes movement, and consumes discrete attack/reset edges. Camera orbit and camera-relative movement are presentation/input concerns.

`Renderer` defines the backend boundary. `BabylonRenderer` chooses WebGPU when available, otherwise WebGL2 (with Babylon's legacy WebGL1 compatibility path on older environments). The backend selector or `?backend=auto|webgl|webgpu` reloads with the selected preference; the HUD reports the backend actually obtained. Explicit WebGPU selection still falls back when unsupported. All geometry and materials are procedural, using Babylon's built-in material shaders. Each role uses a merged body mesh per actor; telegraphs and damaged health bars add small presentation meshes. The special reuses two ring meshes, one core, and 32 spark meshes rather than allocating them per cast. No custom shader source is included.

`AudioFeedback` observes player hit/cast counters to synthesize optional cues; it does not affect gameplay. HUD text updates at 20 Hz and camera following uses simulation ticks, with no wall-clock or random changes to combat.

`BenchmarkRunner` suspends interactive simulation and creates isolated seeded encounters. `window.musou` exposes the simulation, renderer, pause/reset and benchmark hooks for browser testing and local inspection; this is a prototype debugging API.

## Performance guide

Use **Run benchmarks**, keep the tab foreground, then **Export JSON**. Each size gets 60 warmup frames and 240 measured samples in the UI (180 in automated tests). The camera follows the same orbit around the origin at distance 30, advancing 0.15 radians per simulation second. The versioned `mixed-crowd-solar-v2` scenario uses the same 60/20/20 percent mix of enemy roles, sinusoidal movement, one strike every 24 ticks, and a forced fully charged Solar Break on tick 90, including its presentation cost even in the zero-enemy baseline. One fixed simulation tick runs per sample independently of RAF delays. Health is replenished and benchmark enemy HP is raised so the full requested crowd stays active. This is a controlled workload, not a real-time replay when rendering falls below 60 FPS.

JSON includes frame p50/p95/p99 wall intervals, simulation p50/p95/p99 CPU durations, mean per-frame draw calls, seed, scenario version, role counts, special activations, live count, warmup/sample sizes, viewport, DPR, hardware concurrency, engine/backend/adapter information, and UTC time. Frame intervals include RAF scheduling, rendering, and browser overhead; they are not GPU timer-query measurements. Sub-millisecond CPU timings can quantize to zero. Compare runs on the same browser/device, resolution, and power mode; software rendering is not representative of a gaming GPU.

See [validation evidence](evidence/VALIDATION.md) for measured results and screenshots. The supplied runner uses SwiftShader in headless Chromium for reproducible CI. For a supported local WebGPU software experiment, `MUSOU_WEBGPU=1 npm run benchmark -- --grep auto` adds Chromium's unsafe WebGPU flag and writes separate `benchmark-webgpu.json` only on success; ordinary users do not need it. This local experiment crashed Chromium, so WebGPU remains unverified; see [the recorded limit](evidence/WEBGPU_LIMIT.md).

At higher counts, rendering uses one mesh per enemy and CPU crowd separation can become expensive when cells are crowded. The spatial grid narrows range checks, but neighbor processing is not guaranteed linear in dense clusters. Future profiling should examine instancing and crowd separation budgets before adding art or post-processing. Profiling identified excessive geometry in the decorative/effect rings; the final renderer uses flat 64-segment strips (128 triangles each), preserving their radial shape without detailed torus surfaces. Intermediate measurements are retained in `evidence/profiling-torus-v2/`. The renderer caps backing resolution on high-DPR displays. No performance threshold is imposed on CI because shared runners vary.

## Offline and static hosting

`npm run build` emits `dist/` with relative URLs (`base: './'`). Serve that directory over HTTP(S), including under a GitHub Pages repository path; do not open `index.html` with `file://`. The build generates a content-versioned service worker precaching every emitted file, including dynamic Babylon modules and PNG app icons. After the first successful online load and service-worker activation, reloads work offline. Install from a supporting browser's app/install menu. Installation UI depends on the browser; automated tests verify service-worker readiness and a real offline reload.

`.github/workflows/pages.yml` runs clean install, unit/integration tests, build, Chromium installation, browser checks, and benchmarks, then uploads the Pages candidate and validation artifacts. To publish, configure repository Pages to use GitHub Actions, then manually run the workflow on `main`. Pushes and pull requests run validation; deployment runs only on a manual trigger.

## Tests and limits

Unit and integration coverage includes damage/recovery/death, arc/range boundaries, swing deduplication, buffered three-stage chaining, seed repeatability, mixed roles, armor/finisher interaction, charge gating, radial special deduplication, movement lock, dodge protection/cooldown, spawn/respawn, spatial cells and dead filtering, AI pursuit/windup/attack, and fixed-step cadence/stall handling. Playwright covers launch, real keyboard combat and kills, player death/restart, simulated standard gamepad input, responsive HUD, offline reload, desktop/mobile/special-effects reference screenshots, special/dodge gamepad edges, pause/reduced-motion controls, and full live crowd benchmarks. Refresh reference images deliberately with `npm run test:e2e -- --update-snapshots` and inspect them before committing.

This is a single-arena prototype with simple kinematic AI, no collision solver, animation rig, authored audio assets, persistence, touch controls, or accessibility navigation of the 3D game. Enemies may overlap in dense crowds; decorative pillars are not colliders. Physical-controller and real desktop/mobile GPU behavior need device testing. Weapons and bosses remain future milestones. Special effects use built-in materials rather than a bloom/post-processing pipeline; audio is synthesized and may require an additional user gesture on some browsers. Visual references target Linux Chromium/SwiftShader and allow limited raster differences; exact cross-platform pixel identity is not expected. Floating-point determinism is tested within one runtime, not promised as cross-engine lockstep.
