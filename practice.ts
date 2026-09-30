import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export type StoredPracticeSnapshot = {
  version: 1;
  focus: Record<string, unknown> & { sessions?: unknown[] };
  rewards: Record<string, unknown> & { rewardClaimKeys?: string[] };
};

export const practiceStates = pgTable(
  "practice_states",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    revision: integer("revision").notNull().default(1),
    snapshot: jsonb("snapshot").$type<StoredPracticeSnapshot>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("practice_states_user_unique").on(table.userId),
  ],
);

export type PracticeState = typeof practiceStates.$inferSelect;