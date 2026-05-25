import type { SocialAccount } from "@workspace/db/schema";
import { PlatformError, type PlatformAdapter, type PublishInput, type PublishResult, type StatsResult } from "./types.js";

const GRAPH = "https://graph.facebook.com/v21.0";

// Instagram adapter — uses the Instagram Graph API via a linked Facebook Page.
// `externalAccountId` = IG Business Account ID, `accessToken` = Page Access Token.
// Requires a publicly-reachable image URL (Instagram fetches it server-side).
export const instagramAdapter: PlatformAdapter = {
  platform: "instagram",

  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    if (!account.accessToken) throw new PlatformError("Missing access token", "instagram");
    if (!account.externalAccountId) throw new PlatformError("Missing IG business id", "instagram");
    const imageUrl = input.mediaUrls?.[0];
    if (!imageUrl) throw new PlatformError("Instagram requires an image", "instagram");

    // Step 1: create media container
    const createParams = new URLSearchParams({
      image_url: imageUrl,
      caption: input.content,
      access_token: account.accessToken,
    });
    const create = await fetch(`${GRAPH}/${account.externalAccountId}/media`, { method: "POST", body: createParams });
    const createJson = await create.json().catch(() => ({}));
    if (!create.ok) throw new PlatformError(createJson?.error?.message ?? `HTTP ${create.status}`, "instagram", create.status);

    // Step 2: publish container
    const publishParams = new URLSearchParams({ creation_id: createJson.id, access_token: account.accessToken });
    const pub = await fetch(`${GRAPH}/${account.externalAccountId}/media_publish`, { method: "POST", body: publishParams });
    const pubJson = await pub.json().catch(() => ({}));
    if (!pub.ok) throw new PlatformError(pubJson?.error?.message ?? `HTTP ${pub.status}`, "instagram", pub.status);

    return {
      platformPostId: String(pubJson.id),
      platformPostUrl: `https://www.instagram.com/p/${pubJson.id}`,
      raw: pubJson,
    };
  },

  async fetchStats(account: SocialAccount): Promise<StatsResult> {
    if (!account.accessToken || !account.externalAccountId) {
      throw new PlatformError("Missing credentials", "instagram");
    }
    const url = `${GRAPH}/${account.externalAccountId}?fields=followers_count,follows_count,media_count&access_token=${encodeURIComponent(account.accessToken)}`;
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlatformError(json?.error?.message ?? `HTTP ${res.status}`, "instagram", res.status);
    return {
      followers: json.followers_count,
      following: json.follows_count,
      postsCount: json.media_count,
      raw: json,
    };
  },
};
