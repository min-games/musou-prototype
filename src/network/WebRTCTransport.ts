export type Channel = "input" | "state" | "events";
export const MAX_MESSAGE = 60_000;
export class ManualSignaling {
  static encode(description: RTCSessionDescriptionInit) {
    return JSON.stringify({
      version: 1,
      type: description.type,
      sdp: description.sdp,
    });
  }
  static decode(
    text: string,
    type: "offer" | "answer",
  ): RTCSessionDescriptionInit {
    if (text.length > 100_000) throw new Error("Signaling payload too large");
    const value = JSON.parse(text);
    if (
      value?.version !== 1 ||
      value.type !== type ||
      typeof value.sdp !== "string" ||
      !value.sdp.startsWith("v=0") ||
      value.sdp.length > 95_000
    )
      throw new Error(`Paste a complete version 1 ${type}`);
    return { type, sdp: value.sdp };
  }
}
export class WebRTCTransport {
  readonly pc: RTCPeerConnection;
  channels = new Map<Channel, RTCDataChannel>();
  onmessage: (channel: Channel, value: unknown) => void = () => {};
  onopen = () => {};
  onclose: (reason: string) => void = () => {};
  opened = false;
  closed = false;
  dropped = 0;
  sentBytes = 0;
  receivedBytes = 0;
  diagnostics: Record<string, unknown> = {};
  private timer = setTimeout(
    () =>
      this.fail(
        "Connection timed out. Check Wi-Fi isolation/firewall and repeat manual signaling.",
      ),
    120_000,
  );
  constructor(host: boolean, automatic = false) {
    this.pc = new RTCPeerConnection({
      iceServers: automatic ? [{ urls: "stun:stun.cloudflare.com:3478" }] : [],
      iceTransportPolicy: "all",
    });
    this.pc.onconnectionstatechange = () => {
      if (
        ["failed", "disconnected", "closed"].includes(this.pc.connectionState)
      )
        this.fail("Peer disconnected. Repeat manual signaling to reconnect.");
    };
    this.pc.ondatachannel = (e) => this.attach(e.channel);
    if (host) {
      this.attach(
        this.pc.createDataChannel("input", {
          ordered: false,
          maxRetransmits: 0,
        }),
      );
      this.attach(
        this.pc.createDataChannel("state", {
          ordered: false,
          maxRetransmits: 0,
        }),
      );
      this.attach(this.pc.createDataChannel("events", { ordered: true }));
    }
  }
  private attach(channel: RTCDataChannel) {
    const label = channel.label as Channel;
    if (
      !["input", "state", "events"].includes(label) ||
      this.channels.has(label)
    ) {
      channel.close();
      return;
    }
    this.channels.set(label, channel);
    channel.onopen = () => {
      if (
        this.channels.size === 3 &&
        [...this.channels.values()].every((c) => c.readyState === "open") &&
        !this.opened
      ) {
        this.opened = true;
        clearTimeout(this.timer);
        this.onopen();
      }
    };
    channel.onclose = () =>
      this.fail("Data channel closed. Repeat manual signaling.");
    channel.onerror = () =>
      this.fail("Data channel error. Repeat manual signaling.");
    channel.onmessage = (e) => {
      if (typeof e.data !== "string" || e.data.length > MAX_MESSAGE) {
        this.dropped++;
        return;
      }
      this.receivedBytes += e.data.length;
      try {
        this.onmessage(label, JSON.parse(e.data));
      } catch {
        this.dropped++;
      }
    };
  }
  send(channel: Channel, value: unknown) {
    const c = this.channels.get(channel),
      data = JSON.stringify(value);
    if (
      !c ||
      c.readyState !== "open" ||
      data.length > MAX_MESSAGE ||
      c.bufferedAmount > 128_000
    ) {
      this.dropped++;
      return false;
    }
    try {
      c.send(data);
      this.sentBytes += data.length;
      return true;
    } catch {
      this.dropped++;
      return false;
    }
  }
  private cancelGather?: () => void;
  private async gather() {
    if (this.pc.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        this.cancelGather = undefined;
        this.pc.removeEventListener("icegatheringstatechange", changed);
      };
      const changed = () => {
        if (this.pc.iceGatheringState === "complete") {
          cleanup();
          resolve();
        }
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("ICE gathering timed out. Try again."));
      }, 15_000);
      this.cancelGather = () => {
        cleanup();
        reject(new Error("Signaling canceled. Start a new manual exchange."));
      };
      this.pc.addEventListener("icegatheringstatechange", changed);
      changed();
    });
  }
  async offer() {
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.gather();
    return ManualSignaling.encode(this.pc.localDescription!);
  }
  async answer(offer: string) {
    await this.pc.setRemoteDescription(ManualSignaling.decode(offer, "offer"));
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.gather();
    return ManualSignaling.encode(this.pc.localDescription!);
  }
  async accept(answer: string) {
    await this.pc.setRemoteDescription(
      ManualSignaling.decode(answer, "answer"),
    );
  }
  async stats() {
    const stats = await this.pc.getStats();
    const entries = new Map<string, any>();
    stats.forEach((s) => entries.set(s.id, s));
    stats.forEach((s) => {
      if (s.type === "candidate-pair" && s.state === "succeeded" && s.nominated)
        this.diagnostics = {
          rttMs: s.currentRoundTripTime * 1000,
          bytesSent: s.bytesSent,
          bytesReceived: s.bytesReceived,
          local: entries.get(s.localCandidateId)?.candidateType,
          remote: entries.get(s.remoteCandidateId)?.candidateType,
        };
    });
  }
  private fail(reason: string) {
    if (!this.closed) {
      this.close();
      this.onclose(reason);
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.cancelGather?.();
    clearTimeout(this.timer);
    this.pc.onconnectionstatechange = null;
    this.pc.ondatachannel = null;
    for (const c of this.channels.values()) {
      c.onclose = null;
      c.onmessage = null;
      c.onopen = null;
      c.onerror = null;
      c.close();
    }
    this.channels.clear();
    this.pc.close();
  }
}
