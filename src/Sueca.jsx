import { useReducer, useEffect, useRef, useState, useCallback } from "react";
import { S, RED, RNK, TEAM, PNAME, reduce, aiPick, validCards, INIT } from "./gameLogic.js";

// ═══════════════════════════════════════════
// CARD COMPONENTS
// ═══════════════════════════════════════════
const Card = ({ card, onClick, hilite, sel, small }) => {
  const w = small ? 54 : 96, h = small ? 76 : 134;
  const red = RED[card.si];
  return (
    <div onClick={onClick} style={{
      width: w, height: h, borderRadius: 8,
      background: sel ? '#fffbeb' : 'white',
      border: `2px solid ${sel ? '#f59e0b' : hilite ? '#22c55e' : '#e2e8f0'}`,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: small ? '3px 4px' : '7px 8px',
      boxShadow: sel
        ? '0 0 0 3px #f59e0b88, 0 8px 20px rgba(0,0,0,0.4)'
        : hilite ? '0 4px 12px rgba(34,197,94,0.3)' : '0 2px 8px rgba(0,0,0,0.25)',
      transform: sel ? 'translateY(-14px)' : 'none',
      transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
      cursor: hilite ? 'pointer' : 'default',
      userSelect: 'none', flexShrink: 0,
      color: red ? '#dc2626' : '#1e293b',
      fontFamily: 'Georgia, serif', fontWeight: 'bold',
    }}>
      <div style={{ fontSize: small ? 13 : 18, lineHeight: 1.15, alignSelf: 'flex-start' }}>
        {card.v}<br />{card.s}
      </div>
      <div style={{ fontSize: small ? 26 : 40, textAlign: 'center', lineHeight: 1 }}>{card.s}</div>
      <div style={{ fontSize: small ? 13 : 18, lineHeight: 1.15, alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
        {card.v}<br />{card.s}
      </div>
    </div>
  );
};

const CardBack = ({ small, rotated }) => {
  const w = small ? 54 : 96, h = small ? 76 : 134;
  return (
    <div style={{
      width: rotated ? h : w, height: rotated ? w : h, borderRadius: 8,
      background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #1e3a8a 100%)',
      border: '2px solid #60a5fa',
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', inset: 4, borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.25)',
        background: `repeating-linear-gradient(45deg, transparent, transparent 4px,
          rgba(255,255,255,0.06) 4px, rgba(255,255,255,0.06) 8px)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: rotated ? (small ? 14 : 20) : (small ? 18 : 26),
        opacity: 0.35, color: 'white',
      }}>♠</div>
    </div>
  );
};

// ═══════════════════════════════════════════
// FAN HANDS
// ═══════════════════════════════════════════
const NorthHand = ({ count }) => {
  const n = Math.min(count, 10);
  const spread = 20, totalW = n > 1 ? (n - 1) * spread + 42 : 42;
  return (
    <div style={{ position: 'relative', width: totalW, height: 70 }}>
      {Array(n).fill(0).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: i * spread, bottom: 0,
          transform: `rotate(${(i - (n - 1) / 2) * 3}deg)`, transformOrigin: 'bottom center',
        }}>
          <CardBack small />
        </div>
      ))}
    </div>
  );
};

const SideHand = ({ count, side }) => {
  const n = Math.min(count, 10);
  const spread = 14, totalH = n > 1 ? (n - 1) * spread + 42 : 42;
  return (
    <div style={{ position: 'relative', height: totalH, width: 70 }}>
      {Array(n).fill(0).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', top: i * spread,
          [side === 'left' ? 'right' : 'left']: 0,
          transform: `rotate(${side === 'left' ? -90 : 90}deg)`,
          transformOrigin: 'center center',
        }}>
          <CardBack small rotated />
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════
// PLAYER HAND (drag-to-reorder)
// ═══════════════════════════════════════════
const PlayerHand = ({ hand, trick, trump, sel, onSel, onPlay, onReorder }) => {
  const vd = new Set(validCards(hand, trick, trump).map(c => c.id));
  const spread = 52, n = hand.length;
  const totalW = n > 1 ? (n - 1) * spread + 64 : 64;
  const dragIdx = useRef(null);
  const [overIdx, setOverIdx] = useState(null);

  return (
    <div style={{ position: 'relative', width: Math.min(totalW, 700), height: 110, flexShrink: 0 }}>
      {hand.map((card, i) => {
        const isHilite = vd.has(card.id);
        const isSel = sel?.id === card.id;
        const isOver = overIdx === i && dragIdx.current !== i;
        const xPos = n > 1 ? (i / (n - 1)) * (Math.min(totalW, 700) - 64) : 0;
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
              transform: `rotate(${(i - (n - 1) / 2) * 2.5}deg) ${isOver ? 'translateY(-14px)' : ''}`,
              transformOrigin: 'bottom center',
              zIndex: isSel ? 20 : isOver ? 15 : i,
              transition: 'left 0.3s ease, transform 0.15s ease, opacity 0.15s',
              cursor: 'grab', opacity: dragIdx.current === i ? 0.45 : 1,
            }}
          >
            <Card
              card={card} hilite={isHilite} sel={isSel}
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
const TrickArea = ({ trick, trickWinner, perspective = 0 }) => {
  const p = perspective;
  const positions = {
    [p]:        { gridRow: 3, gridColumn: 2 },
    [(p+1)%4]:  { gridRow: 2, gridColumn: 1 },
    [(p+2)%4]:  { gridRow: 1, gridColumn: 2 },
    [(p+3)%4]:  { gridRow: 2, gridColumn: 3 },
  };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 160px 160px',
      gridTemplateRows: '160px 160px 160px',
      gap: 10,
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
                <Card card={play.card} />
                {isWinner && (
                  <div style={{
                    position: 'absolute', top: -10, right: -10,
                    fontSize: 18, animation: 'pulse 0.5s ease-out',
                  }}>⭐</div>
                )}
              </div>
            ) : (
              <div style={{
                width: 96, height: 134, borderRadius: 8,
                border: '2px dashed rgba(255,255,255,0.15)', opacity: 0.5,
              }} />
            )}
          </div>
        );
      })}
      <div style={{
        gridRow: 2, gridColumn: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.15)', fontSize: 28,
      }}>✦</div>
    </div>
  );
};

// ═══════════════════════════════════════════
// LOBBY SCREEN
// ═══════════════════════════════════════════
const Lobby = ({ roomId, players, myPosition, onStart, onLeave }) => {
  const gameUrl = `${window.location.origin}/?room=${roomId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(gameUrl)}`;
  const [copied, setCopied] = useState(false);
  const seatNames = ['Sul ↓', 'Oeste ←', 'Norte ↑', 'Este →'];

  const copyLink = () => {
    navigator.clipboard.writeText(gameUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0c1445 0%, #1a237e 40%, #0d47a1 70%, #0c2461 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', color: 'white', padding: 24, gap: 28,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: '#90caf9', marginBottom: 6 }}>SALA DE JOGO</div>
        <div style={{
          fontSize: 64, fontWeight: 'bold', letterSpacing: 16,
          background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>{roomId}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Código da sala</div>
      </div>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* QR Code */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <img src={qrUrl} alt="QR Code" style={{ borderRadius: 12, border: '3px solid rgba(255,255,255,0.15)' }} />
          <div style={{ fontSize: 11, color: '#64748b' }}>Digitalizar para entrar</div>
        </div>

        {/* Players list */}
        <div style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, padding: '20px 28px', minWidth: 220,
        }}>
          <div style={{ fontSize: 11, color: '#fcd34d', letterSpacing: 2, marginBottom: 14 }}>JOGADORES</div>
          {[0, 1, 2, 3].map(pos => {
            const player = players.find(p => p.position === pos);
            const isMe = pos === myPosition;
            return (
              <div key={pos} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: pos < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: player?.connected ? '#22c55e' : '#334155',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: player ? 'white' : '#475569' }}>
                    {player ? player.name : 'Aguardando…'}
                    {isMe && <span style={{ fontSize: 10, color: '#fcd34d', marginLeft: 6 }}>(você)</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#475569' }}>
                    {seatNames[pos]}
                    {TEAM[pos] === 0 ? ' · Equipa A' : ' · Equipa B'}
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 12, fontSize: 11, color: '#475569' }}>
            Equipas: Sul+Norte vs Oeste+Este
          </div>
        </div>
      </div>

      {/* Link & buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', maxWidth: 400 }}>
        <div style={{
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '8px 16px', fontSize: 11, color: '#64748b',
          wordBreak: 'break-all', textAlign: 'center',
        }}>{gameUrl}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={copyLink} style={{
            padding: '10px 24px', borderRadius: 30, border: '1px solid rgba(255,255,255,0.2)',
            background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
            color: copied ? '#86efac' : 'white', cursor: 'pointer', fontSize: 13,
            fontFamily: 'Georgia, serif',
          }}>
            {copied ? '✓ Copiado!' : '🔗 Copiar Link'}
          </button>
          <button onClick={onStart} style={{
            padding: '10px 32px', borderRadius: 30, border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: 13,
            fontFamily: 'Georgia, serif', letterSpacing: 2,
          }}>
            ▶ INICIAR
          </button>
        </div>
        <button onClick={onLeave} style={{
          background: 'none', border: 'none', color: '#475569',
          cursor: 'pointer', fontSize: 12, fontFamily: 'Georgia, serif',
        }}>
          ← Sair da sala
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// WELCOME SCREEN
// ═══════════════════════════════════════════
const Welcome = ({ onSolo, onCreateRoom, onJoinRoom, wsError, clearError }) => {
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0c1445 0%, #1a237e 40%, #0d47a1 70%, #0c2461 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Georgia, serif', color: 'white', padding: 24,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 40, left: 40, fontSize: 80, opacity: 0.06, pointerEvents: 'none' }}>♠</div>
      <div style={{ position: 'absolute', top: 40, right: 40, fontSize: 80, opacity: 0.06, color: '#dc2626', pointerEvents: 'none' }}>♥</div>
      <div style={{ position: 'absolute', bottom: 40, left: 40, fontSize: 80, opacity: 0.06, color: '#dc2626', pointerEvents: 'none' }}>♦</div>
      <div style={{ position: 'absolute', bottom: 40, right: 40, fontSize: 80, opacity: 0.06, pointerEvents: 'none' }}>♣</div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 36, position: 'relative' }}>
        <div style={{ fontSize: 11, letterSpacing: 8, color: '#90caf9', marginBottom: 8 }}>Jogo de Cartas Português</div>
        <h1 style={{
          fontSize: 88, margin: 0, letterSpacing: 12, fontWeight: 'bold',
          background: 'linear-gradient(135deg, #fcd34d, #f59e0b, #fbbf24)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 40px rgba(245,158,11,0.4))',
        }}>SUECA</h1>
        <div style={{ fontSize: 36, letterSpacing: 20, marginTop: 4 }}>
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
          }}>
            ▶ JOGAR SOLO
          </button>
          <button onClick={() => setView('online')} style={{
            width: '100%', padding: '14px 0', fontSize: 15, borderRadius: 50,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.08)',
            color: 'white', cursor: 'pointer',
            letterSpacing: 2, fontFamily: 'Georgia, serif',
          }}>
            🌐 JOGAR ONLINE
          </button>
          <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', marginTop: 8 }}>
            Solo: você + 3 robôs · Online: até 4 jogadores reais
          </div>
        </div>
      )}

      {view === 'online' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 640 }}>
          {/* Create room */}
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '24px 28px', flex: 1, minWidth: 240,
          }}>
            <div style={{ fontSize: 12, color: '#fcd34d', letterSpacing: 2, marginBottom: 16 }}>CRIAR SALA</div>
            <input
              style={inputStyle} placeholder="O seu nome" value={name}
              onChange={e => { setName(e.target.value); clearError(); }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button onClick={handleCreate} disabled={loading || !name.trim()} style={{
              marginTop: 12, width: '100%', padding: '11px 0', borderRadius: 30, border: 'none',
              background: name.trim() ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.1)',
              color: 'white', fontWeight: 'bold', cursor: name.trim() ? 'pointer' : 'default',
              fontFamily: 'Georgia, serif', fontSize: 13, letterSpacing: 2,
            }}>
              {loading ? 'A ligar…' : '+ CRIAR SALA'}
            </button>
          </div>

          {/* Join room */}
          <div style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '24px 28px', flex: 1, minWidth: 240,
          }}>
            <div style={{ fontSize: 12, color: '#86efac', letterSpacing: 2, marginBottom: 16 }}>ENTRAR EM SALA</div>
            <input
              style={{ ...inputStyle, marginBottom: 8 }} placeholder="O seu nome" value={name}
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
            }}>
              {loading ? 'A ligar…' : '→ ENTRAR'}
            </button>
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
          <div style={{ fontSize: 12, color: '#86efac', letterSpacing: 2, marginBottom: 4 }}>ENTRAR EM SALA</div>
          <div style={{ fontSize: 22, letterSpacing: 10, color: '#fcd34d', marginBottom: 16 }}>{urlRoom}</div>
          <input
            style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 14,
              fontFamily: 'Georgia, serif', outline: 'none', width: '100%' }}
            placeholder="O seu nome" value={name}
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
          }}>
            {loading ? 'A ligar…' : '→ ENTRAR'}
          </button>
          <button onClick={() => setView('main')} style={{
            marginTop: 8, background: 'none', border: 'none', color: '#475569',
            cursor: 'pointer', fontSize: 12, fontFamily: 'Georgia, serif', width: '100%',
          }}>← Voltar</button>
        </div>
      )}

      {view !== 'main' && (
        <button onClick={() => { setView('main'); clearError(); }} style={{
          marginTop: 20, background: 'none', border: 'none', color: '#475569',
          cursor: 'pointer', fontSize: 12, fontFamily: 'Georgia, serif',
        }}>← Menu Principal</button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
// ROUND END OVERLAY
// ═══════════════════════════════════════════
const RoundEnd = ({ roundPts, gamePts, perspective, players, onNewRound, onNewGame }) => {
  const myTeam = TEAM[perspective];
  const myPts = roundPts[myTeam], theirPts = roundPts[1 - myTeam];
  const iWin = myPts >= 61;
  const partnerPos = (perspective + 2) % 4;
  const getName = pos => players.find(p => p.position === pos)?.name || PNAME[pos];
  const myLabel = `${getName(perspective)} + ${getName(partnerPos)}`;
  const theirLabel = `${getName((perspective+1)%4)} + ${getName((perspective+3)%4)}`;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        borderRadius: 24, padding: '40px 48px', textAlign: 'center',
        border: `2px solid ${iWin ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
        boxShadow: `0 24px 80px rgba(0,0,0,0.6)`,
        maxWidth: 400, fontFamily: 'Georgia, serif', color: 'white',
      }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>{iWin ? '🎉' : '😔'}</div>
        <h2 style={{ fontSize: 32, margin: '0 0 4px', color: iWin ? '#86efac' : '#fca5a5' }}>
          {iWin ? 'Vitória!' : 'Derrota!'}
        </h2>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          {iWin ? 'A vossa equipa ganhou esta rodada' : 'Os adversários ganharam esta rodada'}
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
          Partidas ganhas —{' '}
          <span style={{ color: '#86efac', fontWeight: 'bold' }}>Nós: {gamePts[myTeam]}</span>
          {' | '}
          <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>Eles: {gamePts[1 - myTeam]}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onNewRound} style={{
            padding: '12px 32px', fontSize: 15, borderRadius: 30, border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'Georgia, serif',
          }}>Nova Rodada</button>
          <button onClick={onNewGame} style={{
            padding: '12px 32px', fontSize: 15, borderRadius: 30,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontFamily: 'Georgia, serif',
          }}>Novo Jogo</button>
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
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = socket;
    socket.onopen = onOpen;
    socket.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'ROOM_CREATED') {
        setMyPosition(msg.position); setRoomId(msg.roomId);
        setMultiMode(true); setAppView('lobby');
      } else if (msg.type === 'JOINED') {
        setMyPosition(msg.position); setRoomId(msg.roomId);
        setMultiMode(true); setAppView('lobby');
      } else if (msg.type === 'STATE_UPDATE') {
        setWsState(msg.state); setPlayers(msg.players);
        if (msg.state.phase !== 'welcome') setAppView('game');
      } else if (msg.type === 'ERROR') {
        setWsError(msg.message);
      }
    };
    socket.onclose = () => { /* could show reconnect UI */ };
  }, []);

  const handleCreateRoom = useCallback(name => {
    connectWS(() => wsRef.current.send(JSON.stringify({ type: 'CREATE_ROOM', name })));
  }, [connectWS]);

  const handleJoinRoom = useCallback((name, code) => {
    connectWS(() => wsRef.current.send(JSON.stringify({ type: 'JOIN_ROOM', name, roomId: code })));
  }, [connectWS]);

  const handleLeave = () => {
    wsRef.current?.close();
    setMultiMode(false); setWsState(null); setPlayers([]); setRoomId(null);
    setLocalSel(null); setAppView('welcome'); setWsError('');
  };

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
    return (
      <Welcome
        onSolo={() => { localDispatch({ type: 'START' }); setAppView('game'); }}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        wsError={wsError}
        clearError={() => setWsError('')}
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
      />
    );
  }

  if (!state) return null;

  // ── Game render ──
  const isYourTurn = state.phase === 'playing' && state.current === perspective;
  const myTeam = TEAM[perspective];

  const getName = pos => {
    if (!multiMode) return pos === perspective ? 'Você' : PNAME[pos];
    return players.find(p => p.position === pos)?.name || PNAME[pos];
  };
  const isHumanPlayer = pos => multiMode ? players.some(p => p.position === pos) : pos === 0;
  const isPlaying = pos => state.phase === 'playing' && state.current === pos;

  // Trump card visibility and position
  const trumpCardHeld = state.trumpCard &&
    state.hands[state.dealer] &&
    state.hands[state.dealer].some(c => c.id === state.trumpCard.id);
  const dealerSlot = (state.dealer - perspective + 4) % 4; // 0=bottom,1=left,2=top,3=right
  const trumpPos = [
    { bottom: '27%', left: '48%', transform: 'translateX(-50%) rotate(-12deg)' },
    { left: '26%',  top: '46%',  transform: 'translateY(-50%) rotate(10deg)' },
    { top: '13%',   left: '48%', transform: 'translateX(-50%) rotate(12deg)' },
    { left: '63%',  top: '46%',  transform: 'translateY(-50%) rotate(-10deg)' },
  ][dealerSlot] || {};

  const playerLabel = (pos, color, bg, border) => (
    <div style={{
      padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 'bold',
      background: bg, border: `1px solid ${border}`,
      color, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <span>{isHumanPlayer(pos) ? '👤' : '🤖'}</span>
      <span>{getName(pos)}{isPlaying(pos) ? ' …' : ''}</span>
    </div>
  );

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
        padding: '12px 20px',
        background: 'rgba(0,0,0,0.35)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          fontSize: 22, fontWeight: 'bold', letterSpacing: 5,
          background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          cursor: multiMode ? 'default' : 'pointer',
        }}>SUECA</div>

        {/* Scores (always from your perspective: Nós vs Eles) */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[
            { label: 'NÓS', pts: state.roundPts[myTeam], wins: state.gamePts[myTeam], color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
            { label: 'ELES', pts: state.roundPts[1-myTeam], wins: state.gamePts[1-myTeam], color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
          ].map(({ label, pts, wins, color, bg }, i) => (
            <div key={i} style={{ padding: '6px 14px', borderRadius: 12, background: bg, border: `1px solid ${color}44`, textAlign: 'center', minWidth: 70 }}>
              <div style={{ fontSize: 9, color, letterSpacing: 2, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color, lineHeight: 1 }}>{pts}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                {'★'.repeat(wins)}{'☆'.repeat(Math.max(0, 4 - wins))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {state.trump !== null && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '4px 12px', borderRadius: 10,
              background: RED[state.trump] ? 'rgba(220,38,38,0.2)' : 'rgba(30,41,59,0.6)',
              border: `1px solid ${RED[state.trump] ? '#dc2626' : '#64748b'}`,
            }}>
              <div style={{ fontSize: 9, color: '#94a3b8', letterSpacing: 1 }}>TRUNFO</div>
              <div style={{ fontSize: 22, color: RED[state.trump] ? '#f87171' : '#e2e8f0', fontWeight: 'bold', lineHeight: 1 }}>
                {S[state.trump]}
              </div>
            </div>
          )}
          <div style={{ fontSize: 10, color: '#64748b', textAlign: 'right', lineHeight: 1.6 }}>
            {state.tricksLeft} vazas<br />restantes
          </div>
          {multiMode && (
            <div style={{ fontSize: 10, color: '#475569', borderLeft: '1px solid #1e293b', paddingLeft: 10 }}>
              Sala<br /><span style={{ color: '#fcd34d', fontWeight: 'bold', letterSpacing: 2 }}>{roomId}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 5,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 12px', gap: 8,
      }}>

        {/* Floating trump card near dealer */}
        {trumpCardHeld && (
          <div style={{ position: 'absolute', zIndex: 20, pointerEvents: 'none', ...trumpPos }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ fontSize: 9, color: '#fcd34d', letterSpacing: 1, textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                trunfo
              </div>
              <Card card={state.trumpCard} small />
            </div>
          </div>
        )}

        {/* Top player (partner) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {playerLabel(topPos, '#86efac', 'rgba(34,197,94,0.15)', 'rgba(34,197,94,0.3)')}
          <NorthHand count={state.hands[topPos].length} />
        </div>

        {/* Middle row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, width: '100%' }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 90 }}>
            {playerLabel(leftPos, '#fca5a5', 'rgba(239,68,68,0.15)', 'rgba(239,68,68,0.3)')}
            <SideHand count={state.hands[leftPos].length} side="left" />
          </div>

          {/* Center trick area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 12 }}>
              <TrickArea
                trick={state.trick}
                trickWinner={state.phase === 'resolving' ? state.trickWinner : null}
                perspective={perspective}
              />
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 90 }}>
            {playerLabel(rightPos, '#fca5a5', 'rgba(239,68,68,0.15)', 'rgba(239,68,68,0.3)')}
            <SideHand count={state.hands[rightPos].length} side="right" />
          </div>
        </div>

        {/* Message bar */}
        <div style={{
          padding: '8px 20px', borderRadius: 20, maxWidth: 480, width: '100%',
          background: isYourTurn ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.3)',
          border: `1px solid ${isYourTurn ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
          fontSize: 13, color: isYourTurn ? '#86efac' : '#94a3b8',
          textAlign: 'center', transition: 'all 0.3s',
        }}>
          {isYourTurn ? '✨ Sua vez!' : state.msg}
          {isYourTurn && sel && ' · Clique novamente para jogar!'}
        </div>

        {/* Your hand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', overflow: 'visible', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <PlayerHand
              hand={state.hands[perspective]}
              trick={state.trick}
              trump={state.trump}
              sel={sel}
              onSel={card => dispatch({ type: 'SEL', card, pi: perspective })}
              onPlay={card => dispatch({ type: 'PLAY', pi: perspective, card })}
              onReorder={(from, to) => dispatch({ type: 'REORDER_HAND', from, to, pi: perspective })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              padding: '4px 20px', borderRadius: 20, fontSize: 11, fontWeight: 'bold',
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
              color: '#86efac', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>👤</span>
              <span>{getName(perspective)} {isYourTurn ? '← sua vez!' : ''}</span>
            </div>
            <button
              onClick={() => dispatch({ type: 'AUTO_ORDER_HAND', pi: perspective })}
              style={{
                padding: '4px 14px', borderRadius: 20, fontSize: 11, fontWeight: 'bold',
                background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)',
                color: '#fcd34d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
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
        />
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
      `}</style>
    </div>
  );
}
