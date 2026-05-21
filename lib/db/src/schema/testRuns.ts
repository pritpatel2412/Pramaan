import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { testSuitesTable } from "./testSuites";

export const testRunsTable = pgTable("test_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  suiteId: uuid("suite_id").references(() => testSuitesTable.id, { onDelete: "set null" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("pre_check"),
  status: text("status").notNull().default("pending"),
  score: integer("score"),
  grade: text("grade"),
  totalTests: integer("total_tests"),
  passed: integer("passed"),
  failed: integer("failed"),
  durationSeconds: integer("duration_seconds"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTestRunSchema = createInsertSchema(testRunsTable).omit({ id: true, createdAt: true });
export type InsertTestRun = z.infer<typeof insertTestRunSchema>;
export type TestRun = typeof testRunsTable.$inferSelect;
