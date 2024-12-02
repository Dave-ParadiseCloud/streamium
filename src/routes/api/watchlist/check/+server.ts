import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { watchlistService } from "$lib/server/services/watchlist";

export async function GET({ url, locals }: RequestEvent) {
  if (!locals.user) {
    throw error(401, "Unauthorized");
  }

  const mediaId = parseInt(url.searchParams.get("mediaId") || "");
  const mediaType = url.searchParams.get("mediaType");

  if (isNaN(mediaId) || !mediaType || !["movie", "tv"].includes(mediaType)) {
    throw error(400, "Invalid mediaId or mediaType");
  }

  try {
    const inWatchlist = await watchlistService.isInWatchlist(
      locals.user.id,
      mediaId,
      mediaType as "movie" | "tv"
    );

    return json({ inWatchlist });
  } catch (err) {
    console.error("Error checking watchlist:", err);
    throw error(500, "Failed to check watchlist");
  }
}
