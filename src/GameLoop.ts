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
  special?: boolean;
  dodge?: boolean;
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
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    const length = Math.hypot(input.x, input.z);
    if (input.dodge && p.hp > 0 && p.dashCooldown <= 0 && p.specialTimer <= 0) {
      p.dashX = length > 0.01 ? input.x / length : Math.sin(p.yaw);
      p.dashZ = length > 0.01 ? input.z / length : Math.cos(p.yaw);
      p.dashTimer = 0.2;
      p.dashCooldown = 0.75;
      p.swing = 0;
      p.buffer = 0;
    }
    if (p.hp > 0 && p.dashTimer > 0) {
      p.x = Math.max(-23, Math.min(23, p.x + p.dashX * 13 * dt));
      p.z = Math.max(-23, Math.min(23, p.z + p.dashZ * 13 * dt));
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      if (p.dashTimer < 1e-8) p.dashTimer = 0;
    } else if (p.hp > 0 && length > 0 && p.specialTimer <= 0) {
      const x = input.x / Math.max(1, length),
        z = input.z / Math.max(1, length);
      const speed = p.recovery > 0 ? 2 : 5;
      p.x = Math.max(-23, Math.min(23, p.x + x * speed * dt));
      p.z = Math.max(-23, Math.min(23, p.z + z * speed * dt));
      p.yaw = Math.atan2(x, z);
    }
    this.enemies.advanceRespawns(dt, p.x, p.z);
    this.grid.rebuild(this.enemies.enemies);
    this.combat.step(p, this.grid, input.attack, dt, input.special);
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
