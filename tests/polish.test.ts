import { describe, it, expect } from "vitest";
import { CombatSystem, newPlayer, SPECIAL } from "../src/CombatSystem";
import { ENEMY_TYPES, EnemyStore } from "../src/EnemyStore";
import { Simulation, idleInput } from "../src/GameLoop";
import { SpatialGrid } from "../src/SpatialGrid";

describe("enemy roles", () => {
  it("spawns a reproducible 12/4/4 crowd with distinct health and preserves roles on respawn", () => {
    const store = new EnemyStore();
    store.spawn(20, 77);
    expect(store.enemies.filter((e) => e.kind === "grunt")).toHaveLength(12);
    expect(store.enemies.filter((e) => e.kind === "flanker")).toHaveLength(4);
    expect(store.enemies.filter((e) => e.kind === "armored")).toHaveLength(4);
    const before = structuredClone(store.enemies);
    store.spawn(20, 77);
    expect(store.enemies).toEqual(before);
    const e = store.enemies[4]!;
    e.state = "dead";
    e.timer = 0;
    e.hp = 0;
    store.advanceRespawns(1 / 60, 23, 23);
    expect(e.kind).toBe("armored");
    expect(e.hp).toBe(ENEMY_TYPES.armored.hp);
    expect(Math.hypot(e.x - 23, e.z - 23)).toBeGreaterThanOrEqual(7);
  });
  it("makes flankers faster and approach sideways, while armor advances slowly", () => {
    const positions = [0, 3, 4].map((id) => {
      const sim = new Simulation(5);
      sim.enemies.enemies.forEach((e) => {
        e.state = "dead";
        e.timer = 100;
      });
      const e = sim.enemies.enemies[id]!;
      Object.assign(e, { x: 0, z: 10, state: "pursuit" });
      for (let tick = 0; tick < 60; tick++) sim.step(idleInput);
      return { x: e.x, distance: Math.hypot(e.x, 10 - e.z) };
    });
    expect(positions[1]!.distance).toBeGreaterThan(positions[0]!.distance);
    expect(Math.abs(positions[1]!.x)).toBeGreaterThan(0.5);
    expect(positions[2]!.distance).toBeLessThan(positions[0]!.distance);
  });
  it("armor withstands light-hit stagger but the combo finisher breaks its windup", () => {
    const store = new EnemyStore();
    store.spawn(5);
    const e = store.enemies[4]!,
      p = newPlayer();
    Object.assign(e, { state: "windup", timer: 0.8, x: 0, z: 1 });
    p.stage = 1;
    new CombatSystem().strike(p, e);
    expect(e.hp).toBe(103);
    expect(e.state).toBe("windup");
    p.stage = 3;
    new CombatSystem().strike(p, e);
    expect(e.hp).toBe(63);
    expect(e.state).toBe("stagger");
  });
  it("locks an enemy attack direction so stepping out of its cone avoids damage", () => {
    const sim = new Simulation(1),
      e = sim.enemies.enemies[0]!;
    Object.assign(e, { x: 0, z: 0, state: "windup", timer: 0, attackYaw: 0 });
    sim.player.x = 1;
    sim.player.z = 0;
    sim.step(idleInput);
    expect(sim.player.hp).toBe(100);
    expect(e.state).toBe("attack");
  });
});

describe("Solar Break", () => {
  it("charges only for a successful unique melee hit and caps at 100", () => {
    const store = new EnemyStore();
    store.spawn(1);
    const e = store.enemies[0]!,
      p = newPlayer(),
      c = new CombatSystem();
    p.charge = 95;
    p.stage = 1;
    expect(c.strike(p, e)).toBe(true);
    expect(p.charge).toBe(100);
    p.charge = 0;
    expect(c.strike(p, e)).toBe(false);
    expect(p.charge).toBe(0);
  });
  it("requires a full meter and living hero, consumes it once, and protects the cast", () => {
    const p = newPlayer(),
      c = new CombatSystem(),
      grid = new SpatialGrid();
    p.charge = 99;
    c.step(p, grid, false, 1 / 60, true);
    expect(p.specials).toBe(0);
    expect(p.charge).toBe(99);
    p.charge = 100;
    c.step(p, grid, false, 1 / 60, true);
    expect(p.specials).toBe(1);
    expect(p.charge).toBe(0);
    expect(c.damage(p, 50)).toBe(false);
    c.step(p, grid, false, 1 / 60, true);
    expect(p.specials).toBe(1);
    p.hp = 0;
    p.charge = 100;
    p.specialTimer = 0;
    c.step(p, grid, false, 1 / 60, true);
    expect(p.specials).toBe(1);
  });
  it("hits front and rear targets once at impact, pierces armor, and excludes out-of-range enemies", () => {
    const store = new EnemyStore();
    store.spawn(5);
    store.enemies.forEach((e) => {
      e.state = "dead";
    });
    Object.assign(store.enemies[0]!, { state: "pursuit", x: 0, z: 2 });
    Object.assign(store.enemies[1]!, { state: "pursuit", x: 0, z: -2 });
    Object.assign(store.enemies[2]!, {
      state: "pursuit",
      x: SPECIAL.radius + 0.1,
      z: 0,
    });
    Object.assign(store.enemies[4]!, {
      state: "windup",
      x: 1,
      z: 0,
      timer: 0.8,
    });
    const grid = new SpatialGrid();
    grid.rebuild(store.enemies);
    const p = newPlayer(),
      combat = new CombatSystem();
    p.charge = 100;
    combat.step(p, grid, false, 1 / 60, true);
    expect(store.enemies[0]!.hp).toBe(60);
    for (let tick = 0; tick < 60; tick++) combat.step(p, grid, false, 1 / 60);
    expect(store.enemies[0]!.state).toBe("dead");
    expect(store.enemies[1]!.state).toBe("dead");
    expect(store.enemies[2]!.hp).toBe(60);
    expect(store.enemies[4]!.hp).toBe(40);
    expect(store.enemies[4]!.state).toBe("stagger");
    expect(p.hits).toBe(3);
    expect(p.kills).toBe(2);
    expect(p.charge).toBe(0);
  });
  it("locks movement during the move, then restores movement and resets its state", () => {
    const sim = new Simulation(0);
    sim.player.charge = 100;
    sim.step({ ...idleInput, special: true });
    for (let tick = 0; tick < 10; tick++) sim.step({ ...idleInput, x: 1 });
    expect(sim.player.x).toBe(0);
    for (let tick = 0; tick < 60; tick++) sim.step({ ...idleInput, x: 1 });
    expect(sim.player.x).toBeGreaterThan(0);
    sim.reset();
    expect(sim.player.specials).toBe(0);
    expect(sim.player.charge).toBe(0);
    expect(sim.player.specialTimer).toBe(0);
  });
  it("preserves seeded gameplay with mixed enemies, dodges, and specials", () => {
    const a = new Simulation(20, 551),
      b = new Simulation(20, 551);
    a.player.charge = b.player.charge = 100;
    for (let tick = 0; tick < 300; tick++) {
      const input = {
        ...idleInput,
        x: Math.sin(tick * 0.025),
        z: Math.cos(tick * 0.025),
        attack: tick % 24 === 0,
        special: tick === 90,
        dodge: tick % 100 === 0,
      };
      a.step(input);
      b.step(input);
    }
    expect(a).toEqual(b);
    expect(a.player.specials).toBe(1);
  });
});

it("dodge travels in the chosen direction, protects briefly, respects cooldown and arena bounds", () => {
  const sim = new Simulation(0);
  sim.step({ ...idleInput, x: 1, dodge: true });
  expect(sim.player.x).toBeGreaterThan(0.2);
  expect(sim.combat.damage(sim.player, 10)).toBe(false);
  for (let tick = 0; tick < 14; tick++) sim.step(idleInput);
  expect(sim.player.dashTimer).toBe(0);
  expect(sim.player.x).toBeCloseTo(2.6, 8);
  const x = sim.player.x;
  sim.step({ ...idleInput, dodge: true });
  expect(sim.player.x).toBe(x);
  for (let tick = 0; tick < 60; tick++) sim.step(idleInput);
  sim.player.x = 22.9;
  sim.step({ ...idleInput, x: 1, dodge: true });
  expect(sim.player.x).toBe(23);
});
