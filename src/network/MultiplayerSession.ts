import { Simulation, idleInput, type InputFrame } from "../GameLoop";
import { CombatSystem, newPlayer } from "../CombatSystem";
import { StateReplicator, integer } from "./StateReplicator";
import { WebRTCTransport, type Channel } from "./WebRTCTransport";
export function validInput(
  v: any,
): v is { v: 1; type: "input"; seq: number; tick: number; input: InputFrame } {
  return (
    v?.v === 1 &&
    v.type === "input" &&
    integer(v.seq) &&
    integer(v.tick) &&
    v.input &&
    ["x", "z", "yaw"].every(
      (k) =>
        typeof v.input[k] === "number" &&
        Number.isFinite(v.input[k]) &&
        Math.abs(v.input[k]) <= (k === "yaw" ? 1e6 : 1),
    ) &&
    ["attack", "respawn"].every((k) => typeof v.input[k] === "boolean") &&
    ["special", "dodge", "bomb", "attackHeld"].every(
      (k) => v.input[k] === undefined || typeof v.input[k] === "boolean",
    )
  );
}
export abstract class MultiplayerSession {
  transport: WebRTCTransport;
  replicator = new StateReplicator();
  status = "Waiting for manual signaling";
  localId = "p1";
  connected = false;
  rtt = 0;
  snapshotCount = 0;
  protected time = 0;
  protected lastMessage = 0;
  protected lastPing = 0;
  constructor(
    readonly sim: Simulation,
    readonly role: "Host" | "Client",
    private automatic = false,
  ) {
    this.transport = new WebRTCTransport(role === "Host", automatic);
    if (automatic) this.status = "Waiting for room connection";
    this.transport.onopen = () => {
      this.connected = true;
      this.status = "Connected";
      this.lastMessage = this.time;
      this.open();
    };
    this.transport.onclose = (reason) => {
      this.ondispose();
      this.connected = false;
      this.status = reason;
      this.sim.remotePlayers.clear();
      this.sim.remoteInputs.clear();
    };
    this.transport.onmessage = (channel, value: any) => {
      if (value?.v !== 1) return;
      this.lastMessage = this.time;
      if (
        channel === "events" &&
        value.type === "ping" &&
        typeof value.time === "number" &&
        Number.isFinite(value.time)
      )
        this.transport.send("events", { v: 1, type: "pong", time: value.time });
      else if (
        channel === "events" &&
        value.type === "pong" &&
        typeof value.time === "number"
      )
        this.rtt = Math.max(0, (this.time - value.time) * 1000);
      else this.receive(channel, value);
    };
  }
  protected abstract open(): void;
  protected abstract receive(channel: Channel, value: unknown): void;
  abstract step(input: InputFrame, dt: number): void;
  update(dt: number) {
    this.time += dt;
    if (this.connected && this.time - this.lastPing > 2) {
      this.lastPing = this.time;
      this.transport.send("events", { v: 1, type: "ping", time: this.time });
      void this.transport.stats().catch(() => {});
    }
    if (this.connected && this.time - this.lastMessage > 12) {
      this.close();
      this.status = this.automatic
        ? "Peer stopped responding. Create or join a fresh room to reconnect."
        : "Peer stopped responding. Repeat manual signaling.";
    }
  }
  ondispose = () => {};
  close() {
    this.ondispose();
    this.transport.close();
    this.connected = false;
    this.status = this.automatic
      ? "Disconnected. Create or join a fresh room to reconnect."
      : "Disconnected. Repeat manual signaling to reconnect.";
    this.sim.remotePlayers.clear();
    this.sim.remoteInputs.clear();
  }
}
export class HostSession extends MultiplayerSession {
  ack = 0;
  private latest = { ...idleInput };
  private inputAt = 0;
  private snapshotTime = 0;
  constructor(sim: Simulation, automatic = false) {
    super(sim, "Host", automatic);
  }
  protected open() {
    const player = {
      ...newPlayer(),
      maxHp: this.sim.player.hero === "ranger" ? 85 : 100,
      hp: this.sim.player.hero === "ranger" ? 85 : 100,
      hero: this.sim.player.hero,
      weapon: this.sim.player.weapon,
      x: this.sim.player.x + 2,
      z: this.sim.player.z,
      bombs: 1,
      charge: 50,
    };
    this.sim.remotePlayers.set("p2", { player, combat: new CombatSystem() });
    this.transport.send("events", { v: 1, type: "welcome", id: "p2" });
    this.snapshot();
  }
  protected receive(channel: Channel, value: unknown) {
    if (channel !== "input" || !validInput(value) || value.seq <= this.ack)
      return;
    this.ack = value.seq;
    this.inputAt = this.time;
    // Connection ownership assigns p2; payload identity is never consulted.
    const old = this.latest;
    this.latest = {
      ...value.input,
      respawn: old.respawn || value.input.respawn,
      attack: old.attack || value.input.attack,
      special: old.special || value.input.special,
      dodge: old.dodge || value.input.dodge,
      bomb: old.bomb || value.input.bomb,
    };
  }
  private snapshot() {
    if (
      this.transport.send("state", this.replicator.capture(this.sim, this.ack))
    )
      this.snapshotCount++;
  }
  step(input: InputFrame, dt: number) {
    this.update(dt);
    this.sim.remoteInputs.set(
      "p2",
      this.time - this.inputAt < 0.25 ? this.latest : idleInput,
    );
    const revive = (
      p: Simulation["player"],
      combat: CombatSystem,
      requested: boolean,
    ) => {
      if (requested && p.hp <= 0) {
        const { hero, weapon, maxHp } = p;
        Object.assign(p, newPlayer(), { hero, weapon, maxHp, hp: maxHp });
        combat.reset();
      }
    };
    revive(this.sim.player, this.sim.combat, input.respawn);
    const guest = this.sim.remotePlayers.get("p2");
    if (guest && this.time - this.inputAt < 0.25)
      revive(guest.player, guest.combat, this.latest.respawn);
    this.sim.step({ ...input, respawn: false }, dt);
    this.latest = {
      ...this.latest,
      respawn: false,
      attack: false,
      special: false,
      dodge: false,
      bomb: false,
    };
    this.snapshotTime += dt;
    if (this.connected && this.snapshotTime >= 1 / 15) {
      this.snapshotTime %= 1 / 15;
      this.snapshot();
    }
  }
  override close() {
    super.close();
    this.latest = { ...idleInput };
  }
}
export class ClientSession extends MultiplayerSession {
  private seq = 0;
  private sendTime = 0;
  private pending = { ...idleInput };
  constructor(sim: Simulation, automatic = false) {
    super(sim, "Client", automatic);
    this.localId = "p2";
  }
  protected open() {}
  protected receive(channel: Channel, value: any) {
    if (channel === "events" && value?.type === "welcome" && value.id === "p2")
      this.localId = value.id;
    if (
      channel === "state" &&
      this.replicator.apply(value, this.sim, this.localId)
    )
      this.snapshotCount++;
  }
  step(input: InputFrame, dt: number) {
    this.update(dt);
    if (!this.connected) return;
    const length = Math.max(1, Math.hypot(input.x, input.z));
    this.pending = {
      ...input,
      x: input.x / length,
      z: input.z / length,
      attack: this.pending.attack || input.attack,
      special: this.pending.special || input.special,
      dodge: this.pending.dodge || input.dodge,
      bomb: this.pending.bomb || input.bomb,
      respawn: this.pending.respawn || input.respawn,
    };
    this.sendTime += dt;
    if (this.sendTime >= 1 / 30) {
      this.sendTime %= 1 / 30;
      this.transport.send("input", {
        v: 1,
        type: "input",
        seq: ++this.seq,
        tick: this.sim.ticks,
        input: this.pending,
      });
      this.pending = { ...idleInput };
    }
    this.replicator.interpolate(this.sim, dt, this.localId);
  }
}
