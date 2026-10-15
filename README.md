# Iron Field

A browser Musou / roguelike vertical slice. Choose a melee Vanguard or bow-wielding Ranger and one of six weapons, collect field drops, build a set of relics and clear five finite enemy waves. Strict TypeScript, modular Babylon.js, Vite, a deterministic 60 Hz simulation and an offline static PWA. All geometry and sounds are procedural; no backend, physics engine, ECS, custom shaders or external art.

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

Open Vite's printed URL. Browser assertions allow slow software rendering; optional CPU throttling exercises state-driven waits and frame-based gamepad pulses. Browser tests build optimized test assets into `test-dist/` with an explicit localhost signaling override and serve them on port 5187, including `/musou/` for the Pages subpath check. Keep that port free. They use Chromium at 1280 × 720 with SwiftShader, plus a narrow-screen reference. `npm run benchmark` exports raw measurements for 0/20/100/300 enemies for both kits. Local server/browser execution must be permitted by your environment.

## Play

| Action                      | Keyboard / mouse    | Standard gamepad       |
| --------------------------- | ------------------- | ---------------------- |
| Move                        | WASD                | Left stick             |
| Orbit / pitch camera        | Drag / arrow keys   | Right stick            |
| Attack                      | J / Space           | A                      |
| Special (full charge)       | Q / K or HUD button | B                      |
| Dodge                       | Shift               | X                      |
| Use a carried bomb          | F or HUD button     | RB                     |
| Restart current run         | R                   | Y                      |
| Pause / resume              | Esc or Pause button | Pause button           |
| Hero / weapon / relic menus | 1–3, or Tab + Enter | D-pad / left stick + A |
| Change weapon between waves | E or Change weapon  | Y                      |
| Back from weapon selection  | Esc or Back button  | B                      |
| New seed in hero selection  | New seed button     | Y                      |

Choose your fighter, then pick one of three compatible weapons. Weapon cards compare damage, speed, reach, and ideal DPS. The same current statistics remain visible during play and update with relics. After clearing a wave, **E / gamepad Y / Change weapon** opens the loadout comparison again. Re-equip within the same hero's kit, keep your bonuses, then choose your relic to start the next wave. Combat swaps are disabled. Retry keeps the last weapon and resets the build; New run returns to fighter selection.

**Vanguard:** 100 health and a three-stage melee combo. Tap attack repeatedly; the weapon sets swing duration, arc and reach. Attacks accept a 0.22-second buffer and allow 0.28 seconds to continue the combo. Each enemy takes at most one hit per swing. Finishers pierce armor and interrupt armored windups. **Solar Break** consumes 100 charge, winds up for 0.16 seconds and deals 80 armor-piercing damage within 6.5 units of the hero. Its 0.85-second cast locks movement and protects the hero.

**Ranger:** 85 health. Hold attack to repeat volleys; hold while moving to strafe without turning away. Release attack and move to change facing. Forward aim assist selects the nearest target within a 120° cone, with a point-blank assist inside one unit. Assist range is 1.2 units shorter than current arrow travel. Arrows use swept collision and stop after their allowed number of target contacts. **Arrow Storm** retains its own targeting limit of 18 units regardless of weapon: mark the nearest forward target or a point eight units ahead, then strike its 4.5-unit-radius cluster for 105 armor-piercing damage after the same protected windup. Falling arrows and a cyan target ring distinguish it from Solar Break. The marked position locks on cast.

| Weapon     | Base damage  | Attacks / second | Reach / arrow travel | Coverage   | Ideal single-target DPS |
| ---------- | ------------ | ---------------: | -------------------: | ---------- | ----------------------: |
| Saber      | 25 / 25 / 40 |             2.61 |                  2.8 | 151° sweep |                     ~78 |
| Spear      | 34 / 34 / 55 |             2.00 |                  4.5 | 72° thrust |                     ~82 |
| Greatblade | 50 / 50 / 82 |             1.46 |                  3.4 | 173° sweep |                     ~89 |
| Shortbow   | 32 / arrow   |             3.00 |                 19.2 | 1 arrow    |                      96 |
| Longbow    | 65 / arrow   |             1.58 |                 28.8 | 1 arrow    |                    ~103 |
| Fan Bow    | 23 / arrow   |             1.88 |                 14.4 | 3 arrows   |                     ~43 |

The weapon model changes shape: narrow saber and guard, long wood-shafted spear with a point, broad greatblade, compact shortbow, tall longbow, and crossed limbs on the Fan Bow. Melee feedback uses the actual weapon arc and upgraded reach. These are simple procedural placeholders.

**Weapon upgrades:** Quick hands adds 15% attack-speed multiplier (cap ×2.5); Far reach adds 15% reach / arrow travel (cap ×1.75); Forked flight adds two arrows to Ranger volleys (cap seven). Split shaft adds one penetration per arrow and 10% damage. Weapon bonuses carry when rearming. Full-cap upgrades are omitted from offers; rearming recomputes eligible offers deterministically. Wave-two offers at default Ranger seed 4242 include Forked flight before caps apply.

**DPS is an estimate, not a live damage meter.** Cadence is rounded up to whole 60 Hz ticks: `ceil(basePeriod / attackSpeedMultiplier * 60) / 60`, with a minimum six-tick period. This makes the displayed rate attainable in the simulation. Normal damage rounds up after multipliers, with an epsilon to remove floating-point dust. Melee ideal DPS averages all three combo hits over three swing periods; bow single-target DPS is one rounded arrow hit per period. Crowd DPS multiplies that by arrow count and penetration count, requiring distinct unarmored targets on every path. Multishot cannot shotgun one target: all arrows in a volley share damage deduplication, and contact still consumes penetration when another arrow has already hit that target. Armor, misses, travel delay, interrupted combos and special moves change actual results. Fan Bow's base spread can deliver about 129 total DPS across three targets; its single-target estimate stays about 43.

Both kits earn 10 charge per unique normal hit and 10 extra on a kill, capped at 100. Specials and bombs do not refill charge from hits. Normal damage respects armor; specials and bombs pierce it. One bomb deals 160 base damage within eight units, including behind the hero. It costs one item, has a 0.6-second blast cooldown and grants no protection. Carry up to three. Both damage multipliers and special relics affect bombs.

**Run goal:** clear waves of 20 / 24 / 28 / 32 / 40 enemies, 144 defeats total. Each contains grunts, fast flankers and shielded armored enemies. Red cones lock their attack direction during windup; dodge sideways. Enemies never respawn during a run. After a one-second clear effect, remaining drops are swept up and the game freezes for a choice of one of three relics. The choice persists for the run, and entering the next wave heals 20 health. The fifth clear wins; zero health ends the run. Retry resets health, loot and relics. **New run** returns to hero selection and discards the current run.

Walk within two units of field drops: **green** heals 22, **blue** grants 25 special charge, **gold** adds 4% damage for the run, and **orange** adds a bomb. Every defeated enemy drops one item: every ninth defeat gives a bomb, otherwise every fifth gives health, every third gives charge, and the rest give power. Full health/charge/inventory drops remain until needed during combat. The end-of-wave sweep respects caps; excess supplies are discarded. Relics offer damage, maximum health/healing, movement and attack speed, attack reach, special power, healing on kills, bombs, extra arrows and Ranger arrow piercing. Bonuses stack additively within each stat; damage and special multipliers multiply together.

The default seed is 4242. **New seed** changes the next run's wave positions and relic offers and updates the shareable `?seed=...` URL; retry repeats the same seed. No progression is saved across reloads. `?practice=1` opens the original endless 20-enemy Vanguard encounter, where enemies respawn after five seconds and R / Y resets the encounter. Benchmarks remain isolated from run progression.

Dodge moves 2.6 units over 0.2 seconds with protection and a 0.75-second cooldown, cancelling the current swing. Ordinary hits grant 0.65 seconds of recovery protection with slower movement. Optional synthesized sound unlocks after a keyboard/canvas gesture. Reduced motion removes camera pulse and hero spin/lift and limits sparks to eight while retaining essential attack markers. Hidden tabs pause active combat and require resume. This prototype requires keyboard or gamepad; responsive layout does not imply touch movement support.

## Architecture

See [architecture and run state](docs/ARCHITECTURE.md). `Weapons` provides the shared data and effective stat calculations used by combat, UI, renderer and benchmarks. `GameLoop`, `CombatSystem`, `CrowdSystem`, `SpatialGrid`, `EnemyStore` and `RunDirector` are pure gameplay modules. `Renderer` / `BabylonRenderer`, `InputManager`, `AudioFeedback` and `BenchmarkRunner` form the browser boundary. No rendering method changes gameplay state. `window.musou` exposes simulation, run, renderer, pause/reset and benchmark hooks for prototype testing.

## Performance guide

Use **Run benchmarks**, keep the tab foreground, then **Export JSON**. The current hero and weapon determine the base-loadout scenario; relic bonuses are cleared for reproducible comparison. Endless practice selects Vanguard / Saber. The console hook `window.musou.runBenchmark(240, 'ranger', 'longbow')` selects another weapon. `window.musou.runBenchmark(240, 'ranger', 'shortbow', true)` measures a stress build with seven arrows, ×2.5 attack speed, ×1.75 travel, and two extra penetrations. Each of 0/20/100/300 enemies receives 60 warmup and 240 measured frames in the UI (180 in base-loadout tests; 120 in the maximum-arrow test). The camera follows a fixed orbit, seed 4242, with one simulation tick per sample regardless of RAF delay. Enemy health is raised and player health replenished so every requested actor stays alive.

`weapon-crowd-v1-<weapon>` uses scripted movement, a melee input every 24 ticks or held bow fire, and one fully charged hero special on tick 90. `weapon-crowd-max-v1-shortbow` adds the maximum multishot build above. Tests measure Saber on WebGL/auto and Shortbow on WebGL with 180 samples, plus the maximum arrow build with 120 samples; every scenario uses all four crowd sizes. JSON records frame / CPU simulation p50/p95/p99, draw calls, seed, scenario, weapon and effective statistics, peak active arrows, penetration count, viewport, adapter/backend, browser and UTC time. These workload IDs differ from the archived pre-weapon scenarios; compare like-for-like scenarios and sample counts. No scenario measures field loot or relic menus; active runs stop at 40. Frame intervals include scheduling, rendering and browser overhead rather than GPU timer queries. Sub-millisecond CPU values can quantize to zero.

See [validation evidence](evidence/VALIDATION.md) and the exported JSON. Compare on the same device, browser, resolution and power mode. Software rendering is not a gaming GPU forecast. No FPS gate is imposed. Per-enemy meshes and dense CPU separation remain scaling limits; the grid is not guaranteed linear in crowded cells. Decorative/effect rings use flat 64-segment strips after earlier torus profiling. Arrows and loot reuse renderer meshes up to the peak active count. Gameplay uses short-lived arrow records and hit sets; no GPU crowd animation has been introduced.

WebGPU is preferred, with WebGL2 fallback. `?backend=auto|webgl|webgpu` or the selector chooses a preference; the HUD reports the actual backend, including legacy WebGL1 compatibility when required by Babylon. Explicit WebGPU still falls back when unavailable. For experimental headless software WebGPU, `MUSOU_WEBGPU=1 npm run benchmark -- --grep 'benchmark auto'` adds an unsafe Chromium flag. The earlier experiment crashed Chromium; [hardware WebGPU remains unverified](evidence/WEBGPU_LIMIT.md).

## Offline and GitHub Pages

`npm run build` emits relative assets in `dist/` (`base: './'`), including a content-versioned service worker precaching all local chunks and icons. Serve it over HTTP(S), including a repository subpath; do not use `file://`. After first online load and service-worker activation, reloads work offline. Install from the browser's install menu when supported.

`.github/workflows/pages.yml` runs locked install, tests, strict build, Chromium smoke/visual/offline checks and benchmarks, then uploads the Pages candidate and validation artifacts. Configure repository Pages to use GitHub Actions and manually dispatch the workflow on main to publish. Pushes and pull requests validate without deploying. CI runs the gameplay checks before the expensive benchmarks and keeps separate reports for both.

## Tests and limitations

Unit/integration coverage includes all six weapons' observed sustained DPS, boosted DPS, cadence/reach, spread and per-volley deduplication, piercing, safe rearming, caps, and damage, armor, melee and projectile hit deduplication, swept arrow collisions, piercing order, spatial queries, AI states, seed/cadence repeatability, special targeting, finite waves, reward collection/caps, consumables, relic choices, defeat/victory and fresh retry. Playwright checks real keyboard and simulated gamepad controls, both hero/relic menus, ranged combat and strafe, specials/bombs, a controlled five-wave completion, death/retry, pause, responsive screenshots, offline root/subpath reloads, backend fallback and benchmark JSON/downloads. Full-wave browser completion accelerates enemy defeats through the debug API; combat correctness is tested separately. Deliberately refresh and inspect screenshots with `npm run test:e2e -- --update-snapshots` before accepting references.

Balance is an initial pass: five waves in one arena, six fixed weapon definitions, no bosses, in-combat weapon swaps, randomized weapon rarity, durability, persistent unlocks, story, animation rigs, authored audio or collision solver. Aim assist is forward and nearest-target, with no manual lock-on or obstacles; pillars are decorative and arrows pass through them. Enemies can overlap. No touch controls or accessible nonvisual equivalent of the 3D combat. Menus have keyboard focus containment and gamepad navigation. Physical controllers, real hardware WebGPU and mobile GPUs still need device testing. Linux Chromium screenshots tolerate raster differences. Floating-point determinism is verified within one runtime, not cross-engine lockstep. The Babylon bundle exceeds Vite's 500 kB warning threshold; all chunks are local and precached.

## Co-op rooms and offline LAN

Open **Multiplayer**, select **Create Game**, then share the eight-character room code or **Copy invite link**. The guest enters the code and selects **Join Game**. Opening an invite only prefills the code; it never joins automatically. Two fighters share an endless arena with host-authoritative enemies/combat and the existing three native WebRTC DataChannels. Cloudflare carries only SDP/ICE negotiation; gameplay remains direct between browsers. Automatic rooms use `stun:stun.cloudflare.com:3478`; TURN is disabled. Some NATs/firewalls cannot connect without a relay.

Production Vite builds default to `https://musou-signaling-dev.chungmin-wen.workers.dev`. Set `VITE_SIGNALING_URL` explicitly for a different service; development has no automatic default. For local development, use an independently running service configured to permit your exact local Origin, for example `VITE_SIGNALING_URL=http://127.0.0.1:8787 npm run dev`. The deployed service only permits `https://min-games.github.io`; localhost cannot use it. Normal browser tests use `.env.test` and a local contract fixture on port 5190, and leave the production `dist/` untouched.

For offline play, expand **Advanced · offline manual exchange**, select **Host LAN Game** / **Join LAN Game** and exchange the complete Offer and Answer. Manual mode has no public ICE servers or service dependency. Cache the app before going offline. Signaling interruption/room expiry warns without ending healthy gameplay. Rooms last up to 15 minutes; socket reconnect is bounded within the 60-second resume window. A failed room request is never retried automatically because its credential may already have been consumed. Create a fresh room when recovery fails. Tokens stay only in memory and are never shared in links. Campaign progression remains single-player. Physical LAN compatibility is unverified; isolated Wi-Fi or firewalls can prevent connections. See [setup and device testing](docs/lan-testing.md), [multiplayer architecture and limitations](docs/multiplayer-architecture.md), measured [browser replication overhead](evidence/multiplayer-overhead.json), and [signaling candidate validation](evidence/signaling-validation.md).
