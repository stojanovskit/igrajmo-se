import { env } from 'cloudflare:workers';
import { GAME_SLUGS } from '@/db/gameEngine';
import { ensureSchema } from '@/db/rooms';

export const runtime = 'edge';

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const ROOM_PRESENCE_WINDOW_MS = 10 * 1000;
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;
const RECENT_GAMES_WINDOW_MS = 24 * 60 * 60 * 1000;

type StatsRow = {
  game?: string | null;
  count?: number;
  nickname?: string;
  player_id?: string;
  room_id?: string | null;
};

function database() {
  return env.DB as D1Database;
}

async function liveStats(now: number, viewerPlayerId = '') {
  const db = database();
  const [playerCounts, players, roomCounts, recentGames] = await db.batch<StatsRow>([
    db.prepare('SELECT game, COUNT(*) AS count FROM online_players WHERE last_seen >= ? GROUP BY game').bind(now - ONLINE_WINDOW_MS),
    db.prepare(`SELECT online_players.player_id, online_players.nickname, online_players.game,
        CASE WHEN rooms.status = 'waiting' AND rooms.guest_id IS NULL AND rooms.host_id = online_players.player_id
          THEN rooms.id ELSE NULL END AS room_id
      FROM online_players
      LEFT JOIN room_players ON room_players.player_id = online_players.player_id AND room_players.last_seen >= ?
      LEFT JOIN rooms ON rooms.id = room_players.room_id
      WHERE online_players.last_seen >= ?
      ORDER BY online_players.last_seen DESC
      LIMIT 8`).bind(now - ROOM_PRESENCE_WINDOW_MS, now - ONLINE_WINDOW_MS),
    db.prepare(`SELECT rooms.game, COUNT(DISTINCT rooms.id) AS count
      FROM rooms
      JOIN room_players ON room_players.room_id = rooms.id
      JOIN online_players ON online_players.player_id = room_players.player_id
      WHERE rooms.status != 'finished' AND room_players.last_seen >= ? AND online_players.last_seen >= ?
      GROUP BY rooms.game`).bind(now - ROOM_PRESENCE_WINDOW_MS, now - ONLINE_WINDOW_MS),
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
    players: players.results.map((row) => ({
      nickname: row.nickname || 'Гостин',
      game: row.game || null,
      joinRoomId: row.player_id !== viewerPlayerId ? row.room_id || null : null,
      isSelf: row.player_id === viewerPlayerId,
    })),
    onlineWindowSeconds: ONLINE_WINDOW_MS / 1000,
  };
}

async function response(now: number, viewerPlayerId = '') {
  return Response.json(await liveStats(now, viewerPlayerId), { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  await ensureSchema();
  const viewerPlayerId = new URL(request.url).searchParams.get('playerId')?.trim() || '';
  return response(Date.now(), viewerPlayerId);
}

export async function POST(request: Request) {
  await ensureSchema();

  const body = await request.json().catch(() => null) as { playerId?: unknown; nickname?: unknown; game?: unknown; roomId?: unknown; offline?: unknown } | null;
  const playerId = typeof body?.playerId === 'string' ? body.playerId.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(playerId)) {
    return Response.json({ error: 'Невалиден гостински идентификатор.' }, { status: 400 });
  }
  const db = database();
  if (body?.offline === true) {
    await db.batch([
      db.prepare('DELETE FROM visitor_rooms WHERE player_id = ?').bind(playerId),
      db.prepare('DELETE FROM room_players WHERE player_id = ?').bind(playerId),
      db.prepare('DELETE FROM online_players WHERE player_id = ?').bind(playerId),
    ]);
    return new Response(null, { status: 204 });
  }
  const nicknameText = typeof body?.nickname === 'string' ? body.nickname.trim().replace(/[^\p{L}\p{N}_ -]/gu, '') : '';
  const nickname = nicknameText.slice(0, 20) || 'Гостин';
  const game = typeof body?.game === 'string' && (GAME_SLUGS as readonly string[]).includes(body.game) ? body.game : null;
  const roomIdText = typeof body?.roomId === 'string' ? body.roomId.trim().toUpperCase() : '';
  const roomId = /^[A-Z0-9]{6}$/.test(roomIdText) ? roomIdText : null;

  const now = Date.now();
  const roomPresenceStatement = roomId
    ? db.prepare('UPDATE room_players SET last_seen = ? WHERE player_id = ? AND room_id = ?').bind(now, playerId, roomId)
    : db.prepare('DELETE FROM room_players WHERE player_id = ?').bind(playerId);
  await db.batch([
    db.prepare(`INSERT INTO online_players (player_id, nickname, game, last_seen) VALUES (?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET nickname = excluded.nickname, game = excluded.game, last_seen = excluded.last_seen`)
      .bind(playerId, nickname, game, now),
    roomPresenceStatement,
    db.prepare('DELETE FROM online_players WHERE last_seen < ?').bind(now - CLEANUP_AGE_MS),
    db.prepare('DELETE FROM visitor_rooms WHERE player_id NOT IN (SELECT player_id FROM online_players)'),
    db.prepare('DELETE FROM room_players WHERE last_seen < ?').bind(now - CLEANUP_AGE_MS),
    db.prepare('DELETE FROM presence WHERE last_seen < ?').bind(now - CLEANUP_AGE_MS),
  ]);

  return response(now, playerId);
}

