import { describe, expect, it, vi } from "vitest";
import { analyze } from "../src/engine/analyze";
import {
  MAX_OUTPUT_TOKENS,
  OPENAI_CHAT_URL,
  PINNED_INPUT_USD_PER_MTOK,
  PINNED_MODEL,
  PINNED_OUTPUT_USD_PER_MTOK,
  actualMicros,
  buildMessages,
  buildRequestBody,
  makeOpenAiExtractor,
  readOpenAiConfig,
  worstCaseMicros,
  type BudgetClient,
  type OpenAiConfig,
} from "../src/ai/openai";
import type { ReserveResult } from "../src/budget/ledger";
import { SAMPLES } from "../src/samples";

const cfg = (readOpenAiConfig({ OPENAI_API_KEY: "test-key" }) as { config: OpenAiConfig }).config;
const COST_1000_100 = Math.ceil(1000 * PINNED_INPUT_USD_PER_MTOK + 100 * PINNED_OUTPUT_USD_PER_MTOK);

function fakeBudget(allow = true) {
  const calls: { reserve: number[]; settle: [string, number | null, string | null | undefined][] } = { reserve: [], settle: [] };
  const budget: BudgetClient = {
    reserve: async (amount): Promise<ReserveResult> => {
      calls.reserve.push(amount);
      return allow
        ? { ok: true, id: "res-1", reserved: amount, committed: amount, limit: 1_800_000 }
        : { ok: false, reason: "budget_exhausted", committed: 1_800_000, limit: 1_800_000 };
    },
    settle: async (id, actual, anomaly) => {
      calls.settle.push([id, actual, anomaly]);
    },
  };
  return { budget, calls };
}

const okResponse = (content: string, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      model: PINNED_MODEL,
      service_tier: "default",
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 1000, completion_tokens: 100 },
      ...extra,
    }),
    { status: 200 },
  );

describe("readOpenAiConfig", () => {
  it("pins the official GPT-5.4 nano rates with the 10% regional uplift", () => {
    expect(PINNED_MODEL).toBe("gpt-5.4-nano-2026-03-17");
    expect(PINNED_INPUT_USD_PER_MTOK).toBeCloseTo(0.2 * 1.1, 10);
    expect(PINNED_OUTPUT_USD_PER_MTOK).toBeCloseTo(1.25 * 1.1, 10);
    expect(cfg).toMatchObject({ model: PINNED_MODEL, inputPrice: PINNED_INPUT_USD_PER_MTOK, outputPrice: PINNED_OUTPUT_USD_PER_MTOK });
  });

  it("requires the key and allows only the pinned model", () => {
    expect(readOpenAiConfig({})).toEqual({ missing: ["OPENAI_API_KEY"] });
    expect("config" in readOpenAiConfig({ OPENAI_API_KEY: "k", OPENAI_MODEL: PINNED_MODEL })).toBe(true);
    for (const model of ["gpt-5.4-nano", "gpt-4o-mini", "gpt-5.5-pro"])
      expect(readOpenAiConfig({ OPENAI_API_KEY: "k", OPENAI_MODEL: model })).toMatchObject({ missing: [expect.stringMatching(/^OPENAI_MODEL/)] });
  });

  it("rejects price overrides below the pins; higher overrides are allowed", () => {
    expect(readOpenAiConfig({ OPENAI_API_KEY: "k", OPENAI_INPUT_USD_PER_MTOK: "0.2" })).toMatchObject({
      missing: [expect.stringMatching(/^OPENAI_INPUT_USD_PER_MTOK/)],
    });
    expect(readOpenAiConfig({ OPENAI_API_KEY: "k", OPENAI_OUTPUT_USD_PER_MTOK: "free" })).toMatchObject({
      missing: [expect.stringMatching(/^OPENAI_OUTPUT_USD_PER_MTOK/)],
    });
    const raised = readOpenAiConfig({ OPENAI_API_KEY: "k", OPENAI_INPUT_USD_PER_MTOK: "1", OPENAI_OUTPUT_USD_PER_MTOK: "5" });
    expect(raised).toMatchObject({ config: { inputPrice: 1, outputPrice: 5 } });
  });
});

describe("request body", () => {
  it("uses the standard tier, one choice, no tools or other billable extensions", () => {
    const body = buildRequestBody(buildMessages("doc", cfg.maxInputChars), cfg);
    expect(body).toMatchObject({
      model: PINNED_MODEL,
      n: 1,
      service_tier: "default",
      reasoning_effort: "none",
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      store: false,
    });
    for (const k of ["tools", "tool_choice", "functions", "web_search_options", "audio", "modalities", "prediction", "logprobs"])
      expect(body).not.toHaveProperty(k);
  });
});

describe("cost bounds", () => {
  it("worst case covers any usage within the byte and output-token bounds", () => {
    const body = buildRequestBody(buildMessages(SAMPLES[0].text, cfg.maxInputChars), cfg);
    const bytes = new TextEncoder().encode(JSON.stringify(body)).length;
    expect(actualMicros({ prompt_tokens: bytes, completion_tokens: MAX_OUTPUT_TOKENS }, cfg)).toBeLessThanOrEqual(worstCaseMicros(body, cfg));
  });

  it("returns null for missing or malformed usage", () => {
    expect(actualMicros(undefined, cfg)).toBeNull();
    expect(actualMicros({ prompt_tokens: "1" }, cfg)).toBeNull();
    expect(actualMicros({ prompt_tokens: 1.5, completion_tokens: 1 }, cfg)).toBeNull();
    expect(actualMicros({ prompt_tokens: 1000, completion_tokens: 100 }, cfg)).toBe(COST_1000_100);
  });
});

describe("makeOpenAiExtractor", () => {
  it("never calls OpenAI when the budget gate refuses", async () => {
    const { budget, calls } = fakeBudget(false);
    const fetchFn = vi.fn<typeof fetch>();
    await expect(makeOpenAiExtractor(cfg, budget, fetchFn)("doc")).rejects.toThrow(/budget_exhausted/);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(calls.settle).toEqual([]);
  });

  it("reserves the worst case of the exact body sent, then settles the usage cost", async () => {
    const { budget, calls } = fakeBudget();
    const order: string[] = [];
    const reserve = budget.reserve;
    budget.reserve = async (a) => (order.push("reserve"), reserve(a));
    const fetchFn = vi.fn<typeof fetch>(async () => (order.push("fetch"), okResponse('{"carrier":"Acme"}')));
    expect(await makeOpenAiExtractor(cfg, budget, fetchFn)("doc")).toEqual({ carrier: "Acme" });
    expect(order).toEqual(["reserve", "fetch"]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(OPENAI_CHAT_URL);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-key");
    expect(calls.reserve).toEqual([worstCaseMicros(JSON.parse(String(init?.body)), cfg)]);
    expect(calls.settle).toEqual([["res-1", COST_1000_100, null]]);
  });

  it("keeps the full reservation when the cost is unknown", async () => {
    for (const fetchFn of [
      vi.fn<typeof fetch>(async () => new Response("err", { status: 500 })),
      vi.fn<typeof fetch>(async () => {
        throw new Error("network down");
      }),
      vi.fn<typeof fetch>(async () => okResponse("{}", { usage: undefined })),
    ]) {
      const { budget, calls } = fakeBudget();
      await makeOpenAiExtractor(cfg, budget, fetchFn)("doc").catch(() => undefined);
      expect(calls.settle).toEqual([["res-1", null, null]]);
    }
  });

  it("flags a non-default service tier or another model and keeps the full reservation", async () => {
    for (const [extra, flag] of [
      [{ service_tier: "priority" }, "unexpected_service_tier:priority"],
      [{ model: "gpt-5.5-pro" }, "unexpected_model:gpt-5.5-pro"],
    ] as const) {
      const { budget, calls } = fakeBudget();
      await expect(makeOpenAiExtractor(cfg, budget, async () => okResponse('{"carrier":"Acme"}', extra))("doc")).rejects.toThrow(
        /outside pinned billing/,
      );
      expect(calls.settle).toEqual([["res-1", null, flag]]);
    }
  });

  it("settles the known cost even when the content is unusable", async () => {
    const { budget, calls } = fakeBudget();
    await expect(makeOpenAiExtractor(cfg, budget, async () => okResponse("not json"))("doc")).rejects.toThrow(/no JSON/);
    expect(calls.settle).toEqual([["res-1", COST_1000_100, null]]);
  });

  it("feeds analyze: refusal falls back to rules, grounded values still need a verbatim quote", async () => {
    const sample = SAMPLES.find((s) => s.id === "sparse-email")!;
    const refused = await analyze(sample.text, makeOpenAiExtractor(cfg, fakeBudget(false).budget, vi.fn()));
    expect(refused.meta.mode).toBe("rules");
    expect(refused.meta.ai_note).toMatch(/budget gate refused/);

    const r = await analyze(
      sample.text,
      makeOpenAiExtractor(cfg, fakeBudget().budget, async () => okResponse('{"employer_contribution_pct": 99}')),
    );
    expect(r.meta.mode).toBe("rules+ai");
    expect(r.extraction.fields.employer_contribution_pct.value).toBeNull();
    expect(r.findings.some((f) => f.code === "AI_SUGGESTION_UNSUPPORTED")).toBe(true);
  });
});
