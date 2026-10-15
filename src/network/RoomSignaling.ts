// Service v1 adapter. Credentials live only in this object's memory.
export const PRODUCTION_SIGNALING =
  "https://musou-signaling-dev.chungmin-wen.workers.dev";
export const signalingBase = () =>
  import.meta.env.VITE_SIGNALING_URL ||
  (import.meta.env.PROD ? PRODUCTION_SIGNALING : "");
export const roomCode = (value: string) => value.trim().toUpperCase();
export const validCode = (value: string) => /^[A-HJ-NP-Z2-9]{8}$/.test(value);
export function invitedRoom(hash: string) {
  const code = new URLSearchParams(hash.replace(/^#/, "")).get("room") ?? "";
  return validCode(roomCode(code)) ? roomCode(code) : "";
}
export function inviteLink(code: string, href = location.href) {
  const url = new URL(href);
  url.search = "";
  url.hash = `room=${code}`;
  return url.href;
}
export const roomError = (code: string): string =>
  ({
    room_full:
      "This room already has a guest. Ask the host to create a new game.",
    room_missing: "Room not found. Check the code or ask for a new game.",
    room_expired: "This room expired. Create a new game to connect again.",
    invalid_credentials: "Room access is no longer valid. Create a new game.",
    already_connected:
      "This participant is already connected. Create a new game if needed.",
    origin_denied:
      "This website is not allowed by the signaling service. Use the GitHub Pages game or a configured local service.",
    daily_room_limit:
      "Today's room budget is used up. Try after 00:00 UTC, or use the offline manual exchange.",
    rate_limited:
      "Too many requests. Wait at least 60 seconds before trying again.",
    connection_limit:
      "This room has reached its connection limit. Create a new game later.",
    signaling_limit:
      "This room's signaling allowance is used up. Create a new game if you need to reconnect.",
    temporarily_unavailable:
      "The signaling service is temporarily unavailable or has exhausted its platform quota. Try later, or use the offline manual exchange.",
    code_unavailable:
      "No new room code is available right now. Try again later.",
    peer_disconnected:
      "The other player's signaling disconnected. Create a fresh room if connection does not complete.",
    network:
      "Signaling could not be reached. Check your connection and allowed website origin. A lost room request cannot be retried safely; create a fresh game.",
    disabled:
      "Automatic rooms need VITE_SIGNALING_URL in development. Use the offline manual exchange below.",
    canceled: "Room request canceled.",
    timeout:
      "Signaling timed out. Create a fresh game or use the manual exchange.",
    recovery: "Negotiation was interrupted. Create a fresh game to reconnect.",
  })[code] ??
  "Signaling is unavailable or incompatible. Create a fresh game later, or use the offline manual exchange.";
const bytes = (s: string) => new TextEncoder().encode(s).length;
const exact = (o: any, keys: string[]) =>
  o &&
  typeof o === "object" &&
  !Array.isArray(o) &&
  Object.keys(o).length === keys.length &&
  keys.every((k) => Object.hasOwn(o, k));
const revision = (n: unknown, min = 0) =>
  Number.isInteger(n) && Number(n) >= min && Number(n) <= 8;
const participant = (id: unknown) => id === "host" || id === "guest";
export interface Credentials {
  v: 1;
  room: string;
  participantId: "host" | "guest";
  role: "host" | "guest";
  token: string;
  expiresAt: number;
  wsPath: string;
  inviteUrl: string;
  capacity: 2;
}
export async function requestRoom(
  base: string,
  code: string | undefined,
  signal: AbortSignal,
): Promise<Credentials> {
  if (!base) throw new Error("disabled");
  if (code !== undefined && !validCode(code)) throw new Error("room_missing");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 12_000);
  try {
    const response = await fetch(
      new URL(code ? `/v1/rooms/${code}/join` : "/v1/rooms", base),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"v":1}',
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      },
    );
    // No retry: even a lost response may have consumed the only credential.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("network");
    let raw = "",
      length = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > 4096) {
          await reader.cancel();
          throw new Error("network");
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("network");
    }
    if (!response.ok)
      throw new Error(
        data.v === 1 && typeof data.error === "string" ? data.error : "network",
      );
    if (
      !exact(data, [
        "v",
        "room",
        "participantId",
        "role",
        "token",
        "expiresAt",
        "wsPath",
        "inviteUrl",
        "capacity",
      ]) ||
      data.v !== 1 ||
      !validCode(data.room) ||
      (code && code !== data.room) ||
      data.role !== (code ? "guest" : "host") ||
      data.participantId !== data.role ||
      !/^[A-Za-z0-9_-]{43}$/.test(data.token) ||
      data.capacity !== 2 ||
      !Number.isSafeInteger(data.expiresAt) ||
      data.expiresAt <= Date.now() ||
      data.expiresAt > Date.now() + 901_000 ||
      data.wsPath !== `/v1/rooms/${data.room}/ws` ||
      typeof data.inviteUrl !== "string" ||
      data.inviteUrl !==
        `https://min-games.github.io/musou-prototype/#room=${data.room}`
    )
      throw new Error("unsupported_version");
    return data;
  } catch (error) {
    if (signal.aborted) throw new Error("canceled");
    if (controller.signal.aborted) throw new Error("timeout");
    if (error instanceof TypeError) throw new Error("network");
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
function validCandidate(c: any) {
  return (
    c === null ||
    (c &&
      typeof c === "object" &&
      !Array.isArray(c) &&
      Object.keys(c).every((k) =>
        ["candidate", "sdpMid", "sdpMLineIndex", "usernameFragment"].includes(
          k,
        ),
      ) &&
      typeof c.candidate === "string" &&
      c.candidate.length <= 2048 &&
      (!c.candidate || c.candidate.startsWith("candidate:")) &&
      (c.sdpMid == null ||
        (typeof c.sdpMid === "string" && c.sdpMid.length <= 64)) &&
      (c.sdpMLineIndex == null ||
        (Number.isInteger(c.sdpMLineIndex) &&
          c.sdpMLineIndex >= 0 &&
          c.sdpMLineIndex <= 16)) &&
      (c.usernameFragment == null ||
        (typeof c.usernameFragment === "string" &&
          c.usernameFragment.length <= 256)))
  );
}
export function parseServer(raw: unknown): any {
  if (typeof raw !== "string" || bytes(raw) > 16384)
    throw new Error("message_too_large");
  const m = JSON.parse(raw);
  if (m?.v !== 1) throw new Error("unsupported_version");
  let valid = false;
  if (m.type === "ready")
    valid =
      exact(m, [
        "v",
        "type",
        "participantId",
        "role",
        "room",
        "expiresAt",
        "revision",
        "peers",
      ]) &&
      participant(m.participantId) &&
      m.role === m.participantId &&
      validCode(m.room) &&
      Number.isSafeInteger(m.expiresAt) &&
      revision(m.revision) &&
      Array.isArray(m.peers) &&
      m.peers.length <= 1 &&
      m.peers.every((p: unknown) => participant(p) && p !== m.participantId);
  if (m.type === "peer_connected")
    valid =
      exact(m, ["v", "type", "participantId", "revision"]) &&
      participant(m.participantId) &&
      revision(m.revision);
  if (m.type === "peer_disconnected")
    valid =
      exact(m, ["v", "type", "participantId", "retryUntil"]) &&
      participant(m.participantId) &&
      Number.isSafeInteger(m.retryUntil);
  if (m.type === "error")
    valid = exact(m, ["v", "type", "code"]) && typeof m.code === "string";
  if (m.type === "offer" || m.type === "answer")
    valid =
      exact(m, ["v", "type", "from", "revision", "description"]) &&
      participant(m.from) &&
      revision(m.revision, 1) &&
      exact(m.description, ["type", "sdp"]) &&
      m.description.type === m.type &&
      typeof m.description.sdp === "string" &&
      /^v=0\r?\n/.test(m.description.sdp) &&
      bytes(m.description.sdp) <= 12000;
  if (m.type === "ice")
    valid =
      exact(m, ["v", "type", "from", "revision", "candidate"]) &&
      participant(m.from) &&
      revision(m.revision, 1) &&
      validCandidate(m.candidate);
  if (!valid) throw new Error("malformed_message");
  return m;
}

export class RoomSignaling {
  private credentials?: Credentials;
  private ws?: WebSocket;
  private stopped = false;
  private epoch = 0;
  private ready = false;
  private peer = false;
  private revision = 0;
  private localReady = false;
  private remoteReady = false;
  private localIce: (RTCIceCandidateInit | null)[] = [];
  private remoteIce: (RTCIceCandidateInit | null)[] = [];
  private chain = Promise.resolve();
  private pending = 0;
  private cancelOperations = new Set<() => void>();
  private queue: {
    text: string;
    resolve: () => void;
    reject: (e: Error) => void;
  }[] = [];
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private pumpTimer?: ReturnType<typeof setTimeout>;
  private peerTimer?: ReturnType<typeof setTimeout>;
  private nextSend = 0;
  private sent = 0;
  private volume = 0;
  private attempts = 0;
  private deadline = Infinity;
  constructor(
    private base: string,
    credentials: Credentials,
    private pc: RTCPeerConnection,
    private healthy: () => boolean,
    private status: (text: string) => void,
  ) {
    this.credentials = credentials;
    this.deadline = credentials.expiresAt;
    pc.addEventListener("icecandidate", this.onIce);
    this.later(
      () => this.fail("room_expired"),
      Math.max(0, credentials.expiresAt - Date.now()),
    );
    this.connect();
  }
  private later(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
    return timer;
  }
  private check(epoch: number) {
    if (this.stopped || epoch !== this.epoch) throw new Error("canceled");
  }
  private async operation<T>(promise: Promise<T>, epoch: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    let cancel!: () => void;
    const canceled = new Promise<never>((_, reject) => {
      cancel = () => reject(new Error("canceled"));
    });
    this.cancelOperations.add(cancel);
    try {
      const value = await Promise.race([
        promise,
        canceled,
        new Promise<never>((_, reject) => {
          timer = this.later(() => reject(new Error("timeout")), 10_000);
        }),
      ]);
      this.check(epoch);
      return value;
    } finally {
      clearTimeout(timer!);
      this.timers.delete(timer!);
      this.cancelOperations.delete(cancel);
    }
  }
  private connect() {
    if (this.stopped || !this.credentials) return;
    const epoch = ++this.epoch;
    this.ready = this.peer = this.localReady = this.remoteReady = false;
    this.localIce = [];
    this.remoteIce = [];
    let ws: WebSocket;
    try {
      const url = new URL(this.credentials.wsPath, this.base);
      url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
      ws = this.ws = new WebSocket(url.href);
    } catch {
      this.fail("network");
      return;
    }
    const timeout = this.later(() => {
      if (epoch === this.epoch && !this.ready) ws.close();
    }, 9_000);
    ws.onopen = () => {
      if (this.stopped || epoch !== this.epoch || !this.credentials) return;
      ws.send(
        JSON.stringify({
          v: 1,
          type: "auth",
          participantId: this.credentials.participantId,
          token: this.credentials.token,
        }),
      );
      this.nextSend = Math.max(this.nextSend, Date.now() + 400);
    };
    ws.onmessage = (e) => {
      if (this.stopped || epoch !== this.epoch) return;
      if (++this.pending > 64) {
        this.fail("signaling_limit");
        return;
      }
      this.chain = this.chain
        .then(async () => {
          this.check(epoch);
          await this.receive(parseServer(e.data), epoch);
        })
        .catch((e) => {
          if (!this.stopped && epoch === this.epoch) this.fail(e.message);
        })
        .finally(() => {
          this.pending--;
        });
    };
    ws.onerror = () => {
      if (epoch === this.epoch) ws.close();
    };
    ws.onclose = (e) => {
      clearTimeout(timeout);
      this.timers.delete(timeout);
      if (this.stopped || epoch !== this.epoch) return;
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      if (this.ws === ws) this.ws = undefined;
      ++this.epoch;
      for (const cancel of this.cancelOperations) cancel();
      this.rejectQueue();
      this.ready = this.localReady = false;
      if (e.code === 4004) {
        this.fail("room_expired");
        return;
      }
      if (e.code === 4000 || e.code === 1009) {
        this.fail("recovery");
        return;
      }
      this.deadline = Math.min(this.deadline, Date.now() + 60_000);
      if (++this.attempts >= 8 || Date.now() + 5500 >= this.deadline) {
        this.fail("recovery");
        return;
      }
      this.status(
        this.healthy()
          ? "Signaling interrupted; gameplay continues. Reconnecting…"
          : "Signaling interrupted. Reconnecting within the room's 60-second window…",
      );
      this.later(
        () => this.connect(),
        Math.min(5000, 500 * 2 ** (this.attempts - 1)) + Math.random() * 250,
      );
    };
  }
  private clearPeerTimer() {
    if (this.peerTimer) {
      clearTimeout(this.peerTimer);
      this.timers.delete(this.peerTimer);
      this.peerTimer = undefined;
    }
  }
  private rejectQueue() {
    for (const item of this.queue) item.reject(new Error("canceled"));
    this.queue = [];
    if (this.pumpTimer) {
      clearTimeout(this.pumpTimer);
      this.timers.delete(this.pumpTimer);
      this.pumpTimer = undefined;
    }
  }
  private send(type: string, payload: object) {
    if (!this.ready || !this.peer || this.stopped || this.queue.length >= 64)
      return Promise.reject(new Error("recovery"));
    const text = JSON.stringify({
      v: 1,
      type,
      to: this.credentials!.role === "host" ? "guest" : "host",
      revision: this.revision,
      ...payload,
    });
    const size = bytes(text);
    if (size > 16384 || ++this.sent > 256 || (this.volume += size) > 128 * 1024)
      return Promise.reject(new Error("signaling_limit"));
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ text, resolve, reject });
      this.pump();
    });
  }
  private pump() {
    if (this.pumpTimer || !this.queue.length || this.stopped) return;
    this.pumpTimer = this.later(
      () => {
        this.pumpTimer = undefined;
        const item = this.queue.shift();
        if (!item) return;
        if (this.ws?.readyState !== WebSocket.OPEN) {
          item.reject(new Error("network"));
          return;
        }
        try {
          this.ws.send(item.text);
          item.resolve();
        } catch {
          item.reject(new Error("network"));
        }
        this.nextSend = Date.now() + 400; // <=26 frames in any 10 seconds, including authentication.
        this.pump();
      },
      Math.max(0, this.nextSend - Date.now()),
    );
  }
  private onIce = (e: RTCPeerConnectionIceEvent) => {
    if (this.stopped || !this.ready || !this.peer) return;
    const c = e.candidate?.toJSON() ?? null;
    if (!validCandidate(c)) {
      this.fail("malformed_message");
      return;
    }
    if (!this.localReady) {
      if (this.localIce.length >= 64) this.fail("signaling_limit");
      else this.localIce.push(c);
    } else
      void this.send("ice", { candidate: c }).catch((e) => {
        if (!this.stopped && e.message !== "canceled") this.fail(e.message);
      });
  };
  private async local(description: RTCSessionDescriptionInit, epoch: number) {
    this.localReady = false;
    this.localIce = [];
    await this.operation(this.pc.setLocalDescription(description), epoch);
    const sdp = this.pc.localDescription!;
    if (!sdp.sdp || bytes(sdp.sdp) > 12000)
      throw new Error("message_too_large");
    await this.operation(
      this.send(sdp.type, { description: { type: sdp.type, sdp: sdp.sdp } }),
      epoch,
    );
    this.localReady = true;
    for (const candidate of this.localIce)
      void this.send("ice", { candidate }).catch((e) => {
        if (!this.stopped && e.message !== "canceled") this.fail(e.message);
      });
    this.localIce = [];
  }
  private async offer(epoch: number) {
    if (this.healthy()) return;
    if (this.revision >= 8) throw new Error("signaling_limit");
    if (this.pc.signalingState === "have-local-offer")
      await this.operation(
        this.pc.setLocalDescription({ type: "rollback" }),
        epoch,
      );
    if (this.pc.signalingState !== "stable") throw new Error("recovery");
    this.revision++;
    this.remoteReady = false;
    this.remoteIce = [];
    await this.local(
      await this.operation(this.pc.createOffer({ iceRestart: true }), epoch),
      epoch,
    );
    this.status("Connecting players…");
  }
  private async receive(m: any, epoch: number) {
    const c = this.credentials!;
    const other = c.role === "host" ? "guest" : "host";
    if (m.type === "error") throw new Error(m.code);
    if (m.type === "ready") {
      if (
        m.participantId !== c.participantId ||
        m.room !== c.room ||
        m.expiresAt !== c.expiresAt ||
        m.revision < this.revision - 1
      )
        throw new Error("invalid_revision");
      if (this.ready) {
        if (m.revision > this.revision) throw new Error("invalid_revision");
        return; // Duplicate notifications must not produce duplicate offers.
      }
      this.ready = true;
      this.revision = m.revision;
      this.peer = m.peers.includes(other);
      if (this.peer) this.clearPeerTimer();
      this.status(
        this.healthy()
          ? "Signaling restored."
          : this.peer
            ? "Peer ready. Connecting…"
            : "Room ready. Share the code or invite link; waiting for player…",
      );
      if (this.peer && c.role === "host") await this.offer(epoch);
      return;
    }
    if (!this.ready) throw new Error("invalid_credentials");
    if (m.type === "peer_connected") {
      if (
        m.participantId !== other ||
        m.revision < this.revision - 1 ||
        m.revision > this.revision
      )
        throw new Error("invalid_revision");
      if (this.peer) return;
      this.peer = true;
      this.clearPeerTimer();
      this.revision = m.revision;
      if (c.role === "host") await this.offer(epoch);
    } else if (m.type === "peer_disconnected") {
      if (m.participantId !== other) throw new Error("malformed_message");
      if (!this.peer) return;
      this.peer = false;
      this.localReady = false;
      this.rejectQueue();
      this.localIce = [];
      this.remoteIce = [];
      this.status(
        this.healthy()
          ? "Peer signaling disconnected; gameplay continues."
          : "Peer signaling disconnected. Waiting up to 60 seconds; ask for a fresh room if needed.",
      );
      this.peerTimer = this.later(
        () => {
          if (!this.peer) this.fail("room_expired");
        },
        Math.max(0, Math.min(60_000, m.retryUntil - Date.now())),
      );
    } else {
      if (m.from !== other || !this.peer) throw new Error("role_violation");
      if (m.type === "offer") {
        if (c.role !== "guest" || m.revision !== this.revision + 1)
          throw new Error("invalid_revision");
        this.revision = m.revision;
        this.remoteReady = false;
        this.remoteIce = [];
      } else if (m.revision !== this.revision)
        throw new Error("invalid_revision");
      if (m.type === "offer" || m.type === "answer") {
        if (
          m.type === "answer" &&
          (c.role !== "host" || this.pc.signalingState !== "have-local-offer")
        )
          throw new Error("invalid_revision");
        await this.operation(
          this.pc.setRemoteDescription(m.description),
          epoch,
        );
        this.remoteReady = true;
        for (const candidate of this.remoteIce)
          await this.operation(
            this.pc.addIceCandidate(candidate ?? undefined),
            epoch,
          );
        this.remoteIce = [];
        if (m.type === "offer")
          await this.local(
            await this.operation(this.pc.createAnswer(), epoch),
            epoch,
          );
      } else if (m.type === "ice") {
        if (!this.remoteReady) {
          if (this.remoteIce.length >= 64) throw new Error("signaling_limit");
          this.remoteIce.push(m.candidate);
        } else
          await this.operation(
            this.pc.addIceCandidate(m.candidate ?? undefined),
            epoch,
          );
      }
    }
  }
  private fail(code: string) {
    if (this.stopped) return;
    this.status(
      `${roomError(code)}${this.healthy() ? " Gameplay continues while the peer connection is healthy." : ""}`,
    );
    this.close(); // Deliberately never closes the RTCPeerConnection.
  }
  close() {
    if (this.stopped) return;
    this.stopped = true;
    ++this.epoch;
    for (const cancel of this.cancelOperations) cancel();
    this.cancelOperations.clear();
    this.rejectQueue();
    this.pc.removeEventListener("icecandidate", this.onIce);
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (this.ws) {
      this.ws.onopen =
        this.ws.onmessage =
        this.ws.onclose =
        this.ws.onerror =
          null;
      this.ws.close();
    }
    this.ws = undefined;
    this.credentials = undefined;
    this.localIce = [];
    this.remoteIce = [];
  }
}
