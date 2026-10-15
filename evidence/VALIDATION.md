# Weapon system validation

Validated in isolated workspace run `R-20261015042952-6bdc1fda`, based on `fe6d037`.

- Locked dependency install and strict TypeScript / production PWA build passed.
- 56 unit/integration checks passed. Six weapon estimates are checked against sustained actual simulated damage; boosted melee and seven-arrow piercing crowd DPS are also checked. Coverage includes real cadence/reach changes, fan symmetry, per-volley deduplication, swept travel / piercing order, caps, safe rearming, retained builds, reset, and render-cadence determinism, plus the previous combat, spatial, enemy and run tests.
- 20 Playwright checks passed without retries: keyboard/gamepad loadout selection, three-target Fan Bow fire, seven visible arrows, extended spear hits, narrow-screen selection/back, between-wave rearming and held-controller reset protection, existing wave/special/bomb/pause/offline/fallback flows, screenshots, and four crowd benchmark suites.
- All 16 gameplay browser checks passed again with eightfold CDP CPU throttling. Assertions observe state; controller menu pulses span rendered frames.

[Unit log](unit-test.log), [build log](build.log), [full browser log](browser-test.log), [slow browser log](browser-slow-test.log), [full JSON report](browser-results.json), [slow JSON report](browser-results-slow.json).

## Measured weapon workloads

Headless Chromium / SwiftShader, seed 4242, fixed camera orbit and one 60 Hz simulation tick per sample. Requested actors stay alive. Sixty warmup frames precede 180 base-loadout samples or 120 maximum-arrow samples. The stress case uses Shortbow, seven arrows, ×2.5 attack speed, ×1.75 travel and two extra penetrations. Its effective statistics and peak arrows are recorded in JSON. These are software-rendered wall intervals and CPU durations, not real-GPU forecasts or GPU timer queries. No FPS requirement is imposed.

| Scenario / actual backend             | Enemies | Samples | Frame p50 / p95 / p99 ms | Simulation p50 / p95 / p99 ms | Mean draw calls | Peak arrows |
| ------------------------------------- | ------: | ------: | ------------------------ | ----------------------------- | --------------: | ----------: |
| weapon-crowd-v1-saber / WebGL2        |       0 |     180 | 26.00 / 33.70 / 54.30    | 0.00 / 0.10 / 0.30            |           44.97 |           0 |
| weapon-crowd-v1-saber / WebGL2        |      20 |     180 | 28.10 / 33.40 / 58.10    | 0.10 / 0.20 / 0.30            |           65.60 |           0 |
| weapon-crowd-v1-saber / WebGL2        |     100 |     180 | 40.30 / 50.90 / 81.20    | 0.20 / 0.40 / 0.50            |          146.18 |           0 |
| weapon-crowd-v1-saber / WebGL2        |     300 |     180 | 62.20 / 110.40 / 131.60  | 0.40 / 0.70 / 3.40            |          346.52 |           0 |
| weapon-crowd-v1-saber / WebGL2        |       0 |     180 | 26.20 / 32.90 / 55.50    | 0.00 / 0.10 / 0.20            |           44.97 |           0 |
| weapon-crowd-v1-saber / WebGL2        |      20 |     180 | 31.00 / 36.60 / 60.60    | 0.10 / 0.20 / 0.30            |           65.60 |           0 |
| weapon-crowd-v1-saber / WebGL2        |     100 |     180 | 41.70 / 56.90 / 83.10    | 0.20 / 0.30 / 0.90            |          146.18 |           0 |
| weapon-crowd-v1-saber / WebGL2        |     300 |     180 | 58.00 / 78.20 / 117.30   | 0.40 / 0.60 / 0.70            |          346.52 |           0 |
| weapon-crowd-v1-shortbow / WebGL2     |       0 |     180 | 28.30 / 37.20 / 66.30    | 0.00 / 0.10 / 0.20            |           46.31 |           3 |
| weapon-crowd-v1-shortbow / WebGL2     |      20 |     180 | 30.90 / 37.60 / 60.10    | 0.10 / 0.20 / 0.30            |           66.31 |           1 |
| weapon-crowd-v1-shortbow / WebGL2     |     100 |     180 | 39.70 / 48.40 / 78.90    | 0.20 / 0.40 / 0.50            |          147.93 |           1 |
| weapon-crowd-v1-shortbow / WebGL2     |     300 |     180 | 64.10 / 116.80 / 169.90  | 0.40 / 0.70 / 1.10            |          355.83 |           1 |
| weapon-crowd-max-v1-shortbow / WebGL2 |       0 |     120 | 27.70 / 37.30 / 59.90    | 0.10 / 0.30 / 0.40            |           78.73 |          58 |
| weapon-crowd-max-v1-shortbow / WebGL2 |      20 |     120 | 29.00 / 41.50 / 55.20    | 0.10 / 0.30 / 0.40            |          102.55 |          61 |
| weapon-crowd-max-v1-shortbow / WebGL2 |     100 |     120 | 37.30 / 50.30 / 70.90    | 0.30 / 0.50 / 0.70            |          175.49 |          47 |
| weapon-crowd-max-v1-shortbow / WebGL2 |     300 |     120 | 63.90 / 72.40 / 134.70   | 0.50 / 0.90 / 1.30            |          356.96 |          21 |

[WebGL Saber JSON](benchmark-webgl.json), [auto Saber JSON](benchmark-auto.json), [Shortbow JSON](benchmark-ranger-webgl.json), [maximum multishot JSON](benchmark-multishot-webgl.json). Versioned workload IDs distinguish weapon and base/max build. Prior accepted scenario results and validation notes are retained in [pre-weapons-v3](pre-weapons-v3/); compare only matching scenarios, sample counts and environments. Loot / relic decisions are outside the benchmarks; active runs remain 20–40 enemies.

## Visual evidence and limits

[Bow comparison](bow-loadouts.png), [seven-arrow spread](seven-arrow-fan.png), [spear reach](spear-reach.png), [relic choice](relic-choice.png), [Ranger special](ranger-storm.png), [Vanguard special](solar-break.png), [arena](arena.png), [narrow HUD](mobile.png). Reference screenshots were refreshed deliberately and inspected before the acceptance run. A frozen deterministic pose follows actual input/combat assertions.

This milestone uses six fixed procedural weapon definitions, not randomized weapon rarity or a full equipment inventory. Rearming is restricted to safe intermissions and resets active attacks while preserving bonuses. Ideal DPS excludes armor, misses, interruptions, travel delay and special damage; crowd totals need separate targets. Weapon stats do not alter hero special radii or the Ranger special's 18-unit targeting limit. Physical controllers, real hardware WebGPU and mobile GPUs still need device testing. The [previous software WebGPU crash](WEBGPU_LIMIT.md) remains a known limit. Balance is an initial pass; no bosses or touch movement were added. All runtime assets remain local and precached.
