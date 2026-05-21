import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useListProjects } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FolderGit2, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();

  return (
    <SidebarLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground">Manage and monitor your evaluation targets.</p>
          </div>
          <Link href="/projects/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </Link>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search projects..." />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading projects...</div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="flex flex-col hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="truncate">{project.name}</CardTitle>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${project.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                      {project.status}
                    </span>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {project.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base URL:</span>
                      <span className="truncate max-w-[150px] font-mono">{project.baseUrl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Runs:</span>
                      <span>{project.runCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Score:</span>
                      <span className="font-medium">{project.avgScore ? Math.round(project.avgScore) : "-"}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-border mt-auto flex gap-2">
                  <Link href={`/projects/${project.id}`} className="flex-1">
                    <Button variant="outline" className="w-full">View</Button>
                  </Link>
                  <Link href={`/runs/new?projectId=${project.id}`} className="flex-1">
                    <Button className="w-full">Run</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-lg bg-card/50">
            <FolderGit2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No projects found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
              Get started by creating your first evaluation target.
            </p>
            <Link href="/projects/new">
              <Button>Create Project</Button>
            </Link>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
