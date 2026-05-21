import { Link } from "wouter";

export function AuthLayout({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle?: string }) {
  return (
    <div className="min-h-screen w-full flex bg-black text-[#fcfdff] font-favorit">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex flex-col w-1/2 bg-black border-r border-white/6 p-16 relative overflow-hidden">
        {/* Warm Orange Glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-[radial-gradient(circle_at_top,rgba(255,89,0,0.08)_0%,rgba(0,0,0,0)_60%)] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[600px] h-[600px] bg-[radial-gradient(circle_at_bottom,rgba(0,117,255,0.06)_0%,rgba(0,0,0,0)_60%)] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#fcfdff] flex items-center justify-center">
              <span className="text-black font-mono font-bold text-sm">AV</span>
            </div>
            <span className="font-display font-medium text-xl tracking-[-0.03em] text-[#fcfdff]">
              AutoViva<span className="text-neutral-500 text-sm font-sans font-normal ml-0.5">.ai</span>
            </span>
          </Link>
          
          <div className="max-w-md">
            <h1 className="text-4xl md:text-5xl font-display font-medium text-[#fcfdff] leading-[1.1] tracking-[-0.03em] mb-6">
              The AI Examiner for Modern Development.
            </h1>
            <p className="text-base text-[#a1a4a5] leading-relaxed">
              Test your projects, capture visual evidence, and generate comprehensive evaluation reports before your real examiner does.
            </p>
          </div>

          <div className="text-xs text-neutral-600 font-sans">
            © 2026 AutoViva.ai. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex flex-col w-full lg:w-1/2 items-center justify-center p-8 sm:p-16 relative bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,rgba(0,0,0,0)_80%)] pointer-events-none" />
        <div className="w-full max-w-[360px] relative z-10">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-display font-medium text-[#fcfdff] tracking-[-0.02em]">{title}</h2>
            {subtitle && <p className="text-sm text-[#a1a4a5] mt-3 leading-relaxed font-sans">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}