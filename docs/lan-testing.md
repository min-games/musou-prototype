# Room and offline LAN testing

## Automatic rooms on two devices — UNVERIFIED physically

Use the GitHub Pages build (after parent review/deployment) on both devices. Select **Multiplayer → Create Game**, copy the invite link or room code, open it on the second device and explicitly select **Join Game**. Check both show Connected, then run movement/combat/disconnect checks below. Opening a link must not make a room request. Only codes/links may be shared; never record room response bodies or auth frames. Room expiry or a signaling outage must show a warning while an established healthy game continues. A guest slot cannot be replaced: make a new room for a new guest. Some networks cannot establish direct WebRTC; TURN is disabled.

The public service permits only the exact GitHub Pages Origin. For local development explicitly set `VITE_SIGNALING_URL` to a local service whose allowed origins include the exact Vite Origin/port. No infrastructure changes are part of this candidate.

## Two physical devices: offline manual exchange — UNVERIFIED

Physical Wi-Fi/LAN testing has not been performed by this implementation run. Automated same-machine Chromium contexts establish actual native WebRTC but do not verify router, firewall, mobile browser or cross-device compatibility.

1. Open the same deployed build on two computers on the same home Wi-Fi. Use a trusted HTTPS static host for PWA/clipboard support; no game/signaling service is needed. Both devices must have loaded/cached the app before going offline. Avoid guest Wi-Fi/client isolation and VPNs.
2. Optionally choose a fighter and weapon in single-player first. Open **Multiplayer → Advanced · offline manual exchange** on each device. Host selects **Host LAN Game**. Wait for the complete offer, then **Copy Offer**. Clipboard failures select the code for manual copying.
3. Transfer the code by any private means. Guest selects **Join LAN Game**, pastes it into **Paste Offer / Answer**, then selects **Paste Offer · Generate Answer**. Wait for the complete answer, **Copy Answer** and transfer it back.
4. Host pastes the answer and selects **Paste Answer · Connect**. Both should show **Connected**, their role, two players and RTT. Collapse the menu and click the battlefield to play. WASD / J / Q / Shift / F and existing gamepad controls apply. R / Y revives a fallen fighter.
5. Move both fighters independently, confirm each sees the other and the same enemies. Attack one enemy from each device; compare enemy health/death and each fighter's kill credit. Test specials, bombs, dodge, health loss and enemy respawns. Guest actions must affect only their own fighter. Try Ranger as host for shared projectile presentation.
6. Open diagnostics. Record browser/OS, router, ICE state/candidate pair, RTT, bytes, buffered amount and snapshot counters. Repeat on different browser frame rates and with reduced motion.
7. Guest selects **Disconnect**: guest freezes; host loses guest entity and continues fighting. Start a fresh manual exchange to reconnect. Host disconnects or closes its browser: guest freezes and reports an error. No migration exists.
8. Select **Single Player** on each: no remote characters remain, normal campaign selection/practice resumes. Start a run and verify movement, combat, menus and pause.
9. Try an invalid/truncated code and a mismatched Offer/Answer. An error should appear. Try an unreachable peer: a timeout should appear. Starting Host/Join again discards the previous connection. No connectivity is promised on isolated networks; this MVP intentionally has no relay fallback.

## Automated verification

`npm test` covers signaling validation, channel options/backpressure, ownership, input ordering/staleness, host combat, client non-authority, enemy/membership replication, stale snapshots, duplicate assignment, cleanup and replication serialization overhead.

`npm run build` checks TypeScript, static deployment and service-worker precaching.

`npm run test:e2e` includes `e2e/multiplayer.spec.ts`: two separate browser contexts exchange full native SDP through UI textareas, establish real DataChannels, move both fighters with keyboards, attack an existing enemy from the guest and verify host-authoritative death/kill replication, then test disconnect and Single Player cleanup. No mock transport, SDP candidate injection, STUN or TURN is used. The runner's restricted network sandbox prevented Chromium from gathering ICE candidates; the successful native test required execution with local UDP permitted outside that sandbox. The browser/game configuration was unchanged.


`e2e/rooms.spec.ts` uses an ephemeral local HTTP/WebSocket fixture on port 5190, exact v1 auth/envelopes, revisions, rate/volume checks and no production room creation. It drives Create/Join through the UI in independent native Chromium contexts, tests invite prefill, guest movement and authoritative combat, then expires signaling before gameplay assertions to prove channels remain healthy. Additional checks cover failure messages, cancellation/Single Player and desktop/narrow layouts. `tests/signaling.test.ts` checks schema/auth/order/retry/cancel/limits independently of native ICE. The fixture models the wire contract; it does not claim to re-test Cloudflare Durable Object persistence, Origin infrastructure or quota accounting.

## Opt-in live production test (never normal CI)

The deployed service has only **50 room attempts per UTC day**, shared with infrastructure checks. At most **two deliberate live invocations per validation session**, with no automated retry. A lost create/join response may consume the only credential. Check the shared budget before invoking again.

```sh
npm run build
MUSOU_LIVE_SIGNALING=1 node scripts/live-signaling.mjs
```

The script creates at most one room. Playwright fulfills only `https://min-games.github.io/**` game HTML/assets from local `dist/`, retaining the actual browser Origin `https://min-games.github.io`; real service HTTPS/WSS requests are untouched. It checks Create/Join, three native DataChannels and guest movement. Service workers are blocked to avoid loading cached deployed assets. No tokens or wire payloads are logged. Run with network/native ICE permitted. This validates a **local candidate under production Origin**, not a deployed game build, physical LAN, diverse NAT traversal, or mobile compatibility. See [candidate validation](../evidence/signaling-validation.md) for the actual result.
