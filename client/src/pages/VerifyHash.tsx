import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Users,
  Trophy,
  Ticket,
  User,
  Hash,
  ShieldCheck,
  Key,
  Home,
  BarChart3,
  ExternalLink,
  Facebook,
  MessageSquare,
  FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface WinnerTicket {
  participantName?: string;
  Name?: string;
  username?: string;
  commentText?: string;
  ticketNumber?: string | number;
  Ticket?: string | number;
  [key: string]: unknown;
}

interface AuditRecord {
  draw_id: string;
  competition_title: string;
  prize_draw_link?: string | null;
  entry_count: number;
  total_max_tickets?: number | null;
  sold_tickets?: number | null;
  entry_hash: string;
  server_seed: string;
  winner_tickets: WinnerTicket[];
  timestamp: string;
  source_type?: "standard" | "facebook";
  post_url?: string | null;
  total_comments?: number | null;
  file_name?: string | null;
}

interface VerifyHashProps {
  onNavigateHome?: () => void;
}

export default function VerifyHash({ onNavigateHome }: VerifyHashProps) {
  const [proofHash, setProofHash] = useState("");
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "checking" | "verified" | "not-found"
  >("idle");
  const [auditData, setAuditData] = useState<AuditRecord | null>(null);

  const [winnerPage, setWinnerPage] = useState(1);
  const WINNERS_PER_PAGE = 10;

  const handleVerify = async () => {
    const targetHash = proofHash.trim();
    if (!targetHash) return;

    setVerificationStatus("checking");
    setAuditData(null);
    setWinnerPage(1);

    try {
      // 1. Check standard draws audit table
      const { data: standardData } = await supabase
        .from("draws_audit")
        .select(
          "draw_id, competition_title, prize_draw_link, entry_count, total_max_tickets, sold_tickets, entry_hash, server_seed, winner_tickets, timestamp"
        )
        .eq("proof_hash", targetHash)
        .maybeSingle();

      if (standardData) {
        setAuditData({
          draw_id: standardData.draw_id,
          competition_title: standardData.competition_title,
          prize_draw_link: standardData.prize_draw_link,
          entry_count: standardData.entry_count,
          total_max_tickets: standardData.total_max_tickets,
          sold_tickets: standardData.sold_tickets,
          entry_hash: standardData.entry_hash || "",
          server_seed: standardData.server_seed || "",
          winner_tickets: Array.isArray(standardData.winner_tickets)
            ? standardData.winner_tickets
            : [],
          timestamp: standardData.timestamp,
          source_type: "standard",
        });
        setVerificationStatus("verified");
        return;
      }

      // 2. Check Facebook draws audit table
        const { data: fbData } = await supabase
          .from("facebook_draws")
          .select(
            "id, competition_title, total_comments, winner_data, server_seed, proof_hash, created_at"
          )
          .eq("proof_hash", targetHash)
          .maybeSingle();

        if (fbData) {
          // Normalize winner_data into an array format for winner_tickets
          const parsedWinners = Array.isArray(fbData.winner_data)
            ? fbData.winner_data
            : fbData.winner_data
            ? [fbData.winner_data]
            : [];

          setAuditData({
            draw_id: fbData.id,
            competition_title: fbData.competition_title || "Facebook Giveaway Draw",
            prize_draw_link: null, // Not present in the new schema
            entry_count: fbData.total_comments || 0,
            total_comments: fbData.total_comments,
            file_name: null, // Not present in the new schema
            entry_hash: "", // Not present in the new schema
            server_seed: fbData.server_seed || "",
            winner_tickets: parsedWinners,
            timestamp: fbData.created_at,
            source_type: "facebook",
          });
          setVerificationStatus("verified");
          return;
        }

      setVerificationStatus("not-found");
    } catch (err) {
      console.error("Unexpected verification error:", err);
      setVerificationStatus("not-found");
    }
  };

  const handleHomeClick = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = "/";
    }
  };

  const totalWinnersCount = auditData?.winner_tickets.length || 0;
  const totalWinnerPages = Math.ceil(totalWinnersCount / WINNERS_PER_PAGE);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 selection:bg-[#D4AF37]/30 selection:text-amber-200">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-amber-500/10 bg-[#0C0F17]/80 backdrop-blur-md">
        <div className="container max-w-5xl py-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500">
              Verify Draw Proof
            </h1>
            <p className="mt-1 text-sm sm:text-base text-slate-400">
              Check the authenticity of standard or Facebook draws using their proof hash
            </p>
          </div>

          <Button
            onClick={handleHomeClick}
            variant="outline"
            className="border-amber-500/20 bg-[#121622] text-slate-300 hover:text-amber-300 hover:bg-[#1a2030] hover:border-amber-500/40 flex items-center gap-2 px-4 py-5 font-bold transition-all shrink-0 shadow-sm"
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Go Home</span>
          </Button>
        </div>
      </header>

      <main className="container max-w-5xl py-12">
        <div className="max-w-2xl mx-auto">
          {/* Verification Input Card */}
          <Card className="bg-[#0C0F17] border border-amber-500/20 shadow-xl shadow-black/40 rounded-xl p-6 sm:p-8 mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
            <h2 className="text-xl sm:text-2xl font-bold text-amber-400 mb-6 flex items-center gap-2">
              <Hash className="w-5 h-5 text-amber-400" /> Enter Proof Hash
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="hash" className="block text-sm font-medium text-slate-300 mb-2">
                  Proof Hash (SHA-256)
                </label>
                <Input
                  id="hash"
                  type="text"
                  placeholder="Paste the proof hash here..."
                  value={proofHash}
                  onChange={(e) => setProofHash(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  className="font-mono text-sm bg-[#121622] border-amber-500/20 text-amber-100 placeholder:text-slate-600 focus-visible:ring-amber-500/50 focus-visible:border-amber-400 h-12"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleVerify}
                  disabled={!proofHash.trim() || verificationStatus === "checking"}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-extrabold h-11 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  {verificationStatus === "checking" ? "Verifying..." : "Verify Hash"}
                </Button>
                <Button
                  onClick={() => setShowLearnMore(true)}
                  variant="outline"
                  className="flex-1 border-amber-500/20 bg-[#121622] text-slate-300 hover:bg-[#1a2030] hover:text-amber-300 hover:border-amber-500/40 h-11 font-semibold"
                >
                  <HelpCircle className="w-4 h-4 mr-2 text-amber-400" />
                  Learn More
                </Button>
              </div>
            </div>
          </Card>

          {/* Results Verification Details */}
          {verificationStatus === "verified" && auditData && (
            <div className="space-y-6 mb-8 animate-fadeIn">
              {/* Success Alert Header */}
              <Card className="bg-[#0C0F17] border border-amber-500/30 p-5 rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-yellow-600" />
                <div className="flex items-start gap-3.5 pl-2">
                  <div className="p-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mt-0.5">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-amber-300 text-base">Draw Verified Successfully</p>
                      {auditData.source_type === "facebook" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400">
                          <Facebook className="w-3 h-3" /> Facebook Draw
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                      This cryptographic fingerprint is authentic and matches the official stored immutable audit record.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Unpacked Audit Metrics Overview */}
              <Card className="bg-[#0C0F17] border border-amber-500/20 p-6 rounded-xl shadow-xl">
                <div className="border-b border-amber-500/10 pb-5 mb-5 flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <span className="text-xs font-bold text-amber-400/80 uppercase tracking-wider">
                      {auditData.source_type === "facebook" ? "Facebook Draw Title" : "Competition Title"}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <h3 className="text-xl font-bold text-slate-100">{auditData.competition_title}</h3>
                      {auditData.prize_draw_link && (
                        <a
                          href={auditData.prize_draw_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 transition-all ml-1"
                        >
                          {auditData.source_type === "facebook" ? "View Post" : "View Competition"}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">
                      Drawn on: {new Date(auditData.timestamp).toLocaleString()}
                    </p>
                  </div>

                  {auditData.draw_id && (
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1 sm:justify-end">
                        <Hash className="w-3 h-3 text-amber-400" /> Audit Draw ID
                      </span>
                      <p className="text-xs font-mono text-amber-300 mt-1 bg-[#121622] px-2.5 py-1.5 rounded border border-amber-500/20 inline-block sm:block">
                        {auditData.draw_id}
                      </p>
                    </div>
                  )}
                </div>

                {/* Core Field Capacity Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="p-3.5 bg-[#121622] rounded-lg border border-amber-500/10 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      {auditData.source_type === "facebook" ? "Eligible Entries" : "Field Entries"}
                    </span>
                    <p className="text-lg font-extrabold text-slate-100 mt-2">
                      {(auditData.entry_count ?? 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="p-3.5 bg-[#121622] rounded-lg border border-amber-500/10 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" /> Total Winners
                    </span>
                    <p className="text-lg font-extrabold text-slate-100 mt-2">{totalWinnersCount}</p>
                  </div>

                  {auditData.source_type === "facebook" ? (
                    <>
                      <div className="p-3.5 bg-[#121622] rounded-lg border border-amber-500/10 flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400" /> Scraped Comments
                        </span>
                        <p className="text-lg font-mono font-bold text-slate-200 mt-2">
                          {auditData.total_comments
                            ? Number(auditData.total_comments).toLocaleString()
                            : (auditData.entry_count ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3.5 bg-[#121622] rounded-lg border border-amber-500/10 flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-400" /> Source File
                        </span>
                        <p className="text-xs font-mono font-bold text-amber-400 mt-2 truncate" title={auditData.file_name || "TXT Export"}>
                          {auditData.file_name || "Facebook Export"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3.5 bg-[#121622] rounded-lg border border-amber-500/10 flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5 text-slate-400" /> Max Tickets
                        </span>
                        <p className="text-lg font-mono font-bold text-slate-200 mt-2">
                          {auditData.total_max_tickets ? Number(auditData.total_max_tickets).toLocaleString() : "—"}
                        </p>
                      </div>
                      <div className="p-3.5 bg-[#121622] rounded-lg border border-amber-500/10 flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-amber-400" /> Sold Tickets
                        </span>
                        <p className="text-lg font-mono font-extrabold text-amber-400 mt-2">
                          {auditData.sold_tickets
                            ? Number(auditData.sold_tickets).toLocaleString()
                            : Number(auditData.entry_count ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Cryptographic Blueprint Block */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 border-t border-b border-amber-500/10 py-5">
                  <div>
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                      <ShieldCheck className="w-4 h-4 text-amber-400" /> Entry List Hash Checksum
                    </span>
                    <code className="block p-3 bg-[#121622] rounded-lg text-xs text-amber-300 font-mono break-all max-h-20 overflow-y-auto border border-amber-500/20 select-all shadow-inner">
                      {auditData.entry_hash || "N/A"}
                    </code>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                      <Key className="w-4 h-4 text-emerald-400" /> Revealed Server Seed
                    </span>
                    <code className="block p-3 bg-[#121622] rounded-lg text-xs text-emerald-400 font-mono break-all max-h-20 overflow-y-auto border border-amber-500/20 select-all shadow-inner">
                      {auditData.server_seed || "N/A"}
                    </code>
                  </div>
                </div>

                {/* List of Dynamic Winners Found with Inline Pagination */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/10 pb-3">
                    <span className="text-xs font-bold text-amber-400/80 uppercase tracking-wider">
                      Official Audit Winners List
                    </span>

                    {totalWinnerPages > 1 && (
                      <div className="flex items-center gap-2 bg-[#121622] px-2.5 py-1.5 rounded-lg border border-amber-500/20 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setWinnerPage((p) => Math.max(1, p - 1))}
                          disabled={winnerPage === 1}
                          className="text-slate-400 hover:text-amber-300 disabled:opacity-30 transition-colors text-xs font-bold px-1.5"
                        >
                          &lt;
                        </button>
                        <span className="text-[11px] font-mono font-bold text-slate-300 min-w-[75px] text-center">
                          Page {winnerPage} / {totalWinnerPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWinnerPage((p) => Math.min(totalWinnerPages, p + 1))}
                          disabled={winnerPage === totalWinnerPages}
                          className="text-slate-400 hover:text-amber-300 disabled:opacity-30 transition-colors text-xs font-bold px-1.5"
                        >
                          &gt;
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                    {auditData.winner_tickets.length > 0 ? (
                      auditData.winner_tickets
                        .slice((winnerPage - 1) * WINNERS_PER_PAGE, winnerPage * WINNERS_PER_PAGE)
                        .map((winner, idx) => {
                          const globalIdx = (winnerPage - 1) * WINNERS_PER_PAGE + idx;
                          const winnerName =
                            winner.participantName || winner.Name || winner.username || "Anonymous Participant";
                          const ticketNo = winner.ticketNumber ?? winner.Ticket;

                          return (
                            <div
                              key={globalIdx}
                              className="flex flex-col p-3.5 bg-[#121622] border border-amber-500/10 hover:border-amber-500/30 transition-all rounded-lg text-sm shadow-sm gap-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                                  <span className="text-slate-500 text-xs font-mono font-semibold">
                                    #{globalIdx + 1}
                                  </span>
                                  <div className="p-1 rounded bg-amber-500/10 text-amber-400 shrink-0">
                                    <User className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="font-medium text-slate-200 truncate">
                                    {winnerName}
                                  </span>
                                </div>
                                {ticketNo !== undefined && (
                                  <div className="flex items-center gap-1.5 text-amber-400 font-mono shrink-0 font-bold bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                                    <Ticket className="w-3.5 h-3.5 text-amber-400" />
                                    <span>#{ticketNo}</span>
                                  </div>
                                )}
                              </div>

                              {winner.commentText && (
                                <p className="text-xs text-slate-400 pl-6 border-l-2 border-amber-500/20 italic truncate">
                                  "{winner.commentText}"
                                </p>
                              )}
                            </div>
                          );
                        })
                    ) : (
                      <p className="text-sm text-slate-400 italic col-span-2 py-4 text-center bg-[#121622] rounded-lg border border-amber-500/10">
                        No individual ticket details found inside this record log.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {verificationStatus === "not-found" && (
            <Card className="bg-[#0C0F17] border border-red-500/30 p-6 rounded-xl shadow-xl mb-8 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
              <div className="flex items-start gap-3.5 pl-2">
                <div className="p-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-red-400 text-base">Draw Not Found</p>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                    No matching record was found with this specific proof hash block across standard or Facebook draw logs. Double check your string characters or selection data bounds and try running the validation check again.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Information Cards */}
          <div className="space-y-6">
            <Card className="bg-[#0C0F17] border border-amber-500/20 p-6 rounded-xl shadow-xl">
              <h3 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" /> How Verification Works
              </h3>
              <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                Every draw generates a unique SHA-256 proof hash that serves as a cryptographic fingerprint. 
                This hash is stored in our audit trail and can be verified at any time to confirm the draw's authenticity.
              </p>
              <ul className="space-y-2.5 text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold bg-amber-500/10 p-0.5 rounded border border-amber-500/20">✓</span>
                  <span>Proof hashes are generated using cryptographically secure random values</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold bg-amber-500/10 p-0.5 rounded border border-amber-500/20">✓</span>
                  <span>Each draw is immutable once recorded in the audit trail</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-amber-400 font-bold bg-amber-500/10 p-0.5 rounded border border-amber-500/20">✓</span>
                  <span>Verification can be performed independently by anyone</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </main>

      {/* Learn More Modal */}
      <Dialog open={showLearnMore} onOpenChange={setShowLearnMore}>
        <DialogContent className="max-w-2xl bg-[#0C0F17] text-slate-100 border-amber-500/30 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-amber-400">
              Understanding Cryptographic Verification
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Learn how SHA-256 and CSPRNG work together to ensure fair draws
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <h3 className="text-base font-bold text-amber-300 mb-2">SHA-256: Cryptographic Hashing</h3>
              <p className="text-sm text-slate-400 mb-3 leading-relaxed">
                SHA-256 (Secure Hash Algorithm 256-bit) is a cryptographic function that converts any input data 
                into a unique, fixed-length 64-character hexadecimal string. Key properties:
              </p>
              <ul className="space-y-1.5 text-sm text-slate-400 ml-4 list-disc marker:text-amber-400">
                <li><strong className="text-slate-200">Deterministic:</strong> Same input always produces the same hash</li>
                <li><strong className="text-slate-200">One-way:</strong> Impossible to reverse-engineer the original data from the hash</li>
                <li><strong className="text-slate-200">Collision-resistant:</strong> Virtually impossible to find two inputs with the same hash</li>
                <li><strong className="text-slate-200">Avalanche effect:</strong> Tiny changes in input produce completely different hashes</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-bold text-amber-300 mb-2">CSPRNG: Cryptographically Secure Randomness</h3>
              <p className="text-sm text-slate-400 mb-3 leading-relaxed">
                CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) generates random values that are 
                mathematically unpredictable and suitable for cryptographic purposes.
              </p>
              <ul className="space-y-1.5 text-sm text-slate-400 ml-4 list-disc marker:text-amber-400">
                <li><strong className="text-slate-200">Unpredictable:</strong> Cannot be predicted even with knowledge of previous values</li>
                <li><strong className="text-slate-200">Unbiased:</strong> Uses rejection sampling to eliminate modulo bias</li>
                <li><strong className="text-slate-200">Hardware-backed:</strong> Uses system entropy sources for true randomness</li>
                <li><strong className="text-slate-200">Stateless:</strong> Each draw is independent and cannot be influenced</li>
              </ul>
            </div>

            <div>
              <h3 className="text-base font-bold text-amber-300 mb-2">How They Work Together</h3>
              <ol className="space-y-1.5 text-sm text-slate-400 ml-4 list-decimal marker:text-amber-400">
                <li>CSPRNG generates cryptographically secure random values for the draw</li>
                <li>The draw result and timestamp are combined into a data string</li>
                <li>SHA-256 hashes this data to create a unique proof hash</li>
                <li>The proof hash is stored in the audit trail</li>
                <li>Anyone can verify the draw by checking the proof hash against the audit record</li>
              </ol>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 shadow-sm">
              <p className="text-sm text-slate-200 leading-relaxed">
                <strong className="text-amber-400 font-semibold">Why This Matters:</strong> This combination ensures that draws are fair, transparent, and verifiable. 
                The CSPRNG guarantees randomness, while SHA-256 provides an immutable fingerprint that proves the draw 
                hasn't been tampered with.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}