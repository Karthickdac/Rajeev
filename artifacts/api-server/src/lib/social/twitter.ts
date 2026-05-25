import type { SocialAccount } from "@workspace/db/schema";
import { PlatformError, type PlatformAdapter, type PublishInput, type PublishResult, type StatsResult } from "./types.js";

const API = "https://api.twitter.com/2";

// Twitter/X adapter — uses X API v2 with a bearer/OAuth2 user-context token.
// `accessToken` must have `tweet.write` and `users.read` scopes for posting + stats.
// Note: media upload requires v1.1 media endpoints; this adapter posts text only.
export const twitterAdapter: PlatformAdapter = {
  platform: "twitter",

  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    if (!account.accessToken) throw new PlatformError("Missing access token", "twitter");
    const res = await fetch(`${API}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: input.content }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlatformError(json?.detail ?? json?.title ?? `HTTP ${res.status}`, "twitter", res.status);
    const id = json?.data?.id;
    return {
      platformPostId: String(id),
      platformPostUrl: account.handle ? `https://x.com/${account.handle.replace(/^@/, "")}/status/${id}` : `https://x.com/i/web/status/${id}`,
      raw: json,
    };
  },

  async fetchStats(account: SocialAccount): Promise<StatsResult> {
    if (!account.accessToken) throw new PlatformError("Missing access token", "twitter");
    const id = account.externalAccountId;
    const url = id
      ? `${API}/users/${id}?user.fields=public_metrics`
      : `${API}/users/me?user.fields=public_metrics`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${account.accessToken}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlatformError(json?.detail ?? `HTTP ${res.status}`, "twitter", res.status);
    const m = json?.data?.public_metrics ?? {};
    return {
      followers: m.followers_count,
      following: m.following_count,
      postsCount: m.tweet_count,
      raw: json,
    };
  },
};
