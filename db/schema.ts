import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  game: text('game').notNull(),
  name: text('name').notNull(),
  hostId: text('host_id').notNull(),
  hostName: text('host_name').notNull(),
  guestId: text('guest_id'),
  guestName: text('guest_name'),
  state: text('state').notNull(),
  turnId: text('turn_id').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_rooms_status_game_updated').on(table.status, table.game, table.updatedAt),
  index('idx_rooms_updated_at').on(table.updatedAt),
]);

