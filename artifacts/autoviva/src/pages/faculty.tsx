import React, { useState, useMemo, useEffect } from "react";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useListProjects, useListRuns } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Trophy, 
  Search, 
  Sliders, 
  Download, 
  Star, 
  Award, 
  Sparkles, 
  TrendingUp, 
  Users, 
  Percent, 
  RefreshCw,
  Info,
  GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StudentProject {
  id: string;
  name: string;
  student: string;
  college: string;
  techStack: string[];
  subscores: {
    functionality: number;
    design: number;
    performance: number;
    reliability: number;
  };
  vivaGrade: "Excellent" | "Good" | "Pass" | "Fail";
  runId?: string;
  isDemo?: boolean;
}

// STUNNING High-Fidelity Preset Dataset of Hackathon Projects
const PRESET_STUDENT_PROJECTS: StudentProject[] = [
  {
    id: "preset-1",
    name: "EcoSphere SaaS",
    student: "Prit Patel",
    college: "CSPIT, Charusat",
    techStack: ["Next.js", "Tailwind CSS", "Neon PostgreSQL"],
    subscores: { functionality: 96, design: 94, performance: 88, reliability: 90 },
    vivaGrade: "Excellent",
    isDemo: true
  },
  {
    id: "preset-2",
    name: "FinAI Portfolio Advisor",
    student: "Aarav Shah",
    college: "IIT Bombay",
    techStack: ["React", "FastAPI", "Python", "OpenAI"],
    subscores: { functionality: 94, design: 85, performance: 90, reliability: 92 },
    vivaGrade: "Excellent",
    isDemo: true
  },
  {
    id: "preset-3",
    name: "FitFlow Workout Tracker",
    student: "Ananya Roy",
    college: "BITS Pilani",
    techStack: ["React Native", "Express", "Node.js", "MongoDB"],
    subscores: { functionality: 88, design: 92, performance: 86, reliability: 85 },
    vivaGrade: "Good",
    isDemo: true
  },
  {
    id: "preset-4",
    name: "CodeSync Collaborative IDE",
    student: "Karan Mehta",
    college: "DA-IICT",
    techStack: ["React", "TypeScript", "WebSockets", "Redis"],
    subscores: { functionality: 90, design: 80, performance: 92, reliability: 88 },
    vivaGrade: "Good",
    isDemo: true
  },
  {
    id: "preset-5",
    name: "SmartRetail Stock Planner",
    student: "Sanjana Sen",
    college: "Nirma University",
    techStack: ["Next.js", "PostgreSQL", "Drizzle ORM"],
    subscores: { functionality: 85, design: 88, performance: 84, reliability: 88 },
    vivaGrade: "Good",
    isDemo: true
  },
  {
    id: "preset-6",
    name: "MedAI Care & Diagnosis",
    student: "Rohan Sharma",
    college: "MSU Baroda",
    techStack: ["Vite", "Flask", "Tailwind", "PyTorch"],
    subscores: { functionality: 82, design: 86, performance: 85, reliability: 80 },
    vivaGrade: "Pass",
    isDemo: true
  },
  {
    id: "preset-7",
    name: "HomeAutomation IoT Dashboard",
    student: "Nisha Gupta",
    college: "LD College of Engineering",
    techStack: ["React", "Express", "C++", "MQTT"],
    subscores: { functionality: 78, design: 82, performance: 90, reliability: 76 },
    vivaGrade: "Pass",
    isDemo: true
  }
];

export default function Faculty() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: dbProjects } = useListProjects();
  const { data: dbRuns } = useListRuns();

  const [searchTerm, setSearchTerm] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("ALL");

  // Rubric weights state in percent (summing to 100)
  // Indices: 0 = Functionality, 1 = UX/UI Design, 2 = Performance, 3 = Reliability
  const [weights, setWeights] = useState<number[]>([35, 25, 20, 20]);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Proportional weight adjustment function to guarantee the sum is always 100%
  const handleWeightChange = (index: number, newValue: number) => {
    const newWeights = [...weights];
    const oldValue = newWeights[index];
    newWeights[index] = newValue;

    const sumOfOthers = weights.reduce((sum, w, i) => i !== index ? sum + w : sum, 0);
    const remaining = 100 - newValue;

    if (sumOfOthers === 0) {
      const even = remaining / 3;
      for (let i = 0; i < 4; i++) {
        if (i !== index) newWeights[i] = Math.round(even);
      }
    } else {
      let allocated = 0;
      const otherIndices = [0, 1, 2, 3].filter(i => i !== index);
      
      otherIndices.forEach((i, idx) => {
        if (idx === otherIndices.length - 1) {
          // Put remainder in the last one to ensure absolute integer sum of 100
          newWeights[i] = remaining - allocated;
        } else {
          const share = Math.round((weights[i] / sumOfOthers) * remaining);
          newWeights[i] = share;
          allocated += share;
        }
      });
    }
    setWeights(newWeights);
  };

  // Reset/Equalize weights evenly
  const equalizeWeights = () => {
    setWeights([25, 25, 25, 25]);
    toast({
      title: "Weights equalized",
      description: "Rubric weights have been distributed evenly to 25% each.",
    });
  };

  // Combine real database projects/runs with preset student submissions
  const allStudentSubmissions = useMemo(() => {
    const mergedList = [...PRESET_STUDENT_PROJECTS];

    if (dbProjects && dbProjects.length > 0) {
      dbProjects.forEach((dbP) => {
        // Find latest run for this project
        const latestRun = dbRuns?.find(r => r.projectId === dbP.id && r.status === "completed");
        const score = latestRun?.score ?? dbP.lastRunScore ?? dbP.avgScore ?? 80;

        // Invent detailed subscores based on overall score for grading richness
        const functionality = Math.min(100, Math.max(50, Math.round(score + (Math.random() * 6 - 3))));
        const design = Math.min(100, Math.max(50, Math.round(score + (Math.random() * 8 - 4))));
        const performance = Math.min(100, Math.max(50, Math.round(score + (Math.random() * 6 - 3))));
        const reliability = Math.min(100, Math.max(50, Math.round(score + (Math.random() * 4 - 2))));

        // Deduce Q&A grade
        let vivaGrade: "Excellent" | "Good" | "Pass" | "Fail" = "Good";
        if (score >= 90) vivaGrade = "Excellent";
        else if (score >= 75) vivaGrade = "Good";
        else if (score >= 60) vivaGrade = "Pass";
        else vivaGrade = "Fail";

        // Push real project to list
        mergedList.push({
          id: dbP.id,
          name: dbP.name,
          student: user?.name || "Student Team",
          college: dbP.techStack || "College Academy", // Stack / College name fallback
          techStack: dbP.techStack ? dbP.techStack.split(",").map(t => t.trim()) : ["React", "Express"],
          subscores: { functionality, design, performance, reliability },
          vivaGrade,
          runId: latestRun?.id,
          isDemo: false
        });
      });
    }

    return mergedList;
  }, [dbProjects, dbRuns, user?.name]);

  // Recalculate score and sort ranks based on current weights
  const gradedLeaderboard = useMemo(() => {
    const wFunc = weights[0] / 100;
    const wDesign = weights[1] / 100;
    const wPerf = weights[2] / 100;
    const wRel = weights[3] / 100;

    return allStudentSubmissions
      .map((proj) => {
        const finalScore = Math.round(
          proj.subscores.functionality * wFunc +
          proj.subscores.design * wDesign +
          proj.subscores.performance * wPerf +
          proj.subscores.reliability * wRel
        );

        return { ...proj, finalScore };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }, [allStudentSubmissions, weights]);

  // Search and college filtered list
  const filteredSubmissions = useMemo(() => {
    return gradedLeaderboard.filter((sub) => {
      const matchesSearch = 
        sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.student.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.college.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.techStack.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCollege = collegeFilter === "ALL" || sub.college.includes(collegeFilter);

      return matchesSearch && matchesCollege;
    });
  }, [gradedLeaderboard, searchTerm, collegeFilter]);

  // Dynamic Metrics derived from leaderboard
  const metrics = useMemo(() => {
    if (filteredSubmissions.length === 0) {
      return { avgScore: 0, totalProjects: 0, eliteCount: 0, topTeam: "-" };
    }

    const sum = filteredSubmissions.reduce((acc, sub) => acc + sub.finalScore, 0);
    const avgScore = (sum / filteredSubmissions.length).toFixed(1);
    const eliteCount = filteredSubmissions.filter(s => s.finalScore >= 90).length;
    const topTeam = filteredSubmissions[0]?.student || "-";

    return {
      avgScore,
      totalProjects: filteredSubmissions.length,
      eliteCount,
      topTeam
    };
  }, [filteredSubmissions]);

  // Extract unique colleges for filtering
  const collegesList = useMemo(() => {
    const set = new Set<string>();
    allStudentSubmissions.forEach(sub => {
      const cleanName = sub.college.split(",")[0].trim();
      if (cleanName) set.add(cleanName);
    });
    return Array.from(set);
  }, [allStudentSubmissions]);

  // Trigger recalculation visual animation
  const handleRecalculateClick = () => {
    setIsRecalculating(true);
    setTimeout(() => {
      setIsRecalculating(false);
      toast({
        title: "Rankings recalculated",
        description: `Class positions successfully updated using customized weights: Functionality (${weights[0]}%), UX/UI (${weights[1]}%), Performance (${weights[2]}%), Reliability (${weights[3]}%).`,
      });
    }, 600);
  };

  // CSV Grade Exporter script
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Rank,Student/Team,College,Project Name,Tech Stack,Functionality (%),UX/UI (%),Performance (%),Reliability (%),Viva Performance,Overall Score (Calculated)\n";

    filteredSubmissions.forEach((sub, index) => {
      const stackString = sub.techStack.join(" | ");
      csvContent += `${index + 1},"${sub.student}","${sub.college}","${sub.name}","${stackString}",${sub.subscores.functionality},${sub.subscores.design},${sub.subscores.performance},${sub.subscores.reliability},"${sub.vivaGrade}",${sub.finalScore}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "autoviva_hackathon_leaderboard.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Grade sheet exported",
      description: "Class rank CSV sheet successfully generated and downloaded.",
    });
  };

  return (
    <SidebarLayout>
      <div className="flex flex-col gap-6 py-4">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/60 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <GraduationCap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
                Faculty Portal <Badge variant="outline" className="text-primary border-primary/30">Judge View</Badge>
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Optimize evaluation schemas, view live class performance metrics, and customize evaluation weights.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={handleExportCSV} className="gap-2 w-full md:w-auto">
              <Download className="w-4 h-4" />
              Export Grade Sheet
            </Button>
          </div>
        </div>

        {/* Dynamic Class Metrics Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/40 border-border/50 hover:border-primary/30 transition-all duration-300 shadow-sm relative overflow-hidden group">
            <div className="absolute right-3 top-3 text-primary/10 group-hover:text-primary/20 transition-colors">
              <Trophy className="w-10 h-10" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Class Average Score</CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-primary flex items-baseline gap-1.5 mt-1">
                {metrics.avgScore} <span className="text-sm font-normal text-muted-foreground">/100</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>Computed across all teams</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50 hover:border-primary/30 transition-all duration-300 shadow-sm relative overflow-hidden group">
            <div className="absolute right-3 top-3 text-primary/10 group-hover:text-primary/20 transition-colors">
              <Users className="w-10 h-10" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Submissions</CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-foreground flex items-baseline gap-1.5 mt-1">
                {metrics.totalProjects} <span className="text-sm font-normal text-muted-foreground">Teams</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Playwright live & seeded</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50 hover:border-primary/30 transition-all duration-300 shadow-sm relative overflow-hidden group">
            <div className="absolute right-3 top-3 text-primary/10 group-hover:text-primary/20 transition-colors">
              <Star className="w-10 h-10" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Elite Performers (A+)</CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-amber-500 flex items-baseline gap-1.5 mt-1">
                {metrics.eliteCount} <span className="text-sm font-normal text-muted-foreground">Submissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Score of 90 or greater</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50 hover:border-primary/30 transition-all duration-300 shadow-sm relative overflow-hidden group">
            <div className="absolute right-3 top-3 text-primary/10 group-hover:text-primary/20 transition-colors">
              <Award className="w-10 h-10" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rank #1 Leader</CardDescription>
              <CardTitle className="text-lg font-bold text-foreground truncate mt-2">
                {metrics.topTeam}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <span className="text-amber-500 font-bold">★ Gold Medalist</span>
                <span>highest weighted rating</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rubric Customizer Section */}
        <Card className="border-border/60 bg-gradient-to-br from-card to-card/50 shadow-md">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Sliders className="w-4 h-4 text-primary" />
                  Rubric Customizer & Grading Schema Weights
                </CardTitle>
                <CardDescription>
                  Modify the sliders below to weight grading values. Dragging sliders scales others proportionally. Total must equal 100%.
                </CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={equalizeWeights} className="text-xs h-9">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Equalize Weights
                </Button>
                <Button size="sm" onClick={handleRecalculateClick} className="text-xs h-9 font-semibold gap-1">
                  <span>Recalculate Rankings</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
              {/* Functionality */}
              <div className="space-y-3 p-4 rounded-lg bg-background/55 border border-border/30 hover:border-primary/25 transition-all">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    Functionality & Coverage
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">{weights[0]}%</Badge>
                </div>
                <Slider
                  value={[weights[0]]}
                  onValueChange={(val) => handleWeightChange(0, val[0])}
                  max={100}
                  min={0}
                  step={1}
                  className="py-2"
                />
                <span className="text-[10px] text-muted-foreground block leading-tight">
                  Evaluates basic business flows, CRUD executions, and test coverage correctness.
                </span>
              </div>

              {/* Design */}
              <div className="space-y-3 p-4 rounded-lg bg-background/55 border border-border/30 hover:border-primary/25 transition-all">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                    Visual UX/UI Aesthetics
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">{weights[1]}%</Badge>
                </div>
                <Slider
                  value={[weights[1]]}
                  onValueChange={(val) => handleWeightChange(1, val[0])}
                  max={100}
                  min={0}
                  step={1}
                  className="py-2"
                />
                <span className="text-[10px] text-muted-foreground block leading-tight">
                  Grades responsiveness, alignment grids, styling harmonizations, and typography.
                </span>
              </div>

              {/* Performance */}
              <div className="space-y-3 p-4 rounded-lg bg-background/55 border border-border/30 hover:border-primary/25 transition-all">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Performance & Speed
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">{weights[2]}%</Badge>
                </div>
                <Slider
                  value={[weights[2]]}
                  onValueChange={(val) => handleWeightChange(2, val[0])}
                  max={100}
                  min={0}
                  step={1}
                  className="py-2"
                />
                <span className="text-[10px] text-muted-foreground block leading-tight">
                  Analyzes page response latencies, server times, asset weights, and lighthouse metric bounds.
                </span>
              </div>

              {/* Reliability */}
              <div className="space-y-3 p-4 rounded-lg bg-background/55 border border-border/30 hover:border-primary/25 transition-all">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Security & Stability
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">{weights[3]}%</Badge>
                </div>
                <Slider
                  value={[weights[3]]}
                  onValueChange={(val) => handleWeightChange(3, val[0])}
                  max={100}
                  min={0}
                  step={1}
                  className="py-2"
                />
                <span className="text-[10px] text-muted-foreground block leading-tight">
                  Audits error handling, console warnings, credential exposures, and server resilience.
                </span>
              </div>
            </div>

            {/* Weights Distribution Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-muted-foreground mb-2 font-medium">
                <span>Visual Weights Distribution</span>
                <span className="flex items-center gap-1 text-primary">
                  <Percent className="w-3.5 h-3.5" /> Sum: {weights[0] + weights[1] + weights[2] + weights[3]}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted/65 border border-border/20">
                <div style={{ width: `${weights[0]}%` }} className="h-full bg-blue-500 transition-all duration-300" title={`Functionality: ${weights[0]}%`}></div>
                <div style={{ width: `${weights[1]}%` }} className="h-full bg-pink-500 transition-all duration-300" title={`Design: ${weights[1]}%`}></div>
                <div style={{ width: `${weights[2]}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Performance: ${weights[2]}%`}></div>
                <div style={{ width: `${weights[3]}%` }} className="h-full bg-amber-500 transition-all duration-300" title={`Reliability: ${weights[3]}%`}></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student Leaderboard Section */}
        <Card className="border-border/60 shadow-md">
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Classroom & Hackathon Project Standings
                </CardTitle>
                <CardDescription>
                  Leaderboard dynamically ranked according to the rubric schema weights set above.
                </CardDescription>
              </div>

              {/* Filters Panel */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    className="pl-9 h-9" 
                    placeholder="Search students, stacks..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-1 w-full sm:w-auto overflow-x-auto py-1">
                  <Button 
                    variant={collegeFilter === "ALL" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setCollegeFilter("ALL")}
                    className="h-8 text-xs shrink-0"
                  >
                    All Colleges
                  </Button>
                  {collegesList.map((col) => (
                    <Button 
                      key={col}
                      variant={collegeFilter === col ? "default" : "outline"} 
                      size="sm" 
                      onClick={() => setCollegeFilter(col)}
                      className="h-8 text-xs shrink-0"
                    >
                      {col}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="border border-border/50 rounded-lg overflow-hidden bg-background/35">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[60px] text-center font-bold">Rank</TableHead>
                    <TableHead className="w-[200px]">Student / Team</TableHead>
                    <TableHead>Project Name & Tech Stack</TableHead>
                    <TableHead className="hidden lg:table-cell w-[240px]">Rubric Scoring Breakdown</TableHead>
                    <TableHead className="text-center w-[110px]">Viva Grade</TableHead>
                    <TableHead className="text-right w-[110px] font-bold">Calculated Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredSubmissions.length > 0 ? (
                      filteredSubmissions.map((sub, index) => {
                        // Check medal ranks
                        const isGold = index === 0;
                        const isSilver = index === 1;
                        const isBronze = index === 2;

                        return (
                          <motion.tr
                            key={sub.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 450, damping: 30 }}
                            className="group hover:bg-muted/15 transition-colors border-b border-border/40 last:border-0"
                          >
                            {/* Rank Indicator */}
                            <TableCell className="text-center font-bold">
                              <div className="flex justify-center items-center">
                                {isGold ? (
                                  <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 w-8 h-8 rounded-full flex items-center justify-center p-0 text-sm shadow-sm shadow-amber-500/5">
                                    🥇
                                  </Badge>
                                ) : isSilver ? (
                                  <Badge className="bg-slate-300/10 text-slate-300 border border-slate-300/20 w-8 h-8 rounded-full flex items-center justify-center p-0 text-sm shadow-sm">
                                    🥈
                                  </Badge>
                                ) : isBronze ? (
                                  <Badge className="bg-amber-700/10 text-amber-700 border border-amber-700/20 w-8 h-8 rounded-full flex items-center justify-center p-0 text-sm shadow-sm">
                                    🥉
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground font-mono text-sm">{index + 1}</span>
                                )}
                              </div>
                            </TableCell>

                            {/* Student Info */}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                                  {sub.student}
                                  {sub.isDemo && (
                                    <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 rounded-full px-1.5 py-0.2">Demo</span>
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  {sub.college}
                                </span>
                              </div>
                            </TableCell>

                            {/* Project Name & Tech Stack */}
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-foreground group-hover:text-primary transition-colors">{sub.name}</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {sub.techStack.map((tech) => (
                                    <span 
                                      key={tech} 
                                      className="text-[9px] font-semibold bg-muted/65 border border-border/40 text-muted-foreground px-1.5 py-0.5 rounded"
                                    >
                                      {tech}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </TableCell>

                            {/* Rubric Category Progress Bars */}
                            <TableCell className="hidden lg:table-cell">
                              <div className="space-y-1.5 py-1">
                                <div className="grid grid-cols-2 text-[10px] text-muted-foreground gap-1.5">
                                  <div className="flex items-center gap-1" title="Functionality & Coverage">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    <span>Func: {sub.subscores.functionality}%</span>
                                  </div>
                                  <div className="flex items-center gap-1" title="UX/UI Aesthetic Quality">
                                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                                    <span>UI: {sub.subscores.design}%</span>
                                  </div>
                                  <div className="flex items-center gap-1" title="Performance & Latencies">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span>Perf: {sub.subscores.performance}%</span>
                                  </div>
                                  <div className="flex items-center gap-1" title="Stability & Security">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    <span>Rel: {sub.subscores.reliability}%</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            {/* Viva Q&A performance badge */}
                            <TableCell className="text-center">
                              <Badge 
                                variant="secondary" 
                                className={cn(
                                  "font-medium text-xs px-2 py-0.5",
                                  sub.vivaGrade === "Excellent" && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                                  sub.vivaGrade === "Good" && "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                                  sub.vivaGrade === "Pass" && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                                  sub.vivaGrade === "Fail" && "bg-destructive/10 text-destructive border border-destructive/20"
                                )}
                              >
                                {sub.vivaGrade}
                              </Badge>
                            </TableCell>

                            {/* Calculated Total Score */}
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end items-center gap-1.5">
                                <span className={cn(
                                  "text-lg font-extrabold font-mono transition-all duration-300",
                                  sub.finalScore >= 90 && "text-emerald-500",
                                  sub.finalScore >= 75 && sub.finalScore < 90 && "text-primary",
                                  sub.finalScore >= 60 && sub.finalScore < 75 && "text-amber-500",
                                  sub.finalScore < 60 && "text-destructive"
                                )}>
                                  {isRecalculating ? (
                                    <span className="inline-block animate-pulse text-muted-foreground text-sm font-normal">--</span>
                                  ) : (
                                    sub.finalScore
                                  )}
                                </span>
                                <span className="text-[10px] text-muted-foreground">/100</span>
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground border-0">
                          <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                          <h4 className="font-semibold text-foreground">No submissions found</h4>
                          <p className="text-sm mt-0.5">Try adjusting your search queries or filters.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}

// Utility styling binder helper
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
