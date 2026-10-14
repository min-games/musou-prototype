import { ENEMY_TYPES, type Enemy } from "./EnemyStore";
import { SpatialGrid } from "./SpatialGrid";
export const SPECIAL = {
  cost: 100,
  duration: 0.85,
  impactAt: 0.16,
  radius: 6.5,
  damage: 80,
} as const;
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
  charge: number;
  specialTimer: number;
  specialX: number;
  specialZ: number;
  specials: number;
  hits: number;
  impact: number;
  dashTimer: number;
  dashCooldown: number;
  dashX: number;
  dashZ: number;
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
  charge: 0,
  specialTimer: 0,
  specialX: 0,
  specialZ: 0,
  specials: 0,
  hits: 0,
  impact: 0,
  dashTimer: 0,
  dashCooldown: 0,
  dashX: 0,
  dashZ: 1,
});
export class CombatSystem {
  private hit = new Set<number>();
  private specialFired = false;
  reset() {
    this.hit.clear();
    this.specialFired = false;
  }
  damage(p: Player, amount: number) {
    if (p.hp <= 0 || p.recovery > 0 || p.specialTimer > 0 || p.dashTimer > 0)
      return false;
    p.hp = Math.max(0, p.hp - amount);
    p.recovery = 0.65;
    p.hitFlash = 0.2;
    return true;
  }
  step(
    p: Player,
    grid: SpatialGrid,
    attack: boolean,
    dt: number,
    special = false,
  ) {
    p.recovery = Math.max(0, p.recovery - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.impact = Math.max(0, p.impact - dt);
    p.comboWindow = Math.max(0, p.comboWindow - dt);
    if (p.hp <= 0) {
      p.swing = 0;
      p.specialTimer = 0;
      p.buffer = 0;
      return;
    }
    if (
      special &&
      p.charge >= SPECIAL.cost &&
      p.specialTimer <= 0 &&
      p.dashTimer <= 0
    ) {
      p.charge -= SPECIAL.cost;
      p.specialTimer = SPECIAL.duration;
      p.specialX = p.x;
      p.specialZ = p.z;
      p.specials++;
      p.swing = 0;
      p.buffer = 0;
      p.comboWindow = 0;
      p.stage = 0;
      this.specialFired = false;
    }
    if (p.specialTimer > 0) {
      p.specialTimer = Math.max(0, p.specialTimer - dt);
      if (
        !this.specialFired &&
        SPECIAL.duration - p.specialTimer >= SPECIAL.impactAt
      ) {
        this.specialFired = true;
        for (const enemy of grid.query(p.specialX, p.specialZ, SPECIAL.radius))
          this.applyHit(p, enemy, SPECIAL.damage, true);
        p.impact = 0.3;
      }
      return;
    }
    if (p.dashTimer > 0) {
      p.buffer = 0;
      return;
    }
    if (attack) p.buffer = 0.22;
    else p.buffer = Math.max(0, p.buffer - dt);
    if (p.swing <= 0 && p.buffer > 0 && p.recovery <= 0) {
      p.stage = p.comboWindow > 0 ? (p.stage % 3) + 1 : 1;
      p.swing = 0.38;
      p.buffer = 0;
      this.hit.clear();
    }
    if (p.swing > 0) {
      p.swing = Math.max(0, p.swing - dt);
      if (p.swing <= 0.29 && p.swing >= 0.1) {
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
      }
      if (p.swing === 0) p.comboWindow = 0.28;
    }
  }
  strike(p: Player, e: Enemy) {
    if (p.hp <= 0 || this.hit.has(e.id) || e.state === "dead") return false;
    this.hit.add(e.id);
    const damage =
      p.stage === 3 ? 40 : Math.ceil(25 * ENEMY_TYPES[e.kind].armor);
    this.applyHit(p, e, damage, false);
    return true;
  }
  private applyHit(p: Player, e: Enemy, damage: number, special: boolean) {
    if (e.state === "dead") return;
    e.hp = Math.max(0, e.hp - damage);
    e.flash = 0.18;
    p.hits++;
    p.impact = 0.1;
    const distance = Math.hypot(e.x - p.x, e.z - p.z);
    const x = distance > 0.01 ? (e.x - p.x) / distance : Math.sin(p.yaw);
    const z = distance > 0.01 ? (e.z - p.z) / distance : Math.cos(p.yaw);
    const armored = e.kind === "armored" && !special && p.stage < 3;
    const force = special ? 14 : armored ? 2 : p.stage === 3 ? 10 : 7;
    e.vx = x * force;
    e.vz = z * force;
    if (e.hp === 0) {
      e.state = "dead";
      e.timer = 5;
      p.kills++;
    } else if (!(armored && e.state === "windup")) {
      e.state = "stagger";
      e.timer = special ? 0.8 : armored ? 0.18 : 0.4;
    }
    if (!special)
      p.charge = Math.min(SPECIAL.cost, p.charge + 10 + (e.hp === 0 ? 10 : 0));
  }
}
