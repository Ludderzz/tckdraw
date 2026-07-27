import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export interface PickFacebookWinnerParams {
  comments: string[]; // Array formatted as ["Author Name: Comment body", ...]
  competitionTitle?: string;
}

// Stub/helper for URL-based scraping if needed by pickFacebookWinner
export async function scrapeFacebookPostComments(postUrl: string) {
  console.log(`[FacebookPicker] Scraping requested for URL: ${postUrl}`);
  // Return an array structure matching expected participant data
  return [] as Array<{ participantName: string; ticketNumber: string }>;
}

export async function processFacebookCommentsAndSave({
  comments,
  competitionTitle = "Facebook Giveaway Draw",
}: PickFacebookWinnerParams) {
  if (!comments || comments.length === 0) {
    throw new Error("No comments provided to draw from.");
  }

  const totalEntries = comments.length;

  // 1. Generate a secure random server seed for verification
  const serverSeed = crypto.randomBytes(32).toString("hex");

  // 2. Select a cryptographically fair random winner index
  const winnerIndex = crypto.randomInt(0, totalEntries);
  const selectedComment = comments[winnerIndex];

  // Parse "Author Name: Comment body"
  const splitIdx = selectedComment.indexOf(":");
  const winnerName =
    splitIdx !== -1 ? selectedComment.substring(0, splitIdx).trim() : selectedComment;
  const winnerMessage =
    splitIdx !== -1 ? selectedComment.substring(splitIdx + 1).trim() : "";

  const winnerData = {
    participantName: winnerName,
    message: winnerMessage,
    ticketNumber: winnerIndex + 1,
  };

  // 3. Compute public proof and entry hashes
  const entryHash = crypto.createHash("sha256").update(JSON.stringify(comments)).digest("hex");
  const proofHash = crypto
    .createHash("sha256")
    .update(`${serverSeed}:${entryHash}:${winnerIndex}`)
    .digest("hex");

  // 4. Save directly into dedicated `facebook_draws` table
  const { data, error } = await supabase
    .from("facebook_draws")
    .insert([
      {
        competition_title: competitionTitle,
        total_comments: totalEntries,
        comments_payload: comments,
        winner_data: winnerData,
        server_seed: serverSeed,
        proof_hash: proofHash,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Supabase error saving to facebook_draws:", error);
    throw new Error(`Failed to save Facebook draw to Supabase: ${error.message}`);
  }

  return {
    success: true,
    totalEntries,
    serverSeed,
    proofHash,
    winner: winnerData,
    facebookRecord: data,
  };
}