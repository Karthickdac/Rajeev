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
    if (!account.accessToken) throw new PlatformError("Missing API key / access token", "youtube");
    const channelId = account.externalAccountId;
    if (!channelId) throw new PlatformError("Missing channel id", "youtube");
    // Public stats can use API key in URL; OAuth bearer also works.
    const url = `${API}/channels?part=statistics&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(account.accessToken)}`;
    const res = await fetch(url);
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
