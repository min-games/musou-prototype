# LAN multiplayer testing

## Two physical devices — UNVERIFIED

Physical Wi-Fi/LAN testing has not been performed by this implementation run. Automated same-machine Chromium contexts establish actual native WebRTC but do not verify router, firewall, mobile browser or cross-device compatibility.

1. Open the same deployed build on two computers on the same home Wi-Fi. Use a trusted HTTPS static host for PWA/clipboard support; no game/signaling service is needed. Both devices must have loaded/cached the app before going offline. Avoid guest Wi-Fi/client isolation and VPNs.
2. Optionally choose a fighter and weapon in single-player first. Open **LAN Multiplayer** on each device. Host selects **Host LAN Game**. Wait for the complete offer, then **Copy Offer**. Clipboard failures select the code for manual copying.
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
