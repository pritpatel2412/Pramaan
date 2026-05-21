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
      <div className="flex flex-col gap-10">
        {/* Header split */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-medium text-[#fcfdff] tracking-[-0.03em]">Projects</h1>
            <p className="text-xs text-[#888e90] mt-1 font-sans">Manage and monitor your evaluation targets.</p>
          </div>
          <Link href="/projects/new">
            <Button className="bg-[#fcfdff] text-black hover:bg-[#f1f7fe] font-sans font-medium rounded-md text-xs px-4 h-9 shadow-none flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </Link>
        </div>

        {/* Filter bar */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888e90]" />
            <Input 
              className="pl-9 bg-[#0a0a0c] border border-white/14 rounded-md focus-visible:ring-0 focus-visible:border-[#fcfdff] text-[#fcfdff] placeholder-neutral-600 h-10 transition-colors" 
              placeholder="Search projects..." 
            />
          </div>
          <Button variant="ghost" className="bg-[#101012] border border-white/14 hover:bg-neutral-900 rounded-md h-10 w-10 p-0 text-[#fcfdff]">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-[#888e90] font-sans text-xs">Loading target repositories...</div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div 
                key={project.id} 
                className="bg-[#0a0a0c] border border-white/6 hover:border-white/14 rounded-lg p-6 flex flex-col justify-between transition-all duration-150"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-sans font-medium text-[#fcfdff] truncate max-w-[150px]">
                      {project.name}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-sans font-semibold border ${project.status === 'active' ? 'bg-white/4 border-white/14 text-[#11ff99]' : 'bg-[#101012] border-transparent text-[#888e90]'}`}>
                      {project.status}
                    </span>
                  </div>
                  
                  <p className="text-xs text-[#a1a4a5] line-clamp-2 mb-6 font-sans leading-relaxed">
                    {project.description || "No description provided."}
                  </p>

                  <div className="space-y-3 border-t border-white/6 pt-4 text-xs font-sans">
                    <div className="flex justify-between">
                      <span className="text-[#888e90]">Base URL</span>
                      <span className="truncate max-w-[150px] font-mono text-[11px] text-neutral-300">{project.baseUrl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#888e90]">Suite Runs</span>
                      <span className="font-mono text-neutral-300">{project.runCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#888e90]">Average Score</span>
                      <span className="font-mono font-medium text-[#11ff99]">
                        {project.avgScore ? `${Math.round(project.avgScore)}%` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3 border-t border-white/6 pt-4">
                  <Link href={`/projects/${project.id}`} className="flex-1">
                    <Button variant="ghost" className="w-full text-xs text-[#fcfdff] bg-[#101012] border border-white/14 hover:bg-neutral-900 rounded-md h-8 px-4 font-sans font-medium transition-all">
                      View
                    </Button>
                  </Link>
                  <Link href={`/runs/new?projectId=${project.id}`} className="flex-1">
                    <Button className="w-full bg-[#fcfdff] text-black hover:bg-[#f1f7fe] rounded-md h-8 text-xs font-sans font-medium transition-all shadow-none">
                      Run
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-white/6 rounded-lg bg-black">
            <FolderGit2 className="w-10 h-10 text-[#888e90] mb-4" />
            <h3 className="text-sm font-sans font-medium text-[#fcfdff]">No projects found</h3>
            <p className="text-xs text-[#a1a4a5] max-w-xs mt-2 mb-6 font-sans leading-relaxed">
              Get started by creating your first target repository URL.
            </p>
            <Link href="/projects/new">
              <Button className="bg-[#fcfdff] text-black hover:bg-[#f1f7fe] rounded-md h-9 text-xs font-sans font-medium px-4 shadow-none">
                Create Project
              </Button>
            </Link>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
