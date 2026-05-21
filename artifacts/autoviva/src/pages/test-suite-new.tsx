import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { useCreateTestSuite, useGenerateTestCases } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Code, Eye, Plus, Trash2, ChevronUp, ChevronDown, Save, AlertCircle, CheckCircle2 } from "lucide-react";

type TestCase = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  role?: string | null;
  description?: string;
  steps: { action: string; target?: string | null; value?: string | null }[];
  expected: { urlContains?: string | null; pageContains?: string | null; elementVisible?: string | null };
};

type EditorMode = "visual" | "json";

function priorityColor(p: string) {
  if (p === "high") return "bg-red-500/10 text-red-400 border-red-500/20";
  if (p === "medium") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  return "bg-blue-500/10 text-blue-400 border-blue-500/20";
}

export default function TestSuiteNew() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const projectId = params.projectId || "";

  const [suiteName, setSuiteName] = useState("New Test Suite");
  const [suiteDescription, setSuiteDescription] = useState("");
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [mode, setMode] = useState<EditorMode>("visual");
  const [jsonText, setJsonText] = useState("[]");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [aiDescription, setAiDescription] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const createSuite = useCreateTestSuite();
  const generateCases = useGenerateTestCases();

  const addTestCase = () => {
    const newCase: TestCase = {
      id: `TC_${String(testCases.length + 1).padStart(3, "0")}`,
      title: "New Test Case",
      priority: "medium",
      role: null,
      description: "",
      steps: [{ action: "navigate", target: "http://localhost:3000", value: null }],
      expected: {},
    };
    setTestCases(prev => [...prev, newCase]);
    setSelectedIndex(testCases.length);
  };

  const removeTestCase = (index: number) => {
    setTestCases(prev => prev.filter((_, i) => i !== index));
    setSelectedIndex(null);
  };

  const moveCase = (index: number, dir: -1 | 1) => {
    const newArr = [...testCases];
    const target = index + dir;
    if (target < 0 || target >= newArr.length) return;
    [newArr[index], newArr[target]] = [newArr[target], newArr[index]];
    setTestCases(newArr);
    setSelectedIndex(target);
  };

  const updateCase = (index: number, updates: Partial<TestCase>) => {
    setTestCases(prev => prev.map((tc, i) => i === index ? { ...tc, ...updates } : tc));
  };

  const syncJsonToVisual = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setTestCases(Array.isArray(parsed) ? parsed : []);
      setJsonError(null);
    } catch (e) {
      setJsonError("Invalid JSON format");
    }
  };

  const handleModeSwitch = (newMode: EditorMode) => {
    if (newMode === "json") {
      setJsonText(JSON.stringify(testCases, null, 2));
    } else {
      syncJsonToVisual();
    }
    setMode(newMode);
  };

  const handleGenerateAI = () => {
    if (!aiDescription.trim()) return;
    generateCases.mutate(
      { data: { projectDescription: aiDescription, projectId } },
      {
        onSuccess: (data) => {
          const cases = (data.testCases as any[]) ?? [];
          setTestCases(prev => [...prev, ...cases]);
          setAiDescription("");
          setShowAiPanel(false);
          if (mode === "json") setJsonText(JSON.stringify([...testCases, ...cases], null, 2));
        }
      }
    );
  };

  const handleSave = () => {
    if (!suiteName.trim()) { setSaveError("Suite name is required"); return; }
    setSaveError(null);

    let finalCases = testCases;
    if (mode === "json") {
      try {
        finalCases = JSON.parse(jsonText);
      } catch {
        setSaveError("Invalid JSON — fix errors before saving");
        return;
      }
    }

    createSuite.mutate(
      {
        projectId,
        data: {
          name: suiteName,
          description: suiteDescription || undefined,
          jsonConfig: { test_cases: finalCases } as any,
        }
      },
      {
        onSuccess: (suite) => {
          setSaveSuccess(true);
          setTimeout(() => setLocation(`/projects/${projectId}`), 1500);
        },
        onError: (err: any) => setSaveError(err?.data?.error ?? "Failed to save suite")
      }
    );
  };

  const selected = selectedIndex !== null ? testCases[selectedIndex] : null;

  return (
    <SidebarLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)] gap-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <Input
            value={suiteName}
            onChange={(e) => setSuiteName(e.target.value)}
            className="text-lg font-bold w-64 h-9"
            placeholder="Suite name..."
          />
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-1">
              <button
                className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${mode === "visual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                onClick={() => handleModeSwitch("visual")}
              >
                <Eye className="w-3 h-3" /> Visual
              </button>
              <button
                className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${mode === "json" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                onClick={() => handleModeSwitch("json")}
              >
                <Code className="w-3 h-3" /> JSON
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setShowAiPanel(!showAiPanel)}
            >
              <Sparkles className="w-4 h-4 text-primary" />
              Generate with AI
            </Button>
            <Button size="sm" className="gap-1" onClick={handleSave} disabled={createSuite.isPending || saveSuccess}>
              {saveSuccess ? (
                <><CheckCircle2 className="w-4 h-4 text-green-400" /> Saved!</>
              ) : createSuite.isPending ? (
                <><div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />Saving...</>
              ) : (
                <><Save className="w-4 h-4" />Save Suite</>
              )}
            </Button>
          </div>
        </div>

        {/* AI Panel */}
        {showAiPanel && (
          <div className="mb-4 p-4 bg-card border border-primary/30 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Generate Test Cases with AI</h3>
            </div>
            <Textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="Describe your project features... e.g., 'E-commerce app with user auth, product CRUD, cart management, and admin dashboard'"
              className="min-h-[80px] text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAiPanel(false)}>Cancel</Button>
              <Button size="sm" onClick={handleGenerateAI} disabled={!aiDescription.trim() || generateCases.isPending} className="gap-1">
                {generateCases.isPending ? (
                  <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="w-3 h-3" />Generate</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Error */}
        {saveError && (
          <div className="flex items-center gap-2 p-3 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* Main Two-Panel */}
        {mode === "visual" ? (
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Left: Test Case List */}
            <div className="w-72 shrink-0 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Test Cases ({testCases.length})
                </span>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addTestCase}>
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {testCases.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-xs text-muted-foreground mb-3">No test cases yet</p>
                    <Button variant="outline" size="sm" className="text-xs" onClick={addTestCase}>Add First Test</Button>
                  </div>
                ) : testCases.map((tc, i) => (
                  <button
                    key={tc.id}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                      selectedIndex === i ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/30"
                    }`}
                    onClick={() => setSelectedIndex(i)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{tc.id}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 border ${priorityColor(tc.priority)}`}>{tc.priority}</Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{tc.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{tc.steps.length} steps</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Test Case Editor */}
            <div className="flex-1 overflow-y-auto pr-1">
              {selected === null ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a test case to edit</p>
                    <p className="text-xs mt-1">or click "Add" to create one</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Controls */}
                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveCase(selectedIndex!, -1)}>
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveCase(selectedIndex!, 1)}>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => removeCase(selectedIndex!)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">ID</label>
                          <Input value={selected.id} onChange={e => updateCase(selectedIndex!, { id: e.target.value })} className="h-8 text-xs font-mono" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Priority</label>
                          <select
                            value={selected.priority}
                            onChange={e => updateCase(selectedIndex!, { priority: e.target.value as any })}
                            className="w-full h-8 text-xs bg-background border border-input rounded-md px-2"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Title</label>
                        <Input value={selected.title} onChange={e => updateCase(selectedIndex!, { title: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Description</label>
                        <Textarea value={selected.description ?? ""} onChange={e => updateCase(selectedIndex!, { description: e.target.value })} className="text-xs min-h-[60px]" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">Steps ({selected.steps.length})</CardTitle>
                      <Button
                        variant="ghost" size="sm" className="h-6 text-xs gap-1"
                        onClick={() => updateCase(selectedIndex!, { steps: [...selected.steps, { action: "click", target: null, value: null }] })}
                      >
                        <Plus className="w-3 h-3" /> Add Step
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selected.steps.map((step, si) => (
                        <div key={si} className="flex gap-2 items-center">
                          <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{si + 1}</span>
                          <select
                            value={step.action}
                            onChange={e => {
                              const steps = [...selected.steps];
                              steps[si] = { ...steps[si], action: e.target.value };
                              updateCase(selectedIndex!, { steps });
                            }}
                            className="h-7 text-xs bg-background border border-input rounded px-2 w-28 shrink-0"
                          >
                            {["navigate", "click", "fill", "wait", "screenshot", "assert_text", "assert_url", "assert_element", "scroll", "autofill"].map(a => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                          <Input
                            value={step.target ?? ""}
                            onChange={e => {
                              const steps = [...selected.steps];
                              steps[si] = { ...steps[si], target: e.target.value || null };
                              updateCase(selectedIndex!, { steps });
                            }}
                            placeholder="target / selector"
                            className="h-7 text-xs flex-1"
                          />
                          <Input
                            value={step.value ?? ""}
                            onChange={e => {
                              const steps = [...selected.steps];
                              steps[si] = { ...steps[si], value: e.target.value || null };
                              updateCase(selectedIndex!, { steps });
                            }}
                            placeholder="value"
                            className="h-7 text-xs w-28"
                          />
                          <Button
                            variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                            onClick={() => {
                              const steps = selected.steps.filter((_, i) => i !== si);
                              updateCase(selectedIndex!, { steps });
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Expected Result</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">URL Contains</label>
                        <Input value={selected.expected.urlContains ?? ""} onChange={e => updateCase(selectedIndex!, { expected: { ...selected.expected, urlContains: e.target.value || null } })} className="h-8 text-xs font-mono" placeholder="/dashboard" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Page Contains Text</label>
                        <Input value={selected.expected.pageContains ?? ""} onChange={e => updateCase(selectedIndex!, { expected: { ...selected.expected, pageContains: e.target.value || null } })} className="h-8 text-xs" placeholder="Welcome" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Element Visible</label>
                        <Input value={selected.expected.elementVisible ?? ""} onChange={e => updateCase(selectedIndex!, { expected: { ...selected.expected, elementVisible: e.target.value || null } })} className="h-8 text-xs font-mono" placeholder=".success-message" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 bg-[#0a0f1a] border border-border rounded-xl overflow-hidden flex flex-col min-h-0">
              <div className="px-4 py-2 border-b border-border bg-card/50 flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">test-suite.json</span>
                {jsonError && <span className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{jsonError}</span>}
              </div>
              <textarea
                className="flex-1 p-4 font-mono text-xs bg-transparent text-slate-300 resize-none outline-none leading-relaxed"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );

  function removeCase(index: number) {
    setTestCases(prev => prev.filter((_, i) => i !== index));
    setSelectedIndex(null);
  }
}
