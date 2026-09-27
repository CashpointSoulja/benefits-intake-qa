import { describe, expect, it, vi } from "vitest";
import { analyze } from "../src/engine/analyze";
import {
  MAX_OUTPUT_TOKENS,
  OPENAI_CHAT_URL,
  actualMicros,
  buildMessages,
  makeOpenAiExtractor,
  readOpenAiConfig,
  worstCaseMicros,
  type BudgetClient,
  type OpenAiConfig,
} from "../src/ai/openai";
import type { ReserveResult } from "../src/budget/ledger";
import { SAMPLES } from "../src/samples";

const env = {
  OPENAI_API_KEY: "test-key",
  OPENAI_MODEL: "test-model",
  OPENAI_INPUT_USD_PER_MTOK: "0.5",
  OPENAI_OUTPUT_USD_PER_MTOK: "2",
};
const cfg = (readOpenAiConfig(env) as { config: OpenAiConfig }).config;

function fakeBudget(allow = true) {
  const calls: { reserve: number[]; settle: [string, number | null][] } = { reserve: [], settle: [] };
  const budget: BudgetClient = {
    reserve: async (amount): Promise<ReserveResult> => {
      calls.reserve.push(amount);
      return allow
        ? { ok: true, id: "res-1", reserved: amount, committed: amount, limit: 1_000_000 }
        : { ok: false, reason: "budget_exhausted", committed: 1_000_000, limit: 1_000_000 };
    },
    settle: async (id, actual) => {
      calls.settle.push([id, actual]);
    },
  };
  return { budget, calls };
}

const okResponse = (content: string, usage: unknown = { prompt_tokens: 1000, completion_tokens: 100 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), { status: 200 });

describe("readOpenAiConfig", () => {
  it("requires key, model and both prices", () => {
    expect(readOpenAiConfig({})).toEqual({
      missing: ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_INPUT_USD_PER_MTOK", "OPENAI_OUTPUT_USD_PER_MTOK"],
    });
    expect(readOpenAiConfig({ ...env, OPENAI_OUTPUT_USD_PER_MTOK: "free" })).toEqual({ missing: ["OPENAI_OUTPUT_USD_PER_MTOK"] });
    expect(cfg).toMatchObject({ model: "test-model", inputPrice: 0.5, outputPrice: 2 });
  });
});

describe("cost bounds", () => {
  it("worst case covers any usage within the byte and output-token bounds", () => {
    const messages = buildMessages(SAMPLES[0].text, cfg.maxInputChars);
    const bytes = new TextEncoder().encode(JSON.stringify(messages)).length;
    const worst = worstCaseMicros(messages, cfg);
    expect(actualMicros({ prompt_tokens: bytes, completion_tokens: MAX_OUTPUT_TOKENS }, cfg)).toBeLessThanOrEqual(worst);
  });

  it("returns null for missing or malformed usage", () => {
    expect(actualMicros(undefined, cfg)).toBeNull();
    expect(actualMicros({ prompt_tokens: "1" }, cfg)).toBeNull();
    expect(actualMicros({ prompt_tokens: 10, completion_tokens: 5 }, cfg)).toBe(15);
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

  it("reserves before the request and settles the actual usage cost", async () => {
    const { budget, calls } = fakeBudget();
    const order: string[] = [];
    const reserve = budget.reserve;
    budget.reserve = async (a) => (order.push("reserve"), reserve(a));
    const fetchFn = vi.fn<typeof fetch>(async () => (order.push("fetch"), okResponse('{"carrier":"Acme"}')));
    const out = await makeOpenAiExtractor(cfg, budget, fetchFn)("doc");
    expect(out).toEqual({ carrier: "Acme" });
    expect(order).toEqual(["reserve", "fetch"]);
    expect(calls.settle).toEqual([["res-1", 1000 * 0.5 + 100 * 2]]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(OPENAI_CHAT_URL);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "test-model",
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      store: false,
    });
  });

  it("keeps the full reservation when the cost is unknown", async () => {
    for (const fetchFn of [
      vi.fn<typeof fetch>(async () => new Response("err", { status: 500 })),
      vi.fn<typeof fetch>(async () => {
        throw new Error("network down");
      }),
      vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }))),
    ]) {
      const { budget, calls } = fakeBudget();
      await makeOpenAiExtractor(cfg, budget, fetchFn)("doc").catch(() => undefined);
      expect(calls.settle).toEqual([["res-1", null]]);
    }
  });

  it("settles the known cost even when the content is unusable", async () => {
    const { budget, calls } = fakeBudget();
    await expect(makeOpenAiExtractor(cfg, budget, async () => okResponse("not json"))("doc")).rejects.toThrow(/no JSON/);
    expect(calls.settle).toEqual([["res-1", 700]]);
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
