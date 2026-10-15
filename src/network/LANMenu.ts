import type { Simulation, InputFrame } from "../GameLoop";
import {
  ClientSession,
  HostSession,
  type MultiplayerSession,
} from "./MultiplayerSession";
export class LANMenu {
  session?: MultiplayerSession;
  private generation = 0;
  private panel: HTMLElement;
  private status: HTMLElement;
  private code: HTMLTextAreaElement;
  private output: HTMLTextAreaElement;
  private diagnostics: HTMLElement;
  private error = "";
  private metricsAt = performance.now();
  private previousSnapshots = 0;
  private snapshotHz = 0;
  constructor(
    private sim: Simulation,
    private enter: () => void,
    private leave: () => void,
  ) {
    this.panel = document.createElement("details");
    this.panel.id = "lan-menu";
    this.panel.addEventListener("keydown", (e) => e.stopPropagation());
    this.panel.innerHTML = `<summary>LAN Multiplayer</summary><p>Two-player endless arena · same Wi-Fi. Exchange codes privately. Wi-Fi isolation or firewalls may block connections. Reconnect by repeating this exchange.</p><div class="lan-actions"><button id="lan-single">Single Player</button><button id="lan-host">Host LAN Game</button><button id="lan-join">Join LAN Game</button><button id="lan-disconnect">Disconnect</button></div><label>Paste Offer / Answer<textarea id="lan-code" aria-label="Paste Offer / Answer" spellcheck="false"></textarea></label><div class="lan-actions"><button id="lan-offer">Paste Offer · Generate Answer</button><button id="lan-answer">Paste Answer · Connect</button></div><label>Your complete code<textarea id="lan-output" aria-label="Your complete code" readonly></textarea></label><div class="lan-actions"><button id="lan-copy-offer">Copy Offer</button><button id="lan-copy-answer">Copy Answer</button></div><p id="lan-status" role="status"></p><details><summary>Network diagnostics</summary><pre id="lan-diagnostics"></pre></details>`;
    document.body.append(this.panel);
    this.status = this.panel.querySelector("#lan-status")!;
    this.code = this.panel.querySelector("#lan-code")!;
    this.output = this.panel.querySelector("#lan-output")!;
    this.diagnostics = this.panel.querySelector("#lan-diagnostics")!;
    const bind = (id: string, action: () => void | Promise<void>) =>
      ((this.panel.querySelector(`#${id}`) as HTMLButtonElement).onclick =
        () => {
          this.error = "";
          const report = (e: unknown) => {
            this.error = e instanceof Error ? e.message : String(e);
            this.refresh();
          };
          try {
            const result = action();
            const generation = this.generation;
            void Promise.resolve(result).catch((e) => {
              if (generation === this.generation) report(e);
            });
          } catch (e) {
            report(e);
          }
        });
    bind("lan-host", async () => {
      const s = this.start("host"),
        generation = this.generation;
      this.output.value = "";
      s.status = "Gathering complete Offer…";
      const offer = await s.transport.offer();
      if (generation !== this.generation) return;
      this.output.value = offer;
      s.status = "Copy Offer to guest, then paste their Answer and Connect.";
    });
    bind("lan-join", () => {
      this.start("client");
      this.output.value = "";
    });
    bind("lan-offer", async () => {
      if (!(this.session instanceof ClientSession))
        throw new Error("Select Join LAN Game first");
      const s = this.session,
        generation = this.generation;
      s.status = "Gathering complete Answer…";
      const answer = await s.transport.answer(this.code.value);
      if (generation !== this.generation) return;
      this.output.value = answer;
      s.status = "Copy Answer to host. Waiting for host connection…";
    });
    bind("lan-answer", async () => {
      if (!(this.session instanceof HostSession))
        throw new Error("Select Host LAN Game first");
      const session = this.session;
      await session.transport.accept(this.code.value);
      if (session === this.session && !session.connected)
        session.status = "Connecting…";
    });
    for (const id of ["lan-copy-offer", "lan-copy-answer"])
      bind(id, async () => {
        if (!this.output.value) throw new Error("Generate a code first");
        try {
          await navigator.clipboard.writeText(this.output.value);
        } catch {
          this.output.focus();
          this.output.select();
          throw new Error(
            "Clipboard unavailable. Copy the selected code manually.",
          );
        }
      });
    bind("lan-disconnect", () => {
      this.session?.close();
      this.generation++;
      this.code.value = "";
      this.output.value = "";
    });
    bind("lan-single", () => {
      this.session?.close();
      this.session = undefined;
      this.generation++;
      this.code.value = "";
      this.output.value = "";
      this.leave();
    });
    window.addEventListener("pagehide", () => this.session?.close());
    this.refresh();
  }
  private start(role: "host" | "client") {
    this.session?.close();
    this.generation++;
    this.metricsAt = performance.now();
    this.previousSnapshots = 0;
    this.snapshotHz = 0;
    this.enter();
    this.session =
      role === "host" ? new HostSession(this.sim) : new ClientSession(this.sim);
    return this.session;
  }
  step(input: InputFrame, dt: number) {
    this.session?.step(input, dt);
  }
  refresh() {
    const s = this.session;
    const now = performance.now();
    if (s && now - this.metricsAt >= 1000) {
      this.snapshotHz =
        ((s.snapshotCount - this.previousSnapshots) * 1000) /
        (now - this.metricsAt);
      this.previousSnapshots = s.snapshotCount;
      this.metricsAt = now;
    }
    this.status.textContent =
      this.error ||
      (s
        ? `${s.role} · ${s.status} · ${s.connected ? this.sim.remotePlayers.size + 1 : 1} players · RTT ${s.rtt.toFixed(0)} ms`
        : "Single Player");
    if (s && (this.diagnostics.parentElement as HTMLDetailsElement).open)
      this.diagnostics.textContent = JSON.stringify(
        {
          connection: s.transport.pc.connectionState,
          ice: s.transport.pc.iceConnectionState,
          ...s.transport.diagnostics,
          sentBytes: s.transport.sentBytes,
          receivedBytes: s.transport.receivedBytes,
          dropped: s.transport.dropped,
          snapshots: s.replicator.applied,
          outdated: s.replicator.dropped,
          snapshotHzTarget: 15,
          snapshotHzMeasured: this.snapshotHz,
          buffered: [...s.transport.channels].map(([name, c]) => ({
            name,
            bytes: c.bufferedAmount,
          })),
        },
        null,
        2,
      );
  }
}
