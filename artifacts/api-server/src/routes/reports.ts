import { Router } from "express";
import { db, reportsTable, testRunsTable, testResultsTable, screenshotsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { AskVivaAgentBody } from "@workspace/api-zod";
import { askVivaAgent } from "../lib/ai";

const router = Router();

router.get("/runs/:runId/report", requireAuth, async (req, res) => {
  const [run] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.id, req.params.runId), eq(testRunsTable.userId, req.user!.userId))).limit(1);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.runId, req.params.runId)).limit(1);
  if (!report) {
    res.status(404).json({ error: "Report not ready yet" });
    return;
  }

  const results = await db.select().from(testResultsTable).where(eq(testResultsTable.runId, req.params.runId));
  const screenshots = await db.select().from(screenshotsTable).where(eq(screenshotsTable.runId, req.params.runId));
  const screenshotsByResult = new Map<string, typeof screenshots>();
  for (const s of screenshots) {
    const key = s.resultId ?? "no-result";
    if (!screenshotsByResult.has(key)) screenshotsByResult.set(key, []);
    screenshotsByResult.get(key)!.push(s);
  }

  const enrichedResults = results.map(r => ({
    ...r,
    screenshots: (screenshotsByResult.get(r.id) ?? []).map(s => ({ id: s.id, url: s.url ?? s.filePath, stepNumber: s.stepNumber, label: s.label })),
  }));

  res.json({
    id: report.id,
    runId: report.runId,
    summary: report.summary,
    aiNotes: report.aiNotes,
    suggestions: report.suggestions ?? [],
    scoreBreakdown: report.scoreBreakdown ?? {},
    keyFindings: report.keyFindings ?? [],
    bugsFound: report.bugsFound ?? [],
    featureCoverage: report.featureCoverage ?? [],
    run,
    results: enrichedResults,
    generatedAt: report.generatedAt,
  });
});

router.post("/runs/:runId/ask", requireAuth, async (req, res) => {
  const [run] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.id, req.params.runId), eq(testRunsTable.userId, req.user!.userId))).limit(1);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  const parsed = AskVivaAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.runId, req.params.runId)).limit(1);
  const results = await db.select().from(testResultsTable).where(eq(testResultsTable.runId, req.params.runId));

  try {
    const answer = await askVivaAgent({
      question: parsed.data.question,
      run,
      report,
      results,
    });
    res.json({ answer, evidenceScreenshots: [], referencedTestCases: [] });
  } catch (err) {
    req.log.error({ err }, "Viva agent failed");
    res.status(500).json({ error: "Failed to get answer from Viva agent" });
  }
});

export default router;
