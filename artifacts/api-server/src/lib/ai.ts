// Thin wrapper around OpenAI's HTTP API — no SDK install needed.
// All AI features in routes/ai.ts call into these helpers.

const OPENAI_BASE = "https://api.openai.com/v1";
const CHAT_MODEL = "gpt-4o-mini";
const EMBED_MODEL = "text-embedding-3-small";

export function hasOpenAI(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function key(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("OPENAI_API_KEY not configured");
  return k;
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export async function chat(messages: ChatMessage[], opts: { json?: boolean; temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const body: Record<string, unknown> = {
    model: CHAT_MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.json) body.response_format = { type: "json_object" };
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI chat ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function chatJson<T = unknown>(messages: ChatMessage[]): Promise<T> {
  const txt = await chat(messages, { json: true, temperature: 0.1 });
  return JSON.parse(txt) as T;
}

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key()}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`OpenAI embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { data?: Array<{ embedding: number[] }> };
  const vec = data.data?.[0]?.embedding;
  if (!vec) throw new Error("No embedding returned");
  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}
