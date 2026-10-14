import "./style.css";
import { Simulation, GameLoop } from "./GameLoop";
import { InputManager } from "./InputManager";
import { BabylonRenderer } from "./BabylonRenderer";
import { BenchmarkRunner } from "./BenchmarkRunner";
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const status = document.querySelector<HTMLElement>("#status")!;
const notice = document.querySelector<HTMLElement>("#notice")!;
const select = document.querySelector<HTMLSelectElement>("#backend")!;
const preference =
  new URLSearchParams(location.search).get("backend") ?? "auto";
select.value = preference;
const renderer = await BabylonRenderer.create(canvas, preference);
const sim = new Simulation();
const input = new InputManager(canvas);
const loop = new GameLoop();
const benchmark = new BenchmarkRunner();
let paused = false;
let benchmarking = false,
  last = performance.now();
async function runBenchmark(frames = 240) {
  if (benchmarking) return [];
  benchmarking = true;
  try {
    return await benchmark.run(
      renderer,
      frames,
      (s) => (notice.textContent = s),
    );
  } finally {
    benchmarking = false;
    last = performance.now();
    notice.textContent = "Benchmarks complete · export JSON for details";
  }
}
select.onchange = () => {
  const url = new URL(location.href);
  url.searchParams.set("backend", select.value);
  location.href = url.href;
};
document.querySelector<HTMLButtonElement>("#bench")!.onclick = () =>
  void runBenchmark();
document.querySelector<HTMLButtonElement>("#export")!.onclick = () =>
  benchmark.export();
function frame(now: number) {
  if (!benchmarking) {
    if (!paused)
      loop.advance((now - last) / 1000, () => sim.step(input.poll(1 / 60)));
    renderer.render(sim, input.yaw, input.pitch);
    const p = sim.player;
    status.innerHTML = `<div class="health"><span>VITALITY</span><b>${p.hp} / 100</b><meter min="0" max="100" value="${p.hp}"></meter></div><div><span>CHAIN</span><b>${p.swing > 0 ? "0" + p.stage : "—"}</b></div><div><span>DEFEATED</span><b>${p.kills}</b></div><div><span>ALIVE</span><b>${sim.enemies.enemies.filter((e) => e.state !== "dead").length} / ${sim.enemies.enemies.length}</b></div><div><span>RENDERER</span><b>${renderer.backend}</b></div>`;
    canvas.classList.toggle("hit", p.hitFlash > 0);
    if (p.hp <= 0)
      notice.textContent = "You fell. Press R / gamepad Y to return.";
    else if (!benchmark.results.length)
      notice.textContent =
        "20 opponents · enemies return after 5 seconds · R restarts";
  }
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Read-only state plus explicit benchmark/reset hooks for reproducible browser verification.
Object.assign(window, {
  musou: {
    sim,
    renderer,
    runBenchmark,
    reset: () => sim.reset(),
    pause: (value: boolean) => {
      paused = value;
    },
  },
});
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("./sw.js").catch(console.error);
