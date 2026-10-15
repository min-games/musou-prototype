import type { Hero } from "./CombatSystem";
import { Simulation } from "./GameLoop";
import type { Renderer } from "./Renderer";
export interface BenchmarkResult {
  count: number;
  seed: number;
  frames: number;
  frameMs: { p50: number; p95: number; p99: number };
  simulationMs: { p50: number; p95: number; p99: number };
  drawCalls: number;
  backend: string;
  metadata: Record<string, unknown>;
}
const stats = (a: number[]) => {
  a.sort((x, y) => x - y);
  return {
    p50: a[Math.floor(a.length * 0.5)] ?? 0,
    p95: a[Math.floor(a.length * 0.95)] ?? 0,
    p99: a[Math.min(a.length - 1, Math.floor(a.length * 0.99))] ?? 0,
  };
};
export class BenchmarkRunner {
  results: BenchmarkResult[] = [];
  async run(
    renderer: Renderer,
    frames = 240,
    onProgress = (s: string) => {
      void s;
    },
    hero: Hero = "vanguard",
  ) {
    this.results = [];
    for (const count of [0, 20, 100, 300]) {
      onProgress(`Benchmark: ${count} enemies`);
      const sim = new Simulation(count, 4242);
      sim.player.hero = hero;
      // Keep all actors alive so every sample measures the requested crowd size.
      sim.player.hp = 1_000_000;
      for (const enemy of sim.enemies.enemies) enemy.hp = 1_000_000;
      const times: number[] = [],
        simulation: number[] = [];
      let last = 0,
        draw = 0;
      for (let frame = 0; frame < frames + 60; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const now = performance.now();
        if (frame >= 60) times.push(now - last);
        last = now;
        const start = performance.now();
        // Keep the scripted player alive so the timed crowd does not become idle.
        sim.player.hp = 100;
        if (frame === 90) sim.player.charge = 100;
        sim.step({
          x: Math.sin(frame * 0.025),
          z: Math.cos(frame * 0.025),
          attack: frame % 24 === 0,
          attackHeld: hero === "ranger",
          respawn: false,
          yaw: 0,
          special: frame === 90,
        });
        if (frame >= 60) simulation.push(performance.now() - start);
        renderer.render(sim, (frame / 60) * 0.15, 0.8, true);
        draw += frame >= 60 ? renderer.drawCalls() : 0;
      }
      this.results.push({
        count,
        seed: 4242,
        frames,
        frameMs: stats(times),
        simulationMs: stats(simulation),
        drawCalls: draw / frames,
        backend: renderer.backend,
        metadata: {
          userAgent: navigator.userAgent,
          viewport: [innerWidth, innerHeight],
          dpr: devicePixelRatio,
          hardwareConcurrency: navigator.hardwareConcurrency,
          utc: new Date().toISOString(),
          warmupFrames: 60,
          scenario:
            hero === "ranger" ? "mixed-crowd-arrow-v1" : "mixed-crowd-solar-v2",
          hero,
          enemyTypes: {
            grunt: sim.enemies.enemies.filter((e) => e.kind === "grunt").length,
            flanker: sim.enemies.enemies.filter((e) => e.kind === "flanker")
              .length,
            armored: sim.enemies.enemies.filter((e) => e.kind === "armored")
              .length,
          },
          specialActivations: sim.player.specials,
          liveEnemies: sim.enemies.enemies.filter((e) => e.state !== "dead")
            .length,
          timing: "RAF wall intervals; CPU simulation only; no GPU timer query",
          renderer: renderer.metadata(),
          fixedHz: 60,
          camera:
            "origin orbit / distance 30 / 0.15 radians per simulation second",
          simulationStepsPerSample: 1,
          playerHealth: "refilled per tick to maintain active crowd workload",
          input:
            "sin/cos movement; strike every 24 ticks; Solar Break on tick 90",
        },
      });
    }
    return this.results;
  }
  export() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(this.results, null, 2)], {
        type: "application/json",
      }),
    );
    a.download = "iron-field-benchmarks.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
