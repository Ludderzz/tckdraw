import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { fetchAllCompetitionEntries } from "./scraper";
import { getLiveWinners } from "./winners";
import { scrapeFacebookPostComments, processFacebookCommentsAndSave } from "./facebookPicker";

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
  }),

  winners: router({
    getLive: publicProcedure.query(async () => {
      try {
        let responseData: any = null;
        const mockRes = {
          json: (data: any) => {
            responseData = data;
            return mockRes;
          },
          status: () => mockRes,
        } as any;

        await getLiveWinners({} as any, mockRes);
        return responseData || { success: false, data: [] };
      } catch (err: any) {
        throw new Error(`Failed to fetch live winners: ${err.message || err}`);
      }
    }),
  }),

  draw: router({
    verifyHash: publicProcedure
      .input(z.object({ proofHash: z.string() }))
      .query(async ({ input }) => {
        return { proofHash: input.proofHash };
      }),

    importEntries: publicProcedure
      .input(z.object({ competitionUrl: z.string() }))
      .mutation(async ({ input }) => {
        console.log(`[Scraper] Starting execution for URL: ${input.competitionUrl}`);
        
        try {
          const rawResult: any = await fetchAllCompetitionEntries(input.competitionUrl);
          
          console.log(`[Scraper] Raw scraper result structure:`, typeof rawResult);
          console.log(`[Scraper] Raw scraper result content:`, JSON.stringify(rawResult, null, 2).slice(0, 500));

          let entriesArray: any[] = [];
          if (Array.isArray(rawResult)) {
            entriesArray = rawResult;
          } else if (rawResult && typeof rawResult === "object") {
            entriesArray = rawResult.entries || rawResult.data || rawResult.results || [];
          }

          console.log(`[Scraper] Final parsed entries count:`, entriesArray.length);

          return {
            competitionId: `comp_${Date.now()}`,
            competitionTitle: input.competitionUrl,
            entries: entriesArray,
          };
        } catch (scraperError: any) {
          console.error(`[Scraper] Error caught inside fetchAllCompetitionEntries:`, scraperError.message || scraperError);
          throw new Error(`Scraper execution failed: ${scraperError.message || "Unknown error"}`);
        }
      }),

    saveFacebookExtensionDraw: publicProcedure
      .input(
        z.object({
          comments: z.array(z.string()),
          competitionTitle: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await processFacebookCommentsAndSave({
          comments: input.comments,
          competitionTitle: input.competitionTitle,
        });
      }),

    pickFacebookWinner: publicProcedure
      .input(
        z.object({
          postUrl: z.string(),
          accessToken: z.string(), // Kept in schema for frontend compatibility, though unused by DOM scraper
          keyword: z.string().optional(),
          uniqueByUser: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        // Use the Playwright DOM scraper to fetch comments directly from the post URL
        const comments = await scrapeFacebookPostComments(input.postUrl);

        // Filter and pick a winner from the scraped DOM entries
        let eligibleEntries = comments;

        if (input.keyword && input.keyword.trim() !== "") {
          const kw = input.keyword.toLowerCase();
          eligibleEntries = eligibleEntries.filter(c => 
            c.ticketNumber.toLowerCase().includes(kw)
          );
        }

        if (input.uniqueByUser) {
          const seenNames = new Set<string>();
          eligibleEntries = eligibleEntries.filter(c => {
            if (seenNames.has(c.participantName)) return false;
            seenNames.add(c.participantName);
            return true;
          });
        }

        const randomIndex = eligibleEntries.length > 0 ? Math.floor(Math.random() * eligibleEntries.length) : -1;
        const winner = randomIndex >= 0 ? eligibleEntries[randomIndex] : null;

        return {
          allProcessedComments: comments.length,
          totalEligibleEntries: eligibleEntries.length,
          winner: winner ? {
            name: winner.participantName,
            message: winner.ticketNumber,
            created_time: new Date().toISOString()
          } : null
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;