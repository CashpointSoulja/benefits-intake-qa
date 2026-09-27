"""Counts o200k_base tokens with OpenAI's tiktoken for test/fixtures/token-cases.ts output.

Usage: npx tsx test/fixtures/token-cases.ts cases.json && python test/fixtures/count_tokens.py cases.json test/fixtures/o200k-token-counts.json
Requires: pip install tiktoken==0.14.0
"""
import json
import sys

import tiktoken

MODEL = "gpt-5.4-nano-2026-03-17"

enc = tiktoken.encoding_for_model(MODEL)
special = set(enc._special_tokens.values())

def token_bytes_min() -> int:
    lo = None
    for t in range(enc.max_token_value + 1):
        if t in special:
            continue
        try:
            n = len(enc.decode_single_token_bytes(t))
        except KeyError:
            continue
        lo = n if lo is None else min(lo, n)
    return lo


cases = json.load(open(sys.argv[1]))
out = {
    "tiktoken_version": tiktoken.__version__,
    "model": MODEL,
    "encoding": enc.name,
    "min_bytes_per_ordinary_token": token_bytes_min(),
    "cases": [
        {
            "id": c["id"],
            "content_tokens": [len(enc.encode(s, disallowed_special=())) for s in c["contents"]],
            "content_bytes": [len(s.encode("utf-8")) for s in c["contents"]],
        }
        for c in cases
    ],
}
json.dump(out, open(sys.argv[2], "w"), indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "cases"}))
for c in out["cases"]:
    print(c["id"], sum(c["content_tokens"]), sum(c["content_bytes"]))
