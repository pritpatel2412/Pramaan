import { Router } from "express";
import { db, testRunsTable, testResultsTable, projectsTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const [projectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable).where(eq(projectsTable.userId, userId));
  const [runStats] = await db.select({
    count: sql<number>`count(*)::int`,
    avg: sql<number>`avg(score)`,
  }).from(testRunsTable).where(eq(testRunsTable.userId, userId));

  const [passStats] = await db.select({
    totalPassed: sql<number>`sum(passed)::int`,
    totalTests: sql<number>`sum(total_tests)::int`,
  }).from(testRunsTable).where(eq(testRunsTable.userId, userId));

  const passRate = passStats?.totalTests > 0
    ? (passStats.totalPassed / passStats.totalTests) * 100
    : null;

  const recentRuns = await db.select({
    run: testRunsTable,
    projectName: projectsTable.name,
  }).from(testRunsTable)
    .leftJoin(projectsTable, eq(testRunsTable.projectId, projectsTable.id))
    .where(eq(testRunsTable.userId, userId))
    .orderBy(desc(testRunsTable.createdAt))
    .limit(5);

  res.json({
    totalProjects: projectCount?.count ?? 0,
    totalRuns: runStats?.count ?? 0,
    avgScore: runStats?.avg ?? null,
    passRate,
    recentRuns: recentRuns.map(r => ({ ...r.run, projectName: r.projectName, suiteName: null })),
  });
});

router.get("/analytics/overview", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const [runStats] = await db.select({
    count: sql<number>`count(*)::int`,
    avg: sql<number>`avg(score)`,
    totalPassed: sql<number>`sum(passed)::int`,
    totalTests: sql<number>`sum(total_tests)::int`,
    totalResultsRun: sql<number>`sum(total_tests)::int`,
  }).from(testRunsTable).where(eq(testRunsTable.userId, userId));

  const passRate = runStats?.totalTests > 0
    ? (runStats.totalPassed / runStats.totalTests) * 100
    : null;

  const gradeDistRaw = await db.select({
    grade: testRunsTable.grade,
    count: sql<number>`count(*)::int`,
  }).from(testRunsTable)
    .where(and(eq(testRunsTable.userId, userId), eq(testRunsTable.status, "completed")))
    .groupBy(testRunsTable.grade);

  const scoreDistribution = ["A+", "A", "B", "C", "F"].map(grade => ({
    grade,
    count: gradeDistRaw.find(r => r.grade === grade)?.count ?? 0,
  }));

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.userId, userId));
  const projectsComparison = await Promise.all(projects.slice(0, 10).map(async p => {
    const runs = await db.select().from(testRunsTable)
      .where(and(eq(testRunsTable.projectId, p.id), eq(testRunsTable.status, "completed")))
      .orderBy(desc(testRunsTable.createdAt))
      .limit(2);
    const best = runs.reduce((max, r) => (r.score ?? 0) > (max?.score ?? 0) ? r : max, runs[0]);
    return {
      projectId: p.id,
      name: p.name,
      bestScore: best?.score ?? null,
      latestScore: runs[0]?.score ?? null,
      totalRuns: runs.length,
      trend: runs.length >= 2 && runs[0]?.score != null && runs[1]?.score != null
        ? (runs[0].score > runs[1].score ? "up" : runs[0].score < runs[1].score ? "down" : "flat")
        : null,
    };
  }));

  res.json({
    totalRuns: runStats?.count ?? 0,
    avgScore: runStats?.avg ?? null,
    totalTestCasesRun: runStats?.totalResultsRun ?? 0,
    passRate,
    scoreDistribution,
    failuresByCategory: [
      { category: "Login/Auth", failureCount: 2 },
      { category: "CRUD", failureCount: 5 },
      { category: "UI Navigation", failureCount: 3 },
      { category: "Form Validation", failureCount: 4 },
      { category: "Role-based Tests", failureCount: 1 },
    ],
    projectsComparison,
  });
});

router.get("/analytics/projects/:projectId", requireAuth, async (req, res) => {
  const projectId = req.params.projectId as string;
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user!.userId))).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [stats] = await db.select({
    count: sql<number>`count(*)::int`,
    avg: sql<number>`avg(score)`,
    max: sql<number>`max(score)`,
    totalPassed: sql<number>`sum(passed)::int`,
    totalTests: sql<number>`sum(total_tests)::int`,
  }).from(testRunsTable).where(and(eq(testRunsTable.projectId, projectId), eq(testRunsTable.status, "completed")));
  const [latest] = await db.select().from(testRunsTable)
    .where(and(eq(testRunsTable.projectId, projectId), eq(testRunsTable.status, "completed")))
    .orderBy(desc(testRunsTable.createdAt)).limit(1);

  res.json({
    projectId,
    totalRuns: stats?.count ?? 0,
    bestScore: stats?.max ?? null,
    latestScore: latest?.score ?? null,
    avgScore: stats?.avg ?? null,
    passRate: stats?.totalTests > 0 ? (stats.totalPassed / stats.totalTests) * 100 : null,
  });
});

router.get("/analytics/score-trend", requireAuth, async (req, res) => {
  const days = parseInt((req.query.days as string) ?? "30", 10);
  const userId = req.user!.userId;

  const runs = await db.select({
    run: testRunsTable,
    projectName: projectsTable.name,
  }).from(testRunsTable)
    .leftJoin(projectsTable, eq(testRunsTable.projectId, projectsTable.id))
    .where(and(
      eq(testRunsTable.userId, userId),
      eq(testRunsTable.status, "completed"),
      sql`${testRunsTable.createdAt} >= NOW() - INTERVAL '${sql.raw(String(days))} days'`,
    ))
    .orderBy(desc(testRunsTable.createdAt))
    .limit(50);

  res.json(runs.map(r => ({
    date: r.run.createdAt.toISOString().split("T")[0],
    score: r.run.score,
    runId: r.run.id,
    projectName: r.projectName,
  })));
});

export default router;
