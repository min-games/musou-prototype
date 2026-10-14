import type { Enemy } from "./EnemyStore";
export class SpatialGrid {
  private cells = new Map<string, Enemy[]>();
  constructor(readonly size = 3) {}
  rebuild(enemies: Enemy[]) {
    this.cells.clear();
    for (const e of enemies) {
      if (e.state === "dead") continue;
      const k = this.key(e.x, e.z);
      const a = this.cells.get(k) ?? [];
      a.push(e);
      this.cells.set(k, a);
    }
  }
  private key(x: number, z: number) {
    return `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`;
  }
  query(x: number, z: number, r: number) {
    const result: Enemy[] = [];
    for (
      let i = Math.floor((x - r) / this.size);
      i <= Math.floor((x + r) / this.size);
      i++
    )
      for (
        let j = Math.floor((z - r) / this.size);
        j <= Math.floor((z + r) / this.size);
        j++
      )
        for (const e of this.cells.get(`${i},${j}`) ?? [])
          if ((e.x - x) ** 2 + (e.z - z) ** 2 <= r * r) result.push(e);
    return result;
  }
}
