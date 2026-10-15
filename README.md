# Iron Field

A browser Musou / roguelike vertical slice. Choose a melee Vanguard or bow-wielding Ranger, collect field drops, build a set of relics and clear five finite enemy waves. Strict TypeScript, modular Babylon.js, Vite, a deterministic 60 Hz simulation and an offline static PWA. All geometry and sounds are procedural; no backend, physics engine, ECS, custom shaders or external art.

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
MUSOU_CPU_THROTTLE=8 npm run test:e2e -- --grep-invert benchmark
npm run preview
```

Open Vite's printed URL. Browser assertions allow slow software rendering; optional CPU throttling exercises state-driven waits and frame-based gamepad pulses. Browser tests build production assets and serve them on port 5187, including `/musou/` for the Pages subpath check. Keep that port free. They use Chromium at 1280 × 720 with SwiftShader, plus a narrow-screen reference. `npm run benchmark` exports raw measurements for 0/20/100/300 enemies for both kits. Local server/browser execution must be permitted by your environment.

## Play

| Action                     | Keyboard / mouse    | Standard gamepad       |
| -------------------------- | ------------------- | ---------------------- |
| Move                       | WASD                | Left stick             |
| Orbit / pitch camera       | Drag / arrow keys   | Right stick            |
| Attack                     | J / Space           | A                      |
| Special (full charge)      | Q / K or HUD button | B                      |
| Dodge                      | Shift               | X                      |
| Use a carried bomb         | F or HUD button     | RB                     |
| Restart current run        | R                   | Y                      |
| Pause / resume             | Esc or Pause button | Pause button           |
| Hero / relic menus         | 1–3, or Tab + Enter | D-pad / left stick + A |
| New seed in hero selection | New seed button     | Y                      |

**Vanguard:** 100 health, three-stage blade combo. Tap attack repeatedly; attacks last 0.38 seconds, accept a 0.22-second buffer and allow 0.28 seconds to continue the combo. Stages deal 25 / 25 / 40 base damage within a forward 151° arc and 2.8-unit reach. The finisher interrupts armored windups. **Solar Break** consumes 100 charge, winds up for 0.16 seconds and deals 80 armor-piercing damage within 6.5 units of the hero. Its 0.85-second cast locks movement and protects the hero.

**Ranger:** 85 health, 32-base-damage arrows every 0.32 seconds while attack is held. Face enemies before attacking; aim assist chooses the nearest living target within 18 units and a forward 120° cone. Hold attack while moving to strafe without turning away. Release attack and move to change facing. Arrows travel at 24 units/second for 0.8 seconds, stop at the first target, and can gain piercing from a relic. **Arrow Storm** marks the nearest forward target (or a point eight units ahead), then strikes its 4.5-unit-radius cluster for 105 armor-piercing damage after the same protected windup. Falling arrow effects and a cyan target ring distinguish it from Solar Break. The marked position locks on cast; it does not follow moving enemies.

Both kits earn 10 charge per unique normal hit and 10 extra on a kill, capped at 100. Specials and bombs do not refill charge from hits. Normal damage respects armor; specials and bombs pierce it. One bomb deals 160 base damage within eight units, including behind the hero. It costs one item, has a 0.6-second blast cooldown and grants no protection. Carry up to three. Both damage multipliers and special relics affect bombs.

**Run goal:** clear waves of 20 / 24 / 28 / 32 / 40 enemies, 144 defeats total. Each contains grunts, fast flankers and shielded armored enemies. Red cones lock their attack direction during windup; dodge sideways. Enemies never respawn during a run. After a one-second clear effect, remaining drops are swept up and the game freezes for a choice of one of three relics. The choice persists for the run, and entering the next wave heals 20 health. The fifth clear wins; zero health ends the run. Retry resets health, loot and relics. **New run** returns to hero selection and discards the current run.

Walk within two units of field drops: **green** heals 22, **blue** grants 25 special charge, **gold** adds 4% damage for the run, and **orange** adds a bomb. Every defeated enemy drops one item: every ninth defeat gives a bomb, otherwise every fifth gives health, every third gives charge, and the rest give power. Full health/charge/inventory drops remain until needed during combat. The end-of-wave sweep respects caps; excess supplies are discarded. Relics offer damage, maximum health/healing, speed, special power, healing on kills, bombs, and Ranger arrow piercing. Bonuses stack additively within each stat; damage and special multipliers multiply together.

The default seed is 4242. **New seed** changes the next run's wave positions and relic offers and updates the shareable `?seed=...` URL; retry repeats the same seed. No progression is saved across reloads. `?practice=1` opens the original endless 20-enemy Vanguard encounter, where enemies respawn after five seconds and R / Y resets the encounter. Benchmarks remain isolated from run progression.

Dodge moves 2.6 units over 0.2 seconds with protection and a 0.75-second cooldown, cancelling the current swing. Ordinary hits grant 0.65 seconds of recovery protection with slower movement. Optional synthesized sound unlocks after a keyboard/canvas gesture. Reduced motion removes camera pulse and hero spin/lift and limits sparks to eight while retaining essential attack markers. Hidden tabs pause active combat and require resume. This prototype requires keyboard or gamepad; responsive layout does not imply touch movement support.

## Architecture

See [architecture and run state](docs/ARCHITECTURE.md). `GameLoop`, `CombatSystem`, `CrowdSystem`, `SpatialGrid`, `EnemyStore` and `RunDirector` are pure gameplay modules. `Renderer` / `BabylonRenderer`, `InputManager`, `AudioFeedback` and `BenchmarkRunner` form the browser boundary. No rendering method changes gameplay state. `window.musou` exposes simulation, run, renderer, pause/reset and benchmark hooks for prototype testing.

## Performance guide

Use **Run benchmarks**, keep the tab foreground, then **Export JSON**. The currently selected hero determines the scenario; endless practice selects Vanguard. The console hook `window.musou.runBenchmark(240, 'ranger')` also measures the Ranger. Each of 0/20/100/300 enemies receives 60 warmup and 240 measured frames in the UI (180 in tests). The camera follows a fixed orbit, seed 4242, with one simulation tick per sample regardless of RAF delay. Enemy health is raised and player health replenished so every requested actor stays alive.

`mixed-crowd-solar-v2` retains the original scripted movement, a strike every 24 ticks, and one Solar Break on tick 90. `mixed-crowd-arrow-v1` uses the same movement/camera, held bow fire, and Arrow Storm on tick 90. Compare only equivalent scenarios. Neither scenario measures field loot or relic menus; active run crowds stop at 40. JSON records frame and CPU simulation p50/p95/p99, mean per-frame draw calls, seed, scenario, hero, counts, viewport, adapter/backend, browser and UTC time. Frame intervals include scheduling, rendering and browser overhead; they are not GPU timer-query measurements. Sub-millisecond CPU values can quantize to zero.

See [validation evidence](evidence/VALIDATION.md) and the exported JSON. Compare on the same device, browser, resolution and power mode. Software rendering is not a gaming GPU forecast. No FPS gate is imposed. Per-enemy meshes and dense CPU separation remain scaling limits; the grid is not guaranteed linear in crowded cells. Decorative/effect rings use flat 64-segment strips after earlier torus profiling. Arrows and loot reuse renderer meshes up to the peak active count. Gameplay uses short-lived arrow records and hit sets; no GPU crowd animation has been introduced.

WebGPU is preferred, with WebGL2 fallback. `?backend=auto|webgl|webgpu` or the selector chooses a preference; the HUD reports the actual backend, including legacy WebGL1 compatibility when required by Babylon. Explicit WebGPU still falls back when unavailable. For experimental headless software WebGPU, `MUSOU_WEBGPU=1 npm run benchmark -- --grep 'benchmark auto'` adds an unsafe Chromium flag. The earlier experiment crashed Chromium; [hardware WebGPU remains unverified](evidence/WEBGPU_LIMIT.md).

## Offline and GitHub Pages

`npm run build` emits relative assets in `dist/` (`base: './'`), including a content-versioned service worker precaching all local chunks and icons. Serve it over HTTP(S), including a repository subpath; do not use `file://`. After first online load and service-worker activation, reloads work offline. Install from the browser's install menu when supported.

`.github/workflows/pages.yml` runs locked install, tests, strict build, Chromium smoke/visual/offline checks and benchmarks, then uploads the Pages candidate and validation artifacts. Configure repository Pages to use GitHub Actions and manually dispatch the workflow on main to publish. Pushes and pull requests validate without deploying. CI runs the gameplay checks before the expensive benchmarks and keeps separate reports for both.

## Tests and limitations

Unit/integration coverage includes damage, armor, melee and projectile hit deduplication, swept arrow collisions, piercing order, spatial queries, AI states, seed/cadence repeatability, special targeting, finite waves, reward collection/caps, consumables, relic choices, defeat/victory and fresh retry. Playwright checks real keyboard and simulated gamepad controls, both hero/relic menus, ranged combat and strafe, specials/bombs, a controlled five-wave completion, death/retry, pause, responsive screenshots, offline root/subpath reloads, backend fallback and benchmark JSON/downloads. Full-wave browser completion accelerates enemy defeats through the debug API; combat correctness is tested separately. Deliberately refresh and inspect screenshots with `npm run test:e2e -- --update-snapshots` before accepting references.

Balance is an initial pass: five waves in one arena, two fixed weapon kits, no bosses, weapon swapping, persistent unlocks, story, animation rigs, authored audio or collision solver. Aim assist is forward and nearest-target, with no manual lock-on or obstacles; pillars are decorative and arrows pass through them. Enemies can overlap. No touch controls or accessible nonvisual equivalent of the 3D combat. Menus have keyboard focus containment and gamepad navigation. Physical controllers, real hardware WebGPU and mobile GPUs still need device testing. Linux Chromium screenshots tolerate raster differences. Floating-point determinism is verified within one runtime, not cross-engine lockstep. The Babylon bundle exceeds Vite's 500 kB warning threshold; all chunks are local and precached.
