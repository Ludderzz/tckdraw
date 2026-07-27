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
import { Upload, CheckCircle, AlertCircle, Loader2, Link2, Ticket, ChevronLeft, ChevronRight, Trophy, Flame, Play } from "lucide-react";
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

const removeLargeItem = async (key: string): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction("csv_data", "readwrite");
    tx.objectStore("csv_data").delete(key);
  } catch (err) {
    console.error("IndexedDB delete failed:", err);
  }
};

interface HorseRaceProps {
  onClose: () => void;
}

interface Runner {
  id: number;
  name: string;
  ticket: string;
  color: string;
  lane: number;
  x: number;
  speed: number;
  targetSpeed: number;
  stamina: number;
  finished: boolean;
  finishTime: number;
}

export default function HorseRace({ onClose }: HorseRaceProps) {
  const [step, setStep] = useState<"upload" | "configure" | "racing" | "results">("upload");
  const [csvData, setCSVData] = useState<CSVParseResult | null>(null);
  const [competitionTitle, setCompetitionTitle] = useState("");
  const [prizeDrawLink, setPrizeDrawLink] = useState("");
  const [maxTickets, setMaxTickets] = useState<number | "">("");
  const [winnerCount, setWinnerCount] = useState<number | "">(1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [winners, setWinners] = useState<any[]>([]);
  const [proofHash, setProofHash] = useState("");
  const [serverSeed, setServerSeed] = useState("");
  const [entryHash, setEntryHash] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true); 

  // Canvas / Animation states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [liveLeaderboard, setLiveLeaderboard] = useState<Runner[]>([]);
  const [raceCommentary, setRaceCommentary] = useState("The horses are being led up to the starting stalls...");

  // Results interface navigation states
  const [activeTab, setActiveTab] = useState<"all" | "top3">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPage, setEntriesPage] = useState(1);
  const itemsPerPage = 50;

  const { showConfetti, trigger: triggerConfetti } = useConfetti();

  // Hydrate application state from high-capacity storage on mount
  useEffect(() => {
    const hydrateRaceState = async () => {
      try {
        const savedState = await getLargeItem("koc_active_race_state");
        if (savedState) {
          if (savedState.step === "racing") {
            setStep("configure");
          } else {
            setStep(savedState.step);
          }
          
          setCSVData(savedState.csvData);
          setCompetitionTitle(savedState.competitionTitle);
          setPrizeDrawLink(savedState.prizeDrawLink || "");
          setMaxTickets(savedState.maxTickets === "" || savedState.maxTickets === undefined ? "" : Number(savedState.maxTickets));
          setWinnerCount(savedState.winnerCount === "" || savedState.winnerCount === undefined ? 1 : Number(savedState.winnerCount));
          setWinners(savedState.winners);
          setProofHash(savedState.proofHash);
          setServerSeed(savedState.serverSeed);
          setEntryHash(savedState.entryHash);
        }
      } catch (e) {
        console.error("Failed to restore live draw race cache state:", e);
      } finally {
        setIsLoading(false);
      }
    };
    hydrateRaceState();
  }, []);

  // Track and write parameters asynchronously down to IndexedDB
  useEffect(() => {
    if (isLoading) return;

    const syncRaceStorage = async () => {
      if (step !== "upload") {
        const currentCachePayload = {
          step,
          csvData,
          competitionTitle,
          prizeDrawLink,
          maxTickets: maxTickets.toString(),
          winnerCount: winnerCount.toString(),
          winners,
          proofHash,
          serverSeed,
          entryHash,
        };
        await setLargeItem("koc_active_race_state", currentCachePayload);
      }
    };
    syncRaceStorage();
  }, [step, csvData, competitionTitle, prizeDrawLink, maxTickets, winnerCount, winners, proofHash, serverSeed, entryHash, isLoading]);

  const handleClearAndClose = async () => {
    setIsLoading(true);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    await removeLargeItem("koc_active_race_state");
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
      
      if (data.entries && data.entries.length > 0) {
        const highestTicket = data.entries.reduce((max, entry) => {
          const ticketNum = parseInt(entry.ticketNumber, 10);
          return !isNaN(ticketNum) && ticketNum > max ? ticketNum : max;
        }, 0);
        
        if (highestTicket > 0) {
          setMaxTickets(highestTicket);
        }
      }
      
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setCompetitionTitle(cleanFileName);
      setEntriesPage(1);
      
      setStep("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleRace = async () => {
    const parsedWinnerCount = winnerCount === "" ? 1 : winnerCount;

    if (!csvData || parsedWinnerCount <= 0) {
      setError("Invalid configuration");
      return;
    }

    if (!competitionTitle.trim()) {
      setError("Please specify a valid Competition Title before running the race.");
      return;
    }

    setIsLoading(true);
    setStep("racing");
    setError("");

    try {
      const drawTimestamp = new Date().toISOString();
      const nonce = 1;

      const generatedEntryHash = await generateEntryHash(csvData.entries);
      const generatedSeed = generateServerSeed();

      const shuffled = deterministicShuffle(csvData.entries, generatedSeed);
      const drawnWinners = shuffled.slice(0, parsedWinnerCount);

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

      // Now initiate the realistic canvas horse race simulation (slower pace for cinematic suspense)
      startCanvasSimulation(shuffled, drawnWinners);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw processing execution failed");
      setStep("configure");
      setIsLoading(false);
    }
  };

  const startCanvasSimulation = (shuffledEntries: any[], drawnWinners: any[]) => {
    setIsLoading(false);
    
    // Choose top 10 runners for the visual track
    const activeRunnerCount = Math.min(10, shuffledEntries.length);
    const selectedRunners = shuffledEntries.slice(0, activeRunnerCount);

    // Make sure all official winners are guaranteed a slot in the visible pack
    drawnWinners.slice(0, activeRunnerCount).forEach((winner, idx) => {
      if (!selectedRunners.some(r => r.ticketNumber === winner.ticketNumber)) {
        selectedRunners[idx] = winner;
      }
    });

    const silkColors = [
      "#f59e0b", "#3b82f6", "#ef4444", "#10b981", "#8b5cf6", 
      "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"
    ];

    const runners: Runner[] = selectedRunners.map((entry, index) => ({
      id: index,
      name: entry.participantName || `Runner #${index + 1}`,
      ticket: entry.ticketNumber,
      color: silkColors[index % silkColors.length],
      lane: index,
      x: 30, // Starting gate coordinate
      speed: 0,
      targetSpeed: 0.8 + Math.random() * 0.5, // Slower base speeds for long, watchable race
      stamina: 100,
      finished: false,
      finishTime: 0
    }));

    // Map winners' tickets to verify strict race ordering based on the provable shuffle result
    const winnerTicketSet = new Set(drawnWinners.map(w => w.ticketNumber));
    const winnerOrder = drawnWinners.map(w => w.ticketNumber);

    let startTime = performance.now();
    let animFrame: number;

    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // --- UPDATE PHYSICS ---
      const trackLength = width - 140; // Finish line position

      runners.forEach((r) => {
        if (r.finished) return;

        // Controlled subtle speed changes
        if (Math.random() < 0.02) {
          r.targetSpeed = 0.6 + Math.random() * 0.9;
        }

        // If this runner is among the official winners, give them a subtle edge down the home stretch
        const isWinner = winnerTicketSet.has(r.ticket);
        if (isWinner) {
          const winnerRank = winnerOrder.indexOf(r.ticket);
          if (r.x > trackLength * 0.65) {
            r.targetSpeed = Math.max(r.targetSpeed, 1.1 - (winnerRank * 0.03));
          }
        }

        r.speed += (r.targetSpeed - r.speed) * 0.05;
        r.x += r.speed;

        if (r.x >= trackLength) {
          r.x = trackLength;
          r.finished = true;
          r.finishTime = now;
        }
      });

      // Sort live leaderboard by current track distance (x)
      const sortedLeaderboard = [...runners].sort((a, b) => b.x - a.x);
      setLiveLeaderboard(sortedLeaderboard);

      // Commentary updates
      const leader = sortedLeaderboard[0];
      if (runners.every(r => r.finished)) {
        setRaceCommentary(`What a finish! Winner crosses the line: ${leader.name} (#${leader.ticket})!`);
      } else if (leader.x > trackLength * 0.75) {
        setRaceCommentary(`Into the final stretch! ${leader.name} leads with the crowd roaring!`);
      } else if (leader.x > trackLength * 0.4) {
        setRaceCommentary(`Approaching the half-way mark, ${leader.name} holds a steady lead.`);
      } else {
        setRaceCommentary("And they're off! The field settles into a measured gallop down the back straight.");
      }

      // --- DRAW GRAPHICS (STUNNING RACECOURSE THEME) ---
      ctx.clearRect(0, 0, width, height);

      // 1. Turf Background
      const turfGrad = ctx.createLinearGradient(0, 0, 0, height);
      turfGrad.addColorStop(0, "#06220f");
      turfGrad.addColorStop(0.5, "#0b3819");
      turfGrad.addColorStop(1, "#04190a");
      ctx.fillStyle = turfGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Grandstand / Background skyline silhouettes (top area)
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(0, 0, width, 35);
      ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
      ctx.font = "bold 11px monospace";
      ctx.fillText("GRANDSTAND & VIP ENCLOSURE", 20, 22);

      // 3. Draw Lanes
      const laneHeight = (height - 50) / runners.length;
      const startY = 45;

      runners.forEach((r, idx) => {
        const ly = startY + idx * laneHeight;
        
        // Lane striping
        ctx.fillStyle = idx % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.15)";
        ctx.fillRect(0, ly, width, laneHeight);

        // White lane divider lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, ly + laneHeight);
        ctx.lineTo(width, ly + laneHeight);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 4. Finish Line Checkerboard Pillar
      ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
      ctx.fillRect(trackLength, startY, 12, height - startY - 10);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(trackLength + 6, startY);
      ctx.lineTo(trackLength + 6, height - 10);
      ctx.stroke();
      ctx.setLineDash([]);

      // Finish Line Banner Text
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 10px monospace";
      ctx.fillText("FINISH", trackLength - 12, startY - 6);

      // 5. Draw Horses & Jockeys (Stylized animated sprites)
      const bounceTimer = now * 0.008; // Slower gallop cadence matching the slower speed

      runners.forEach((r, idx) => {
        const ly = startY + idx * laneHeight;
        const horseY = ly + laneHeight / 2 + Math.sin(bounceTimer + idx) * 2;
        const horseX = r.x;

        // Horse Shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(horseX + 15, horseY + 12, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Horse Body
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.roundRect(horseX, horseY - 4, 32, 14, 6);
        ctx.fill();

        // Horse Head & Neck
        ctx.beginPath();
        ctx.moveTo(horseX + 26, horseY);
        ctx.lineTo(horseX + 40, horseY - 10);
        ctx.lineTo(horseX + 36, horseY - 4);
        ctx.closePath();
        ctx.fill();

        // Jockey Silk Body & Helmet
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(horseX + 10, horseY - 12, 10, 9);
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(horseX + 15, horseY - 14, 4, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        const legCycle = Math.sin(bounceTimer * 2 + idx * 1.5) * 6;
        
        ctx.beginPath();
        ctx.moveTo(horseX + 26, horseY + 10);
        ctx.lineTo(horseX + 28 + legCycle, horseY + 20);
        ctx.moveTo(horseX + 22, horseY + 10);
        ctx.lineTo(horseX + 20 - legCycle, horseY + 20);
        ctx.moveTo(horseX + 8, horseY + 10);
        ctx.lineTo(horseX + 6 + legCycle, horseY + 20);
        ctx.moveTo(horseX + 4, horseY + 10);
        ctx.lineTo(horseX + 2 - legCycle, horseY + 20);
        ctx.stroke();

        // Floating Entrant Tag Pill above horse
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(horseX - 8, horseY - 32, 58, 16, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.fillText(`#${r.ticket}`, horseX - 4, horseY - 20);
      });

      if (runners.every(r => r.finished)) {
        setTimeout(() => {
          triggerConfetti();
          setStep("results");
        }, 1500);
        return;
      }

      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);
    animFrameRef.current = animFrame;
  };

  const filteredWinners = activeTab === "top3" ? winners.slice(0, 3) : winners;
  const totalPages = Math.ceil(filteredWinners.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedWinners = filteredWinners.slice(startIndex, startIndex + itemsPerPage);

  const totalEntriesPages = csvData ? Math.ceil(csvData.entries.length / itemsPerPage) : 0;
  const entriesStartIndex = (entriesPage - 1) * itemsPerPage;
  const paginatedEntries = csvData ? csvData.entries.slice(entriesStartIndex, entriesStartIndex + itemsPerPage) : [];

  if (isLoading && step === "upload" && !csvData) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
        <Card className="p-8 bg-zinc-950 text-white flex flex-col items-center border border-amber-500/30 rounded-2xl shadow-2xl">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-3" />
          <p className="text-sm text-zinc-400 font-mono tracking-wider">Restoring active turf parameters...</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
        <div className="relative w-full max-w-5xl my-auto">
          <Card className="relative overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 border border-amber-500/40 text-white shadow-[0_0_60px_rgba(245,158,11,0.2)] rounded-2xl p-6 sm:p-8">
            
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-6 border-b border-zinc-800/80 pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black">
                  <span className="text-xl">🐎</span>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 tracking-wide uppercase">
                    Derby Turf Live Draw
                  </h2>
                  <p className="text-xs text-zinc-400 font-medium">Provably fair competitive randomized racetrack</p>
                </div>
              </div>
              <button
                onClick={handleClearAndClose}
                className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all font-light text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 mb-6 bg-red-500/10 rounded-xl border border-red-500/30 text-red-400 relative z-10">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {step === "upload" && (
              <div className="space-y-6 max-w-2xl mx-auto py-8 relative z-10">
                <div className="border-2 border-dashed border-zinc-800 hover:border-amber-400/50 bg-zinc-900/40 rounded-2xl p-12 sm:p-16 text-center transition-all group">
                  <div className="w-20 h-20 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform">
                    <Upload className="w-10 h-10 text-amber-400 animate-pulse" />
                  </div>
                  <p className="text-xl font-bold text-zinc-100 mb-2">Import Entrants Spreadsheet</p>
                  <p className="text-sm text-zinc-400 mb-8 max-w-md mx-auto">Upload your CSV or Excel list containing participant names and assigned ticket numbers.</p>
                  
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={isLoading}
                    className="hidden"
                    id="csv-upload-race"
                  />
                  <label htmlFor="csv-upload-race" className="inline-block cursor-pointer">
                    <Button
                      className="bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black hover:from-amber-300 hover:to-amber-400 px-8 py-6 text-base shadow-xl shadow-amber-500/20 rounded-xl pointer-events-none"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Parsing Turf Manifest...
                        </>
                      ) : (
                        "Select Spreadsheet File"
                      )}
                    </Button>
                  </label>

                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-8 max-w-sm mx-auto">
                      <Progress value={uploadProgress} className="h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800" />
                      <p className="text-xs text-amber-400 mt-2 font-mono font-bold">{uploadProgress}% Manifest Loaded</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === "configure" && csvData && (
              <div className="space-y-6 py-2 max-w-4xl mx-auto relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="comp-title" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Competition Title
                    </label>
                    <Input
                      id="comp-title"
                      type="text"
                      value={competitionTitle}
                      onChange={(e) => setCompetitionTitle(e.target.value)}
                      placeholder="Enter competition title..."
                      className="bg-zinc-900/80 border-zinc-800 text-white font-bold text-base h-12 px-4 focus:border-amber-400 rounded-xl"
                    />
                  </div>

                  <div>
                    <label htmlFor="prize-link" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-amber-400" /> Prize Draw Link <span className="text-[10px] text-zinc-500 font-normal lowercase">(optional)</span>
                    </label>
                    <Input
                      id="prize-link"
                      type="url"
                      value={prizeDrawLink}
                      onChange={(e) => setPrizeDrawLink(e.target.value)}
                      placeholder="https://..."
                      className="bg-zinc-900/80 border-zinc-800 text-white h-12 px-4 focus:border-amber-400 text-sm rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="p-4 bg-zinc-900/50 border-zinc-800/80 rounded-xl flex flex-col justify-center">
                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Valid Entries</p>
                    <p className="text-2xl font-black text-amber-400 mt-1 font-mono">
                      {csvData.totalEntries.toLocaleString()}
                    </p>
                  </Card>

                  <Card className="p-4 bg-zinc-900/50 border-zinc-800/80 rounded-xl flex flex-col justify-center">
                    <label htmlFor="max-tickets" className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                      <Ticket className="w-3 h-3 text-amber-400" /> Total Max Tickets
                    </label>
                    <Input
                      id="max-tickets"
                      type="number"
                      min="1"
                      value={maxTickets}
                      onChange={(e) => setMaxTickets(e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value)))}
                      placeholder="Max tickets..."
                      className="bg-zinc-950 border-zinc-800 text-white h-9 px-2 focus:border-amber-400 font-bold text-sm text-center rounded-lg"
                    />
                  </Card>

                  <Card className="p-4 bg-zinc-900/50 border-zinc-800/80 rounded-xl">
                    <label htmlFor="winner-count-race" className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-1">
                      Number of Winners
                    </label>
                    <input
                      id="winner-count-race"
                      type="number"
                      min="1"
                      max={csvData.totalEntries}
                      value={winnerCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWinnerCount(val === "" ? "" : Math.min(csvData.totalEntries, Math.max(1, parseInt(val) || 1)));
                      }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg h-9 px-2 text-lg font-black text-amber-400 text-center focus:border-amber-400 outline-none font-mono"
                    />
                  </Card>
                </div>

                <div className="space-y-3 bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/60 pb-3">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                      <span>📋</span> Manifest Preview Pool
                    </h4>
                    {totalEntriesPages > 1 && (
                      <div className="flex items-center gap-2 bg-zinc-900/80 px-3 py-1 rounded-lg border border-zinc-800">
                        <button
                          onClick={() => setEntriesPage(p => Math.max(1, p - 1))}
                          disabled={entriesPage === 1}
                          className="text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono font-bold text-zinc-300 min-w-[70px] text-center">
                          {entriesPage} / {totalEntriesPages}
                        </span>
                        <button
                          onClick={() => setEntriesPage(p => Math.min(totalEntriesPages, p + 1))}
                          disabled={entriesPage === totalEntriesPages}
                          className="text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[28vh] overflow-y-auto pr-1">
                    {paginatedEntries.map((entry, idx) => {
                      const globalIndex = entriesStartIndex + idx;
                      return (
                        <div key={globalIndex} className="flex justify-between items-center p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono bg-zinc-950 text-zinc-500 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border border-zinc-800">
                              {globalIndex + 1}
                            </span>
                            <span className="text-sm font-semibold text-zinc-200 truncate">
                              {entry.participantName || "Participant"}
                            </span>
                          </div>
                          <span className="text-xs font-bold font-mono text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md border border-amber-400/20 flex-shrink-0">
                            #{entry.ticketNumber}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={async () => {
                      setIsLoading(true);
                      await removeLargeItem("koc_active_race_state");
                      setCSVData(null);
                      setStep("upload");
                      setIsLoading(false);
                    }} 
                    variant="outline" 
                    className="flex-1 border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 py-6 font-bold text-sm rounded-xl"
                  >
                    Back to Upload
                  </Button>
                  <Button
                    onClick={handleRace}
                    disabled={isLoading}
                    className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-sm hover:from-amber-300 hover:to-amber-400 py-6 shadow-xl shadow-amber-500/20 rounded-xl"
                  >
                    <Flame className="w-4 h-4 mr-2 fill-black" />
                    Commence Derby Race
                  </Button>
                </div>
              </div>
            )}

            {step === "racing" && (
              <div className="space-y-4 py-2 relative z-10">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <p className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">Live Race Broadcast</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg text-xs font-mono text-amber-400">
                    {raceCommentary}
                  </div>
                </div>

                <div className="relative rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-[0_0_30px_rgba(0,0,0,0.8)] bg-zinc-950">
                  <canvas 
                    ref={canvasRef} 
                    width={900} 
                    height={380} 
                    className="w-full h-auto block"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {liveLeaderboard.slice(0, 5).map((runner, lIdx) => (
                    <div key={runner.id} className="bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono font-black text-amber-400 bg-zinc-950 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border border-zinc-800">
                          {lIdx + 1}
                        </span>
                        <span className="text-xs font-bold text-white truncate">{runner.name}</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-amber-400 ml-1">#{runner.ticket}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === "results" && (
              <div className="space-y-6 relative z-10">
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 text-emerald-400 text-sm sm:text-base font-bold shadow-lg shadow-emerald-500/5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-extrabold text-white">Derby Race Concluded Successfully!</p>
                    <p className="text-xs text-emerald-400 font-medium">Cryptographic proofs generated and committed securely to ledger audit log.</p>
                  </div>
                </div>

                <div className="space-y-3 bg-zinc-900/40 p-4 sm:p-5 rounded-2xl border border-zinc-800/80">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" /> Public Proof Commitment Hash
                    </p>
                    <code className="block p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl text-xs sm:text-sm text-amber-400 font-mono break-all select-all shadow-inner">
                      {proofHash}
                    </code>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Entry Hash</p>
                      <code className="block p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-xl text-xs text-zinc-300 font-mono truncate select-all shadow-inner">
                        {entryHash}
                      </code>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Server Seed (Revealed)</p>
                      <code className="block p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-xl text-xs text-emerald-400 font-mono truncate select-all shadow-inner">
                        {serverSeed}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-start">
                      <button
                        onClick={() => { setActiveTab("all"); setCurrentPage(1); }}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                          activeTab === "all" 
                            ? "bg-amber-400 text-black shadow-md" 
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        All Winners ({winners.length})
                      </button>
                      <button
                        onClick={() => { setActiveTab("top3"); setCurrentPage(1); }}
                        className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                          activeTab === "top3" 
                            ? "bg-amber-400 text-black shadow-md" 
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Podium (Top 3)
                      </button>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-2 self-end sm:self-center bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-zinc-800">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono font-bold text-zinc-300 min-w-[70px] text-center">
                          Page {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                    {paginatedWinners.length === 0 ? (
                      <p className="text-zinc-500 text-xs text-center py-8">No entries match view filters.</p>
                    ) : (
                      paginatedWinners.map((winner, idx) => {
                        const absoluteIndex = startIndex + idx;
                        return (
                          <div key={absoluteIndex} className="flex justify-between items-center p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl shadow-md transition-all hover:border-amber-400/50">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs font-mono bg-zinc-950 text-zinc-300 w-7 h-7 rounded-xl flex items-center justify-center font-bold flex-shrink-0 border border-zinc-800">
                                {absoluteIndex + 1}
                              </span>
                              <span className="text-base font-bold tracking-wide text-white truncate">
                                {absoluteIndex === 0 ? "🥇 " : absoluteIndex === 1 ? "🥈 " : absoluteIndex === 2 ? "🥉 " : ""} 
                                {winner.participantName || "Participant"}
                              </span>
                            </div>
                            <span className="text-base font-black font-mono text-amber-400 bg-amber-400/10 px-3 py-1 rounded-lg border border-amber-400/25 tracking-wide flex-shrink-0">
                              #{winner.ticketNumber}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <Button 
                  onClick={handleClearAndClose} 
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white font-bold h-13 text-sm rounded-xl transition-all border border-zinc-800 mt-2 shadow-lg"
                >
                  Clear Screen & Close
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}