import { describe, it, expect, vi, afterEach } from "vitest";
import { Simulation, idleInput } from "../src/GameLoop";
import { CombatSystem, newPlayer } from "../src/CombatSystem";
import {
  ManualSignaling,
  WebRTCTransport,
} from "../src/network/WebRTCTransport";
import { StateReplicator, validSnapshot } from "../src/network/StateReplicator";
import {
  ClientSession,
  HostSession,
  validInput,
} from "../src/network/MultiplayerSession";
class FakeChannel {
  readyState = "open";
  bufferedAmount = 0;
  sent: string[] = [];
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (e: { data: string }) => void;
  constructor(
    public label: string,
    public options: unknown,
  ) {}
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.readyState = "closed";
  }
}
class FakePeer {
  connectionState = "new";
  iceGatheringState = "complete";
  channels: FakeChannel[] = [];
  createDataChannel(name: string, options: unknown) {
    const c = new FakeChannel(name, options);
    this.channels.push(c);
    return c;
  }
  close() {
    this.connectionState = "closed";
  }
}
afterEach(() => vi.unstubAllGlobals());
function setup() {
  vi.stubGlobal("RTCPeerConnection", FakePeer);
}
describe("manual signaling and transport", () => {
  it("validates versions, type, SDP and size", () => {
    const code = ManualSignaling.encode({ type: "offer", sdp: "v=0\r\n" });
    expect(ManualSignaling.decode(code, "offer").type).toBe("offer");
    for (const s of ["{}", "null", code.replace("1", "2"), "x".repeat(100001)])
      expect(() => ManualSignaling.decode(s, "offer")).toThrow();
    expect(() => ManualSignaling.decode(code, "answer")).toThrow();
  });
  it("creates specified channels, drops large/blocked messages and cleans up", () => {
    setup();
    const t = new WebRTCTransport(true);
    const pc = t.pc as unknown as FakePeer;
    expect(pc.channels.map((c) => c.options)).toEqual([
      { ordered: false, maxRetransmits: 0 },
      { ordered: false, maxRetransmits: 0 },
      { ordered: true },
    ]);
    const opened = vi.fn();
    t.onopen = opened;
    pc.channels[0]!.onopen!();
    expect(opened).toHaveBeenCalledOnce();
    expect(t.send("state", "x".repeat(60000))).toBe(false);
    pc.channels[1]!.bufferedAmount = 200000;
    expect(t.send("state", {})).toBe(false);
    const received = vi.fn();
    t.onmessage = received;
    pc.channels[0]!.onmessage!({ data: "not json" });
    expect(received).not.toHaveBeenCalled();
    t.close();
    t.close();
    expect(t.channels.size).toBe(0);
    expect(pc.connectionState).toBe("closed");
  });
});
describe("authority and replication", () => {
  it("orders input by connection, ignores forged ownership, and expires movement", () => {
    setup();
    const sim = new Simulation(0),
      host = new HostSession(sim);
    host.transport.onopen();
    const message = {
      v: 1,
      type: "input",
      seq: 2,
      tick: 0,
      playerId: "p1",
      input: { ...idleInput, x: 1, respawn: true },
    };
    host.transport.onmessage("input", message);
    host.transport.onmessage("input", {
      ...message,
      seq: 1,
      input: { ...idleInput, x: -1 },
    });
    host.step(idleInput, 1 / 60);
    expect(sim.player.x).toBe(0);
    expect(sim.remotePlayers.get("p2")!.player.x).toBeGreaterThan(2);
    expect(host.ack).toBe(2);
    expect(sim.remotePlayers.size).toBe(1);
    expect(
      validInput({ ...message, input: { ...idleInput, x: Infinity } }),
    ).toBe(false);
    for (let i = 0; i < 30; i++) host.step(idleInput, 1 / 60);
    const x = sim.remotePlayers.get("p2")!.player.x;
    host.step(idleInput, 1 / 60);
    expect(sim.remotePlayers.get("p2")!.player.x).toBe(x);
    host.transport.onclose("lost");
    expect(sim.remotePlayers.size).toBe(0);
    host.close();
  });
  it("replicates enemies, health, projectiles, membership and rejects stale/malformed snapshots", () => {
    const host = new Simulation(20),
      client = new Simulation(0),
      writer = new StateReplicator(),
      reader = new StateReplicator();
    host.remotePlayers.set("p2", {
      player: newPlayer(),
      combat: new CombatSystem(),
    });
    host.enemies.enemies[0]!.hp = 4;
    host.combat.applyHit(host.player, host.enemies.enemies[0]!, 100, true);
    const snapshot = JSON.parse(JSON.stringify(writer.capture(host, 42)));
    expect(reader.apply(snapshot, client, "p2")).toBe(true);
    expect(client.enemies.enemies[0]!.state).toBe("dead");
    expect(client.remotePlayers.get("p1")!.player.kills).toBe(1);
    expect(reader.apply(snapshot, client, "p2")).toBe(false);
    expect(
      reader.apply({ ...snapshot, seq: 2, enemies: [{}] }, client, "p2"),
    ).toBe(false);
    host.remotePlayers.delete("p2");
    expect(reader.apply(writer.capture(host, 42), client, "p1")).toBe(true);
    expect(client.remotePlayers.size).toBe(0);
  });
  it("clients never simulate combat and freeze when disconnected; duplicate events are harmless", () => {
    setup();
    const sim = new Simulation(20),
      client = new ClientSession(sim);
    client.transport.onopen();
    const before = JSON.stringify(sim.enemies.enemies);
    for (let i = 0; i < 60; i++)
      client.step(
        { ...idleInput, attack: true, bomb: true, special: true },
        1 / 60,
      );
    expect(JSON.stringify(sim.enemies.enemies)).toBe(before);
    expect(sim.ticks).toBe(0);
    client.transport.onmessage("events", { v: 1, type: "welcome", id: "p2" });
    client.transport.onmessage("events", { v: 1, type: "welcome", id: "p2" });
    expect(client.localId).toBe("p2");
    client.close();
    client.step({ ...idleInput, x: 1 }, 1 / 60);
    expect(sim.player.x).toBe(0);
    sim.reset();
    expect(sim.remotePlayers.size).toBe(0);
    expect(sim.remoteInputs.size).toBe(0);
  });
  it("independent combat controllers hit once each and AI can damage guest", () => {
    const sim = new Simulation(1),
      guest = newPlayer();
    guest.z = 10;
    sim.player.x = 20;
    sim.player.z = 20;
    sim.remotePlayers.set("p2", { player: guest, combat: new CombatSystem() });
    Object.assign(sim.enemies.enemies[0]!, {
      x: 0,
      z: 10.5,
      state: "windup",
      timer: 0,
      attackYaw: Math.PI,
    });
    sim.step(idleInput);
    expect(guest.hp).toBeLessThan(100);
    expect(sim.player.hp).toBe(100);
    const e = sim.enemies.enemies[0]!;
    e.hp = 1000;
    e.state = "pursuit";
    const a = new CombatSystem(),
      b = new CombatSystem();
    expect(a.strike(guest, e)).toBe(true);
    expect(a.strike(guest, e)).toBe(false);
    expect(b.strike(sim.player, e)).toBe(true);
  });
  it("replicates stable projectile identities and rejects malformed nested entities", () => {
    const host = new Simulation(1),
      client = new Simulation(0),
      writer = new StateReplicator(),
      reader = new StateReplicator();
    host.player.hero = "ranger";
    host.player.weapon = "shortbow";
    Object.assign(host.enemies.enemies[0]!, { x: 0, z: 5 });
    host.step({ ...idleInput, attack: true });
    const a = JSON.parse(JSON.stringify(writer.capture(host, 0)));
    expect(a.arrows[0].id).toBe("p1:0");
    expect(reader.apply(a, client, "p1")).toBe(true);
    expect(client.combat.arrows[0]!.networkId).toBe("p1:0");
    const before = client.combat.arrows[0]!.z;
    host.step(idleInput);
    expect(
      reader.apply(
        JSON.parse(JSON.stringify(writer.capture(host, 0))),
        client,
        "p1",
      ),
    ).toBe(true);
    reader.interpolate(client, 1 / 60, "p1");
    expect(client.combat.arrows[0]!.z).toBeGreaterThan(before);
    for (const key of ["players", "enemies", "arrows"])
      expect(validSnapshot({ ...a, [key]: [null] })).toBe(false);
    expect(
      validSnapshot({ ...a, arrows: [{ ...a.arrows[0], id: "forged" }] }),
    ).toBe(false);
  });
  it("revives only the requesting fallen fighter without resetting enemies or membership", () => {
    setup();
    const sim = new Simulation(1),
      host = new HostSession(sim);
    host.transport.onopen();
    const guest = sim.remotePlayers.get("p2")!.player;
    guest.hp = 0;
    host.transport.onmessage("input", {
      v: 1,
      type: "input",
      seq: 1,
      tick: 0,
      input: { ...idleInput, respawn: true },
    });
    host.step(idleInput, 1 / 60);
    expect(guest.hp).toBe(100);
    expect(sim.remotePlayers.size).toBe(1);
    expect(sim.ticks).toBe(1);
    host.close();
  });
  it("measures replication cost at existing crowd sizes", () => {
    for (const count of [20, 40]) {
      const sim = new Simulation(count),
        r = new StateReplicator();
      sim.remotePlayers.set("p2", {
        player: newPlayer(),
        combat: new CombatSystem(),
      });
      const n = 2000,
        start = performance.now();
      let bytes = 0;
      for (let i = 0; i < n; i++)
        bytes += JSON.stringify(r.capture(sim, i)).length;
      console.log(
        JSON.stringify({
          benchmark: "replication",
          enemies: count,
          iterations: n,
          serializeMs: (performance.now() - start) / n,
          snapshotBytes: bytes / n,
          bytesPerSecondAt15Hz: (bytes / n) * 15,
        }),
      );
    }
  });
});
