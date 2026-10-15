// Local-only contract fixture; never connects to Cloudflare or stores credentials on disk.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { parseServer } from "../src/network/RoomSignaling";
interface Room {
  code: string;
  expiresAt: number;
  revision: number;
  answered: boolean;
  tokens: Record<string, string>;
  sockets: Map<string, WebSocket>;
  counts: Record<string, { frames: number[]; signals: number; bytes: number }>;
}
export async function signalingFixture() {
  const rooms = new Map<string, Room>();
  const errors: string[] = [];
  const requests: string[] = [];
  const wsServer = new WebSocketServer({ noServer: true, maxPayload: 16384 });
  const http = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5187");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return;
    }
    requests.push(req.url!);
    const fail = (status: number, error: string) => {
      res
        .writeHead(status, { "Content-Type": "application/json" })
        .end(JSON.stringify({ v: 1, error }));
    };
    if (req.headers.origin !== "http://127.0.0.1:5187") {
      fail(403, "origin_denied");
      return;
    }
    if (
      req.method !== "POST" ||
      req.headers["content-type"] !== "application/json"
    ) {
      fail(400, "malformed_message");
      return;
    }
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 1024) break;
    }
    if (body !== '{"v":1}') {
      fail(400, "malformed_message");
      return;
    }
    let room: Room, role: string;
    if (req.url === "/v1/rooms") {
      const code = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const id = Array.from(randomBytes(8), (n) => code[n % 32]).join("");
      room = {
        code: id,
        expiresAt: Date.now() + 900_000,
        revision: 0,
        answered: false,
        tokens: { host: randomBytes(32).toString("base64url") },
        sockets: new Map(),
        counts: {},
      };
      rooms.set(id, room);
      role = "host";
    } else {
      const code = /^\/v1\/rooms\/([A-Z2-9]{8})\/join$/.exec(
        req.url ?? "",
      )?.[1];
      const found = code && rooms.get(code);
      if (!found) {
        fail(404, "room_missing");
        return;
      }
      room = found;
      if (room.tokens.guest) {
        fail(409, "room_full");
        return;
      }
      room.tokens.guest = randomBytes(32).toString("base64url");
      role = "guest";
    }
    res
      .writeHead(201, { "Content-Type": "application/json" })
      .end(
        JSON.stringify({
          v: 1,
          room: room.code,
          participantId: role,
          role,
          token: room.tokens[role],
          expiresAt: room.expiresAt,
          wsPath: `/v1/rooms/${room.code}/ws`,
          inviteUrl: `https://min-games.github.io/musou-prototype/#room=${room.code}`,
          capacity: 2,
        }),
      );
  });
  http.on("upgrade", (req, socket, head) => {
    const code = /^\/v1\/rooms\/([A-Z2-9]{8})\/ws$/.exec(req.url ?? "")?.[1];
    const room = code && rooms.get(code);
    if (!room || req.headers.origin !== "http://127.0.0.1:5187") {
      socket.destroy();
      return;
    }
    wsServer.handleUpgrade(req, socket, head, (ws) => {
      let id = "";
      const send = (target: WebSocket, data: object) =>
        target.send(JSON.stringify({ v: 1, ...data }));
      const fail = (code: string) => {
        errors.push(code);
        send(ws, { type: "error", code });
        ws.close(4000);
      };
      const authTimeout = setTimeout(() => fail("auth_timeout"), 10_000);
      ws.on("message", (raw, binary) => {
        try {
          if (binary) throw Error("malformed_message");
          const m = JSON.parse(raw.toString());
          const keys = (list: string[]) =>
            Object.keys(m).sort().join() === list.sort().join();
          if (m.v !== 1) throw Error("unsupported_version");
          if (!id) {
            if (
              !keys(["v", "type", "participantId", "token"]) ||
              m.type !== "auth" ||
              !room.tokens[m.participantId] ||
              room.tokens[m.participantId] !== m.token
            )
              throw Error("invalid_credentials");
            if (room.sockets.has(m.participantId))
              throw Error("already_connected");
            clearTimeout(authTimeout);
            id = m.participantId;
            room.sockets.set(id, ws);
            room.counts[id] ??= { frames: [], signals: 0, bytes: 0 };
            send(ws, {
              type: "ready",
              participantId: id,
              role: id,
              room: room.code,
              expiresAt: room.expiresAt,
              revision: room.revision,
              peers: [...room.sockets.keys()].filter((p) => p !== id),
            });
            for (const [peer, socket] of room.sockets)
              if (peer !== id)
                send(socket, {
                  type: "peer_connected",
                  participantId: id,
                  revision: room.revision,
                });
            return;
          }
          const count = room.counts[id]!;
          count.frames = count.frames.filter((t) => Date.now() - t < 10_000);
          count.frames.push(Date.now());
          if (count.frames.length > 29) throw Error("rate_limited");
          if (
            ++count.signals > 256 ||
            (count.bytes += Buffer.byteLength(raw.toString())) > 131072
          )
            throw Error("signaling_limit");
          const payload = m.type === "ice" ? "candidate" : "description";
          if (!keys(["v", "type", "to", "revision", payload]))
            throw Error("malformed_message");
          if (m.to !== (id === "host" ? "guest" : "host"))
            throw Error("role_violation");
          const target = room.sockets.get(m.to);
          if (!target) throw Error("peer_disconnected");
          const forwarded = {
            v: 1,
            type: m.type,
            from: id,
            revision: m.revision,
            [payload]: m[payload],
          };
          parseServer(JSON.stringify(forwarded));
          if (m.type === "offer") {
            if (id !== "host" || m.revision !== room.revision + 1)
              throw Error("invalid_revision");
            room.revision = m.revision;
            room.answered = false;
          } else {
            if (m.revision !== room.revision || !room.revision)
              throw Error("invalid_revision");
            if (m.type === "answer") {
              if (id !== "guest" || room.answered)
                throw Error("invalid_revision");
              room.answered = true;
            }
          }
          target.send(JSON.stringify(forwarded));
        } catch (e) {
          fail(e instanceof Error ? e.message : "malformed_message");
        }
      });
      ws.on("close", () => {
        clearTimeout(authTimeout);
        if (room.sockets.get(id) !== ws) return;
        room.sockets.delete(id);
        for (const socket of room.sockets.values())
          send(socket, {
            type: "peer_disconnected",
            participantId: id,
            retryUntil: Date.now() + 60_000,
          });
      });
    });
  });
  await new Promise<void>((resolve) => http.listen(5190, "127.0.0.1", resolve));
  return {
    errors,
    requests,
    expire: () => {
      for (const room of rooms.values())
        for (const ws of room.sockets.values()) ws.close(4004);
    },
    outage: () => {
      for (const room of rooms.values())
        for (const ws of room.sockets.values()) ws.terminate();
    },
    close: async () => {
      for (const ws of wsServer.clients) ws.terminate();
      await new Promise<void>((resolve) => wsServer.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
