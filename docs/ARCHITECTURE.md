# Gameplay and presentation boundaries

`GameLoop` accumulates elapsed time into fixed 1/60-second ticks, capped at 15 catch-up steps. It records discarded stall time. Simulation state is rendered without interpolation. Pause resets the accumulator and wall-clock timestamp so returning to a hidden tab does not simulate missed combat.

`Simulation` owns a `Player`, `EnemyStore`, `SpatialGrid`, `CombatSystem`, `CrowdSystem` and field pickup records. Each tick handles movement/dodge, enemy timers, grid rebuild, bomb input, combat/projectiles and AI. All positions are kinematic and clamped to the arena. No DOM, Babylon types, wall clock or unseeded randomness enters these modules.

`Weapons.ts` is a small readonly table of six loadouts. `weaponStats` resolves kit-compatible defaults, applies capped speed/reach/arrow bonuses, quantizes attack periods to whole ticks, and calculates single-target / crowd DPS. Combat, HUD, comparison cards, renderer and benchmark metadata read those same values; there is no second balance table. Special damage/radii/targeting stay kit-specific.

`CombatSystem` owns per-swing hit IDs, cast impact gating and arrow records. Each arrow stores position, velocity, remaining life, base weapon damage, local hit IDs, shared volley hit IDs and remaining penetrations. A volley fans symmetrically around assisted facing. Every enemy can take damage once per volley. Repeated contacts still consume an arrow's penetration budget; they do not pass freely through an already-hit body. A swept segment queries a bounding circle in the spatial grid, projects candidate enemy centers onto the segment, rejects candidates beyond the 0.65-unit collision radius, then resolves hits in first collision-surface order (ID breaks ties). This avoids tunneling at fixed ticks and duplicate hits across ticks. Death and cooldown checks gate new attacks. Kit-specific special origins lock at cast time; exactly one impact resolves. `applyHit` centralizes armor-adjusted caller damage, stat multipliers, hit feedback, stagger/knockback, kills, charge and kill healing.

`EnemyStore` provides seeded spawning and optional five-second returns. `CrowdSystem` owns pursuit, windup, attack, stagger and dead states, local separation and role behavior. `SpatialGrid` excludes dead enemies on rebuild and performs exact circular filtering over candidate cells. Combat also checks current death state because multiple actions can share a rebuilt grid in one tick.

`RunDirector` wraps the existing simulation, leaving benchmark/practice behavior independent. It disables respawns, creates finite waves, claims each death once, emits deterministic drops, handles pickup caps/proximity, and freezes at choices or terminal states. Death takes priority over wave clear. A one-second clear delay lets effects finish, then all remaining drops are collected (excess capped supplies discarded). One valid relic selection applies once, heals 20 and starts the next wave at a safe distance. Kills, health and stat bonuses carry; projectiles/combos clear. A restart creates a fresh player, inventory, reward counter and build. Relic sampling shuffles a kit-appropriate pool with a seeded LCG derived from run seed and wave. Field drop types follow the documented defeat-count schedule; seed changes positions and relics, not item cadence.

```mermaid
stateDiagram-v2
    [*] --> Select
    Select --> Loadout: choose kit and seed
    Loadout --> Fighting: choose weapon
    Loadout --> Select: back
    Fighting --> Upgrade: wave 1–4 clear + 1 second
    Upgrade --> Rearm: open weapon comparison
    Rearm --> Upgrade: equip or back
    Upgrade --> Fighting: choose one relic
    Fighting --> Victory: wave 5 clear + 1 second
    Fighting --> Defeat: health reaches zero
    Victory --> Fighting: retry fresh run
    Defeat --> Fighting: retry fresh run
    Victory --> Select: choose another fighter
    Defeat --> Select: choose another fighter
    Fighting --> Select: new run
```

`InputManager` samples keyboard and gamepad at tick boundaries. Attacks are edges for melee, held for Ranger; special, dodge, bomb and restart are discrete edges. Ranger movement preserves facing while attacking. Menu input is handled in the browser coordinator because the simulation is frozen there. The initial seed defaults to 4242 or the validated URL parameter; an explicit New seed action draws a new seed using browser crypto and updates the URL. Retries preserve it.

`Renderer` defines the backend interface. `BabylonRenderer` uses modular ES imports and built-in materials, selecting WebGPU with fallback. It reads state only: body meshes, telegraphs, health bars, bow/blade, arrow meshes, color-coded drops, bomb ring and kit-specific special effects. Arrow/drop presentation pools grow to the peak visible count and reuse meshes afterward. Reduced motion changes presentation only. `AudioFeedback` observes counters and health; `main.ts` owns menus, focus, HUD, pause and browser lifecycle.

`BenchmarkRunner` creates its own seeded `Simulation` without a `RunDirector`, suspending interactive play. Melee and ranged workloads have different scenario IDs. Requested actors stay alive for valid 0/20/100/300 comparisons. Measurements include rendering and collision work but intentionally exclude field rewards and relic decisions. Prototype debug hooks expose state for controlled browser fixtures; they are not a persistence or networking API.

## Weapon lifetime and measurements

A fresh run initializes weapon statistics and inventory, then equips a compatible definition. `RunDirector.equip` accepts only upgrade/rearm states and matching hero weapons. It preserves health, charge, kills and relic bonuses, clears active combat state, and refreshes seeded offers after cap filtering. There is no mid-fight equip/cancel exploit. Retries use the current weapon and a fresh build.

Melee hit windows and rendered animation progress use the active swing duration. The renderer scales the indicator to current reach and rebuilds its simple sector only when the weapon arc changes. Weapon meshes reuse the blade/guard, spear shaft/point and bow limbs/string rather than loading an art library. Arrow visual pools grow to peak active count and remain separate from simulation hit sets.

DPS is derived from rounded unarmored damage and actual tick cadence. Melee averages a complete three-stage chain; bows count one damage event per target per volley. Crowd totals multiply by arrows and `(1 + pierce)`, assuming every contact finds a distinct target. Unit tests validate these estimates with sustained simulated damage, including boosted speed/damage, seven arrows and piercing. They do not assert a desired frame rate.

Benchmark IDs now include weapon and base/max build. The seven-arrow stress case uses Shortbow because its capped cadence and extended lifetime can keep the most arrows active among the three bows. Fixed samples record peak arrows, effective stats and actual living counts. Prior scenario JSON is archived separately; new timing/draw-call results are not presented as the same workload.

## LAN multiplayer

The existing simulation now accepts additional owned players, each with an independent instance of the same combat controller. Crowd AI advances once per host tick and targets the nearest living fighter. Additional hero meshes and effects reuse the existing rendering/animation routines. Only host/single-player execute simulation; the client applies bounded snapshots and interpolates presentation. Native WebRTC, manual signaling, sessions and replication live under `src/network`. LAN uses the endless arena; campaign choices and rewards remain single-player. See [multiplayer architecture](multiplayer-architecture.md), [LAN testing](lan-testing.md) and [validation evidence](../evidence/MULTIPLAYER-VALIDATION.md).
