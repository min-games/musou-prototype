import "@babylonjs/loaders/glTF/glTFFileLoader";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/loaders/glTF/2.0/Extensions/EXT_texture_webp";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type {
  AssetContainer,
  InstantiatedEntries,
} from "@babylonjs/core/assetContainer";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Simulation } from "./GameLoop";
type Hero = Simulation["player"]["hero"];
type Instance = {
  hero: Hero;
  entries: InstantiatedEntries;
  root: TransformNode;
  nodes: Map<string, TransformNode>;
  lastX: number;
  lastZ: number;
  lastTime: number;
  phase: number;
  moving: boolean;
  clip?: string;
  clipFrame?: number;
  locomotionBlend?: {
    start: number;
    pose: Map<TransformNode, { rotation: Quaternion; position: Vector3 }>;
  };
};
/** Shared immutable geometry/materials; each actor owns its cloned joints and skeleton. */
export class TempleCharacters {
  private templates = new Map<Hero, AssetContainer>();
  private instances = new Map<TransformNode, Instance>();
  private states: Record<Hero, string> = {
    vanguard: "loading",
    ranger: "loading",
  };
  private errors: Partial<Record<Hero, string>> = {};
  private disposed = false;
  readonly legacy =
    new URLSearchParams(location.search).get("art") === "legacy";
  readonly blender =
    new URLSearchParams(location.search).get("art") === "blender";
  private modelFile(hero: Hero) {
    return this.blender && hero === "vanguard"
      ? "vanguard-blender-v1.glb"
      : `${hero}-v1.glb`;
  }
  constructor(private scene: Scene) {}
  get fallback() {
    return Object.values(this.states).includes("fallback");
  }
  async load() {
    if (this.legacy) {
      this.states = { vanguard: "legacy", ranger: "legacy" };
      return;
    }
    await Promise.all(
      (["vanguard", "ranger"] as const).map(async (hero) => {
        // Babylon handles dependency requests (the shared atlas) relative to this URL.
        const url = new URL(
          `${import.meta.env.BASE_URL}models/${this.modelFile(hero)}`,
          document.baseURI,
        ).href;
        let timedOut = false;
        let timer: ReturnType<typeof setTimeout>;
        const loading = LoadAssetContainerAsync(url, this.scene);
        loading.then(
          (container) => {
            if (timedOut || this.disposed) container.dispose();
          },
          () => {},
        );
        try {
          const container = await Promise.race([
            loading,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                timedOut = true;
                reject(new Error("asset load exceeded 12 seconds"));
              }, 12000);
            }),
          ]);
          if (!this.disposed) {
            this.templates.set(hero, container);
            this.states[hero] = "loaded";
          }
        } catch (error) {
          this.states[hero] = "fallback";
          this.errors[hero] = String(error);
          console.warn(`Temple ${hero}: using legacy fallback`, error);
        } finally {
          clearTimeout(timer!);
        }
      }),
    );
  }
  animate(
    parent: TransformNode,
    p: Simulation["player"],
    time: number,
    reduced: boolean,
  ) {
    if (this.disposed) return undefined;
    let inst = this.instances.get(parent);
    if (inst?.hero !== p.hero) {
      if (inst) this.release(parent);
      inst = undefined;
    }
    const template = this.templates.get(p.hero);
    if (!template) return undefined;
    if (!inst) {
      const entries = template.instantiateModelsToScene(
        (name) => `${parent.uniqueId}:${name}`,
        false,
        { doNotInstantiate: true },
      );
      const root = new TransformNode("temple-art", this.scene);
      root.metadata = { templeArt: true };
      root.parent = parent;
      // Babylon glTF loader supplies the handedness conversion. Authored +Z faces sim +Z.
      for (const node of entries.rootNodes) node.parent = root;
      const nodes = new Map<string, TransformNode>();
      // glTF bones link to these transform nodes, which are cloned by AssetContainer.
      for (const n of root.getChildTransformNodes(false)) {
        const original = n.name.slice(n.name.indexOf(":") + 1);
        nodes.set(original, n);
      }
      inst = {
        hero: p.hero,
        entries,
        root,
        nodes,
        lastX: p.x,
        lastZ: p.z,
        lastTime: time,
        phase: 0,
        moving: false,
      };
      this.instances.set(parent, inst);
    }
    const dt = time - inst.lastTime;
    if (dt > 0) {
      inst.moving = Math.hypot(p.x - inst.lastX, p.z - inst.lastZ) / dt > 0.15;
      inst.phase += Math.min(dt, 0.1) * 10;
    }
    inst.lastX = p.x;
    inst.lastZ = p.z;
    inst.lastTime = time;
    if (this.blender && p.hero === "vanguard") {
      // Sample the actual exported animation at simulation time. This stays deterministic
      // when paused, follows attack timing, and gives every remote actor its own pose.
      const clip =
        p.swing > 0
          ? "Attack"
          : (inst.moving || p.dashTimer > 0) && !reduced
            ? "Run"
            : "Idle";
      const group = inst.entries.animationGroups.find((g) =>
        g.name.endsWith(`:${clip}`),
      );
      if (group) {
        if (inst.clip !== clip) {
          // The lifted run has a distinct contact pose. Ease locomotion changes
          // from the displayed pose without changing simulation movement or attacks.
          inst.locomotionBlend =
            inst.clip && !reduced && inst.clip !== "Attack" && clip !== "Attack"
              ? {
                  start: time,
                  pose: new Map(
                    [...inst.nodes.values()]
                      .filter((n) => n.rotationQuaternion)
                      .map((n) => [
                        n,
                        {
                          rotation: n.rotationQuaternion!.clone(),
                          position: n.position.clone(),
                        },
                      ]),
                  ),
                }
              : undefined;
          for (const g of inst.entries.animationGroups) g.stop();
          group.start(false);
          group.pause();
          inst.clip = clip;
        }
        const span = group.to - group.from;
        const duration =
          span / (group.targetedAnimations[0]?.animation.framePerSecond || 30);
        const phase =
          clip === "Attack"
            ? Math.min(1, Math.max(0, 1 - p.swing / p.swingDuration))
            : reduced
              ? 0
              : (time % duration) / duration;
        inst.clipFrame = group.from + phase * span;
        group.goToFrame(inst.clipFrame);
        if (inst.locomotionBlend) {
          const progress = Math.min(
            1,
            Math.max(0, (time - inst.locomotionBlend.start) / 0.12),
          );
          const weight = progress * progress * (3 - 2 * progress);
          for (const [node, pose] of inst.locomotionBlend.pose) {
            Quaternion.SlerpToRef(
              pose.rotation,
              node.rotationQuaternion!,
              weight,
              node.rotationQuaternion!,
            );
            Vector3.LerpToRef(
              pose.position,
              node.position,
              weight,
              node.position,
            );
          }
          if (progress === 1) inst.locomotionBlend = undefined;
        }
      }
      // The loader links skin joints to these cloned nodes, including the hand socket.
      for (const node of inst.root.getChildTransformNodes(false))
        node.computeWorldMatrix(true);
      return { root: inst.root, hand: inst.nodes.get("hand.R") };
    }
    const gait = inst.moving && !reduced ? Math.sin(inst.phase) * 0.5 : 0;
    const swing =
      p.swing > 0 ? Math.sin((1 - p.swing / p.swingDuration) * Math.PI) : 0;
    const turn = (name: string, x = 0, y = 0, z = 0) => {
      const n = inst!.nodes.get(name);
      if (n) n.rotationQuaternion = Quaternion.FromEulerAngles(x, y, z);
    };
    turn(
      "chest",
      p.dashTimer > 0 ? 0.35 : reduced ? 0 : Math.sin(time * 2) * 0.018,
      reduced ? 0 : swing * 0.22,
    );
    turn("head", 0, -swing * 0.12);
    turn("thigh.L", gait);
    turn("thigh.R", -gait);
    turn("shin.L", Math.max(0, -gait) * 0.9);
    turn("shin.R", Math.max(0, gait) * 0.9);
    const ranged = p.hero === "ranger";
    turn("arm.L", ranged ? -1.2 : -gait * 0.65, 0, ranged ? -0.2 : -0.07);
    turn(
      "arm.R",
      ranged ? -1.1 : -0.18 + gait * 0.65 - swing * 1.3,
      ranged ? swing * 0.3 : swing * 0.6,
      ranged ? 0.15 : 0.07,
    );
    turn("forearm.L", ranged ? -0.35 : -0.18);
    turn("forearm.R", ranged ? -0.8 - swing * 0.3 : -0.25 - swing * 0.5);
    turn(
      "sash",
      reduced ? 0 : Math.sin(time * 5) * 0.12 + (inst.moving ? 0.25 : 0),
    );
    // Attachments are driven by actual cloned hand transforms in character-local space.
    inst.root.computeWorldMatrix(true);
    const hand = inst.nodes.get(ranged ? "hand.L" : "hand.R");
    if (!hand) return { root: inst.root, hand: undefined };
    hand.computeWorldMatrix(true);
    return { root: inst.root, hand };
  }
  release(parent: TransformNode) {
    const inst = this.instances.get(parent);
    if (!inst) return;
    inst.entries.dispose();
    inst.root.dispose();
    this.instances.delete(parent);
  }
  metadata() {
    const actors = [...this.instances.values()];
    return {
      version: this.blender ? "blender-v1-candidate" : "temple-fantasy-v1",
      states: { ...this.states },
      errors: { ...this.errors },
      atlasResolution: [1024, 1024],
      uvInsetPixels: 8,
      models: Object.fromEntries(
        [...this.templates].map(([hero, t]) => {
          const meshes = t.meshes.filter((m) => m.getTotalVertices() > 0);
          return [
            hero,
            {
              file: this.modelFile(hero),
              animations: t.animationGroups.map((g) => ({
                name: g.name,
                from: g.from,
                to: g.to,
              })),
              triangles: meshes.reduce(
                (n, m) => n + m.getTotalIndices() / 3,
                0,
              ),
              meshes: meshes.length,
              joints: t.skeletons[0]?.bones.length,
              textureResolution: t.textures[0]?.getSize(),
            },
          ];
        }),
      ),
      activeActors: actors.length,
      actors: actors.map((i) => ({
        hero: i.hero,
        clip: i.clip,
        clipFrame: i.clipFrame,
        root: i.root.uniqueId,
        skeleton: i.entries.skeletons[0]?.uniqueId,
        meshes: i.entries.rootNodes
          .flatMap((n) => n.getChildMeshes())
          .filter((m) => m.getTotalVertices() > 0)
          .map((m) => ({
            geometry: (m as Mesh).geometry?.uniqueId,
            material: m.material?.uniqueId,
            vertices: m.getTotalVertices(),
          })),
        pose: [...i.nodes]
          .filter(([n]) => n === "arm.R" || n === "thigh.L")
          .map(([name, n]) => ({
            name,
            rotation: n.rotationQuaternion?.asArray(),
          })),
      })),
    };
  }
  dispose() {
    this.disposed = true;
    for (const parent of this.instances.keys()) this.release(parent);
    for (const t of this.templates.values()) t.dispose();
    this.templates.clear();
  }
}
