import { strict as assert } from 'node:assert';
import test from 'node:test';
import { act, GAME_SLUGS, initialState, joinState, publicState, type GameSlug } from '../db/gameEngine.ts';

const host = 'host-player';
const guest = 'guest-player';

function room(game: GameSlug) {
  const state = joinState(game, initialState(game, host), host, guest);
  return { host_id: host, guest_id: guest, turn_id: host, state, status: 'playing' as const };
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
  const sketch = room('sketch');
  assert.equal(publicState('sketch', sketch.state, guest).word, '');
});

