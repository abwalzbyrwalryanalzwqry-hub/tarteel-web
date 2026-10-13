CREATE TABLE `phone_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purpose` enum('signup','reset','verify','add_phone') NOT NULL,
	`phone` varchar(20) NOT NULL,
	`userId` int,
	`codeHash` varchar(64) NOT NULL,
	`ticketHash` varchar(64) NOT NULL,
	`status` enum('pending','verified','mismatch','consumed') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`verifiedAt` timestamp,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phone_verifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `phone_verifications_ticket_unique` UNIQUE(`ticketHash`)
);
--> statement-breakpoint
CREATE INDEX `phone_verifications_code_idx` ON `phone_verifications` (`codeHash`,`status`);--> statement-breakpoint
CREATE INDEX `phone_verifications_phone_idx` ON `phone_verifications` (`phone`,`createdAt`);