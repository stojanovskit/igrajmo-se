CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`game` text NOT NULL,
	`name` text NOT NULL,
	`host_id` text NOT NULL,
	`host_name` text NOT NULL,
	`guest_id` text,
	`guest_name` text,
	`state` text NOT NULL,
	`turn_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

