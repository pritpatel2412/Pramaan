import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey, useGetScoreTrend, getGetScoreTrendQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { TrendingUp, Target, Activity, CheckCircle2 } from "lucide-react";

type TrendPeriod = 7 | 30 | 90;

function gradeColor(grade: string) {
  const colors: Record<string, string> = { "A+": "#22c55e", "A": "#4ade80", "B": "#06b6d4", "C": "#eab308", "F": "#ef4444" };
  return colors[grade] ?? "#64748b";
}

function scoreColor(score: number | null | undefined) {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function trendIcon(trend: string | null) {
  if (trend === "up") return <span className="text-green-400 text-xs">+</span>;
  if (trend === "down") return <span className="text-red-400 text-xs">-</span>;
  return <span className="text-muted-foreground text-xs">=</span>;
}

export default function Analytics() {
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>(30);

  const { data: overview, isLoading: overviewLoading } = useGetAnalyticsOverview({
    query: { queryKey: getGetAnalyticsOverviewQueryKey() }
  });

  const { data: trendRaw, isLoading: trendLoading } = useGetScoreTrend(
    { days: trendPeriod },
    { query: { queryKey: getGetScoreTrendQueryKey({ days: trendPeriod }) } }
  );

  const trend = Array.isArray(trendRaw) ? trendRaw : [];
  const scoreDistribution = (overview?.scoreDistribution as any[]) ?? [];
  const failures = (overview?.failuresByCategory as any[]) ?? [];
  const projects = (overview?.projectsComparison as any[]) ?? [];

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Performance insights across all your evaluations</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Evaluations",
              value: overviewLoading ? "-" : overview?.totalRuns ?? 0,
              icon: Activity,
              color: "text-primary",
            },
            {
              label: "Average Score",
              value: overviewLoading ? "-" : (overview?.avgScore != null ? `${Math.round(overview.avgScore)}/100` : "N/A"),
              icon: Target,
              color: scoreColor(overview?.avgScore),
            },
            {
              label: "Test Cases Run",
              value: overviewLoading ? "-" : overview?.totalTestCasesRun ?? 0,
              icon: CheckCircle2,
              color: "text-green-400",
            },
            {
              label: "Pass Rate",
              value: overviewLoading ? "-" : (overview?.passRate != null ? `${Math.round(overview.passRate)}%` : "N/A"),
              icon: TrendingUp,
              color: "text-cyan-400",
            },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`}>{String(stat.value)}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Score Trend Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Score Trend</CardTitle>
            <div className="flex gap-1">
              {([7, 30, 90] as TrendPeriod[]).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={trendPeriod === p ? "default" : "ghost"}
                  className="h-7 text-xs px-3"
                  onClick={() => setTrendPeriod(p)}
                >
                  {p}d
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
            ) : trend.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No data for the selected period. Run some evaluations to see trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6 }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: any) => [`${value}/100`, "Score"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: "#06b6d4", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Score Distribution */}
          <Card>
            <CardHeader><CardTitle>Score Distribution by Grade</CardTitle></CardHeader>
            <CardContent>
              {scoreDistribution.every((d: any) => d.count === 0) ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  No completed evaluations yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreDistribution}>
                    <XAxis dataKey="grade" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6 }}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {scoreDistribution.map((entry: any) => (
                        <Cell key={entry.grade} fill={gradeColor(entry.grade)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Common Failures */}
          <Card>
            <CardHeader><CardTitle>Most Common Failures</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {failures.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No failure data available</p>
                ) : failures.map((f: any) => (
                  <div key={f.category} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">{f.category}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500/70 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (f.failureCount / 10) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">{f.failureCount}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Comparison */}
        {projects.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Projects Comparison</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase border-b border-border">
                      <th className="text-left py-2 pb-3 pr-4">Project</th>
                      <th className="text-right py-2 pb-3 px-4">Best Score</th>
                      <th className="text-right py-2 pb-3 px-4">Latest Score</th>
                      <th className="text-right py-2 pb-3 px-4">Total Runs</th>
                      <th className="text-right py-2 pb-3 pl-4">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {projects.map((p: any) => (
                      <tr key={p.projectId} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 pr-4 font-medium">{p.name}</td>
                        <td className={`py-3 px-4 text-right font-bold ${scoreColor(p.bestScore)}`}>
                          {p.bestScore ?? "-"}
                        </td>
                        <td className={`py-3 px-4 text-right ${scoreColor(p.latestScore)}`}>
                          {p.latestScore ?? "-"}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{p.totalRuns}</td>
                        <td className="py-3 pl-4 text-right">{trendIcon(p.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarLayout>
  );
}
