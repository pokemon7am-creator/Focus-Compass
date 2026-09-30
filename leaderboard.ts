import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
    id: serial("id").primaryKey(),
    installationId: text("installation_id").notNull(),
    nickname: text("nickname").notNull(),
    areaKey: text("area_key").notNull(),
    areaLabel: text("area_label").notNull(),
    focusMinutes: integer("focus_minutes").notNull().default(0),
    stillnessMinutes: integer("stillness_minutes").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("leaderboard_installation_area_unique").on(table.installationId, table.areaKey),
  ],
);

export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;