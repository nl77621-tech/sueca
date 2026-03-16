import { useReducer, useEffect, useRef, useState, useCallback } from "react";
import { S, RED, RNK, TEAM, PNAME, reduce, aiPick, validCards, INIT } from "./gameLogic.js";

// ═══════════════════════════════════════════
// RESPONSIVE SCALE HOOK
// ═══════════════════════════════════════════
const useGameScale = () => {
  const calc = () => Math.min(1, Math.max(0.42, window.innerWidth / 800));
  const [scale, setScale] = useState(calc);
  useEffect(() => {
    const update = () => setScale(calc());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return scale;
};

// ═══════════════════════════════════════════
// WEBRTC HOOK  (peer-to-peer video & audio)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// TRANSLATIONS  (pt | en)
// ═══════════════════════════════════════════
const T = {
  pt: {
    subtitle: 'Jogo de Cartas Português',
    playSolo: '▶ JOGAR SOLO', playOnline: '🌐 JOGAR ONLINE',
    soloHint: 'Solo: você + 3 robôs · Online: até 4 jogadores reais',
    createRoom: 'CRIAR SALA', joinRoom: 'ENTRAR EM SALA',
    yourName: 'O seu nome', connecting: 'A ligar…',
    createBtn: '+ CRIAR SALA', joinBtn: '→ ENTRAR',
    mainMenu: '← Menu Principal', back: '← Voltar',
    gameRoom: 'SALA DE JOGO',
    chooseSeat: 'Escolhe o teu lugar · Equipas: Sul+Norte vs Oeste+Este',
    youLabel: 'VOCÊ', sitHere: '+ Sentar aqui', waiting: 'Aguardando…',
    teamA: 'EQUIPA A', teamB: 'EQUIPA B',
    scanQr: 'Digitalizar para entrar',
    copyLink: '🔗 Copiar Link', copied: '✓ Copiado!',
    liveAV: 'VÍDEO & ÁUDIO EM TEMPO REAL',
    cameraOn: '📷 Câmara activa', cameraEnable: '📷 Ativar câmara + microfone',
    cameraHint: 'Opcional · os outros jogadores vêem e ouvem-te em directo',
    startGame: '▶ INICIAR JOGO', leave: '← Sair',
    south: 'Sul', north: 'Norte', west: 'Oeste', east: 'Este',
    victory: 'Vitória!', defeat: 'Derrota!',
    teamWon: 'A vossa equipa ganhou esta rodada',
    teamLost: 'Os adversários ganharam esta rodada',
    gamesWon: 'Partidas ganhas', us: 'Nós', them: 'Eles',
    newRound: 'Nova Rodada', newGame: 'Novo Jogo',
    US: 'NÓS', THEM: 'ELES', TRUMP: 'TRUNFO', DEALER: 'DADOR', NEXT: 'VEZ',
    tricks: 'vazas', room: 'Sala', you: 'Você', trumpLabel: 'trunfo',
    rejoiningMsg: 'A rejoin a sala…', reconnecting: 'A reconnectar ao jogo', cancel: 'Cancelar',
    muteBtn: 'Silenciar', unmuteBtn: 'Ativar microfone',
    videoOff: 'Desligar vídeo', videoOn: 'Ligar vídeo',
    pname: ['Sul', 'Oeste', 'Norte', 'Este'],
  },
  en: {
    subtitle: 'Portuguese Card Game',
    playSolo: '▶ PLAY SOLO', playOnline: '🌐 PLAY ONLINE',
    soloHint: 'Solo: you + 3 bots · Online: up to 4 real players',
    createRoom: 'CREATE ROOM', joinRoom: 'JOIN ROOM',
    yourName: 'Your name', connecting: 'Connecting…',
    createBtn: '+ CREATE ROOM', joinBtn: '→ JOIN',
    mainMenu: '← Main Menu', back: '← Back',
    gameRoom: 'GAME ROOM',
    chooseSeat: 'Choose your seat · Teams: South+North vs West+East',
    youLabel: 'YOU', sitHere: '+ Sit here', waiting: 'Waiting…',
    teamA: 'TEAM A', teamB: 'TEAM B',
    scanQr: 'Scan to join',
    copyLink: '🔗 Copy Link', copied: '✓ Copied!',
    liveAV: 'LIVE VIDEO & AUDIO',
    cameraOn: '📷 Camera on', cameraEnable: '📷 Enable camera + microphone',
    cameraHint: 'Optional · other players will see and hear you live',
    startGame: '▶ START GAME', leave: '← Leave',
    south: 'South', north: 'North', west: 'West', east: 'East',
    victory: 'Victory!', defeat: 'Defeat!',
    teamWon: 'Your team won this round',
    teamLost: 'The opponents won this round',
    gamesWon: 'Games won', us: 'Us', them: 'Them',
    newRound: 'New Round', newGame: 'New Game',
    US: 'US', THEM: 'THEM', TRUMP: 'TRUMP', DEALER: 'DEALER', NEXT: 'NEXT',
    tricks: 'tricks', room: 'Room', you: 'You', trumpLabel: 'trump',
    rejoiningMsg: 'Rejoining room…', reconnecting: 'Reconnecting to game', cancel: 'Cancel',
    muteBtn: 'Mute', unmuteBtn: 'Unmute microphone',
    videoOff: 'Turn off video', videoOn: 'Turn on video',
    pname: ['South', 'West', 'North', 'East'],
  },
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Free TURN relay — handles symmetric NAT that STUN alone can't traverse
  { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443',username: 'openrelayproject', credential: 'openrelayproject' },
];

const useWebRTC = ({ wsRef, myPositionRef, playersRef }) => {
  const localStreamRef  = useRef(null);
  const pcsRef          = useRef({});   // position → RTCPeerConnection
  const makingOfferRef  = useRef({});   // position → bool
  const selfRef         = useRef({});   // keeps helpers fresh for inner closures
  const [localStream,   setLocalStream]   = useState(null);
  const [remoteStreams, setRemoteStreams]  = useState({});
  const [audioEnabled,  setAudioEnabled]  = useState(true);
  const [videoEnabled,  setVideoEnabled]  = useState(true);

  const myPos  = () => myPositionRef.current;
  const sendWS = (msg) => wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(msg));

  const addTracksToPC = (pc, stream) => {
    const senders = pc.getSenders();
    stream.getTracks().forEach(t => {
      if (!senders.some(s => s.track?.id === t.id)) pc.addTrack(t, stream);
    });
  };

  // Create a brand-new RTCPeerConnection for remotePos, wiring up all handlers.
  const createPC = (remotePos) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' });
    pcsRef.current[remotePos] = pc;
    makingOfferRef.current[remotePos] = false;
    let reconnectTimer = null;

    pc.ontrack = e => {
      const stream = e.streams[0];
      if (stream) setRemoteStreams(prev => ({ ...prev, [remotePos]: stream }));
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendWS({ type: 'RTC_ICE', toPosition: remotePos, candidate });
    };

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[remotePos] = true;
        await pc.setLocalDescription();
        sendWS({ type: 'RTC_OFFER', toPosition: remotePos, sdp: pc.localDescription });
      } catch (e) { console.error('negotiation:', e); }
      finally { makingOfferRef.current[remotePos] = false; }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log(`[RTC] pos=${remotePos} → ${s}`);

      if (s === 'connected') {
        clearTimeout(reconnectTimer);
      }

      // If disconnected, wait 5 s then try an ICE restart (soft recover)
      if (s === 'disconnected') {
        reconnectTimer = setTimeout(() => {
          if (pcsRef.current[remotePos] !== pc) return;
          if (pc.connectionState !== 'connected' && myPos() < remotePos) {
            makingOfferRef.current[remotePos] = true;
            pc.createOffer({ iceRestart: true })
              .then(o => pc.setLocalDescription(o))
              .then(() => sendWS({ type: 'RTC_OFFER', toPosition: remotePos, sdp: pc.localDescription }))
              .catch(console.error)
              .finally(() => { makingOfferRef.current[remotePos] = false; });
          }
        }, 5000);
        setRemoteStreams(prev => { const n = { ...prev }; delete n[remotePos]; return n; });
      }

      // Hard failure → close, delete, recreate from the lower-position side
      if (s === 'failed') {
        clearTimeout(reconnectTimer);
        setRemoteStreams(prev => { const n = { ...prev }; delete n[remotePos]; return n; });
        if (pcsRef.current[remotePos] === pc) {
          pc.close();
          delete pcsRef.current[remotePos];
          delete makingOfferRef.current[remotePos];
          if (myPos() < remotePos && localStreamRef.current) {
            setTimeout(() => {
              if (!pcsRef.current[remotePos]) {
                const newPc = selfRef.current.getOrCreatePC(remotePos);
                selfRef.current.addTracksToPC(newPc, localStreamRef.current);
              }
            }, 2000);
          }
        }
      }

      if (s === 'closed') {
        clearTimeout(reconnectTimer);
        setRemoteStreams(prev => { const n = { ...prev }; delete n[remotePos]; return n; });
      }
    };

    return pc;
  };

  const getOrCreatePC = (remotePos) => {
    if (pcsRef.current[remotePos]) return pcsRef.current[remotePos];
    return createPC(remotePos);
  };

  // Keep selfRef fresh so inner closure callbacks always call the latest version
  selfRef.current = { getOrCreatePC, addTracksToPC };

  const handleSignal = useCallback(async (msg) => {
    const from = msg.fromPosition;
    if (from === undefined || from === myPos()) return;

    if (msg.type === 'RTC_READY') {
      if (localStreamRef.current && myPos() < from) {
        const pc = getOrCreatePC(from);
        addTracksToPC(pc, localStreamRef.current);
      }
      return;
    }

    if (msg.type === 'RTC_OFFER') {
      const polite = myPos() > from;
      const pc = getOrCreatePC(from);
      const collision = makingOfferRef.current[from] || pc.signalingState !== 'stable';
      if (collision && !polite) return;
      if (collision && polite) {
        try { await pc.setLocalDescription({ type: 'rollback' }); } catch {}
      }
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      if (localStreamRef.current) addTracksToPC(pc, localStreamRef.current);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWS({ type: 'RTC_ANSWER', toPosition: from, sdp: pc.localDescription });
      return;
    }

    if (msg.type === 'RTC_ANSWER') {
      const pc = pcsRef.current[from];
      if (pc && pc.signalingState !== 'stable') {
        try { await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)); } catch {}
      }
      return;
    }

    if (msg.type === 'RTC_ICE') {
      const pc = pcsRef.current[from];
      if (pc && msg.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enableMedia = useCallback(async (withVideo = true) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      // Lower frame rate reduces bandwidth with 4 simultaneous streams
      video: withVideo ? { width: 320, height: 240, facingMode: 'user', frameRate: { ideal: 15, max: 20 } } : false,
    });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = stream;
    setLocalStream(stream);
    setAudioEnabled(true);
    setVideoEnabled(withVideo);

    for (const pc of Object.values(pcsRef.current)) addTracksToPC(pc, stream);

    sendWS({ type: 'RTC_READY', toPosition: -1 });
    for (const p of (playersRef.current || [])) {
      if (p.position !== myPos() && myPos() < p.position) {
        const pc = getOrCreatePC(p.position);
        addTracksToPC(pc, stream);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disableMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    Object.values(pcsRef.current).forEach(pc => pc.close());
    pcsRef.current = {};
    makingOfferRef.current = {};
    setRemoteStreams({});
    setAudioEnabled(true);
    setVideoEnabled(true);
  }, []);

  const toggleAudio = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setAudioEnabled(p => !p);
  }, []);

  const toggleVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setVideoEnabled(p => !p);
  }, []);

  useEffect(() => () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(pcsRef.current).forEach(pc => pc.close());
  }, []);

  return { localStream, remoteStreams, audioEnabled, videoEnabled,
           enableMedia, disableMedia, toggleAudio, toggleVideo, handleSignal };
};

// ═══════════════════════════════════════════
// VIDEO TILE
// ═══════════════════════════════════════════
const VideoTile = ({ stream, muted = false, mirror = false, scale = 1 }) => {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream ?? null; }, [stream]);
  if (!stream) return null;
  const w = Math.round(140 * scale), h = Math.round(105 * scale), br = Math.round(8 * scale);
  return (
    <div style={{ width: w, height: h, borderRadius: br, overflow: 'hidden', flexShrink: 0,
      background: '#0f172a', border: '1px solid rgba(255,255,255,0.18)', position: 'relative' }}>
      <video ref={ref} autoPlay playsInline muted={muted}
        style={{ width: '100%', height: '100%', objectFit: 'cover',
          transform: mirror ? 'scaleX(-1)' : 'none', display: 'block' }} />
    </div>
  );
};

// ═══════════════════════════════════════════
// CARD COMPONENTS
// ═══════════════════════════════════════════
const Card = ({ card, onClick, hilite, sel, small, scale = 1 }) => {
  const bw = small ? 59 : 106, bh = small ? 84 : 147;
  const w = Math.round(bw * scale), h = Math.round(bh * scale);
  const fs1 = Math.round((small ? 14 : 20) * scale);
  const fs2 = Math.round((small ? 29 : 44) * scale);
  const pad = `${Math.round((small ? 3 : 8) * scale)}px ${Math.round((small ? 4 : 9) * scale)}px`;
  const br = Math.round(8 * scale);
  const red = RED[card.si];
  return (
    <div onClick={onClick} style={{
      width: w, height: h, borderRadius: br,
      background: sel ? '#fffbeb' : 'white',
      border: `2px solid ${sel ? '#f59e0b' : hilite ? '#22c55e' : '#e2e8f0'}`,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: pad,
      boxShadow: sel
        ? '0 0 0 3px #f59e0b88, 0 8px 20px rgba(0,0,0,0.4)'
        : hilite ? '0 4px 12px rgba(34,197,94,0.3)' : '0 2px 8px rgba(0,0,0,0.25)',
      transform: sel ? `translateY(${Math.round(-14 * scale)}px)` : 'none',
      transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
      cursor: hilite ? 'pointer' : 'default',
      userSelect: 'none', flexShrink: 0,
      color: red ? '#dc2626' : '#1e293b',
      fontFamily: 'Georgia, serif', fontWeight: 'bold',
    }}>
      <div style={{ fontSize: fs1, lineHeight: 1.15, alignSelf: 'flex-start' }}>
        {card.v}<br />{card.s}
      </div>
      <div style={{ fontSize: fs2, textAlign: 'center', lineHeight: 1 }}>{card.s}</div>
      <div style={{ fontSize: fs1, lineHeight: 1.15, alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
        {card.v}<br />{card.s}
      </div>
    </div>
  );
};

const CardBack = ({ small, rotated, scale = 1 }) => {
  const bw = small ? 59 : 106, bh = small ? 84 : 147;
  const w = Math.round(bw * scale), h = Math.round(bh * scale);
  const br = Math.round(8 * scale);
  const inset = Math.round(4 * scale);
  return (
    <div style={{
      width: rotated ? h : w, height: rotated ? w : h, borderRadius: br,
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #1e3a8a 100%)',
      border: '2px solid #60a5fa',
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        top: inset, left: inset, right: inset, bottom: inset,
        borderRadius: Math.round(4 * scale),
        border: '1px solid rgba(255,255,255,0.25)',
        background: `repeating-linear-gradient(45deg, transparent, transparent 4px,
          rgba(255,255,255,0.06) 4px, rgba(255,255,255,0.06) 8px)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round((rotated ? (small ? 14 : 20) : (small ? 18 : 26)) * scale),
        opacity: 0.35, color: 'white',
      }}>♠</div>
    </div>
  );
};

// ═══════════════════════════════════════════
// FAN HANDS
// ═══════════════════════════════════════════
const NorthHand = ({ count, scale = 1 }) => {
  const n = Math.min(count, 10);
  const spread = Math.round(22 * scale);
  const cardW = Math.round(59 * scale);
  const cardH = Math.round(84 * scale);
  const totalW = n > 1 ? (n - 1) * spread + cardW : cardW;
  return (
    <div style={{ position: 'relative', width: totalW, height: cardH }}>
      {Array(n).fill(0).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: i * spread, bottom: 0,
          transform: `rotate(${(i - (n - 1) / 2) * 3}deg)`, transformOrigin: 'bottom center',
        }}>
          <CardBack small scale={scale} />
        </div>
      ))}
    </div>
  );
};

const SideHand = ({ count, side, scale = 1 }) => {
  const n = Math.min(count, 10);
  const spread = Math.round(15 * scale);
  const cardW = Math.round(59 * scale);
  const cardH = Math.round(84 * scale);
  const totalH = n > 1 ? (n - 1) * spread + cardW : cardW;
  return (
    <div style={{ position: 'relative', height: totalH, width: cardH }}>
      {Array(n).fill(0).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: i * spread,
          [side === 'left' ? 'right' : 'left']: 0,
          transform: `rotate(${side === 'left' ? -90 : 90}deg)`,
          transformOrigin: 'center center',
        }}>
          <CardBack small rotated scale={scale} />
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════
// PLAYER HAND (drag-to-reorder)
// ═══════════════════════════════════════════
const PlayerHand = ({ hand, trick, trump, sel, onSel, onPlay, onReorder, scale = 1 }) => {
  const vd = new Set(validCards(hand, trick, trump).map(c => c.id));
  const spread = Math.round(57 * scale);
  const cardW = Math.round(106 * scale);
  const handH = Math.round(121 * scale);
  const maxW = Math.round(700 * scale);
  const n = hand.length;
  const totalW = n > 1 ? (n - 1) * spread + cardW : cardW;
  const dragIdx = useRef(null);
  const [overIdx, setOverIdx] = useState(null);

  return (
    <div style={{ position: 'relative', width: Math.min(totalW, maxW), height: handH, flexShrink: 0 }}>
      {hand.map((card, i) => {
        const isHilite = vd.has(card.id);
        const isSel = sel?.id === card.id;
        const isOver = overIdx === i && dragIdx.current !== i;
        const xPos = n > 1 ? (i / (n - 1)) * (Math.min(totalW, maxW) - cardW) : 0;
        return (
          <div
            key={card.id}
            draggable
            onDragStart={e => { dragIdx.current = i; e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIdx !== i) setOverIdx(i); }}
            onDragLeave={() => setOverIdx(null)}
            onDrop={e => {
              e.preventDefault();
              if (dragIdx.current !== null && dragIdx.current !== i) onReorder(dragIdx.current, i);
              dragIdx.current = null; setOverIdx(null);
            }}
            onDragEnd={() => { dragIdx.current = null; setOverIdx(null); }}
            style={{
              position: 'absolute', left: xPos, bottom: 0,
              transform: `rotate(${(i - (n - 1) / 2) * 2.5}deg) ${isOver ? `translateY(${Math.round(-14 * scale)}px)` : ''}`,
              transformOrigin: 'bottom center',
              zIndex: isSel ? 20 : isOver ? 15 : i,
              transition: 'left 0.3s ease, transform 0.15s ease, opacity 0.15s',
              cursor: 'grab', opacity: dragIdx.current === i ? 0.45 : 1,
            }}
          >
            <Card
              card={card} hilite={isHilite} sel={isSel} scale={scale}
              onClick={() => {
                if (!isHilite) return;
                if (isSel) onPlay(card); else onSel(card);
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════
// TRICK AREA (perspective-aware)
// ═══════════════════════════════════════════
const TrickArea = ({ trick, trickWinner, perspective = 0, scale = 1 }) => {
  const p = perspective;
  const positions = {
    [p]:        { gridRow: 3, gridColumn: 2 },
    [(p+1)%4]:  { gridRow: 2, gridColumn: 1 },
    [(p+2)%4]:  { gridRow: 1, gridColumn: 2 },
    [(p+3)%4]:  { gridRow: 2, gridColumn: 3 },
  };
  const cell = Math.round(160 * scale);
  const gap = Math.round(10 * scale);
  const phW = Math.round(96 * scale);
  const phH = Math.round(134 * scale);
  const phBr = Math.round(8 * scale);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${cell}px ${cell}px ${cell}px`,
      gridTemplateRows: `${cell}px ${cell}px ${cell}px`,
      gap,
    }}>
      {[0, 1, 2, 3].map(pi => {
        const pos = positions[pi];
        const play = trick.find(t => t.player === pi);
        const isWinner = trickWinner === pi;
        return (
          <div key={pi} style={{
            gridRow: pos.gridRow, gridColumn: pos.gridColumn,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
          }}>
            {play ? (
              <div style={{ position: 'relative', animation: 'cardSlide 0.3s cubic-bezier(.4,0,.2,1)' }}>
                <Card card={play.card} scale={scale} />
                {isWinner && (
                  <div style={{
                    position: 'absolute', top: Math.round(-10 * scale), right: Math.round(-10 * scale),
                    fontSize: Math.round(18 * scale), animation: 'pulse 0.5s ease-out',
                  }}>⭐</div>
                )}
              </div>
            ) : (
              <div style={{
                width: phW, height: phH, borderRadius: phBr,
                border: '2px dashed rgba(255,255,255,0.15)', opacity: 0.5,
              }} />
            )}
          </div>
        );
      })}
      <div style={{
        gridRow: 2, gridColumn: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.15)', fontSize: Math.round(28 * scale),
      }}>✦</div>
    </div>
  );
};

// ═══════════════════════════════════════════
// LOBBY SCREEN
// ═══════════════════════════════════════════
const Lobby = ({ roomId, players, myPosition, onStart, onLeave, onChangeSeat,
                 localStream, onEnableMedia, onDisableMedia,
                 audioEnabled, videoEnabled, onToggleAudio, onToggleVideo, lang }) => {
  const tr = T[lang];
  const gameUrl = `${window.location.origin}/?room=${roomId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(gameUrl)}`;
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(gameUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // Seat metadata: position → { label, icon, teamColor, teamLabel }
  const seats = [
    { pos: 0, label: tr.south, dir: '↓', team: 0, teamName: tr.teamA, teamColor: '#60a5fa' },
    { pos: 1, label: tr.west,  dir: '←', team: 1, teamName: tr.teamB, teamColor: '#f472b6' },
    { pos: 2, label: tr.north, dir: '↑', team: 0, teamName: tr.teamA, teamColor: '#60a5fa' },
    { pos: 3, label: tr.east,  dir: '→', team: 1, teamName: tr.teamB, teamColor: '#f472b6' },
  ];

  // Group by team for display
  const teamA = seats.filter(s => s.team === 0); // Sul + Norte
  const teamB = seats.filter(s => s.team === 1); // Oeste + Este

  const SeatCard = ({ seat }) => {
    const occupant = players.find(p => p.position === seat.pos);
    const isMe = seat.pos === myPosition;
    const isEmpty = !occupant;
    const canSit = isEmpty && !isMe;

    return (
      <div
        onClick={() => canSit && onChangeSeat(seat.pos)}
        style={{
          padding: '10px 14px', borderRadius: 12,
          background: isMe
            ? `rgba(${seat.team === 0 ? '96,165,250' : '244,114,182'},0.2)`
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isMe ? seat.teamColor : 'rgba(255,255,255,0.1)'}`,
          cursor: canSit ? 'pointer' : 'default',
          transition: 'all 0.2s',
          minWidth: 130,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: seat.teamColor, fontWeight: 'bold' }}>
            {seat.label} {seat.dir}
          </span>
          {isMe && <span style={{ fontSize: 9, color: '#fcd34d', letterSpacing: 1 }}>{tr.youLabel}</span>}
          {occupant && !isMe && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: occupant.connected ? '#22c55e' : '#475569' }} />
          )}
        </div>
        {occupant ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 13, color: 'white', fontWeight: isMe ? 'bold' : 'normal', flex: 1 }}>
              {occupant.name}
            </div>
            {isMe && localStream && (
              <VideoTile stream={localStream} muted mirror scale={0.55} />
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
            {canSit ? <span style={{ color: '#64748b' }}>{tr.sitHere}</span> : <span>{tr.waiting}</span>}
          </div>
        )}
      </div>
    );
  };

  const TeamColumn = ({ seats: teamSeats, label, color }) => (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33`,
      borderRadius: 16, padding: '14px 16px', flex: 1, minWidth: 150,
    }}>
      <div style={{ fontSize: 10, color, letterSpacing: 2, marginBottom: 10, textAlign: 'center' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {teamSeats.map(seat => <SeatCard key={seat.pos} seat={seat} />)}
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0c1445 0%, #1a237e 40%, #0d47a1 70%, #0c2461 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', color: 'white', padding: 20, gap: 20,
    }}>
      {/* Room code */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: '#90caf9', marginBottom: 4 }}>{tr.gameRoom}</div>
        <div style={{
          fontSize: 'clamp(40px, 10vw, 60px)', fontWeight: 'bold', letterSpacing: 14,
          background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>{roomId}</div>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
          {tr.chooseSeat}
        </div>
      </div>

      {/* Teams side by side */}
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 520, alignItems: 'stretch' }}>
        <TeamColumn seats={teamA} label={tr.teamA} color="#60a5fa" />
        <TeamColumn seats={teamB} label={tr.teamB} color="#f472b6" />
      </div>

      {/* QR + link row */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <img src={qrUrl} alt="QR Code" style={{ borderRadius: 10, border: '2px solid rgba(255,255,255,0.12)', width: 'min(120px, 30vw)', height: 'min(120px, 30vw)' }} />
          <div style={{ fontSize: 10, color: '#475569' }}>{tr.scanQr}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div style={{
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '6px 12px', fontSize: 10, color: '#64748b',
            wordBreak: 'break-all', textAlign: 'center', maxWidth: 240,
          }}>{gameUrl}</div>
          <button onClick={copyLink} style={{
            padding: '8px 20px', borderRadius: 30, border: '1px solid rgba(255,255,255,0.2)',
            background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
            color: copied ? '#86efac' : 'white', cursor: 'pointer', fontSize: 12,
            fontFamily: 'Georgia, serif',
          }}>
            {copied ? tr.copied : tr.copyLink}
          </button>
        </div>
      </div>

      {/* Media controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 10, color: '#475569', letterSpacing: 1 }}>{tr.liveAV}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => localStream
              ? onDisableMedia()
              : onEnableMedia(true).catch(() => onEnableMedia(false).catch(() => {}))}
            style={{
              padding: '8px 18px', borderRadius: 30, cursor: 'pointer', fontSize: 12,
              fontFamily: 'Georgia, serif',
              background: localStream ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${localStream ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.2)'}`,
              color: localStream ? '#86efac' : '#94a3b8',
            }}>
            {localStream ? tr.cameraOn : tr.cameraEnable}
          </button>
          {localStream && (<>
            <button onClick={onToggleAudio} title={audioEnabled ? tr.muteBtn : tr.unmuteBtn} style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 15,
              background: audioEnabled ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
              color: audioEnabled ? '#86efac' : '#fca5a5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{audioEnabled ? '🎤' : '🔇'}</button>
            {localStream.getVideoTracks().length > 0 && (
              <button onClick={onToggleVideo} title={videoEnabled ? tr.videoOff : tr.videoOn} style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 15,
                background: videoEnabled ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                color: videoEnabled ? '#86efac' : '#fca5a5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{videoEnabled ? '🎥' : '📵'}</button>
            )}
          </>)}
        </div>
        {!localStream && (
          <div style={{ fontSize: 10, color: '#334155', textAlign: 'center' }}>
            {tr.cameraHint}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(() => {
        const connectedCount = players.filter(p => p.connected).length;
        const allReady = connectedCount === 4;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {!allReady && (
              <div style={{ fontSize: 12, color: '#64748b', letterSpacing: 1 }}>
                {lang === 'pt'
                  ? `À espera de jogadores… ${connectedCount}/4`
                  : `Waiting for players… ${connectedCount}/4`}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={allReady ? onStart : undefined} style={{
          padding: '12px 36px', borderRadius: 30, border: 'none',
          background: allReady
            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
            : 'rgba(255,255,255,0.08)',
          color: allReady ? 'white' : '#475569',
          fontWeight: 'bold', cursor: allReady ? 'pointer' : 'not-allowed', fontSize: 14,
          fontFamily: 'Georgia, serif', letterSpacing: 2,
          boxShadow: allReady ? '0 4px 20px rgba(245,158,11,0.4)' : 'none',
          transition: 'all 0.3s',
        }}>
          {tr.startGame}
        </button>
        <button onClick={onLeave} style={{
          padding: '12px 24px', borderRadius: 30,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.05)',
          color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontFamily: 'Georgia, serif',
        }}>
          {tr.leave}
        </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ═══════════════════════════════════════════
// WELCOME SCREEN
// ═══════════════════════════════════════════
const Welcome = ({ onSolo, onCreateRoom, onJoinRoom, wsError, clearError, lang, onToggleLang }) => {
  const tr = T[lang];
  const urlRoom = new URLSearchParams(window.location.search).get('room');
  const [view, setView] = useState(urlRoom ? 'join' : 'main');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(urlRoom || '');
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 14,
    fontFamily: 'Georgia, serif', outline: 'none', width: '100%',
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    setLoading(true);
    onCreateRoom(name.trim());
  };

  const handleJoin = () => {
    if (!name.trim() || !joinCode.trim()) return;
    setLoading(true);
    onJoinRoom(name.trim(), joinCode.trim().toUpperCase());
  };

  const LangToggle = () => (
    <button onClick={onToggleLang} style={{
      position: 'absolute', top: 16, right: 16,
      padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)',
      background: 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer',
      fontSize: 12, fontFamily: 'Georgia, serif', letterSpacing: 1,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ opacity: lang === 'pt' ? 1 : 0.4 }}>PT</span>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
      <span style={{ opacity: lang === 'en' ? 1 : 0.4 }}>EN</span>
    </button>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0c1445 0%, #1a237e 40%, #0d47a1 70%, #0c2461 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', color: 'white', padding: 24,
      position: 'relative', overflow: 'hidden',
    }}>
      <LangToggle />
      <div style={{ position: 'absolute', top: 40, left: 40, fontSize: 80, opacity: 0.06, pointerEvents: 'none' }}>♠</div>
      <div style={{ position: 'absolute', top: 40, right: 40, fontSize: 80, opacity: 0.06, color: '#dc2626', pointerEvents: 'none' }}>♥</div>
      <div style={{ position: 'absolute', bottom: 40, left: 40, fontSize: 80, opacity: 0.06, color: '#dc2626', pointerEvents: 'none' }}>♦</div>
      <div style={{ position: 'absolute', bottom: 40, right: 40, fontSize: 80, opacity: 0.06, pointerEvents: 'none' }}>♣</div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 36, position: 'relative' }}>
        <div style={{ fontSize: 'clamp(9px, 2vw, 11px)', letterSpacing: 8, color: '#90caf9', marginBottom: 8 }}>{tr.subtitle}</div>
        <h1 style={{
          fontSize: 'clamp(52px, 15vw, 88px)', margin: 0, letterSpacing: 12, fontWeight: 'bold',
          background: 'linear-gradient(135deg, #fcd34d, #f59e0b, #fbbf24)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 40px rgba(245,158,11,0.4))',
        }}>SUECA</h1>
        <div style={{ fontSize: 'clamp(24px, 8vw, 36px)', letterSpacing: 20, marginTop: 4 }}>
          <span>♠</span><span style={{ color: '#dc2626' }}>♥</span>
          <span style={{ color: '#dc2626' }}>♦</span><span>♣</span>
        </div>
      </div>

      {view === 'main' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', maxWidth: 360 }}>
          <button onClick={onSolo} style={{
            width: '100%', padding: '16px 0', fontSize: 17, borderRadius: 50, border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white', fontWeight: 'bold', cursor: 'pointer',
            letterSpacing: 3, fontFamily: 'Georgia, serif',
            boxShadow: '0 4px 24px rgba(245,158,11,0.5)',
          }}>{tr.playSolo}</button>
          <button onClick={() => setView('online')} style={{
            width: '100%', padding: '14px 0', fontSize: 15, borderRadius: 50,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.08)',
            color: 'white', cursor: 'pointer',
            letterSpacing: 2, fontFamily: 'Georgia, serif',
          }}>{tr.playOnline}</button>
          <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 8 }}>{tr.soloHint}</div>
        </div>
      )}

      {view === 'online' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 640 }}>
          {/* Create room */}
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '24px 28px', flex: 1, minWidth: 240,
          }}>
            <div style={{ fontSize: 12, color: '#fcd34d', letterSpacing: 2, marginBottom: 16 }}>{tr.createRoom}</div>
            <input
              style={inputStyle} placeholder={tr.yourName} value={name}
              onChange={e => { setName(e.target.value); clearError(); }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button onClick={handleCreate} disabled={loading || !name.trim()} style={{
              marginTop: 12, width: '100%', padding: '11px 0', borderRadius: 30, border: 'none',
              background: name.trim() ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.1)',
              color: 'white', fontWeight: 'bold', cursor: name.trim() ? 'pointer' : 'default',
              fontFamily: 'Georgia, serif', fontSize: 13, letterSpacing: 2,
            }}>{loading ? tr.connecting : tr.createBtn}</button>
          </div>

          {/* Join room */}
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '24px 28px', flex: 1, minWidth: 240,
          }}>
            <div style={{ fontSize: 12, color: '#86efac', letterSpacing: 2, marginBottom: 16 }}>{tr.joinRoom}</div>
            <input
              style={{ ...inputStyle, marginBottom: 8 }} placeholder={tr.yourName} value={name}
              onChange={e => { setName(e.target.value); clearError(); }}
            />
            <input
              style={{ ...inputStyle, letterSpacing: 6, textTransform: 'uppercase', textAlign: 'center', fontSize: 18 }}
              placeholder="XXXX" maxLength={4} value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); clearError(); }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <button onClick={handleJoin} disabled={loading || !name.trim() || !joinCode.trim()} style={{
              marginTop: 12, width: '100%', padding: '11px 0', borderRadius: 30, border: 'none',
              background: (name.trim() && joinCode.trim()) ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.1)',
              color: 'white', fontWeight: 'bold',
              cursor: (name.trim() && joinCode.trim()) ? 'pointer' : 'default',
              fontFamily: 'Georgia, serif', fontSize: 13, letterSpacing: 2,
            }}>{loading ? tr.connecting : tr.joinBtn}</button>
          </div>

          {wsError && (
            <div style={{
              width: '100%', padding: '10px 16px', borderRadius: 10,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', fontSize: 13, textAlign: 'center',
            }}>{wsError}</div>
          )}
        </div>
      )}

      {view === 'join' && (
        <div style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 320,
        }}>
          <div style={{ fontSize: 12, color: '#86efac', letterSpacing: 2, marginBottom: 4 }}>{tr.joinRoom}</div>
          <div style={{ fontSize: 22, letterSpacing: 10, color: '#fcd34d', marginBottom: 16 }}>{urlRoom}</div>
          <input
            style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 14,
              fontFamily: 'Georgia, serif', outline: 'none', width: '100%' }}
            placeholder={tr.yourName} value={name}
            onChange={e => { setName(e.target.value); clearError(); }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          {wsError && (
            <div style={{ marginTop: 8, color: '#fca5a5', fontSize: 12 }}>{wsError}</div>
          )}
          <button onClick={handleJoin} disabled={loading || !name.trim()} style={{
            marginTop: 12, width: '100%', padding: '12px 0', borderRadius: 30, border: 'none',
            background: name.trim() ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.1)',
            color: 'white', fontWeight: 'bold', cursor: name.trim() ? 'pointer' : 'default',
            fontFamily: 'Georgia, serif', fontSize: 14, letterSpacing: 2,
          }}>{loading ? tr.connecting : tr.joinBtn}</button>
          <button onClick={() => setView('main')} style={{
            marginTop: 8, background: 'none', border: 'none', color: '#475569',
            cursor: 'pointer', fontSize: 12, fontFamily: 'Georgia, serif', width: '100%',
          }}>{tr.back}</button>
        </div>
      )}

      {view !== 'main' && (
        <button onClick={() => { setView('main'); clearError(); }} style={{
          marginTop: 20, background: 'none', border: 'none', color: '#475569',
          cursor: 'pointer', fontSize: 12, fontFamily: 'Georgia, serif',
        }}>{tr.mainMenu}</button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
// ROUND END OVERLAY
// ═══════════════════════════════════════════
const RoundEnd = ({ roundPts, gamePts, perspective, players, onNewRound, onNewGame, lang }) => {
  const tr = T[lang];
  const myTeam = TEAM[perspective];
  const myPts = roundPts[myTeam], theirPts = roundPts[1 - myTeam];
  const iWin = myPts >= 61;
  const partnerPos = (perspective + 2) % 4;
  const getName = pos => players.find(p => p.position === pos)?.name || tr.pname[pos];
  const myLabel = `${getName(perspective)} + ${getName(partnerPos)}`;
  const theirLabel = `${getName((perspective+1)%4)} + ${getName((perspective+3)%4)}`;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, backdropFilter: 'blur(4px)', padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        borderRadius: 24, padding: 'clamp(20px, 5vw, 40px) clamp(20px, 6vw, 48px)',
        textAlign: 'center',
        border: `2px solid ${iWin ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
        boxShadow: `0 24px 80px rgba(0,0,0,0.6)`,
        width: '100%', maxWidth: 400, fontFamily: 'Georgia, serif', color: 'white',
      }}>
        <div style={{ fontSize: 'clamp(40px, 10vw, 64px)', marginBottom: 8 }}>{iWin ? '🎉' : '😔'}</div>
        <h2 style={{ fontSize: 'clamp(22px, 6vw, 32px)', margin: '0 0 4px', color: iWin ? '#86efac' : '#fca5a5' }}>
          {iWin ? tr.victory : tr.defeat}
        </h2>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          {iWin ? tr.teamWon : tr.teamLost}
        </div>
        <div style={{ marginBottom: 24 }}>
          {[
            { label: myLabel, pts: myPts, color: '#22c55e' },
            { label: theirLabel, pts: theirPts, color: '#ef4444' },
          ].map(({ label, pts, color }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                <span>{label}</span>
                <span style={{ color, fontWeight: 'bold' }}>{pts} pts</span>
              </div>
              <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: color, borderRadius: 4, width: `${(pts / 120) * 100}%`, transition: 'width 0.8s' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 24, fontSize: 13, color: '#94a3b8' }}>
          {tr.gamesWon} —{' '}
          <span style={{ color: '#86efac', fontWeight: 'bold' }}>{tr.us}: {gamePts[myTeam]}</span>
          {' | '}
          <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>{tr.them}: {gamePts[1 - myTeam]}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onNewRound} style={{
            padding: '12px 32px', fontSize: 15, borderRadius: 30, border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif',
          }}>{tr.newRound}</button>
          <button onClick={onNewGame} style={{
            padding: '12px 32px', fontSize: 15, borderRadius: 30,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontFamily: 'Georgia, serif',
          }}>{tr.newGame}</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN GAME
// ═══════════════════════════════════════════
export default function Sueca() {
  // ── Solo mode state ──
  const [localState, localDispatch] = useReducer(reduce, INIT);

  // ── Language ──
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('sueca_lang') || 'pt'; } catch { return 'pt'; }
  });
  const toggleLang = () => setLang(l => {
    const next = l === 'pt' ? 'en' : 'pt';
    try { localStorage.setItem('sueca_lang', next); } catch {}
    return next;
  });
  const tr = T[lang];

  // ── Multiplayer state ──
  const wsRef = useRef(null);
  const [multiMode, setMultiMode] = useState(false);
  const [wsState, setWsState] = useState(null);
  const [myPosition, setMyPosition] = useState(0);
  const [roomId, setRoomId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [appView, setAppView] = useState('welcome'); // 'welcome' | 'lobby' | 'game'
  const [localSel, setLocalSel] = useState(null);
  const [wsError, setWsError] = useState('');
  const [isRejoining, setIsRejoining] = useState(false);

  // Persists the player's session so they can rejoin after a disconnect
  const pendingNameRef  = useRef('');
  const autoRejoinRef   = useRef(null); // { roomId, position, name }

  const saveSession = (rid, pos, name) => {
    autoRejoinRef.current = { roomId: rid, position: pos, name };
    try { localStorage.setItem('sueca_session', JSON.stringify({ roomId: rid, position: pos, name })); } catch {}
  };
  const clearSession = () => {
    autoRejoinRef.current = null;
    try { localStorage.removeItem('sueca_session'); } catch {}
  };

  // ── Responsive scale ──
  const scale = useGameScale();

  // ── Refs kept fresh for WebRTC hook ──
  const myPositionRef = useRef(myPosition);
  const playersRef    = useRef(players);
  useEffect(() => { myPositionRef.current = myPosition; }, [myPosition]);
  useEffect(() => { playersRef.current = players; }, [players]);

  // ── WebRTC ──
  const rtc = useWebRTC({ wsRef, myPositionRef, playersRef });

  // ── Stable WS message handler (ref updated every render) ──
  const wsMessageRef = useRef(null);
  wsMessageRef.current = (msg) => {
    if (['RTC_READY', 'RTC_OFFER', 'RTC_ANSWER', 'RTC_ICE'].includes(msg.type)) {
      rtc.handleSignal(msg); return;
    }
    if (msg.type === 'ROOM_CREATED') {
      setMyPosition(msg.position); setRoomId(msg.roomId);
      setMultiMode(true); setAppView('lobby');
      saveSession(msg.roomId, msg.position, pendingNameRef.current);
    } else if (msg.type === 'JOINED') {
      setMyPosition(msg.position); setRoomId(msg.roomId);
      setMultiMode(true); setAppView('lobby');
      saveSession(msg.roomId, msg.position, pendingNameRef.current);
    } else if (msg.type === 'REJOINED') {
      setMyPosition(msg.position); setRoomId(msg.roomId);
      setMultiMode(true); setIsRejoining(false); setAppView('lobby');
      saveSession(msg.roomId, msg.position, autoRejoinRef.current?.name || pendingNameRef.current);
    } else if (msg.type === 'SEAT_CHANGED') {
      setMyPosition(msg.position);
      // Update saved position after seat change
      const s = autoRejoinRef.current;
      if (s) saveSession(s.roomId, msg.position, s.name);
    } else if (msg.type === 'STATE_UPDATE') {
      setWsState(msg.state); setPlayers(msg.players);
      if (msg.state.phase !== 'welcome') setAppView('game');
    } else if (msg.type === 'ERROR') {
      setIsRejoining(false); setWsError(msg.message);
    }
  };

  // Active state/perspective
  const state = multiMode ? wsState : localState;
  const sel = multiMode ? localSel : localState.sel;
  const perspective = multiMode ? myPosition : 0;

  // Perspective-based visual positions
  const topPos   = (perspective + 2) % 4;
  const leftPos  = (perspective + 1) % 4;
  const rightPos = (perspective + 3) % 4;

  // ── Unified dispatch ──
  const dispatch = useCallback((action) => {
    if (multiMode && wsRef.current?.readyState === 1) {
      if (action.type === 'SEL') {
        setLocalSel(prev => prev?.id === action.card.id ? null : action.card);
        return;
      }
      if (action.type === 'PLAY') setLocalSel(null);
      wsRef.current.send(JSON.stringify({ type: 'GAME_ACTION', action }));
    } else {
      localDispatch(action);
    }
  }, [multiMode]);

  // ── WebSocket connection helper ──
  const connectWS = useCallback((onOpen) => {
    wsRef.current?.close();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = socket;
    socket.onopen = onOpen;
    socket.onmessage = e => {
      try { wsMessageRef.current?.(JSON.parse(e.data)); } catch {}
    };
    socket.onclose = () => {
      if (wsRef.current !== socket) return; // superseded by a newer connection
      const session = autoRejoinRef.current;
      if (!session) return; // user intentionally left, don't reconnect
      // Brief network blip — auto-reconnect and rejoin
      setTimeout(() => {
        if (!autoRejoinRef.current || wsRef.current !== socket) return;
        connectWS(() => wsRef.current?.send(JSON.stringify({
          type: 'REJOIN_ROOM', roomId: session.roomId, position: session.position, name: session.name,
        })));
      }, 3000);
    };
  }, []);

  const handleCreateRoom = useCallback(name => {
    pendingNameRef.current = name;
    connectWS(() => wsRef.current.send(JSON.stringify({ type: 'CREATE_ROOM', name })));
  }, [connectWS]);

  const handleJoinRoom = useCallback((name, code) => {
    pendingNameRef.current = name;
    connectWS(() => wsRef.current.send(JSON.stringify({ type: 'JOIN_ROOM', name, roomId: code })));
  }, [connectWS]);

  const handleLeave = () => {
    clearSession();
    rtc.disableMedia();
    wsRef.current?.close();
    setMultiMode(false); setWsState(null); setPlayers([]); setRoomId(null);
    setLocalSel(null); setAppView('welcome'); setWsError(''); setIsRejoining(false);
  };

  // ── Auto-rejoin on page load if URL matches a saved session ──
  useEffect(() => {
    const urlRoom = new URLSearchParams(window.location.search).get('room')?.toUpperCase();
    if (!urlRoom) return;
    try {
      const saved = JSON.parse(localStorage.getItem('sueca_session') || 'null');
      if (saved?.roomId === urlRoom) {
        autoRejoinRef.current = saved;
        setIsRejoining(true);
        connectWS(() => wsRef.current?.send(JSON.stringify({
          type: 'REJOIN_ROOM', roomId: saved.roomId, position: saved.position, name: saved.name,
        })));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Solo AI effects ──
  useEffect(() => {
    if (multiMode || !state || state.phase !== 'playing' || state.current === 0) return;
    const delay = 700 + Math.random() * 500;
    const t = setTimeout(() => {
      const card = aiPick(state.hands[state.current], state.trick, state.trump, state.current);
      if (card) localDispatch({ type: 'PLAY', pi: state.current, card });
    }, delay);
    return () => clearTimeout(t);
  }, [multiMode, state?.phase, state?.current, state?.trick?.length]);

  useEffect(() => {
    if (multiMode || !state || state.phase !== 'resolving') return;
    const t = setTimeout(() => localDispatch({ type: 'CLEAR' }), 1600);
    return () => clearTimeout(t);
  }, [multiMode, state?.phase, state?.trick?.length]);

  // ── Routing ──
  if (appView === 'welcome') {
    if (isRejoining) {
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', background: 'linear-gradient(135deg,#1e3a2f 0%,#14532d 60%,#052e16 100%)',
          color: '#fff', fontFamily: 'system-ui,sans-serif', gap: 20 }}>
          <div style={{ fontSize: 48 }}>🃏</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{tr.rejoiningMsg}</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{tr.reconnecting}</div>
          <button onClick={handleLeave}
            style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
              background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
            {tr.cancel}
          </button>
        </div>
      );
    }
    return (
      <Welcome
        onSolo={() => { localDispatch({ type: 'START' }); setAppView('game'); }}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        wsError={wsError}
        clearError={() => setWsError('')}
        lang={lang}
        onToggleLang={toggleLang}
      />
    );
  }

  if (appView === 'lobby') {
    return (
      <Lobby
        roomId={roomId}
        players={players}
        myPosition={myPosition}
        onStart={() => wsRef.current?.send(JSON.stringify({ type: 'GAME_ACTION', action: { type: 'START' } }))}
        onLeave={handleLeave}
        onChangeSeat={pos => wsRef.current?.send(JSON.stringify({ type: 'CHANGE_SEAT', toPosition: pos }))}
        localStream={rtc.localStream}
        onEnableMedia={rtc.enableMedia}
        onDisableMedia={rtc.disableMedia}
        audioEnabled={rtc.audioEnabled}
        videoEnabled={rtc.videoEnabled}
        onToggleAudio={rtc.toggleAudio}
        onToggleVideo={rtc.toggleVideo}
        lang={lang}
      />
    );
  }

  if (!state) return null;

  // ── Game render ──
  const isYourTurn = state.phase === 'playing' && state.current === perspective;
  const myTeam = TEAM[perspective];

  const getName = pos => {
    if (!multiMode) return pos === perspective ? tr.you : tr.pname[pos];
    return players.find(p => p.position === pos)?.name || tr.pname[pos];
  };
  const isHumanPlayer = pos => multiMode ? players.some(p => p.position === pos) : pos === 0;
  const isPlaying = pos => state.phase === 'playing' && state.current === pos;

  // Trump card visibility and position.
  // Show during the entire first trick; hide once all 4 players have played
  // (tricksLeft drops from 10→9 when the first trick is resolved).
  const trumpCardHeld = state.trumpCard &&
    state.tricksLeft === 10 &&
    state.hands[state.dealer] &&
    state.hands[state.dealer].some(c => c.id === state.trumpCard.id);
  const dealerSlot = (state.dealer - perspective + 4) % 4; // 0=bottom,1=left,2=top,3=right
  const trumpPos = [
    { bottom: '27%', left: '48%', transform: 'translateX(-50%) rotate(-12deg)' },
    { left: '26%',  top: '46%',  transform: 'translateY(-50%) rotate(10deg)' },
    { top: '13%',   left: '48%', transform: 'translateX(-50%) rotate(12deg)' },
    { left: '63%',  top: '46%',  transform: 'translateY(-50%) rotate(-10deg)' },
  ][dealerSlot] || {};

  // Scaled sizes for layout spacing
  const sideMinW = Math.round(90 * scale);
  const trickPad = Math.round(12 * scale);
  const middleGap = Math.round(20 * scale);
  const labelFs = Math.max(8, Math.round(10 * scale));
  const msgFs = Math.max(10, Math.round(13 * scale));

  const playerLabel = (pos, color, bg, border) => (
    <div style={{
      padding: `${Math.round(4 * scale)}px ${Math.round(10 * scale)}px`,
      borderRadius: 20, fontSize: labelFs, fontWeight: 'bold',
      background: bg, border: `1px solid ${border}`,
      color, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <span>{isHumanPlayer(pos) ? '👤' : '🤖'}</span>
      <span>{getName(pos)}{isPlaying(pos) ? ' …' : ''}</span>
    </div>
  );

  // Header font scaling
  const hdrScore = Math.max(14, Math.round(18 * Math.min(1, window.innerWidth / 600)));
  const hdrLabel = Math.max(7, Math.round(9 * Math.min(1, window.innerWidth / 600)));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 30%, #1b5e20 0%, #145214 40%, #0a3300 100%)',
      fontFamily: 'Georgia, serif', color: 'white',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      {/* Felt texture */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3h1v1H1V3zm2-2h1v1H3V1z' fill='rgba(0,0,0,0.08)'/%3E%3C/svg%3E")`,
        zIndex: 0,
      }} />

      {/* ── Header ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: `8px ${Math.max(8, Math.round(20 * Math.min(1, window.innerWidth / 600)))}px`,
        background: 'rgba(0,0,0,0.35)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexWrap: 'nowrap', gap: 8,
      }}>
        <div style={{
          fontSize: 'clamp(14px, 4vw, 22px)', fontWeight: 'bold', letterSpacing: 'clamp(2px, 1vw, 5px)',
          background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          flexShrink: 0,
        }}>SUECA</div>

        {/* Scores */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {[
            { label: tr.US, pts: state.roundPts[myTeam], wins: state.gamePts[myTeam], color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
            { label: tr.THEM, pts: state.roundPts[1-myTeam], wins: state.gamePts[1-myTeam], color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
          ].map(({ label, pts, wins, color, bg }, i) => (
            <div key={i} style={{ padding: `4px ${Math.max(8, Math.round(14 * Math.min(1, window.innerWidth / 600)))}px`, borderRadius: 12, background: bg, border: `1px solid ${color}44`, textAlign: 'center', minWidth: Math.max(50, Math.round(70 * Math.min(1, window.innerWidth / 600))) }}>
              <div style={{ fontSize: hdrLabel, color, letterSpacing: 2, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: hdrScore, fontWeight: 'bold', color, lineHeight: 1 }}>{pts}</div>
              <div style={{ fontSize: Math.max(7, Math.round(10 * Math.min(1, window.innerWidth / 600))), color: '#64748b', marginTop: 2 }}>
                {'★'.repeat(wins)}{'☆'.repeat(Math.max(0, 4 - wins))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {state.trump !== null && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: `4px ${Math.max(6, Math.round(12 * Math.min(1, window.innerWidth / 600)))}px`,
              borderRadius: 10,
              background: RED[state.trump] ? 'rgba(220,38,38,0.2)' : 'rgba(30,41,59,0.6)',
              border: `1px solid ${RED[state.trump] ? '#dc2626' : '#64748b'}`,
            }}>
              <div style={{ fontSize: 'clamp(7px, 1.5vw, 9px)', color: '#94a3b8', letterSpacing: 1 }}>{tr.TRUMP}</div>
              <div style={{ fontSize: 'clamp(16px, 4vw, 22px)', color: RED[state.trump] ? '#f87171' : '#e2e8f0', fontWeight: 'bold', lineHeight: 1 }}>
                {S[state.trump]}
              </div>
            </div>
          )}

          {/* Dealer & Next-to-play badges */}
          {state.phase !== 'welcome' && (() => {
            const isMyTurn = state.phase === 'playing' && state.current === perspective;
            const nextName = state.phase === 'playing'
              ? (state.current === perspective ? 'Você' : getName(state.current))
              : null;
            const dealerName = state.dealer === perspective ? 'Você' : getName(state.dealer);
            const badgeBase = { display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: `3px ${Math.max(5, Math.round(9 * Math.min(1, window.innerWidth / 600)))}px`,
              borderRadius: 8, minWidth: Math.max(40, Math.round(52 * Math.min(1, window.innerWidth / 600))) };
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ ...badgeBase, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)' }}>
                  <div style={{ fontSize: 'clamp(6px, 1.2vw, 8px)', color: '#fbbf24', letterSpacing: 1 }}>{tr.DEALER}</div>
                  <div style={{ fontSize: 'clamp(8px, 1.8vw, 11px)', color: '#fde68a', fontWeight: 'bold', lineHeight: 1.2, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dealerName}
                  </div>
                </div>
                {nextName && (
                  <div style={{ ...badgeBase,
                    background: isMyTurn ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.1)',
                    border: `1px solid ${isMyTurn ? 'rgba(34,197,94,0.6)' : 'rgba(148,163,184,0.2)'}`,
                  }}>
                    <div style={{ fontSize: 'clamp(6px, 1.2vw, 8px)', color: isMyTurn ? '#4ade80' : '#94a3b8', letterSpacing: 1 }}>{tr.NEXT}</div>
                    <div style={{ fontSize: 'clamp(8px, 1.8vw, 11px)', color: isMyTurn ? '#86efac' : '#cbd5e1', fontWeight: 'bold', lineHeight: 1.2, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nextName}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ fontSize: 'clamp(8px, 2vw, 10px)', color: '#64748b', textAlign: 'right', lineHeight: 1.6 }}>
            {state.tricksLeft}<br />{tr.tricks}
          </div>
          {multiMode && (
            <div style={{ fontSize: 'clamp(8px, 2vw, 10px)', color: '#475569', borderLeft: '1px solid #1e293b', paddingLeft: 8 }}>
              {tr.room}<br /><span style={{ color: '#fcd34d', fontWeight: 'bold', letterSpacing: 2 }}>{roomId}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 5,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${Math.round(16 * scale)}px ${Math.round(12 * scale)}px`,
        gap: Math.round(8 * scale),
      }}>

        {/* Floating trump card near dealer */}
        {trumpCardHeld && (
          <div style={{ position: 'absolute', zIndex: 20, pointerEvents: 'none', ...trumpPos }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ fontSize: Math.max(7, Math.round(9 * scale)), color: '#fcd34d', letterSpacing: 1, textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {tr.trumpLabel}
              </div>
              <Card card={state.trumpCard} small scale={scale} />
            </div>
          </div>
        )}

        {/* Top player (partner) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(6 * scale) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(6 * scale) }}>
            {multiMode && <VideoTile stream={rtc.remoteStreams[topPos]} scale={scale} />}
            {playerLabel(topPos, '#86efac', 'rgba(34,197,94,0.15)', 'rgba(34,197,94,0.3)')}
          </div>
          <NorthHand count={state.hands[topPos].length} scale={scale} />
        </div>

        {/* Middle row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: middleGap, width: '100%' }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(6 * scale), minWidth: sideMinW }}>
            {playerLabel(leftPos, '#fca5a5', 'rgba(239,68,68,0.15)', 'rgba(239,68,68,0.3)')}
            {multiMode && <VideoTile stream={rtc.remoteStreams[leftPos]} scale={scale} />}
            <SideHand count={state.hands[leftPos].length} side="left" scale={scale} />
          </div>

          {/* Center trick area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(12 * scale) }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: Math.round(16 * scale), border: '1px solid rgba(255,255,255,0.06)', padding: trickPad }}>
              <TrickArea
                trick={state.trick}
                trickWinner={state.phase === 'resolving' ? state.trickWinner : null}
                perspective={perspective}
                scale={scale}
              />
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(6 * scale), minWidth: sideMinW }}>
            {playerLabel(rightPos, '#fca5a5', 'rgba(239,68,68,0.15)', 'rgba(239,68,68,0.3)')}
            {multiMode && <VideoTile stream={rtc.remoteStreams[rightPos]} scale={scale} />}
            <SideHand count={state.hands[rightPos].length} side="right" scale={scale} />
          </div>
        </div>

        {/* Message bar */}
        <div style={{
          padding: `${Math.round(8 * scale)}px ${Math.round(20 * scale)}px`,
          borderRadius: 20, maxWidth: Math.round(480 * scale), width: '100%',
          background: isYourTurn ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.3)',
          border: `1px solid ${isYourTurn ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
          fontSize: msgFs, color: isYourTurn ? '#86efac' : '#94a3b8',
          textAlign: 'center', transition: 'all 0.3s',
        }}>
          {isYourTurn ? '✨ Sua vez!' : state.msg}
          {isYourTurn && sel && ' · Clique novamente para jogar!'}
        </div>

        {/* Your hand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.round(8 * scale) }}>
          <div style={{ position: 'relative', overflow: 'visible', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <PlayerHand
              hand={state.hands[perspective]}
              trick={state.trick}
              trump={state.trump}
              sel={sel}
              scale={scale}
              onSel={card => dispatch({ type: 'SEL', card, pi: perspective })}
              onPlay={card => dispatch({ type: 'PLAY', pi: perspective, card })}
              onReorder={(from, to) => dispatch({ type: 'REORDER_HAND', from, to, pi: perspective })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(8 * scale), flexWrap: 'wrap', justifyContent: 'center' }}>
            {multiMode && rtc.localStream && (
              <VideoTile stream={rtc.localStream} muted mirror scale={scale} />
            )}
            <div style={{
              padding: `${Math.round(4 * scale)}px ${Math.round(20 * scale)}px`,
              borderRadius: 20, fontSize: labelFs, fontWeight: 'bold',
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
              color: '#86efac', display: 'flex', alignItems: 'center', gap: Math.round(6 * scale),
            }}>
              <span>👤</span>
              <span>{getName(perspective)} {isYourTurn ? '← sua vez!' : ''}</span>
            </div>
            <button
              onClick={() => dispatch({ type: 'AUTO_ORDER_HAND', pi: perspective })}
              style={{
                padding: `${Math.round(4 * scale)}px ${Math.round(14 * scale)}px`,
                borderRadius: 20, fontSize: labelFs, fontWeight: 'bold',
                background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)',
                color: '#fcd34d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: Math.round(5 * scale),
              }}
            >
              ✦ Auto Ordenar
            </button>
          </div>
        </div>
      </div>

      {/* Round end overlay */}
      {state.phase === 'round_end' && (
        <RoundEnd
          roundPts={state.roundPts}
          gamePts={state.gamePts}
          perspective={perspective}
          players={players}
          onNewRound={() => dispatch({ type: 'NEW_ROUND' })}
          onNewGame={() => dispatch({ type: 'START' })}
          lang={lang}
        />
      )}

      {/* Floating media controls (multiplayer only) */}
      {multiMode && (
        <div style={{
          position: 'fixed', bottom: 14, right: 14, zIndex: 50,
          display: 'flex', gap: 6, alignItems: 'center',
          background: 'rgba(0,0,0,0.5)', borderRadius: 30, padding: '6px 10px',
          border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)',
        }}>
          <button
            onClick={() => rtc.localStream
              ? rtc.disableMedia()
              : rtc.enableMedia(true).catch(() => rtc.enableMedia(false).catch(() => {}))}
            title={rtc.localStream ? 'Desativar câmara' : 'Ativar câmara'}
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 14,
              background: rtc.localStream ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)',
              color: rtc.localStream ? '#86efac' : '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>📷</button>
          {rtc.localStream && (<>
            <button onClick={rtc.toggleAudio} title={rtc.audioEnabled ? 'Silenciar' : 'Ativar mic'} style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 14,
              background: rtc.audioEnabled ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
              color: rtc.audioEnabled ? '#86efac' : '#fca5a5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{rtc.audioEnabled ? '🎤' : '🔇'}</button>
            {rtc.localStream.getVideoTracks().length > 0 && (
              <button onClick={rtc.toggleVideo} title={rtc.videoEnabled ? 'Desligar vídeo' : 'Ligar vídeo'} style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 14,
                background: rtc.videoEnabled ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
                color: rtc.videoEnabled ? '#86efac' : '#fca5a5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{rtc.videoEnabled ? '🎥' : '📵'}</button>
            )}
          </>)}
        </div>
      )}

      <style>{`
        @keyframes cardSlide {
          from { opacity: 0; transform: scale(0.7) translateY(-10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulse {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.4); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        button:active { transform: scale(0.97) !important; }
        input::placeholder { color: #475569; }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
      `}</style>
    </div>
  );
}
