import { describe, expect, it } from "vitest";
import { CombatSystem, newPlayer } from "../src/CombatSystem";
import { EnemyStore } from "../src/EnemyStore";
import { GameLoop, Simulation, idleInput } from "../src/GameLoop";
import { SpatialGrid } from "../src/SpatialGrid";

describe("combat boundaries and simulation scheduling", () => {
  it("respawns a killed enemy after five seconds with deterministic full health", () => {
    const run = () => {
      const sim = new Simulation(1, 12);
      const enemy = sim.enemies.enemies[0]!;
      enemy.hp = 1;
      sim.player.stage = 3;
      sim.combat.strike(sim.player, enemy);
      for (let tick = 0; tick < 299; tick++) sim.step(idleInput);
      expect(enemy.state).toBe("dead");
      for (let tick = 0; tick < 2; tick++) sim.step(idleInput);
      expect(enemy.state).toBe("pursuit");
      expect(enemy.hp).toBe(60);
      expect(sim.player.kills).toBe(1);
      expect(
        Math.hypot(enemy.x - sim.player.x, enemy.z - sim.player.z),
      ).toBeGreaterThan(9);
      return enemy;
    };
    expect(run()).toEqual(run());
  });
  it("hits enemies in front but excludes enemies behind and outside reach", () => {
    const enemies = new EnemyStore();
    enemies.spawn(3);
    Object.assign(enemies.enemies[0]!, { x: 0, z: 2 });
    Object.assign(enemies.enemies[1]!, { x: 0, z: -2 });
    Object.assign(enemies.enemies[2]!, { x: 0, z: 3 });
    const grid = new SpatialGrid();
    grid.rebuild(enemies.enemies);
    const combat = new CombatSystem();
    const player = newPlayer();
    for (let tick = 0; tick < 20; tick++)
      combat.step(player, grid, tick === 0, 1 / 60);
    expect(enemies.enemies.map((enemy) => enemy.hp)).toEqual([35, 60, 60]);
  });

  it("does not expose dead enemies in spatial queries across negative cell boundaries", () => {
    const enemies = new EnemyStore();
    enemies.spawn(2);
    Object.assign(enemies.enemies[0]!, { x: -3.01, z: -0.01 });
    Object.assign(enemies.enemies[1]!, { x: -2.99, z: -0.01, state: "dead" });
    const grid = new SpatialGrid();
    grid.rebuild(enemies.enemies);
    expect(grid.query(-3, 0, 0.1).map((enemy) => enemy.id)).toEqual([0]);
  });

  it("runs the same seeded gameplay at different render frequencies", () => {
    const run = (fps: number) => {
      const sim = new Simulation(20, 123);
      const loop = new GameLoop();
      for (let frame = 0; frame < fps * 3; frame++) {
        loop.advance(1 / fps, () =>
          sim.step({ ...idleInput, x: 0.5, attack: sim.ticks % 24 === 0 }),
        );
      }
      return {
        ticks: sim.ticks,
        player: sim.player,
        enemies: sim.enemies.enemies,
      };
    };
    expect(run(30)).toEqual(run(144));
  });

  it("bounds catch-up work after a stalled frame and records discarded time", () => {
    const loop = new GameLoop();
    let ticks = 0;
    expect(loop.advance(4, () => ticks++)).toBe(15);
    expect(ticks).toBe(15);
    expect(loop.droppedSeconds).toBeCloseTo(3.75);
  });
});

describe("enemy lifecycle", () => {
  it("returns a defeated enemy after five seconds without losing kill totals", () => {
    const sim = new Simulation(1, 19);
    sim.player.stage = 3;
    sim.enemies.enemies[0]!.hp = 1;
    sim.combat.strike(sim.player, sim.enemies.enemies[0]!);
    for (let i = 0; i < 299; i++) sim.step(idleInput);
    expect(sim.enemies.enemies[0]!.state).toBe("dead");
    for (let i = 0; i < 3; i++) sim.step(idleInput);
    expect(sim.enemies.enemies[0]!.state).toBe("pursuit");
    expect(sim.enemies.enemies[0]!.hp).toBe(60);
    expect(sim.player.kills).toBe(1);
  });
});
