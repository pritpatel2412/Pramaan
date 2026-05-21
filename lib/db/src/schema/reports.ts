import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { testRunsTable } from "./testRuns";

export const reportsTable = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().unique().references(() => testRunsTable.id, { onDelete: "cascade" }),
  htmlPath: text("html_path"),
  pdfPath: text("pdf_path"),
  summary: text("summary"),
  aiNotes: text("ai_notes"),
  suggestions: jsonb("suggestions").default([]),
  scoreBreakdown: jsonb("score_breakdown").default({}),
  keyFindings: jsonb("key_findings").default([]),
  bugsFound: jsonb("bugs_found").default([]),
  featureCoverage: jsonb("feature_coverage").default([]),
  audits: jsonb("audits").default({}),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, generatedAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;
