import { Router } from "express";
import { db, testSuitesTable, projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateTestSuiteBody, UpdateTestSuiteBody, GenerateTestCasesBody } from "@workspace/api-zod";
import { generateTestCasesWithAI } from "../lib/ai";

const router = Router();

router.get("/projects/:projectId/test-suites", requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const suites = await db.select().from(testSuitesTable).where(eq(testSuitesTable.projectId, projectId));
  const result = suites.map(s => ({
    ...s,
    testCaseCount: Array.isArray((s.jsonConfig as any)?.test_cases) ? (s.jsonConfig as any).test_cases.length : 0,
  }));
  res.json(result);
});

router.post("/projects/:projectId/test-suites", requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const parsed = CreateTestSuiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { name, description, jsonConfig } = parsed.data;
  const [suite] = await db.insert(testSuitesTable).values({
    projectId,
    name,
    description: description ?? null,
    jsonConfig: jsonConfig ?? {},
  }).returning();
  res.status(201).json({ ...suite, testCaseCount: Array.isArray((suite.jsonConfig as any)?.test_cases) ? (suite.jsonConfig as any).test_cases.length : 0 });
});

router.get("/test-suites/:suiteId", requireAuth, async (req, res) => {
  const suiteId = req.params.suiteId as string;
  const [suite] = await db.select().from(testSuitesTable).where(eq(testSuitesTable.id, suiteId)).limit(1);
  if (!suite) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, suite.projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  res.json({ ...suite, testCaseCount: Array.isArray((suite.jsonConfig as any)?.test_cases) ? (suite.jsonConfig as any).test_cases.length : 0 });
});

router.put("/test-suites/:suiteId", requireAuth, async (req, res) => {
  const suiteId = req.params.suiteId as string;
  const [suite] = await db.select().from(testSuitesTable).where(eq(testSuitesTable.id, suiteId)).limit(1);
  if (!suite) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, suite.projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const parsed = UpdateTestSuiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [updated] = await db.update(testSuitesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(testSuitesTable.id, suiteId))
    .returning();
  res.json({ ...updated, testCaseCount: Array.isArray((updated.jsonConfig as any)?.test_cases) ? (updated.jsonConfig as any).test_cases.length : 0 });
});

router.delete("/test-suites/:suiteId", requireAuth, async (req, res) => {
  const suiteId = req.params.suiteId as string;
  const [suite] = await db.select().from(testSuitesTable).where(eq(testSuitesTable.id, suiteId)).limit(1);
  if (!suite) {
    res.status(404).json({ error: "Test suite not found" });
    return;
  }
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, suite.projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  await db.delete(testSuitesTable).where(eq(testSuitesTable.id, suiteId));
  res.json({ message: "Test suite deleted" });
});

router.post("/test-suites/generate", requireAuth, async (req, res) => {
  const parsed = GenerateTestCasesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const testCases = await generateTestCasesWithAI(parsed.data);
  res.json({ testCases });
});

export default router;
