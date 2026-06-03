// Centralised AI settings loaded from site_config.ai_settings.
// All AI routes read model name, temperature, max tokens, per-feature prompt
// template overrides, and feature on/off toggles from here so the PA can tune
// behaviour from the admin panel with no code changes.

import { db } from "@workspace/db";
import { siteConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface AiFeatureToggles {
  autoTriage: boolean;
  resolutionSuggestion: boolean;
  postGenerator: boolean;
  pressRelease: boolean;
  headlineSuggestion: boolean;
  appointmentScoring: boolean;
}

export interface AiPromptTemplates {
  triage: string;
  resolution: string;
  socialPost: string;
  pressRelease: string;
  headline: string;
  activityExpand: string;
  appointmentScore: string;
}

export interface AiSettings {
  modelName: string;
  temperature: number;
  maxTokens: number;
  featureToggles: AiFeatureToggles;
  promptTemplates: AiPromptTemplates;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  modelName: "gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 1200,
  featureToggles: {
    autoTriage: true,
    resolutionSuggestion: true,
    postGenerator: true,
    pressRelease: true,
    headlineSuggestion: true,
    appointmentScoring: true,
  },
  // Empty string = use the built-in default prompt defined in the route.
  promptTemplates: {
    triage: "",
    resolution: "",
    socialPost: "",
    pressRelease: "",
    headline: "",
    activityExpand: "",
    appointmentScore: "",
  },
};

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function mergeSettings(base: AiSettings, raw: unknown): AiSettings {
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const toggles = (r.featureToggles && typeof r.featureToggles === "object") ? r.featureToggles as Record<string, unknown> : {};
  const prompts = (r.promptTemplates && typeof r.promptTemplates === "object") ? r.promptTemplates as Record<string, unknown> : {};
  const pickBool = (k: keyof AiFeatureToggles) => typeof toggles[k] === "boolean" ? toggles[k] as boolean : base.featureToggles[k];
  const pickStr = (k: keyof AiPromptTemplates) => typeof prompts[k] === "string" ? prompts[k] as string : base.promptTemplates[k];
  return {
    modelName: typeof r.modelName === "string" && r.modelName.trim() ? r.modelName.trim() : base.modelName,
    temperature: clampNum(r.temperature, 0, 2, base.temperature),
    maxTokens: Math.round(clampNum(r.maxTokens, 100, 8000, base.maxTokens)),
    featureToggles: {
      autoTriage: pickBool("autoTriage"),
      resolutionSuggestion: pickBool("resolutionSuggestion"),
      postGenerator: pickBool("postGenerator"),
      pressRelease: pickBool("pressRelease"),
      headlineSuggestion: pickBool("headlineSuggestion"),
      appointmentScoring: pickBool("appointmentScoring"),
    },
    promptTemplates: {
      triage: pickStr("triage"),
      resolution: pickStr("resolution"),
      socialPost: pickStr("socialPost"),
      pressRelease: pickStr("pressRelease"),
      headline: pickStr("headline"),
      activityExpand: pickStr("activityExpand"),
      appointmentScore: pickStr("appointmentScore"),
    },
  };
}

let cache: { value: AiSettings; expires: number } | null = null;
const TTL_MS = 30_000;

export function invalidateAiSettings(): void {
  cache = null;
}

export async function loadAiSettings(): Promise<AiSettings> {
  if (cache && Date.now() < cache.expires) return cache.value;
  let value = DEFAULT_AI_SETTINGS;
  try {
    const [row] = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "ai_settings")).limit(1);
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      value = mergeSettings(DEFAULT_AI_SETTINGS, parsed);
    }
  } catch { /* fall back to defaults */ }
  cache = { value, expires: Date.now() + TTL_MS };
  return value;
}

// Resolve a system prompt: use the admin override when non-empty, else the
// route's built-in default.
export function resolvePrompt(template: string, fallback: string): string {
  return template && template.trim() ? template.trim() : fallback;
}
