import React, { useState, useMemo } from "react";
import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useListRuns, useListProjects } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  PlayCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ChevronRight, 
  Award, 
  FileText, 
  AlertCircle,
  Clock
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Runs() {
  const { data: runs, isLoading: runsLoading } = useListRuns();
  const { data: projects } = useListProjects();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");

  // Calculate high-fidelity stats based on all runs
  const stats = useMemo(() => {
    if (!runs || runs.length === 0) {
      return { total: 0, completed: 0, active: 0, avgScore: 0 };
    }

    const total = runs.length;
    const completed = runs.filter(r => r.status === "completed").length;
    const active = runs.filter(r => r.status === "running" || r.status === "pending").length;
    
    const scoredRuns = runs.filter(r => r.score != null);
    const avgScore = scoredRuns.length > 0 
      ? Math.round(scoredRuns.reduce((sum, r) => sum + (r.score || 0), 0) / scoredRuns.length)
      : 0;

    return { total, completed, active, avgScore };
  }, [runs]);

  // Combine run data with project metadata for beautiful UI listing
  const augmentedRuns = useMemo(() => {
    if (!runs) return [];

    return runs.map((run) => {
      const project = projects?.find((p) => p.id === run.projectId);
      return {
        ...run,
        projectName: project ? project.name : "Unknown Project",
      };
    });
  }, [runs, projects]);

  // Filtered runs calculation
  const filteredRuns = useMemo(() => {
    return augmentedRuns.filter((run) => {
      const matchesSearch = 
        run.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        run.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (run.mode || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "ALL" || run.status === statusFilter;
      const matchesProject = projectFilter === "ALL" || run.projectId === projectFilter;

      return matchesSearch && matchesStatus && matchesProject;
    });
  }, [augmentedRuns, searchTerm, statusFilter, projectFilter]);

  const getScoreColor = (score: number | null | undefined) => {
    if (score == null) return "text-muted-foreground";
    if (score >= 75) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Running
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <SidebarLayout>
      <div className="flex flex-col gap-6 py-4">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              Evaluations & Reports
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Browse history, view dynamic runs, and review comprehensive AI-synthesized agent diagnostics.
            </p>
          </div>
          <Link href="/runs/new">
            <Button className="gap-2">
              <PlayCircle className="w-4 h-4" />
              New Evaluation
            </Button>
          </Link>
        </div>

        {/* Overview Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/40 border-border/50 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Total Evaluations</CardDescription>
              <CardTitle className="text-2xl font-bold font-mono mt-1">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">Historical test executions</span>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Completed Reports</CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-emerald-500 mt-1">{stats.completed}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">Successfully diagnosed suites</span>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Active Evaluators</CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-blue-500 mt-1">
                {stats.active}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">Running or queued right now</span>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50 hover:border-primary/20 transition-all duration-300">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider">Average Evaluation Score</CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-amber-500 mt-1 flex items-baseline gap-1">
                {stats.avgScore} <span className="text-xs text-muted-foreground font-normal">/100</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">Weighted overall average</span>
            </CardContent>
          </Card>
        </div>

        {/* Filters Panel */}
        <Card className="border-border/60 bg-gradient-to-br from-card to-card/50 shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 h-10 w-full"
                placeholder="Search evaluations by project or mode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter by Project */}
            <div className="w-full md:w-56 shrink-0">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-10 bg-background/55">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Projects</SelectItem>
                  {projects?.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter by Status */}
            <div className="w-full md:w-44 shrink-0">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 bg-background/55">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Runs Standings List Table */}
        <Card className="border-border/60 shadow-md">
          <CardContent className="p-0">
            {runsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm font-medium">Loading evaluation database...</span>
              </div>
            ) : filteredRuns.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[100px] font-bold">Run ID</TableHead>
                      <TableHead className="w-[220px]">Project Target</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead className="text-center w-[120px]">Score</TableHead>
                      <TableHead className="w-[180px]">Date Executed</TableHead>
                      <TableHead className="text-right pr-6 w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRuns.map((run) => (
                      <TableRow key={run.id} className="hover:bg-muted/15 group transition-colors">
                        {/* Run ID Link */}
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          <Link href={run.status === "running" ? `/runs/${run.id}/live` : `/runs/${run.id}/report`}>
                            <span className="hover:underline cursor-pointer">#{run.id.substring(0, 8)}</span>
                          </Link>
                        </TableCell>

                        {/* Project Name */}
                        <TableCell className="font-semibold text-foreground truncate max-w-[200px]">
                          {run.projectName}
                        </TableCell>

                        {/* Mode */}
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs font-medium bg-muted/65 border-border/40">
                            {(run.mode || "Playwright").replace("_", " ")}
                          </Badge>
                        </TableCell>

                        {/* Status Badge */}
                        <TableCell>
                          {getStatusBadge(run.status)}
                        </TableCell>

                        {/* Scored runs */}
                        <TableCell className="text-center font-bold">
                          {run.score != null ? (
                            <span className={getScoreColor(run.score)}>
                              {Math.round(run.score)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">-</span>
                          )}
                        </TableCell>

                        {/* Date Executed */}
                        <TableCell className="text-xs text-muted-foreground">
                          {run.createdAt ? new Date(run.createdAt).toLocaleString() : "-"}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right pr-6">
                          <Link href={run.status === "running" ? `/runs/${run.id}/live` : `/runs/${run.id}/report`}>
                            <Button variant="ghost" size="sm" className="opacity-80 group-hover:opacity-100 transition-opacity gap-1">
                              View
                              <ChevronRight className="w-3.5 h-3.5 text-primary" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <AlertCircle className="w-10 h-10 mb-3 text-muted-foreground/60" />
                <h3 className="font-semibold text-foreground">No evaluation runs found</h3>
                <p className="text-sm mt-0.5">Try adjusting your filters or search terms, or trigger a new evaluation.</p>
                <Link href="/runs/new" className="mt-4">
                  <Button size="sm">Start First Run</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
