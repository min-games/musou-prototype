# Two-kit roguelike slice validation

Candidate: workspace run `R-20261015031758-43b9b955`, based on `e0d49306b131`.

- Locked dependency install, strict TypeScript / production PWA build.
- 37 unit/integration tests, including original melee/crowd/spatial checks plus swept arrows, penetration order and hit deduplication, forward aiming and distinct special targeting, finite wave spawns, bomb spending/range, field pickup caps, one-time relic selection, seeded cadence repeatability, victory/defeat and fresh retry.
- 16 Playwright checks: original practice combat/gamepad/special/pause/offline/backend regression tests; default hero selection, Ranger arrows and strafe, Arrow Storm and bombs; controlled full five-wave run/relic choices/victory/retry/defeat; gamepad hero/relic navigation; narrow-screen hero selection; three benchmark suites.
- Visual references deliberately refreshed and inspected for the new HUD and menus. Browser wave completion accelerates defeats through the debug API; separate tests exercise actual input/combat.

## Measurements

The full suite exports [Vanguard WebGL](benchmark-webgl.json), [Vanguard auto](benchmark-auto.json), and [Ranger WebGL](benchmark-ranger-webgl.json), each covering 0/20/100/300 living enemies with seed 4242, 60 warmup and 180 measured frames. JSON contains frame/simulation percentiles and mean draw calls, plus environment metadata. Vanguard retains `mixed-crowd-solar-v2`; Ranger uses `mixed-crowd-arrow-v1` with held fire and a forward Arrow Storm. Do not compare different workload IDs as if the work were identical. Field loot and relic menus are outside these controlled crowd workloads; actual runs cap at 40 enemies.

These are local headless Chromium / SwiftShader measurements, not real GPU predictions. Correctness and actor counts are asserted; no FPS threshold is imposed. The earlier software WebGPU experiment remains [unverified after a Chromium crash](WEBGPU_LIMIT.md). Real hardware WebGPU, physical controllers, mobile GPUs and subjective balance need device/play testing.

## Visual evidence

[Ranger and Arrow Storm](ranger-storm.png), [relic decision](relic-choice.png), [narrow hero selector](hero-choice-mobile.png), [Vanguard special](solar-break.png), [practice arena](arena.png), [narrow HUD](mobile.png). Effects and pickup meshes reuse pools, while simulated arrows use swept segment collision. Menus freeze the run and contain keyboard focus; gamepad navigation is exercised with a simulated standard controller.

Prior milestone logs/measurements are explicitly archived in [pre-roguelike-v2](pre-roguelike-v2/). Current complete browser results are in [browser-results.json](browser-results.json); raw logs are available from the workspace run log and GitHub Actions validation artifacts. The worker executes unit, strict build and the full browser suite before committing the candidate. Known limitations and exact controls/rules are in the README and architecture document.

A follow-up candidate corrects floating-point dust at integer damage thresholds when percent bonuses stack. The new regression checks three power shards yield exactly 28 damage from a 25-damage strike, while a genuine 116.48-damage special still rounds up to 117. All 37 unit tests, strict build and the four focused run browser checks passed again; benchmark workloads are unchanged.

## Slow CI browser checks

The first full GitHub run passed all 16 checks. A slower runner on the rounding follow-up passed all three benchmarks (4.7–4.8 minutes each), but exposed four wall-clock-sensitive browser assertions. Failure snapshots already showed the expected Solar Break kills and Ranger charge gain after their five-second polling window expired. The movement check released its key after a fixed 350 ms, and menu pad pulses lasted only 120 ms. Assertions now allow 30 seconds, movement waits for observed distance before releasing, and gamepad menu press/release each span two browser frames. A shared optional CDP CPU throttle reproduces slow-frame conditions without changing gameplay or lowering correctness assertions. CI runs gameplay checks first and benchmarks afterward, with separate reports; benchmark hang guards allow ten minutes per backend without an FPS requirement.

The follow-up reruns all 37 unit tests, strict build, and the 13 non-benchmark browser checks with eightfold CPU throttling. The benchmark scenarios and gameplay are unchanged. The complete slow browser report is stored as `browser-results-slow.json`; CI uploads separate gameplay and benchmark reports.
