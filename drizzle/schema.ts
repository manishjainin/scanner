import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Destinations ─────────────────────────────────────────────────────────────
export const destinations = mysqlTable("destinations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  iataCode: varchar("iataCode", { length: 3 }).notNull().unique(),
  country: varchar("country", { length: 60 }).notNull().default(""),
  continent: varchar("continent", { length: 30 }).notNull().default(""),
  region: varchar("region", { length: 50 }).notNull(),
  bookingWindowDays: int("bookingWindowDays").notNull().default(120),
  defaultTripDays: int("defaultTripDays").notNull().default(10),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Destination = typeof destinations.$inferSelect;
export type InsertDestination = typeof destinations.$inferInsert;

// ─── Scan Runs ────────────────────────────────────────────────────────────────
export const scanRuns = mysqlTable("scanRuns", {
  id: int("id").autoincrement().primaryKey(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  status: mysqlEnum("status", ["running", "completed", "failed"]).notNull().default("running"),
  destinationCount: int("destinationCount").default(0),
  successCount: int("successCount").default(0),
  errorMessage: text("errorMessage"),
  triggeredBy: mysqlEnum("triggeredBy", ["cron", "manual"]).notNull().default("cron"),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
});

export type ScanRun = typeof scanRuns.$inferSelect;
export type InsertScanRun = typeof scanRuns.$inferInsert;

// ─── Flight Scans ─────────────────────────────────────────────────────────────
export const flightScans = mysqlTable("flightScans", {
  id: int("id").autoincrement().primaryKey(),
  scanRunId: int("scanRunId").notNull(),
  destinationId: int("destinationId").notNull(),
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
  departureDate: varchar("departureDate", { length: 10 }).notNull(), // YYYY-MM-DD
  returnDate: varchar("returnDate", { length: 10 }).notNull(),       // YYYY-MM-DD
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("AUD"),
  airline: varchar("airline", { length: 100 }),
  airlineCode: varchar("airlineCode", { length: 3 }),
  stops: int("stops").notNull().default(0),
  outboundDuration: varchar("outboundDuration", { length: 20 }),
  returnDuration: varchar("returnDuration", { length: 20 }),
  origin: varchar("origin", { length: 3 }).notNull().default("SYD"),
  seatsAvailable: int("seatsAvailable"),          // numberOfBookableSeats from Amadeus
  cabinClass: varchar("cabinClass", { length: 30 }), // ECONOMY / BUSINESS / FIRST
  outboundSegments: json("outboundSegments"),        // full outbound leg breakdown
  returnSegments: json("returnSegments"),            // full return leg breakdown
  dealRating: mysqlEnum("dealRating", ["Hot Deal", "Good Price", "Standard"]).notNull().default("Standard"),
  aiSummary: text("aiSummary"),
  aiTravelTip: text("aiTravelTip"),
  thirtyDayAvg: decimal("thirtyDayAvg", { precision: 10, scale: 2 }),
  percentVsAvg: decimal("percentVsAvg", { precision: 6, scale: 2 }),
  lowestIn7Days: decimal("lowestIn7Days", { precision: 10, scale: 2 }),
  lowestIn30Days: decimal("lowestIn30Days", { precision: 10, scale: 2 }),
  lowestIn90Days: decimal("lowestIn90Days", { precision: 10, scale: 2 }),
  rawData: json("rawData"),
});

export type FlightScan = typeof flightScans.$inferSelect;
export type InsertFlightScan = typeof flightScans.$inferInsert;

// ─── App Settings ─────────────────────────────────────────────────────────────
export const appSettings = mysqlTable("appSettings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
