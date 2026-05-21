import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams, useLocation, Link } from "wouter";
import { useGetTestSuite, getGetTestSuiteQueryKey, useUpdateTestSuite, useDeleteTestSuite } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2, Play, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Code, Eye, Loader2 } from "lucide-react";

type EditorMode = "visual" | "json";

function priorityColor(p: string) {
  if (p === "high") return "bg-red-500/10 text-red-400 border-red-500/20";
  if (p === "medium") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  return "bg-blue-500/10 text-blue-400 border-blue-500/20";
}

export default function TestSuiteDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const suiteId = params.suiteId || "";
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<EditorMode>("visual");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: suite, isLoading } = useGetTestSuite(suiteId, {
    query: {
      enabled: !!suiteId,
      queryKey: getGetTestSuiteQueryKey(suiteId),
    }
  });

  useEffect(() => {
    if (suite) {
      setJsonText(JSON.stringify((suite.jsonConfig as any)?.test_cases ?? [], null, 2));
    }
  }, [suite]);

  const updateSuite = useUpdateTestSuite();
  const deleteSuite = useDeleteTestSuite();

  const testCases: any[] = (suite?.jsonConfig as any)?.test_cases ?? [];
  const projectId = suite?.projectId ?? "";

  const handleSaveJson = () => {
    setSaveError(null);
    let parsed: any[];
    try {
      parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("Must be an array");
      setJsonError(null);
    } catch {
      setJsonError("Invalid JSON — must be an array");
      return;
    }

    updateSuite.mutate(
      { suiteId, data: { jsonConfig: { test_cases: parsed } as any } },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          queryClient.invalidateQueries({ queryKey: getGetTestSuiteQueryKey(suiteId) });
          setTimeout(() => setSaveSuccess(false), 2000);
        },
        onError: (err: any) => setSaveError(err?.data?.error ?? "Save failed")
      }
    );
  };

  const handleDelete = () => {
    deleteSuite.mutate({ suiteId }, {
      onSuccess: () => {
        if (projectId) setLocation(`/projects/${projectId}`);
        else setLocation("/projects");
      }
    });
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  if (!suite) {
    return (
      <SidebarLayout>
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">Test suite not found</p>
          <Link href="/projects"><Button variant="outline" className="mt-4">Back to Projects</Button></Link>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)] gap-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{suite.name}</h1>
            <p className="text-xs text-muted-foreground">{testCases.length} test cases</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-1">
              <button
                className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${mode === "visual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                onClick={() => { setMode("visual"); setJsonText(JSON.stringify(testCases, null, 2)); }}
              >
                <Eye className="w-3 h-3" /> Visual
              </button>
              <button
                className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${mode === "json" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                onClick={() => { setMode("json"); setJsonText(JSON.stringify(testCases, null, 2)); }}
              >
                <Code className="w-3 h-3" /> JSON
              </button>
            </div>
            {projectId && (
              <Link href={`/runs/new?projectId=${projectId}&suiteId=${suiteId}`}>
                <Button variant="outline" size="sm" className="gap-1">
                  <Play className="w-3.5 h-3.5" /> Run
                </Button>
              </Link>
            )}
            <Button size="sm" className="gap-1" onClick={handleSaveJson} disabled={updateSuite.isPending || saveSuccess}>
              {saveSuccess ? <><CheckCircle2 className="w-4 h-4 text-green-400" />Saved!</> :
               updateSuite.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</> :
               <><Save className="w-4 h-4" />Save</>}
            </Button>
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 p-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
          </div>
        )}

        {/* Content */}
        {mode === "visual" ? (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {testCases.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-sm">No test cases in this suite.</p>
                <p className="text-xs mt-1">Switch to JSON mode to add test cases manually.</p>
              </div>
            ) : testCases.map((tc: any, i: number) => (
              <div key={tc.id ?? i} className="border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedCase(expandedCase === (tc.id ?? i) ? null : (tc.id ?? i))}
                >
                  <span className="text-xs font-mono text-muted-foreground shrink-0 w-16">{tc.id}</span>
                  <span className="flex-1 text-sm font-medium">{tc.title}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 border ${priorityColor(tc.priority ?? "medium")}`}>
                    {tc.priority ?? "medium"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{tc.steps?.length ?? 0} steps</span>
                  {expandedCase === (tc.id ?? i) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expandedCase === (tc.id ?? i) && (
                  <div className="px-4 pb-4 border-t border-border bg-muted/10 pt-3 space-y-3">
                    {tc.description && <p className="text-xs text-muted-foreground">{tc.description}</p>}
                    <div>
                      <p className="text-xs font-medium mb-2">Steps</p>
                      <div className="space-y-1">
                        {(tc.steps ?? []).map((step: any, si: number) => (
                          <div key={si} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-4 text-right">{si + 1}</span>
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">{step.action}</span>
                            {step.target && <span className="text-muted-foreground font-mono truncate max-w-[200px]">{step.target}</span>}
                            {step.value && <span className="text-foreground">= {step.value}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    {tc.expected && Object.keys(tc.expected).some(k => tc.expected[k]) && (
                      <div>
                        <p className="text-xs font-medium mb-1">Expected</p>
                        {tc.expected.urlContains && <p className="text-xs text-muted-foreground">URL contains: <span className="font-mono text-foreground">{tc.expected.urlContains}</span></p>}
                        {tc.expected.pageContains && <p className="text-xs text-muted-foreground">Page contains: <span className="text-foreground">{tc.expected.pageContains}</span></p>}
                        {tc.expected.elementVisible && <p className="text-xs text-muted-foreground">Element: <span className="font-mono text-foreground">{tc.expected.elementVisible}</span></p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 bg-[#0a0f1a] border border-border rounded-xl overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-border bg-card/50 flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">test-cases.json</span>
              {jsonError && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{jsonError}</span>}
            </div>
            <textarea
              className="flex-1 p-4 font-mono text-xs bg-transparent text-slate-300 resize-none outline-none leading-relaxed"
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
              spellCheck={false}
            />
          </div>
        )}

        {/* Danger Zone */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Permanently delete this test suite</p>
          {confirmDelete ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteSuite.isPending}>
                {deleteSuite.isPending ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="text-red-400 border-red-500/30 hover:bg-red-500/10 gap-1" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5" /> Delete Suite
            </Button>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
