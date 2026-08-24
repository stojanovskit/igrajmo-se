import { env } from 'cloudflare:workers';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, GAME_SLUGS, GameSlug, initialState, joinState, publicState } from '@/db/gameEngine';
import { ensureSchema, getRoom, parseRoom, RoomRow, saveRoomState } from '@/db/rooms';

export const runtime = 'edge';

const cleanText = (value: unknown, fallback = '') => {
  const valueText = typeof value === 'string' ? value.trim().replace(/[^\p{L}\p{N}_ -]/gu, '') : '';
  return valueText.slice(0, 40) || fallback;
};

function validGame(value: unknown): value is GameSlug { return typeof value === 'string' && (GAME_SLUGS as readonly string[]).includes(value); }

function roomView(room: Awaited<ReturnType<typeof getRoom>>, playerId: string) {
  return room ? { ...room, state: publicState(room.game as GameSlug, room.state, playerId) } : null;
}

async function resolveRoom(room: Awaited<ReturnType<typeof getRoom>>) {
  if (!room || room.game !== 'memory' || room.state.flipped?.length < 2 || !room.state.resolveAt || room.state.resolveAt > Date.now()) return room;
  const nextTurn = room.turn_id === room.host_id ? room.guest_id : room.host_id;
  const state = { ...room.state, flipped: [], resolveAt: undefined, message: 'Нема пар — сега е ред на противникот.' };
  await saveRoomState(room.id, state, nextTurn || room.host_id, room.status);
  return getRoom(room.id);
}

export async function GET(request: Request) {
  await ensureSchema();
  const query = new URL(request.url).searchParams;
  const id = cleanText(query.get('id'), '').toUpperCase();
  const playerId = cleanText(query.get('playerId'), 'guest');
  if (id) {
    const room = await resolveRoom(await getRoom(id));
    return room ? Response.json(roomView(room, playerId)) : Response.json({ error: 'Собата не постои.' }, { status: 404 });
  }
  const game = query.get('game');
  const statement = validGame(game)
    ? (env.DB as D1Database).prepare("SELECT * FROM rooms WHERE updated_at > ? AND status != 'finished' AND game = ? ORDER BY updated_at DESC LIMIT 12").bind(Date.now() - 21600000, game)
    : (env.DB as D1Database).prepare("SELECT * FROM rooms WHERE updated_at > ? AND status != 'finished' ORDER BY updated_at DESC LIMIT 12").bind(Date.now() - 21600000);
  const result = await statement.all<RoomRow>();
  return Response.json(result.results.map(parseRoom).map((room) => roomView(room, playerId)));
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json() as Record<string, any>;
  const type = body.type;
  const playerId = cleanText(body.playerId, 'guest').slice(0, 40);
  const nickname = cleanText(body.nickname, 'Гостин').slice(0, 20);
  const db = env.DB as D1Database;

  try {
    if (type === 'matchmake') {
      if (!validGame(body.game)) return Response.json({ error: 'Избери игра.' }, { status: 400 });
      const game = body.game;
      const waiting = await db.prepare("SELECT * FROM rooms WHERE game = ? AND status = 'waiting' AND host_id != ? AND updated_at > ? ORDER BY created_at ASC LIMIT 1")
        .bind(game, playerId, Date.now() - 1800000).first<RoomRow>();
      if (waiting) {
        const row = parseRoom(waiting);
        const state = joinState(game, row.state, row.host_id, playerId);
        const joined = await db.prepare("UPDATE rooms SET guest_id = ?, guest_name = ?, state = ?, status = 'playing', updated_at = ? WHERE id = ? AND status = 'waiting' AND guest_id IS NULL")
          .bind(playerId, nickname, JSON.stringify(state), Date.now(), waiting.id).run();
        if (joined.meta.changes) return Response.json(roomView(await getRoom(waiting.id), playerId));
      }
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
      const state = initialState(game, playerId);
      await db.prepare('INSERT INTO rooms (id, game, name, host_id, host_name, state, turn_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, game, `Соба ${id}`, playerId, nickname, JSON.stringify(state), playerId, 'waiting', Date.now(), Date.now()).run();
      return Response.json(roomView(await getRoom(id), playerId), { status: 201 });
    }

    if (type === 'join') {
      const id = cleanText(body.roomId, '').toUpperCase();
      const room = await getRoom(id);
      if (!room) return Response.json({ error: 'Не ја најдовме собата.' }, { status: 404 });
      if (room.host_id === playerId || room.guest_id === playerId) return Response.json(roomView(room, playerId));
      if (room.status !== 'waiting') return Response.json({ error: 'Собата е полна.' }, { status: 409 });
      const state = joinState(room.game as GameSlug, room.state, room.host_id, playerId);
      await db.prepare("UPDATE rooms SET guest_id = ?, guest_name = ?, state = ?, status = 'playing', updated_at = ? WHERE id = ? AND status = 'waiting'")
        .bind(playerId, nickname, JSON.stringify(state), Date.now(), id).run();
      return Response.json(roomView(await getRoom(id), playerId));
    }

    if (type === 'action') {
      const roomId = cleanText(body.roomId, '').toUpperCase();
      const room = await resolveRoom(await getRoom(roomId));
      if (!room) return Response.json({ error: 'Собата не постои.' }, { status: 404 });
      if (![room.host_id, room.guest_id].includes(playerId)) return Response.json({ error: 'Не си играч во оваа соба.' }, { status: 403 });
      const result = act(room.game as GameSlug, room, playerId, cleanText(body.action), body.payload || {});
      await saveRoomState(room.id, result.state, result.turnId, result.status);
      return Response.json(roomView(await getRoom(room.id), playerId));
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Невалиден потег.' }, { status: 409 });
  }
  return Response.json({ error: 'Непознато барање.' }, { status: 400 });
}

