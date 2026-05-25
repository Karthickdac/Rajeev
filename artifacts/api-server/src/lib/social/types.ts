import type { SocialAccount } from "@workspace/db/schema";

export interface PublishInput {
  content: string;
  mediaUrls?: string[];
}

export interface PublishResult {
  platformPostId: string;
  platformPostUrl?: string;
  raw?: unknown;
}

export interface StatsResult {
  followers?: number;
  following?: number;
  postsCount?: number;
  raw?: unknown;
}

export interface PlatformAdapter {
  platform: string;
  publish(account: SocialAccount, input: PublishInput): Promise<PublishResult>;
  fetchStats(account: SocialAccount): Promise<StatsResult>;
  validateToken?(account: SocialAccount): Promise<boolean>;
}

export class PlatformError extends Error {
  constructor(message: string, public readonly platform: string, public readonly status?: number) {
    super(message);
    this.name = "PlatformError";
  }
}
