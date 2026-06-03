import type { SocialAccount } from "@workspace/db/schema";
import { PlatformError, type PlatformAdapter, type PublishInput, type PublishResult, type StatsResult } from "./types.js";

const API = "https://www.googleapis.com/youtube/v3";

// YouTube adapter — supports community posts (text) require special access not
// exposed via API. This adapter currently supports stats; publish is a no-op
// stub so cross-posts to YouTube are gracefully skipped.
export const youtubeAdapter: PlatformAdapter = {
  platform: "youtube",

  async publish(_account: SocialAccount, _input: PublishInput): Promise<PublishResult> {
    throw new PlatformError(
      "YouTube text posts are not supported via the public Data API. Use the Studio app to publish videos/community posts.",
      "youtube",
    );
  },

  async fetchStats(account: SocialAccount): Promise<StatsResult> {
    if (!account.accessToken) throw new PlatformError("Missing access token", "youtube");
    // Use OAuth bearer auth. Query by channel ID if known; fall back to mine=true.
    const channelId = account.externalAccountId;
    const idParam = channelId ? `id=${encodeURIComponent(channelId)}` : `mine=true`;
    const url = `${API}/channels?part=statistics&${idParam}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlatformError(json?.error?.message ?? `HTTP ${res.status}`, "youtube", res.status);
    const stats = json?.items?.[0]?.statistics ?? {};
    return {
      followers: stats.subscriberCount ? Number(stats.subscriberCount) : undefined,
      postsCount: stats.videoCount ? Number(stats.videoCount) : undefined,
      raw: json,
    };
  },
};
