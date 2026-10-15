# LAN multiplayer architecture

## Existing architecture (inspection before implementation)

Vite/TypeScript static application with Babylon rendering (`BabylonRenderer`), no ECS or physics engine. `GameLoop` accumulates browser time into 60 Hz steps, capped at 250 ms. `InputManager` already produces independent input frames. `Simulation` owns one Player, EnemyStore, spatial grid, CombatSystem and CrowdSystem. CombatSystem keeps per-attacker hit sets and projectiles. Enemies already have numeric stable IDs within an arena; respawns reuse those IDs. CrowdSystem previously targeted only the primary player. Renderer previously drew one hero. RunDirector manages the single-player five-wave campaign, drops and upgrades; practice runs Simulation directly. No persistent save state exists. Deployment is static Vite output with relative URLs and a precaching service worker. Vitest covers simulation and Playwright covers gameplay/rendering.

## Integration points and minimal changes

Keep the fixed loop, input frames, enemy store, combat, rendering assets and single-player campaign. Add a map of remote players with independent existing CombatSystem instances (hit deduplication must be per attacker). Advance AI/spawning once per world step; choose the closest living player as the AI target. Extract existing player advancement so all owners use identical mechanics. Render additional heroes using the existing hero hierarchy and animation routine. LAN initially uses endless practice combat with the existing 20 opponents; campaign upgrades remain single-player. Host and guest use the host's current fighter/loadout at session start.

Native WebRTCTransport and ManualSignaling are separate from HostSession, ClientSession and StateReplicator. Host owns peer-to-player assignment; inputs never select their own identity. The star transport can be extended to additional peer slots, while the MVP UI admits one guest.

## Authority

Single-player and host execute Simulation. Only host advances AI, respawns, hit tests, projectiles, health and deaths. Client sends bounded input commands at 30 Hz and applies complete snapshots at 15 Hz. Snapshot IDs are scoped to a session. Player IDs remain stable until disconnect; enemy IDs remain stable throughout endless respawns. Full snapshots make membership/removal idempotent. Reliable events carry assignment and ping/pong, not damage, so repeated events cannot duplicate combat. Client renders interpolated authoritative transforms without running combat. Prediction is deferred to avoid incorrect dash/knockback reconciliation.

## Risks and limits

No STUN/TURN/discovery/signaling service; complete SDP is exchanged manually. Host ICE candidates may be blocked by Wi-Fi isolation, firewall, VPN, mDNS restrictions or browser policy. A connection failure requires a fresh manual exchange. Static hosting works; HTTPS is recommended (required for PWA/clipboard on most devices). Host backgrounding pauses gameplay; no host migration. Host loss freezes client. Guest loss removes their entity and host continues. LAN mode is endless arena only; no campaign progression or in-session loadout changes. No rollback or reconnect persistence. Full snapshots have bounded size and queue pressure limits; larger crowds require measurements before relevance filtering or binary serialization. Same-machine browser tests do not establish physical LAN compatibility.

## Protocol and operation

`src/network` contains transport/signaling, sessions, replication and a compact LAN menu. JSON protocol version 1 uses bounded input x/z, boolean action edges, monotonically increasing input and snapshot sequences, simulation ticks and last input acknowledgement. Three host-created channels: `input` and `state` unordered with zero retransmits, `events` ordered/reliable. Input is sampled at 60 Hz, accumulated across two steps and transmitted at 30 Hz; host rejects older sequences and stops stale remote motion after 250 ms. Snapshots at 15 Hz contain all players, enemies, projectile presentation, health, weapon/combat animation timers and ownership IDs. A joining guest receives a complete snapshot. Membership is replaced idempotently. Clients smooth transforms with a time-based exponential interpolation; health/death apply immediately. Reliable assignment messages are idempotent. Combat itself is never repeated from network events. Message limit is 60,000 characters, buffered channel threshold 128,000 bytes; oversized or congested sends are dropped. Counters are shown in optional diagnostics, with ICE candidate types, RTC byte totals and RTT when available. No traffic serialization occurs in the render loop.

LAN selects an endless 20-enemy arena and retains the host's selected fighter and weapon (default Vanguard/Saber when hosting from the initial screen). Guest receives the same base loadout; neither inherits campaign relics. Both fighters can use normal attacks, specials, dodge and their starting bomb. R / gamepad Y revives only the requesting fallen fighter, on host authority. Host cannot reset the whole world through a guest input. New run and benchmarks are disabled during LAN play. Single Player closes connections, clears input/players, resets simulation and restores the normal campaign selection (or practice arena when using the practice URL). Pause/background suspension can cause the peer heartbeat to expire after 12 simulation seconds; repeat signaling after a long suspension.

## Replication measurements

Measured on this development runner, Node 24, 2,000 snapshot captures and JSON serializations, two players, existing idle enemy state (no projectiles):

| Enemies | Mean capture + encode | Mean snapshot | Payload at 15 Hz / guest |
| --- | --- | --- | --- |
| 20 (LAN default) | 0.028 ms | 4,616 bytes | 69.2 KB/s |
| 40 (largest campaign wave) | 0.035 ms | 8,070 bytes | 121.0 KB/s |

These are CPU microbenchmarks and ASCII JSON payload counts, excluding SCTP/DTLS/IP overhead. Moving entities produce longer decimal coordinates; projectiles and actions increase payload size. The native browser integration test observed an actual connected peer and 139,876 application bytes sent / 9,799 received on the host during its short movement/combat scenario; these totals are workload dependent, not a bandwidth guarantee. Run `npx vitest run tests/multiplayer.test.ts --reporter=verbose --disableConsoleIntercept` to reproduce serialization measurements. No claim is made for 300-enemy network play; relevance filtering and adaptive rates are deferred because current arena payloads fit comfortably within the limits.

The first browser pipeline measurement (1,000 iterations each, native Chromium, same idle two-player fixture) measured capture + JSON encode/decode + validation + snapshot application + one interpolation step at **0.070 ms for 20 enemies** and **0.092 ms for 40 enemies**. Raw results and timestamps are in [multiplayer-overhead.json](../evidence/multiplayer-overhead.json). These numbers exclude rendering, SCTP/DTLS framing and network scheduling, and vary by machine; the browser test regenerates them.
