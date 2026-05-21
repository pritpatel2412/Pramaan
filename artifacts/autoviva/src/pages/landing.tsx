import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowRight, Play, Terminal, Cpu, Layers } from "lucide-react";

export default function Landing() {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen bg-black text-[#fcfdff] font-favorit selection:bg-white/20 overflow-x-hidden">
      {/* Editorial Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-white/6 bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#fcfdff] flex items-center justify-center">
              <span className="text-black font-mono font-bold text-xs">AV</span>
            </div>
            <span className="font-display font-medium text-lg tracking-[-0.03em] text-[#fcfdff]">
              AutoViva<span className="text-neutral-500 text-sm font-sans font-normal ml-0.5">.ai</span>
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-sans font-medium text-[#a1a4a5]">
            <a href="#features" className="hover:text-[#fcfdff] transition-colors">Features</a>
            <a href="#demo" className="hover:text-[#fcfdff] transition-colors">Code Story</a>
            <a href="#pricing" className="hover:text-[#fcfdff] transition-colors">Pricing</a>
          </nav>
          
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-[#fcfdff] text-black hover:bg-neutral-200 font-sans font-medium rounded-md text-xs px-4 h-9 shadow-none">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-sans font-medium text-[#a1a4a5] hover:text-[#fcfdff] transition-colors">
                  Sign In
                </Link>
                <Link href="/register">
                  <Button className="bg-[#fcfdff] text-black hover:bg-neutral-200 font-sans font-medium rounded-md text-xs px-4 h-9 shadow-none">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-col bg-black">
        {/* Hero Section */}
        <section className="py-28 md:py-36 overflow-hidden relative border-b border-white/6 bg-black">
          {/* Low opacity warm orange glow anchored at hero top */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(circle_at_top,rgba(255,89,0,0.07)_0%,rgba(0,0,0,0)_60%)] pointer-events-none" />
          
          <div className="max-w-4xl mx-auto px-6 relative z-10 text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#101012] border border-white/14 text-xs font-sans font-medium text-[#a1a4a5] mb-10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#11ff99] animate-pulse" />
              AutoViva AI v1.0 is live
            </div>
            
            <h1 className="text-6xl sm:text-7xl md:text-[90px] font-display font-medium text-[#fcfdff] tracking-[-0.04em] leading-[0.95] mb-8 select-none">
              Evaluation for developers.<br />
              <span className="opacity-60 font-serif italic text-white/80">Viva reimagined.</span>
            </h1>
            
            <p className="text-base sm:text-lg text-[#a1a4a5] mb-12 max-w-xl mx-auto leading-relaxed font-sans">
              Deploy our AI agent to stress-test your localhost project, run multi-browser visual drift audits, and generate an outstanding defense score.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Link href="/register">
                <Button className="bg-[#fcfdff] text-black hover:bg-neutral-200 font-sans font-medium rounded-md text-sm px-6 h-11 shadow-none">
                  Start Free Evaluation
                </Button>
              </Link>
              <a href="#demo">
                <Button variant="ghost" className="bg-[#101012] border border-white/14 hover:bg-neutral-900 font-sans font-medium rounded-md text-sm px-6 h-11 text-[#fcfdff] transition-all">
                  See Code Story
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Code Story & Splits */}
        <section id="demo" className="py-24 md:py-32 relative border-b border-white/6 bg-black">
          {/* Cool blue wash backdrop glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(circle_at_top,rgba(0,117,255,0.06)_0%,rgba(0,0,0,0)_60%)] pointer-events-none" />
          
          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <span className="font-sans text-xs uppercase tracking-wider text-[#3b9eff] font-semibold">Integrate this weekend</span>
                <h2 className="text-4xl md:text-5xl font-display font-medium text-[#fcfdff] tracking-[-0.03em] leading-[1.0] mt-4 mb-6">
                  Stress-test without writing test code.
                </h2>
                <p className="text-base text-[#a1a4a5] leading-relaxed font-sans mb-8">
                  Simply point AutoViva to your local repository. Our autonomous Playwright agent navigates your interface, validates core forms using smart cognitive autofills, detects styling drift across Chromium, Firefox, and WebKit, and runs an automated oral viva defense.
                </p>
                <ul className="space-y-4 font-sans text-sm text-[#a1a4a5]">
                  <li className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-white/4 border border-white/14 flex items-center justify-center text-xs font-semibold text-[#11ff99]">✓</span>
                    Sequential Multi-Browser baseline screenshots
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-white/4 border border-white/14 flex items-center justify-center text-xs font-semibold text-[#11ff99]">✓</span>
                    Self-healing login & cognitive field auto-completion
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-white/4 border border-white/14 flex items-center justify-center text-xs font-semibold text-[#11ff99]">✓</span>
                    Live interactive slide reports with neon-red drift overlays
                  </li>
                </ul>
              </div>

              {/* {component.code-window} */}
              <div className="bg-[#06060a] border border-white/14 rounded-lg p-6 font-code text-xs text-[#a1a4a5] relative">
                {/* Traffic lights chrome */}
                <div className="flex gap-1.5 mb-6">
                  <div className="w-3 h-3 rounded-full bg-[#ff2047]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffc53d]" />
                  <div className="w-3 h-3 rounded-full bg-[#11ff99]" />
                  <span className="text-[10px] text-neutral-600 font-sans ml-4">Playwright Executor Terminal</span>
                </div>
                
                <div className="space-y-3">
                  <p className="text-neutral-500">// Deploying test runner on http://localhost:5173</p>
                  <p className="text-[#fcfdff]"><span className="text-[#3b9eff]">$</span> autoviva run --multi-browser</p>
                  <p className="text-neutral-400">⚡ Initializing environment...</p>
                  <p className="text-neutral-400">🤖 Launching <span className="text-[#3b9eff]">Chromium</span> engine...</p>
                  <p className="text-[#11ff99]">✔ Screenshot baseline captured: home_dashboard_chromium.png</p>
                  <p className="text-neutral-400">🤖 Launching <span className="text-[#ff801f]">Firefox</span> engine...</p>
                  <p className="text-[#11ff99]">✔ Screenshot captured: home_dashboard_firefox.png</p>
                  <p className="text-neutral-400">🤖 Launching <span className="text-[#ff2047]">WebKit</span> engine...</p>
                  <p className="text-[#11ff99]">✔ Screenshot captured: home_dashboard_webkit.png</p>
                  <p className="text-neutral-400">🔬 Running visual regression comparison...</p>
                  <p className="text-[#ffc53d]">⚠ Firefox drift mismatch: 1.48% (diff generated)</p>
                  <p className="text-[#11ff99]">✔ Evaluation complete. Opening report...</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features 3-Column Grid */}
        <section id="features" className="py-24 md:py-32 bg-black border-b border-white/6">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-20">
              <span className="font-sans text-xs uppercase tracking-wider text-[#ff801f] font-semibold">Technical Cast</span>
              <h2 className="text-4xl md:text-5xl font-display font-medium text-[#fcfdff] tracking-[-0.03em] leading-[1.0] mt-4">
                Engineered for visual precision.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature Card 1 */}
              <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-8 hover:border-white/14 transition-colors">
                <div className="w-10 h-10 rounded-md bg-[#101012] border border-white/14 flex items-center justify-center mb-6">
                  <Layers className="w-5 h-5 text-[#3b9eff]" />
                </div>
                <h3 className="text-xl font-sans font-medium text-[#fcfdff] mb-3">Multi-Browser Engine</h3>
                <p className="text-sm text-[#a1a4a5] leading-relaxed font-sans">
                  Runs tests sequentially across Playwright Chromium, Firefox, and WebKit to highlight rendering regressions cleanly without slowing down development.
                </p>
              </div>

              {/* Feature Card 2 */}
              <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-8 hover:border-white/14 transition-colors">
                <div className="w-10 h-10 rounded-md bg-[#101012] border border-white/14 flex items-center justify-center mb-6">
                  <Terminal className="w-5 h-5 text-[#ff801f]" />
                </div>
                <h3 className="text-xl font-sans font-medium text-[#fcfdff] mb-3">Cognitive Autofills</h3>
                <p className="text-sm text-[#a1a4a5] leading-relaxed font-sans">
                  Fills database submission inputs automatically with valid contextual parameters, mimicking high-speed human typing to hit complex form states.
                </p>
              </div>

              {/* Feature Card 3 */}
              <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-8 hover:border-white/14 transition-colors">
                <div className="w-10 h-10 rounded-md bg-[#101012] border border-white/14 flex items-center justify-center mb-6">
                  <Cpu className="w-5 h-5 text-[#11ff99]" />
                </div>
                <h3 className="text-xl font-sans font-medium text-[#fcfdff] mb-3">Interactive Compare</h3>
                <p className="text-sm text-[#a1a4a5] leading-relaxed font-sans">
                  Inspect shifts dynamically with a premium slider handle or overlay pixel discrepancy regions in high-contrast neon red for direct evaluation insight.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 md:py-32 bg-black relative border-b border-white/6">
          {/* Accent yellow glow backdrop */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(circle_at_top,rgba(255,197,61,0.05)_0%,rgba(0,0,0,0)_60%)] pointer-events-none" />
          
          <div className="max-w-5xl mx-auto px-6 relative z-10">
            <div className="text-center mb-20">
              <span className="font-sans text-xs uppercase tracking-wider text-[#ffc53d] font-semibold">Scale transparently</span>
              <h2 className="text-4xl md:text-5xl font-display font-medium text-[#fcfdff] tracking-[-0.03em] leading-[1.0] mt-4">
                Priced on quality, not novelty.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              {/* Card 1 */}
              <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-8 flex flex-col justify-between">
                <div>
                  <span className="text-xs uppercase text-[#888e90] font-sans font-medium">Standard</span>
                  <div className="mt-4 mb-6 flex items-baseline gap-1">
                    <span className="text-4xl font-sans font-medium text-[#fcfdff]">$0</span>
                    <span className="text-sm text-[#888e90] font-sans">/mo</span>
                  </div>
                  <p className="text-sm text-[#a1a4a5] leading-relaxed font-sans mb-8">
                    Great for individuals to test single localhost projects and run essential test plans.
                  </p>
                </div>
                <Link href="/register" className="w-full">
                  <Button variant="ghost" className="w-full bg-[#101012] border border-white/14 hover:bg-neutral-900 rounded-md h-9 text-[#fcfdff]">
                    Get Started
                  </Button>
                </Link>
              </div>

              {/* Card 2 - Elevated */}
              <div className="bg-[#101012] border border-white/14 rounded-lg p-8 flex flex-col justify-between relative shadow-none">
                <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#fcfdff] text-black text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider font-sans">
                  Recommended
                </div>
                <div>
                  <span className="text-xs uppercase text-[#fcfdff] font-sans font-medium">Developer Pro</span>
                  <div className="mt-4 mb-6 flex items-baseline gap-1">
                    <span className="text-4xl font-sans font-medium text-[#fcfdff]">$29</span>
                    <span className="text-sm text-[#888e90] font-sans">/mo</span>
                  </div>
                  <p className="text-sm text-[#a1a4a5] leading-relaxed font-sans mb-8">
                    Execute multi-browser audits, configure visual comparison pipelines, and access premium AI oral viva simulations.
                  </p>
                </div>
                <Link href="/register" className="w-full">
                  <Button className="w-full bg-[#fcfdff] text-black hover:bg-neutral-200 rounded-md h-9 shadow-none">
                    Start Pro Trial
                  </Button>
                </Link>
              </div>

              {/* Card 3 */}
              <div className="bg-[#0a0a0c] border border-white/6 rounded-lg p-8 flex flex-col justify-between">
                <div>
                  <span className="text-xs uppercase text-[#888e90] font-sans font-medium">Enterprise</span>
                  <div className="mt-4 mb-6 flex items-baseline gap-1">
                    <span className="text-4xl font-sans font-medium text-[#fcfdff]">$99</span>
                    <span className="text-sm text-[#888e90] font-sans">/mo</span>
                  </div>
                  <p className="text-sm text-[#a1a4a5] leading-relaxed font-sans mb-8">
                    Dedicated testing runtimes, infinite history logs, team seat licensing, and custom AI grading models.
                  </p>
                </div>
                <Link href="/register" className="w-full">
                  <Button variant="ghost" className="w-full bg-[#101012] border border-white/14 hover:bg-neutral-900 rounded-md h-9 text-[#fcfdff]">
                    Contact Sales
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Editorial Footer */}
      <footer className="bg-black py-16 px-6 border-t border-white/6 font-sans">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-[#fcfdff] flex items-center justify-center">
              <span className="text-black font-mono font-bold text-[10px]">AV</span>
            </div>
            <span className="font-display font-medium text-base text-[#fcfdff]">
              AutoViva<span className="text-neutral-500 text-xs ml-0.5">.ai</span>
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-[#a1a4a5]">
            <span className="w-2 h-2 rounded-full bg-[#11ff99]" />
            Status: <span className="text-[#fcfdff] font-medium">Operational</span>
          </div>

          <div className="text-xs text-[#888e90]">
            © 2026 AutoViva AI. Designed for developers.
          </div>
        </div>
      </footer>
    </div>
  );
}
