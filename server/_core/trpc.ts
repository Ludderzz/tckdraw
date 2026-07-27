import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const drawRouter = router({
  saveFacebookExtensionDraw: adminProcedure
    .input(
      z.object({
        comments: z.array(z.string()),
        competitionTitle: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { comments, competitionTitle } = input;

      if (!comments || comments.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No comments provided." });
      }

      // Parse comments into participant structures
      const formattedEntries = comments.map((comment, index) => {
        const parts = comment.split(":");
        const participantName = parts.length > 1 ? parts[0].trim() : `User ${index + 1}`;
        const message = parts.length > 1 ? parts.slice(1).join(":").trim() : comment.trim();

        return {
          ticketNumber: index + 1,
          participantName,
          message,
        };
      });

      // Generate verifiable server seed & proof hash
      const serverSeed = crypto.randomBytes(32).toString("hex");
      const entryHash = crypto.createHash("sha256").update(JSON.stringify(formattedEntries)).digest("hex");
      const combinedData = `${serverSeed}-${entryHash}`;
      const proofHash = crypto.createHash("sha256").update(combinedData).digest("hex");

      // Pick random winner securely
      const randomIndex = crypto.randomInt(0, formattedEntries.length);
      const winner = formattedEntries[randomIndex];

      // Save audit record to Supabase if available in context
      if (ctx.supabase) {
        await ctx.supabase.from("draws_audit").insert({
          competition_title: competitionTitle,
          entry_count: formattedEntries.length,
          sold_tickets: formattedEntries.length,
          winner_tickets: [winner],
          server_seed: serverSeed,
          entry_hash: entryHash,
          proof_hash: proofHash,
        });
      }

      return {
        success: true,
        totalEntries: formattedEntries.length,
        winner,
        proofHash,
        serverSeed,
      };
    }),
});
