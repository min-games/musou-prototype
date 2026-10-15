import "./style.css";
import { Simulation, GameLoop } from "./GameLoop";
import { InputManager } from "./InputManager";
import { BabylonRenderer } from "./BabylonRenderer";
import { BenchmarkRunner } from "./BenchmarkRunner";
import { RunDirector } from "./RunDirector";
import type { Hero } from "./CombatSystem";
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
const practice = new URLSearchParams(location.search).has("practice");
const seedText = new URLSearchParams(location.search).get("seed") ?? "4242";
const seed =
  /^\d{1,10}$/.test(seedText) && Number(seedText) <= 0xffffffff
    ? Number(seedText)
    : 4242;
const run = new RunDirector(sim, seed);
document.body.classList.toggle("practice", practice);
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
  if (
    event.code === "Escape" &&
    !event.repeat &&
    !benchmarking &&
    (practice || run.state === "fighting")
  )
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
  if (
    document.hidden &&
    !benchmarking &&
    (practice || run.state === "fighting")
  )
    setPaused(true);
});
specialButton.onclick = () => {
  audio.unlock();
  input.queueSpecial();
  canvas.focus();
};
async function runBenchmark(frames = 240, hero: Hero = sim.player.hero) {
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
      hero,
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
  text("hp", p.hp + " / " + p.maxHp);
  element<HTMLMeterElement>("health").max = p.maxHp;
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
  const specialName = p.hero === "ranger" ? "ARROW STORM" : "SOLAR BREAK";
  text("special-name", "Q / B · " + specialName);
  specialButton.setAttribute(
    "aria-label",
    specialName + ": charge by hitting enemies",
  );
  text("bomb-count", String(p.bombs));
  element<HTMLButtonElement>("bomb").disabled =
    p.bombs === 0 ||
    p.hp <= 0 ||
    paused ||
    (!practice && run.state !== "fighting");
  if (!practice) {
    text(
      "objective",
      run.state === "select"
        ? "CHOOSE YOUR FIGHTER"
        : `WAVE ${run.wave} / 5 · ${alive.length} REMAINING`,
    );
    text(
      "build-summary",
      `${p.hero === "ranger" ? "Ranger" : "Vanguard"} · Damage ×${p.damageMult.toFixed(2)} · ${run.build.join(" / ") || "No relics yet"}`,
    );
    text("loot-message", run.message);
    updateRunMenu();
  } else text("objective", "ENDLESS PRACTICE · RESPAWNING");
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
      ? p.hero === "ranger"
        ? "Arrows rain on the marked area ahead."
        : "A solar wave breaks the surrounding crowd."
      : p.charge >= 100
        ? p.hero === "ranger"
          ? "Q / B · strike the marked cluster ahead (4.5m)."
          : "Q / B · break the surrounding crowd (6.5m)."
        : p.hero === "ranger"
          ? "Hold J / A to fire and strafe. Face targets for aim assist."
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
      ? specialName
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
  else if (!practice)
    notice.textContent =
      "Five waves · health carries over · choose a relic after each clear";
  else if (!benchmark.results.length)
    notice.textContent =
      "20 opponents · three enemy types · enemies return after 5 seconds";
}
function frame(now: number) {
  if (!benchmarking) {
    pollMenuGamepad();
    if (!paused && (practice || run.state === "fighting"))
      loop.advance((now - last) / 1000, () => {
        const controls = input.poll(1 / 60);
        if (practice) sim.step(controls);
        else if (controls.respawn) {
          run.start(sim.player.hero);
        } else run.step(controls);
      });
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
element<HTMLButtonElement>("bomb").onclick = () => {
  input.queueBomb();
  canvas.focus();
};
element<HTMLButtonElement>("change-hero").onclick = () => {
  if (practice) {
    location.href = "?";
    return;
  }
  run.state = "select";
  setPaused(false);
  menuState = "";
  updateRunMenu();
};
let menuState = "",
  menuIndex = 0,
  menuPadHeld = false;
function startHero(hero: Hero) {
  run.start(hero);
  setPaused(false);
  menuState = "";
  updateRunMenu();
  canvas.focus();
}
function updateRunMenu() {
  if (practice) return;
  if (menuState === run.state) return;
  menuState = run.state;
  menuIndex = 0;
  element("seed-tools").hidden = run.state !== "select";
  text("run-seed", String(run.seed));
  const overlay = element("run-overlay"),
    choices = element("run-choices");
  overlay.hidden = run.state === "fighting";
  choices.replaceChildren();
  if (overlay.hidden) {
    input.setEnabled(!paused);
    canvas.focus();
    return;
  }
  input.setEnabled(false);
  loop.accumulator = 0;
  const add = (title: string, detail: string, action: () => void) => {
    const button = document.createElement("button");
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = detail;
    button.append(strong, span);
    button.onclick = () => {
      audio.unlock();
      action();
    };
    choices.append(button);
  };
  if (run.state === "select") {
    text("run-title", "Choose your fighter");
    text(
      "run-description",
      "Survive five finite waves. Walk over glowing drops to grow stronger. Pick one relic after each wave. Start with one bomb and half a special charge.",
    );
    add(
      "1 · Vanguard",
      "100 health · Three-hit blade combo · Solar Break clears a circle around you",
      () => startHero("vanguard"),
    );
    add(
      "2 · Ranger",
      "85 health · Hold attack to fire and strafe; forward aim assist · Arrow Storm strikes a cluster ahead",
      () => startHero("ranger"),
    );
  } else if (run.state === "upgrade") {
    text("run-title", `Wave ${run.wave} cleared · choose a relic`);
    text(
      "run-description",
      "The field is safe. Remaining drops collected. Your choice lasts this run; gain 20 health before the next wave.",
    );
    run.choices.forEach((u, i) =>
      add(`${i + 1} · ${u.name}`, u.description, () => {
        run.choose(i);
        menuState = "";
        updateRunMenu();
      }),
    );
  } else {
    text(
      "run-title",
      run.state === "victory" ? "FIELD CLEARED" : "You fell. Try a new build.",
    );
    text(
      "run-description",
      `Wave ${run.wave} / 5 · ${sim.player.kills} defeated · ${run.build.join(" / ") || "No relics"}. Same seed on retry; every run starts fresh.`,
    );
    add("1 · Retry this fighter", "Reset health, items and relics", () =>
      startHero(sim.player.hero),
    );
    add("2 · Choose another fighter", "Try a different combat style", () => {
      run.state = "select";
      menuState = "";
      updateRunMenu();
    });
  }
  (choices.querySelector("button") as HTMLButtonElement | null)?.focus();
}
element("run-overlay").addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const focusable = Array.from(
    element("run-overlay").querySelectorAll<HTMLElement>("button,a[href]"),
  ).filter((n) => !n.closest("[hidden]"));
  const first = focusable[0],
    last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
});
function activateMenu(index: number) {
  (
    element("run-choices").querySelectorAll("button")[index] as
      HTMLButtonElement | undefined
  )?.click();
}
window.addEventListener("keydown", (e) => {
  if (practice || run.state === "fighting" || benchmarking) return;
  if (
    e.code === "KeyR" &&
    !e.repeat &&
    (run.state === "defeat" || run.state === "victory")
  ) {
    startHero(sim.player.hero);
    return;
  }
  if (["Digit1", "Digit2", "Digit3"].includes(e.code) && !e.repeat) {
    e.preventDefault();
    activateMenu(Number(e.code.slice(-1)) - 1);
  }
});
function pollMenuGamepad() {
  const pad = Array.from(navigator.getGamepads?.() ?? []).find(
    (p) => p?.connected,
  );
  const a = pad?.buttons[0]?.pressed ?? false;
  const direction =
    pad?.buttons[13]?.pressed || (pad?.axes[1] ?? 0) > 0.6
      ? 1
      : pad?.buttons[12]?.pressed || (pad?.axes[1] ?? 0) < -0.6
        ? -1
        : 0;
  const y = pad?.buttons[3]?.pressed ?? false;
  const held = a || y || direction !== 0;
  if (
    !practice &&
    run.state !== "fighting" &&
    !benchmarking &&
    !paused &&
    held &&
    !menuPadHeld
  ) {
    const buttons = element("run-choices").querySelectorAll("button");
    if (y && run.state === "select")
      element<HTMLButtonElement>("shuffle-seed").click();
    else if (y && (run.state === "defeat" || run.state === "victory"))
      activateMenu(0);
    else if (direction) {
      menuIndex = (menuIndex + direction + buttons.length) % buttons.length;
      (buttons[menuIndex] as HTMLButtonElement | undefined)?.focus();
    } else if (a) activateMenu(menuIndex);
  }
  menuPadHeld = held;
}
element<HTMLButtonElement>("shuffle-seed").onclick = () => {
  run.seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
  const url = new URL(location.href);
  url.searchParams.set("seed", String(run.seed));
  history.replaceState(null, "", url);
  text("run-seed", String(run.seed));
};
updateRunMenu();
requestAnimationFrame(frame);
Object.assign(window, {
  musou: {
    sim,
    renderer,
    runBenchmark,
    run,
    reset: () => sim.reset(),
    pause: (value: boolean) => setPaused(value, false),
  },
});
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("./sw.js").catch(console.error);
