import { strict as assert } from 'node:assert';
import test from 'node:test';
import { act, GAME_SLUGS, initialState, joinState, publicState, type GameSlug } from '../db/gameEngine.ts';

const host = 'host-player';
const guest = 'guest-player';

function room(game: GameSlug) {
  const state = joinState(game, initialState(game, host), host, guest);
  return { host_id: host, guest_id: guest, turn_id: host, state, status: 'playing' as const };
}

function advance(current: ReturnType<typeof room>, result: ReturnType<typeof act>) {
  return { ...current, state: result.state, turn_id: result.turnId, status: result.status };
}

test('all ten games create and join an account-free two-player room', () => {
  for (const game of GAME_SLUGS) {
    const joined = room(game);
    assert.ok(joined.state);
    assert.equal(joined.status, 'playing');
  }
});

test('every game accepts a representative legal first move', () => {
  const moves: Record<GameSlug, [string, Record<string, unknown>]> = {
    memory: ['flip', { index: 0 }],
    ludo: ['roll', {}],
    chess: ['move', { from: 52, to: 36 }],
    domino: ['place', { index: 0, side: 'right' }],
    sketch: ['stroke', { points: [10, 10, 100, 100] }],
    tarok: ['play', { index: 0 }],
    ships: ['shoot', { cell: 0 }],
    yamb: ['roll', {}],
    zandar: ['play', { index: 0 }],
    kugliks: ['defend', { cell: 0 }],
  };
  for (const game of GAME_SLUGS) {
    const current = room(game);
    const [action, payload] = moves[game];
    const result = act(game, current, host, action, payload);
    assert.ok(result.state, `${game} returned state`);
  }
});

test('private hands, ships, and sketch words stay hidden from the opponent', () => {
  for (const game of ['domino', 'tarok', 'zandar'] as const) {
    const current = room(game);
    const view = publicState(game, current.state, host);
    assert.ok(view.hands[guest].every((card: unknown) => card === null));
  }
  const ships = room('ships');
  assert.deepEqual(publicState('ships', ships.state, host).fleets[guest], []);
  ships.state.shots[host] = [ships.state.fleets[guest][0]];
  assert.deepEqual(publicState('ships', ships.state, host).fleets[guest], [ships.state.fleets[guest][0]]);
  const sketch = room('sketch');
  assert.equal(publicState('sketch', sketch.state, guest).word, '');
});

test('all ten games can reach a finished result', () => {
  const memory = room('memory');
  memory.state = { deck: [0, 0], matched: [], flipped: [], scores: { [host]: 0, [guest]: 0 }, message: '' };
  const memoryFirst = advance(memory, act('memory', memory, host, 'flip', { index: 0 }));
  assert.equal(act('memory', memoryFirst, host, 'flip', { index: 1 }).status, 'finished');

  const ludo = room('ludo');
  ludo.state = { positions: { [host]: [27, 28, 28, 28], [guest]: [-1, -1, -1, -1] }, dice: 1, message: '' };
  assert.equal(act('ludo', ludo, host, 'move', { index: 0 }).status, 'finished');

  const chess = room('chess');
  chess.state.board = Array(64).fill(''); chess.state.board[8] = 'wR'; chess.state.board[0] = 'bK';
  assert.equal(act('chess', chess, host, 'move', { from: 8, to: 0 }).status, 'finished');

  const domino = room('domino');
  domino.state = { bag: [], hands: { [host]: [[0, 0]], [guest]: [[1, 1]] }, chain: [], passed: 0, message: '' };
  assert.equal(act('domino', domino, host, 'place', { index: 0, side: 'right' }).status, 'finished');

  const sketch = room('sketch'); sketch.state.word = 'ајвар';
  assert.equal(act('sketch', sketch, guest, 'guess', { text: 'ајвар' }).status, 'finished');

  const tarok = room('tarok');
  tarok.state = { deck: [], hands: { [host]: ['1T'], [guest]: ['2T'] }, trick: [], tricks: { [host]: 0, [guest]: 0 }, message: '' };
  const tarokFirst = advance(tarok, act('tarok', tarok, host, 'play', { index: 0 }));
  assert.equal(act('tarok', tarokFirst, guest, 'play', { index: 0 }).status, 'finished');

  const ships = room('ships');
  ships.state = { fleets: { [host]: [63], [guest]: [0] }, shots: { [host]: [], [guest]: [] }, message: '' };
  assert.equal(act('ships', ships, host, 'shoot', { cell: 0 }).status, 'finished');

  const yamb = room('yamb');
  const categories = ['1', '2', '3', '4', '5', '6', 'three', 'straight', 'full', 'poker', 'yamb'];
  yamb.state = { dice: [6, 6, 6, 6, 6], held: [false, false, false, false, false], rolls: 1, sheets: { [host]: Object.fromEntries(categories.slice(0, -1).map((key) => [key, 0])), [guest]: Object.fromEntries(categories.map((key) => [key, 0])) }, message: '' };
  assert.equal(act('yamb', yamb, host, 'score', { category: 'yamb' }).status, 'finished');

  const zandar = room('zandar');
  zandar.state = { deck: [], hands: { [host]: ['J♠'], [guest]: [] }, table: ['3♥'], captured: { [host]: [], [guest]: [] }, lastCapture: guest, message: '' };
  assert.equal(act('zandar', zandar, host, 'play', { index: 0 }).status, 'finished');

  const kugliks = room('kugliks');
  kugliks.state = { threats: [1, ...Array(18).fill(0)], score: 17, health: 5, wave: 1, message: '' };
  assert.equal(act('kugliks', kugliks, host, 'defend', { cell: 0 }).status, 'finished');
});

test('games reject dead-end and cheating actions', () => {
  const ludo = room('ludo'); ludo.state.positions[host] = [28, 28, 28, 28];
  const skipped = act('ludo', ludo, host, 'roll', {});
  assert.equal(skipped.turnId, guest); assert.equal(skipped.state.dice, null);

  const domino = room('domino'); domino.state.chain = [[2, 3]]; domino.state.hands[host] = [[3, 4]];
  assert.throws(() => act('domino', domino, host, 'draw', {}), /може да се постави/);

  const sketch = room('sketch');
  assert.throws(() => act('sketch', sketch, host, 'guess', { text: sketch.state.word }), /не може да погодува/);

  const yamb = room('yamb'); yamb.state.rolls = 1;
  assert.throws(() => act('yamb', yamb, host, 'score', { category: 'fake' }), /не може да се запише/);
});

