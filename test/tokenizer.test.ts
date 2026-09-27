import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MAX_INPUT_CHARS,
  MAX_OUTPUT_TOKENS,
  PINNED_MODEL,
  actualMicros,
  buildMessages,
  buildRequestBody,
  readOpenAiConfig,
  worstCaseInputTokens,
  worstCaseMicros,
  type OpenAiConfig,
} from "../src/ai/openai";
import { tokenCases } from "./fixtures/token-cases";

interface Counts {
  tiktoken_version: string;
  model: string;
  encoding: string;
  min_bytes_per_ordinary_token: number;
  cases: { id: string; content_tokens: number[]; content_bytes: number[] }[];
}

/** Measured with OpenAI's tiktoken by test/fixtures/count_tokens.py. */
const counts = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "o200k-token-counts.json"), "utf8")) as Counts;
const cfg = (readOpenAiConfig({ OPENAI_API_KEY: "test-key" }) as { config: OpenAiConfig }).config;
/** OpenAI cookbook chat-format overhead: 3 tokens per message plus 3 to prime the reply. */
const chatOverhead = (messages: number) => 3 * messages + 3;

describe("worst-case input tokens vs official o200k_base counts", () => {
  it("fixture was measured for the pinned model's encoding", () => {
    expect(counts).toMatchObject({ model: PINNED_MODEL, encoding: "o200k_base", min_bytes_per_ordinary_token: 1 });
  });

  it("fixture matches the current prompt (regenerate it if buildMessages changes)", () => {
    const cases = tokenCases();
    expect(counts.cases.map((c) => c.id)).toEqual(cases.map((c) => c.id));
    for (const [i, c] of cases.entries()) {
      const bytes = buildMessages(c.text, MAX_INPUT_CHARS).map((m) => new TextEncoder().encode(m.content).length);
      expect(bytes, c.id).toEqual(counts.cases[i].content_bytes);
    }
  });

  it("the reserved bound covers measured tokens plus chat overhead for every case, including adversarial text", () => {
    for (const [i, c] of tokenCases().entries()) {
      const measured = counts.cases[i];
      const body = buildRequestBody(buildMessages(c.text, MAX_INPUT_CHARS), cfg);
      const billedUpperEstimate = measured.content_tokens.reduce((a, b) => a + b, 0) + chatOverhead(measured.content_tokens.length);
      expect(worstCaseInputTokens(body), c.id).toBeGreaterThanOrEqual(billedUpperEstimate);
      expect(worstCaseMicros(body, cfg), c.id).toBeGreaterThanOrEqual(
        actualMicros({ prompt_tokens: billedUpperEstimate, completion_tokens: MAX_OUTPUT_TOKENS }, cfg)!,
      );
    }
  });
});
