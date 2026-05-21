import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams, Link } from "wouter";
import { useGetRun, getGetRunQueryKey, useGetReport, getGetReportQueryKey, useAskVivaAgent } from "@workspace/api-client-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, FileText, Bot, User, Loader2, ChevronRight, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

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

  const [isRecording, setIsRecording] = useState(false);
  const [enableTts, setEnableTts] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  const playBase64Audio = (base64Audio: string) => {
    try {
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      audio.play().catch(err => console.error("Audio playback error:", err));
    } catch (err) {
      console.error("Audio play creation failed:", err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = (reader.result as string).split(",")[1];
          sendVoiceMessage(base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic start failed:", err);
      alert("Microphone access is required for Voice Q&A.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const sendVoiceMessage = (base64Audio: string) => {
    if (askViva.isPending) return;

    const tempUserMsg: Message = {
      id: `msg-${Date.now()}-temp`,
      role: "user",
      content: "🎤 [Recording voice answer...]",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    askViva.mutate(
      {
        runId,
        data: {
          question: "Voice Question",
          audio: base64Audio,
          enableTts,
        } as any,
      },
      {
        onSuccess: (data: any) => {
          setMessages(prev => {
            const list = prev.filter(m => m.id !== tempUserMsg.id);
            const userMsg: Message = {
              id: `msg-${Date.now()}`,
              role: "user",
              content: data.question || "🎤 [Voice input]",
              timestamp: new Date(),
            };
            const assistantMsg: Message = {
              id: `msg-${Date.now()}-ai`,
              role: "assistant",
              content: data.answer || "No response received.",
              timestamp: new Date(),
            };
            return [...list, userMsg, assistantMsg];
          });

          if (data.audioResponse) {
            playBase64Audio(data.audioResponse);
          }
        },
        onError: () => {
          setMessages(prev => {
            const list = prev.filter(m => m.id !== tempUserMsg.id);
            return [...list, {
              id: `msg-${Date.now()}-err`,
              role: "assistant",
              content: "I failed to transcribe or process your voice message. Please try text input instead.",
              timestamp: new Date(),
            }];
          });
        }
      }
    );
  };

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
      {
        runId,
        data: {
          question: text,
          enableTts,
        } as any,
      },
      {
        onSuccess: (data: any) => {
          const assistantMsg: Message = {
            id: `msg-${Date.now()}-ai`,
            role: "assistant",
            content: data.answer ?? "I couldn't process that question. Please try again.",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, assistantMsg]);

          if (data.audioResponse) {
            playBase64Audio(data.audioResponse);
          }
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
            <Button
              variant={isRecording ? "destructive" : "outline"}
              onClick={toggleRecording}
              className={`shrink-0 ${isRecording ? "animate-pulse" : ""}`}
              disabled={askViva.isPending}
              title={isRecording ? "Stop Recording" : "Record Answer"}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? "Recording voice... Click Mic to finish & send." : "Ask about test results, bugs, how to improve..."}
              className="flex-1"
              disabled={askViva.isPending || isRecording}
            />

            <Button
              variant="outline"
              onClick={() => setEnableTts(!enableTts)}
              className="shrink-0"
              title={enableTts ? "Mute AI Voice Response" : "Unmute AI Voice Response"}
            >
              {enableTts ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            </Button>

            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || askViva.isPending || isRecording}
              className="gap-1 bg-gradient-to-r from-primary to-cyan-600 hover:opacity-90"
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
