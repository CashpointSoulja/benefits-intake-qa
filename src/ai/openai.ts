import type { AiExtractor } from "../engine/analyze";
import { FIELD_KEYS, type FieldKey, type FieldValue } from "../engine/types";
import type { ReserveResult } from "../budget/ledger";

export const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/**
 * The only model this Worker will call. Rates are official GPT-5.4 nano standard-tier prices
 * per 1M tokens (input $0.20, output $1.25) observed on 2026-09-27 at
 * https://platform.openai.com/docs/models/gpt-5.4-nano, raised by the 10% regional-processing
 * uplift stated there, with no cached-input discount. A provider price rise requires changing
 * these constants in reviewed code.
 */
export const PINNED_MODEL = "gpt-5.4-nano-2026-03-17";
export const PINNED_INPUT_USD_PER_MTOK = 0.22;
export const PINNED_OUTPUT_USD_PER_MTOK = 1.375;

export interface OpenAiEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_INPUT_USD_PER_MTOK?: string;
  OPENAI_OUTPUT_USD_PER_MTOK?: string;
}

export interface OpenAiConfig {
  apiKey: string;
  model: typeof PINNED_MODEL;
  /** USD per 1M tokens; tokens × this = micro-USD. */
  inputPrice: number;
  outputPrice: number;
  maxOutputTokens: number;
  maxInputChars: number;
  timeoutMs: number;
}

export interface BudgetClient {
  reserve(amountMicros: number): Promise<ReserveResult>;
  settle(id: string, actualMicros: number | null, anomaly?: string | null): Promise<unknown>;
}

export const MAX_OUTPUT_TOKENS = 800;
export const MAX_INPUT_CHARS = 12_000;
const REQUEST_OVERHEAD_TOKENS = 64;

/** Optional override that may only raise a pinned price, never lower it. */
function priceAtLeast(raw: string | undefined, floor: number): number | null {
  if (raw === undefined || raw.trim() === "") return floor;
  if (!/^\d+(\.\d+)?$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n >= floor ? n : null;
}

/** Key required; model may only be the pinned snapshot; prices may not go below the pins. */
export function readOpenAiConfig(env: OpenAiEnv): { config: OpenAiConfig } | { missing: string[] } {
  const inputPrice = priceAtLeast(env.OPENAI_INPUT_USD_PER_MTOK, PINNED_INPUT_USD_PER_MTOK);
  const outputPrice = priceAtLeast(env.OPENAI_OUTPUT_USD_PER_MTOK, PINNED_OUTPUT_USD_PER_MTOK);
  const model = env.OPENAI_MODEL?.trim();
  const missing = [
    !env.OPENAI_API_KEY?.trim() && "OPENAI_API_KEY",
    model && model !== PINNED_MODEL && `OPENAI_MODEL (only ${PINNED_MODEL} is allowed)`,
    inputPrice === null && `OPENAI_INPUT_USD_PER_MTOK (must be >= ${PINNED_INPUT_USD_PER_MTOK})`,
    outputPrice === null && `OPENAI_OUTPUT_USD_PER_MTOK (must be >= ${PINNED_OUTPUT_USD_PER_MTOK})`,
  ].filter((m): m is string => Boolean(m));
  if (missing.length || inputPrice === null || outputPrice === null) return { missing };
  return {
    config: {
      apiKey: env.OPENAI_API_KEY!.trim(),
      model: PINNED_MODEL,
      inputPrice,
      outputPrice,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxInputChars: MAX_INPUT_CHARS,
      timeoutMs: 20_000,
    },
  };
}

/**
 * The complete request body. No tools, web search, audio or image output, a single choice and
 * the standard service tier, so the pinned text-token rates are the only charges.
 */
export function buildRequestBody(messages: unknown, cfg: OpenAiConfig) {
  return {
    model: cfg.model,
    messages,
    n: 1,
    max_completion_tokens: cfg.maxOutputTokens,
    reasoning_effort: "none",
    service_tier: "default",
    response_format: { type: "json_object" },
    store: false,
  };
}

export function buildMessages(text: string, maxChars: number) {
  const prompt = `Extract these fields from a US group health benefits intake document. Return ONLY a JSON object whose keys are exactly: ${FIELD_KEYS.join(", ")}. Use null when a field is not stated. Money as plain numbers (no $), percents as numbers, dates as YYYY-MM-DD, plan_type as one of PPO/HMO/HDHP/EPO/POS, hsa_eligible as true/false, waiting_period_days as a number of days.\n\nDOCUMENT:\n${text.slice(0, maxChars)}`;
  return [
    { role: "system", content: "You are a careful data-entry assistant. Output strict JSON only." },
    { role: "user", content: prompt },
  ];
}

/**
 * Upper bound on cost in micro-USD. Every ordinary o200k_base token decodes to at least one
 * UTF-8 byte, so message bytes bound content tokens; the serialized body is larger still, and
 * 64 more tokens cover chat formatting (3 per message + 3). Output is capped by
 * max_completion_tokens, which also counts reasoning tokens. See test/tokenizer.test.ts.
 */
export function worstCaseInputTokens(body: unknown): number {
  return new TextEncoder().encode(JSON.stringify(body)).length + REQUEST_OVERHEAD_TOKENS;
}

export function worstCaseMicros(body: unknown, cfg: OpenAiConfig): number {
  return Math.ceil(worstCaseInputTokens(body) * cfg.inputPrice + cfg.maxOutputTokens * cfg.outputPrice);
}

export function actualMicros(usage: unknown, cfg: OpenAiConfig): number | null {
  if (typeof usage !== "object" || usage === null) return null;
  const u = usage as { prompt_tokens?: unknown; completion_tokens?: unknown };
  if (typeof u.prompt_tokens !== "number" || typeof u.completion_tokens !== "number") return null;
  if (!Number.isSafeInteger(u.prompt_tokens) || !Number.isSafeInteger(u.completion_tokens)) return null;
  if (u.prompt_tokens < 0 || u.completion_tokens < 0) return null;
  return Math.ceil(u.prompt_tokens * cfg.inputPrice + u.completion_tokens * cfg.outputPrice);
}

/** Anything suggesting billing outside the pinned rates. */
export function responseAnomaly(data: { model?: unknown; service_tier?: unknown }, cfg: OpenAiConfig): string | null {
  if (data.service_tier !== undefined && data.service_tier !== null && data.service_tier !== "default")
    return `unexpected_service_tier:${String(data.service_tier)}`;
  if (typeof data.model === "string" && data.model !== cfg.model) return `unexpected_model:${data.model}`;
  return null;
}

function parseFields(content: string): Partial<Record<FieldKey, FieldValue | null>> {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("model returned no JSON");
  const parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
  const out: Partial<Record<FieldKey, FieldValue | null>> = {};
  for (const k of FIELD_KEYS) {
    const v = parsed[k];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
  }
  return out;
}

/** No request is sent unless the budget gate first reserves the call's worst-case cost. */
export function makeOpenAiExtractor(cfg: OpenAiConfig, budget: BudgetClient, fetchFn: typeof fetch = fetch): AiExtractor {
  return async (text) => {
    const body = buildRequestBody(buildMessages(text, cfg.maxInputChars), cfg);
    const reservation = await budget.reserve(worstCaseMicros(body, cfg));
    if (!reservation.ok) throw new Error(`AI budget gate refused the call: ${reservation.reason}`);
    let actual: number | null = null;
    let anomaly: string | null = null;
    try {
      const res = await fetchFn(OPENAI_CHAT_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
      const data = (await res.json()) as {
        model?: unknown;
        service_tier?: unknown;
        usage?: unknown;
        choices?: { message?: { content?: unknown } }[];
      };
      anomaly = responseAnomaly(data, cfg);
      actual = anomaly ? null : actualMicros(data.usage, cfg);
      if (anomaly) throw new Error(`OpenAI response outside pinned billing (${anomaly})`);
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("model returned no content");
      return parseFields(content);
    } finally {
      await budget.settle(reservation.id, actual, anomaly);
    }
  };
}
