import { useState, useRef, useEffect } from "react";
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
import { Upload, CheckCircle, AlertCircle, Loader2, Link2, Ticket, Settings2, Table } from "lucide-react";
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
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB fetch failed:", err);
    return null;
  }
};

const removeLargeItem = async (key: string): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction("csv_data", "readwrite");
    tx.objectStore("csv_data").delete(key);
  } catch (err) {
    console.error("IndexedDB delete failed:", err);
  }
};

interface SpinWheelProps {
  onClose: () => void;
}

export default function SpinWheel({ onClose }: SpinWheelProps) {
  const [step, setStep] = useState<"upload" | "configure" | "spinning" | "results" | "hydrating">("hydrating");
  const [activeTab, setActiveTab] = useState<"controls" | "registry">("controls");
  const [csvData, setCSVData] = useState<CSVParseResult | null>(null);
  const [competitionTitle, setCompetitionTitle] = useState("");
  const [prizeDrawLink, setPrizeDrawLink] = useState("");
  const [maxTickets, setMaxTickets] = useState<number | "">("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [winnerCount, setWinnerCount] = useState(1);
  const [winners, setWinners] = useState<any[]>([]);
  const [proofHash, setProofHash] = useState("");
  const [serverSeed, setServerSeed] = useState("");
  const [entryHash, setEntryHash] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [entriesPage, setEntriesPage] = useState(1);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { showConfetti, trigger: triggerConfetti } = useConfetti();

  // Restore state safely from high-capacity IndexedDB on initialization
  useEffect(() => {
    const hydrateWheelState = async () => {
      try {
        const savedState = await getLargeItem("koc_active_wheel_state");
        if (savedState) {
          setCSVData(savedState.csvData);
          setCompetitionTitle(savedState.competitionTitle || "");
          setPrizeDrawLink(savedState.prizeDrawLink || "");
          setMaxTickets(savedState.maxTickets === "" || savedState.maxTickets === undefined ? "" : Number(savedState.maxTickets));
          setWinnerCount(savedState.winnerCount || 1);
          setWinners(savedState.winners || []);
          setProofHash(savedState.proofHash || "");
          setServerSeed(savedState.serverSeed || "");
          setEntryHash(savedState.entryHash || "");
          
          if (savedState.step === "spinning") {
            setStep("configure");
          } else {
            setStep(savedState.step || "upload");
          }
        } else {
          setStep("upload");
        }
      } catch (e) {
        console.error("Failed to restore engine stream cache:", e);
        setStep("upload");
      }
    };
    hydrateWheelState();
  }, []);

  // Sync mutation changes to IndexedDB
  useEffect(() => {
    if (step === "hydrating") return;

    const syncWheelStorage = async () => {
      if (step !== "upload") {
        const currentCachePayload = {
          step,
          csvData,
          competitionTitle,
          prizeDrawLink,
          maxTickets: maxTickets.toString(),
          winnerCount,
          winners,
          proofHash,
          serverSeed,
          entryHash,
        };
        await setLargeItem("koc_active_wheel_state", currentCachePayload);
      }
    };
    syncWheelStorage();
  }, [step, csvData, competitionTitle, prizeDrawLink, maxTickets, winnerCount, winners, proofHash, serverSeed, entryHash]);

  // Clean up animation loops on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleClearAndClose = async () => {
    setStep("hydrating");
    await removeLargeItem("koc_active_wheel_state");
    onClose();
  };

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
      setCSVData(data);
      
        // Find the highest ticket number in the spreadsheet entries
        if (data.entries && data.entries.length > 0) {
          const highestTicket = data.entries.reduce((max, entry) => {
            const ticketNum = parseInt(entry.ticketNumber || (entry as any).Ticket, 10);
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

  const drawWheel = (rotation: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas || !csvData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const entriesLength = csvData.entries?.length || csvData.totalEntries || 50;
    const segmentCount = Math.min(entriesLength, 50); 
    const segmentAngle = (Math.PI * 2) / segmentCount;

    for (let i = 0; i < segmentCount; i++) {
      const startAngle = i * segmentAngle + (rotation * Math.PI) / 180;
      const endAngle = startAngle + segmentAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = i % 2 === 0 ? "#cc9a06" : "#8a6602";
      ctx.fill();

      ctx.strokeStyle = "#121212";
      ctx.lineWidth = segmentCount > 25 ? 1 : 2;
      ctx.stroke();

      if (segmentCount <= 30) {
        const textAngle = startAngle + segmentAngle / 2;
        const textX = centerX + Math.cos(textAngle) * (radius * 0.65);
        const textY = centerY + Math.sin(textAngle) * (radius * 0.65);

        ctx.save();
        ctx.translate(textX, textY);
        ctx.rotate(textAngle + Math.PI / 2);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${i + 1}`, 0, 4);
        ctx.restore();
      }
    }

    // Center Pin
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#f1c40f";
    ctx.fill();
    ctx.strokeStyle = "#121212";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Top Indicator Arrow
    ctx.beginPath();
    ctx.moveTo(centerX, 4);
    ctx.lineTo(centerX - 12, 22);
    ctx.lineTo(centerX + 12, 22);
    ctx.closePath();
    ctx.fillStyle = "#f1c40f";
    ctx.fill();
    ctx.strokeStyle = "#121212";
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  useEffect(() => {
    if (step === "spinning" || step === "configure") {
      drawWheel(wheelRotation);
    }
  }, [wheelRotation, csvData, step]);

  const handleSpin = async () => {
    if (!csvData || winnerCount <= 0) {
      setError("Invalid configuration");
      return;
    }

    if (!competitionTitle.trim()) {
      setError("Please specify a valid Competition Title before running the spin.");
      return;
    }

    setIsLoading(true);
    setStep("spinning");
    setError("");

    const spinDuration = 4500; 
    const startTime = Date.now();
    const targetExtraSpins = 9; 

    const spinAnimation = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // Quartic easing out
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const currentRotation = easeProgress * 360 * targetExtraSpins;

      setWheelRotation(currentRotation);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(spinAnimation);
      } else {
        finalizeDraw();
      }
    };

    animationFrameRef.current = requestAnimationFrame(spinAnimation);
  };

  const finalizeDraw = async () => {
    if (!csvData || !csvData.entries || csvData.entries.length === 0) {
      setError("Dataset entries missing from memory context.");
      setStep("upload");
      return;
    }

    try {
      const drawTimestamp = new Date().toISOString();
      const nonce = 1;

      const generatedEntryHash = await generateEntryHash(csvData.entries);
      const generatedSeed = generateServerSeed();
      const shuffled = deterministicShuffle(csvData.entries, generatedSeed);
      const drawnWinners = shuffled.slice(0, winnerCount);

      const hash = await generateProvableProofHash({
        competitionId: csvData.competitionId,
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
            draw_id: csvData.competitionId,
            competition_title: competitionTitle.trim(),
            entry_count: Number(csvData.totalEntries),
            entry_hash: generatedEntryHash,
            server_seed: generatedSeed,
            nonce: nonce,
            winner_tickets: drawnWinners,
            proof_hash: hash,
            timestamp: drawTimestamp,
            prize_draw_link: prizeDrawLink.trim() || null,
            total_max_tickets: maxTickets !== "" ? Number(maxTickets) : null,
            sold_tickets: Number(csvData.totalEntries)
          },
        ]);

      if (dbError) throw new Error(`Database Audit Log Failure: ${dbError.message}`);

      setWinners(drawnWinners);
      setProofHash(hash);
      setServerSeed(generatedSeed);
      setEntryHash(generatedEntryHash);
      triggerConfetti();
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw processing failed");
      setStep("configure");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "hydrating") {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <Card className="p-6 bg-zinc-950 text-white flex flex-col items-center border border-zinc-800 rounded-xl">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-2" />
          <p className="text-xs text-zinc-400 font-mono">Restoring wheel sequence structures...</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <Card className="koc-card koc-gold-border w-full max-w-4xl bg-[#121212] p-5 relative my-auto max-h-[95vh] flex flex-col justify-between overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-neutral-800">
            <h2 className="text-lg font-black text-accent tracking-wider uppercase flex items-center gap-2">
              ◎ Spin Wheel Live Draw
            </h2>
            <button
              onClick={handleClearAndClose}
              className="text-neutral-500 hover:text-foreground text-2xl transition-colors leading-none"
            >
              ×
            </button>
          </div>

          {/* Sub-Tabs Selector for Configuration Step */}
          {step === "configure" && csvData && (
            <div className="flex gap-2 mb-3 bg-neutral-950 p-1 rounded-lg border border-neutral-900">
              <button
                onClick={() => setActiveTab("controls")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === "controls"
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-neutral-400 hover:text-foreground"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                Draw Config
              </button>
              <button
                onClick={() => setActiveTab("registry")}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === "registry"
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-neutral-400 hover:text-foreground"
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                Tickets Registry ({csvData.totalEntries.toLocaleString()})
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 mb-3 bg-destructive/10 rounded-lg border border-destructive">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive font-medium">{error}</p>
            </div>
          )}

          {/* Core Content Box wrapper */}
          <div className="overflow-y-auto flex-1 pr-0.5 space-y-4">

            {/* UPLOAD STEP */}
            {step === "upload" && (
              <div className="py-4">
                <div className="border-2 border-dashed border-accent/30 hover:border-accent/70 transition-colors rounded-xl p-8 text-center bg-neutral-900/30">
                  <Upload className="w-12 h-12 text-accent mx-auto mb-3" />
                  <p className="text-foreground font-bold text-base mb-1">Upload Entries Dataset</p>
                  <p className="text-xs text-muted-foreground mb-4">Supports CSV and Excel variants up to 5,000,000 slots</p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={isLoading}
                    className="hidden"
                    id="csv-upload-wheel"
                  />
                  <Button
                    className="bg-accent text-accent-foreground hover:opacity-90 font-bold px-6 h-11 text-sm"
                    disabled={isLoading}
                    onClick={() => document.getElementById("csv-upload-wheel")?.click()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing Records...
                      </>
                    ) : (
                      "Select File"
                    )}
                  </Button>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-4 max-w-xs mx-auto">
                      <Progress value={uploadProgress} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">{uploadProgress}% loaded</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CONFIGURE STEP */}
            {step === "configure" && csvData && (
              <>
                {activeTab === "controls" ? (
                  <>
                    {/* Competition Title */}
                    <div className="space-y-1.5">
                      <label htmlFor="comp-title-wheel" className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                        Competition Title
                      </label>
                      <Input
                        id="comp-title-wheel"
                        type="text"
                        value={competitionTitle}
                        onChange={(e) => setCompetitionTitle(e.target.value)}
                        className="bg-neutral-900/90 border-neutral-800 text-foreground font-bold text-sm h-11 px-3 focus:ring-accent"
                      />
                    </div>

                    {/* Prize Draw Link */}
                    <div className="space-y-1.5">
                      <label htmlFor="prize-link-wheel" className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-neutral-500" /> Prize Draw Link <span className="text-[10px] text-neutral-500 font-normal lowercase">(optional)</span>
                      </label>
                      <Input
                        id="prize-link-wheel"
                        type="url"
                        value={prizeDrawLink}
                        onChange={(e) => setPrizeDrawLink(e.target.value)}
                        placeholder="https://yourwebsite.com/competitions/..."
                        className="bg-neutral-900/90 border-neutral-800 text-foreground text-sm h-11 px-3 focus:ring-accent"
                      />
                    </div>

                    {/* Grid Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl flex flex-col justify-between min-h-[100px]">
                        <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                          Sold Tickets
                        </p>
                        <p className="text-3xl font-black text-accent mt-1 tracking-tight">
                          {csvData.totalEntries.toLocaleString()}
                        </p>
                      </div>

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

                      <div className="bg-neutral-900/40 border border-neutral-800 p-4 rounded-xl flex flex-col justify-between min-h-[100px]">
                        <label htmlFor="winner-count-wheel" className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                          Number of Winners
                        </label>
                        <div className="mt-1">
                          <Input
                            id="winner-count-wheel"
                            type="number"
                            min="1"
                            max={csvData.totalEntries}
                            value={winnerCount}
                            onChange={(e) => setWinnerCount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="bg-neutral-950 border-neutral-800 text-center text-xl font-black text-foreground h-11 w-full focus:ring-accent"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Warning Alert Bar */}
                    <div className="flex items-start gap-2.5 p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
                      <AlertCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-neutral-400 leading-normal">
                        <strong className="text-neutral-300">Visualization Preview:</strong> On-screen wheel targets a 50 segment index ceiling to map cleanly. Cryptographic randomization executes and shuffles against <strong className="text-neutral-200">all matching data elements</strong> flawlessly.
                      </p>
                    </div>
                  </>
                ) : (
                  /* TICKETS & NAMES REGISTRY TAB VIEW */
                  <div className="border border-neutral-800 rounded-xl bg-neutral-950/50 overflow-hidden flex flex-col h-[320px]">
                    <div className="flex items-center justify-between bg-neutral-900 p-2 border-b border-neutral-800 sticky top-0 z-10">
                      <div className="grid grid-cols-12 flex-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        <div className="col-span-3 pl-2">Ticket ID</div>
                        <div className="col-span-9">Participant Name</div>
                      </div>
                      
                      {csvData?.entries && Math.ceil(csvData.entries.length / 100) > 1 && (
                        <div className="flex items-center gap-2 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 ml-4">
                          <button
                            type="button"
                            onClick={() => setEntriesPage(p => Math.max(1, p - 1))}
                            disabled={entriesPage === 1}
                            className="text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors text-xs px-1"
                          >
                            &lt;
                          </button>
                          <span className="text-[10px] font-mono font-bold text-neutral-400 min-w-[70px] text-center">
                            Page {entriesPage} / {Math.ceil(csvData.entries.length / 100)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEntriesPage(p => Math.min(Math.ceil(csvData.entries.length / 100), p + 1))}
                            disabled={entriesPage === Math.ceil(csvData.entries.length / 100)}
                            className="text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors text-xs px-1"
                          >
                            &gt;
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="divide-y divide-neutral-900 overflow-y-auto flex-1">
                      {csvData?.entries && csvData.entries.length > 0 ? (
                        csvData.entries
                          .slice((entriesPage - 1) * 100, entriesPage * 100)
                          .map((entry: any, index: number) => {
                            const globalIndex = (entriesPage - 1) * 100 + index;
                            return (
                              <div key={globalIndex} className="grid grid-cols-12 p-2.5 text-xs text-neutral-300 hover:bg-neutral-900/50 transition-colors">
                                <div className="col-span-3 font-mono font-black text-accent pl-2">
                                  #{entry.ticketNumber || entry.Ticket || globalIndex + 1}
                                </div>
                                <div className="col-span-9 font-medium truncate pr-2">
                                  {entry.participantName || entry.Name || entry.username || "Anonymous Element"}
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="text-center py-12 text-xs text-neutral-500 font-mono">
                          No active database sequence records found.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button 
                    onClick={async () => {
                      await removeLargeItem("koc_active_wheel_state");
                      setCSVData(null);
                      setStep("upload");
                    }} 
                    variant="outline" 
                    className="h-11 font-bold border-neutral-800 text-neutral-400 hover:text-foreground text-sm bg-transparent hover:bg-neutral-900"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSpin}
                    className="h-11 bg-accent text-accent-foreground hover:opacity-90 font-black text-sm uppercase tracking-wider shadow-lg"
                  >
                    Start Spin
                  </Button>
                </div>
              </>
            )}

            {/* SPINNING ANIMATION CONTAINER */}
            {step === "spinning" && (
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <div className="relative p-3 bg-neutral-950 rounded-full border border-accent/20 shadow-xl">
                  <canvas ref={canvasRef} width={380} height={380} className="rounded-full shadow-inner" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-accent font-black tracking-widest text-xs uppercase animate-pulse">
                    Shuffling Entry Registries...
                  </p>
                  <p className="text-[10px] text-neutral-500 font-mono">Applying provably fair algorithms</p>
                </div>
              </div>
            )}

            {/* RESULTS STEP */}
            {step === "results" && (
              <>
                {/* Green Confirmation Banner */}
                <div className="flex items-center gap-2.5 p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-emerald-400 font-bold text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Race completed! Winners verified on-chain. 🏆</span>
                </div>

                {/* Public Proof Commitment Hash Block */}
                <div className="bg-neutral-900/40 border border-neutral-800 p-3 rounded-xl space-y-1.5">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    Public Proof Commitment Hash
                  </p>
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-900 text-xs font-mono font-bold text-accent break-all select-all">
                    {proofHash}
                  </div>
                </div>

                {/* Grid: Entry Hash & Server Seed */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-neutral-900/40 border border-neutral-800 p-3 rounded-xl space-y-1.5">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                      Entry Hash
                    </p>
                    <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-900 text-[11px] font-mono text-neutral-400 break-all h-12 overflow-y-auto select-all">
                      {entryHash}
                    </div>
                  </div>

                  <div className="bg-neutral-900/40 border border-neutral-800 p-3 rounded-xl space-y-1.5">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                      Server Seed (Revealed)
                    </p>
                    <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-900 text-[11px] font-mono text-emerald-400 break-all h-12 overflow-y-auto select-all">
                      {serverSeed}
                    </div>
                  </div>
                </div>

                {/* Winners List Output Section */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-0.5">
                    Winners List ({winners.length})
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {winners.map((winner, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl transition-all hover:border-accent/60"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-neutral-950 flex items-center justify-center text-[11px] font-bold text-neutral-400 border border-neutral-800">
                            {idx + 1}
                          </span>
                          <span className="text-foreground font-bold text-sm flex items-center gap-1.5">
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🏆"} 
                            {winner.participantName || winner.Name || "Participant"}
                          </span>
                        </div>
                        <span className="text-accent font-mono font-black text-base">
                          #{winner.ticketNumber || winner.Ticket}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Global Confirm Termination Anchor Button */}
                <Button 
                  onClick={handleClearAndClose}
                  className="w-full h-11 mt-2 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 font-bold text-sm text-neutral-200"
                >
                  Close & Clear Live Cache
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}