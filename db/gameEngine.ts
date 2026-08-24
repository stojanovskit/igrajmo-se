/* eslint-disable @typescript-eslint/no-explicit-any */
export const GAME_SLUGS = ['ludo', 'memory', 'chess', 'domino', 'sketch', 'tarok', 'ships', 'yamb', 'zandar', 'kugliks'] as const;
export type GameSlug = (typeof GAME_SLUGS)[number];

export type PlayerRoom = {
  host_id: string;
  guest_id: string | null;
  turn_id: string;
  state: any;
  status: 'waiting' | 'playing' | 'finished';
};

export type GameResult = { state: any; turnId: string; status: PlayerRoom['status'] };

const YAMB_CATEGORIES = new Set(['1', '2', '3', '4', '5', '6', 'three', 'straight', 'full', 'poker', 'yamb']);
const otherPlayer = (room: PlayerRoom, id: string) => id === room.host_id ? room.guest_id || room.host_id : room.host_id;
const randomInt = (max: number) => {
  if (!Number.isInteger(max) || max < 1) throw new Error('Невалиден случаен опсег.');
  const limit = 0x100000000 - (0x100000000 % max);
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return values[0] % max;
};
const shuffle = <T,>(source: T[]) => {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

const mkCards = () => shuffle(['♠', '♥', '♦', '♣'].flatMap((suit) => ['A','2','3','4','5','6','7','8','9','10','J','Q','K'].map((rank) => `${rank}${suit}`)));
const rank = (card: string) => card.replace(/[♠♥♦♣]/g, '');
const suit = (card: string) => card.slice(-1);

function initialChess() {
  const board = Array<string>(64).fill('');
  const back = ['R','N','B','Q','K','B','N','R'];
  back.forEach((piece, col) => { board[col] = `b${piece}`; board[8 + col] = 'bP'; board[48 + col] = 'wP'; board[56 + col] = `w${piece}`; });
  return board;
}

function randomShips() {
  const occupied = new Set<number>();
  for (const length of [3, 2, 2]) {
    for (;;) {
      const horizontal = randomInt(2) === 1;
      const row = randomInt(horizontal ? 8 : 9 - length);
      const col = randomInt(horizontal ? 9 - length : 8);
      const cells = Array.from({ length }, (_, step) => (row + (horizontal ? 0 : step)) * 8 + col + (horizontal ? step : 0));
      if (cells.every((cell) => !occupied.has(cell))) { cells.forEach((cell) => occupied.add(cell)); break; }
    }
  }
  return [...occupied];
}

export function initialState(game: GameSlug, hostId: string) {
  if (game === 'memory') return { deck: shuffle([0,0,1,1,2,2,3,3,4,4,5,5]), matched: [], flipped: [], scores: { [hostId]: 0 }, message: 'Чекаме уште еден играч…' };
  if (game === 'ludo') return { positions: { [hostId]: [-1,-1,-1,-1] }, dice: null, message: 'Чекаме уште еден играч…' };
  if (game === 'chess') return { board: initialChess(), message: 'Белите почнуваат.' };
  if (game === 'domino') return { bag: shuffle(Array.from({ length: 7 }, (_, a) => Array.from({ length: 7 - a }, (__, offset) => [a, a + offset])).flat()), hands: {}, chain: [], passed: 0, message: 'Чекаме уште еден играч…' };
  if (game === 'sketch') return { drawerId: hostId, word: '', strokes: [], guesses: [], message: 'Чекаме уште еден играч…' };
  if (game === 'tarok') return { deck: shuffle([...Array.from({length: 22}, (_, i) => `${i + 1}T`), ...['♠','♥','♦','♣'].flatMap((s) => ['K','Q','R','J','10','9','8','7'].map((r) => `${r}${s}`))]), hands: {}, trick: [], tricks: {}, message: 'Чекаме уште еден играч…' };
  if (game === 'ships') return { fleets: { [hostId]: randomShips() }, shots: {}, message: 'Чекаме уште еден играч…' };
  if (game === 'yamb') return { dice: [1,1,1,1,1], held: [false,false,false,false,false], rolls: 0, sheets: { [hostId]: {} }, message: 'Фрли ги коцките.' };
  if (game === 'zandar') { const deck = mkCards(); return { deck, hands: { [hostId]: deck.splice(0,4) }, table: deck.splice(0,4), captured: { [hostId]: [] }, lastCapture: hostId, message: 'Чекаме уште еден играч…' }; }
  return { threats: Array(19).fill(0).map((_, i) => [0,1,2,6,7,11,12,16,17,18].includes(i) && randomInt(100) >= 55 ? 1 : 0), score: 0, health: 5, wave: 1, message: 'Чекаме уште еден бранобранител…' };
}

export function joinState(game: GameSlug, state: any, hostId: string, guestId: string) {
  const next = structuredClone(state);
  if (game === 'memory') next.scores[guestId] = 0;
  if (game === 'ludo') next.positions[guestId] = [-1,-1,-1,-1];
  if (game === 'domino') { next.hands[hostId] = next.bag.splice(0, 7); next.hands[guestId] = next.bag.splice(0, 7); }
  if (game === 'sketch') { const words = ['ајвар','велосипед','сончоглед','чаршија','галеб','телефон','лавиринт','чадор']; next.word = words[randomInt(words.length)]; }
  if (game === 'tarok') { next.hands[hostId] = next.deck.splice(0, 9); next.hands[guestId] = next.deck.splice(0, 9); next.tricks = { [hostId]: 0, [guestId]: 0 }; }
  if (game === 'ships') { next.fleets[guestId] = randomShips(); next.shots[hostId] = []; next.shots[guestId] = []; }
  if (game === 'yamb') next.sheets[guestId] = {};
  if (game === 'zandar') { next.hands[guestId] = next.deck.splice(0,4); next.captured[guestId] = []; }
  next.message = game === 'sketch' ? 'Цртачот го доби зборот.' : 'Партијата започна!';
  return next;
}

function chessPathClear(board: string[], from: number, to: number, rowStep: number, colStep: number) {
  let row = Math.floor(from / 8) + rowStep, col = from % 8 + colStep;
  const endRow = Math.floor(to / 8), endCol = to % 8;
  while (row !== endRow || col !== endCol) { if (board[row * 8 + col]) return false; row += rowStep; col += colStep; }
  return true;
}

function legalChessMove(board: string[], from: number, to: number, color: string) {
  const piece = board[from];
  if (!piece || piece[0] !== color || board[to]?.[0] === color) return false;
  const fr = Math.floor(from / 8), fc = from % 8, tr = Math.floor(to / 8), tc = to % 8;
  const dr = tr - fr, dc = tc - fc, type = piece[1];
  if (type === 'P') { const step = color === 'w' ? -1 : 1, start = color === 'w' ? 6 : 1; return (dc === 0 && !board[to] && (dr === step || (fr === start && dr === step * 2 && !board[(fr + step) * 8 + fc]))) || (Math.abs(dc) === 1 && dr === step && !!board[to]); }
  if (type === 'N') return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
  if (type === 'K') return Math.max(Math.abs(dr), Math.abs(dc)) === 1;
  if (type === 'R' && (dr === 0 || dc === 0)) return chessPathClear(board, from, to, Math.sign(dr), Math.sign(dc));
  if (type === 'B' && Math.abs(dr) === Math.abs(dc)) return chessPathClear(board, from, to, Math.sign(dr), Math.sign(dc));
  if (type === 'Q' && (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return chessPathClear(board, from, to, Math.sign(dr), Math.sign(dc));
  return false;
}

function yambScore(category: string, dice: number[]) {
  const counts = Array.from({ length: 7 }, (_, n) => dice.filter((die) => die === n).length);
  if (/^[1-6]$/.test(category)) return Number(category) * counts[Number(category)];
  const sorted = [...new Set(dice)].sort().join('');
  if (category === 'three') return Math.max(...counts) >= 3 ? dice.reduce((a,b) => a+b, 0) : 0;
  if (category === 'straight') return sorted === '12345' || sorted === '23456' ? 30 : 0;
  if (category === 'full') return counts.includes(3) && counts.includes(2) ? 25 : 0;
  if (category === 'poker') return Math.max(...counts) >= 4 ? 40 : 0;
  if (category === 'yamb') return Math.max(...counts) === 5 ? 50 : 0;
  return dice.reduce((a,b) => a+b, 0);
}

function ludoTarget(position: number, die: number) {
  if (position === 28) return null;
  if (position === -1) return die === 6 ? 0 : null;
  const target = position + die;
  return target <= 28 ? target : null;
}

function dominoFits(tile: number[], chain: number[][]) {
  if (!chain.length) return true;
  const left = chain[0][0], right = chain[chain.length - 1][1];
  return tile.includes(left) || tile.includes(right);
}

function finish(state: any, turnId: string, message: string): GameResult { state.message = message; return { state, turnId, status: 'finished' }; }

export function act(game: GameSlug, room: PlayerRoom, playerId: string, action: string, payload: any): GameResult {
  if (room.status !== 'playing') throw new Error('Почекај го противникот.');
  if (room.turn_id !== playerId && !(game === 'sketch' && action === 'guess')) throw new Error('Сега е ред на противникот.');
  const state = structuredClone(room.state);
  const opponent = otherPlayer(room, playerId);
  let turnId = room.turn_id;

  if (game === 'memory') {
    if (action !== 'flip') throw new Error('Невалиден потег.');
    const index = Number(payload.index);
    if (!Number.isInteger(index) || index < 0 || index >= state.deck.length || state.matched.includes(index) || state.flipped.includes(index) || state.flipped.length >= 2) throw new Error('Тоа поле не може да се отвори.');
    state.flipped.push(index);
    if (state.flipped.length === 1) state.message = 'Отвори уште една карта.';
    else {
      const [a,b] = state.flipped;
      if (state.deck[a] === state.deck[b]) { state.matched.push(a,b); state.flipped = []; state.scores[playerId] = (state.scores[playerId] || 0) + 1; state.message = 'Најде пар — играш повторно!'; if (state.matched.length === state.deck.length) return finish(state, turnId, 'Партијата заврши!'); }
      else { state.resolveAt = Date.now() + 1200; state.message = 'Не е пар — запомни ги картите.'; }
    }
  }

  if (game === 'ludo') {
    if (action === 'roll') {
      if (state.dice) throw new Error('Прво помести фигура.');
      const die = randomInt(6) + 1;
      if (!state.positions[playerId].some((position: number) => ludoTarget(position, die) !== null)) {
        state.dice = null; turnId = opponent; state.message = `Падна ${die}, но нема можен потег.`;
      } else { state.dice = die; state.message = `Падна ${die}. Избери фигура.`; }
    }
    else if (action === 'move') {
      const index = Number(payload.index), die = state.dice;
      if (!die || !Number.isInteger(index) || index < 0 || index > 3) throw new Error('Прво фрли ја коцката.');
      const target = ludoTarget(state.positions[playerId][index], die);
      if (target === null) throw new Error('Таа фигура не може да се помести.');
      state.positions[playerId][index] = target;
      if (target < 24) state.positions[opponent] = state.positions[opponent].map((value: number) => value === target ? -1 : value);
      state.dice = null;
      if (state.positions[playerId].every((value: number) => value === 28)) return finish(state, playerId, 'Сите фигури стигнаа дома!');
      turnId = die === 6 ? playerId : opponent; state.message = die === 6 ? 'Шестка — играш повторно!' : 'Ред е на противникот.';
    } else throw new Error('Невалиден потег.');
  }

  if (game === 'chess') {
    if (action !== 'move') throw new Error('Невалиден потег.');
    const from = Number(payload.from), to = Number(payload.to), color = playerId === room.host_id ? 'w' : 'b';
    if (!legalChessMove(state.board, from, to, color)) throw new Error('Таа фигура не може така да се помести.');
    const captured = state.board[to]; state.board[to] = state.board[from]; state.board[from] = '';
    if (state.board[to][1] === 'P' && [0,7].includes(Math.floor(to / 8))) state.board[to] = `${color}Q`;
    if (captured?.[1] === 'K') return finish(state, playerId, 'Шах-мат — кралот е освоен!');
    turnId = opponent; state.message = 'Потегот е одигран.';
  }

  if (game === 'domino') {
    const hand = state.hands[playerId];
    if (action === 'draw') { if (hand.some((tile: number[]) => dominoFits(tile, state.chain))) throw new Error('Имаш плочка што може да се постави.'); if (!state.bag.length) throw new Error('Нема повеќе плочки.'); hand.push(state.bag.pop()); state.message = 'Извлече плочка.'; }
    else if (action === 'pass') { if (state.bag.length) throw new Error('Прво извлечи плочка.'); if (hand.some((tile: number[]) => dominoFits(tile, state.chain))) throw new Error('Имаш плочка што може да се постави.'); state.passed += 1; turnId = opponent; if (state.passed >= 2) { const my = hand.flat().reduce((a:number,b:number)=>a+b,0), his = state.hands[opponent].flat().reduce((a:number,b:number)=>a+b,0); return finish(state, my <= his ? playerId : opponent, 'Блокирано домино — победи помалиот збир!'); } }
    else if (action === 'place') {
      const index = Number(payload.index), side = payload.side === 'left' ? 'left' : 'right', tile = hand[index]; if (!tile) throw new Error('Нема таква плочка.');
      const placed = [...tile];
      if (state.chain.length) { const wanted = side === 'left' ? state.chain[0][0] : state.chain[state.chain.length - 1][1]; if (!placed.includes(wanted)) throw new Error('Броевите не се совпаѓаат.'); if (side === 'left' && placed[1] !== wanted) placed.reverse(); if (side === 'right' && placed[0] !== wanted) placed.reverse(); }
      hand.splice(index, 1); if (side === 'left') state.chain.unshift(placed); else state.chain.push(placed); state.passed = 0;
      if (!hand.length) return finish(state, playerId, 'Домино! Нема повеќе плочки.'); turnId = opponent; state.message = 'Плочката е поставена.';
    } else throw new Error('Невалиден потег.');
  }

  if (game === 'sketch') {
    if (action === 'stroke') { if (playerId !== state.drawerId) throw new Error('Само цртачот црта.'); const points = Array.isArray(payload.points) ? payload.points.slice(0, 80) : []; if (points.length < 2 || state.strokes.length > 350) throw new Error('Линијата не е валидна.'); state.strokes.push({ points, color: ['#19324a','#ff694f','#4f8df7','#42c49b'].includes(payload.color) ? payload.color : '#19324a' }); }
    else if (action === 'clear') { if (playerId !== state.drawerId) throw new Error('Само цртачот брише.'); state.strokes = []; }
    else if (action === 'guess') { if (playerId === state.drawerId) throw new Error('Цртачот не може да погодува.'); const text = String(payload.text || '').trim().slice(0,30); if (!text) throw new Error('Напиши збор.'); state.guesses.push({ player: playerId, text }); if (text.toLocaleLowerCase('mk') === state.word.toLocaleLowerCase('mk')) return finish(state, playerId, `Точно! Зборот беше „${state.word}“`); state.message = `Обид: ${text}`; }
    else throw new Error('Невалиден потег.');
  }

  if (game === 'tarok') {
    if (action !== 'play') throw new Error('Невалиден потег.'); const hand = state.hands[playerId], index = Number(payload.index), card = hand[index]; if (!card) throw new Error('Нема таква карта.');
    if (state.trick.length) { const lead = suit(state.trick[0].card), cardSuit = suit(card), hasLead = hand.some((item:string) => suit(item) === lead); if (cardSuit !== lead && hasLead) throw new Error('Мора да ја следиш бојата.'); if (lead !== 'T' && cardSuit !== 'T' && !hasLead && hand.some((item:string) => suit(item) === 'T')) throw new Error('Мора да одиграш тарок.'); }
    hand.splice(index,1); state.trick.push({ player: playerId, card });
    if (state.trick.length === 1) { turnId = opponent; state.message = 'Противникот ја затвора раката.'; }
    else {
      const [first, second] = state.trick; const aSuit = suit(first.card), bSuit = suit(second.card); const value = (cardValue:string) => suit(cardValue) === 'T' ? 100 + Number(cardValue.slice(0, -1)) : ['7','8','9','10','J','R','Q','K'].indexOf(rank(cardValue));
      const winner = bSuit === 'T' && aSuit !== 'T' || (aSuit === bSuit && value(second.card) > value(first.card)) ? second.player : first.player;
      state.tricks[winner] = (state.tricks[winner] || 0) + 1; state.trick = []; turnId = winner; state.message = `${winner === playerId ? 'Ти' : 'Противникот'} ја зеде раката.`;
      if (!state.hands[playerId].length && !state.hands[opponent].length) return finish(state, state.tricks[playerId] >= state.tricks[opponent] ? playerId : opponent, 'Тарок партијата заврши!');
    }
  }

  if (game === 'ships') {
    if (action !== 'shoot') throw new Error('Невалиден потег.'); const cell = Number(payload.cell); if (!Number.isInteger(cell) || cell < 0 || cell >= 64 || state.shots[playerId].includes(cell)) throw new Error('Избери ново поле.');
    state.shots[playerId].push(cell); const hit = state.fleets[opponent].includes(cell); const hits = state.shots[playerId].filter((shot:number) => state.fleets[opponent].includes(shot));
    if (hits.length === state.fleets[opponent].length) return finish(state, playerId, 'Целата флота е потопена!'); turnId = opponent; state.message = hit ? 'Погодок!' : 'Промашување.';
  }

  if (game === 'yamb') {
    if (action === 'roll') { if (state.rolls >= 3) throw new Error('Избери поле за запишување.'); state.dice = state.dice.map((die:number, index:number) => state.held[index] ? die : randomInt(6) + 1); state.rolls += 1; state.message = `Фрлање ${state.rolls} од 3.`; }
    else if (action === 'hold') { if (!state.rolls) throw new Error('Прво фрли ги коцките.'); const index = Number(payload.index); if (!Number.isInteger(index) || index < 0 || index >= 5) throw new Error('Избери валидна коцка.'); state.held[index] = !state.held[index]; }
    else if (action === 'score') { const category = String(payload.category); if (!YAMB_CATEGORIES.has(category) || !state.rolls || state.sheets[playerId][category] !== undefined) throw new Error('Тоа поле не може да се запише.'); state.sheets[playerId][category] = yambScore(category, state.dice); state.dice = [1,1,1,1,1]; state.held = [false,false,false,false,false]; state.rolls = 0; turnId = opponent; const totalFields = Object.keys(state.sheets[playerId]).length + Object.keys(state.sheets[opponent]).length; if (totalFields >= 22) { const total = (id:string) => Object.values(state.sheets[id]).reduce((a:number,b:any)=>a+Number(b),0); return finish(state, total(playerId) >= total(opponent) ? playerId : opponent, 'Јамб листата е пополнета!'); } state.message = 'Запишано — ред е на противникот.'; }
    else throw new Error('Невалиден потег.');
  }

  if (game === 'zandar') {
    if (action !== 'play') throw new Error('Невалиден потег.'); const hand = state.hands[playerId], index = Number(payload.index), card = hand[index]; if (!card) throw new Error('Нема таква карта.'); hand.splice(index,1);
    const top = state.table[state.table.length - 1], captures = top && (rank(card) === rank(top) || rank(card) === 'J');
    if (captures) { state.captured[playerId].push(...state.table, card); state.table = []; state.lastCapture = playerId; state.message = rank(card) === 'J' ? 'Жандар — ја собра целата маса!' : 'Го погоди бројот и ја собра масата!'; } else { state.table.push(card); state.message = 'Картата е на маса.'; }
    turnId = opponent;
    if (!hand.length && !state.hands[opponent].length) { if (state.deck.length) { state.hands[playerId].push(...state.deck.splice(0,4)); state.hands[opponent].push(...state.deck.splice(0,4)); } else { state.captured[state.lastCapture].push(...state.table); state.table = []; const mine = state.captured[playerId].length, theirs = state.captured[opponent].length; return finish(state, mine >= theirs ? playerId : opponent, 'Последната рака е одиграна!'); } }
  }

  if (game === 'kugliks') {
    if (action !== 'defend') throw new Error('Невалиден потег.'); const cell = Number(payload.cell); if (!Number.isInteger(cell) || cell < 0 || cell >= 19) throw new Error('Избери шестоаголник.');
    if (state.threats[cell] > 0) { state.threats[cell] -= 1; state.score += 1; }
    else state.message = 'Таму беше мирно — внимавај на рабовите.';
    for (let count = 0; count < Math.min(3, 1 + Math.floor(state.wave / 3)); count += 1) { const edges = [0,1,2,3,6,7,11,12,15,16,17,18]; const edge = edges[randomInt(edges.length)]; state.threats[edge] += 1; if (state.threats[edge] > 3) { state.threats[edge] = 2; state.health -= 1; } }
    state.wave += 1; turnId = opponent; if (state.score >= 18) return finish(state, playerId, 'Одбраната успеа — градот е безбеден!'); if (state.health <= 0) return finish(state, opponent, 'Одбраната падна. Обидете се повторно!'); state.message = `Бран ${state.wave} — бранете го јадрото заедно.`;
  }

  return { state, turnId, status: 'playing' };
}

export function publicState(game: GameSlug, state: any, playerId: string) {
  const view = structuredClone(state);
  if (game === 'domino' || game === 'tarok' || game === 'zandar') Object.keys(view.hands || {}).forEach((id) => { if (id !== playerId) view.hands[id] = Array(view.hands[id].length).fill(null); });
  if (game === 'ships') { const shots = new Set(view.shots?.[playerId] || []); Object.keys(view.fleets || {}).forEach((id) => { if (id !== playerId) view.fleets[id] = view.fleets[id].filter((cell: number) => shots.has(cell)); }); }
  if (game === 'sketch' && playerId !== view.drawerId) view.word = '';
  return view;
}

