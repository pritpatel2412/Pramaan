import { Router } from "express";
import { db, testRunsTable, testResultsTable, testSuitesTable, projectsTable, screenshotsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { StartRunBody } from "@workspace/api-zod";
import { executeRealBrowserEvaluation } from "../lib/browser";
import { activeStreams, runLogsBuffer } from "../lib/runLogger";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET || "autoviva-secret-key-2024";

/**
 * GET /api/runs
 * Fetch all runs for the authenticated user
 */
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

/**
 * GET /api/runs/:runId/stream
 * Server-Sent Events (SSE) log stream for the client.
 * Bypasses header requirement using token query parameter for EventSource compat.
 */
router.get("/runs/:runId/stream", async (req, res) => {
  const { runId } = req.params;
  const token = req.query.token as string;

  if (!token) {
    res.status(401).json({ error: "Unauthorized: Missing token in query params" });
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send buffered logs first
  const buffer = runLogsBuffer.get(runId) || [];
  for (const log of buffer) {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  }

  // Register connection
  if (!activeStreams.has(runId)) {
    activeStreams.set(runId, []);
  }
  activeStreams.get(runId)!.push(res);

  req.on("close", () => {
    const clients = activeStreams.get(runId) || [];
    activeStreams.set(runId, clients.filter(c => c !== res));
    if (activeStreams.get(runId)!.length === 0) {
      activeStreams.delete(runId);
    }
  });
});

/**
 * POST /api/runs/start
 * Launch a new test suite evaluation run (real playwright headed/headless browser)
 */
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

  // Run the Playwright automation in the background
  executeRealBrowserEvaluation(run.id, testCases, project, suite, req.user!.userId).catch(console.error);

  res.status(201).json({ ...run, projectName: project.name, suiteName: suite.name });
});

/**
 * GET /api/runs/:runId
 */
router.get("/runs/:runId", requireAuth, async (req, res) => {
  const runId = req.params.runId as string;
  const [row] = await db.select({
    run: testRunsTable,
    projectName: projectsTable.name,
    suiteName: testSuitesTable.name,
  }).from(testRunsTable)
    .leftJoin(projectsTable, eq(testRunsTable.projectId, projectsTable.id))
    .leftJoin(testSuitesTable, eq(testRunsTable.suiteId, testSuitesTable.id))
    .where(and(eq(testRunsTable.id, runId), eq(testRunsTable.userId, req.user!.userId)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json({ ...row.run, projectName: row.projectName, suiteName: row.suiteName });
});

/**
 * GET /api/runs/:runId/results
 */
router.get("/runs/:runId/results", requireAuth, async (req, res) => {
  const runId = req.params.runId as string;
  const [run] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.id, runId), eq(testRunsTable.userId, req.user!.userId))).limit(1);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const results = await db.select().from(testResultsTable).where(eq(testResultsTable.runId, runId));
  const screenshots = await db.select().from(screenshotsTable).where(eq(screenshotsTable.runId, runId));
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

/**
 * POST /api/runs/:runId/stop
 */
router.post("/runs/:runId/stop", requireAuth, async (req, res) => {
  const runId = req.params.runId as string;
  const [run] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.id, runId), eq(testRunsTable.userId, req.user!.userId))).limit(1);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  await db.update(testRunsTable).set({ status: "failed", completedAt: new Date() }).where(eq(testRunsTable.id, runId));
  res.json({ message: "Run stopped" });
});

export default router;
