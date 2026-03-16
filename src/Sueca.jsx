import { useReducer, useEffect, useRef, useState } from "react";

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════
const S = ['♠', '♥', '♦', '♣'];
const RED = [false, true, true, false];
const V = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
const PTS = { A: 11, '7': 10, K: 4, J: 3, Q: 2, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
const RNK = { A: 9, '7': 8, K: 7, J: 6, Q: 5, '6': 4, '5': 3, '4': 2, '3': 1, '2': 0 };
const TEAM = [0, 1, 0, 1];
const PNAME = ['Você', 'Oeste', 'Norte', 'Este'];

// ═══════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════
const mkDeck = () =>
  S.flatMap((s, si) => V.map(v => ({ s, si, v, id: `${v}${s}`, p: PTS[v] || 0 })));

const shuf = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const cRnk = (c, t, l) =>
  c.si === t ? 200 + RNK[c.v] : c.si === l ? 100 + RNK[c.v] : RNK[c.v];

const trickWinner = (trick, t) => {
  const l = trick[0].card.si;
  let b = 0;
  for (let i = 1; i < trick.length; i++)
    if (cRnk(trick[i].card, t, l) > cRnk(trick[b].card, t, l)) b = i;
  return trick[b].player;
};

const validCards = (hand, trick, t) => {
  if (!trick.length) return hand;
  const l = trick[0].card.si;
  const f = hand.filter(c => c.si === l);
  return f.length ? f : hand;
};

// ═══════════════════════════════════════════
// AI LOGIC
// ═══════════════════════════════════════════
const aiPick = (hand, trick, t, me) => {
  const v = validCards(hand, trick, t);
  if (!v.length) return null;

  if (!trick.length) {
    // Leading: play highest non-trump card (prefer aces and 7s)
    const nt = v.filter(c => c.si !== t);
    const pool = nt.length ? nt : v;
    return pool.reduce((b, c) => RNK[c.v] > RNK[b.v] ? c : b, pool[0]);
  }

  const l = trick[0].card.si;
  let bi = 0;
  for (let i = 1; i < trick.length; i++)
    if (cRnk(trick[i].card, t, l) > cRnk(trick[bi].card, t, l)) bi = i;

  const partnerWins = TEAM[trick[bi].player] === TEAM[me];
  const beats = v.filter(c => cRnk(c, t, l) > cRnk(trick[bi].card, t, l));

  if (beats.length && !partnerWins) {
    // Win with minimum card needed
    return beats.reduce((b, c) => cRnk(c, t, l) < cRnk(b, t, l) ? c : b, beats[0]);
  }

  if (partnerWins && trick.length === 3) {
    // Partner wins, last to play: dump highest-point non-trump
    const pts = v.filter(c => c.p > 0 && c.si !== t);
    if (pts.length) return pts.reduce((b, c) => c.p > b.p ? c : b, pts[0]);
  }

  // Dump lowest-value card
  return v.reduce((b, c) => (c.p < b.p || (c.p === b.p && RNK[c.v] < RNK[b.v])) ? c : b, v[0]);
};

// ═══════════════════════════════════════════
// GAME REDUCER
// ═══════════════════════════════════════════
const deal = dealer => {
  const deck = shuf(mkDeck());
  const tc = deck[39]; // last card is always the trump card
  // rawHands[3] always contains tc; rotate so dealer gets rawHands[3]
  const rawHands = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30), deck.slice(30, 40)];
  const hands = Array(4).fill(null).map((_, i) => {
    if (i === dealer) return rawHands[3];
    const idx = i < dealer ? i : i - 1;
    return rawHands[idx];
  });
  const first = (dealer + 1) % 4;
  return { hands, trump: tc.si, trumpCard: tc, current: first, leader: first };
};

const INIT = {
  phase: 'welcome',
  hands: [[], [], [], []],
  trump: null, trumpCard: null,
  trick: [], trickWinner: null,
  current: 0, leader: 0, dealer: 0,
  roundPts: [0, 0], gamePts: [0, 0],
  tricksLeft: 10, msg: '', sel: null,
};

const reduce = (state, action) => {
  switch (action.type) {
    case 'START': {
      const dealer = Math.floor(Math.random() * 4);
      const { hands, trump, trumpCard, current, leader } = deal(dealer);
      return {
        ...INIT, phase: 'playing', hands, trump, trumpCard, current, leader, dealer,
        msg: `Trunfo: ${S[trump]} ${current === 0 ? '— Sua vez!' : '— Vez de ' + PNAME[current]}`
      };
    }
    case 'NEW_ROUND': {
      const dealer = (state.dealer + 1) % 4;
      const { hands, trump, trumpCard, current, leader } = deal(dealer);
      return {
        ...state, phase: 'playing', hands, trump, trumpCard, current, leader, dealer,
        trick: [], trickWinner: null, roundPts: [0, 0], tricksLeft: 10, sel: null,
        msg: `Nova rodada! Trunfo: ${S[trump]}`
      };
    }
    case 'SEL': {
      if (state.phase !== 'playing' || state.current !== 0) return state;
      const vd = validCards(state.hands[0], state.trick, state.trump);
      if (!vd.some(c => c.id === action.card.id)) return state;
      return { ...state, sel: state.sel?.id === action.card.id ? null : action.card };
    }
    case 'PLAY': {
      const { pi, card } = action;
      if (state.phase !== 'playing' || state.current !== pi) return state;
      const vd = validCards(state.hands[pi], state.trick, state.trump);
      if (!vd.some(c => c.id === card.id)) return state;

      const newH = state.hands.map((h, i) => i === pi ? h.filter(c => c.id !== card.id) : h);
      const newT = [...state.trick, { player: pi, card }];

      if (newT.length < 4) {
        const nxt = (pi + 1) % 4;
        return {
          ...state, hands: newH, trick: newT, current: nxt, sel: null,
          msg: nxt === 0 ? '✨ Sua vez!' : `Vez de ${PNAME[nxt]}…`
        };
      }

      // Trick complete
      const w = trickWinner(newT, state.trump);
      const tp = newT.reduce((s, { card: c }) => s + c.p, 0);
      const rp = [...state.roundPts]; rp[TEAM[w]] += tp;
      const tl = state.tricksLeft - 1;

      if (tl === 0) {
        const aWins = rp[0] >= 61;
        const gp = [...state.gamePts]; gp[aWins ? 0 : 1]++;
        return {
          ...state, hands: newH, trick: newT, trickWinner: w,
          roundPts: rp, gamePts: gp, tricksLeft: 0, sel: null, phase: 'round_end',
          msg: `Rodada terminada! Nós: ${rp[0]} | Eles: ${rp[1]}`
        };
      }

      return {
        ...state, hands: newH, trick: newT, trickWinner: w,
        roundPts: rp, tricksLeft: tl, sel: null, phase: 'resolving',
        msg: `${PNAME[w]} venceu a vaza!${tp > 0 ? ` (+${tp} pts)` : ''}`
      };
    }
    case 'CLEAR':
      if (state.phase !== 'resolving') return state;
      return {
        ...state, trick: [], trickWinner: null,
        current: state.trickWinner, leader: state.trickWinner,
        phase: 'playing', sel: null,
        msg: state.trickWinner === 0 ? '✨ Você lidera! Escolha uma carta.' : `${PNAME[state.trickWinner]} lidera…`
      };
    case 'REORDER_HAND': {
      const { from, to } = action;
      const hand = [...state.hands[0]];
      const [moved] = hand.splice(from, 1);
      hand.splice(to, 0, moved);
      return { ...state, hands: state.hands.map((h, i) => i === 0 ? hand : h) };
    }
    default: return state;
  }
};

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
        : hilite
          ? '0 4px 12px rgba(34,197,94,0.3)'
          : '0 2px 8px rgba(0,0,0,0.25)',
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
      <div style={{
        fontSize: small ? 13 : 18, lineHeight: 1.15,
        alignSelf: 'flex-end', transform: 'rotate(180deg)',
      }}>
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
        background: `repeating-linear-gradient(
          45deg, transparent, transparent 4px,
          rgba(255,255,255,0.06) 4px, rgba(255,255,255,0.06) 8px
        )`,
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
  const spread = 20;
  const totalW = n > 1 ? (n - 1) * spread + 42 : 42;
  return (
    <div style={{ position: 'relative', width: totalW, height: 70 }}>
      {Array(n).fill(0).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: i * spread,
          bottom: 0,
          transform: `rotate(${(i - (n - 1) / 2) * 3}deg)`,
          transformOrigin: 'bottom center',
        }}>
          <CardBack small />
        </div>
      ))}
    </div>
  );
};

const SideHand = ({ count, side }) => {
  const n = Math.min(count, 10);
  const spread = 14;
  const totalH = n > 1 ? (n - 1) * spread + 42 : 42;
  return (
    <div style={{ position: 'relative', height: totalH, width: 70 }}>
      {Array(n).fill(0).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: i * spread,
          left: side === 'left' ? 'auto' : 0,
          right: side === 'left' ? 0 : 'auto',
          transform: `rotate(${side === 'left' ? -90 : 90}deg) rotate(${(i - (n - 1) / 2) * 3}deg)`,
          transformOrigin: 'center center',
        }}>
          <CardBack small rotated />
        </div>
      ))}
    </div>
  );
};

const PlayerHand = ({ hand, trick, trump, sel, onSel, onPlay, onReorder }) => {
  const vd = new Set(validCards(hand, trick, trump).map(c => c.id));
  const spread = 52;
  const n = hand.length;
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
            onDragStart={e => {
              dragIdx.current = i;
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={e => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overIdx !== i) setOverIdx(i);
            }}
            onDragLeave={() => setOverIdx(null)}
            onDrop={e => {
              e.preventDefault();
              if (dragIdx.current !== null && dragIdx.current !== i) {
                onReorder(dragIdx.current, i);
              }
              dragIdx.current = null;
              setOverIdx(null);
            }}
            onDragEnd={() => {
              dragIdx.current = null;
              setOverIdx(null);
            }}
            style={{
              position: 'absolute',
              left: xPos,
              bottom: 0,
              transform: `rotate(${(i - (n - 1) / 2) * 2.5}deg) ${isOver ? 'translateY(-14px)' : ''}`,
              transformOrigin: 'bottom center',
              zIndex: isSel ? 20 : isOver ? 15 : i,
              transition: 'left 0.3s ease, transform 0.15s ease, opacity 0.15s',
              cursor: 'grab',
              opacity: dragIdx.current === i ? 0.45 : 1,
            }}
          >
            <Card
              card={card}
              hilite={isHilite}
              sel={isSel}
              onClick={() => {
                if (!isHilite) return;
                if (isSel) onPlay(card);
                else onSel(card);
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════
// TRICK AREA
// ═══════════════════════════════════════════
const TrickArea = ({ trick, trickWinner }) => {
  const positions = {
    0: { gridRow: 3, gridColumn: 2, label: 'Você' },
    2: { gridRow: 1, gridColumn: 2, label: 'Norte' },
    1: { gridRow: 2, gridColumn: 1, label: 'Oeste' },
    3: { gridRow: 2, gridColumn: 3, label: 'Este' },
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
              <div style={{
                position: 'relative',
                animation: 'cardSlide 0.3s cubic-bezier(.4,0,.2,1)',
              }}>
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
                border: '2px dashed rgba(255,255,255,0.15)',
                opacity: 0.5,
              }} />
            )}
          </div>
        );
      })}
      {/* Center decoration */}
      <div style={{
        gridRow: 2, gridColumn: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.15)', fontSize: 28,
      }}>✦</div>
    </div>
  );
};

// ═══════════════════════════════════════════
// TRUMP BADGE
// ═══════════════════════════════════════════
const TrumpBadge = ({ trump, trumpCard }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  }}>
    <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>Trunfo</div>
    <div style={{
      padding: '4px 10px', borderRadius: 12,
      background: RED[trump] ? 'rgba(220,38,38,0.2)' : 'rgba(30,41,59,0.6)',
      border: `1px solid ${RED[trump] ? '#dc2626' : '#64748b'}`,
      color: RED[trump] ? '#f87171' : '#e2e8f0',
      fontSize: 20, fontWeight: 'bold',
    }}>
      {S[trump]}
    </div>
    {trumpCard && (
      <div style={{ marginTop: 4 }}>
        <Card card={trumpCard} small />
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════
// WELCOME SCREEN
// ═══════════════════════════════════════════
const Welcome = ({ onStart }) => (
  <div style={{
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0c1445 0%, #1a237e 40%, #0d47a1 70%, #0c2461 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Georgia, serif', color: 'white', padding: 24,
    position: 'relative', overflow: 'hidden',
  }}>
    {/* Decorative tiles background */}
    <div style={{
      position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none',
      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px),
                        repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,1) 40px, rgba(255,255,255,1) 41px)`,
    }} />

    {/* Suit decorations */}
    <div style={{ position: 'absolute', top: 40, left: 40, fontSize: 80, opacity: 0.06, pointerEvents: 'none' }}>♠</div>
    <div style={{ position: 'absolute', top: 40, right: 40, fontSize: 80, opacity: 0.06, color: '#dc2626', pointerEvents: 'none' }}>♥</div>
    <div style={{ position: 'absolute', bottom: 40, left: 40, fontSize: 80, opacity: 0.06, color: '#dc2626', pointerEvents: 'none' }}>♦</div>
    <div style={{ position: 'absolute', bottom: 40, right: 40, fontSize: 80, opacity: 0.06, pointerEvents: 'none' }}>♣</div>

    {/* Title */}
    <div style={{ textAlign: 'center', marginBottom: 48, position: 'relative' }}>
      <div style={{ fontSize: 11, letterSpacing: 8, color: '#90caf9', marginBottom: 8, textTransform: 'uppercase' }}>
        Jogo de Cartas Português
      </div>
      <h1 style={{
        fontSize: 96, margin: 0, letterSpacing: 12, fontWeight: 'bold',
        background: 'linear-gradient(135deg, #fcd34d, #f59e0b, #fbbf24)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        filter: 'drop-shadow(0 0 40px rgba(245,158,11,0.4))',
      }}>
        SUECA
      </h1>
      <div style={{ fontSize: 36, letterSpacing: 20, marginTop: 8 }}>
        <span>♠</span>
        <span style={{ color: '#dc2626' }}>♥</span>
        <span style={{ color: '#dc2626' }}>♦</span>
        <span>♣</span>
      </div>
    </div>

    {/* Rules card */}
    <div style={{
      background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20,
      padding: '24px 36px', maxWidth: 480, marginBottom: 40, width: '100%',
    }}>
      <div style={{ fontSize: 13, color: '#fcd34d', fontWeight: 'bold', marginBottom: 16, textAlign: 'center', letterSpacing: 2 }}>
        COMO JOGAR
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
        <div>
          <div style={{ color: '#86efac', fontWeight: 'bold', marginBottom: 4 }}>Equipas</div>
          <div>Você + Norte vs Oeste + Este</div>
        </div>
        <div>
          <div style={{ color: '#86efac', fontWeight: 'bold', marginBottom: 4 }}>Objectivo</div>
          <div>Ganhar ≥ 61 pontos por rodada</div>
        </div>
        <div>
          <div style={{ color: '#fcd34d', fontWeight: 'bold', marginBottom: 4 }}>Pontuação</div>
          <div>Ás=11 &nbsp; 7=10 &nbsp; Rei=4<br />Valete=3 &nbsp; Dama=2</div>
        </div>
        <div>
          <div style={{ color: '#fcd34d', fontWeight: 'bold', marginBottom: 4 }}>Regras</div>
          <div>Siga o naipe ou jogue qualquer carta</div>
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
        Clique numa carta para a seleccionar · Clique novamente para jogar
      </div>
    </div>

    <button onClick={onStart} style={{
      padding: '16px 64px', fontSize: 18, borderRadius: 50, border: 'none',
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      color: 'white', fontWeight: 'bold', cursor: 'pointer',
      letterSpacing: 4, fontFamily: 'Georgia, serif',
      boxShadow: '0 4px 24px rgba(245,158,11,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
      onMouseEnter={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 8px 32px rgba(245,158,11,0.7)'; }}
      onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 4px 24px rgba(245,158,11,0.5)'; }}
    >
      JOGAR
    </button>
  </div>
);

// ═══════════════════════════════════════════
// ROUND END OVERLAY
// ═══════════════════════════════════════════
const RoundEnd = ({ roundPts, gamePts, onNewRound, onNewGame }) => {
  const aWins = roundPts[0] >= 61;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        borderRadius: 24, padding: '40px 48px', textAlign: 'center',
        border: `2px solid ${aWins ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
        boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px ${aWins ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
        maxWidth: 400, fontFamily: 'Georgia, serif', color: 'white',
      }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>{aWins ? '🎉' : '😔'}</div>
        <h2 style={{
          fontSize: 32, margin: '0 0 4px',
          color: aWins ? '#86efac' : '#fca5a5',
        }}>
          {aWins ? 'Vitória!' : 'Derrota!'}
        </h2>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          {aWins ? 'A vossa equipa ganhou esta rodada' : 'Os adversários ganharam esta rodada'}
        </div>

        {/* Score bars */}
        <div style={{ marginBottom: 24 }}>
          {[
            { label: 'Nós (Você + Norte)', pts: roundPts[0], color: '#22c55e', team: 0 },
            { label: 'Eles (Oeste + Este)', pts: roundPts[1], color: '#ef4444', team: 1 },
          ].map(({ label, pts, color }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                <span>{label}</span>
                <span style={{ color, fontWeight: 'bold' }}>{pts} pts</span>
              </div>
              <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: color, borderRadius: 4,
                  width: `${(pts / 120) * 100}%`,
                  transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{
          padding: '12px 20px', background: 'rgba(255,255,255,0.05)',
          borderRadius: 12, marginBottom: 24, fontSize: 13, color: '#94a3b8',
        }}>
          Partidas ganhas — <span style={{ color: '#86efac', fontWeight: 'bold' }}>Nós: {gamePts[0]}</span>
          {' '} | {' '}
          <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>Eles: {gamePts[1]}</span>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onNewRound} style={{
            padding: '12px 32px', fontSize: 15, borderRadius: 30, border: 'none',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white', fontWeight: 'bold', cursor: 'pointer',
            fontFamily: 'Georgia, serif', letterSpacing: 1,
          }}>
            Nova Rodada
          </button>
          <button onClick={onNewGame} style={{
            padding: '12px 32px', fontSize: 15, borderRadius: 30,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent', color: '#94a3b8', cursor: 'pointer',
            fontFamily: 'Georgia, serif',
          }}>
            Novo Jogo
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN GAME
// ═══════════════════════════════════════════
export default function Sueca() {
  const [state, dispatch] = useReducer(reduce, INIT);

  // Clear resolved trick after delay
  useEffect(() => {
    if (state.phase !== 'resolving') return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR' }), 1600);
    return () => clearTimeout(t);
  }, [state.phase, state.trick.length]);

  // AI plays
  useEffect(() => {
    if (state.phase !== 'playing' || state.current === 0) return;
    const delay = 700 + Math.random() * 500;
    const t = setTimeout(() => {
      const card = aiPick(state.hands[state.current], state.trick, state.trump, state.current);
      if (card) dispatch({ type: 'PLAY', pi: state.current, card });
    }, delay);
    return () => clearTimeout(t);
  }, [state.phase, state.current, state.trick, state.hands, state.trump]);

  if (state.phase === 'welcome') {
    return <Welcome onStart={() => dispatch({ type: 'START' })} />;
  }

  const isYourTurn = state.phase === 'playing' && state.current === 0;
  const showTrick = state.phase === 'resolving' || (state.phase === 'playing' && state.trick.length > 0) || state.phase === 'round_end';
  // Trump card is visible only while the DEALER still holds it
  const trumpCardHeld = state.trumpCard &&
    state.hands[state.dealer] &&
    state.hands[state.dealer].some(c => c.id === state.trumpCard.id);
  // Position trump card between dealer's hand and trick area
  const trumpPos = [
    { bottom: '27%', left: '48%', transform: 'translateX(-50%) rotate(-12deg)' },  // dealer=0 (south/you)
    { left: '26%',  top: '46%',  transform: 'translateY(-50%) rotate(10deg)' },    // dealer=1 (west)
    { top: '13%',   left: '48%', transform: 'translateX(-50%) rotate(12deg)' },    // dealer=2 (north)
    { left: '63%',  top: '46%',  transform: 'translateY(-50%) rotate(-10deg)' },   // dealer=3 (east)
  ][state.dealer] || {};

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 30%, #1b5e20 0%, #145214 40%, #0a3300 100%)',
      fontFamily: 'Georgia, serif', color: 'white',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Felt texture overlay */}
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
        }}>SUECA</div>

        {/* Scores */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[
            { label: 'NÓS', pts: state.roundPts[0], wins: state.gamePts[0], color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
            { label: 'ELES', pts: state.roundPts[1], wins: state.gamePts[1], color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
          ].map(({ label, pts, wins, color, bg }, i) => (
            <div key={i} style={{
              padding: '6px 14px', borderRadius: 12,
              background: bg, border: `1px solid ${color}44`,
              textAlign: 'center', minWidth: 70,
            }}>
              <div style={{ fontSize: 9, color: color, letterSpacing: 2, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: color, lineHeight: 1 }}>{pts}</div>
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
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 5,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 12px',
        gap: 8,
      }}>

        {/* Floating trump card near dealer */}
        {trumpCardHeld && (
          <div style={{
            position: 'absolute', zIndex: 20, pointerEvents: 'none',
            ...trumpPos,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ fontSize: 9, color: '#fcd34d', letterSpacing: 1, textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                trunfo
              </div>
              <Card card={state.trumpCard} small />
            </div>
          </div>
        )}

        {/* North player */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{
            padding: '4px 16px', borderRadius: 20, fontSize: 11, fontWeight: 'bold',
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
            color: '#86efac', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>🤖</span>
            <span>Norte — Parceiro</span>
            {state.current === 2 && state.phase === 'playing' && (
              <span style={{ color: '#fcd34d', animation: 'none' }}>⟵ a jogar…</span>
            )}
          </div>
          <NorthHand count={state.hands[2].length} />
        </div>

        {/* Middle row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 20, width: '100%',
        }}>
          {/* West */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 90 }}>
            <div style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 'bold',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', whiteSpace: 'nowrap',
            }}>
              🤖 Oeste {state.current === 1 && state.phase === 'playing' ? '…' : ''}
            </div>
            <SideHand count={state.hands[1].length} side="left" />
          </div>

          {/* Center: trick area only */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.06)',
              padding: 12,
            }}>
              <TrickArea
                trick={state.trick}
                trickWinner={state.phase === 'resolving' ? state.trickWinner : null}
              />
            </div>
          </div>

          {/* East */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 90 }}>
            <div style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 'bold',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', whiteSpace: 'nowrap',
            }}>
              🤖 Este {state.current === 3 && state.phase === 'playing' ? '…' : ''}
            </div>
            <SideHand count={state.hands[3].length} side="right" />
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
          {state.msg}
          {isYourTurn && state.sel && ' · Clique novamente para jogar!'}
        </div>

        {/* Human hand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{
            position: 'relative',
            overflow: 'visible',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <PlayerHand
              hand={state.hands[0]}
              trick={state.trick}
              trump={state.trump}
              sel={state.sel}
              onSel={card => dispatch({ type: 'SEL', card })}
              onPlay={card => dispatch({ type: 'PLAY', pi: 0, card })}
              onReorder={(from, to) => dispatch({ type: 'REORDER_HAND', from, to })}
            />
          </div>
          <div style={{
            padding: '4px 20px', borderRadius: 20, fontSize: 11, fontWeight: 'bold',
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
            color: '#86efac', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>👤</span>
            <span>Você {isYourTurn ? '← sua vez!' : ''}</span>
          </div>
        </div>
      </div>

      {/* Round end overlay */}
      {state.phase === 'round_end' && (
        <RoundEnd
          roundPts={state.roundPts}
          gamePts={state.gamePts}
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
      `}</style>
    </div>
  );
}
