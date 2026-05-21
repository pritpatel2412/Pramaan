import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, User, Bell, Key, CreditCard, AlertTriangle, Loader2 } from "lucide-react";

type SettingsTab = "profile" | "notifications" | "api" | "billing" | "danger";

const TABS: { id: SettingsTab; label: string; icon: any }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "api", label: "API Keys", icon: Key },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
];

const PLANS = [
  { id: "free", label: "Free", price: "₹0/mo", features: ["3 projects", "10 evaluations/month", "Basic reports"] },
  { id: "pro", label: "Pro", price: "₹299/mo", features: ["Unlimited projects", "100 evaluations/month", "AI reports + Viva Mode", "PDF export"] },
  { id: "team", label: "Team", price: "₹999/mo", features: ["Everything in Pro", "Faculty dashboard", "Team analytics", "Priority support"] },
];

export default function Settings() {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [groqKey, setGroqKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { user, logout } = useAuth();

  const { data: me } = useGetMe({
    query: { queryKey: getGetMeQueryKey() }
  });

  const currentUser = me ?? user;

  return (
    <SidebarLayout>
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight mb-6">Settings</h1>

        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-44 shrink-0 space-y-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  tab === t.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                } ${t.id === "danger" ? "text-red-400 hover:text-red-400 hover:bg-red-500/10 mt-4 border-t border-border pt-4" : ""}`}
              >
                <t.icon className="w-4 h-4 shrink-0" />
                {t.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {tab === "profile" && (
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your account details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                      {currentUser?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="font-semibold">{currentUser?.name}</p>
                      <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{currentUser?.plan ?? "free"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Name</label>
                      <Input defaultValue={currentUser?.name ?? ""} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Email</label>
                      <Input defaultValue={currentUser?.email ?? ""} type="email" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">College / Institution</label>
                      <Input defaultValue={(currentUser as any)?.college ?? ""} placeholder="Enter your institution" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Role</label>
                      <select className="w-full h-9 bg-background border border-input rounded-md px-3 text-sm" defaultValue={currentUser?.role ?? "student"}>
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                        <option value="judge">Judge</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">New Password</label>
                    <Input type="password" placeholder="Leave blank to keep current" />
                  </div>
                  <Button>Save Profile</Button>
                </CardContent>
              </Card>
            )}

            {tab === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Control when AutoViva sends you updates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Evaluation completed", desc: "When a test run finishes", defaultChecked: true },
                    { label: "Report ready", desc: "When your PDF report is generated", defaultChecked: true },
                    { label: "Score alert", desc: "When your score drops below 60", defaultChecked: false },
                    { label: "Weekly summary", desc: "Weekly evaluation digest email", defaultChecked: false },
                  ].map(n => (
                    <label key={n.label} className="flex items-center justify-between p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/20">
                      <div>
                        <p className="text-sm font-medium">{n.label}</p>
                        <p className="text-xs text-muted-foreground">{n.desc}</p>
                      </div>
                      <input type="checkbox" defaultChecked={n.defaultChecked} className="w-4 h-4 accent-primary" />
                    </label>
                  ))}
                  <Button>Save Preferences</Button>
                </CardContent>
              </Card>
            )}

            {tab === "api" && (
              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Configure external service integrations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Groq API Key</label>
                    <p className="text-xs text-muted-foreground">Used for Viva Mode voice interaction. Get yours at console.groq.com</p>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        placeholder="gsk_..."
                        className="flex-1 font-mono text-sm"
                      />
                      <Button variant="outline" onClick={() => { setKeySaved(true); setTimeout(() => setKeySaved(false), 2000); }} disabled={!groqKey}>
                        {keySaved ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/30 border border-border rounded-lg">
                    <p className="text-xs text-muted-foreground">AutoViva AI uses its own built-in AI for evaluations. The Groq key is only needed for advanced voice mode features.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {tab === "billing" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Current Plan</CardTitle>
                    <CardDescription>You are on the <span className="text-primary font-medium capitalize">{currentUser?.plan ?? "Free"}</span> plan</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-muted/30 border border-primary/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold capitalize">{currentUser?.plan ?? "Free"} Plan</p>
                          <p className="text-sm text-muted-foreground">
                            {currentUser?.plan === "free" ? "3 projects, 10 evaluations/month" :
                             currentUser?.plan === "pro" ? "Unlimited projects, 100 evaluations/month" :
                             "Unlimited everything + Faculty dashboard"}
                          </p>
                        </div>
                        {currentUser?.plan === "free" && (
                          <Button size="sm">Upgrade</Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-4">
                  {PLANS.map(plan => (
                    <Card key={plan.id} className={`${currentUser?.plan === plan.id ? "border-primary/50 bg-primary/5" : ""}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{plan.label}</CardTitle>
                        <p className="text-2xl font-bold text-primary">{plan.price}</p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {plan.features.map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                            {f}
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant={currentUser?.plan === plan.id ? "outline" : "default"}
                          className="w-full mt-3"
                          disabled={currentUser?.plan === plan.id}
                        >
                          {currentUser?.plan === plan.id ? "Current Plan" : "Upgrade"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {tab === "danger" && (
              <Card className="border-red-500/20">
                <CardHeader>
                  <CardTitle className="text-red-400">Danger Zone</CardTitle>
                  <CardDescription>These actions are permanent and cannot be undone</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 border border-red-500/20 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Sign out from all devices</p>
                      <p className="text-xs text-muted-foreground">Revoke all active sessions</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={logout}>Sign Out</Button>
                  </div>
                  <div className="p-4 border border-red-500/20 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-400">Delete Account</p>
                      <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
                    </div>
                    {confirmDelete ? (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                        <Button variant="destructive" size="sm">Confirm Delete</Button>
                      </div>
                    ) : (
                      <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>Delete Account</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
