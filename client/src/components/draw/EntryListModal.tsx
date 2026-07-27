import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Loader2, FileSpreadsheet, Search, RefreshCw, Layers } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface EntryListModalProps {
  onClose: () => void;
}

export default function EntryListModal({ onClose }: EntryListModalProps) {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompetition, setSelectedCompetition] = useState<string>("all");
  const [competitions, setCompetitions] = useState<{ id: string; title: string }[]>([]);

  // Fetch entries and unique competitions on mount
  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("competition_entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const rawEntries = data || [];
      setEntries(rawEntries);

      // Extract unique competitions for the filter dropdown
      const uniqueCompsMap = new Map();
      rawEntries.forEach((entry) => {
        const compId = entry.competition_id || entry.competition_title || "general";
        const compTitle = entry.competition_title || entry.competition_id || "General Competition";
        uniqueCompsMap.set(compId, compTitle);
      });
      
      setCompetitions(
        Array.from(uniqueCompsMap.entries()).map(([id, title]) => ({ id, title }))
      );
    } catch (err) {
      console.error("Failed to fetch competition entries:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter entries based on search and selected competition filter
  const filteredEntries = entries.filter((entry) => {
    const compId = entry.competition_id || entry.competition_title || "general";
    const matchesComp = selectedCompetition === "all" || compId === selectedCompetition;
    const searchLower = searchTerm.toLowerCase();
    
    // Check raw_data object as well if flattened fields are missing
    const raw = entry.raw_data || {};
    const name = entry.participant_name || entry.name || raw.participantName || raw.Name || raw.username || raw.name || "";
    const email = entry.email || raw.email || raw.Email || "";
    const ticket = String(entry.ticket_number || entry.ticket || raw.ticketNumber || raw.Ticket || raw.ticket_number || raw.number || "");
    const compTitle = entry.competition_title || entry.competition_id || raw.competitionTitle || "";

    const nameMatch = name.toLowerCase().includes(searchLower);
    const emailMatch = email.toLowerCase().includes(searchLower);
    const ticketMatch = ticket.toLowerCase().includes(searchLower);
    const compMatch = compTitle.toLowerCase().includes(searchLower);

    return matchesComp && (nameMatch || emailMatch || ticketMatch || compMatch);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <Card className="bg-[#121212] border border-[#2a2a2a] w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#b38728]" />
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1c1c1c] rounded-lg border border-[#333]">
              <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Ingested Entry Lists</h2>
              <p className="text-xs text-gray-400">View and manage scraped participants and ticket numbers stored in Supabase</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Filters and Controls Bar */}
        <div className="p-4 bg-[#0c0c0c] border-b border-[#222] flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search name, email, ticket, competition..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#141414] border border-[#333] rounded pl-9 pr-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <select
                value={selectedCompetition}
                onChange={(e) => setSelectedCompetition(e.target.value)}
                className="w-full bg-[#141414] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-[#D4AF37] appearance-none pr-8 cursor-pointer truncate"
              >
                <option value="all">All Competitions ({entries.length} entries)</option>
                {competitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.title}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-3 pointer-events-none text-gray-500">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchEntries}
              className="border-[#333] hover:bg-[#1a1a1a] text-gray-300 text-xs gap-1.5 h-[34px] shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Entries Table / List Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
              <p className="text-xs">Loading Supabase database records...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2 text-center">
              <FileSpreadsheet className="w-8 h-8 text-gray-600 mb-1" />
              <p className="text-xs font-medium text-gray-400">No competition entries found</p>
              <p className="text-[11px] text-gray-500 max-w-sm">
                {entries.length === 0 
                  ? "Your 'competition_entries' Supabase table is currently empty. Run a scraper workflow to ingest entries." 
                  : "No records match your active search term or competition filter criteria."}
              </p>
            </div>
          ) : (
            <div className="border border-[#222] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#161616] text-[10px] uppercase font-bold tracking-wider text-gray-400 border-b border-[#222]">
                    <th className="p-3">#</th>
                    <th className="p-3">Participant Name</th>
                    <th className="p-3">Email / Contact</th>
                    <th className="p-3">Ticket Number</th>
                    <th className="p-3">Competition</th>
                    <th className="p-3">Ingested At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222] text-xs">
                  {filteredEntries.map((entry, idx) => {
                    const raw = entry.raw_data || {};
                    const name = entry.participant_name || entry.name || raw.participantName || raw.Name || raw.username || raw.name || "Anonymous";
                    const email = entry.email || raw.email || raw.Email || "—";
                    const ticket = entry.ticket_number || entry.ticket || raw.ticketNumber || raw.Ticket || raw.ticket_number || raw.number || "N/A";
                    const compTitle = entry.competition_title || entry.competition_id || raw.competitionTitle || "General";
                    const createdAt = entry.created_at ? new Date(entry.created_at).toLocaleString() : "—";

                    return (
                      <tr key={entry.id || idx} className="hover:bg-[#141414] transition-colors">
                        <td className="p-3 text-gray-500 font-mono">{idx + 1}</td>
                        <td className="p-3 font-semibold text-gray-200">
                          {name}
                        </td>
                        <td className="p-3 text-gray-400 font-mono text-[11px]">
                          {email}
                        </td>
                        <td className="p-3 font-mono font-bold text-[#D4AF37]">
                          #{ticket}
                        </td>
                        <td className="p-3 text-gray-300 max-w-[200px] truncate" title={compTitle}>
                          {compTitle}
                        </td>
                        <td className="p-3 text-gray-500 font-mono text-[11px]">
                          {createdAt}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#0c0c0c] border-t border-[#222] flex items-center justify-between text-xs text-gray-400">
          <span>Showing <strong className="text-gray-200">{filteredEntries.length}</strong> of <strong className="text-gray-200">{entries.length}</strong> total records</span>
          <Button
            onClick={onClose}
            className="bg-[#222] hover:bg-[#333] text-gray-200 font-semibold text-xs px-4 py-2"
          >
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}