import { facebookAdapter } from "./facebook.js";
import { instagramAdapter } from "./instagram.js";
import { twitterAdapter } from "./twitter.js";
import { youtubeAdapter } from "./youtube.js";
import type { PlatformAdapter } from "./types.js";

export * from "./types.js";

const REGISTRY: Record<string, PlatformAdapter> = {
  facebook: facebookAdapter,
  instagram: instagramAdapter,
  twitter: twitterAdapter,
  youtube: youtubeAdapter,
};

export function getAdapter(platform: string): PlatformAdapter | undefined {
  return REGISTRY[platform];
}

export function supportsApi(platform: string): boolean {
  return platform in REGISTRY;
}

export const SUPPORTED_PLATFORMS = Object.keys(REGISTRY);
