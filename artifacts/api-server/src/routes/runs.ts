import { Router } from "express";
import { db, testRunsTable, testResultsTable, testSuitesTable, projectsTable, reportsTable, screenshotsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { StartRunBody } from "@workspace/api-zod";
import { generateEvaluationReport } from "../lib/ai";

const router = Router();

function gradeFromScore(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "F";
}

router.get("/runs", requireAuth, async (req, res) => {
  const { projectId, status, limit } = req.query as Record<string, string>;
  const userId = req.user!.userId;
  const limitNum = Math.min(parseInt(limit ?? "20", 10), 100);

  const runs = await db.select({
    run: testRunsTable,
    projectName: projectsTable.name,
    suiteName: testSuitesTable.name,
  }).from(testRunsTable)
    .leftJoin(projectsTable, eq(testRunsTable.projectId, projectsTable.id))
    .leftJoin(testSuitesTable, eq(testRunsTable.suiteId, testSuitesTable.id))
    .where(and(
      eq(testRunsTable.userId, userId),
      projectId ? eq(testRunsTable.projectId, projectId) : undefined,
      status ? eq(testRunsTable.status, status) : undefined,
    ))
    .orderBy(desc(testRunsTable.createdAt))
    .limit(limitNum);

  res.json(runs.map(r => ({
    ...r.run,
    projectName: r.projectName,
    suiteName: r.suiteName,
  })));
});

router.post("/runs/start", requireAuth, async (req, res) => {
  const parsed = StartRunBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { projectId, suiteId, mode } = parsed.data;

  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [suite] = await db.select().from(testSuitesTable).where(eq(testSuitesTable.id, suiteId)).limit(1);
  if (!suite) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }

  const testCases: any[] = Array.isArray((suite.jsonConfig as any)?.test_cases)
    ? (suite.jsonConfig as any).test_cases
    : [];

  const [run] = await db.insert(testRunsTable).values({
    projectId,
    suiteId,
    userId: req.user!.userId,
    mode,
    status: "running",
    totalTests: testCases.length,
    passed: 0,
    failed: 0,
    startedAt: new Date(),
  }).returning();

  // Simulate async evaluation
  simulateEvaluation(run.id, testCases, project, suite, req.user!.userId).catch(console.error);

  const [projectData] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  res.status(201).json({ ...run, projectName: projectData?.name ?? null, suiteName: suite?.name ?? null });
});

router.get("/runs/:runId", requireAuth, async (req, res) => {
  const [row] = await db.select({
    run: testRunsTable,
    projectName: projectsTable.name,
    suiteName: testSuitesTable.name,
  }).from(testRunsTable)
    .leftJoin(projectsTable, eq(testRunsTable.projectId, projectsTable.id))
    .leftJoin(testSuitesTable, eq(testRunsTable.suiteId, testSuitesTable.id))
    .where(and(eq(testRunsTable.id, req.params.runId), eq(testRunsTable.userId, req.user!.userId)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json({ ...row.run, projectName: row.projectName, suiteName: row.suiteName });
});

router.get("/runs/:runId/results", requireAuth, async (req, res) => {
  const [run] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.id, req.params.runId), eq(testRunsTable.userId, req.user!.userId))).limit(1);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
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
  res.json(results.map(r => ({
    ...r,
    screenshots: (screenshotsByResult.get(r.id) ?? []).map(s => ({ id: s.id, url: s.url ?? s.filePath, stepNumber: s.stepNumber, label: s.label })),
  })));
});

router.post("/runs/:runId/stop", requireAuth, async (req, res) => {
  const [run] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.id, req.params.runId), eq(testRunsTable.userId, req.user!.userId))).limit(1);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  await db.update(testRunsTable).set({ status: "failed", completedAt: new Date() }).where(eq(testRunsTable.id, req.params.runId));
  res.json({ message: "Run stopped" });
});

async function simulateEvaluation(runId: string, testCases: any[], project: any, suite: any, userId: string) {
  await new Promise(r => setTimeout(r, 1000));

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const tc of testCases) {
    const stepCount = tc.steps?.length ?? 3;
    const duration = 2 + Math.random() * 5;
    const status = Math.random() > 0.25 ? "passed" : "failed";
    if (status === "passed") passed++;
    else failed++;

    await db.insert(testResultsTable).values({
      runId,
      testCaseId: tc.id ?? `TC_${passed + failed}`,
      title: tc.title ?? `Test ${passed + failed}`,
      status,
      stepsExecuted: stepCount,
      expectedResult: tc.expected ?? {},
      actualResult: status === "passed" ? { matched: true } : { matched: false, error: "Element not found" },
      errorMessage: status === "failed" ? "Expected condition not met within timeout" : null,
      durationSeconds: duration,
      executedAt: new Date(),
    });
    await new Promise(r => setTimeout(r, 500));
  }

  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  const totalPossible = 100;
  const passRate = testCases.length > 0 ? passed / testCases.length : 0;
  const score = Math.round(passRate * totalPossible * (0.85 + Math.random() * 0.15));
  const grade = gradeFromScore(score);

  await db.update(testRunsTable).set({
    status: "completed",
    score,
    grade,
    passed,
    failed,
    totalTests: testCases.length,
    durationSeconds: totalDuration,
    completedAt: new Date(),
  }).where(eq(testRunsTable.id, runId));

  // Generate report
  try {
    const report = await generateEvaluationReport({ runId, score, grade, passed, failed, testCases, project, suite });
    await db.insert(reportsTable).values({
      runId,
      summary: report.summary,
      aiNotes: report.aiNotes,
      suggestions: report.suggestions as any,
      scoreBreakdown: report.scoreBreakdown as any,
      keyFindings: report.keyFindings as any,
      bugsFound: report.bugsFound as any,
      featureCoverage: report.featureCoverage as any,
    });
  } catch (err) {
    console.error("Report generation failed:", err);
    // Still save a basic report
    await db.insert(reportsTable).values({
      runId,
      summary: `Evaluation completed. ${passed} of ${testCases.length} test cases passed with a score of ${score}/100.`,
      aiNotes: `The project demonstrated ${passed > failed ? "good" : "partial"} functionality across the tested features.`,
      suggestions: ["Fix failing test cases", "Improve error handling", "Add better validation"] as any,
      scoreBreakdown: {
        "Login/Auth": Math.round(score * 0.10),
        "Core Features": Math.round(score * 0.30),
        "CRUD": Math.round(score * 0.20),
        "UI Navigation": Math.round(score * 0.10),
        "Error Handling": Math.round(score * 0.10),
        "DB Persistence": Math.round(score * 0.10),
        "Reliability": Math.round(score * 0.05),
        "UI Polish": Math.round(score * 0.05),
      } as any,
      keyFindings: [`${passed} test cases passed`, `${failed} test cases failed`, `Score: ${score}/100`] as any,
      bugsFound: [] as any,
      featureCoverage: [] as any,
    });
  }
}

export default router;
