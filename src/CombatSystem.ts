import type { Enemy } from "./EnemyStore";
import { SpatialGrid } from "./SpatialGrid";
export interface Player {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  recovery: number;
  stage: number;
  swing: number;
  buffer: number;
  comboWindow: number;
  kills: number;
  hitFlash: number;
}
export const newPlayer = (): Player => ({
  x: 0,
  z: 0,
  yaw: 0,
  hp: 100,
  recovery: 0,
  stage: 0,
  swing: 0,
  buffer: 0,
  comboWindow: 0,
  kills: 0,
  hitFlash: 0,
});
export class CombatSystem {
  private hit = new Set<number>();
  reset() {
    this.hit.clear();
  }
  damage(p: Player, amount: number) {
    if (p.hp <= 0 || p.recovery > 0) return false;
    p.hp = Math.max(0, p.hp - amount);
    p.recovery = 0.65;
    p.hitFlash = 0.2;
    return true;
  }
  step(p: Player, grid: SpatialGrid, attack: boolean, dt: number) {
    p.recovery = Math.max(0, p.recovery - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.comboWindow = Math.max(0, p.comboWindow - dt);
    if (attack) p.buffer = 0.22;
    else p.buffer = Math.max(0, p.buffer - dt);
    if (p.hp <= 0) {
      p.swing = 0;
      return;
    }
    if (p.swing <= 0 && p.buffer > 0 && p.recovery <= 0) {
      p.stage = p.comboWindow > 0 ? (p.stage % 3) + 1 : 1;
      p.swing = 0.38;
      p.buffer = 0;
      this.hit.clear();
    }
    if (p.swing > 0) {
      p.swing = Math.max(0, p.swing - dt);
      if (p.swing <= 0.29 && p.swing >= 0.1)
        for (const e of grid.query(p.x, p.z, 2.8)) {
          const dx = e.x - p.x,
            dz = e.z - p.z,
            d = Math.hypot(dx, dz);
          if (
            d < 0.01 ||
            (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)) / d >
              Math.cos(Math.PI * 0.42)
          )
            this.strike(p, e);
        }
      if (p.swing === 0) p.comboWindow = 0.28;
    }
  }
  strike(p: Player, e: Enemy) {
    if (this.hit.has(e.id) || e.state === "dead") return false;
    this.hit.add(e.id);
    e.hp = Math.max(0, e.hp - (p.stage === 3 ? 40 : 25));
    const d = Math.hypot(e.x - p.x, e.z - p.z) || 1;
    e.vx = ((e.x - p.x) / d) * 7;
    e.vz = ((e.z - p.z) / d) * 7;
    e.timer = e.hp === 0 ? 5 : 0.4;
    e.state = e.hp === 0 ? "dead" : "stagger";
    if (e.hp === 0) p.kills++;
    return true;
  }
}
