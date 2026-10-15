import "./style.css";
import { LANMenu } from "./network/LANMenu";
import { Simulation, GameLoop } from "./GameLoop";
import { InputManager } from "./InputManager";
import { BabylonRenderer } from "./BabylonRenderer";
import { BenchmarkRunner } from "./BenchmarkRunner";
import {
  WEAPONS,
  DEFAULT_WEAPON,
  getWeapon,
  weaponStats,
  type WeaponId,
} from "./Weapons";
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
    (lan.session || practice || run.state === "fighting")
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
    (lan.session || practice || run.state === "fighting")
  )
    setPaused(true);
});
specialButton.onclick = () => {
  audio.unlock();
  input.queueSpecial();
  canvas.focus();
};
async function runBenchmark(
  frames = 240,
  hero: Hero = sim.player.hero,
  weapon: WeaponId = hero === sim.player.hero
    ? getWeapon(sim.player).id
    : DEFAULT_WEAPON[hero],
  stressMultishot = false,
) {
  if (benchmarking || lan.session) return [];
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
      weapon,
      stressMultishot,
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
  element<HTMLButtonElement>("change-hero").disabled = !!lan.session;
  element<HTMLButtonElement>("bench").disabled = !!lan.session;
  const p = sim.player,
    alive = sim.enemies.enemies.filter((enemy) => enemy.state !== "dead");
  text("hp", p.hp + " / " + p.maxHp);
  element<HTMLMeterElement>("health").max = p.maxHp;
  element<HTMLMeterElement>("health").value = p.hp;
  text("weapon-stats", weaponSummary(p));
  text("chain-label", p.hero === "ranger" ? "SHOT" : "CHAIN");
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
    (!lan.session && !practice && run.state !== "fighting");
  if (lan.session) {
    text("objective", "LAN CO-OP · ENDLESS ARENA");
  } else if (!practice) {
    text(
      "objective",
      run.state === "select"
        ? "CHOOSE YOUR FIGHTER"
        : run.state === "loadout"
          ? "CHOOSE YOUR WEAPON"
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
  else if (lan.session)
    notice.textContent =
      "LAN co-op · R / Y revives a fallen fighter · host pause pauses the world";
  else if (!practice)
    notice.textContent =
      "Five waves · health carries over · choose a relic after each clear";
  else if (!benchmark.results.length)
    notice.textContent =
      "20 opponents · three enemy types · enemies return after 5 seconds";
}
const lan = new LANMenu(
  sim,
  () => {
    const { hero, weapon } = sim.player;
    sim.reset(20);
    Object.assign(sim.player, {
      hero,
      weapon,
      maxHp: hero === "ranger" ? 85 : 100,
      hp: hero === "ranger" ? 85 : 100,
    });
    sim.player.bombs = 1;
    sim.player.charge = 50;
    element("run-overlay").hidden = true;
    setPaused(false);
    input.setEnabled(true);
  },
  () => {
    sim.reset(20);
    run.state = "select";
    menuState = "";
    setPaused(false);
    updateRunMenu();
  },
);
function frame(now: number) {
  if (!benchmarking) {
    pollMenuGamepad();
    if (!paused && (lan.session || practice || run.state === "fighting"))
      loop.advance((now - last) / 1000, () => {
        const controls = input.poll(1 / 60);
        if (lan.session) lan.step(controls, 1 / 60);
        else if (practice) sim.step(controls);
        else if (controls.respawn) {
          run.start(sim.player.hero, getWeapon(sim.player).id);
        } else run.step(controls);
      });
    renderer.render(sim, input.yaw, input.pitch);
    audio.update(sim.player);
    if (now - lastHud >= 50) {
      updateHud();
      lan.refresh();
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
  if (lan.session) return;
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
  menuPadHeld = false,
  pendingHero: Hero = "vanguard",
  previousMenuBack = false;
function weaponSummary(player: typeof sim.player) {
  const s = weaponStats(player);
  return `${s.weapon.name} · ${s.rate.toFixed(2)} ${player.hero === "ranger" ? "volleys" : "swings"}/s · ${s.range.toFixed(1)}m · ${player.hero === "ranger" ? s.arrows + (s.arrows === 1 ? " arrow · " : " arrows · ") + (s.targetsPerArrow > 1 ? s.targetsPerArrow + " targets/arrow · " : "") : ""}~${Math.round(s.dps)} ideal DPS${s.arrows * s.targetsPerArrow > 1 ? " / " + Math.round(s.crowdDps) + " crowd" : ""}`;
}
function chooseHero(hero: Hero) {
  pendingHero = hero;
  run.state = "loadout";
  menuState = "";
  updateRunMenu();
}
function startHero(hero: Hero, weapon: WeaponId = DEFAULT_WEAPON[hero]) {
  run.start(hero, weapon);
  setPaused(false);
  menuState = "";
  updateRunMenu();
  canvas.focus();
}
function updateRunMenu() {
  if (practice || lan?.session) return;
  if (menuState === run.state) return;
  menuState = run.state;
  menuIndex = 0;
  element("seed-tools").hidden = run.state !== "select";
  element("back-to-heroes").hidden =
    run.state !== "loadout" && run.state !== "rearm";
  text(
    "back-to-heroes",
    run.state === "rearm"
      ? "Back to relics · Esc / B"
      : "Back to fighters · Esc / B",
  );
  element("rearm").hidden = run.state !== "upgrade";
  text(
    "menu-help",
    "1–3 select · Enter confirm · D-pad / stick + A · " +
      (run.state === "upgrade"
        ? "E / Y: change weapon"
        : run.state === "loadout" || run.state === "rearm"
          ? "Esc / B: back"
          : run.state === "select"
            ? "Y: new seed"
            : "Y: retry"),
  );
  text("run-seed", String(run.seed));
  const overlay = element("run-overlay"),
    choices = element("run-choices");
  overlay.hidden = run.state === "fighting";
  overlay.classList.toggle(
    "loadout",
    run.state === "loadout" || run.state === "rearm",
  );
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
      () => chooseHero("vanguard"),
    );
    add(
      "2 · Ranger",
      "85 health · Hold attack to fire and strafe; forward aim assist · Arrow Storm strikes a cluster ahead",
      () => chooseHero("ranger"),
    );
  } else if (run.state === "loadout" || run.state === "rearm") {
    text(
      "run-title",
      `${pendingHero === "ranger" ? "Ranger" : "Vanguard"} · Choose your weapon`,
    );
    text(
      "run-description",
      "Choose a weapon; change it between waves while keeping relics. Ideal DPS assumes continuous unarmored hits; crowd DPS needs separate targets. Specials stay the same.",
    );
    Object.values(WEAPONS)
      .filter((w) => w.hero === pendingHero)
      .forEach((w, i) => {
        const preview = {
          ...sim.player,
          hero: pendingHero,
          weapon: w.id,
          damageMult: run.state === "rearm" ? sim.player.damageMult : 1,
          attackSpeedMult:
            run.state === "rearm" ? sim.player.attackSpeedMult : 1,
          rangeMult: run.state === "rearm" ? sim.player.rangeMult : 1,
          extraArrows: run.state === "rearm" ? sim.player.extraArrows : 0,
          pierce: run.state === "rearm" ? sim.player.pierce : 0,
        };
        const s = weaponStats(preview);
        add(
          `${i + 1} · ${w.name}`,
          `${w.description}. ${pendingHero === "ranger" ? s.damage + " damage / arrow" : s.damage + " / " + s.damage + " / " + s.finisher + " combo damage"}. ${weaponSummary(preview).replace(w.name + " · ", "")}${pendingHero === "vanguard" ? " · " + Math.round((w.halfArc * 360) / Math.PI) + "° arc" : ""}`,
          () => {
            if (run.state === "rearm") {
              run.equip(w.id);
              menuState = "";
              updateRunMenu();
            } else startHero(pendingHero, w.id);
          },
        );
      });
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
      startHero(sim.player.hero, getWeapon(sim.player).id),
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
  if (lan.session || practice || run.state === "fighting" || benchmarking)
    return;
  if (e.code === "KeyE" && run.state === "upgrade") {
    openRearm();
    return;
  }
  if (
    e.code === "Escape" &&
    (run.state === "loadout" || run.state === "rearm")
  ) {
    run.state = run.state === "rearm" ? "upgrade" : "select";
    menuState = "";
    updateRunMenu();
    return;
  }
  if (
    e.code === "KeyR" &&
    !e.repeat &&
    (run.state === "defeat" || run.state === "victory")
  ) {
    startHero(sim.player.hero, getWeapon(sim.player).id);
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
  const back = pad?.buttons[1]?.pressed ?? false;
  if (
    back &&
    !previousMenuBack &&
    (run.state === "loadout" || run.state === "rearm")
  ) {
    run.state = run.state === "rearm" ? "upgrade" : "select";
    menuState = "";
    updateRunMenu();
  }
  previousMenuBack = back;
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
    !lan.session &&
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
    else if (y && run.state === "upgrade") openRearm();
    else if (y && (run.state === "defeat" || run.state === "victory"))
      activateMenu(0);
    else if (direction) {
      menuIndex = (menuIndex + direction + buttons.length) % buttons.length;
      (buttons[menuIndex] as HTMLButtonElement | undefined)?.focus();
    } else if (a) activateMenu(menuIndex);
  }
  menuPadHeld = held;
}
function openRearm() {
  pendingHero = sim.player.hero;
  run.state = "rearm";
  menuState = "";
  updateRunMenu();
}
element<HTMLButtonElement>("rearm").onclick = () => openRearm();
element<HTMLButtonElement>("back-to-heroes").onclick = () => {
  run.state = run.state === "rearm" ? "upgrade" : "select";
  menuState = "";
  updateRunMenu();
};
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
    lan,
    renderer,
    runBenchmark,
    run,
    reset: () => sim.reset(),
    pause: (value: boolean) => setPaused(value, false),
  },
});
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("./sw.js").catch(console.error);
