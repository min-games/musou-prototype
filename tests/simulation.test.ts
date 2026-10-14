import { describe, it, expect } from "vitest";
import { Simulation, GameLoop, idleInput } from "../src/GameLoop";
import { CombatSystem, newPlayer } from "../src/CombatSystem";
import { EnemyStore } from "../src/EnemyStore";
import { SpatialGrid } from "../src/SpatialGrid";
describe("combat", () => {
  it("applies damage, recovery and death", () => {
    const c = new CombatSystem(),
      p = newPlayer();
    expect(c.damage(p, 40)).toBe(true);
    expect(p.hp).toBe(60);
    expect(c.damage(p, 40)).toBe(false);
    p.recovery = 0;
    c.damage(p, 100);
    expect(p.hp).toBe(0);
    expect(c.damage(p, 1)).toBe(false);
  });
  it("deduplicates each swing and counts kills once", () => {
    const sim = new Simulation(1),
      e = sim.enemies.enemies[0]!;
    e.x = 0;
    e.z = 1;
    sim.step({ ...idleInput, attack: true });
    for (let i = 0; i < 20; i++) sim.step(idleInput);
    expect(e.hp).toBe(35);
    expect(sim.combat.strike(sim.player, e)).toBe(false);
    for (let i = 0; i < 4; i++) sim.step(idleInput);
    sim.step({ ...idleInput, attack: true });
    for (let i = 0; i < 6; i++) sim.step(idleInput);
    expect(sim.player.stage).toBe(2);
  });
  it("tests arc exclusion and a buffered three-stage chain", () => {
    const sim = new Simulation(2);
    sim.enemies.enemies[0]!.x = 0;
    sim.enemies.enemies[0]!.z = 1;
    sim.enemies.enemies[1]!.x = 0;
    sim.enemies.enemies[1]!.z = -1;
    sim.step({ ...idleInput, attack: true });
    for (let i = 0; i < 6; i++) sim.step(idleInput);
    expect(sim.enemies.enemies[0]!.hp).toBe(35);
    expect(sim.enemies.enemies[1]!.hp).toBe(60);
    const chain = new Simulation(0);
    chain.step({ ...idleInput, attack: true });
    expect(chain.player.stage).toBe(1);
    for (let stage = 2; stage <= 3; stage++) {
      for (let i = 0; i < 24; i++)
        chain.step({ ...idleInput, attack: i === 15 });
      expect(chain.player.stage).toBe(stage);
    }
  });
  it("kills and respawns a full encounter", () => {
    const sim = new Simulation(20);
    const e = sim.enemies.enemies[0]!;
    sim.player.stage = 3;
    e.hp = 30;
    sim.combat.strike(sim.player, e);
    expect(e.state).toBe("dead");
    expect(sim.player.kills).toBe(1);
    sim.step({ ...idleInput, respawn: true });
    expect(sim.player.hp).toBe(100);
    expect(sim.player.kills).toBe(0);
    expect(sim.enemies.enemies.every((e) => e.hp === 60)).toBe(true);
  });
});
describe("spatial grid", () => {
  it("handles negative cells, radius boundaries, and dead enemies", () => {
    const store = new EnemyStore();
    store.spawn(3);
    store.enemies[0]!.x = -3;
    store.enemies[0]!.z = 0;
    store.enemies[1]!.x = 0;
    store.enemies[1]!.z = 4;
    store.enemies[2]!.x = 0;
    store.enemies[2]!.z = 0;
    store.enemies[2]!.state = "dead";
    const g = new SpatialGrid();
    g.rebuild(store.enemies);
    expect(g.query(0, 0, 3).map((e) => e.id)).toEqual([0]);
  });
});
describe("integration", () => {
  it("spawns seeded encounters and repeats deterministically", () => {
    const a = new Simulation(20, 7),
      b = new Simulation(20, 7);
    for (let i = 0; i < 300; i++) {
      const input = {
        ...idleInput,
        x: Math.sin(i * 0.03),
        attack: i % 30 === 0,
      };
      a.step(input);
      b.step(input);
    }
    expect(a).toEqual(b);
    expect(a.enemies.enemies).toHaveLength(20);
  });
  it("transitions pursuit to windup to attack and recovery", () => {
    const sim = new Simulation(1);
    const e = sim.enemies.enemies[0]!;
    e.x = 0;
    e.z = 1;
    sim.step(idleInput);
    expect(e.state).toBe("windup");
    for (let i = 0; i < 31; i++) sim.step(idleInput);
    expect(e.state).toBe("attack");
    expect(sim.player.hp).toBe(91);
    expect(sim.player.recovery).toBeGreaterThan(0);
  });
  it("advances at fixed 60Hz independent of render cadence", () => {
    const a = new Simulation(0),
      b = new Simulation(0),
      la = new GameLoop(),
      lb = new GameLoop();
    for (let i = 0; i < 60; i++)
      la.advance(1 / 60, () => a.step({ ...idleInput, x: 1 }));
    for (let i = 0; i < 20; i++)
      lb.advance(0.05, () => b.step({ ...idleInput, x: 1 }));
    expect(a.ticks).toBe(60);
    expect(b.player.x).toBeCloseTo(a.player.x, 10);
    expect(lb.advance(2, () => {})).toBe(15);
    expect(lb.droppedSeconds).toBe(1.75);
  });
});
