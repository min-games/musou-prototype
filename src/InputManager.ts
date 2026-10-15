import type { InputFrame } from "./GameLoop";
export class InputManager {
  keys = new Set<string>();
  yaw = 0;
  pitch = 0.75;
  private queued = false;
  private reset = false;
  private previousA = false;
  private previousY = false;
  private special = false;
  private dodge = false;
  private previousB = false;
  private previousX = false;
  private enabled = true;
  private bomb = false;
  private previousRB = false;
  queueBomb() {
    this.bomb = true;
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (!value) {
      this.bomb = false;
      this.keys.clear();
      this.queued = false;
      this.reset = false;
      this.special = false;
      this.dodge = false;
    }
  }
  queueSpecial() {
    this.special = true;
  }
  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("button,input,select,textarea")
      )
        return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat && (e.code === "KeyJ" || e.code === "Space"))
        this.queued = true;
      if (!e.repeat && e.code === "KeyF") this.bomb = true;
      if (!e.repeat && e.code === "KeyR") this.reset = true;
      if (!e.repeat && (e.code === "KeyQ" || e.code === "KeyK"))
        this.special = true;
      if (!e.repeat && (e.code === "ShiftLeft" || e.code === "ShiftRight"))
        this.dodge = true;
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.bomb = false;
      this.keys.clear();
      this.queued = false;
      this.reset = false;
      this.special = false;
      this.dodge = false;
    });
    canvas.addEventListener("pointerdown", (e) =>
      canvas.setPointerCapture(e.pointerId),
    );
    canvas.addEventListener("pointermove", (e) => {
      if (e.buttons) {
        this.yaw -= e.movementX * 0.006;
        this.pitch = Math.max(
          0.3,
          Math.min(1.2, this.pitch + e.movementY * 0.004),
        );
      }
    });
  }
  poll(dt: number): InputFrame {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(
      (pad) => pad?.connected,
    );
    const dead = (n = 0) => (Math.abs(n) < 0.18 ? 0 : n);
    this.yaw +=
      ((this.keys.has("ArrowLeft") ? 1 : 0) -
        (this.keys.has("ArrowRight") ? 1 : 0) -
        dead(pad?.axes[2])) *
      dt *
      2;
    this.pitch = Math.max(
      0.3,
      Math.min(
        1.2,
        this.pitch +
          (dead(pad?.axes[3]) +
            Number(this.keys.has("ArrowDown")) -
            Number(this.keys.has("ArrowUp"))) *
            dt,
      ),
    );
    let x =
      Number(this.keys.has("KeyD")) -
      Number(this.keys.has("KeyA")) +
      dead(pad?.axes[0]);
    let z =
      Number(this.keys.has("KeyW")) -
      Number(this.keys.has("KeyS")) -
      dead(pad?.axes[1]);
    const a = pad?.buttons[0]?.pressed ?? false;
    const attack = this.queued || (a && !this.previousA);
    this.previousA = a;
    this.queued = false;
    const y = pad?.buttons[3]?.pressed ?? false;
    const respawn = this.reset || (y && !this.previousY);
    this.previousY = y;
    this.reset = false;
    const b = pad?.buttons[1]?.pressed ?? false;
    const xButton = pad?.buttons[2]?.pressed ?? false;
    const special = this.special || (b && !this.previousB);
    const dodge = this.dodge || (xButton && !this.previousX);
    this.previousB = b;
    this.previousX = xButton;
    this.special = false;
    this.dodge = false;
    const rb = pad?.buttons[5]?.pressed ?? false;
    const bomb = this.bomb || (rb && !this.previousRB);
    this.previousRB = rb;
    this.bomb = false;
    return {
      bomb,
      attackHeld: this.keys.has("KeyJ") || this.keys.has("Space") || a,
      x: x * Math.cos(this.yaw) + z * Math.sin(this.yaw),
      z: z * Math.cos(this.yaw) - x * Math.sin(this.yaw),
      attack,
      respawn,
      special,
      dodge,
      yaw: this.yaw,
    };
  }
}
