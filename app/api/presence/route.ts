import { env } from 'cloudflare:workers';
import { ensureSchema } from '@/db/rooms';

export const runtime = 'edge';

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000;

function database() {
  return env.DB as D1Database;
}

function response(count: number) {
  return Response.json(
    { count, windowSeconds: ONLINE_WINDOW_MS / 1000 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

async function onlineCount(now: number) {
  const row = await database()
    .prepare('SELECT COUNT(*) AS count FROM presence WHERE last_seen >= ?')
    .bind(now - ONLINE_WINDOW_MS)
    .first<{ count: number }>();

  return Number(row?.count || 0);
}

export async function GET() {
  await ensureSchema();
  return response(await onlineCount(Date.now()));
}

export async function POST(request: Request) {
  await ensureSchema();

  const body = await request.json().catch(() => null) as { playerId?: unknown } | null;
  const playerId = typeof body?.playerId === 'string' ? body.playerId.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(playerId)) {
    return Response.json({ error: 'Невалиден гостински идентификатор.' }, { status: 400 });
  }

  const now = Date.now();
  const db = database();
  await db.batch([
    db.prepare(`INSERT INTO presence (player_id, last_seen) VALUES (?, ?)
      ON CONFLICT(player_id) DO UPDATE SET last_seen = excluded.last_seen`)
      .bind(playerId, now),
    db.prepare('DELETE FROM presence WHERE last_seen < ?').bind(now - CLEANUP_AGE_MS),
  ]);

  return response(await onlineCount(now));
}

