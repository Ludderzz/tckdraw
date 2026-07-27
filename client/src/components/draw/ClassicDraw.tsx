import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { parseCSVChunked, validateCSVFormat, type CSVParseResult } from "@/utils/csvParser";
import { 
  deterministicShuffle, 
  generateServerSeed, 
  generateEntryHash, 
  generateProvableProofHash
} from "@/utils/crypto";
import { supabase } from "@/lib/supabase";
import { Upload, CheckCircle, AlertCircle, Loader2, Link2, Ticket, Settings, Eye } from "lucide-react";
import { Confetti, useConfetti } from "@/components/Confetti";

// ==========================================
// INDEXEDDB HIGH CAPACITY STORAGE ENGINE
// ==========================================
const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("KocDrawStorage", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("csv_data")) {
        db.createObjectStore("csv_data");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const setLargeItem = async (key: string, value: any): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction("csv_data", "readwrite");
    const store = tx.objectStore("csv_data");
    store.put(value, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB save failed:", err);
  }
};

const getLargeItem = async (key: string): Promise<any | null> => {
  try {
    const db = await getDB();
    const tx = db.transaction("csv_data", "readonly");
    const store = tx.objectStore("csv_data");
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(request.result || null);
      tx.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB fetch failed:", err);
    return null;
  }
};

const clearLargeDB = async (): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction("csv_data", "readwrite");
    tx.objectStore("csv_data").clear();
  } catch (err) {
    console.error("IndexedDB clear failed:", err);
  }
};

// Helper filter function to drop blank, dash-only, or invalid rows from data pools
const isValidEntry = (row: any) => {
  const ticket = String(row?.ticketNumber || "").trim();
  const name = String(row?.participantName || "").trim();
  
  if (!ticket || ticket === "-" || ticket === "—" || ticket === "undefined" || ticket === "null") return false;
  if (!name || name === "-" || name === "—" || name === "undefined" || name === "null") return false;
  
  return true;
};

interface ClassicDrawProps {
  onClose: () => void;
  onNavigateToVerify?: () => void;
  selectedCompetitionId?: string | null;
  selectedCompetitionTitle?: string | null;
}

export default function ClassicDraw({ 
  onClose, 
  onNavigateToVerify, 
  selectedCompetitionId = null, 
  selectedCompetitionTitle = null 
}: ClassicDrawProps) {
  // Primary visual states initialization - skip upload if selectedCompetitionId is provided
  const [step, setStep] = useState<"upload" | "configure" | "drawing" | "results">(
    selectedCompetitionId ? "configure" : "upload"
  );
  const [activeTab, setActiveTab] = useState<"settings" | "data-preview">("settings");
  const [csvData, setCSVData] = useState<CSVParseResult | null>(null);
  const [competitionTitle, setCompetitionTitle] = useState(selectedCompetitionTitle || "");
  const [prizeDrawLink, setPrizeDrawLink] = useState("");
  const [maxTickets, setMaxTickets] = useState<number | "">("");
  const [winnerCount, setWinnerCount] = useState(1);
  
  // New configuration options
  const [allowDupes, setAllowDupes] = useState<"no" | "yes">("no");
  const [revealMode, setRevealMode] = useState<"all" | "one-by-one">("all");
  const [revealedCount, setRevealedCount] = useState(1);

  const [winners, setWinners] = useState<any[]>([]);
  const [proofHash, setProofHash] = useState("");
  const [serverSeed, setServerSeed] = useState("");
  const [entryHash, setEntryHash] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(selectedCompetitionId ? true : false);

  // Logo explosion / shaking states for the drawing step
  const [isExploding, setIsExploding] = useState(false);

  // Reference for auto-scrolling to the latest revealed winner element
  const latestWinnerRef = useRef<HTMLDivElement>(null);

  const { showConfetti, trigger: triggerConfetti } = useConfetti();

  // If a selectedCompetitionId is passed in from imported entries, fetch rows from Supabase immediately
  useEffect(() => {
    const fetchSupabaseEntries = async () => {
      if (!selectedCompetitionId) return;

      setIsLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("competition_entries")
          .select("competition_id, competition_title, participant_name, ticket_number, created_at")
          .eq("competition_id", selectedCompetitionId);

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          const formattedEntries = data
            .map((row: any) => ({
              ticketNumber: String(row.ticket_number ?? ""),
              participantName: row.participant_name ?? "Anonymous",
            }))
            .filter(isValidEntry);

          const highestTicket = formattedEntries.reduce((max, entry) => {
            const ticketNum = parseInt(entry.ticketNumber, 10);
            return !isNaN(ticketNum) && ticketNum > max ? ticketNum : max;
          }, 0);

          if (highestTicket > 0) {
            setMaxTickets(highestTicket);
          }

          setCSVData({
            competitionId: selectedCompetitionId,
            competitionTitle: selectedCompetitionTitle || data[0].competition_title || "",
            totalEntries: formattedEntries.length,
            entries: formattedEntries,
          });

          if (selectedCompetitionTitle) {
            setCompetitionTitle(selectedCompetitionTitle);
          } else if (data[0].competition_title) {
            setCompetitionTitle(data[0].competition_title);
          }
          setStep("configure");
        } else {
          setError("No entry records found for this competition ID in Supabase.");
        }
      } catch (err: any) {
        console.error("Failed to load Supabase competition entries:", err);
        setError(err.message || "Failed to load competition entries from database.");
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedCompetitionId) {
      fetchSupabaseEntries();
    }
  }, [selectedCompetitionId, selectedCompetitionTitle]);

  // Hydrate all cached fields safely from IndexedDB on component mount if no selectedCompetitionId
  useEffect(() => {
    if (selectedCompetitionId) return;

    const hydrateState = async () => {
      try {
        const cachedStep = await getLargeItem("koc_classic_step");
        const cachedCsv = await getLargeItem("koc_classic_csv");
        const cachedTitle = await getLargeItem("koc_classic_title");
        const cachedLink = await getLargeItem("koc_classic_link");
        const cachedMax = await getLargeItem("koc_classic_max");
        const cachedWCount = await getLargeItem("koc_classic_wcount");
        const cachedDupes = await getLargeItem("koc_classic_dupes");
        const cachedReveal = await getLargeItem("koc_classic_reveal");
        const cachedWinners = await getLargeItem("koc_classic_winners");
        const cachedProof = await getLargeItem("koc_classic_proof");
        const cachedSeed = await getLargeItem("koc_classic_seed");
        const cachedEHash = await getLargeItem("koc_classic_ehash");

        if (cachedStep) setStep(cachedStep);
        if (cachedCsv) {
          // Filter out any lingering blank/dash entries from cached data
          cachedCsv.entries = (cachedCsv.entries || []).filter(isValidEntry);
          cachedCsv.totalEntries = cachedCsv.entries.length;
          setCSVData(cachedCsv);
        }
        if (cachedTitle) setCompetitionTitle(cachedTitle);
        if (cachedLink) setPrizeDrawLink(cachedLink);
        if (cachedMax) setMaxTickets(cachedMax === "" ? "" : Number(cachedMax));
        if (cachedWCount) setWinnerCount(Number(cachedWCount));
        if (cachedDupes) setAllowDupes(cachedDupes);
        if (cachedReveal) setRevealMode(cachedReveal);
        if (cachedWinners) setWinners(cachedWinners);
        if (cachedProof) setProofHash(cachedProof);
        if (cachedSeed) setServerSeed(cachedSeed);
        if (cachedEHash) setEntryHash(cachedEHash);
      } catch (err) {
        console.error("Failed to rehydrate fallback draw states:", err);
      } finally {
        setIsLoading(false);
      }
    };
    hydrateState();
  }, [selectedCompetitionId]);

  // Async storage sync pipeline
  useEffect(() => {
    if (isLoading) return;

    const syncStorage = async () => {
      await setLargeItem("koc_classic_step", step);
      await setLargeItem("koc_classic_title", competitionTitle);
      await setLargeItem("koc_classic_link", prizeDrawLink);
      await setLargeItem("koc_classic_max", maxTickets.toString());
      await setLargeItem("koc_classic_wcount", winnerCount.toString());
      await setLargeItem("koc_classic_dupes", allowDupes);
      await setLargeItem("koc_classic_reveal", revealMode);
      await setLargeItem("koc_classic_proof", proofHash);
      await setLargeItem("koc_classic_seed", serverSeed);
      await setLargeItem("koc_classic_ehash", entryHash);
      if (csvData) await setLargeItem("koc_classic_csv", csvData);
      if (winners.length > 0) await setLargeItem("koc_classic_winners", winners);
    };

    syncStorage();
  }, [step, csvData, competitionTitle, prizeDrawLink, maxTickets, winnerCount, allowDupes, revealMode, winners, proofHash, serverSeed, entryHash, isLoading]);

  // Auto-scroll and trigger confetti whenever revealedCount changes in one-by-one mode
  useEffect(() => {
    if (step === "results" && revealMode === "one-by-one") {
      if (latestWinnerRef.current) {
        latestWinnerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      triggerConfetti();
    }
  }, [revealedCount, step, revealMode, triggerConfetti]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateCSVFormat(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const data = await parseCSVChunked(file, setUploadProgress);
      
      // Filter out blank header or dash rows strictly upon ingestion
      const sanitizedEntries = (data.entries || []).filter(isValidEntry);
      const cleanData: CSVParseResult = {
        ...data,
        entries: sanitizedEntries,
        totalEntries: sanitizedEntries.length,
      };

      setCSVData(cleanData);
      
      if (cleanData.entries && cleanData.entries.length > 0) {
        const highestTicket = cleanData.entries.reduce((max, entry) => {
          const ticketNum = parseInt(entry.ticketNumber, 10);
          return !isNaN(ticketNum) && ticketNum > max ? ticketNum : max;
        }, 0);
        
        if (highestTicket > 0) {
          setMaxTickets(highestTicket);
        }
      }
      
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setCompetitionTitle(cleanFileName);
      setStep("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDraw = async () => {
    const activeCompetitionId = csvData?.competitionId || selectedCompetitionId || `comp_${Date.now()}`;

    if (!csvData || winnerCount <= 0) {
      setError("Invalid configuration");
      return;
    }

    if (!competitionTitle.trim()) {
      setError("Please specify a valid Competition Title before running the draw.");
      return;
    }

    // Ensure clean pool before draw selection
    const cleanEntries = (csvData.entries || []).filter(isValidEntry);
    if (cleanEntries.length === 0) {
      setError("No valid entries found to draw from after filtering out blank/dash records.");
      return;
    }

    setIsLoading(true);
    setStep("drawing");
    setIsExploding(false);
    setError("");

    try {
      const drawTimestamp = new Date().toISOString();
      const nonce = 1;

      const generatedEntryHash = await generateEntryHash(cleanEntries);
      const generatedSeed = generateServerSeed();

      const shuffled = deterministicShuffle(cleanEntries, generatedSeed);
      
      let drawnWinners = [];
      if (allowDupes === "yes") {
        drawnWinners = [];
        for (let i = 0; i < winnerCount; i++) {
          const targetIndex = (i * 73) % shuffled.length;
          drawnWinners.push(shuffled[targetIndex]);
        }
      } else {
        const uniqueMap = new Map();
        for (const entry of shuffled) {
          const key = entry.participantName?.toLowerCase().trim() || entry.ticketNumber;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, entry);
          }
          if (uniqueMap.size >= winnerCount) break;
        }
        drawnWinners = Array.from(uniqueMap.values()).slice(0, winnerCount);
      }

      const hash = await generateProvableProofHash({
        competitionId: activeCompetitionId,
        entryHash: generatedEntryHash,
        serverSeed: generatedSeed,
        nonce,
        drawTimestamp,
        winners: drawnWinners,
      });

      const { error: dbError } = await supabase
        .from("draws_audit")
        .insert([
          {
            draw_id: String(activeCompetitionId),
            competition_title: competitionTitle.trim(),
            entry_count: Number(cleanEntries.length),
            entry_hash: generatedEntryHash,
            server_seed: generatedSeed,
            nonce: nonce,
            winner_tickets: drawnWinners,
            proof_hash: hash,
            timestamp: drawTimestamp,
            prize_draw_link: prizeDrawLink.trim() || null,
            total_max_tickets: maxTickets !== "" ? Number(maxTickets) : null,
            sold_tickets: Number(cleanEntries.length)
          },
        ]);

      if (dbError) {
        throw new Error(`Database Audit Log Failure: ${dbError.message}`);
      }

      setWinners(drawnWinners);
      setProofHash(hash);
      setServerSeed(generatedSeed);
      setEntryHash(generatedEntryHash);
      setRevealedCount(revealMode === "one-by-one" ? 1 : drawnWinners.length);

      // Dramatic pause with shaking logo before triggering explosion & transition to results
      await new Promise((resolve) => setTimeout(resolve, 2200));
      setIsExploding(true);
      
      await new Promise((resolve) => setTimeout(resolve, 600)); // Explosion animation duration
      
      if (revealMode === "all") {
        triggerConfetti();
      }
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed");
      setStep("configure");
    } finally {
      setIsLoading(false);
      setIsExploding(false);
    }
  };

  const handleFinalClose = async () => {
    sessionStorage.clear();
    await clearLargeDB();
    onClose();
  };

  if (isLoading && step === "upload" && !csvData) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <Card className="p-6 bg-zinc-950 text-white flex flex-col items-center border border-zinc-800 rounded-xl">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-2" />
          <p className="text-xs text-zinc-400 font-mono">Restoring session parameters...</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <Card className="koc-card koc-gold-border w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-zinc-950 border-amber-400/40 text-white shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
            <h2 className="text-xl font-bold text-amber-400 tracking-wide">
              ♛ {competitionTitle || "Classic Live Draw"}
            </h2>
            <div className="flex items-center gap-3">
              {onNavigateToVerify && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-amber-400/30 text-amber-400 hover:bg-amber-400/10 font-semibold h-8 text-xs"
                  onClick={onNavigateToVerify}
                >
                  Verify Area ↗
                </Button>
              )}
              <button
                onClick={handleFinalClose}
                className="text-zinc-400 hover:text-white text-2xl font-light transition-colors leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3 mb-4 bg-red-500/10 rounded-lg border border-red-500 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          {/* Upload Step */}
          {step === "upload" && !selectedCompetitionId && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-zinc-800 rounded-xl p-12 text-center hover:border-amber-400/30 transition-colors">
                <Upload className="w-16 h-16 text-amber-400 mx-auto mb-4 animate-pulse" />
                <p className="text-xl font-bold text-zinc-200 mb-1">Upload CSV Target</p>
                <p className="text-sm text-zinc-500 mb-6">Supports up to 5,000,000 entrants</p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={isLoading}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Button
                    size="lg"
                    className="bg-amber-400 text-black font-black hover:bg-amber-500 px-8 py-6 text-base shadow-lg"
                    disabled={isLoading}
                    onClick={() => document.getElementById("csv-upload")?.click()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Select File"
                    )}
                  </Button>
                </label>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-6 max-w-md mx-auto">
                    <Progress value={uploadProgress} className="h-2 bg-zinc-800" />
                    <p className="text-xs text-zinc-400 mt-2 font-mono">{uploadProgress}% loaded</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Configure Step */}
          {step === "configure" && csvData && (
            <div className="space-y-5 py-2">
              <div className="flex border-b border-zinc-900 pb-px gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                    activeTab === "settings"
                      ? "border-amber-400 text-amber-400 bg-amber-400/5 rounded-t-lg"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Draw Parameters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("data-preview");
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                    activeTab === "data-preview"
                      ? "border-amber-400 text-amber-400 bg-amber-400/5 rounded-t-lg"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Data Records Preview ({csvData.totalEntries.toLocaleString()})
                </button>
              </div>

              {activeTab === "settings" ? (
                <div className="space-y-5 max-w-xl mx-auto">
                  <div>
                    <label htmlFor="comp-title" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Competition Title
                    </label>
                    <Input
                      id="comp-title"
                      type="text"
                      value={competitionTitle}
                      onChange={(e) => setCompetitionTitle(e.target.value)}
                      placeholder="Competition designation name..."
                      className="bg-zinc-900 border-zinc-800 text-white font-bold text-lg p-5 focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="prize-link" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-zinc-500" /> Prize Draw Link <span className="text-[10px] text-zinc-500 font-normal lowercase">(optional)</span>
                    </label>
                    <Input
                      id="prize-link"
                      type="url"
                      value={prizeDrawLink}
                      onChange={(e) => setPrizeDrawLink(e.target.value)}
                      placeholder="https://yourwebsite.com/competitions/..."
                      className="bg-zinc-900 border-zinc-800 text-white p-4 focus:border-amber-400 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="max-tickets" className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-zinc-500" /> Total Max Tickets
                      </label>
                      <Input
                        id="max-tickets"
                        type="number"
                        min="1"
                        value={maxTickets}
                        onChange={(e) => setMaxTickets(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value)))}
                        placeholder="Detected from file..."
                        className="bg-zinc-900 border-zinc-800 text-white h-[74px] focus:border-amber-400 font-bold text-xl text-center"
                      />
                    </div>

                    <Card className="p-3 bg-zinc-900 border-zinc-800 flex flex-col justify-center">
                      <p className="text-[11px] text-zinc-400 uppercase font-semibold tracking-wider">Sold Tickets (Ingested)</p>
                      <p className="text-xl font-black text-amber-400 mt-0.5">
                        {csvData.totalEntries.toLocaleString()}
                      </p>
                    </Card>
                  </div>

                  <div className="border-t border-zinc-900 my-2 pt-2">
                    <label htmlFor="winner-count" className="block text-xs text-zinc-400 uppercase font-semibold tracking-wider mb-2">
                      Number of Winners to Draw
                    </label>
                    <input
                      id="winner-count"
                      type="number"
                      min="1"
                      max={csvData.totalEntries}
                      value={winnerCount}
                      onChange={(e) => setWinnerCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded p-2.5 text-xl font-black text-white text-center focus:border-amber-400 outline-none"
                    />
                  </div>

                  <div className="border-t border-zinc-900 pt-3">
                    <label className="block text-xs text-zinc-400 uppercase font-semibold tracking-wider mb-2">
                      Allow Duplicate Winners? (Can same entrant win multiple times?)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAllowDupes("no")}
                        className={`py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider border transition-all ${
                          allowDupes === "no"
                            ? "bg-amber-400/10 border-amber-400 text-amber-400"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        No (Unique Winners)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllowDupes("yes")}
                        className={`py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider border transition-all ${
                          allowDupes === "yes"
                            ? "bg-amber-400/10 border-amber-400 text-amber-400"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Yes (Allow Dupes)
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-zinc-900 pt-3">
                    <label className="block text-xs text-zinc-400 uppercase font-semibold tracking-wider mb-2">
                      Winner Reveal Style
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRevealMode("all")}
                        className={`py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider border transition-all ${
                          revealMode === "all"
                            ? "bg-amber-400/10 border-amber-400 text-amber-400"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Show All Together
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevealMode("one-by-one")}
                        className={`py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-wider border transition-all ${
                          revealMode === "one-by-one"
                            ? "bg-amber-400/10 border-amber-400 text-amber-400"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        Show 1 by 1
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/20">
                    <div className="overflow-x-auto max-h-[42vh]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-zinc-900/80 text-zinc-400 font-mono uppercase text-[10px] tracking-wider border-b border-zinc-800 sticky top-0 backdrop-blur-sm z-10">
                            <th className="p-3 pl-4 w-16">Index</th>
                            <th className="p-3">Ticket Number</th>
                            <th className="p-3">Participant Name</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/60 font-mono">
                          {csvData?.entries
                            ?.filter(isValidEntry)
                            ?.slice((currentPage - 1) * 100, currentPage * 100)
                            .map((row: any, idx: number) => {
                              const globalIndex = (currentPage - 1) * 100 + idx + 1;
                              return (
                                <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                                  <td className="p-3 pl-4 text-zinc-600 font-bold">{globalIndex}</td>
                                  <td className="p-3 text-amber-400 font-black font-sans text-sm">#{row.ticketNumber}</td>
                                  <td className="p-3 text-zinc-200 font-sans font-medium">{row.participantName}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {csvData.totalEntries > 100 && (
                    <div className="flex items-center justify-between p-2 bg-zinc-900/60 rounded-xl border border-zinc-800 text-xs font-mono">
                      <span className="text-zinc-400 pl-2">
                        Showing {((currentPage - 1) * 100 + 1).toLocaleString()} - {Math.min(currentPage * 100, csvData.totalEntries).toLocaleString()} of {csvData.totalEntries.toLocaleString()} records
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                          className="h-8 text-zinc-400 hover:text-white disabled:opacity-30 px-2"
                        >
                          « First
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => prev - 1)}
                          className="h-8 border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 px-3"
                        >
                          ‹ Prev
                        </Button>
                        <span className="px-3 text-amber-400 font-bold">
                          {currentPage} / {Math.ceil(csvData.totalEntries / 100)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= Math.ceil(csvData.totalEntries / 100)}
                          onClick={() => setCurrentPage(prev => prev + 1)}
                          className="h-8 border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 px-3"
                        >
                          Next ›
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={currentPage >= Math.ceil(csvData.totalEntries / 100)}
                          onClick={() => setCurrentPage(Math.ceil(csvData.totalEntries / 100))}
                          className="h-8 text-zinc-400 hover:text-white disabled:opacity-30 px-2"
                        >
                          Last »
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t border-zinc-900 max-w-xl mx-auto">
                {!selectedCompetitionId && (
                  <Button
                    onClick={() => setStep("upload")}
                    variant="outline"
                    className="flex-1 border-zinc-800 text-zinc-400 hover:text-white py-5 text-base font-bold"
                  >
                    Back
                  </Button>
                )}
                <Button
                  onClick={handleDraw}
                  disabled={isLoading}
                  className="flex-1 bg-amber-400 text-black font-black text-lg hover:bg-amber-500 py-5 shadow-xl"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Drawing...
                    </>
                  ) : (
                    "Draw Winners"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Drawing Step with Shaking & Exploding Logo Animation */}
          {step === "drawing" && (
            <div className="flex flex-col items-center justify-center py-20 text-center min-h-[360px]">
              <style>{`
                @keyframes shake {
                  0% { transform: translate(1px, 1px) rotate(0deg); }
                  20% { transform: translate(-3px, 0px) rotate(-1deg); }
                  40% { transform: translate(1px, -1px) rotate(1deg); }
                  60% { transform: translate(-1px, 2px) rotate(0deg); }
                  80% { transform: translate(3px, 1px) rotate(1deg); }
                  100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
                @keyframes explode {
                  0% { transform: scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
                  50% { transform: scale(2.2) rotate(10deg); opacity: 0.8; filter: brightness(2); }
                  100% { transform: scale(4) rotate(25deg); opacity: 0; filter: brightness(3); }
                }
                .logo-shaking {
                  animation: shake 0.25s infinite;
                }
                .logo-exploding {
                  animation: explode 0.55s ease-out forwards;
                }
              `}</style>
              
              <div className="relative flex items-center justify-center">
                <img
                  src="tck-logo.png"
                  alt="TCK Logo"
                  className={`w-36 h-36 object-contain drop-shadow-[0_0_25px_rgba(251,191,36,0.5)] transition-all ${
                    isExploding ? "logo-exploding" : "logo-shaking"
                  }`}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>

              <p className="font-black text-xl text-amber-400 tracking-widest mt-8 uppercase">
                {isExploding ? "Revealing Winners!" : "Shuffling Entries..."}
              </p>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Running verifiable deterministic cryptographic pipeline...
              </p>
            </div>
          )}

          {/* Results Step */}
          {step === "results" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-bold">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <p>Draw execution completed and verified on-chain!</p>
              </div>

              <div className="space-y-2 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800">
                <div>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">
                    Public Proof Commitment Hash
                  </p>
                  <code className="block p-2 bg-zinc-950 border border-zinc-900 rounded text-[11px] text-amber-400 font-mono break-all select-all">
                    {proofHash}
                  </code>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">
                      Entry Hash
                    </p>
                    <code className="block p-1.5 bg-zinc-950 border border-zinc-900 rounded text-[10px] text-zinc-400 font-mono truncate select-all">
                      {entryHash}
                    </code>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">
                      Server Seed (Revealed)
                    </p>
                    <code className="block p-1.5 bg-zinc-950 border border-zinc-900 rounded text-[10px] text-emerald-500 font-mono truncate select-all">
                      {serverSeed}
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Winners List ({revealMode === "one-by-one" ? `${revealedCount} of ${winners.length}` : winners.length})
                  </p>
                  {revealMode === "one-by-one" && revealedCount < winners.length && (
                    <Button
                      size="sm"
                      onClick={() => setRevealedCount(prev => Math.min(winners.length, prev + 1))}
                      className="bg-amber-400 text-black hover:bg-amber-500 text-xs font-bold h-7 px-3"
                    >
                      Reveal Next Winner ➔
                    </Button>
                  )}
                </div>
                
                <div className="space-y-1.5 max-h-[26vh] overflow-y-auto pr-1.5">
                  {winners.slice(0, revealMode === "one-by-one" ? revealedCount : winners.length).map((winner, idx, arr) => {
                    const isLatest = revealMode === "one-by-one" && idx === arr.length - 1;
                    return (
                      <div 
                        key={idx} 
                        ref={isLatest ? latestWinnerRef : null}
                        className="flex justify-between items-center p-3 bg-zinc-900/80 border border-zinc-800/80 rounded-lg shadow-md transition-all hover:border-amber-400/60 animate-fadeIn"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono bg-zinc-950 text-zinc-400 w-6 h-6 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-base sm:text-lg font-black tracking-wide text-white truncate">
                            {winner.participantName}
                          </span>
                        </div>
                        <span className="text-xl sm:text-2xl font-black font-mono text-amber-400 tracking-wide pl-2 flex-shrink-0">
                          #{winner.ticketNumber}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleFinalClose}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold h-12 text-sm rounded-xl transition-colors mt-2"
              >
                Clear Screen & Close
              </Button>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}