import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { testRunsTable } from "./testRuns";
import { testResultsTable } from "./testResults";

export const screenshotsTable = pgTable("screenshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => testRunsTable.id, { onDelete: "cascade" }),
  resultId: uuid("result_id").references(() => testResultsTable.id, { onDelete: "set null" }),
  type: text("type").notNull().default("screenshot"),
  filePath: text("file_path").notNull(),
  url: text("url"),
  stepNumber: integer("step_number"),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScreenshotSchema = createInsertSchema(screenshotsTable).omit({ id: true, createdAt: true });
export type InsertScreenshot = z.infer<typeof insertScreenshotSchema>;
export type Screenshot = typeof screenshotsTable.$inferSelect;
