import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams } from "wouter";

export default function TestSuiteDetail() {
  const params = useParams();
  return (
    <SidebarLayout>
      <div className="py-8">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Test Suite Details</h1>
        <p className="text-muted-foreground">Suite ID: {params.suiteId}</p>
      </div>
    </SidebarLayout>
  );
}
