import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import { ENEMY_TYPES, type EnemyKind } from "./EnemyStore";
import { SPECIAL } from "./CombatSystem";
import type { Renderer } from "./Renderer";
import type { Simulation } from "./GameLoop";
interface EnemyVisual {
  body: Mesh;
  warning: Mesh;
  health: Mesh;
  fill: Mesh;
  kind: EnemyKind;
}
export class BabylonRenderer implements Renderer {
  backend: string;
  private scene: Scene;
  private instrumentation: SceneInstrumentation;
  private camera: FreeCamera;
  private player: TransformNode;
  private blade: Mesh;
  private bow: Mesh;
  private arrows: Mesh[] = [];
  private loot: Mesh[] = [];
  private lootMaterials: Record<string, StandardMaterial> = {};
  private bombWave: Mesh;
  private aimRing: Mesh;
  private cape: Mesh;
  private slash: Mesh;
  private sigil: Mesh;
  private waves: Mesh[] = [];
  private sparks: Mesh[] = [];
  private core: Mesh;
  private enemies: EnemyVisual[] = [];
  private templates: Record<EnemyKind, Mesh>;
  private materials: Record<EnemyKind, StandardMaterial>;
  private warning: StandardMaterial;
  private hurt: StandardMaterial;
  private dead: StandardMaterial;
  private gold: StandardMaterial;
  private cyan: StandardMaterial;
  private waveMaterial: StandardMaterial;
  private sparkMaterial: StandardMaterial;
  private cameraTarget = Vector3.Zero();
  private lastSim?: Simulation;
  private lastTick = 0;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  static async create(canvas: HTMLCanvasElement, preference: string) {
    let engine: Engine | WebGPUEngine | undefined;
    let backend = "WebGL2";
    try {
      if (preference !== "webgl" && (await WebGPUEngine.IsSupportedAsync)) {
        const gpu = new WebGPUEngine(canvas, { antialias: true });
        await gpu.initAsync();
        engine = gpu;
        backend = "WebGPU";
      }
    } catch (error) {
      console.warn("WebGPU initialization failed; selecting WebGL", error);
    }
    engine ??= new Engine(canvas, true);
    return new BabylonRenderer(engine, backend);
  }
  private material(name: string, color: string, emissive = false, alpha = 1) {
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = Color3.FromHexString(color);
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    if (emissive) {
      m.emissiveColor = m.diffuseColor;
      m.disableLighting = true;
    }
    m.alpha = alpha;
    m.backFaceCulling = false;
    return m;
  }
  // A small triangle fan draws the same forward cone used by combat; no custom shaders.
  private sector(name: string, radius: number, halfAngle: number) {
    const mesh = new Mesh(name, this.scene),
      positions = [0, 0, 0],
      indices: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = -halfAngle + (i / 24) * halfAngle * 2;
      positions.push(Math.sin(a) * radius, 0, Math.cos(a) * radius);
      if (i > 0) indices.push(0, i + 1, i);
    }
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = Array.from({ length: positions.length }, (_, i) =>
      i % 3 === 1 ? 1 : 0,
    );
    data.applyToMesh(mesh);
    return mesh;
  }
  private ring(
    name: string,
    outerRadius: number,
    width: number,
    segments = 64,
  ) {
    const mesh = new Mesh(name, this.scene);
    const positions: number[] = [],
      indices: number[] = [],
      normals: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      for (const radius of [outerRadius, Math.max(0, outerRadius - width)]) {
        positions.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        normals.push(0, 1, 0);
      }
      if (i < segments) {
        const v = i * 2;
        indices.push(v, v + 2, v + 1, v + 2, v + 3, v + 1);
      }
    }
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.applyToMesh(mesh);
    return mesh;
  }
  private enemyTemplate(kind: EnemyKind) {
    const heavy = kind === "armored",
      light = kind === "flanker",
      parts: Mesh[] = [];
    const body = heavy
      ? MeshBuilder.CreateBox(
          kind,
          { width: 0.9, height: 1.35, depth: 0.65 },
          this.scene,
        )
      : MeshBuilder.CreateCylinder(
          kind,
          {
            diameterTop: light ? 0.32 : 0.48,
            diameterBottom: light ? 0.48 : 0.68,
            height: light ? 1.15 : 1.35,
            tessellation: 6,
          },
          this.scene,
        );
    body.position.y = 0.8;
    parts.push(body);
    const head = MeshBuilder.CreateSphere(
      kind + " head",
      { diameter: heavy ? 0.55 : light ? 0.38 : 0.45, segments: 4 },
      this.scene,
    );
    head.position.y = heavy ? 1.7 : light ? 1.5 : 1.6;
    parts.push(head);
    const shoulders = MeshBuilder.CreateBox(
      kind + " shoulders",
      {
        width: heavy ? 1.4 : light ? 0.7 : 0.95,
        height: heavy ? 0.35 : 0.2,
        depth: 0.45,
      },
      this.scene,
    );
    shoulders.position.y = 1.2;
    parts.push(shoulders);
    if (heavy) {
      const shield = MeshBuilder.CreateBox(
        "shield",
        { width: 0.55, height: 0.95, depth: 0.15 },
        this.scene,
      );
      shield.position.set(0.65, 0.85, 0.25);
      parts.push(shield);
    } else if (light) {
      const crest = MeshBuilder.CreateCylinder(
        "crest",
        { diameterTop: 0, diameterBottom: 0.35, height: 0.4, tessellation: 4 },
        this.scene,
      );
      crest.position.set(0, 1.85, 0);
      parts.push(crest);
    }
    const weapon = MeshBuilder.CreateBox(
      "enemy weapon",
      { width: 0.08, height: 0.08, depth: heavy ? 1.2 : 0.7 },
      this.scene,
    );
    weapon.position.set(-0.5, 0.9, 0.45);
    parts.push(weapon);
    const merged = Mesh.MergeMeshes(parts, true)!;
    merged.name = kind + " template";
    merged.isVisible = false;
    return merged;
  }
  private constructor(
    private engine: Engine | WebGPUEngine,
    backend: string,
  ) {
    this.backend =
      backend === "WebGL2" &&
      engine instanceof Engine &&
      engine.webGLVersion < 2
        ? "WebGL1 (compatibility)"
        : backend;
    this.scene = new Scene(engine);
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.scene.clearColor = new Color4(0.035, 0.065, 0.085, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.009;
    this.scene.fogColor = new Color3(0.035, 0.065, 0.085);
    this.camera = new FreeCamera("camera", new Vector3(0, 9, -12), this.scene);
    this.camera.minZ = 0.1;
    this.camera.fov = 0.82;
    const sky = new HemisphericLight("sky", new Vector3(0, 1, 0), this.scene);
    sky.intensity = 0.85;
    sky.groundColor = new Color3(0.15, 0.22, 0.27);
    const sun = new DirectionalLight(
      "sun",
      new Vector3(-0.5, -1, 0.5),
      this.scene,
    );
    sun.intensity = 1.1;
    sun.diffuse = new Color3(1, 0.88, 0.68);
    const ground = MeshBuilder.CreateGround(
      "field",
      { width: 56, height: 56 },
      this.scene,
    );
    ground.material = this.material("soil", "#1b292e");
    const courtyard = MeshBuilder.CreateDisc(
      "courtyard",
      { radius: 23, tessellation: 64 },
      this.scene,
    );
    courtyard.rotation.x = Math.PI / 2;
    courtyard.position.y = 0.008;
    courtyard.material = this.material("courtyard stone", "#32444a");
    const inlay = this.material("inlay", "#617571");
    for (const radius of [7, 14, 22.5]) {
      const circle = this.ring("courtyard inlay", radius, 0.035);
      circle.position.y = 0.018;
      circle.material = inlay;
    }
    const stone = this.material("stone", "#4d5c60"),
      banner = this.material("banners", "#9e4646");
    for (let i = 0; i < 20; i++) {
      const a = (i * Math.PI * 2) / 20;
      const pillar = MeshBuilder.CreateCylinder(
        "boundary pillar",
        {
          diameterTop: 0.9,
          diameterBottom: 1.3,
          height: 2.2 + (i % 3) * 0.25,
          tessellation: 6,
        },
        this.scene,
      );
      pillar.position.set(Math.sin(a) * 25, 1.1, Math.cos(a) * 25);
      pillar.material = stone;
      if (i % 5 === 0) {
        const flag = MeshBuilder.CreateBox(
          "banner",
          { width: 1.25, height: 1.8, depth: 0.08 },
          this.scene,
        );
        flag.position.set(Math.sin(a) * 24.5, 2.5, Math.cos(a) * 24.5);
        flag.rotation.y = a;
        flag.material = banner;
      }
    }
    for (let i = -3; i <= 3; i++) {
      const line = MeshBuilder.CreateBox(
        "tile seam",
        { width: 43, height: 0.008, depth: 0.025 },
        this.scene,
      );
      line.position.set(0, 0.018, i * 6);
      line.material = inlay;
    }
    this.gold = this.material("solar gold", "#ffd47a", true);
    this.cyan = this.material("strike light", "#a8fff1", true, 0.48);
    this.waveMaterial = this.material("solar wave", "#ffe3a0", true, 0.8);
    this.sparkMaterial = this.material("solar sparks", "#fff3c0", true);
    this.player = new TransformNode("hero", this.scene);
    const armor = this.material("hero armor", "#efc477");
    const torso = MeshBuilder.CreateCylinder(
      "hero torso",
      { diameterTop: 0.55, diameterBottom: 0.8, height: 1.25, tessellation: 6 },
      this.scene,
    );
    torso.position.y = 0.85;
    torso.parent = this.player;
    torso.material = armor;
    const head = MeshBuilder.CreateSphere(
      "hero head",
      { diameter: 0.48, segments: 4 },
      this.scene,
    );
    head.position.y = 1.65;
    head.parent = this.player;
    head.material = armor;
    const shoulders = MeshBuilder.CreateBox(
      "hero shoulders",
      { width: 1, height: 0.22, depth: 0.4 },
      this.scene,
    );
    shoulders.position.y = 1.23;
    shoulders.parent = this.player;
    shoulders.material = armor;
    this.blade = MeshBuilder.CreateBox(
      "blade",
      { width: 0.12, height: 0.12, depth: 1.9 },
      this.scene,
    );
    this.blade.parent = this.player;
    this.blade.position.set(0.65, 1, 0.9);
    this.blade.material = this.material("blade steel", "#c8fff8", true);
    this.bow = MeshBuilder.CreateTube(
      "ranger bow",
      {
        path: [
          new Vector3(0, 0.75, -0.2),
          new Vector3(0.25, 0.45, 0),
          new Vector3(0.4, 0, 0.1),
          new Vector3(0.25, -0.45, 0),
          new Vector3(0, -0.75, -0.2),
        ],
        radius: 0.045,
        tessellation: 4,
      },
      this.scene,
    );
    this.bow.parent = this.player;
    this.bow.position.set(0.6, 1, 0.65);
    this.bow.material = this.cyan;
    this.bombWave = this.ring("bomb blast", 1, 0.09);
    this.bombWave.material = this.material("bomb amber", "#ff8959", true, 0.8);
    this.bombWave.setEnabled(false);
    this.aimRing = this.ring("arrow storm target", 4.5, 0.025);
    this.aimRing.material = this.material(
      "storm target cyan",
      "#74e4f3",
      true,
      0.4,
    );
    this.aimRing.setEnabled(false);
    for (const [kind, color] of Object.entries({
      health: "#7ef0a1",
      charge: "#78c9ff",
      power: "#ffdb80",
      bomb: "#ff8959",
    }))
      this.lootMaterials[kind] = this.material("loot " + kind, color, true);
    this.cape = MeshBuilder.CreateBox(
      "hero cape",
      { width: 0.75, height: 1.05, depth: 0.08 },
      this.scene,
    );
    this.cape.parent = this.player;
    this.cape.position.set(0, 0.8, -0.35);
    this.cape.material = banner;
    this.slash = this.sector("melee arc", 2.8, Math.PI * 0.42);
    this.slash.parent = this.player;
    this.slash.position.y = 0.65;
    this.slash.material = this.cyan;
    this.sigil = this.ring("hero sigil", 0.65, 0.035, 32);
    this.sigil.parent = this.player;
    this.sigil.position.y = 0.025;
    this.sigil.material = this.gold;
    this.warning = this.material("enemy warning", "#ff8766", true, 0.27);
    this.hurt = this.material("hit flash", "#fff1d1", true);
    this.dead = this.material("fallen enemy", "#494e56");
    this.materials = {
      grunt: this.material("grunt", ENEMY_TYPES.grunt.color),
      flanker: this.material("flanker", ENEMY_TYPES.flanker.color),
      armored: this.material("armored", ENEMY_TYPES.armored.color),
    };
    this.templates = {
      grunt: this.enemyTemplate("grunt"),
      flanker: this.enemyTemplate("flanker"),
      armored: this.enemyTemplate("armored"),
    };
    for (let i = 0; i < 2; i++) {
      const wave = this.ring("solar shockwave " + i, 1, i === 0 ? 0.09 : 0.045);
      wave.material = this.waveMaterial;
      wave.setEnabled(false);
      this.waves.push(wave);
    }
    this.core = MeshBuilder.CreateSphere(
      "solar core",
      { diameter: 1, segments: 8 },
      this.scene,
    );
    this.core.material = this.material(
      "solar core light",
      "#ffe5a4",
      true,
      0.3,
    );
    this.core.setEnabled(false);
    const sparkBase = MeshBuilder.CreateSphere(
      "spark 0",
      { diameter: 0.12, segments: 3 },
      this.scene,
    );
    sparkBase.material = this.sparkMaterial;
    sparkBase.setEnabled(false);
    this.sparks.push(sparkBase);
    for (let i = 1; i < 32; i++) {
      const spark = sparkBase.clone("spark " + i)!;
      spark.setEnabled(false);
      this.sparks.push(spark);
    }
    window.addEventListener("resize", () => engine.resize());
    engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
  }
  setReducedMotion(value: boolean) {
    this.reducedMotion = value;
  }
  private addEnemy(kind: EnemyKind, index: number) {
    const body = this.templates[kind].clone("enemy " + index)!;
    body.isVisible = true;
    const warning = this.sector(
      "attack telegraph " + index,
      ENEMY_TYPES[kind].range,
      0.8,
    );
    warning.parent = body;
    warning.position.y = 0.025;
    warning.material = this.warning;
    const health = MeshBuilder.CreatePlane(
      "health track " + index,
      { width: 0.95, height: 0.085 },
      this.scene,
    );
    health.parent = body;
    health.position.y = kind === "flanker" ? 2.2 : 2.15;
    health.billboardMode = Mesh.BILLBOARDMODE_ALL;
    health.material = this.dead;
    const fill = MeshBuilder.CreatePlane(
      "health fill " + index,
      { width: 0.9, height: 0.045 },
      this.scene,
    );
    fill.parent = health;
    fill.position.z = -0.01;
    fill.material = this.materials[kind];
    this.enemies.push({ body, warning, health, fill, kind });
  }
  render(sim: Simulation, yaw: number, pitch: number, fixed = false) {
    const p = sim.player,
      time = sim.ticks / 60;
    while (this.enemies.length < sim.enemies.enemies.length)
      this.addEnemy(
        sim.enemies.enemies[this.enemies.length]!.kind,
        this.enemies.length,
      );
    this.player.position.set(
      p.x,
      p.specialTimer > 0 && !this.reducedMotion
        ? Math.sin(
            ((SPECIAL.duration - p.specialTimer) / SPECIAL.duration) * Math.PI,
          ) * 0.35
        : 0,
      p.z,
    );
    this.player.rotation.y =
      p.yaw +
      (p.specialTimer > 0 && p.hero !== "ranger" && !this.reducedMotion
        ? (SPECIAL.duration - p.specialTimer) * 15
        : 0);
    this.player.rotation.z = p.hp <= 0 ? 1.2 : p.dashTimer > 0 ? -0.12 : 0;
    this.cape.rotation.x =
      -0.15 - Math.sin(time * 6) * 0.05 - (p.dashTimer > 0 ? 0.6 : 0);
    this.blade.rotation.y =
      p.swing > 0
        ? (1 - p.swing / 0.38) * 4 - 1.5
        : p.specialTimer > 0
          ? -1.2
          : 0;
    this.blade.scaling.z = p.swing > 0 ? 1.3 : 1;
    this.blade.setEnabled(p.hero !== "ranger");
    this.bow.setEnabled(p.hero === "ranger");
    this.slash.setEnabled(
      p.hero !== "ranger" && p.swing > 0.1 && p.swing < 0.29,
    );
    this.bow.rotation.y = p.swing > 0 ? -0.25 : 0;
    while (this.arrows.length < sim.combat.arrows.length) {
      const arrow = MeshBuilder.CreateBox(
        "arrow",
        { width: 0.065, height: 0.065, depth: 0.95 },
        this.scene,
      );
      arrow.material = this.cyan;
      this.arrows.push(arrow);
    }
    this.arrows.forEach((mesh, i) => {
      const a = sim.combat.arrows[i];
      mesh.setEnabled(!!a);
      if (a) {
        mesh.position.set(a.x, 1.05, a.z);
        mesh.rotation.y = Math.atan2(a.vx, a.vz);
      }
    });
    while (this.loot.length < sim.pickups.length) {
      const mesh = MeshBuilder.CreateCylinder(
        "field drop",
        { diameterTop: 0, diameterBottom: 0.55, height: 0.8, tessellation: 4 },
        this.scene,
      );
      this.loot.push(mesh);
    }
    this.loot.forEach((mesh, i) => {
      const item = sim.pickups[i];
      mesh.setEnabled(!!item);
      if (item) {
        mesh.position.set(
          item.x,
          0.55 + (this.reducedMotion ? 0 : Math.sin(time * 3 + item.id) * 0.1),
          item.z,
        );
        mesh.material = this.lootMaterials[item.kind]!;
        mesh.rotation.z = item.kind === "health" ? Math.PI : 0;
      }
    });
    this.bombWave.setEnabled(p.bombTimer > 0);
    this.bombWave.position.set(p.bombX, 0.18, p.bombZ);
    this.bombWave.scaling.setAll(Math.min(8, 0.5 + (0.6 - p.bombTimer) * 24));
    this.aimRing.setEnabled(
      p.hero === "ranger" && p.charge >= 100 && p.hp > 0 && p.specialTimer <= 0,
    );
    if (p.hero === "ranger") {
      const target = sim.combat.aim(p, sim.grid);
      this.aimRing.position.set(
        Math.max(-23, Math.min(23, target?.x ?? p.x + Math.sin(p.yaw) * 8)),
        0.06,
        Math.max(-23, Math.min(23, target?.z ?? p.z + Math.cos(p.yaw) * 8)),
      );
    }
    this.slash.material = p.stage === 3 ? this.gold : this.cyan;
    this.sigil.scaling.setAll(p.charge >= 100 ? 1.08 : 1);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = sim.enemies.enemies[i],
        visual = this.enemies[i]!;
      const falling = !!e && e.state === "dead" && e.timer > 4.65;
      visual.body.setEnabled(!!e && (e.state !== "dead" || falling));
      if (!e) continue;
      visual.body.position.set(e.x, 0, e.z);
      visual.body.rotation.y =
        e.state === "windup" || e.state === "attack"
          ? e.attackYaw
          : Math.atan2(p.x - e.x, p.z - e.z);
      visual.body.rotation.z = falling
        ? (5 - e.timer) * 4
        : e.state === "stagger"
          ? -0.12
          : 0;
      visual.body.material =
        e.flash > 0
          ? this.hurt
          : e.state === "dead"
            ? this.dead
            : this.materials[e.kind];
      visual.warning.setEnabled(e.state === "windup");
      visual.health.setEnabled(e.hp < e.maxHp && e.hp > 0);
      const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
      visual.fill.scaling.x = ratio;
      visual.fill.position.x = (ratio - 1) * 0.45;
    }
    const elapsed = SPECIAL.duration - p.specialTimer,
      active = p.specialTimer > 0;
    const burst = Math.max(0, elapsed - SPECIAL.impactAt),
      progress = Math.min(1, burst / 0.6);
    this.waveMaterial.emissiveColor = Color3.FromHexString(
      p.hero === "ranger" ? "#74e4f3" : "#ffe3a0",
    );
    this.sparkMaterial.emissiveColor = Color3.FromHexString(
      p.hero === "ranger" ? "#a0f2ff" : "#fff3c0",
    );
    this.waveMaterial.alpha = 0.85 * (1 - progress);
    this.sparkMaterial.alpha = 1 - progress;
    for (let i = 0; i < this.waves.length; i++) {
      const wave = this.waves[i]!;
      wave.setEnabled(active);
      const radius =
        elapsed < SPECIAL.impactAt
          ? 0.8 + elapsed * 2
          : Math.min(
              SPECIAL.radius,
              Math.max(0.2, ((burst - i * 0.06) / 0.24) * SPECIAL.radius),
            );
      wave.position.set(p.specialX, 0.12 + i * 0.3, p.specialZ);
      const r = p.hero === "ranger" ? 4.5 : radius;
      wave.scaling.set(r, 1, r);
    }
    this.core.setEnabled(active && p.hero !== "ranger" && burst < 0.25);
    this.core.position.set(p.specialX, 1, p.specialZ);
    this.core.scaling.setAll(
      elapsed < SPECIAL.impactAt ? 0.8 + elapsed * 4 : 2.4 * (1 - burst / 0.25),
    );
    for (let i = 0; i < this.sparks.length; i++) {
      const spark = this.sparks[i]!;
      spark.setEnabled(
        active && burst > 0 && progress < 1 && (!this.reducedMotion || i < 8),
      );
      const a = i * 2.39996,
        radius =
          p.hero === "ranger"
            ? 0.5 + (i % 6) * 0.65
            : 0.6 + progress * (4 + (i % 5));
      spark.position.set(
        p.specialX + Math.sin(a) * radius,
        p.hero === "ranger"
          ? 0.2 + ((1 - progress + (i % 4) * 0.12) % 1) * 8
          : 0.5 + Math.sin(progress * Math.PI) * (1 + (i % 4) * 0.3),
        p.specialZ + Math.cos(a) * radius,
      );
      spark.scaling.set(
        1 - progress * 0.6,
        p.hero === "ranger" ? 6 : 1 + (i % 3),
        1 - progress * 0.6,
      );
    }
    const target = new Vector3(fixed ? 0 : p.x, 0, fixed ? 0 : p.z);
    if (fixed || this.lastSim !== sim || sim.ticks < this.lastTick)
      this.cameraTarget.copyFrom(target);
    else
      Vector3.LerpToRef(
        this.cameraTarget,
        target,
        1 - Math.pow(0.78, Math.max(0, sim.ticks - this.lastTick)),
        this.cameraTarget,
      );
    const pulse =
      fixed || this.reducedMotion
        ? 0
        : p.specialTimer > 0
          ? Math.sin((Math.min(1, burst / 0.12) * Math.PI) / 2) * (1 - progress)
          : p.impact * 0.35;
    const distance = fixed ? 30 : 11.5 + pulse;
    this.camera.position.set(
      this.cameraTarget.x - Math.sin(yaw) * distance,
      Math.sin(pitch) * distance + 2.8,
      this.cameraTarget.z - Math.cos(yaw) * distance,
    );
    this.camera.fov = 0.82 + pulse * 0.025;
    this.camera.setTarget(this.cameraTarget.add(new Vector3(0, 1, 0)));
    this.lastSim = sim;
    this.lastTick = sim.ticks;
    this.engine.beginFrame();
    this.scene.render();
    this.engine.endFrame();
  }
  drawCalls() {
    return this.instrumentation.drawCallsCounter.current;
  }
  metadata() {
    return {
      width: this.engine.getRenderWidth(),
      height: this.engine.getRenderHeight(),
      engineVersion: Engine.Version,
      renderer: this.engine.getInfo(),
      hardwareScaling: this.engine.getHardwareScalingLevel(),
      reducedMotion: this.reducedMotion,
      ringGeometry: "flat-strip-64-segments",
      specialSparkPool: 32,
    };
  }
  dispose() {
    this.instrumentation.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
