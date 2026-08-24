import { env } from 'cloudflare:workers';
import { GAME_SLUGS } from '@/db/gameEngine';
import { ensureSchema } from '@/db/rooms';

export const runtime = 'edge';

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;
const ACTIVE_ROOM_WINDOW_MS = 30 * 60 * 1000;
const RECENT_GAMES_WINDOW_MS = 24 * 60 * 60 * 1000;

type StatsRow = {
  game?: string | null;
  count?: number;
  nickname?: string;
};

function database() {
  return env.DB as D1Database;
}

async function liveStats(now: number) {
  const db = database();
  const [playerCounts, players, roomCounts, recentGames] = await db.batch<StatsRow>([
    db.prepare('SELECT game, COUNT(*) AS count FROM online_players WHERE last_seen >= ? GROUP BY game').bind(now - ONLINE_WINDOW_MS),
    db.prepare('SELECT nickname, game FROM online_players WHERE last_seen >= ? ORDER BY last_seen DESC LIMIT 8').bind(now - ONLINE_WINDOW_MS),
    db.prepare(`SELECT rooms.game, COUNT(DISTINCT rooms.id) AS count
      FROM rooms
      JOIN visitor_rooms ON visitor_rooms.room_id = rooms.id
      JOIN online_players ON online_players.player_id = visitor_rooms.player_id
      WHERE rooms.status != 'finished' AND rooms.updated_at >= ? AND online_players.last_seen >= ?
      GROUP BY rooms.game`).bind(now - ACTIVE_ROOM_WINDOW_MS, now - ONLINE_WINDOW_MS),
    db.prepare("SELECT COUNT(*) AS count FROM rooms WHERE status = 'finished' AND updated_at >= ?").bind(now - RECENT_GAMES_WINDOW_MS),
  ]);

  const toCountMap = (rows: StatsRow[]) => Object.fromEntries(
    rows.filter((row) => row.game).map((row) => [row.game, Number(row.count || 0)]),
  );
  const playersByGame = toCountMap(playerCounts.results);
  const roomsByGame = toCountMap(roomCounts.results);

  return {
    onlineCount: playerCounts.results.reduce((total, row) => total + Number(row.count || 0), 0),
    activeRooms: roomCounts.results.reduce((total, row) => total + Number(row.count || 0), 0),
    gamesLast24Hours: Number(recentGames.results[0]?.count || 0),
    playersByGame,
    roomsByGame,
    players: players.results.map((row) => ({ nickname: row.nickname || 'Гостин', game: row.game || null })),
    onlineWindowSeconds: ONLINE_WINDOW_MS / 1000,
    roomWindowMinutes: ACTIVE_ROOM_WINDOW_MS / 60000,
  };
}

async function response(now: number) {
  return Response.json(await liveStats(now), { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  await ensureSchema();
  return response(Date.now());
}

export async function POST(request: Request) {
  await ensureSchema();

  const body = await request.json().catch(() => null) as { playerId?: unknown; nickname?: unknown; game?: unknown; roomId?: unknown } | null;
  const playerId = typeof body?.playerId === 'string' ? body.playerId.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(playerId)) {
    return Response.json({ error: 'Невалиден гостински идентификатор.' }, { status: 400 });
  }
  const nicknameText = typeof body?.nickname === 'string' ? body.nickname.trim().replace(/[^\p{L}\p{N}_ -]/gu, '') : '';
  const nickname = nicknameText.slice(0, 20) || 'Гостин';
  const game = typeof body?.game === 'string' && (GAME_SLUGS as readonly string[]).includes(body.game) ? body.game : null;
  const roomIdText = typeof body?.roomId === 'string' ? body.roomId.trim().toUpperCase() : '';
  const roomId = /^[A-Z0-9]{6}$/.test(roomIdText) ? roomIdText : null;

  const now = Date.now();
  const db = database();
  await db.batch([
    db.prepare(`INSERT INTO online_players (player_id, nickname, game, last_seen) VALUES (?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET nickname = excluded.nickname, game = excluded.game, last_seen = excluded.last_seen`)
      .bind(playerId, nickname, game, now),
    db.prepare(`INSERT INTO visitor_rooms (player_id, room_id) VALUES (?, ?)
      ON CONFLICT(player_id) DO UPDATE SET room_id = excluded.room_id`).bind(playerId, roomId),
    db.prepare('DELETE FROM online_players WHERE last_seen < ?').bind(now - CLEANUP_AGE_MS),
    db.prepare('DELETE FROM visitor_rooms WHERE player_id NOT IN (SELECT player_id FROM online_players)'),
    db.prepare('DELETE FROM presence WHERE last_seen < ?').bind(now - CLEANUP_AGE_MS),
  ]);

  return response(now);
}

