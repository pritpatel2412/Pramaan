import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams } from "wouter";

export default function ProjectEdit() {
  const params = useParams();
  return (
    <SidebarLayout>
      <div className="py-8">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Edit Project</h1>
        <p className="text-muted-foreground">Project ID: {params.projectId}</p>
        {/* Simplified for brevity */}
      </div>
    </SidebarLayout>
  );
}
