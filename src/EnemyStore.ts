export type EnemyKind = "grunt" | "flanker" | "armored";
export type EnemyState = "pursuit" | "windup" | "attack" | "stagger" | "dead";
export const ENEMY_TYPES = {
  grunt: {
    name: "Grunt",
    hp: 60,
    speed: 2.15,
    damage: 9,
    windup: 0.5,
    reach: 1.45,
    range: 1.8,
    recovery: 0.6,
    armor: 1,
    color: "#b96555",
  },
  flanker: {
    name: "Flanker",
    hp: 45,
    speed: 3.1,
    damage: 7,
    windup: 0.38,
    reach: 1.3,
    range: 1.7,
    recovery: 0.75,
    armor: 1,
    color: "#55bab6",
  },
  armored: {
    name: "Armored",
    hp: 120,
    speed: 1.25,
    damage: 18,
    windup: 0.95,
    reach: 2,
    range: 2.4,
    recovery: 1.1,
    armor: 0.65,
    color: "#9b83bd",
  },
} as const;
export interface Enemy {
  id: number;
  kind: EnemyKind;
  maxHp: number;
  x: number;
  z: number;
  hp: number;
  state: EnemyState;
  timer: number;
  vx: number;
  vz: number;
  flash: number;
  attackYaw: number;
}
export class EnemyStore {
  enemies: Enemy[] = [];
  private randomState = 42;
  private random() {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  spawn(count: number, seed = 42) {
    this.randomState = seed >>> 0;
    this.enemies = Array.from({ length: count }, (_, id) => {
      const kind: EnemyKind =
        id % 5 === 3 ? "flanker" : id % 5 === 4 ? "armored" : "grunt";
      const angle = this.random() * Math.PI * 2,
        radius = 4 + this.random() * 16;
      return {
        id,
        kind,
        maxHp: ENEMY_TYPES[kind].hp,
        x: Math.sin(angle) * radius,
        z: Math.cos(angle) * radius,
        hp: ENEMY_TYPES[kind].hp,
        state: "pursuit",
        timer: 0,
        vx: 0,
        vz: 0,
        flash: 0,
        attackYaw: angle + Math.PI,
      };
    });
  }
  advanceRespawns(dt: number, playerX: number, playerZ: number) {
    for (const enemy of this.enemies) {
      enemy.flash = Math.max(0, enemy.flash - dt);
      if (enemy.state !== "dead") continue;
      enemy.timer = Math.max(0, enemy.timer - dt);
      if (enemy.timer > 0) continue;
      const angle = this.random() * Math.PI * 2,
        distance = 10 + this.random() * 8;
      let x = Math.max(-23, Math.min(23, playerX + Math.sin(angle) * distance));
      let z = Math.max(-23, Math.min(23, playerZ + Math.cos(angle) * distance));
      // An outward spawn at an arena corner must not land on the hero.
      if (Math.hypot(x - playerX, z - playerZ) < 7) {
        x = playerX > 0 ? playerX - 10 : playerX + 10;
        z = playerZ > 0 ? playerZ - 5 : playerZ + 5;
      }
      Object.assign(enemy, {
        x,
        z,
        hp: enemy.maxHp,
        state: "pursuit",
        timer: 0,
        vx: 0,
        vz: 0,
        flash: 0,
        attackYaw: Math.atan2(playerX - x, playerZ - z),
      });
    }
  }
}
