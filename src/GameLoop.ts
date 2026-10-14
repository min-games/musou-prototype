import { EnemyStore } from "./EnemyStore";
import { SpatialGrid } from "./SpatialGrid";
import { CombatSystem, newPlayer } from "./CombatSystem";
import { CrowdSystem } from "./CrowdSystem";
export interface InputFrame {
  x: number;
  z: number;
  attack: boolean;
  respawn: boolean;
  yaw: number;
}
export const idleInput: InputFrame = {
  x: 0,
  z: 0,
  attack: false,
  respawn: false,
  yaw: 0,
};
export class Simulation {
  player = newPlayer();
  enemies = new EnemyStore();
  grid = new SpatialGrid();
  combat = new CombatSystem();
  crowd = new CrowdSystem();
  ticks = 0;
  constructor(
    count = 20,
    readonly seed = 42,
  ) {
    this.enemies.spawn(count, seed);
  }
  reset(count = this.enemies.enemies.length) {
    this.player = newPlayer();
    this.enemies.spawn(count, this.seed);
    this.combat.reset();
    this.ticks = 0;
  }
  step(input: InputFrame, dt = 1 / 60) {
    if (input.respawn) {
      this.reset();
      return;
    }
    const p = this.player;
    const length = Math.hypot(input.x, input.z);
    if (p.hp > 0 && length > 0) {
      const x = input.x / Math.max(1, length),
        z = input.z / Math.max(1, length);
      const speed = p.recovery > 0 ? 2 : 5;
      p.x = Math.max(-23, Math.min(23, p.x + x * speed * dt));
      p.z = Math.max(-23, Math.min(23, p.z + z * speed * dt));
      p.yaw = Math.atan2(x, z);
    }
    this.enemies.advanceRespawns(dt, p.x, p.z);
    this.grid.rebuild(this.enemies.enemies);
    this.combat.step(p, this.grid, input.attack, dt);
    this.crowd.step(this.enemies.enemies, p, this.combat, this.grid, dt);
    this.ticks++;
  }
}
export class GameLoop {
  accumulator = 0;
  readonly dt = 1 / 60;
  droppedSeconds = 0;
  advance(elapsed: number, step: () => void) {
    const accepted = Math.max(0, Math.min(0.25, elapsed));
    this.droppedSeconds += Math.max(0, elapsed - accepted);
    this.accumulator += accepted;
    let count = 0;
    while (this.accumulator + 1e-10 >= this.dt) {
      step();
      this.accumulator -= this.dt;
      count++;
    }
    return count;
  }
}
