CREATE TABLE `appSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `appSettings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `destinations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`iataCode` varchar(3) NOT NULL,
	`region` varchar(50) NOT NULL,
	`bookingWindowDays` int NOT NULL DEFAULT 120,
	`defaultTripDays` int NOT NULL DEFAULT 10,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `destinations_id` PRIMARY KEY(`id`),
	CONSTRAINT `destinations_iataCode_unique` UNIQUE(`iataCode`)
);
--> statement-breakpoint
CREATE TABLE `flightScans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scanRunId` int NOT NULL,
	`destinationId` int NOT NULL,
	`scannedAt` timestamp NOT NULL DEFAULT (now()),
	`departureDate` varchar(10) NOT NULL,
	`returnDate` varchar(10) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'AUD',
	`airline` varchar(100),
	`airlineCode` varchar(3),
	`stops` int NOT NULL DEFAULT 0,
	`outboundDuration` varchar(20),
	`returnDuration` varchar(20),
	`dealRating` enum('Hot Deal','Good Price','Standard') NOT NULL DEFAULT 'Standard',
	`aiSummary` text,
	`aiTravelTip` text,
	`thirtyDayAvg` decimal(10,2),
	`percentVsAvg` decimal(6,2),
	`rawData` json,
	CONSTRAINT `flightScans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`destinationCount` int DEFAULT 0,
	`successCount` int DEFAULT 0,
	`errorMessage` text,
	`triggeredBy` enum('cron','manual') NOT NULL DEFAULT 'cron',
	`scheduleCronTaskUid` varchar(65),
	CONSTRAINT `scanRuns_id` PRIMARY KEY(`id`)
);
