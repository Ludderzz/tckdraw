import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { Shield, Lock, Zap, CheckCircle, Loader2, Trophy } from "lucide-react";
import { Winner } from "../../../server/winners";
import { trpc } from "@/lib/trpc"; // Make sure your tRPC client hook path matches your setup

export default function Home() {
  const { user, isAdmin, loading, signIn, signOut, error: authError } = useSupabaseAuth();
  const [, setLocation] = useLocation();
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [winners, setWinners] = useState<Winner[]>([]);

  // Fetch using tRPC instead of native fetch to `/api/winners`
  const { data: winnersData } = trpc.winners.getLive.useQuery(undefined, {
    refetchInterval: 60000, // Optional: refresh every minute
  });

  useEffect(() => {
    if (winnersData && winnersData.success && Array.isArray(winnersData.data)) {
      setWinners(winnersData.data);
    }
  }, [winnersData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await signIn(email, password);
      setEmail("");
      setPassword("");
      setShowLoginForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mx-auto mb-4" />
          <p className="text-gray-300 tracking-wider">Loading The Cash King...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-gray-100 selection:bg-[#D4AF37] selection:text-black">
      {/* Navigation */}
      <nav className="border-b border-[#222222] bg-[#0c0c0c]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/tck-logo.png"
              alt="The Cash King"
              className="h-12 w-28 object-contain drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]"
            />
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728] tracking-wide uppercase">
                The Cash King
              </span>
              <span className="text-[10px] text-gray-400 tracking-widest uppercase font-semibold">Draw System</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-400 hidden sm:inline">
                  {user.email}
                </span>
                {isAdmin && (
                  <Button
                    onClick={() => setLocation("/draw")}
                    className="bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728] text-black font-bold hover:opacity-90 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                  >
                    Draw Area
                  </Button>
                )}
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-[#333] text-gray-300 hover:bg-[#1a1a1a] hover:text-white"
                >
                  Logout
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setShowLoginForm(!showLoginForm)}
                className="bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728] text-black font-bold hover:opacity-90 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
              >
                Admin Login
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="border-b border-[#222222] bg-gradient-to-b from-[#121212] via-[#0a0a0a] to-[#080808] pt-20 pb-16 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#D4AF37]/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-6 flex justify-center">
              <img
                src="/hero-image.webp"
                alt="The Cash King"
                className="h-48 w-120 object-contain drop-shadow-[0_0_35px_rgba(212,175,55,0.4)]"
              />
            </div>
            <h1 className="text-4xl sm:text-6xl font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728] uppercase">
              The Official Draw System
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Gambling-grade compliance. Cryptographically verified. Zero-server transparency built for royalty.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => setLocation("/verify")}
                className="bg-[#1b4d2e] hover:bg-[#23633d] text-white border border-[#2ecc71]/40 px-8 py-4 text-lg font-bold h-auto shadow-lg transition-all"
              >
                Verify a Draw
              </Button>
              <Button
                asChild
                className="bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728] text-black hover:opacity-90 px-8 py-4 text-lg font-bold h-auto shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all"
              >
                <a 
                  href="https://thecashkings.co.uk/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Enter Draws
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Winners Ticker Bar pulling from live API endpoint */}
      {winners.length > 0 && (
        <section className="bg-[#0c0c0c] border-b border-[#222222] py-3 overflow-hidden relative shadow-inner">
          <div className="container flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#161616] border border-[#333] px-3 py-1 rounded-md text-xs font-bold text-[#D4AF37] uppercase tracking-wider shrink-0 z-10 shadow-lg">
              <Trophy className="w-4 h-4 animate-bounce text-[#fcf6ba]" />
              <span>Verified Winners ({winners.length})</span>
            </div>
            
            <div className="relative w-full overflow-hidden flex whitespace-nowrap">
              <div className="inline-flex animate-marquee gap-8 items-center text-sm">
                {winners.concat(winners).map((winner, idx) => (
                  <div 
                    key={idx} 
                    className="inline-flex items-center gap-2 bg-[#121212] border border-[#262626] px-4 py-1.5 rounded-full text-gray-300 shadow-sm"
                  >
                    <span className="font-bold text-[#fcf6ba]">{winner.name}</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-400 text-xs">{winner.competition}</span>
                    <span className="bg-[#1e1e1e] text-[#D4AF37] px-2.5 py-0.5 rounded text-xs font-black tracking-wide border border-[#D4AF37]/30">
                      {winner.prize}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Custom Tailwind keyframe style injection */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 300s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Login Form Modal */}
      {showLoginForm && !user && (
        <section className="border-b border-[#222] bg-[#111] py-12 transition-all">
          <div className="container max-w-md mx-auto">
            <Card className="bg-[#141414] border border-[#333] shadow-2xl p-6 relative">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728]" />
              <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#bf953f] to-[#fcf6ba] mb-6">Admin Login</h3>
              
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}
              {authError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
                  {authError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                  <Input
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="bg-[#0c0c0c] border-[#333] text-gray-100 focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="bg-[#0c0c0c] border-[#333] text-gray-100 focus:border-[#D4AF37]"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728] text-black font-bold hover:opacity-90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[#333] text-gray-300 hover:bg-[#1a1a1a] hover:text-white"
                  onClick={() => {
                    setShowLoginForm(false);
                    setError("");
                    setEmail("");
                    setPassword("");
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </form>
            </Card>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-20 border-b border-[#222222] bg-[#0a0a0a]">
        <div className="container">
          <h2 className="text-3xl font-black text-center mb-12 tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728]">
            Why The Cash King?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#121212] border border-[#2a2a2a] p-6 hover:border-[#D4AF37]/50 transition-all shadow-xl group">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#1a1a1a] border border-[#333] rounded-lg group-hover:border-[#D4AF37]/50 transition-colors">
                  <Lock className="w-6 h-6 text-[#D4AF37] flex-shrink-0" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-100 mb-2">Cryptographically Verified</h3>
                  <p className="text-sm text-gray-400">
                    Every draw generates a SHA-256 proof hash. Verify authenticity anytime, anywhere.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="bg-[#121212] border border-[#2a2a2a] p-6 hover:border-[#D4AF37]/50 transition-all shadow-xl group">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#1a1a1a] border border-[#333] rounded-lg group-hover:border-[#D4AF37]/50 transition-colors">
                  <Zap className="w-6 h-6 text-[#D4AF37] flex-shrink-0" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-100 mb-2">CSPRNG Randomness</h3>
                  <p className="text-sm text-gray-400">
                    Cryptographically secure random values with zero modulo bias. Fair for everyone.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="bg-[#121212] border border-[#2a2a2a] p-6 hover:border-[#22c55e]/50 transition-all shadow-xl group">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#1a1a1a] border border-[#333] rounded-lg group-hover:border-[#22c55e]/50 transition-colors">
                  <Shield className="w-6 h-6 text-[#22c55e] flex-shrink-0" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-100 mb-2">Client-Side Only</h3>
                  <p className="text-sm text-gray-400">
                    All processing happens in your browser. No data leaves your device during draws.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Draw Modes Section */}
      <section className="py-20 border-b border-[#222222] bg-[#080808]">
        <div className="container">
          <h2 className="text-3xl font-black text-center mb-12 tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728]">
            Three Draw Modes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#121212] border border-[#2a2a2a] p-6 text-center hover:border-[#D4AF37]/50 transition-all">
              <div className="text-5xl mb-4 text-[#D4AF37]">♛</div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Classic Draw</h3>
              <p className="text-sm text-gray-400">Instant cryptographic selection with dramatic slot-machine reveal</p>
            </Card>

            <Card className="bg-[#121212] border border-[#2a2a2a] p-6 text-center hover:border-[#D4AF37]/50 transition-all">
              <div className="text-5xl mb-4 text-[#D4AF37]">◎</div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Spin Wheel</h3>
              <p className="text-sm text-gray-400">Animated spinning wheel with smooth deceleration</p>
            </Card>

            <Card className="bg-[#121212] border border-[#2a2a2a] p-6 text-center hover:border-[#D4AF37]/50 transition-all">
              <div className="text-5xl mb-4 text-[#D4AF37]">🏇</div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Horse Race</h3>
              <p className="text-sm text-gray-400">Live animated race with multiple competitors</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="py-20 bg-[#0c0c0c]">
        <div className="container">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b4d2e]/40 border border-[#2ecc71]/30 text-[#2ecc71] text-xs font-semibold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-[#2ecc71] animate-pulse"></span>Live &amp; Verified
            </div>
            <h2 className="text-3xl font-black tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728]">
              Gambling-Grade Compliance
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto bg-[#121212] border border-[#222] p-8 rounded-xl shadow-xl">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-[#2ecc71] flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-gray-200">CSPRNG Randomness</p>
                <p className="text-sm text-gray-400">Cryptographically secure random values</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-[#2ecc71] flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-gray-200">Zero Modulo Bias</p>
                <p className="text-sm text-gray-400">Rejection sampling ensures fairness</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-[#2ecc71] flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-gray-200">SHA-256 Verification</p>
                <p className="text-sm text-gray-400">Verifiable fingerprint of every draw</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-[#2ecc71] flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-gray-200">Audit Trust Trail</p>
                <p className="text-sm text-gray-400">Permanent record of all draws</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}