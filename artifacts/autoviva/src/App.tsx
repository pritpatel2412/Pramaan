import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/lib/auth";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectNew from "@/pages/project-new";
import ProjectDetail from "@/pages/project-detail";
import ProjectEdit from "@/pages/project-edit";
import TestSuiteNew from "@/pages/test-suite-new";
import TestSuiteDetail from "@/pages/test-suite-detail";
import RunNew from "@/pages/run-new";
import RunLive from "@/pages/run-live";
import RunReport from "@/pages/run-report";
import RunViva from "@/pages/run-viva";
import Runs from "@/pages/runs";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import Faculty from "@/pages/faculty";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/projects"><ProtectedRoute component={Projects} /></Route>
      <Route path="/projects/new"><ProtectedRoute component={ProjectNew} /></Route>
      <Route path="/projects/:projectId"><ProtectedRoute component={ProjectDetail} /></Route>
      <Route path="/projects/:projectId/edit"><ProtectedRoute component={ProjectEdit} /></Route>
      
      <Route path="/projects/:projectId/test-suites/new"><ProtectedRoute component={TestSuiteNew} /></Route>
      <Route path="/test-suites/:suiteId"><ProtectedRoute component={TestSuiteDetail} /></Route>
      
      <Route path="/runs/new"><ProtectedRoute component={RunNew} /></Route>
      <Route path="/runs/:runId/live"><ProtectedRoute component={RunLive} /></Route>
      <Route path="/runs/:runId/report"><ProtectedRoute component={RunReport} /></Route>
      <Route path="/runs/:runId/viva"><ProtectedRoute component={RunViva} /></Route>
      <Route path="/runs"><ProtectedRoute component={Runs} /></Route>
      
      <Route path="/analytics"><ProtectedRoute component={Analytics} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
      <Route path="/faculty"><ProtectedRoute component={Faculty} /></Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <TooltipProvider>
              <Router />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </WouterRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
