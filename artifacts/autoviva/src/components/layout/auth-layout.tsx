import { Link } from "wouter";

export function AuthLayout({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle?: string }) {
  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex flex-col w-1/2 bg-sidebar border-r border-border p-12 relative overflow-hidden">
        <div className="relative z-10 flex flex-col h-full">
          <Link href="/" className="flex items-center gap-2 mb-auto">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-mono font-bold">AV</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">AutoViva<span className="text-primary">.ai</span></span>
          </Link>
          
          <div className="mt-auto mb-12">
            <h1 className="text-4xl font-bold mb-4 font-sans text-foreground">The AI Examiner for Modern Development.</h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Test your projects, capture evidence, and generate comprehensive evaluation reports before your real examiner does.
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-32 -mt-32 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Right panel - Form */}
      <div className="flex flex-col w-full lg:w-1/2 items-center justify-center p-8 sm:p-12 relative">
        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}