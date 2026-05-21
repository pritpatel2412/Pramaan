import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams, useLocation } from "wouter";
import { useGetRun, getGetRunQueryKey, useGetRunResults, getGetRunResultsQueryKey, useStopRun } from "@workspace/api-client-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Loader2, Square, FileText, Camera } from "lucide-react";
import { Link } from "wouter";

const LOG_TEMPLATES = [
  "Navigating to {url}...",
  "Waiting for page load...",
  "Locating element: {selector}",
  "Clicking on {element}",
  "Filling form field: {field}",
  "Waiting for response...",
  "Asserting page content...",
  "Checking URL: {url}",
  "Taking screenshot...",
  "Assertion passed: element visible",
  "Scrolling to bottom of page",
  "Checking database state...",
  "Verifying CRUD operation...",
  "Testing authentication flow...",
];

function generateLog(testTitle: string, index: number) {
  const template = LOG_TEMPLATES[index % LOG_TEMPLATES.length];
  return template
    .replace("{url}", "http://localhost:3000")
    .replace("{selector}", ".submit-btn")
    .replace("{element}", "Login Button")
    .replace("{field}", "email")
    .replace("{element}", testTitle);
}

function statusIcon(status: string, size = "w-4 h-4") {
  if (status === "passed") return <CheckCircle2 className={`${size} text-green-500`} />;
  if (status === "failed") return <XCircle className={`${size} text-red-500`} />;
  if (status === "running") return <Loader2 className={`${size} text-cyan-400 animate-spin`} />;
  return <Clock className={`${size} text-muted-foreground`} />;
}

type LogEntry = { time: string; text: string; level: "info" | "pass" | "fail" | "warn" };

export default function RunLive() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const runId = params.runId || "";
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const logsRef = useRef<HTMLDivElement>(null);
  const stopRun = useStopRun();

  const { data: run, refetch: refetchRun } = useGetRun(runId, {
    query: {
      enabled: !!runId,
      queryKey: getGetRunQueryKey(runId),
      refetchInterval: 2000,
    }
  });

  const { data: results } = useGetRunResults(runId, {
    query: {
      enabled: !!runId,
      queryKey: getGetRunResultsQueryKey(runId),
      refetchInterval: 2000,
    }
  });

  const totalTests = run?.totalTests ?? 0;
  const passed = run?.passed ?? 0;
  const failed = run?.failed ?? 0;
  const isComplete = run?.status === "completed" || run?.status === "failed";
  const isRunning = run?.status === "running";

  // EventSource stream for real-time logs
  useEffect(() => {
    if (!runId) return;

    const token = localStorage.getItem("autoviva_token");
    const sseUrl = `/api/runs/${runId}/stream?token=${encodeURIComponent(token || "")}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data);
        setLogs(prev => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            if (last.text === log.text && last.time === log.time) return prev;
          }
          return [...prev.slice(-250), log];
        });
      } catch (err) {
        console.error("Failed to parse log from SSE:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource connection error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runId]);

  // Update current test index based on results
  useEffect(() => {
    if (results) {
      setCurrentTestIndex(results.length);
    }
  }, [results]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Add completion log
  useEffect(() => {
    if (isComplete && run) {
      const now = new Date().toLocaleTimeString("en-US", { hour12: false });
      setLogs(prev => {
        const hasCompletionLog = prev.some(l => l.text.startsWith("Evaluation complete. Score:"));
        if (hasCompletionLog) return prev;
        return [...prev, {
          time: now,
          text: `Evaluation complete. Score: ${run.score}/100 (${run.grade}). ${run.passed} passed, ${run.failed} failed.`,
          level: "pass"
        }];
      });
    }
  }, [isComplete, run]);

  const handleStop = () => {
    stopRun.mutate({ runId }, {
      onSuccess: () => setLocation(`/runs/${runId}/report`)
    });
  };

  const progressPct = totalTests > 0 ? Math.round(((passed + failed) / totalTests) * 100) : 0;

  const latestScreenshot = results && results.length > 0
    ? [...results]
        .reverse()
        .flatMap(r => r.screenshots || [])
        .find(s => s.url)
    : null;

  return (
    <SidebarLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)] gap-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isRunning && <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />}
            {isComplete && <CheckCircle2 className="w-5 h-5 text-green-500" />}
            <h1 className="text-xl font-bold tracking-tight">
              {isRunning ? "Live Evaluation" : "Evaluation Complete"}
            </h1>
            <span className="text-sm text-muted-foreground">{run?.projectName ?? runId}</span>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <Button variant="destructive" size="sm" onClick={handleStop} className="gap-1">
                <Square className="w-3 h-3" />
                Stop
              </Button>
            )}
            {isComplete && (
              <Link href={`/runs/${runId}/report`}>
                <Button size="sm" className="gap-1">
                  <FileText className="w-4 h-4" />
                  View Report
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{passed + failed} of {totalTests} tests</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: Test Cases */}
          <div className="w-64 shrink-0 flex flex-col">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Test Cases</div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {totalTests === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">Loading...</div>
              ) : Array.from({ length: totalTests }).map((_, i) => {
                const result = results?.[i];
                const isCurrent = !result && i === currentTestIndex && isRunning;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors ${
                      isCurrent ? "bg-cyan-500/10 border border-cyan-500/30" :
                      result?.status === "passed" ? "bg-green-500/5" :
                      result?.status === "failed" ? "bg-red-500/5" :
                      "opacity-40"
                    }`}
                  >
                    {statusIcon(isCurrent ? "running" : result?.status ?? "pending")}
                    <span className="flex-1 truncate">{result?.title ?? `Test ${i + 1}`}</span>
                    {result?.durationSeconds && (
                      <span className="text-muted-foreground shrink-0">{result.durationSeconds.toFixed(1)}s</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center: Screenshot + Logs */}
          <div className="flex-1 flex flex-col min-w-0 gap-3">
            {/* Screenshot Area */}
            <div className="h-48 bg-card border border-border rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                {isRunning && (
                  <span className="flex items-center gap-1 bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/30 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              {latestScreenshot ? (
                <img
                  src={latestScreenshot.url}
                  alt={latestScreenshot.label || "Live browser capture"}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Camera className="w-8 h-8 mb-2 opacity-40" />
                  <span className="text-xs font-medium">{isRunning ? "Capturing screenshots..." : "No live screenshot"}</span>
                </div>
              )}
            </div>

            {/* Log Stream */}
            <div className="flex-1 bg-[#0a0f1a] border border-border rounded-lg overflow-hidden flex flex-col min-h-0">
              <div className="px-3 py-1.5 border-b border-border flex items-center gap-2 bg-card/50">
                <div className="flex gap-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-muted-foreground font-mono">autoviva-agent ~ log</span>
              </div>
              <div ref={logsRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
                {logs.length === 0 && isRunning && (
                  <div className="text-muted-foreground">Initializing evaluation agent...</div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-muted-foreground/50 shrink-0">{log.time}</span>
                    <span className={
                      log.level === "pass" ? "text-green-400" :
                      log.level === "fail" ? "text-red-400" :
                      log.level === "warn" ? "text-yellow-400" :
                      "text-slate-300"
                    }>{log.text}</span>
                  </div>
                ))}
                {isRunning && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground/50">{new Date().toLocaleTimeString("en-US", { hour12: false })}</span>
                    <span className="text-cyan-400 animate-pulse">_</span>
                  </div>
                )}
                {isComplete && (
                  <div className="mt-2 text-green-400 font-bold">
                    ✓ Evaluation finished. Score: {run?.score}/100
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Stats */}
          <div className="w-48 shrink-0 flex flex-col gap-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stats</div>
            <div className="grid grid-cols-1 gap-2">
              <div className="p-3 bg-card border border-border rounded-lg text-center">
                <div className="text-2xl font-bold text-green-400">{passed}</div>
                <div className="text-xs text-muted-foreground">Passed</div>
              </div>
              <div className="p-3 bg-card border border-border rounded-lg text-center">
                <div className="text-2xl font-bold text-red-400">{failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="p-3 bg-card border border-border rounded-lg text-center">
                <div className="text-2xl font-bold text-muted-foreground">{totalTests - passed - failed}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              {isComplete && (
                <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">{run?.score ?? "?"}</div>
                  <div className="text-xs text-muted-foreground">Final Score</div>
                </div>
              )}
            </div>

            {run?.durationSeconds && (
              <div className="p-3 bg-card border border-border rounded-lg text-center">
                <div className="text-sm font-bold">{run.durationSeconds}s</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
