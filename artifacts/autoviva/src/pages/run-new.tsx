import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useLocation, useSearch } from "wouter";
import { useListProjects, getListProjectsQueryKey, useListTestSuites, getListTestSuitesQueryKey, useStartRun } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, ShieldCheck, Eye, Zap, ChevronRight, AlertCircle } from "lucide-react";

type EvalMode = "pre_check" | "live_demo" | "strict";

const MODES: { id: EvalMode; label: string; desc: string; icon: any; badge?: string }[] = [
  {
    id: "pre_check",
    label: "Pre-Check",
    icon: ShieldCheck,
    desc: "Fast diagnostic pass. Runs all test cases once without retries. Best for quick status checks before your viva.",
  },
  {
    id: "live_demo",
    label: "Live Demo",
    icon: Eye,
    desc: "Simulates an examiner watching your demo. Slower, more thorough. Captures more screenshots for evidence.",
    badge: "Recommended",
  },
  {
    id: "strict",
    label: "Strict Mode",
    icon: Zap,
    desc: "Maximum rigor. Every assertion is double-checked. Used for formal academic evaluations and grading.",
  },
];

export default function RunNew() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedProjectId = params.get("projectId") ?? "";
  const preselectedSuiteId = params.get("suiteId") ?? "";

  const [, setLocation] = useLocation();
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId);
  const [selectedSuiteId, setSelectedSuiteId] = useState(preselectedSuiteId);
  const [mode, setMode] = useState<EvalMode>("live_demo");
  const [multiBrowser, setMultiBrowser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading } = useListProjects(
    undefined,
    { query: { queryKey: getListProjectsQueryKey() } }
  );

  const { data: suites, isLoading: suitesLoading } = useListTestSuites(
    selectedProjectId,
    { query: { enabled: !!selectedProjectId, queryKey: getListTestSuitesQueryKey(selectedProjectId) } }
  );

  const startRun = useStartRun();

  useEffect(() => {
    if (preselectedProjectId) setSelectedProjectId(preselectedProjectId);
    if (preselectedSuiteId) setSelectedSuiteId(preselectedSuiteId);
  }, [preselectedProjectId, preselectedSuiteId]);

  // Auto-select first suite when project changes
  useEffect(() => {
    if (suites && suites.length > 0 && !selectedSuiteId) {
      setSelectedSuiteId(suites[0].id);
    }
    if (suites && suites.length === 0) setSelectedSuiteId("");
  }, [suites]);

  const selectedProject = projects?.find(p => p.id === selectedProjectId);
  const selectedSuite = suites?.find(s => s.id === selectedSuiteId);

  const handleStart = () => {
    if (!selectedProjectId) { setError("Please select a project"); return; }
    if (!selectedSuiteId) { setError("Please select a test suite"); return; }
    setError(null);

    startRun.mutate(
      { data: { projectId: selectedProjectId, suiteId: selectedSuiteId, mode, multiBrowser } },
      {
        onSuccess: (run) => setLocation(`/runs/${run.id}/live`),
        onError: (err: any) => setError(err?.data?.error ?? "Failed to start evaluation"),
      }
    );
  };

  return (
    <SidebarLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Start Evaluation</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure and launch an AI-powered test run for your project</p>
        </div>

        {/* Project & Suite Selection */}
        <Card>
          <CardHeader>
            <CardTitle>1. Select Target</CardTitle>
            <CardDescription>Choose which project and test suite to evaluate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={projectsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={projectsLoading ? "Loading..." : "Select a project"} />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.baseUrl}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Test Suite</label>
              <Select
                value={selectedSuiteId}
                onValueChange={setSelectedSuiteId}
                disabled={!selectedProjectId || suitesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedProjectId ? "Select a project first" :
                    suitesLoading ? "Loading suites..." :
                    suites?.length === 0 ? "No suites — create one first" :
                    "Select a test suite"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {suites?.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground">{(s as any).testCaseCount ?? 0} tests</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProjectId && suites?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No test suites found.{" "}
                  <a href={`/projects/${selectedProjectId}/test-suites/new`} className="text-primary underline">
                    Create one
                  </a>
                </p>
              )}
            </div>

            {/* Project Preview */}
            {selectedProject && (
              <div className="p-3 bg-muted/30 border border-border rounded-lg text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">URL</span>
                  <span className="font-mono text-xs">{selectedProject.baseUrl}</span>
                </div>
                {selectedProject.techStack && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Stack</span>
                    <span className="text-xs">{selectedProject.techStack}</span>
                  </div>
                )}
                {selectedSuite && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tests</span>
                    <span className="text-xs">{(selectedSuite as any).testCaseCount ?? 0} test cases</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle>2. Evaluation Mode</CardTitle>
            <CardDescription>Choose how rigorously AutoViva should test your project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`relative p-4 rounded-xl border text-left transition-all ${
                    mode === m.id
                      ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  {m.badge && (
                    <span className="absolute top-2 right-2 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full border border-primary/30">
                      {m.badge}
                    </span>
                  )}
                  <m.icon className={`w-5 h-5 mb-2 ${mode === m.id ? "text-primary" : "text-muted-foreground"}`} />
                  <p className={`text-sm font-semibold mb-1 ${mode === m.id ? "text-foreground" : "text-muted-foreground"}`}>
                    {m.label}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Multi-Browser Visual Regression */}
        <Card className="relative overflow-hidden border-border bg-card/40 backdrop-blur-md">
          {multiBrowser && (
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          )}
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>3. Cross-Browser Visual Regression</span>
              <span className="text-[10px] uppercase tracking-wider bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20">Advanced</span>
            </CardTitle>
            <CardDescription>Evaluate browser compatibility and layout drift pixel-by-pixel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              onClick={() => setMultiBrowser(!multiBrowser)}
              className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                multiBrowser 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  checked={multiBrowser}
                  onChange={() => {}}
                  className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-0 focus:ring-offset-0"
                />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Enable Sequential Cross-Browser Validation
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automatically launches test cases across Chromium (baseline), Firefox, and Safari (WebKit).
                  Calculates pixel mismatches and renders an interactive slider compare overlay in your report.
                </p>
                
                {/* Browser Logos */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    Chromium
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    Firefox
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    WebKit (Safari)
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Start Button */}
        <div className="flex justify-end gap-3 pb-8">
          <Button
            size="lg"
            onClick={handleStart}
            disabled={!selectedProjectId || !selectedSuiteId || startRun.isPending}
            className="gap-2 min-w-40"
          >
            {startRun.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Evaluation
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </SidebarLayout>
  );
}
