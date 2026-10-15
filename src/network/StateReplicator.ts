import { Simulation } from "../GameLoop";
import { CombatSystem, newPlayer, type Player } from "../CombatSystem";
import type { Enemy } from "../EnemyStore";
import { WEAPONS } from "../Weapons";
export interface Snapshot {
  v: 1;
  type: "snapshot";
  seq: number;
  tick: number;
  ack: number;
  players: { id: string; player: Player }[];
  enemies: Enemy[];
  arrows: {
    id: string;
    x: number;
    z: number;
    vx: number;
    vz: number;
    life: number;
  }[];
}
export const integer = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
const finite = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e9;
const playerTemplate = newPlayer();
export function validSnapshot(s: any): s is Snapshot {
  return (
    s?.v === 1 &&
    s.type === "snapshot" &&
    integer(s.seq) &&
    integer(s.tick) &&
    integer(s.ack) &&
    Array.isArray(s.players) &&
    s.players.length >= 1 &&
    s.players.length <= 4 &&
    s.players.every((e: any) => e && typeof e === "object") &&
    new Set(s.players.map((p: any) => p.id)).size === s.players.length &&
    s.players.every(
      (e: any) =>
        typeof e.id === "string" &&
        /^p[1-4]$/.test(e.id) &&
        e.player &&
        ["vanguard", "ranger"].includes(e.player.hero) &&
        Object.hasOwn(WEAPONS, e.player.weapon) &&
        Object.entries(playerTemplate).every(
          ([k, v]) => typeof v !== "number" || finite(e.player[k]),
        ),
    ) &&
    Array.isArray(s.enemies) &&
    s.enemies.length <= 300 &&
    s.enemies.every((e: any) => e && typeof e === "object") &&
    new Set(s.enemies.map((e: any) => e.id)).size === s.enemies.length &&
    s.enemies.every(
      (e: any) =>
        integer(e.id) &&
        ["grunt", "flanker", "armored"].includes(e.kind) &&
        ["pursuit", "windup", "attack", "stagger", "dead"].includes(e.state) &&
        [
          "x",
          "z",
          "hp",
          "maxHp",
          "timer",
          "vx",
          "vz",
          "flash",
          "attackYaw",
        ].every((k) => finite(e[k])),
    ) &&
    Array.isArray(s.arrows) &&
    s.arrows.length <= 256 &&
    s.arrows.every(
      (a: any) =>
        a &&
        typeof a === "object" &&
        typeof a.id === "string" &&
        /^p[1-4]:[0-9]+$/.test(a.id),
    ) &&
    new Set(s.arrows.map((a: any) => a.id)).size === s.arrows.length &&
    s.arrows.every((a: any) =>
      ["x", "z", "vx", "vz", "life"].every((k) => finite(a[k])),
    )
  );
}
export class StateReplicator {
  seq = 0;
  dropped = 0;
  applied = 0;
  target?: Snapshot;
  capture(sim: Simulation, ack: number): Snapshot {
    return {
      v: 1,
      type: "snapshot",
      seq: ++this.seq,
      tick: sim.ticks,
      ack,
      players: [
        { id: "p1", player: sim.player },
        ...[...sim.remotePlayers].map(([id, e]) => ({ id, player: e.player })),
      ],
      enemies: sim.enemies.enemies,
      arrows: [
        { id: "p1", combat: sim.combat },
        ...[...sim.remotePlayers].map(([id, e]) => ({ id, combat: e.combat })),
      ].flatMap(({ id, combat }) =>
        combat.arrows.map(({ id: arrowId, x, z, vx, vz, life }) => ({
          id: `${id}:${arrowId}`,
          x,
          z,
          vx,
          vz,
          life,
        })),
      ),
    };
  }
  apply(value: unknown, sim: Simulation, localId: string) {
    if (
      !validSnapshot(value) ||
      value.seq <= this.seq ||
      (this.target !== undefined && value.tick < this.target.tick) ||
      !value.players.some((p) => p.id === localId)
    ) {
      this.dropped++;
      return false;
    }
    this.seq = value.seq;
    this.applied++;
    this.target = value;
    sim.ticks = value.tick;
    const previous = new Map([
      ["local", sim.player],
      ...[...sim.remotePlayers].map(([id, e]) => [id, e.player] as const),
    ]);
    sim.remotePlayers.clear();
    for (const { id, player } of value.players) {
      const old = previous.get(id === localId ? "local" : id);
      const next = {
        ...player,
        x: old?.x ?? player.x,
        z: old?.z ?? player.z,
        yaw: old?.yaw ?? player.yaw,
      };
      if (id === localId) sim.player = next;
      else
        sim.remotePlayers.set(id, { player: next, combat: new CombatSystem() });
    }
    const oldEnemies = new Map(sim.enemies.enemies.map((e) => [e.id, e]));
    sim.enemies.enemies = value.enemies.map((e) => ({
      ...e,
      x: oldEnemies.get(e.id)?.x ?? e.x,
      z: oldEnemies.get(e.id)?.z ?? e.z,
    }));
    const oldArrows = new Map(sim.combat.arrows.map((a) => [a.networkId, a]));
    sim.combat.arrows = value.arrows.map((a) => ({
      ...a,
      networkId: a.id,
      id: undefined,
      x: oldArrows.get(a.id)?.x ?? a.x,
      z: oldArrows.get(a.id)?.z ?? a.z,
      remaining: 1,
      hit: new Set<number>(),
    }));
    sim.grid.rebuild(sim.enemies.enemies);
    return true;
  }
  interpolate(sim: Simulation, dt: number, localId: string) {
    if (!this.target) return;
    const alpha = 1 - Math.exp(-dt * 22);
    const move = (p: { x: number; z: number; yaw?: number }, t: typeof p) => {
      p.x += (t.x - p.x) * alpha;
      p.z += (t.z - p.z) * alpha;
      if (p.yaw !== undefined && t.yaw !== undefined)
        p.yaw +=
          Math.atan2(Math.sin(t.yaw - p.yaw), Math.cos(t.yaw - p.yaw)) * alpha;
    };
    for (const t of this.target.players) {
      const p =
        t.id === localId ? sim.player : sim.remotePlayers.get(t.id)?.player;
      if (p) move(p, t.player);
    }
    const arrows = new Map(sim.combat.arrows.map((a) => [a.networkId, a]));
    for (const t of this.target.arrows) {
      const a = arrows.get(t.id);
      if (a) move(a, t);
    }
    this.target.enemies.forEach((t, i) => {
      const e = sim.enemies.enemies[i];
      if (e) move(e, t);
    });
  }
}
