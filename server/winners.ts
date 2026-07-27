import { Request, Response } from "express";

export interface Winner {
  name: string;
  competition: string;
  ticket: string;
  prize: string;
  prizeType: string;
}

export async function getLiveWinners(req: Request, res: Response) {
  try {
    const response = await fetch("https://thecashkings.co.uk/draw-results/?prize_type=physical&win_type=all");
    const htmlText = await response.text();
    
    let winners: Winner[] = [];

    // Try parsing standard <tr> rows first
    const rowMatches = [...htmlText.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)];
    if (rowMatches.length > 1) {
      winners = rowMatches.map((match) => {
        const rowContent = match[1];
        const cols = [...rowContent.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(c => c[1].replace(/<[^>]*>/g, "").trim());
        return {
          name: cols[0] || "Winner",
          competition: cols[1] || "Competition",
          ticket: cols[2] || "#0000",
          prize: cols[3] || "Cash Prize",
          prizeType: cols[4] || "Instant Win",
        };
      }).filter(w => w.name !== "Winner" && w.name !== "" && !w.name.toLowerCase().includes("name"));
    }

    // Fallback: If no table rows found, try matching typical winner card/div patterns
    if (winners.length === 0) {
      // Matches repeating blocks that usually house winner details
      const cardMatches = [...htmlText.matchAll(/<div[^>]*class="[^"]*winner[^"]*"[^>]*>(.*?)<\/div>/gs)];
      if (cardMatches.length > 0) {
        winners = cardMatches.map((match) => {
          const content = match[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          return {
            name: "Verified Winner",
            competition: content.substring(0, 40) || "Competition",
            ticket: "N/A",
            prize: "Prize Won",
            prizeType: "Draw",
          };
        });
      }
    }

    return res.json({ success: true, data: winners });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch external results" });
  }
}