import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RoomSignaling,
  requestRoom,
  parseServer,
  invitedRoom,
  inviteLink,
  roomError,
  type Credentials,
} from "../src/network/RoomSignaling";
const credentials = (): Credentials => ({
  v: 1,
  room: "ABCD2345",
  participantId: "host",
  role: "host",
  token: "s".repeat(43),
  expiresAt: Date.now() + 900_000,
  wsPath: "/v1/rooms/ABCD2345/ws",
  inviteUrl: "https://min-games.github.io/musou-prototype/#room=ABCD2345",
  capacity: 2,
});
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: (e: { code: number }) => void;
  onerror?: () => void;
  sent: any[] = [];
  constructor(readonly url: string) {
    Socket.instances.push(this);
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.readyState = 3;
  }
  emit(m: object) {
    this.onmessage?.({ data: JSON.stringify({ v: 1, ...m }) });
  }
}
class Peer extends EventTarget {
  signalingState = "stable";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0\r\n" }));
  createAnswer = vi.fn(async () => ({ type: "answer", sdp: "v=0\r\n" }));
  setLocalDescription = vi.fn(async (d: RTCSessionDescriptionInit) => {
    this.localDescription = d;
    this.signalingState = d.type === "offer" ? "have-local-offer" : "stable";
    if (d.type !== "rollback") this.ice();
  });
  setRemoteDescription = vi.fn(async (d: RTCSessionDescriptionInit) => {
    this.remoteDescription = d;
    this.signalingState = d.type === "offer" ? "have-remote-offer" : "stable";
  });
  addIceCandidate = vi.fn(async () => {});
  close = vi.fn();
  ice() {
    const e = new Event("icecandidate");
    Object.assign(e, {
      candidate: {
        toJSON: () => ({
          candidate: "candidate:1",
          sdpMid: "0",
          sdpMLineIndex: 0,
        }),
      },
    });
    this.dispatchEvent(e);
  }
}
let adapter: RoomSignaling | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  Socket.instances = [];
  vi.stubGlobal("WebSocket", Socket);
});
afterEach(() => {
  adapter?.close();
  adapter = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const tick = async (ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms);
};
function setup(role: "host" | "guest" = "host", healthy = false) {
  const c = { ...credentials(), role, participantId: role };
  const pc = new Peer(),
    status = vi.fn();
  adapter = new RoomSignaling(
    "https://signal.example",
    c,
    pc as unknown as RTCPeerConnection,
    () => healthy,
    status,
  );
  const ws = Socket.instances.at(-1)!;
  ws.onopen?.();
  const ready = (peers: string[] = [], revision = 0) =>
    ws.emit({
      type: "ready",
      participantId: role,
      role,
      room: c.room,
      expiresAt: c.expiresAt,
      revision,
      peers,
    });
  return { c, pc, ws, status, ready };
}
describe("room requests and shareable invites", () => {
  it("prefills codes without tokens and generates a clean invite", () => {
    expect(invitedRoom("#room=abcd2345&token=secret")).toBe("ABCD2345");
    expect(invitedRoom("#room=../bad")).toBe("");
    expect(
      inviteLink(
        "ABCD2345",
        "https://min-games.github.io/musou-prototype/?secret=x#token=y",
      ),
    ).toBe(credentials().inviteUrl);
  });
  it("posts the exact body once, omits cookies and validates credentials", async () => {
    const fetch = vi.fn(
      async (_url: unknown, _options: unknown) =>
        new Response(JSON.stringify(credentials()), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await requestRoom(
      "https://signal.example",
      undefined,
      new AbortController().signal,
    );
    expect(result.role).toBe("host");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      body: '{"v":1}',
      credentials: "omit",
      cache: "no-store",
      method: "POST",
    });
  });
  it.each([
    "room_full",
    "room_expired",
    "origin_denied",
    "daily_room_limit",
    "rate_limited",
  ])("reports %s without retrying a mutation", async (error) => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ v: 1, error }), { status: 429 }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      requestRoom(
        "https://signal.example",
        "ABCD2345",
        new AbortController().signal,
      ),
    ).rejects.toThrow(error);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(roomError(error)).not.toContain("incompatible");
  });
  it("rejects version, arbitrary socket paths, fields and oversized/non-JSON responses", async () => {
    for (const value of [
      { ...credentials(), v: 2 },
      { ...credentials(), wsPath: "https://evil/ws" },
      { ...credentials(), extra: 1 },
      "x".repeat(5000),
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              typeof value === "string" ? value : JSON.stringify(value),
              { status: 201 },
            ),
        ),
      );
      await expect(
        requestRoom(
          "https://signal.example",
          undefined,
          new AbortController().signal,
        ),
      ).rejects.toThrow();
    }
  });
  it("aborts canceled and timed out requests, without retry", async () => {
    const fetch = vi.fn(
      (_url, options) =>
        new Promise((_, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const pending = requestRoom(
      "https://signal.example",
      undefined,
      controller.signal,
    );
    const assertion = expect(pending).rejects.toThrow("canceled");
    controller.abort();
    await assertion;
    const timeout = expect(
      requestRoom(
        "https://signal.example",
        undefined,
        new AbortController().signal,
      ),
    ).rejects.toThrow("timeout");
    await tick(12000);
    await timeout;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
describe("exact signaling protocol and ordering", () => {
  it("reports a browser-blocked socket without leaving timers or closing gameplay", () => {
    vi.stubGlobal(
      "WebSocket",
      class {
        constructor() {
          throw new DOMException("Blocked", "SecurityError");
        }
      },
    );
    const pc = new Peer(),
      status = vi.fn();
    adapter = new RoomSignaling(
      "https://signal.example",
      credentials(),
      pc as unknown as RTCPeerConnection,
      () => true,
      status,
    );
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining("Gameplay continues"),
    );
    expect(pc.close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("authenticates only in the first frame and waits for a peer", async () => {
    const { c, pc, ws, ready } = setup();
    expect(ws.url).toBe("wss://signal.example/v1/rooms/ABCD2345/ws");
    expect(ws.sent).toEqual([
      { v: 1, type: "auth", participantId: "host", token: c.token },
    ]);
    ready();
    await tick(500);
    expect(pc.createOffer).not.toHaveBeenCalled();
    ws.emit({ type: "peer_connected", participantId: "guest", revision: 0 });
    await tick(1000);
    expect(ws.sent.map((m) => m.type)).toEqual(["auth", "offer", "ice"]);
    expect(ws.sent[1]).toEqual({
      v: 1,
      type: "offer",
      to: "guest",
      revision: 1,
      description: { type: "offer", sdp: "v=0\r\n" },
    });
  });
  it("ignores duplicate ready/peer notifications and applies answer before ICE", async () => {
    const { pc, ws, ready } = setup();
    ready(["guest"]);
    ready(["guest"]);
    ws.emit({ type: "peer_connected", participantId: "guest", revision: 0 });
    await tick(1000);
    expect(pc.createOffer).toHaveBeenCalledTimes(1);
    ws.emit({ type: "ice", from: "guest", revision: 1, candidate: null });
    await tick();
    expect(pc.addIceCandidate).not.toHaveBeenCalled();
    ws.emit({
      type: "answer",
      from: "guest",
      revision: 1,
      description: { type: "answer", sdp: "v=0\r\n" },
    });
    await tick();
    expect(pc.setRemoteDescription).toHaveBeenCalledTimes(1);
    expect(pc.addIceCandidate).toHaveBeenCalledTimes(1);
  });
  it("guest answers only after applying offer and sends SDP before local ICE", async () => {
    const { pc, ws, ready } = setup("guest");
    ready(["host"]);
    ws.emit({
      type: "offer",
      from: "host",
      revision: 1,
      description: { type: "offer", sdp: "v=0\n" },
    });
    await tick(1500);
    expect(pc.setRemoteDescription).toHaveBeenCalledTimes(1);
    expect(ws.sent.map((m) => m.type)).toEqual(["auth", "answer", "ice"]);
  });
  it.each([
    { v: 2, type: "peer_connected", participantId: "guest", revision: 0 },
    { type: "peer_connected", participantId: "guest", revision: 9 },
    {
      type: "peer_connected",
      participantId: "guest",
      revision: 0,
      room: "ABCD2345",
    },
    {
      type: "ice",
      from: "guest",
      revision: 1,
      candidate: { candidate: "candidate:x", arbitrary: 1 },
    },
    {
      type: "answer",
      from: "guest",
      revision: 1,
      description: { type: "answer", sdp: "v=0\n" + "x".repeat(12000) },
    },
  ])("rejects invalid envelopes", (message) => {
    expect(() => parseServer(JSON.stringify({ v: 1, ...message }))).toThrow();
  });
  it("rejects signals before ready and stale/duplicate revisions", async () => {
    const { ws, pc, status } = setup();
    ws.emit({ type: "ice", from: "guest", revision: 1, candidate: null });
    await tick();
    expect(status).toHaveBeenLastCalledWith(expect.stringContaining("access"));
    expect(pc.close).not.toHaveBeenCalled();
    adapter?.close();
    const next = setup();
    next.ready(["guest"]);
    await tick(1000);
    next.ws.emit({
      type: "answer",
      from: "guest",
      revision: 2,
      description: { type: "answer", sdp: "v=0\n" },
    });
    await tick();
    expect(next.ws.readyState).toBe(3);
  });
  it("paces ICE below the burst allowance and bounds queues", async () => {
    const { ws, pc, ready } = setup();
    ready(["guest"]);
    await tick(500);
    for (let i = 0; i < 40; i++) pc.ice();
    await tick(10000);
    expect(ws.sent.length).toBeLessThanOrEqual(28);
    for (let i = 0; i < 100; i++) pc.ice();
    await tick();
    expect(ws.readyState).toBe(3);
    expect(pc.close).not.toHaveBeenCalled();
  });
  it("bounds remote ICE, incoming work and lifetime bytes", async () => {
    const first = setup();
    first.ready(["guest"]);
    await tick(1000);
    for (let i = 0; i < 65; i++) {
      first.ws.emit({
        type: "ice",
        from: "guest",
        revision: 1,
        candidate: null,
      });
      await tick();
    }
    expect(first.ws.readyState).toBe(3);
    adapter?.close();
    const next = setup();
    next.ready(["guest"]);
    await tick(1000);
    for (let i = 0; i < 65; i++) {
      const event = new Event("icecandidate");
      Object.assign(event, {
        candidate: {
          toJSON: () => ({ candidate: "candidate:" + "x".repeat(2038) }),
        },
      });
      next.pc.dispatchEvent(event);
      await tick(450);
    }
    expect(next.ws.readyState).toBe(3);
    expect(next.status).toHaveBeenLastCalledWith(
      expect.stringContaining("allowance"),
    );
    adapter?.close();
    const last = setup();
    for (let i = 0; i < 65; i++)
      last.ws.emit({
        type: "peer_connected",
        participantId: "guest",
        revision: 0,
      });
    await tick();
    expect(last.ws.readyState).toBe(3);
  });
  it("serializes delayed remote SDP with ICE and rejects duplicate answers", async () => {
    const { pc, ws, ready } = setup();
    ready(["guest"]);
    await tick(1000);
    let release!: () => void;
    pc.setRemoteDescription.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const answer = {
      type: "answer",
      from: "guest",
      revision: 1,
      description: { type: "answer", sdp: "v=0\n" },
    };
    ws.emit(answer);
    ws.emit({ type: "ice", from: "guest", revision: 1, candidate: null });
    await tick();
    expect(pc.addIceCandidate).not.toHaveBeenCalled();
    pc.signalingState = "stable";
    release();
    await tick();
    expect(pc.addIceCandidate).toHaveBeenCalledTimes(1);
    ws.emit(answer);
    await tick();
    expect(ws.readyState).toBe(3);
  });
  it("resumes within 60 seconds using server revision and rollback", async () => {
    const { pc, ws, ready, c } = setup();
    ready(["guest"]);
    await tick(1000);
    ws.onclose?.({ code: 1006 });
    await tick(1000);
    const resumed = Socket.instances[1]!;
    resumed.onopen?.();
    resumed.emit({
      type: "ready",
      participantId: "host",
      role: "host",
      room: c.room,
      expiresAt: c.expiresAt,
      revision: 1,
      peers: ["guest"],
    });
    await tick(1000);
    expect(
      pc.setLocalDescription.mock.calls.some(([d]) => d.type === "rollback"),
    ).toBe(true);
    expect(resumed.sent.find((m) => m.type === "offer").revision).toBe(2);
  });
  it("renews each authenticated recovery window without extending room expiry", async () => {
    const { ws, c, ready, status } = setup("host", true);
    const authenticate = (socket: Socket) => {
      socket.onopen?.();
      socket.emit({
        type: "ready",
        participantId: "host",
        role: "host",
        room: c.room,
        expiresAt: c.expiresAt,
        revision: 0,
        peers: ["guest"],
      });
    };
    ready(["guest"]);
    await tick();
    ws.onclose?.({ code: 1006 });
    await tick(750);
    // A failed retry increases this outage's backoff before recovery.
    Socket.instances.at(-1)!.onclose?.({ code: 1006 });
    await tick(1250);
    const recovered = Socket.instances.at(-1)!;
    authenticate(recovered);
    await tick();
    expect(status).toHaveBeenLastCalledWith("Signaling restored.");
    await tick(61_000);
    recovered.onclose?.({ code: 1006 });
    await tick(750);
    expect(Socket.instances).toHaveLength(4); // Backoff restarted at 500ms.
    const second = Socket.instances.at(-1)!;
    authenticate(second);
    await tick();
    expect(status).toHaveBeenLastCalledWith("Signaling restored.");
    await tick(c.expiresAt - Date.now() - 1);
    expect(second.readyState).toBe(1);
    await tick(1);
    expect(second.readyState).toBe(3);
    expect(status).toHaveBeenLastCalledWith(expect.stringContaining("expired"));
    second.onclose?.({ code: 1006 });
    await tick(60_000);
    expect(Socket.instances).toHaveLength(4);
  });
  it("retains the lifetime twelve-attempt cap across healthy recoveries", async () => {
    const { c, ready, status } = setup("host", true);
    ready(["guest"]);
    await tick();
    for (let attempt = 2; attempt <= 12; attempt++) {
      await tick(61_000);
      Socket.instances.at(-1)!.onclose?.({ code: 1006 });
      await tick(750);
      expect(Socket.instances).toHaveLength(attempt);
      const socket = Socket.instances.at(-1)!;
      socket.onopen?.();
      socket.emit({
        type: "ready",
        participantId: "host",
        role: "host",
        room: c.room,
        expiresAt: c.expiresAt,
        revision: 0,
        peers: ["guest"],
      });
      await tick();
      expect(status).toHaveBeenLastCalledWith("Signaling restored.");
    }
    Socket.instances.at(-1)!.onclose?.({ code: 1006 });
    await tick(60_000);
    expect(Socket.instances).toHaveLength(12);
    expect(
      Socket.instances.flatMap((s) => s.sent).filter((m) => m.type === "auth"),
    ).toHaveLength(12);
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining("fresh game"),
    );
  });
  it("rejects ready with changed expiry instead of renewing recovery", async () => {
    const { ws, c, status } = setup();
    ws.emit({
      type: "ready",
      participantId: "host",
      role: "host",
      room: c.room,
      expiresAt: c.expiresAt + 1,
      revision: 0,
      peers: [],
    });
    await tick(60_000);
    expect(ws.readyState).toBe(3);
    expect(Socket.instances).toHaveLength(1);
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining("fresh game"),
    );
  });
  it("signaling expiry, auth errors and peer signaling loss preserve healthy gameplay", async () => {
    const { ws, pc, ready, status } = setup("host", true);
    ready(["guest"]);
    await tick();
    ws.emit({
      type: "peer_disconnected",
      participantId: "guest",
      retryUntil: Date.now() + 60000,
    });
    await tick();
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining("gameplay continues"),
    );
    ws.onclose?.({ code: 4004 });
    await tick();
    expect(status).toHaveBeenLastCalledWith(
      expect.stringContaining("Gameplay continues"),
    );
    expect(pc.close).not.toHaveBeenCalled();
    expect(pc.createOffer).not.toHaveBeenCalled();
  });
  it("deduplicates peer disconnect deadlines and cancels the previous deadline on resume", async () => {
    const { ws, ready } = setup("host", true);
    ready(["guest"]);
    await tick();
    const lost = () =>
      ws.emit({
        type: "peer_disconnected",
        participantId: "guest",
        retryUntil: Date.now() + 60000,
      });
    lost();
    await tick();
    const timers = vi.getTimerCount();
    lost();
    await tick();
    expect(vi.getTimerCount()).toBe(timers);
    await tick(30000);
    ws.emit({ type: "peer_connected", participantId: "guest", revision: 0 });
    await tick();
    lost();
    await tick(31000);
    expect(ws.readyState).toBe(1);
    await tick(30000);
    expect(ws.readyState).toBe(3);
  });
  it("cancellation removes listeners and rejects late asynchronous completion", async () => {
    const { pc, ws, ready } = setup();
    let release!: (v: any) => void;
    pc.createOffer.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    ready(["guest"]);
    await tick();
    adapter?.close();
    release({ type: "offer", sdp: "v=0\n" });
    await tick(20000);
    pc.ice();
    expect(pc.setLocalDescription).not.toHaveBeenCalled();
    expect(ws.sent).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds authentication retries and stops on terminal credentials errors", async () => {
    const { ws, status } = setup();
    ws.emit({ type: "error", code: "invalid_credentials" });
    await tick(60000);
    expect(Socket.instances).toHaveLength(1);
    expect(status).toHaveBeenLastCalledWith(expect.stringContaining("access"));
    adapter?.close();
    setup();
    for (let i = 0; i < 10; i++) {
      Socket.instances.at(-1)!.onclose?.({ code: 1006 });
      await tick(6000);
    }
    expect(Socket.instances.length).toBeLessThanOrEqual(9);
  });
});
