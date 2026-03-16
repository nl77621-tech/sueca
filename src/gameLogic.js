// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════
export const S = ['♠', '♥', '♦', '♣'];
export const RED = [false, true, true, false];
export const V = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
export const PTS = { A: 11, '7': 10, K: 4, J: 3, Q: 2, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0 };
export const RNK = { A: 9, '7': 8, K: 7, J: 6, Q: 5, '6': 4, '5': 3, '4': 2, '3': 1, '2': 0 };
export const TEAM = [0, 1, 0, 1];
export const PNAME = ['Sul', 'Oeste', 'Norte', 'Este'];

// ═══════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════
export const mkDeck = () =>
  S.flatMap((s, si) => V.map(v => ({ s, si, v, id: `${v}${s}`, p: PTS[v] || 0 })));

export const shuf = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const cRnk = (c, t, l) =>
  c.si === t ? 200 + RNK[c.v] : c.si === l ? 100 + RNK[c.v] : RNK[c.v];

export const trickWinner = (trick, t) => {
  const l = trick[0].card.si;
  let b = 0;
  for (let i = 1; i < trick.length; i++)
    if (cRnk(trick[i].card, t, l) > cRnk(trick[b].card, t, l)) b = i;
  return trick[b].player;
};

export const validCards = (hand, trick, t) => {
  if (!trick.length) return hand;
  const l = trick[0].card.si;
  const f = hand.filter(c => c.si === l);
  return f.length ? f : hand;
};

// ═══════════════════════════════════════════
// AI LOGIC
// ═══════════════════════════════════════════
export const aiPick = (hand, trick, t, me) => {
  const v = validCards(hand, trick, t);
  if (!v.length) return null;
  if (!trick.length) {
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
  if (beats.length && !partnerWins)
    return beats.reduce((b, c) => cRnk(c, t, l) < cRnk(b, t, l) ? c : b, beats[0]);
  if (partnerWins && trick.length === 3) {
    const pts = v.filter(c => c.p > 0 && c.si !== t);
    if (pts.length) return pts.reduce((b, c) => c.p > b.p ? c : b, pts[0]);
  }
  return v.reduce((b, c) => (c.p < b.p || (c.p === b.p && RNK[c.v] < RNK[b.v])) ? c : b, v[0]);
};

// ═══════════════════════════════════════════
// DEAL
// ═══════════════════════════════════════════
export const deal = dealer => {
  const deck = shuf(mkDeck());
  const tc = deck[39];
  const rawHands = [deck.slice(0, 10), deck.slice(10, 20), deck.slice(20, 30), deck.slice(30, 40)];
  const hands = Array(4).fill(null).map((_, i) => {
    if (i === dealer) return rawHands[3];
    const idx = i < dealer ? i : i - 1;
    return rawHands[idx];
  });
  const first = (dealer + 3) % 4; // play goes counter-clockwise (right of dealer leads)
  return { hands, trump: tc.si, trumpCard: tc, current: first, leader: first };
};

// ═══════════════════════════════════════════
// REDUCER
// ═══════════════════════════════════════════
export const INIT = {
  phase: 'welcome',
  hands: [[], [], [], []],
  trump: null, trumpCard: null,
  trick: [], trickWinner: null,
  current: 0, leader: 0, dealer: 0,
  roundPts: [0, 0], gamePts: [0, 0],
  tricksLeft: 10, msg: '', sel: null,
};

export const reduce = (state, action) => {
  switch (action.type) {
    case 'START': {
      const dealer = Math.floor(Math.random() * 4);
      const { hands, trump, trumpCard, current, leader } = deal(dealer);
      return {
        ...INIT, phase: 'playing', hands, trump, trumpCard, current, leader, dealer,
        msg: `Trunfo: ${S[trump]}`,
      };
    }
    case 'NEW_ROUND': {
      const dealer = (state.dealer + 3) % 4; // dealer rotates counter-clockwise
      const { hands, trump, trumpCard, current, leader } = deal(dealer);
      return {
        ...state, phase: 'playing', hands, trump, trumpCard, current, leader, dealer,
        trick: [], trickWinner: null, roundPts: [0, 0], tricksLeft: 10, sel: null,
        msg: `Nova rodada! Trunfo: ${S[trump]}`,
      };
    }
    case 'SEL': {
      const pi = action.pi ?? 0;
      if (state.phase !== 'playing' || state.current !== pi) return state;
      const vd = validCards(state.hands[pi], state.trick, state.trump);
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
        const nxt = (pi + 3) % 4; // counter-clockwise: next player is to the right
        return { ...state, hands: newH, trick: newT, current: nxt, sel: null, msg: `${PNAME[nxt]} a jogar…` };
      }
      const w = trickWinner(newT, state.trump);
      const tp = newT.reduce((s, { card: c }) => s + c.p, 0);
      const rp = [...state.roundPts]; rp[TEAM[w]] += tp;
      const tl = state.tricksLeft - 1;
      if (tl === 0) {
        const gp = [...state.gamePts]; gp[rp[0] >= 61 ? 0 : 1]++;
        return {
          ...state, hands: newH, trick: newT, trickWinner: w,
          roundPts: rp, gamePts: gp, tricksLeft: 0, sel: null, phase: 'round_end',
          msg: `Rodada terminada! A: ${rp[0]} pts | B: ${rp[1]} pts`,
        };
      }
      return {
        ...state, hands: newH, trick: newT, trickWinner: w,
        roundPts: rp, tricksLeft: tl, sel: null, phase: 'resolving',
        msg: `${PNAME[w]} venceu a vaza!${tp > 0 ? ` (+${tp} pts)` : ''}`,
      };
    }
    case 'CLEAR':
      if (state.phase !== 'resolving') return state;
      return {
        ...state, trick: [], trickWinner: null,
        current: state.trickWinner, leader: state.trickWinner,
        phase: 'playing', sel: null,
        msg: `${PNAME[state.trickWinner]} lidera…`,
      };
    case 'REORDER_HAND': {
      const { pi = 0, from, to } = action;
      const hand = [...state.hands[pi]];
      const [moved] = hand.splice(from, 1);
      hand.splice(to, 0, moved);
      return { ...state, hands: state.hands.map((h, i) => i === pi ? hand : h) };
    }
    case 'AUTO_ORDER_HAND': {
      const { pi = 0 } = action;
      const t = state.trump;
      const hand = [...state.hands[pi]];
      const trumps = hand.filter(c => c.si === t).sort((a, b) => RNK[b.v] - RNK[a.v]);
      const others = hand.filter(c => c.si !== t)
        .sort((a, b) => a.si !== b.si ? a.si - b.si : RNK[b.v] - RNK[a.v]);
      return { ...state, hands: state.hands.map((h, i) => i === pi ? [...trumps, ...others] : h) };
    }
    default: return state;
  }
};
