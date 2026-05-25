import type { SocialAccount } from "@workspace/db/schema";
import { PlatformError, type PlatformAdapter, type PublishInput, type PublishResult, type StatsResult } from "./types.js";

const GRAPH = "https://graph.facebook.com/v21.0";

// Facebook adapter — publishes to a Facebook Page.
// `externalAccountId` must be the Page ID, `accessToken` a Page Access Token
// with `pages_manage_posts` + `pages_read_engagement` scopes.
export const facebookAdapter: PlatformAdapter = {
  platform: "facebook",

  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    if (!account.accessToken) throw new PlatformError("Missing page access token", "facebook");
    if (!account.externalAccountId) throw new PlatformError("Missing page id", "facebook");

    const params = new URLSearchParams({
      message: input.content,
      access_token: account.accessToken,
    });
    const firstMedia = input.mediaUrls?.[0];
    const endpoint = firstMedia
      ? `${GRAPH}/${account.externalAccountId}/photos`
      : `${GRAPH}/${account.externalAccountId}/feed`;
    if (firstMedia) params.set("url", firstMedia);

    const res = await fetch(endpoint, { method: "POST", body: params });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlatformError(json?.error?.message ?? `HTTP ${res.status}`, "facebook", res.status);
    const id = json.post_id ?? json.id;
    return {
      platformPostId: String(id),
      platformPostUrl: `https://www.facebook.com/${id}`,
      raw: json,
    };
  },

  async fetchStats(account: SocialAccount): Promise<StatsResult> {
    if (!account.accessToken || !account.externalAccountId) {
      throw new PlatformError("Missing credentials", "facebook");
    }
    const url = `${GRAPH}/${account.externalAccountId}?fields=followers_count,fan_count&access_token=${encodeURIComponent(account.accessToken)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlatformError(json?.error?.message ?? `HTTP ${res.status}`, "facebook", res.status);
    return {
      followers: json.followers_count ?? json.fan_count,
      raw: json,
    };
  },
};
