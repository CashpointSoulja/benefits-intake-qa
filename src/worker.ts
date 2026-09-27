import { analyze, recheck, type AiExtractor, type ReviewedField } from "./engine/analyze";
import { FIELD_KEYS, type FieldKey, type FieldValue } from "./engine/types";
import { SAMPLES } from "./samples";

interface Env {
  ASSETS: Fetcher;
  AI?: Ai;
}

const MAX_CHARS = 60_000;
const MAX_PAGES = 200;
const REVIEW_STATUSES = new Set(["pending", "accepted", "edited"]);

const isValue = (v: unknown): v is FieldValue | null =>
  v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";

function parseReviewed(raw: unknown): Record<FieldKey, ReviewedField> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const src = raw as Record<string, unknown>;
  const out = {} as Record<FieldKey, ReviewedField>;
  for (const k of FIELD_KEYS) {
    const f = src[k] as Record<string, unknown> | undefined;
    if (typeof f !== "object" || f === null || !isValue(f.value)) return null;
    if (typeof f.review_status !== "string" || !REVIEW_STATUSES.has(f.review_status)) return null;
    const conflicts = Array.isArray(f.conflicts) ? f.conflicts.filter(isValue).filter((c) => c !== null) : undefined;
    out[k] = {
      value: f.value,
      review_status: f.review_status as ReviewedField["review_status"],
      confidence: typeof f.confidence === "number" ? f.confidence : 0,
      conflicts: conflicts && conflicts.length > 1 ? conflicts : undefined,
    };
  }
  return out;
}
const MODEL = "@cf/meta/llama-3.1-8b-instruct";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function makeAiExtractor(ai: Ai): AiExtractor {
  return async (text) => {
    const prompt = `Extract these fields from a US group health benefits intake document. Return ONLY a JSON object whose keys are exactly: ${FIELD_KEYS.join(", ")}. Use null when a field is not stated. Money as plain numbers (no $), percents as numbers, dates as YYYY-MM-DD, plan_type as one of PPO/HMO/HDHP/EPO/POS, hsa_eligible as true/false, waiting_period_days as a number of days.\n\nDOCUMENT:\n${text.slice(0, 12_000)}`;
    const res = (await ai.run(MODEL, {
      messages: [
        { role: "system", content: "You are a careful data-entry assistant. Output strict JSON only." },
        { role: "user", content: prompt },
      ],
      max_tokens: 800,
      temperature: 0,
    })) as { response?: string };
    const body = res.response ?? "";
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("model returned no JSON");
    const parsed = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
    const out: Partial<Record<FieldKey, FieldValue | null>> = {};
    for (const k of FIELD_KEYS) {
      const v = parsed[k];
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    }
    return out;
  };
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, ai_binding: Boolean(env.AI) });
    }

    if (url.pathname === "/api/samples" && request.method === "GET") {
      return json(SAMPLES);
    }

    if (url.pathname === "/api/analyze" && request.method === "POST") {
      let body: { text?: unknown; pages?: unknown; use_ai?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      let input: string | string[];
      if (body.pages !== undefined) {
        const pages = body.pages;
        if (!Array.isArray(pages) || pages.length === 0 || !pages.every((p): p is string => typeof p === "string")) {
          return json({ error: "'pages' must be a non-empty array of strings" }, 400);
        }
        if (pages.length > MAX_PAGES) return json({ error: `more than ${MAX_PAGES} pages` }, 413);
        if (!pages.some((p) => p.trim())) return json({ error: "'pages' contains no text" }, 400);
        input = pages;
      } else if (typeof body.text === "string" && body.text.trim().length > 0) {
        input = body.text;
      } else {
        return json({ error: "'text' (non-empty string) or 'pages' (string[]) is required" }, 400);
      }
      const chars = typeof input === "string" ? input.length : input.reduce((n, p) => n + p.length, 0);
      if (chars > MAX_CHARS) {
        return json({ error: `text exceeds ${MAX_CHARS} characters` }, 413);
      }
      const useAi = body.use_ai === true && env.AI;
      const result = await analyze(input, useAi ? makeAiExtractor(env.AI as Ai) : undefined);
      if (body.use_ai === true && !env.AI) result.meta.ai_note = "AI binding not configured; rules only";
      return json(result);
    }

    if (url.pathname === "/api/recheck" && request.method === "POST") {
      let body: { fields?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      const fields = parseReviewed(body.fields);
      if (!fields) return json({ error: "'fields' must contain every field with value and review_status" }, 400);
      return json(recheck(fields));
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
