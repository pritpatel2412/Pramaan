import { useAuth } from "@/lib/auth";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { FolderGit2, PlayCircle, Award, CheckCircle2, AlertCircle, Plus, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useGetDashboardStats({ query: { queryKey: ["dashboard-stats"] } });

  const getScoreColor = (score: number | null | undefined) => {
    if (score == null) return "text-muted-foreground";
    if (score >= 75) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <SidebarLayout>
      <div className="flex flex-col gap-8">
        {/* Welcome Banner */}
        <div className="bg-card border border-border rounded-xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[60px] pointer-events-none -mt-32 -mr-32" />
          
          <div className="relative z-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {user?.name}</h1>
            <p className="text-muted-foreground max-w-2xl">
              Ready to evaluate your latest code? AutoViva AI is standing by to run full diagnostic tests on your localhost projects.
            </p>
          </div>
          
          <div className="relative z-10 shrink-0">
            <Link href="/projects/new">
              <Button size="lg" className="gap-2">
                <Plus className="w-5 h-5" />
                New Project
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FolderGit2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "-" : stats?.totalProjects || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
              <PlayCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "-" : stats?.totalRuns || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getScoreColor(stats?.avgScore)}`}>
                {isLoading ? "-" : (stats?.avgScore != null ? Math.round(stats.avgScore) : "N/A")}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "-" : (stats?.passRate != null ? `${Math.round(stats.passRate)}%` : "N/A")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout for Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Evaluations Table */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Evaluations</CardTitle>
                <CardDescription>Your latest test runs and their scores.</CardDescription>
              </div>
              <Link href="/runs">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
              ) : stats?.recentRuns && stats.recentRuns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-md">
                      <tr>
                        <th className="px-4 py-3 font-medium">Project</th>
                        <th className="px-4 py-3 font-medium">Mode</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {stats.recentRuns.map((run) => (
                        <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">
                            {run.projectName || run.projectId}
                          </td>
                          <td className="px-4 py-3">
                            <span className="capitalize">{run.mode.replace("_", " ")}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {run.status === "completed" ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : run.status === "failed" ? (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                              )}
                              <span className="capitalize">{run.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {run.score != null ? (
                              <span className={`font-bold ${getScoreColor(run.score)}`}>
                                {Math.round(run.score)} / 100
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {run.createdAt ? new Date(run.createdAt).toLocaleDateString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
                  <PlayCircle className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No evaluations yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                    Run your first test suite to see the results here.
                  </p>
                  <Link href="/projects">
                    <Button variant="outline">Go to Projects</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Getting Started Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Steps to your first evaluation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium line-through text-muted-foreground">Create account</h4>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${stats?.totalProjects && stats.totalProjects > 0 ? "bg-primary/20 text-primary" : "border border-border"}`}>
                    {stats?.totalProjects && stats.totalProjects > 0 ? <CheckCircle2 className="w-3 h-3" /> : <span className="text-[10px]">2</span>}
                  </div>
                  <div>
                    <h4 className={`text-sm font-medium ${stats?.totalProjects && stats.totalProjects > 0 ? "line-through text-muted-foreground" : "text-foreground"}`}>Add your project</h4>
                    <p className="text-xs text-muted-foreground mt-1">Connect your localhost application URL.</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${stats?.totalRuns && stats.totalRuns > 0 ? "bg-primary/20 text-primary" : "border border-border"}`}>
                    {stats?.totalRuns && stats.totalRuns > 0 ? <CheckCircle2 className="w-3 h-3" /> : <span className="text-[10px]">3</span>}
                  </div>
                  <div>
                    <h4 className={`text-sm font-medium ${stats?.totalRuns && stats.totalRuns > 0 ? "line-through text-muted-foreground" : "text-foreground"}`}>Run evaluation</h4>
                    <p className="text-xs text-muted-foreground mt-1">Generate AI tests and run them.</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded-full border border-border flex items-center justify-center shrink-0">
                    <span className="text-[10px]">4</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground">Review report</h4>
                    <p className="text-xs text-muted-foreground mt-1">Analyze bugs, view screenshots, and chat with the Viva Agent.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </SidebarLayout>
  );
}
