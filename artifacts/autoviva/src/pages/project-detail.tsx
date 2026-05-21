import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams, Link } from "wouter";
import {
  useGetProject, getGetProjectQueryKey,
  useListCredentials, getListCredentialsQueryKey,
  useListTestSuites, getListTestSuitesQueryKey,
  useListRuns, getListRunsQueryKey,
  useDeleteProject, useDeleteCredential,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Code2, LogIn, Plus, Play, Edit, Trash2, ChevronRight,
  ShieldCheck, Clock, CheckCircle2, XCircle, ExternalLink, AlertCircle
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

function scoreColor(score: number | null | undefined) {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function runStatusBadge(status: string) {
  const variants: Record<string, string> = {
    completed: "bg-green-500/10 text-green-400 border-green-500/20",
    running: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };
  return variants[status] ?? "bg-muted text-muted-foreground border-border";
}

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.projectId || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });
  const { data: credentials } = useListCredentials(projectId, {
    query: { enabled: !!projectId, queryKey: getListCredentialsQueryKey(projectId) }
  });
  const { data: suites } = useListTestSuites(projectId, {
    query: { enabled: !!projectId, queryKey: getListTestSuitesQueryKey(projectId) }
  });
  const { data: runs } = useListRuns(
    { projectId },
    { query: { enabled: !!projectId, queryKey: getListRunsQueryKey({ projectId }) } }
  );

  const deleteProject = useDeleteProject();
  const deleteCredential = useDeleteCredential();

  const handleDeleteProject = () => {
    deleteProject.mutate({ projectId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRunsQueryKey({}) });
        setLocation("/projects");
      }
    });
  };

  const handleDeleteCredential = (credentialId: string) => {
    deleteCredential.mutate({ projectId, credentialId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCredentialsQueryKey(projectId) })
    });
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </SidebarLayout>
    );
  }

  if (!project) {
    return (
      <SidebarLayout>
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">Project not found</p>
          <Link href="/projects"><Button variant="outline" className="mt-4">Back to Projects</Button></Link>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <Badge className={project.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20 border" : "bg-muted text-muted-foreground border-border border"}>
                {project.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">{project.description || "No description"}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{project.baseUrl}</span>
              {project.techStack && <span className="flex items-center gap-1"><Code2 className="w-3 h-3" />{project.techStack}</span>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/projects/${projectId}/edit`}>
              <Button variant="outline" size="sm" className="gap-1">
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            </Link>
            <Link href={`/runs/new?projectId=${projectId}`}>
              <Button size="sm" className="gap-1">
                <Play className="w-4 h-4" />
                Run Evaluation
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Test Suites</div>
            <div className="text-2xl font-bold">{suites?.length ?? project.testSuiteCount ?? 0}</div>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Total Runs</div>
            <div className="text-2xl font-bold">{runs?.length ?? project.runCount ?? 0}</div>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Avg Score</div>
            <div className={`text-2xl font-bold ${scoreColor(project.avgScore)}`}>
              {project.avgScore != null ? Math.round(project.avgScore) : "N/A"}
            </div>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Last Score</div>
            <div className={`text-2xl font-bold ${scoreColor(project.lastRunScore)}`}>
              {project.lastRunScore != null ? `${project.lastRunScore} (${project.lastRunGrade})` : "N/A"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Suites & Credentials */}
          <div className="lg:col-span-1 space-y-4">
            {/* Test Suites */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Test Suites</CardTitle>
                <Link href={`/projects/${projectId}/test-suites/new`}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> New
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {suites?.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground mb-3">No test suites yet</p>
                    <Link href={`/projects/${projectId}/test-suites/new`}>
                      <Button variant="outline" size="sm" className="text-xs">Create Suite</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {suites?.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-md transition-colors">
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{(s as any).testCaseCount ?? 0} test cases</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link href={`/test-suites/${s.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Edit className="w-3 h-3" />
                            </Button>
                          </Link>
                          <Link href={`/runs/new?projectId=${projectId}&suiteId=${s.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-primary">
                              <Play className="w-3 h-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Credentials */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Test Credentials</CardTitle>
                <Link href={`/projects/${projectId}/edit`}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {credentials?.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No credentials added</p>
                ) : (
                  <div className="space-y-2">
                    {credentials?.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 hover:bg-muted/30 rounded-md">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-medium capitalize">{c.role}</p>
                            <p className="text-xs text-muted-foreground">{c.username}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                          onClick={() => handleDeleteCredential(c.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Recent Runs */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Evaluation History</CardTitle>
                <Link href={`/runs/new?projectId=${projectId}`}>
                  <Button size="sm" className="h-7 text-xs gap-1">
                    <Play className="w-3 h-3" />
                    New Run
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {!runs || runs.length === 0 ? (
                  <div className="text-center py-12">
                    <Play className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No evaluations yet</p>
                    <Link href={`/runs/new?projectId=${projectId}`}>
                      <Button variant="outline" size="sm" className="mt-4">Start First Evaluation</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(runs as any[]).slice(0, 10).map((run: any) => (
                      <div key={run.id} className="flex items-center gap-3 p-3 hover:bg-muted/20 rounded-lg transition-colors group">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          run.status === "completed" ? "bg-green-500" :
                          run.status === "running" ? "bg-cyan-500 animate-pulse" :
                          run.status === "failed" ? "bg-red-500" : "bg-yellow-500"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium capitalize">{run.mode?.replace("_", " ")}</span>
                            {run.suiteName && <span className="text-xs text-muted-foreground truncate">— {run.suiteName}</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(run.createdAt).toLocaleDateString()}
                            </span>
                            {run.totalTests && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                {run.passed}/{run.totalTests}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {run.score != null && (
                            <span className={`text-sm font-bold ${scoreColor(run.score)}`}>{run.score}</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${runStatusBadge(run.status)}`}>
                            {run.status}
                          </span>
                          {run.status === "completed" && (
                            <Link href={`/runs/${run.id}/report`}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Danger Zone */}
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="text-sm text-red-400">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Delete Project</p>
                <p className="text-xs text-muted-foreground">Permanently delete this project and all its data</p>
              </div>
              {confirmDelete ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button size="sm" variant="destructive" onClick={handleDeleteProject} disabled={deleteProject.isPending}>
                    {deleteProject.isPending ? "Deleting..." : "Confirm Delete"}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
