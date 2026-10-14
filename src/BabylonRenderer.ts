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
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import type { Renderer } from "./Renderer";
import type { Simulation } from "./GameLoop";
export class BabylonRenderer implements Renderer {
  backend: string;
  private scene: Scene;
  private instrumentation: SceneInstrumentation;
  private camera: FreeCamera;
  private player: TransformNode;
  private blade: Mesh;
  private enemies: Mesh[] = [];
  private base: Mesh;
  private slash: Mesh;
  private normal: StandardMaterial;
  private warning: StandardMaterial;
  private hurt: StandardMaterial;
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
    this.scene.clearColor = new Color4(0.045, 0.085, 0.11, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.012;
    this.scene.fogColor = new Color3(0.045, 0.085, 0.11);
    this.camera = new FreeCamera("camera", new Vector3(0, 10, -13), this.scene);
    this.camera.minZ = 0.1;
    this.camera.fov = 0.8;
    new HemisphericLight("sky", new Vector3(0, 1, 0), this.scene).intensity =
      0.8;
    const sun = new DirectionalLight(
      "sun",
      new Vector3(-0.5, -1, 0.5),
      this.scene,
    );
    sun.intensity = 1.2;
    const mat = (name: string, color: string) => {
      const m = new StandardMaterial(name, this.scene);
      m.diffuseColor = Color3.FromHexString(color);
      m.specularColor = new Color3(0.08, 0.08, 0.08);
      return m;
    };
    const ground = MeshBuilder.CreateGround(
      "field",
      { width: 52, height: 52, subdivisions: 1 },
      this.scene,
    );
    ground.material = mat("soil", "#263e43");
    const stone = mat("stone", "#53666a");
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI * 2) / 32;
      const rock = MeshBuilder.CreateCylinder(
        "boundary",
        {
          diameterTop: 1,
          diameterBottom: 1.7,
          height: 1 + (i % 3) * 0.4,
          tessellation: 5,
        },
        this.scene,
      );
      rock.position.set(Math.sin(a) * 25, 0.6, Math.cos(a) * 25);
      rock.material = stone;
    }
    const marking = mat("marking", "#46615e");
    for (let i = 0; i < 9; i++) {
      const line = MeshBuilder.CreateBox(
        "inlay",
        { width: 48, height: 0.015, depth: 0.06 },
        this.scene,
      );
      line.position.set(0, 0.015, (i - 4) * 6);
      line.material = marking;
    }
    this.player = new TransformNode("hero", this.scene);
    const armor = mat("hero armor", "#e9c477");
    const body = MeshBuilder.CreateCylinder(
      "hero body",
      { diameterTop: 0.55, diameterBottom: 0.8, height: 1.3, tessellation: 6 },
      this.scene,
    );
    body.position.y = 0.85;
    body.parent = this.player;
    body.material = armor;
    const head = MeshBuilder.CreateSphere(
      "hero head",
      { diameter: 0.48, segments: 4 },
      this.scene,
    );
    head.position.y = 1.7;
    head.parent = this.player;
    head.material = armor;
    this.blade = MeshBuilder.CreateBox(
      "blade",
      { width: 0.12, height: 0.12, depth: 1.9 },
      this.scene,
    );
    this.blade.parent = this.player;
    this.blade.position.set(0.65, 1, 1);
    const sword = mat("steel", "#c4faff");
    sword.emissiveColor = new Color3(0.15, 0.4, 0.4);
    this.blade.material = sword;
    const cape = MeshBuilder.CreateBox(
      "cape",
      { width: 0.75, height: 1.1, depth: 0.08 },
      this.scene,
    );
    cape.parent = this.player;
    cape.position.set(0, 0.85, -0.35);
    cape.rotation.x = -0.15;
    cape.material = mat("cape red", "#7a383d");
    this.slash = MeshBuilder.CreateTorus(
      "strike arc",
      { diameter: 4, thickness: 0.045, tessellation: 24 },
      this.scene,
    );
    this.slash.parent = this.player;
    this.slash.position.y = 0.6;
    this.slash.material = sword;
    const sigil = MeshBuilder.CreateTorus(
      "hero sigil",
      { diameter: 1.2, thickness: 0.035, tessellation: 24 },
      this.scene,
    );
    sigil.parent = this.player;
    sigil.position.y = 0.04;
    sigil.material = armor;
    this.normal = mat("enemy", "#bd655d");
    this.warning = mat("windup", "#ffbe56");
    this.hurt = mat("stagger", "#f3ece1");
    this.base = MeshBuilder.CreateCylinder(
      "enemy template",
      { diameterTop: 0.5, diameterBottom: 0.7, height: 1.5, tessellation: 5 },
      this.scene,
    );
    const helmet = MeshBuilder.CreateSphere(
      "enemy helmet",
      { diameter: 0.45, segments: 4 },
      this.scene,
    );
    helmet.position.y = 0.95;
    const shoulders = MeshBuilder.CreateBox(
      "enemy shoulders",
      { width: 0.95, height: 0.25, depth: 0.4 },
      this.scene,
    );
    shoulders.position.y = 0.5;
    const merged = Mesh.MergeMeshes([this.base, helmet, shoulders], true)!;
    this.base = merged;
    this.base.isVisible = false;
    window.addEventListener("resize", () => engine.resize());
    engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
  }
  render(sim: Simulation, yaw: number, pitch: number, fixed = false) {
    while (this.enemies.length < sim.enemies.enemies.length) {
      const m = this.base.clone(`enemy ${this.enemies.length}`)!;
      m.isVisible = true;
      this.enemies.push(m);
    }
    const p = sim.player;
    this.player.position.set(p.x, 0, p.z);
    this.player.rotation.y = p.yaw;
    this.player.setEnabled(p.hp > 0);
    this.blade.rotation.y = p.swing > 0 ? (1 - p.swing / 0.38) * 5 - 2 : 0;
    this.blade.scaling.z = p.swing > 0 ? 1.35 : 1;
    this.slash.setEnabled(p.swing > 0.1 && p.swing < 0.29);
    this.slash.scaling.setAll(1 + (p.stage - 1) * 0.12);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = sim.enemies.enemies[i],
        m = this.enemies[i]!;
      m.setEnabled(!!e && e.state !== "dead");
      if (e) {
        m.position.set(e.x, 0.75, e.z);
        m.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
        m.material =
          e.state === "windup"
            ? this.warning
            : e.state === "stagger"
              ? this.hurt
              : this.normal;
      }
    }
    const target = new Vector3(fixed ? 0 : p.x, 0, fixed ? 0 : p.z);
    const distance = fixed ? 30 : 11;
    this.camera.position.set(
      target.x - Math.sin(yaw) * distance,
      Math.sin(pitch) * distance + 3,
      target.z - Math.cos(yaw) * distance,
    );
    this.camera.setTarget(target.add(new Vector3(0, 1, 0)));
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
    };
  }
  dispose() {
    this.instrumentation.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
