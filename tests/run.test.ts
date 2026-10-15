import { describe, expect, it } from "vitest";
import { Simulation, idleInput, GameLoop } from "../src/GameLoop";
import { RunDirector, WAVES } from "../src/RunDirector";
const makeRun = (hero: "vanguard" | "ranger" = "vanguard") => {
  const sim = new Simulation(0),
    run = new RunDirector(sim);
  run.start(hero);
  return { sim, run };
};
function clear(sim: Simulation, run: RunDirector) {
  for (const e of sim.enemies.enemies)
    sim.combat.applyHit(sim.player, e, 10000, true);
  for (let i = 0; i < 61; i++) run.step(idleInput);
}
describe("ranger combat", () => {
  it("sweeps arrows between ticks instead of tunneling through enemies", () => {
    const s = new Simulation(1);
    s.player.hero = "ranger";
    const e = s.enemies.enemies[0]!;
    e.x = 0;
    e.z = 3.5;
    s.step({ ...idleInput, attack: true }, 0.2);
    expect(e.hp).toBe(28);
    expect(s.player.charge).toBe(10);
    s.step(idleInput, 0.2);
    expect(e.hp).toBe(28);
    expect(s.combat.arrows).toHaveLength(0);
  });
  it("pierces in travel order and deduplicates targets across ticks", () => {
    const s = new Simulation(2);
    s.player.hero = "ranger";
    s.player.pierce = 1;
    s.enemies.enemies.forEach((e, i) => {
      e.x = 0;
      e.z = 3 + i * 2;
    });
    s.step({ ...idleInput, attack: true }, 0.25);
    expect(s.enemies.enemies.map((e) => e.hp)).toEqual([28, 28]);
    expect(s.player.hits).toBe(2);
    expect(s.combat.arrows).toHaveLength(0);
  });
  it("resolves the first collision surface even when target centers have another order", () => {
    const s = new Simulation(2);
    s.player.hero = "ranger";
    s.enemies.enemies[0]!.x = 0.64;
    s.enemies.enemies[0]!.z = 3;
    s.enemies.enemies[1]!.x = 0;
    s.enemies.enemies[1]!.z = 3.2;
    s.combat.arrows.push({
      x: 0,
      z: 0,
      vx: 0,
      vz: 24,
      life: 0.8,
      remaining: 1,
      hit: new Set(),
    });
    s.step(idleInput, 0.25);
    expect(s.enemies.enemies.map((e) => e.hp)).toEqual([60, 28]);
  });
  it("stops an unupgraded arrow at its first target", () => {
    const s = new Simulation(2);
    s.player.hero = "ranger";
    s.enemies.enemies.forEach((e, i) => {
      e.x = 0;
      e.z = 3 + i * 2;
    });
    s.step({ ...idleInput, attack: true }, 0.25);
    expect(s.enemies.enemies.map((e) => e.hp)).toEqual([28, 60]);
  });
  it("aims only forward and releases arrows at a bounded rate when held", () => {
    const s = new Simulation(2);
    s.player.hero = "ranger";
    s.enemies.enemies[0]!.x = 3;
    s.enemies.enemies[0]!.z = 8;
    s.enemies.enemies[1]!.x = 0;
    s.enemies.enemies[1]!.z = -2;
    s.grid.rebuild(s.enemies.enemies);
    expect(s.combat.aim(s.player, s.grid)?.id).toBe(0);
    s.enemies.spawn(0);
    for (let i = 0; i < 60; i++) s.step({ ...idleInput, attackHeld: true });
    expect(s.combat.arrows.length).toBeGreaterThan(0);
    expect(s.combat.arrows.length).toBeLessThanOrEqual(3);
    expect(s.player.shotCooldown).toBeGreaterThan(0);
  });
  it("Arrow Storm hits a forward cluster rather than the enemies behind the hero", () => {
    const s = new Simulation(3);
    s.player.hero = "ranger";
    s.player.charge = 100;
    s.enemies.enemies.forEach((e, i) => {
      e.x = 0;
      e.z = i === 2 ? -2 : 10 + i;
    });
    s.step({ ...idleInput, special: true });
    for (let i = 0; i < 30; i++) s.step(idleInput);
    expect(s.player.specialZ).toBe(10);
    expect(s.enemies.enemies.map((e) => e.state === "dead")).toEqual([
      true,
      true,
      false,
    ]);
    expect(s.player.hits).toBe(2);
    expect(s.player.charge).toBe(0);
  });
});
describe("five-wave runs", () => {
  it("starts different hero kits and keeps a finite 20-enemy first wave", () => {
    for (const hero of ["vanguard", "ranger"] as const) {
      const { sim, run } = makeRun(hero);
      expect(sim.player.hp).toBe(hero === "ranger" ? 85 : 100);
      expect(sim.player.bombs).toBe(1);
      expect(sim.player.charge).toBe(50);
      expect(sim.enemies.enemies).toHaveLength(20);
      expect(run.wave).toBe(1);
      expect(sim.enemies.enemies.every((e) => Math.hypot(e.x, e.z) >= 8)).toBe(
        true,
      );
      clear(sim, run);
      for (let i = 0; i < 360; i++) sim.step(idleInput);
      expect(sim.enemies.enemies.every((e) => e.state === "dead")).toBe(true);
    }
  });
  it("spends bombs once, hits in range and never consumes an empty inventory", () => {
    const { sim, run } = makeRun();
    sim.enemies.enemies.forEach((e, i) => {
      e.x = 0;
      e.z = i === 0 ? 4 : 18;
    });
    run.step({ ...idleInput, bomb: true });
    expect(sim.player.bombs).toBe(0);
    expect(sim.player.kills).toBe(1);
    run.step({ ...idleInput, bomb: true });
    expect(sim.player.kills).toBe(1);
    expect(sim.enemies.enemies[1]!.hp).toBe(60);
    expect(sim.pickups).toHaveLength(1);
  });
  it("collects field rewards by proximity, retains capped items and deduplicates deaths", () => {
    const { sim, run } = makeRun();
    sim.player.hp = 40;
    sim.pickups = [
      { id: 100, x: 0, z: 0, kind: "health" },
      { id: 101, x: 0, z: 0, kind: "charge" },
      { id: 102, x: 0, z: 0, kind: "power" },
      { id: 103, x: 0, z: 0, kind: "bomb" },
    ];
    run.step(idleInput);
    expect(sim.player.hp).toBe(62);
    expect(sim.player.charge).toBe(75);
    expect(sim.player.damageMult).toBe(1.04);
    expect(sim.player.bombs).toBe(2);
    expect(sim.pickups).toHaveLength(0);
    const e = sim.enemies.enemies[0]!;
    e.x = 10;
    e.z = 10;
    sim.combat.applyHit(sim.player, e, 10000, true);
    run.step(idleInput);
    run.step(idleInput);
    expect(sim.pickups).toHaveLength(1);
    sim.player.hp = sim.player.maxHp;
    sim.pickups.push({ id: 104, x: 0, z: 0, kind: "health" });
    run.step(idleInput);
    expect(sim.pickups.some((p) => p.id === 104)).toBe(true);
  });
  it("freezes between waves, applies exactly one chosen relic and preserves the build", () => {
    const { sim, run } = makeRun();
    sim.player.hp = 20;
    clear(sim, run);
    expect(run.state).toBe("upgrade");
    expect(run.choices).toHaveLength(3);
    const ticks = sim.ticks;
    run.step({ ...idleInput, attack: true });
    expect(sim.ticks).toBe(ticks);
    const choice = run.choices[0]!;
    run.choose(0);
    run.choose(0);
    expect(run.wave).toBe(2);
    expect(sim.enemies.enemies).toHaveLength(24);
    expect(run.build).toEqual([choice.name]);
    expect(sim.player.hp).toBeGreaterThan(20);
    expect(sim.pickups).toHaveLength(0);
  });
  it("finishes after five waves and gives defeat priority over a simultaneous clear", () => {
    const { sim, run } = makeRun("ranger");
    WAVES.forEach((count, i) => {
      expect(sim.enemies.enemies).toHaveLength(count);
      clear(sim, run);
      if (i < 4) run.choose(0);
    });
    expect(run.state).toBe("victory");
    expect(run.wave).toBe(5);
    expect(sim.player.kills).toBe(144);
    const ticks = sim.ticks;
    run.step(idleInput);
    expect(sim.ticks).toBe(ticks);
    run.start("vanguard");
    sim.player.hp = 0;
    clear(sim, run);
    expect(run.state).toBe("defeat");
    run.start("ranger");
    expect(run.build).toEqual([]);
    expect(sim.player.damageMult).toBe(1);
    expect(sim.player.bombs).toBe(1);
  });
  it("repeats seeded loot, wave spawns and relic choices across rendering cadences", () => {
    const a = makeRun("ranger"),
      b = makeRun("ranger"),
      la = new GameLoop(),
      lb = new GameLoop();
    for (let i = 0; i < 180; i++)
      la.advance(1 / 60, () =>
        a.run.step({ ...idleInput, attackHeld: true, x: 0.2 }),
      );
    for (let i = 0; i < 60; i++)
      lb.advance(0.05, () =>
        b.run.step({ ...idleInput, attackHeld: true, x: 0.2 }),
      );
    expect(a.sim).toEqual(b.sim);
    clear(a.sim, a.run);
    clear(b.sim, b.run);
    expect(a.run.choices.map((u) => u.id)).toEqual(
      b.run.choices.map((u) => u.id),
    );
    expect(a.sim.player).toEqual(b.sim.player);
  });
});
