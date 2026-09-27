import { writeFileSync } from "node:fs";
import { buildMessages, MAX_INPUT_CHARS } from "../../src/ai/openai";
import { SAMPLES } from "../../src/samples";

/** Inputs whose o200k_base token counts are measured by scripts/count_tokens.py. */
export function tokenCases(): { id: string; text: string }[] {
  const cycle = (unit: string) => unit.repeat(Math.ceil(MAX_INPUT_CHARS / unit.length)).slice(0, MAX_INPUT_CHARS);
  return [
    ...SAMPLES.map((s) => ({ id: `sample:${s.id}`, text: s.text })),
    { id: "max-ascii-letters", text: cycle("a") },
    { id: "max-digits-punct", text: cycle("1,2.3$4%5/6-7 ") },
    { id: "max-random-ascii", text: Array.from({ length: MAX_INPUT_CHARS }, (_, i) => String.fromCharCode(33 + ((i * 7919) % 94))).join("") },
    { id: "max-cjk", text: cycle("医疗保险免赔额自付上限") },
    { id: "max-emoji", text: cycle("😀🧾💊🏥") },
    { id: "max-combining", text: cycle("e\u0301a\u0308o\u0303") },
    { id: "max-whitespace-mix", text: cycle(" \t\n\u00a0\u2003") },
    { id: "max-json-escapes", text: cycle('"\\\u0001\u001f') },
  ];
}

if (process.argv[2]) {
  const out = tokenCases().map((c) => ({ id: c.id, contents: buildMessages(c.text, MAX_INPUT_CHARS).map((m) => m.content) }));
  writeFileSync(process.argv[2], JSON.stringify(out));
}
