import { env } from 'cloudflare:workers';
/* eslint-disable @typescript-eslint/no-explicit-any */

export type RoomRow = {
  id: string;
  game: string;
  name: string;
  host_id: string;
  host_name: string;
  guest_id: string | null;
  guest_name: string | null;
  state: string;
  turn_id: string;
  status: 'waiting' | 'playing' | 'finished';
  created_at: number;
  updated_at: number;
};

let schemaReady: Promise<void> | null = null;

function database() {
  return env.DB as D1Database;
}

export async function ensureSchema() {
  if (!schemaReady) {
    const db = database();
    schemaReady = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        game TEXT NOT NULL,
        name TEXT NOT NULL,
        host_id TEXT NOT NULL,
        host_name TEXT NOT NULL,
        guest_id TEXT,
        guest_name TEXT,
        state TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_rooms_status_game_updated ON rooms(status, game, updated_at)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON rooms(updated_at)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS presence (
        player_id TEXT PRIMARY KEY,
        last_seen INTEGER NOT NULL
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen)'),
    ]).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export function parseRoom(row: RoomRow) {
  return { ...row, state: JSON.parse(row.state) as any };
}

export async function getRoom(id: string) {
  await ensureSchema();
  const row = await database().prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<RoomRow>();
  return row ? parseRoom(row) : null;
}

export async function saveRoomState(id: string, state: any, turnId: string, status: RoomRow['status']) {
  await database().prepare('UPDATE rooms SET state = ?, turn_id = ?, status = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(state), turnId, status, Date.now(), id).run();
}

