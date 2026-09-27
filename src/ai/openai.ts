import type { AiExtractor } from "../engine/analyze";
import { FIELD_KEYS, type FieldKey, type FieldValue } from "../engine/types";
import type { ReserveResult } from "../budget/ledger";

export const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

export interface OpenAiEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_INPUT_USD_PER_MTOK?: string;
  OPENAI_OUTPUT_USD_PER_MTOK?: string;
}

export interface OpenAiConfig {
  apiKey: string;
  model: string;
  /** USD per 1M tokens; tokens × this = micro-USD. */
  inputPrice: number;
  outputPrice: number;
  maxOutputTokens: number;
  maxInputChars: number;
  timeoutMs: number;
}

export interface BudgetClient {
  reserve(amountMicros: number): Promise<ReserveResult>;
  settle(id: string, actualMicros: number | null): Promise<unknown>;
}

export const MAX_OUTPUT_TOKENS = 800;
export const MAX_INPUT_CHARS = 12_000;
const REQUEST_OVERHEAD_TOKENS = 64;

const price = (s: string | undefined) => {
  if (s === undefined || !/^\d+(\.\d+)?$/.test(s.trim())) return null;
  const n = Number(s.trim());
  return n > 0 && Number.isFinite(n) ? n : null;
};

/** All of key, model and both prices are required; anything missing disables AI (fail closed). */
export function readOpenAiConfig(env: OpenAiEnv): { config: OpenAiConfig } | { missing: string[] } {
  const inputPrice = price(env.OPENAI_INPUT_USD_PER_MTOK);
  const outputPrice = price(env.OPENAI_OUTPUT_USD_PER_MTOK);
  const missing = [
    !env.OPENAI_API_KEY?.trim() && "OPENAI_API_KEY",
    !env.OPENAI_MODEL?.trim() && "OPENAI_MODEL",
    inputPrice === null && "OPENAI_INPUT_USD_PER_MTOK",
    outputPrice === null && "OPENAI_OUTPUT_USD_PER_MTOK",
  ].filter((m): m is string => Boolean(m));
  if (missing.length || inputPrice === null || outputPrice === null) return { missing };
  return {
    config: {
      apiKey: env.OPENAI_API_KEY!.trim(),
      model: env.OPENAI_MODEL!.trim(),
      inputPrice,
      outputPrice,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxInputChars: MAX_INPUT_CHARS,
      timeoutMs: 20_000,
    },
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
 * Upper bound on cost in micro-USD. Every BPE token encodes at least one UTF-8 byte, so the
 * serialized message byte count bounds input tokens; output is capped by max_completion_tokens,
 * which also counts reasoning tokens.
 */
export function worstCaseMicros(messages: unknown, cfg: OpenAiConfig): number {
  const inputTokens = new TextEncoder().encode(JSON.stringify(messages)).length + REQUEST_OVERHEAD_TOKENS;
  return Math.ceil(inputTokens * cfg.inputPrice + cfg.maxOutputTokens * cfg.outputPrice);
}

export function actualMicros(usage: unknown, cfg: OpenAiConfig): number | null {
  if (typeof usage !== "object" || usage === null) return null;
  const u = usage as { prompt_tokens?: unknown; completion_tokens?: unknown };
  if (typeof u.prompt_tokens !== "number" || typeof u.completion_tokens !== "number") return null;
  if (u.prompt_tokens < 0 || u.completion_tokens < 0) return null;
  return Math.ceil(u.prompt_tokens * cfg.inputPrice + u.completion_tokens * cfg.outputPrice);
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
    const messages = buildMessages(text, cfg.maxInputChars);
    const reservation = await budget.reserve(worstCaseMicros(messages, cfg));
    if (!reservation.ok) throw new Error(`AI budget gate refused the call: ${reservation.reason}`);
    let actual: number | null = null;
    try {
      const res = await fetchFn(OPENAI_CHAT_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          max_completion_tokens: cfg.maxOutputTokens,
          response_format: { type: "json_object" },
          store: false,
        }),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
      const data = (await res.json()) as { usage?: unknown; choices?: { message?: { content?: unknown } }[] };
      actual = actualMicros(data.usage, cfg);
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("model returned no content");
      return parseFields(content);
    } finally {
      await budget.settle(reservation.id, actual);
    }
  };
}
