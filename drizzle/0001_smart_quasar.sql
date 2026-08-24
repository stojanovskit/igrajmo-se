CREATE INDEX `idx_rooms_status_game_updated` ON `rooms` (`status`,`game`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_rooms_updated_at` ON `rooms` (`updated_at`);--> statement-breakpoint
PRAGMA optimize;

