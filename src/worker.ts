import { analyze, type AiExtractor } from "./engine/analyze";
import { FIELD_KEYS, type FieldKey, type FieldValue } from "./engine/types";
import { SAMPLES } from "./samples";

interface Env {
  ASSETS: Fetcher;
  AI?: Ai;
}

const MAX_CHARS = 60_000;
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
      let body: { text?: unknown; use_ai?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      if (typeof body.text !== "string" || body.text.trim().length === 0) {
        return json({ error: "'text' (non-empty string) is required" }, 400);
      }
      if (body.text.length > MAX_CHARS) {
        return json({ error: `text exceeds ${MAX_CHARS} characters` }, 413);
      }
      const useAi = body.use_ai === true && env.AI;
      const result = await analyze(body.text, useAi ? makeAiExtractor(env.AI as Ai) : undefined);
      if (body.use_ai === true && !env.AI) result.meta.ai_note = "AI binding not configured; rules only";
      return json(result);
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
