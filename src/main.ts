import "./style.css";
import { Simulation, GameLoop } from "./GameLoop";
import { InputManager } from "./InputManager";
import { BabylonRenderer } from "./BabylonRenderer";
import { BenchmarkRunner } from "./BenchmarkRunner";
import { AudioFeedback } from "./AudioFeedback";
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>("game"),
  notice = element("notice"),
  select = element<HTMLSelectElement>("backend");
const preference =
  new URLSearchParams(location.search).get("backend") ?? "auto";
select.value = preference;
const renderer = await BabylonRenderer.create(canvas, preference),
  sim = new Simulation(),
  input = new InputManager(canvas);
const loop = new GameLoop(),
  benchmark = new BenchmarkRunner(),
  audio = new AudioFeedback();
let paused = false,
  benchmarking = false,
  last = performance.now(),
  lastHud = -Infinity;
const specialButton = element<HTMLButtonElement>("special"),
  pauseButton = element<HTMLButtonElement>("pause"),
  soundButton = element<HTMLButtonElement>("sound");
const reducedMotion = element<HTMLInputElement>("reduced-motion");
reducedMotion.checked = matchMedia("(prefers-reduced-motion: reduce)").matches;
renderer.setReducedMotion(reducedMotion.checked);
reducedMotion.onchange = () => renderer.setReducedMotion(reducedMotion.checked);
function setPaused(value: boolean, showOverlay = true) {
  paused = value;
  input.setEnabled(!paused && !benchmarking);
  element("pause-overlay").hidden = !value || !showOverlay;
  pauseButton.textContent = value ? "Resume · Esc" : "Pause · Esc";
  loop.accumulator = 0;
  last = performance.now();
  if (!value) canvas.focus();
}
window.addEventListener("keydown", (event) => {
  audio.unlock();
  if (event.code === "Escape" && !event.repeat && !benchmarking)
    setPaused(!paused);
});
canvas.addEventListener("pointerdown", () => audio.unlock());
pauseButton.onclick = () => {
  audio.unlock();
  setPaused(!paused);
};
soundButton.onclick = () => {
  audio.enabled = !audio.enabled;
  audio.unlock();
  soundButton.textContent = audio.enabled ? "Sound on" : "Sound off";
  soundButton.setAttribute("aria-pressed", String(audio.enabled));
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !benchmarking) setPaused(true);
});
specialButton.onclick = () => {
  audio.unlock();
  input.queueSpecial();
  canvas.focus();
};
async function runBenchmark(frames = 240) {
  if (benchmarking) return [];
  benchmarking = true;
  input.setEnabled(false);
  element<HTMLButtonElement>("bench").disabled = true;
  pauseButton.disabled = true;
  specialButton.disabled = true;
  try {
    return await benchmark.run(
      renderer,
      frames,
      (text) => (notice.textContent = text),
    );
  } finally {
    benchmarking = false;
    input.setEnabled(!paused);
    last = performance.now();
    element<HTMLButtonElement>("bench").disabled = false;
    pauseButton.disabled = false;
    notice.textContent = "Benchmarks complete · export JSON for details";
    if (!paused) canvas.focus();
  }
}
select.onchange = () => {
  const url = new URL(location.href);
  url.searchParams.set("backend", select.value);
  location.href = url.href;
};
element<HTMLButtonElement>("bench").onclick = () => void runBenchmark();
element<HTMLButtonElement>("export").onclick = () => benchmark.export();
function text(id: string, value: string) {
  const node = element(id);
  if (node.textContent !== value) node.textContent = value;
}
function updateHud() {
  const p = sim.player,
    alive = sim.enemies.enemies.filter((enemy) => enemy.state !== "dead");
  text("hp", p.hp + " / 100");
  element<HTMLMeterElement>("health").value = p.hp;
  text("chain", p.swing > 0 ? "0" + p.stage : "—");
  text("kills", String(p.kills));
  text("alive", alive.length + " / " + sim.enemies.enemies.length);
  text("renderer-label", renderer.backend);
  for (const kind of ["grunt", "flanker", "armored"])
    text(
      kind + "-count",
      String(alive.filter((enemy) => enemy.kind === kind).length),
    );
  text("charge", p.charge >= 100 ? "READY" : Math.floor(p.charge) + "%");
  element("charge-fill").style.width = p.charge + "%";
  specialButton.disabled =
    p.charge < 100 ||
    p.hp <= 0 ||
    p.specialTimer > 0 ||
    paused ||
    p.dashTimer > 0;
  specialButton.classList.toggle("ready", p.charge >= 100 && p.hp > 0);
  text(
    "special-hint",
    p.specialTimer > 0
      ? "A solar wave breaks the surrounding crowd."
      : p.charge >= 100
        ? "Press Q / B to break the surrounding crowd."
        : "Land hits to charge your radial strike.",
  );
  text(
    "dodge-hint",
    p.dashCooldown > 0
      ? "Shift / X · dodge recovering"
      : "Shift / X · dodge ready",
  );
  const callout = element("callout");
  text(
    "callout",
    p.specialTimer > 0
      ? "SOLAR BREAK"
      : p.charge >= 100
        ? "SPECIAL READY"
        : p.hp <= 0
          ? "YOU FELL"
          : "",
  );
  callout.classList.toggle(
    "visible",
    !!callout.textContent && element("pause-overlay").hidden,
  );
  canvas.classList.toggle("hit", p.hitFlash > 0);
  if (p.hp <= 0)
    notice.textContent = "You fell. Press R / gamepad Y to return.";
  else if (!benchmark.results.length)
    notice.textContent =
      "20 opponents · three enemy types · enemies return after 5 seconds";
}
function frame(now: number) {
  if (!benchmarking) {
    if (!paused)
      loop.advance((now - last) / 1000, () => sim.step(input.poll(1 / 60)));
    renderer.render(sim, input.yaw, input.pitch);
    audio.update(sim.player);
    if (now - lastHud >= 50) {
      updateHud();
      lastHud = now;
    }
  }
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
Object.assign(window, {
  musou: {
    sim,
    renderer,
    runBenchmark,
    reset: () => sim.reset(),
    pause: (value: boolean) => setPaused(value, false),
  },
});
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("./sw.js").catch(console.error);
