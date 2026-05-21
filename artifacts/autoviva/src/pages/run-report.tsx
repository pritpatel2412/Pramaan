import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams, Link } from "wouter";
import { useGetReport, getGetReportQueryKey, useGetRun, getGetRunQueryKey, useAskVivaAgent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { CheckCircle2, XCircle, AlertTriangle, Download, MessageSquare, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

function gradeColor(grade: string | null | undefined) {
  if (!grade) return "text-muted-foreground";
  if (grade === "A+" || grade === "A") return "text-green-400";
  if (grade === "B") return "text-cyan-400";
  if (grade === "C") return "text-yellow-400";
  return "text-red-400";
}

function scoreColor(score: number | null | undefined) {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

function statusIcon(status: string) {
  if (status === "passed") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
}

function severityColor(s: string) {
  if (s === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (s === "major") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
}

export default function RunReport() {
  const params = useParams();
  const runId = params.runId || "";
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const { data: run } = useGetRun(runId, {
    query: { enabled: !!runId, queryKey: getGetRunQueryKey(runId) }
  });
  const { data: report, isLoading } = useGetReport(runId, {
    query: { enabled: !!runId, queryKey: getGetReportQueryKey(runId) }
  });

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Generating report...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (!report) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <p className="text-lg font-medium">Report not ready yet</p>
            <p className="text-sm text-muted-foreground mt-1">The evaluation may still be running. Check back in a moment.</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Refresh</Button>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  const score = run?.score ?? report.run?.score ?? 0;
  const grade = run?.grade ?? report.run?.grade ?? "F";
  const breakdown = report.scoreBreakdown as Record<string, number> ?? {};
  const breakdownData = Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  const bugs = (report.bugsFound as any[]) ?? [];
  const coverage = (report.featureCoverage as any[]) ?? [];
  const results = (report.results as any[]) ?? [];
  const findings = (report.keyFindings as string[]) ?? [];
  const suggestions = (report.suggestions as string[]) ?? [];

  return (
    <SidebarLayout>
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border -mx-6 px-6 py-3 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Evaluation Report</p>
            <p className="font-semibold text-sm">{run?.projectName ?? "Project"}</p>
          </div>
          <div className={`text-2xl font-bold ${scoreColor(score)}`}>{score}/100</div>
          <span className={`text-lg font-bold ${gradeColor(grade)}`}>{grade}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/runs/${runId}/viva`}>
            <Button variant="outline" size="sm" className="gap-1">
              <MessageSquare className="w-4 h-4" />
              Ask Viva Agent
            </Button>
          </Link>
          <Button size="sm" className="gap-1">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="space-y-6 max-w-5xl">
        {/* Score Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <div className="relative w-36 h-36 mb-4">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={scoreBg(score)} strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 40 * score / 100} ${2 * Math.PI * 40 * (1 - score / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black ${scoreColor(score)}`}>{score}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
              </div>
              <div className={`text-3xl font-bold ${gradeColor(grade)}`}>{grade}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {grade === "A+" ? "Exceptional" : grade === "A" ? "Excellent" : grade === "B" ? "Good" : grade === "C" ? "Average" : "Needs Work"}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 w-full text-center text-sm">
                <div>
                  <div className="text-green-400 font-bold text-lg">{run?.passed ?? 0}</div>
                  <div className="text-muted-foreground text-xs">Passed</div>
                </div>
                <div>
                  <div className="text-red-400 font-bold text-lg">{run?.failed ?? 0}</div>
                  <div className="text-muted-foreground text-xs">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {breakdownData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={breakdownData} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <XAxis type="number" domain={[0, 30]} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={80} />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6 }}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {breakdownData.map((entry, i) => (
                        <Cell key={i} fill={scoreBg(entry.value * 3.3)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-sm text-muted-foreground py-8 text-center">No breakdown available</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Executive Summary */}
        <Card>
          <CardHeader><CardTitle>Executive Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
            {findings.length > 0 && (
              <ul className="space-y-2">
                {findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card>
          <CardHeader><CardTitle>Test Results ({results.length} cases)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No test results available</p>
            ) : results.map((r: any) => (
              <div key={r.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedResult(expandedResult === r.id ? null : r.id)}
                >
                  {statusIcon(r.status)}
                  <span className="flex-1 text-sm font-medium">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{r.durationSeconds?.toFixed(1)}s</span>
                  <Badge variant={r.status === "passed" ? "default" : "destructive"} className="text-xs">
                    {r.status}
                  </Badge>
                  {expandedResult === r.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expandedResult === r.id && (
                  <div className="px-4 pb-4 border-t border-border bg-muted/10 space-y-3 pt-3">
                    {r.errorMessage && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
                        <p className="text-xs font-medium text-red-400 mb-1">Error</p>
                        <p className="text-xs text-red-300 font-mono">{r.errorMessage}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>Steps executed: <span className="text-foreground">{r.stepsExecuted ?? "N/A"}</span></div>
                      <div>Duration: <span className="text-foreground">{r.durationSeconds?.toFixed(2)}s</span></div>
                    </div>
                    {r.screenshots?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-2">Screenshots</p>
                        <div className="flex gap-2 flex-wrap">
                          {r.screenshots.map((s: any) => (
                            <div key={s.id} className="relative">
                              <img
                                src={s.url || "/placeholder-screenshot.png"}
                                alt={s.label || "Screenshot"}
                                className="w-24 h-16 object-cover rounded border border-border"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                              {s.label && <p className="text-xs text-muted-foreground mt-1 text-center">{s.label}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Examiner Notes & Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>AI Examiner Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{report.aiNotes}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Bugs Found */}
        {bugs.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Bugs Found ({bugs.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bugs.map((bug: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                    <Badge className={`text-xs border ${severityColor(bug.severity)} shrink-0`}>{bug.severity}</Badge>
                    <div>
                      <p className="text-sm font-medium">{bug.issue}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{bug.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feature Coverage */}
        {coverage.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Feature Coverage</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {coverage.map((f: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
                    f.status === "passed" ? "bg-green-500/10 border-green-500/20 text-green-400" :
                    f.status === "failed" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                    "bg-muted/50 border-border text-muted-foreground"
                  }`}>
                    {f.status === "passed" ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : f.status === "failed" ? <XCircle className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                    {f.feature}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center pt-4 pb-8">
          <Link href={`/runs/${runId}/viva`}>
            <Button size="lg" className="gap-2">
              <MessageSquare className="w-5 h-5" />
              Continue to Viva Mode
            </Button>
          </Link>
        </div>
      </div>
    </SidebarLayout>
  );
}
