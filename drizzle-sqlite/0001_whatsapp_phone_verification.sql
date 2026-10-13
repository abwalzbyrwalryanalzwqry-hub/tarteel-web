CREATE TABLE `phone_verifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purpose` text NOT NULL,
	`phone` text NOT NULL,
	`userId` integer,
	`codeHash` text NOT NULL,
	`ticketHash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expiresAt` integer NOT NULL,
	`verifiedAt` integer,
	`consumedAt` integer,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `phone_verifications_ticket_unique` ON `phone_verifications` (`ticketHash`);--> statement-breakpoint
CREATE INDEX `phone_verifications_code_idx` ON `phone_verifications` (`codeHash`,`status`);--> statement-breakpoint
CREATE INDEX `phone_verifications_phone_idx` ON `phone_verifications` (`phone`,`createdAt`);