import * as cheerio from "cheerio";

export interface CompetitionEntry {
  ticketNumber: string;
  participantName: string;
}

export async function fetchAllCompetitionEntries(competitionUrl: string): Promise<{ success: boolean; competitionId?: string; entries?: CompetitionEntry[]; error?: string }> {
  try {
    const urlObj = new URL(competitionUrl);
    const competitionId = urlObj.searchParams.get("competition_id");

    if (!competitionId) {
      return { success: false, error: "Invalid competition link: Missing competition_id parameter." };
    }

    const perPage = 50;

    // Fetch page 1 first to extract the total page count dynamically from data-last-page
    const firstPageUrl = `https://thecashkings.co.uk/wp-admin/admin-ajax.php?action=vhs_get_competition_entries&competition_id=${competitionId}&per_page=${perPage}&page=1`;
    const firstResponse = await fetch(firstPageUrl);
    const firstJson = await firstResponse.json();

    if (!firstJson.success || !firstJson.data || !firstJson.data.html) {
      return { success: false, error: "Failed to initialize competition entry scraping." };
    }

    const parseHtmlToEntries = (html: string): CompetitionEntry[] => {
      const $ = cheerio.load(html);
      const pageEntries: CompetitionEntry[] = [];
      
      $(".vhs-entries-list-entry").each((_, element) => {
        const ticketNumber = $(element).find(".vhs-entries-list-cell-number").text().trim();
        const participantName = $(element).find(".vhs-entries-list-cell-user").text().trim();

        if (ticketNumber) {
          pageEntries.push({
            ticketNumber: ticketNumber,
            participantName: participantName || "—",
          });
        }
      });

      return pageEntries;
    };

    let allEntries: CompetitionEntry[] = [];
    const firstPageEntries = parseHtmlToEntries(firstJson.data.html);
    allEntries = allEntries.concat(firstPageEntries);
    console.log(`[Scraper] Fetched page 1 / ? (${firstPageEntries.length} entries)`);

    // Read total pages from the container element attribute
    const $first = cheerio.load(firstJson.data.html);
    const lastPageAttr = $first(".vhs-entries-list").attr("data-last-page");
    const totalPages = lastPageAttr ? parseInt(lastPageAttr, 10) : 1;
    console.log(`[Scraper] Total pages detected: ${totalPages}`);

    // Build array of remaining page numbers to fetch
    const pageNumbers: number[] = [];
    for (let p = 2; p <= totalPages; p++) {
      pageNumbers.push(p);
    }

    // Concurrent batching (chunk size of 15 requests at a time)
    const chunkSize = 15;
    for (let i = 0; i < pageNumbers.length; i += chunkSize) {
      const chunk = pageNumbers.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(async (page) => {
        try {
          const ajaxUrl = `https://thecashkings.co.uk/wp-admin/admin-ajax.php?action=vhs_get_competition_entries&competition_id=${competitionId}&per_page=${perPage}&page=${page}`;
          const response = await fetch(ajaxUrl);
          const json = await response.json();

          if (json.success && json.data && json.data.html) {
            const entries = parseHtmlToEntries(json.data.html);
            console.log(`[Scraper] Completed page ${page} of ${totalPages} (${entries.length} entries)`);
            return entries;
          }
        } catch {
          console.error(`[Scraper] Error fetching page ${page}`);
        }
        return [];
      });

      const chunkResults = await Promise.all(chunkPromises);
      for (const entries of chunkResults) {
        allEntries = allEntries.concat(entries);
      }
    }

    console.log(`[Scraper] Finished! Total entries collected: ${allEntries.length}`);
    return { success: true, competitionId, entries: allEntries };
  } catch (err: any) {
    console.error("Scraper execution failure:", err);
    return { success: false, error: err.message || "Failed to fetch entries" };
  }
}