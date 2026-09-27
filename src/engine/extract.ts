import {
  FIELD_KEYS,
  type Evidence,
  type ExtractedField,
  type Extraction,
  type FieldKey,
  type FieldValue,
} from "./types";

type Kind = "text" | "money" | "percent" | "int" | "date" | "bool" | "plan_type";

interface Spec {
  kind: Kind;
  /** Each pattern must expose the value in capture group 1. Matched per line, case-insensitive. */
  patterns: RegExp[];
  confidence: number;
}

const MONEY = String.raw`\$?\s*([\d,]+(?:\.\d{2})?)`;
const PCT = String.raw`(\d{1,3})\s*%`;
const DATE = String.raw`((?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})|(?:\d{4}-\d{2}-\d{2})|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}))`;

const rx = (s: string) => new RegExp(s, "i");

const SPECS: Record<FieldKey, Spec> = {
  employer_name: {
    kind: "text",
    confidence: 0.9,
    patterns: [rx(String.raw`^(?:employer|group|client|company)(?:\s+name)?\s*[:\-]\s*(.+)$`)],
  },
  carrier: {
    kind: "text",
    confidence: 0.9,
    patterns: [rx(String.raw`^(?:carrier|insurer|insurance carrier|medical carrier)\s*[:\-]\s*(.+)$`)],
  },
  plan_name: {
    kind: "text",
    confidence: 0.85,
    patterns: [rx(String.raw`^(?:plan|plan name|medical plan|product)\s*[:\-]\s*(.+)$`)],
  },
  plan_type: {
    kind: "plan_type",
    confidence: 0.8,
    patterns: [
      rx(String.raw`^(?:plan type|network type|type)\s*[:\-]\s*(.+)$`),
      rx(String.raw`\b(HDHP|PPO|HMO|EPO|POS)\b`),
    ],
  },
  effective_date: {
    kind: "date",
    confidence: 0.9,
    patterns: [rx(String.raw`(?:effective(?:\s+date)?|coverage (?:begins|starts)|start date|start coverage(?: on)?|begin coverage(?: on)?)\s*[:\-]?\s*` + DATE)],
  },
  renewal_date: {
    kind: "date",
    confidence: 0.85,
    patterns: [rx(String.raw`(?:renewal(?:\s+date)?|anniversary|plan year end|coverage ends)\s*[:\-]?\s*` + DATE)],
  },
  deductible_individual: {
    kind: "money",
    confidence: 0.85,
    patterns: [
      rx(String.raw`deductible[^$\n]*?(?:individual|single|employee only|ee only)[^$\n]*?` + MONEY),
      rx(String.raw`(?:individual|single)\s+deductible[^$\n]*?` + MONEY),
      rx(String.raw`^deductible\s*[:\-]\s*` + MONEY + String.raw`\s*(?:/|\bper\b|indiv)`),
    ],
  },
  deductible_family: {
    kind: "money",
    confidence: 0.85,
    patterns: [
      rx(String.raw`deductible[^$\n]*?family[^$\n]*?` + MONEY),
      rx(String.raw`family\s+deductible[^$\n]*?` + MONEY),
      rx(String.raw`^deductible\s*[:\-]\s*\$?[\d,]+(?:\.\d{2})?\s*/\s*` + MONEY),
    ],
  },
  oop_max_individual: {
    kind: "money",
    confidence: 0.85,
    patterns: [
      rx(String.raw`(?:out[- ]of[- ]pocket|oop)[^$\n]*?(?:individual|single|employee only|ee only)[^$\n]*?` + MONEY),
      rx(String.raw`(?:individual|single)\s+(?:out[- ]of[- ]pocket|oop)[^$\n]*?` + MONEY),
      rx(String.raw`^(?:out[- ]of[- ]pocket(?: max(?:imum)?)?|oop max(?:imum)?)\s*[:\-]\s*` + MONEY + String.raw`\s*(?:/|\bper\b|indiv)`),
    ],
  },
  oop_max_family: {
    kind: "money",
    confidence: 0.85,
    patterns: [
      rx(String.raw`(?:out[- ]of[- ]pocket|oop)[^$\n]*?family[^$\n]*?` + MONEY),
      rx(String.raw`family\s+(?:out[- ]of[- ]pocket|oop)[^$\n]*?` + MONEY),
      rx(String.raw`^(?:out[- ]of[- ]pocket(?: max(?:imum)?)?|oop max(?:imum)?)\s*[:\-]\s*\$?[\d,]+(?:\.\d{2})?\s*/\s*` + MONEY),
    ],
  },
  coinsurance_pct: {
    kind: "percent",
    confidence: 0.75,
    patterns: [
      rx(String.raw`coinsurance[^%\n]*?(?:member|employee|you)\s+pays?\)?\s*[:\-]?\s*` + PCT),
      rx(String.raw`coinsurance\s*[:\-]?\s*` + PCT),
      rx(String.raw`(?:member|employee) (?:pays|share)\s*[:\-]?\s*` + PCT + String.raw`[^\n]*coinsurance`),
    ],
  },
  pcp_copay: {
    kind: "money",
    confidence: 0.8,
    patterns: [
      rx(String.raw`(?:primary care|pcp|office visit)[^$\n]*?` + MONEY),
    ],
  },
  specialist_copay: {
    kind: "money",
    confidence: 0.8,
    patterns: [rx(String.raw`specialist[^$\n]*?` + MONEY)],
  },
  er_copay: {
    kind: "money",
    confidence: 0.8,
    patterns: [rx(String.raw`(?:emergency room|emergency|\bER\b)[^$\n]*?` + MONEY)],
  },
  waiting_period_days: {
    kind: "int",
    confidence: 0.8,
    patterns: [
      rx(String.raw`waiting period[^\n]*?(first of (?:the )?month(?: following)?[^\n]*)`),
      rx(String.raw`waiting period[^\d\n]*?(\d{1,3})\s*days?`),
      rx(String.raw`waiting period\s*[:\-]\s*(none|0|no waiting period)`),
    ],
  },
  eligibility_hours_per_week: {
    kind: "int",
    confidence: 0.8,
    patterns: [rx(String.raw`(\d{2})\s*(?:\+\s*)?(?:or more\s+)?hours?\s*(?:per|/|a)\s*week`)],
  },
  employer_contribution_pct: {
    kind: "percent",
    confidence: 0.8,
    patterns: [
      rx(String.raw`employer (?:contribution|pays|contributes)[^%\n]*?` + PCT),
      rx(String.raw`(?:company|group) (?:contribution|pays|contributes)[^%\n]*?` + PCT),
    ],
  },
  hsa_eligible: {
    kind: "bool",
    confidence: 0.75,
    patterns: [
      rx(String.raw`hsa[- ]?(?:eligible|compatible|qualified)\s*[:\-]?\s*(yes|no|true|false|y|n)\b`),
      rx(String.raw`^hsa\s*[:\-]\s*(yes|no|eligible|not eligible)`),
      rx(String.raw`\b(hsa[- ]?(?:eligible|compatible|qualified))\b`),
    ],
  },
};

export function normalizeText(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0);
}

function parseMoney(s: string): number | null {
  const n = Number(s.replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** Returns ISO yyyy-mm-dd or null. US m/d/y ordering assumed for slash dates. */
export function parseDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(y, +m[1], +m[2]);
  }
  m = t.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return valid(+m[3], mo, +m[2]);
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function coerce(kind: Kind, raw: string): FieldValue | null {
  const s = raw.trim();
  switch (kind) {
    case "money":
      return parseMoney(s);
    case "percent":
    case "int": {
      if (/^(none|no waiting period)$/i.test(s)) return 0;
      if (/first of (the )?month/i.test(s)) return s.toLowerCase();
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : null;
    }
    case "date":
      return parseDate(s);
    case "bool":
      if (/^(yes|true|y|eligible)$/i.test(s) || /hsa[- ]?(eligible|compatible|qualified)/i.test(s)) return true;
      if (/^(no|false|n|not eligible)$/i.test(s)) return false;
      return null;
    case "plan_type": {
      const m = s.match(/\b(HDHP|PPO|HMO|EPO|POS)\b/i);
      if (m) return m[1].toUpperCase();
      if (/high[- ]deductible/i.test(s)) return "HDHP";
      return null;
    }
    default:
      return s.replace(/\s*\(.*?\)\s*$/, "").trim() || null;
  }
}

interface Hit {
  value: FieldValue;
  evidence: Evidence;
  patternIdx: number;
}

/** Deterministic, label-driven extraction. Every value carries line-level evidence. */
export function extractFields(raw: string): Extraction {
  const lines = normalizeText(raw);
  const fields = {} as Record<FieldKey, ExtractedField>;

  for (const key of FIELD_KEYS) {
    const spec = SPECS[key];
    const hits: Hit[] = [];
    lines.forEach((line, i) => {
      for (let p = 0; p < spec.patterns.length; p++) {
        const m = line.match(spec.patterns[p]);
        if (m && m[1] !== undefined) {
          const value = coerce(spec.kind, m[1]);
          if (value !== null) {
            hits.push({ value, evidence: { line: i, snippet: line }, patternIdx: p });
            break;
          }
        }
      }
    });

    if (hits.length === 0) {
      fields[key] = { key, value: null, confidence: 0, evidence: [], source: "rules" };
      continue;
    }

    // Prefer the earliest pattern in the spec (most specific), then document order.
    hits.sort((a, b) => a.patternIdx - b.patternIdx || a.evidence.line - b.evidence.line);
    const distinct = [...new Set(hits.map((h) => JSON.stringify(h.value)))].map((v) => JSON.parse(v) as FieldValue);
    const best = hits[0];
    const penalty = 0.05 * best.patternIdx + (distinct.length > 1 ? 0.3 : 0);
    fields[key] = {
      key,
      value: best.value,
      confidence: Math.max(0.2, Math.round((spec.confidence - penalty) * 100) / 100),
      evidence: hits.map((h) => h.evidence),
      conflicts: distinct.length > 1 ? distinct : undefined,
      source: "rules",
    };
  }

  return { fields, lineCount: lines.length };
}
