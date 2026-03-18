import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { reduce, aiPick, INIT, DEFAULT_SETTINGS } from './src/gameLogic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Serve Vite build
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')));

// ── Room management ──────────────────────────────────────────
// rooms: Map<id, { id, state, players: [{ws, name, position, connected}], aiTimer }>
const rooms = new Map();

const genId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do { id = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms.has(id));
  return id;
};

const broadcast = (room) => {
  const playerInfo = room.players.map(p => ({
    position: p.position, name: p.name, connected: p.connected, isBot: p.isBot || false,
  }));
  const s = room.state.settings || DEFAULT_SETTINGS;
  const roomSettings = { setLength: s.setLength, bandeira: s.bandeira, botSpeed: s.botSpeed };
  const payload = JSON.stringify({ type: 'STATE_UPDATE', state: room.state, players: playerInfo, roomSettings });
  for (const p of room.players) {
    if (p.ws?.readyState === 1) p.ws.send(payload);
  }
};

const scheduleAI = (room) => {
  const { state } = room;
  if (state.phase !== 'playing' && state.phase !== 'resolving') return;
  // In resolving phase we always need to schedule the CLEAR, regardless of who won the trick.
  // Only skip scheduling in playing phase when it's actually a connected human's turn.
  if (state.phase === 'playing') {
    const humanTurn = room.players.some(p => p.position === state.current && p.connected && p.ws?.readyState === 1);
    if (humanTurn) return;
  }

  clearTimeout(room.aiTimer);
  const spd = room.state.settings?.botSpeed || 'normal';
  const aiDelay = spd === 'fast' ? 300 + Math.random() * 200
                : spd === 'slow' ? 1800 + Math.random() * 800
                :                   800 + Math.random() * 400;
  room.aiTimer = setTimeout(() => {
    const r = rooms.get(room.id);
    if (!r) return;
    let s = r.state;

    // Auto-clear resolved trick
    if (s.phase === 'resolving') {
      s = reduce(s, { type: 'CLEAR' });
      r.state = s;
      broadcast(r);
    }
    if (s.phase !== 'playing') return;

    // Check again — player might have reconnected
    const isHumanNow = r.players.some(p => p.position === s.current && p.connected && p.ws?.readyState === 1);
    if (isHumanNow) return;

    const card = aiPick(s.hands[s.current], s.trick, s.trump, s.current);
    if (!card) return;
    s = reduce(s, { type: 'PLAY', pi: s.current, card });
    r.state = s;
    broadcast(r);
    scheduleAI(r);
  }, aiDelay);
};

// ── WebSocket handler ─────────────────────────────────────────
wss.on('connection', (ws) => {
  let myRoomId = null;
  let myPosition = null;

  const send = obj => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'CREATE_ROOM') {
      const roomId = genId();
      const room = {
        id: roomId,
        state: { ...INIT, settings: { ...DEFAULT_SETTINGS } },
        players: [{ ws, name: msg.name || 'Jogador 1', position: 0, connected: true }],
        aiTimer: null,
      };
      rooms.set(roomId, room);
      myRoomId = roomId;
      myPosition = 0;
      send({ type: 'ROOM_CREATED', roomId, position: 0 });
      broadcast(room);
    }

    else if (msg.type === 'CHANGE_SEAT') {
      const room = rooms.get(myRoomId);
      if (!room || room.state.phase !== 'welcome') return;
      const toPos = msg.toPosition;
      if (typeof toPos !== 'number' || toPos < 0 || toPos > 3) return;
      // Check seat isn't already taken
      if (room.players.some(p => p.position === toPos)) return;
      room.players = room.players.map(p =>
        p.position === myPosition ? { ...p, position: toPos } : p
      );
      myPosition = toPos;
      send({ type: 'SEAT_CHANGED', position: toPos });
      broadcast(room);
    }

    else if (msg.type === 'ADD_BOT') {
      const room = rooms.get(myRoomId);
      if (!room || room.state.phase !== 'welcome') return;
      if (myPosition !== 0) return; // only room creator can add bots
      const taken = new Set(room.players.map(p => p.position));
      const pos = [0, 1, 2, 3].find(p => !taken.has(p));
      if (pos === undefined) return; // all seats taken
      const botNum = room.players.filter(p => p.isBot).length + 1;
      room.players.push({ ws: null, name: `Bot ${botNum}`, position: pos, connected: false, isBot: true });
      broadcast(room);
      // Don't scheduleAI yet — game hasn't started
    }

    else if (msg.type === 'REMOVE_BOT') {
      const room = rooms.get(myRoomId);
      if (!room || room.state.phase !== 'welcome') return;
      if (myPosition !== 0) return; // only room creator can remove bots
      const pos = msg.position;
      const idx = room.players.findIndex(p => p.position === pos && p.isBot);
      if (idx === -1) return;
      room.players.splice(idx, 1);
      broadcast(room);
    }

    else if (msg.type === 'JOIN_ROOM') {
      const roomId = msg.roomId?.toUpperCase().trim();
      const room = rooms.get(roomId);
      if (!room) { send({ type: 'ERROR', message: 'Sala não encontrada' }); return; }

      if (room.state.phase !== 'welcome') {
        // Game in progress — try to reconnect to a disconnected seat
        const seat = room.players.find(p => !p.isBot && (!p.connected || !p.ws || p.ws.readyState !== 1));
        if (!seat) { send({ type: 'ERROR', message: 'Jogo em curso e sem lugares disponíveis' }); return; }
        if (seat.ws && seat.ws !== ws && seat.ws.readyState === 1) seat.ws.close();
        seat.ws = ws; seat.connected = true;
        if (msg.name) seat.name = msg.name;
        myRoomId = roomId; myPosition = seat.position;
        send({ type: 'REJOINED', roomId, position: seat.position });
        broadcast(room);
        scheduleAI(room);
        return;
      }

      const taken = new Set(room.players.map(p => p.position));
      const pos = [1, 2, 3].find(p => !taken.has(p));
      if (pos === undefined) { send({ type: 'ERROR', message: 'Sala cheia (4/4)' }); return; }
      room.players.push({ ws, name: msg.name || `Jogador ${pos + 1}`, position: pos, connected: true });
      myRoomId = roomId;
      myPosition = pos;
      send({ type: 'JOINED', roomId, position: pos });
      broadcast(room);
    }

    else if (msg.type === 'REJOIN_ROOM') {
      const roomId = msg.roomId?.toUpperCase().trim();
      const room = rooms.get(roomId);
      if (!room) { send({ type: 'ERROR', message: 'Sala não encontrada' }); return; }
      const claimedPos = parseInt(msg.position, 10);
      // Accept rejoin even if old WS is still technically open (page refresh race)
      const player = room.players.find(p => p.position === claimedPos && !p.isBot &&
        (!p.connected || !p.ws || p.ws.readyState !== 1));
      if (!player) { send({ type: 'ERROR', message: 'Lugar não disponível' }); return; }
      if (player.ws && player.ws !== ws && player.ws.readyState === 1) player.ws.close();
      player.ws = ws;
      player.connected = true;
      if (msg.name) player.name = msg.name;
      myRoomId = roomId;
      myPosition = claimedPos;
      send({ type: 'REJOINED', roomId, position: claimedPos });
      broadcast(room);
      scheduleAI(room);
    }

    else if (msg.type === 'UPDATE_SETTINGS') {
      const room = rooms.get(myRoomId);
      if (!room || room.state.phase !== 'welcome') return;
      if (myPosition !== 0) return; // creator only
      const { setLength, bandeira, botSpeed } = msg.settings || {};
      const cur = room.state.settings || { ...DEFAULT_SETTINGS };
      room.state = {
        ...room.state,
        settings: {
          setLength:  setLength  !== undefined ? Number(setLength)   : cur.setLength,
          bandeira:   bandeira   !== undefined ? Boolean(bandeira)   : cur.bandeira,
          botSpeed:   botSpeed   !== undefined ? String(botSpeed)    : cur.botSpeed,
        },
      };
      broadcast(room);
    }

    else if (['RTC_READY', 'RTC_OFFER', 'RTC_ANSWER', 'RTC_ICE'].includes(msg.type)) {
      const room = rooms.get(myRoomId);
      if (!room) return;
      const out = JSON.stringify({ ...msg, fromPosition: myPosition });
      if (msg.toPosition === -1) {
        // Broadcast to everyone else in the room
        for (const p of room.players) {
          if (p.position !== myPosition && p.ws?.readyState === 1) p.ws.send(out);
        }
      } else {
        const target = room.players.find(p => p.position === msg.toPosition);
        if (target?.ws?.readyState === 1) target.ws.send(out);
      }
    }

    else if (msg.type === 'GAME_ACTION') {
      const room = rooms.get(myRoomId);
      if (!room) return;
      const action = { ...msg.action };

      // Require all 4 seats filled (humans connected or bots) before the game can start
      if (action.type === 'START' || action.type === 'NEW_ROUND') {
        const readyCount = room.players.filter(p => p.connected || p.isBot).length;
        if (readyCount < 4) {
          send({ type: 'ERROR', message: room.players.length < 4
            ? 'Sala não está cheia (4/4)'
            : 'Nem todos os jogadores estão ligados' });
          return;
        }
      }

      // Attach player index for actions that need it
      if (['REORDER_HAND', 'AUTO_ORDER_HAND'].includes(action.type)) action.pi = myPosition;
      // Validate ownership for PLAY
      if (action.type === 'PLAY' && action.pi !== myPosition) return;

      const newState = reduce(room.state, action);
      room.state = newState;
      broadcast(room);
      scheduleAI(room);
    }
  });

  ws.on('close', () => {
    if (!myRoomId) return;
    const room = rooms.get(myRoomId);
    if (!room) return;
    room.players = room.players.map(p =>
      p.position === myPosition ? { ...p, ws: null, connected: false } : p
    );
    broadcast(room);
    scheduleAI(room); // AI takes over disconnected seat
    // Clean up rooms where everyone left
    if (room.players.every(p => !p.connected)) {
      setTimeout(() => {
        if (rooms.get(myRoomId)?.players.every(p => !p.connected)) rooms.delete(myRoomId);
      }, 120_000);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🃏 Sueca server on :${PORT}`));
