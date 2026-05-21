import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams, Link } from "wouter";
import { useGetRun, getGetRunQueryKey, useGetReport, getGetReportQueryKey, useAskVivaAgent } from "@workspace/api-client-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, FileText, Bot, User, Loader2, ChevronRight } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const SUGGESTED_QUESTIONS = [
  "Why did the login test case fail?",
  "Which features were fully tested?",
  "What are the most critical bugs?",
  "How can I improve my score?",
  "Explain the CRUD test results",
  "What was the most complex test?",
];

function scoreColor(score: number | null | undefined) {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

export default function RunViva() {
  const params = useParams();
  const runId = params.runId || "";
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello. I'm the AutoViva AI examiner. I've analyzed your project evaluation in detail. Ask me anything about the test results, what failed, how to improve your score, or any specific feature behavior I observed.",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: run } = useGetRun(runId, {
    query: { enabled: !!runId, queryKey: getGetRunQueryKey(runId) }
  });
  const { data: report } = useGetReport(runId, {
    query: { enabled: !!runId, queryKey: getGetReportQueryKey(runId) }
  });
  const askViva = useAskVivaAgent();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim() || askViva.isPending) return;
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    askViva.mutate(
      { runId, data: { question: text } },
      {
        onSuccess: (data) => {
          const assistantMsg: Message = {
            id: `msg-${Date.now()}-ai`,
            role: "assistant",
            content: data.answer ?? "I couldn't process that question. Please try again.",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMsg]);
        },
        onError: () => {
          setMessages(prev => [...prev, {
            id: `msg-${Date.now()}-err`,
            role: "assistant",
            content: "I encountered an error processing your question. Please try again.",
            timestamp: new Date(),
          }]);
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <SidebarLayout>
      <div className="flex gap-6 h-[calc(100vh-6rem)]">
        {/* Main Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Viva Mode</h1>
              <p className="text-sm text-muted-foreground">
                Examining: <span className="text-foreground">{run?.projectName ?? "Project"}</span>
                {run?.score != null && (
                  <> &mdash; Score: <span className={`font-bold ${scoreColor(run.score)}`}>{run.score}/100</span> ({run.grade})</>
                )}
              </p>
            </div>
            <Link href={`/runs/${runId}/report`}>
              <Button variant="outline" size="sm" className="gap-1">
                <FileText className="w-4 h-4" />
                Full Report
              </Button>
            </Link>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "assistant" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {msg.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${
                    msg.role === "assistant"
                      ? "bg-card border border-border text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
            {askViva.isPending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/20 text-primary shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-card border border-border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {messages.length <= 2 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
                <button
                  key={q}
                  className="text-xs px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-full text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  onClick={() => sendMessage(q)}
                >
                  <ChevronRight className="w-3 h-3" />
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about test results, bugs, how to improve..."
              className="flex-1"
              disabled={askViva.isPending}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || askViva.isPending}
              className="gap-1"
            >
              <Send className="w-4 h-4" />
              Send
            </Button>
          </div>
        </div>

        {/* Right Sidebar: Context */}
        <div className="w-60 shrink-0 flex flex-col gap-4">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Evaluation Context</h3>
            <div className="space-y-2">
              <div className="p-3 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Score</span>
                  <span className={`font-bold ${scoreColor(run?.score)}`}>{run?.score ?? "?"}/100</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Grade</span>
                  <span className="font-bold">{run?.grade ?? "?"}</span>
                </div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Passed</span>
                  <span className="text-green-400 font-bold">{run?.passed ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Failed</span>
                  <span className="text-red-400 font-bold">{run?.failed ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Suggested Questions</h3>
            <div className="space-y-1">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="w-full text-left text-xs px-3 py-2 bg-card hover:bg-muted/50 border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {report?.aiNotes && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">AI Examiner Notes</h3>
              <p className="text-xs text-muted-foreground leading-relaxed bg-card border border-border rounded-lg p-3">
                {report.aiNotes as string}
              </p>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}
