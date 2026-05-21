import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  FolderGit2, 
  PlayCircle, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut,
  GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
      }
    });
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Projects", href: "/projects", icon: FolderGit2 },
    { name: "Evaluations", href: "/runs/new", icon: PlayCircle },
    { name: "Reports", href: "/runs", icon: FileText },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  if (user?.role === "faculty" || user?.role === "judge") {
    navItems.splice(4, 0, { name: "Faculty", href: "/faculty", icon: GraduationCap });
  }

  return (
    <div className="flex min-h-screen w-full bg-black text-[#fcfdff] font-favorit">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/6 bg-black flex flex-col hidden md:flex">
        <div className="p-6 border-b border-white/6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#fcfdff] flex items-center justify-center">
              <span className="text-black font-mono font-bold text-xs">AV</span>
            </div>
            <span className="font-display font-medium text-lg tracking-[-0.03em] text-[#fcfdff]">
              AutoViva<span className="text-neutral-500 text-sm font-sans font-normal ml-0.5">.ai</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 font-sans font-medium",
                  isActive 
                    ? "bg-[#101012] text-[#fcfdff] border border-white/14 shadow-none" 
                    : "text-[#a1a4a5] border border-transparent hover:bg-white/4 hover:text-[#fcfdff]"
                )}
              >
                <item.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-[#fcfdff]" : "text-[#888e90]")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/6 mt-auto bg-black">
          <div className="flex items-center gap-3 px-3 py-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#101012] border border-white/14 flex items-center justify-center text-xs font-sans font-medium text-[#fcfdff]">
              {user?.name?.substring(0, 2).toUpperCase() || "AV"}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-sans font-medium text-[#fcfdff] truncate">{user?.name}</span>
              <span className="text-xs font-sans text-[#888e90] truncate capitalize">{user?.role}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-[#a1a4a5] hover:text-[#fcfdff] hover:bg-white/4 border border-white/6 rounded-md h-9" 
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden bg-black">
        <div className="flex-1 overflow-y-auto p-6 md:p-10 relative">
          {children}
        </div>
      </main>
    </div>
  );
}