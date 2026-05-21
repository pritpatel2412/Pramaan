import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { Button } from "@/components/ui/button";

export default function Settings() {
  return (
    <SidebarLayout>
      <div className="py-8 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Settings</h1>
        <div className="space-y-6">
          <div className="p-6 border rounded-lg bg-card">
            <h3 className="text-lg font-medium mb-4">Profile</h3>
            <p className="text-sm text-muted-foreground mb-4">Manage your account details and preferences.</p>
            <Button variant="outline">Edit Profile</Button>
          </div>
          <div className="p-6 border rounded-lg bg-card">
            <h3 className="text-lg font-medium mb-4 text-destructive">Danger Zone</h3>
            <p className="text-sm text-muted-foreground mb-4">Irreversible actions for your account.</p>
            <Button variant="destructive">Delete Account</Button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
