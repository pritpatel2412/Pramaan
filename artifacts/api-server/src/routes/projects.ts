import { Router } from "express";
import { db, projectsTable, testSuitesTable, testRunsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";

const router = Router();

router.get("/projects", requireAuth, async (req, res) => {
  const { search, status } = req.query as Record<string, string>;
  const userId = req.user!.userId;

  const projects = await db.select().from(projectsTable)
    .where(and(
      eq(projectsTable.userId, userId),
      status ? eq(projectsTable.status, status) : undefined
    ))
    .orderBy(desc(projectsTable.updatedAt));

  const projectIds = projects.map(p => p.id);
  if (projectIds.length === 0) {
    res.json([]);
    return;
  }

  const suiteCountsRaw = await db.select({
    projectId: testSuitesTable.projectId,
    count: sql<number>`count(*)::int`,
  }).from(testSuitesTable).where(sql`${testSuitesTable.projectId} = ANY(${sql.raw(`ARRAY['${projectIds.join("','")}']::uuid[]`)})`).groupBy(testSuitesTable.projectId);

  const runCountsRaw = await db.select({
    projectId: testRunsTable.projectId,
    count: sql<number>`count(*)::int`,
    avgScore: sql<number>`avg(score)`,
    lastRunAt: sql<string>`max(created_at)`,
  }).from(testRunsTable).where(sql`${testRunsTable.projectId} = ANY(${sql.raw(`ARRAY['${projectIds.join("','")}']::uuid[]`)})`).groupBy(testRunsTable.projectId);

  const lastRunRaw = await db.select({
    projectId: testRunsTable.projectId,
    score: testRunsTable.score,
    grade: testRunsTable.grade,
    createdAt: testRunsTable.createdAt,
  }).from(testRunsTable)
    .where(sql`${testRunsTable.projectId} = ANY(${sql.raw(`ARRAY['${projectIds.join("','")}']::uuid[]`)}) AND status = 'completed'`)
    .orderBy(desc(testRunsTable.createdAt));

  const suiteCounts = new Map(suiteCountsRaw.map(r => [r.projectId, r.count]));
  const runCounts = new Map(runCountsRaw.map(r => [r.projectId, r]));
  const lastRuns = new Map<string, typeof lastRunRaw[0]>();
  for (const r of lastRunRaw) {
    if (!lastRuns.has(r.projectId)) lastRuns.set(r.projectId, r);
  }

  let result = projects.map(p => {
    const rc = runCounts.get(p.id);
    const lr = lastRuns.get(p.id);
    return {
      ...p,
      testSuiteCount: suiteCounts.get(p.id) ?? 0,
      runCount: rc?.count ?? 0,
      avgScore: rc?.avgScore ?? null,
      lastRunAt: lr?.createdAt ?? null,
      lastRunScore: lr?.score ?? null,
      lastRunGrade: lr?.grade ?? null,
    };
  });

  if (search) {
    const s = search.toLowerCase();
    result = result.filter(p => p.name.toLowerCase().includes(s) || (p.techStack ?? "").toLowerCase().includes(s));
  }

  res.json(result);
});

router.post("/projects", requireAuth, async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { name, description, baseUrl, techStack, loginUrl, loginPageType, postLoginRedirect } = parsed.data;
  const [project] = await db.insert(projectsTable).values({
    userId: req.user!.userId,
    name,
    description: description ?? null,
    baseUrl,
    techStack: techStack ?? null,
    loginUrl: loginUrl ?? null,
    loginPageType: loginPageType ?? null,
    postLoginRedirect: postLoginRedirect ?? null,
    status: "active",
  }).returning();
  res.status(201).json({ ...project, testSuiteCount: 0, runCount: 0, avgScore: null, lastRunAt: null, lastRunScore: null, lastRunGrade: null });
});

router.get("/projects/:projectId", requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user!.userId)))
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [suiteCount] = await db.select({ count: sql<number>`count(*)::int` }).from(testSuitesTable).where(eq(testSuitesTable.projectId, project.id));
  const [runCount] = await db.select({ count: sql<number>`count(*)::int`, avg: sql<number>`avg(score)` }).from(testRunsTable).where(eq(testRunsTable.projectId, project.id));
  const [lastRun] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.projectId, project.id), eq(testRunsTable.status, "completed")))
    .orderBy(desc(testRunsTable.createdAt)).limit(1);

  res.json({
    ...project,
    testSuiteCount: suiteCount?.count ?? 0,
    runCount: runCount?.count ?? 0,
    avgScore: runCount?.avg ?? null,
    lastRunAt: lastRun?.createdAt ?? null,
    lastRunScore: lastRun?.score ?? null,
    lastRunGrade: lastRun?.grade ?? null,
  });
});

router.put("/projects/:projectId", requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const [existing] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [updated] = await db.update(projectsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId))
    .returning();
  res.json({ ...updated, testSuiteCount: null, runCount: null, avgScore: null, lastRunAt: null, lastRunScore: null, lastRunGrade: null });
});

router.delete("/projects/:projectId", requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const [existing] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  res.json({ message: "Project deleted" });
});

export default router;
