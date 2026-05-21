import { SidebarLayout } from "@/components/layout/sidebar-layout";

export default function Faculty() {
  return (
    <SidebarLayout>
      <div className="py-8">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Faculty Dashboard</h1>
        <div className="p-6 border rounded-lg bg-card">
          <p className="text-muted-foreground">Student evaluations and class rankings will appear here.</p>
        </div>
      </div>
    </SidebarLayout>
  );
}
