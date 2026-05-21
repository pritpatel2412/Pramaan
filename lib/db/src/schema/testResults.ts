import { pgTable, text, timestamp, uuid, integer, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { testRunsTable } from "./testRuns";

export const testResultsTable = pgTable("test_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => testRunsTable.id, { onDelete: "cascade" }),
  testCaseId: text("test_case_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("pending"),
  stepsExecuted: integer("steps_executed"),
  expectedResult: jsonb("expected_result"),
  actualResult: jsonb("actual_result"),
  errorMessage: text("error_message"),
  durationSeconds: real("duration_seconds"),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTestResultSchema = createInsertSchema(testResultsTable).omit({ id: true, createdAt: true });
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;
export type TestResult = typeof testResultsTable.$inferSelect;
