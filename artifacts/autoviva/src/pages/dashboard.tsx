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
    if (score == null) return "text-neutral-400";
    if (score >= 75) return "text-[#11ff99]";
    if (score >= 50) return "text-[#ffc53d]";
    return "text-[#ff2047]";
  };

  return (
    <SidebarLayout>
      <div className="flex flex-col gap-10">
        {/* Welcome Banner with Low Opacity Orange Glow */}
        <div className="bg-[#0a0a0c] border border-white/14 rounded-lg p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(circle_at_top_right,rgba(255,89,0,0.08)_0%,rgba(0,0,0,0)_60%)] pointer-events-none" />
          
          <div className="relative z-10">
            <h1 className="text-3xl sm:text-4xl font-display font-medium text-[#fcfdff] tracking-[-0.03em] mb-3">
              Welcome back, {user?.name}
            </h1>
            <p className="text-sm text-[#a1a4a5] max-w-2xl leading-relaxed font-sans">
              AutoViva AI is standing by. Stress-test your localhost projects, audit visual drift across layouts, and verify your development quality before your actual examiner does.
            </p>
          </div>
          
          <div className="relative z-10 shrink-0">
            <Link href="/projects/new">
              <Button className="bg-[#fcfdff] text-black hover:bg-[#f1f7fe] font-sans font-medium rounded-md text-xs px-4 h-9 shadow-none flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-6 hover:border-white/14 transition-colors">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Total Projects</span>
              <FolderGit2 className="h-4 w-4 text-[#888e90]" />
            </div>
            <div className="text-3xl font-display font-medium text-[#fcfdff] tracking-tight mt-1">
              {isLoading ? "—" : stats?.totalProjects || 0}
            </div>
            <div className="text-[10px] font-code text-[#888e90] mt-2">Active targets</div>
          </div>
          
          <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-6 hover:border-white/14 transition-colors">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Total Evaluations</span>
              <PlayCircle className="h-4 w-4 text-[#888e90]" />
            </div>
            <div className="text-3xl font-display font-medium text-[#fcfdff] tracking-tight mt-1">
              {isLoading ? "—" : stats?.totalRuns || 0}
            </div>
            <div className="text-[10px] font-code text-[#888e90] mt-2">E2E suite cycles</div>
          </div>
          
          <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-6 hover:border-white/14 transition-colors">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Average Score</span>
              <Award className="h-4 w-4 text-[#888e90]" />
            </div>
            <div className={`text-3xl font-display font-medium tracking-tight mt-1 ${getScoreColor(stats?.avgScore)}`}>
              {isLoading ? "—" : (stats?.avgScore != null ? `${Math.round(stats.avgScore)}/100` : "N/A")}
            </div>
            <div className="text-[10px] font-code text-[#888e90] mt-2">Evaluation rating</div>
          </div>
          
          <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-6 hover:border-white/14 transition-colors">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Pass Rate</span>
              <CheckCircle2 className="h-4 w-4 text-[#888e90]" />
            </div>
            <div className="text-3xl font-display font-medium text-[#fcfdff] tracking-tight mt-1">
              {isLoading ? "—" : (stats?.passRate != null ? `${Math.round(stats.passRate)}%` : "N/A")}
            </div>
            <div className="text-[10px] font-code text-[#888e90] mt-2">Successful thresholds</div>
          </div>
        </div>

        {/* Two Column Layout for Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Evaluations Table */}
          <div className="lg:col-span-2 bg-[#0a0a0c] border border-white/6 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-sans font-medium text-[#fcfdff]">Recent Evaluations</h3>
                <p className="text-xs text-[#888e90] mt-1 font-sans">Your latest test runs and their scores.</p>
              </div>
              <Link href="/runs">
                <Button variant="ghost" className="text-xs text-[#a1a4a5] hover:text-[#fcfdff] hover:bg-white/4 border border-white/6 rounded-md h-8 px-3 flex items-center gap-1">
                  View All <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>

            <div>
              {isLoading ? (
                <div className="text-xs text-[#888e90] py-12 text-center font-sans">Loading metrics data...</div>
              ) : stats?.recentRuns && stats.recentRuns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[#a1a4a5] uppercase tracking-wider font-sans border-b border-white/6">
                      <tr>
                        <th className="px-4 py-3 font-medium">Project</th>
                        <th className="px-4 py-3 font-medium">Mode</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6 text-neutral-300">
                      {stats.recentRuns.map((run) => (
                        <tr key={run.id} className="hover:bg-white/4 transition-colors duration-150">
                          <td className="px-4 py-4 font-medium text-[#fcfdff]">
                            {run.projectName || run.projectId}
                          </td>
                          <td className="px-4 py-4 capitalize font-mono text-[11px] text-neutral-400">
                            {run.mode.replace("_", " ")}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {run.status === "completed" ? (
                                <span className="w-2 h-2 rounded-full bg-[#11ff99]" />
                              ) : run.status === "failed" ? (
                                <span className="w-2 h-2 rounded-full bg-[#ff2047]" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-[#ffc53d] animate-pulse" />
                              )}
                              <span className="capitalize font-sans text-xs text-neutral-400">{run.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono">
                            {run.score != null ? (
                              <span className={getScoreColor(run.score)}>
                                {Math.round(run.score)}%
                              </span>
                            ) : (
                              <span className="text-[#888e90]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 font-sans text-[#888e90]">
                            {run.createdAt ? new Date(run.createdAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/6 rounded-lg bg-black">
                  <PlayCircle className="w-10 h-10 text-[#888e90] mb-4" />
                  <h3 className="text-sm font-sans font-medium text-[#fcfdff]">No evaluations yet</h3>
                  <p className="text-xs text-[#a1a4a5] max-w-xs mt-2 mb-6 font-sans leading-relaxed">
                    Run your first test suite on a localhost URL to view results here.
                  </p>
                  <Link href="/projects">
                    <Button variant="ghost" className="text-xs text-[#fcfdff] bg-[#101012] border border-white/14 hover:bg-neutral-900 rounded-md h-9 px-4 font-sans font-medium transition-colors">
                      Go to Projects
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Getting Started Checklist */}
          <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-6">
            <h3 className="text-lg font-sans font-medium text-[#fcfdff] mb-2">Getting Started</h3>
            <p className="text-xs text-[#888e90] mb-6 font-sans">Four steps to your first AutoViva AI score.</p>
            
            <div className="space-y-6 font-sans">
              <div className="flex gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-white/6 border border-white/14 text-[#11ff99] flex items-center justify-center shrink-0 text-xs">
                  ✓
                </div>
                <div>
                  <h4 className="text-sm font-medium line-through text-[#888e90]">Create account</h4>
                  <p className="text-xs text-neutral-600 mt-0.5">Finished setting up profile</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs ${stats?.totalProjects && stats.totalProjects > 0 ? "bg-white/6 border border-white/14 text-[#11ff99]" : "border border-white/6 text-[#888e90]"}`}>
                  {stats?.totalProjects && stats.totalProjects > 0 ? "✓" : "2"}
                </div>
                <div>
                  <h4 className={`text-sm font-medium ${stats?.totalProjects && stats.totalProjects > 0 ? "line-through text-[#888e90]" : "text-[#fcfdff]"}`}>Add your project</h4>
                  <p className="text-xs text-[#888e90] mt-0.5">Connect your localhost application URL.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs ${stats?.totalRuns && stats.totalRuns > 0 ? "bg-white/6 border border-white/14 text-[#11ff99]" : "border border-white/6 text-[#888e90]"}`}>
                  {stats?.totalRuns && stats.totalRuns > 0 ? "✓" : "3"}
                </div>
                <div>
                  <h4 className={`text-sm font-medium ${stats?.totalRuns && stats.totalRuns > 0 ? "line-through text-[#888e90]" : "text-[#fcfdff]"}`}>Run evaluation</h4>
                  <p className="text-xs text-[#888e90] mt-0.5">Generate AI tests and run them.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="mt-0.5 w-5 h-5 rounded-full border border-white/6 flex items-center justify-center shrink-0 text-xs text-[#888e90]">
                  4
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[#fcfdff]">Review report</h4>
                  <p className="text-xs text-[#888e90] mt-0.5">Analyze bugs, view screenshots, and chat with the Viva Agent.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </SidebarLayout>
  );
}
